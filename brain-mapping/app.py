"""
EEG Analysis API — standalone FastAPI service.

On analysis completion, generated PDFs are uploaded directly to S3, then
metadata is registered with the NeuroWellness backend.

Environment variables (set in .env):
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET_NAME
  NEUROWELLNESS_API_URL   Base URL of the main backend (default: http://localhost:8000)
  SERVICE_API_KEY         Shared secret for service-to-service auth with neurowellness
  PYVISTA_OFF_SCREEN      Set to "true" for headless rendering
"""

import hashlib
import os
import shutil
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, Optional

import boto3
import httpx
import matplotlib
from dotenv import load_dotenv

load_dotenv()

matplotlib.use("Agg")

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

RESULTS_DIR = Path("results")
STATIC_DIR = Path("static")
ICONS_DIR = Path("materials and icons")

for d in [RESULTS_DIR, STATIC_DIR]:
    d.mkdir(exist_ok=True)

jobs: Dict[str, Dict[str, Any]] = {}
_executor = ThreadPoolExecutor(max_workers=1)

NEUROWELLNESS_API_URL: str = os.getenv("NEUROWELLNESS_API_URL", "http://localhost:8000")
SERVICE_API_KEY: str = os.getenv("SERVICE_API_KEY", "")
NEUROWELLNESS_REGISTER_ENDPOINT = f"{NEUROWELLNESS_API_URL}/api/v1/eeg/reports/register"

S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "neurowellness-eeg-reports")
AWS_REGION: str = os.getenv("AWS_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY")

app = FastAPI(title="EEG Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    session_id: Optional[str] = Form(None),
    report_name: Optional[str] = Form(None),
):
    """
    Accept a .nedf or .edf file, run full EEG analysis pipeline, and upload
    generated PDFs to the NeuroWellness backend.
    """
    if not file.filename.lower().endswith((".nedf", ".edf")):
        raise HTTPException(status_code=400, detail="Only .nedf or .edf files accepted")

    job_id = str(uuid.uuid4())
    job_dir = RESULTS_DIR / job_id
    job_dir.mkdir(parents=True)

    nedf_path = job_dir / file.filename
    with open(nedf_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    derived_report_name = report_name or nedf_path.stem

    jobs[job_id] = {
        "status": "queued",
        "step": "Queued — waiting for worker",
        "file": file.filename,
        "patient_id": patient_id,
        "session_id": session_id,
        "report_name": derived_report_name,
        "outputs": [],
        "uploaded_report_ids": [],
        "warnings": [],
        "error": None,
    }

    _executor.submit(_run_analysis, job_id, nedf_path, job_dir, patient_id, session_id, derived_report_name)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


@app.get("/download/{job_id}/{filename:path}")
def download_file(job_id: str, filename: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job_dir = (RESULTS_DIR / job_id).resolve()
    file_path = (job_dir / filename).resolve()

    if not str(file_path).startswith(str(job_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(str(file_path), filename=Path(filename).name)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _step(job_id: str, msg: str) -> None:
    jobs[job_id]["step"] = msg


def _warn(job_id: str, msg: str) -> None:
    jobs[job_id]["warnings"].append(msg)


def _get_s3_client():
    kwargs = {"region_name": AWS_REGION}
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **kwargs)


def _upload_pdf_to_s3(pdf_path: Path, patient_id: str, report_uuid: str) -> tuple[str, int, str]:
    """Upload PDF to S3, return (s3_key, file_size_bytes, sha256_checksum)."""
    content = pdf_path.read_bytes()
    s3_key = f"eeg_reports/{patient_id}/{report_uuid}.pdf"
    checksum = hashlib.sha256(content).hexdigest()
    s3 = _get_s3_client()
    s3.put_object(
        Bucket=S3_BUCKET_NAME,
        Key=s3_key,
        Body=content,
        ContentType="application/pdf",
    )
    return s3_key, len(content), checksum


def _register_with_backend(
    s3_key: str,
    patient_id: str,
    session_id: Optional[str],
    report_name: str,
    report_type: str,
    file_size_bytes: int,
    sha256_checksum: str,
) -> Optional[str]:
    """POST metadata (no file bytes) to neurowellness /register. Returns report_id or None."""
    if not SERVICE_API_KEY:
        return None
    try:
        resp = httpx.post(
            NEUROWELLNESS_REGISTER_ENDPOINT,
            headers={"X-Service-Key": SERVICE_API_KEY},
            json={
                "patient_id": patient_id,
                "session_id": session_id,
                "report_name": report_name,
                "report_type": report_type,
                "s3_key": s3_key,
                "file_size_bytes": file_size_bytes,
                "sha256_checksum": sha256_checksum,
            },
            timeout=30,
        )
        if resp.status_code in (200, 201):
            return resp.json().get("data", {}).get("id")
        return None
    except Exception:
        return None


def _run_analysis(
    job_id: str,
    nedf_path: Path,
    job_dir: Path,
    patient_id: str,
    session_id: Optional[str],
    report_name: str,
) -> None:
    jobs[job_id]["status"] = "running"
    try:
        import mne
        import eeg_report_script as ers

        base_name = nedf_path.stem
        target_dir = str(job_dir)
        icons_path = str(ICONS_DIR.resolve())

        # ── 1. Load ───────────────────────────────────────────────────────────
        _step(job_id, "Loading EEG data")
        ext = nedf_path.suffix.lower()
        if ext == ".nedf":
            raw = mne.io.read_raw_nedf(str(nedf_path), preload=True)
        elif ext == ".edf":
            raw = mne.io.read_raw_edf(str(nedf_path), preload=True)
            rename_map = {ch: ch.replace("-REF", "") for ch in raw.ch_names if "-REF" in ch}
            if rename_map:
                raw.rename_channels(rename_map)
            non_eeg = {
                ch: "misc"
                for ch in raw.ch_names
                if ch in ("LOC-A2", "ROC-A1", "LOC", "ROC", "A1", "A2")
                or "EMG" in ch.upper()
            }
            if non_eeg:
                raw.set_channel_types(non_eeg)
        else:
            raise ValueError(f"Unsupported format: {ext}")
        raw.set_montage("standard_1020", on_missing="ignore")

        # ── 2. Raw/filtered EEG plots ─────────────────────────────────────────
        _step(job_id, "Generating raw / filtered EEG plots")
        os.makedirs(f"{target_dir}/plots", exist_ok=True)
        raw_clean = ers.save_raw_and_cleaned_data(raw, target_dir)

        # ── 3. ICA ────────────────────────────────────────────────────────────
        _step(job_id, "Computing ICA components (10-20 min)")
        ers.dipoles.clear()
        ers.save_ica_components(raw_clean, ers.dipoles, target_dir)

        # ── 4. Band topomaps ──────────────────────────────────────────────────
        _step(job_id, "Generating band topomaps")
        ers.band_topomaps(raw_clean, target_dir=target_dir, bands=ers.EEG_Bands)

        # ── 5. DOCX report ────────────────────────────────────────────────────
        _step(job_id, "Building Word report")
        metadata = ers.make_doc(base_name, raw, target_dir, ers.OUTPUT_DOCX, icons_path)

        # ── 6. PDF conversion ─────────────────────────────────────────────────
        _step(job_id, "Converting DOCX → PDF")
        try:
            ers.doc_to_pdf(ers.OUTPUT_DOCX, ers.OUTPUT_PDF, target_dir)
        except Exception as e:
            _warn(job_id, f"PDF conversion failed (LibreOffice/docx2pdf): {e}")

        # ── 7. Brain indicators ───────────────────────────────────────────────
        _step(job_id, "Generating brain indicator report")
        try:
            ers.plot_indicators(raw, base_name, target_dir)
        except Exception as e:
            _warn(job_id, f"Brain indicators failed: {e}")

        # ── 8. Connectivity ───────────────────────────────────────────────────
        _step(job_id, "Computing brain connectivity report")
        try:
            ers.brain_connectivity(
                raw,
                metadata,
                ers.normative_stats,
                target_dir,
                ers.OUTPUT_BRAIN_CONNECTIVITY,
                ers.brain_image,
            )
        except Exception as e:
            _warn(job_id, f"Brain connectivity failed: {e}")

        # ── 9. Collect PDFs ───────────────────────────────────────────────────
        all_files = [f for f in sorted(job_dir.rglob("*")) if f.is_file()]
        pdf_files = [f for f in all_files if f.suffix == ".pdf"]
        outputs = [f.relative_to(job_dir).as_posix() for f in pdf_files]

        # ── 10. Upload PDFs to S3, register metadata with backend ────────────
        _step(job_id, "Uploading reports to S3")
        uploaded_ids = []
        for pdf in pdf_files:
            rtype = _infer_report_type(pdf.name)
            report_uuid = str(uuid.uuid4())
            try:
                s3_key, file_size, checksum = _upload_pdf_to_s3(pdf, patient_id, report_uuid)
            except Exception as exc:
                _warn(job_id, f"S3 upload failed for {pdf.name}: {exc}")
                continue
            rid = _register_with_backend(
                s3_key, patient_id, session_id, report_name, rtype, file_size, checksum
            )
            if rid:
                uploaded_ids.append(rid)
            else:
                _warn(job_id, f"Backend registration skipped or failed for {pdf.name}")

        jobs[job_id].update(
            {
                "status": "done",
                "step": "Complete",
                "outputs": outputs,
                "uploaded_report_ids": uploaded_ids,
            }
        )

    except Exception as e:
        jobs[job_id].update(
            {
                "status": "failed",
                "step": "Failed",
                "error": f"{e}\n{traceback.format_exc()}",
            }
        )


def _infer_report_type(filename: str) -> str:
    name = filename.lower()
    if "connectivity" in name:
        return "BRAIN_CONNECTIVITY"
    if "indicator" in name:
        return "BRAIN_INDICATORS"
    return "EEG_ANALYSIS"
