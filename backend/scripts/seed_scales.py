#!/usr/bin/env python3
"""
Seed PRS diseases, scales, and disease_scale_map from JSON files into Supabase.
Usage: python scripts/seed_scales.py --scales-dir PATH --conditions-file PATH

v6: Updated for TEXT-based composite IDs and new schema.
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from app.database import get_supabase_admin


def _scale_code(name):
    """Extract short code from scale name."""
    m = re.match(r'^([A-Za-z0-9\-]+(?:\s*v?\d+\.?\d*)?)\s*[-]\s', name)
    if m:
        return m.group(1).strip()
    m2 = re.match(r'^([A-Z][A-Z0-9\-]+(?:\s*\d+)?)\s', name)
    if m2:
        return m2.group(1).strip()
    return re.sub(r'[^A-Z0-9\-]', '', name.upper())


def seed_scales(scales_dir: str, conditions_file: str):
    admin = get_supabase_admin()
    scales_path = Path(scales_dir)
    total_scales = 0
    total_questions = 0

    for json_file in sorted(scales_path.glob("*.json")):
        with open(json_file, "r", encoding="utf-8") as f:
            scale = json.load(f)

        code = scale.get("id") or json_file.stem
        sid = f"{code}/2026"
        print(f"  Seeding scale: {sid}...", end="", flush=True)

        scale_row = {
            "scale_id": sid,
            "scale_code": code,
            "scale_name": scale.get("name", code),
            "is_common_scale": False,
            "num_diseases_used": 1,
        }

        admin.table("prs_scales").upsert(scale_row, on_conflict="scale_id").execute()

        questions = scale.get("questions", [])
        for idx, q in enumerate(questions):
            q_code = f"{code}/{idx + 1:03d}"
            q_row = {
                "question_id": q_code,
                "question_code": q_code,
                "scale_id": sid,
                "question_text": q.get("question") or q.get("text") or q.get("label") or f"Question {idx + 1}",
                "answer_type": q.get("type", "likert"),
                "is_required": q.get("required", True),
                "display_order": idx,
                "is_common_scale": False,
            }
            admin.table("prs_questions").upsert(q_row, on_conflict="question_id").execute()

            # Seed options
            options = q.get("options", [])
            for opt_idx, opt in enumerate(options):
                opt_id = f"{q_code}/{opt_idx + 1:02d}"
                opt_row = {
                    "option_id": opt_id,
                    "question_id": q_code,
                    "option_label": opt.get("label", str(opt.get("value", opt_idx))),
                    "option_value": str(opt.get("value", opt_idx)),
                    "points": opt.get("points", opt.get("value", 0)),
                    "display_order": opt_idx,
                    "status": True,
                }
                admin.table("prs_options").upsert(opt_row, on_conflict="question_id,option_value").execute()

        total_scales += 1
        total_questions += len(questions)
        print(f" OK ({len(questions)} questions)")

    # ── Seed diseases from conditions file ───────────────────────────────────
    print(f"\n  Seeding diseases from {conditions_file}...")
    with open(conditions_file, "r", encoding="utf-8") as f:
        condition_map = json.load(f)

    total_diseases = 0
    for cond_id, cond_data in condition_map.get("conditions", {}).items():
        disease_name = cond_data.get("label", cond_id)
        did = re.sub(r'[^A-Z0-9/]', '', disease_name.upper().replace("'", "").replace(" ", "")) + "/2026"
        dcode = re.sub(r'[^A-Z0-9]', '', disease_name.upper().replace("'", ""))

        disease_row = {
            "disease_id": did,
            "disease_code": dcode,
            "disease_name": disease_name,
            "version": "v1.0",
            "status": True,
        }
        admin.table("prs_diseases").upsert(disease_row, on_conflict="disease_id").execute()

        # Seed disease_scale_map
        for order, scale_code_val in enumerate(cond_data.get("scales", []), 1):
            sid = f"{scale_code_val}/2026"
            dsid = f"{disease_name}/{scale_code_val}"
            ds_row = {
                "ds_map_id": dsid,
                "disease_id": did,
                "scale_id": sid,
                "display_order": order,
                "is_required": True,
            }
            admin.table("prs_disease_scale_map").upsert(ds_row, on_conflict="disease_id,scale_id").execute()

        total_diseases += 1
        print(f"    OK {did}: {len(cond_data.get('scales', []))} scales")

    print(f"\nSeeding complete:")
    print(f"   Scales:    {total_scales}")
    print(f"   Questions: {total_questions}")
    print(f"   Diseases:  {total_diseases}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed PRS scales into Supabase")
    parser.add_argument("--scales-dir", required=True, help="Path to scales/ directory")
    parser.add_argument("--conditions-file", required=True, help="Path to conditionMap.json")
    args = parser.parse_args()
    print("NeuroWellness Scale Seeder Starting...\n")
    seed_scales(args.scales_dir, args.conditions_file)
