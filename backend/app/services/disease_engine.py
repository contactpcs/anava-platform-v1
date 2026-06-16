"""
DiseaseEngine — disease-level composite scoring.

Source of truth: 'Overall Scoring Details.docx' (D:/PCS/Scales pdfs/).

Algorithm (per the Word doc):
  1. Calculate all individual scale scores  ← done by ScaleEngine (assessment.py)
  2. Normalize each scale score → 0-100
  3. Reverse direction for 'higher = better' scales  (100 - normalized)
  4. Apply per-disease weights (re-normalise if some scales are missing)
  5. Compute weighted sum → disease severity score 0-100
  6. Map to: Normal (0-20), Mild (21-40), Moderate (41-60),
             Severe (61-80), Very Severe (81-100)

Usage:
    from app.services.disease_engine import disease_engine

    result = disease_engine.calculate(
        disease_id="depression-anxiety",
        scale_results={
            "PHQ-9":    {"total": 14, "max_possible": 27},
            "GAD-7":    {"total": 10, "max_possible": 21},
            ...
        }
    )
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class DiseaseScoreResult:
    disease_id: str
    disease_score: float                    # 0-100
    severity_level: str                     # normal / mild / moderate / severe / very_severe
    severity_label: str
    scale_breakdown: Dict[str, Any] = field(default_factory=dict)
    scales_used: int = 0
    scales_expected: int = 0
    missing_scales: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Scales where HIGHER raw score = BETTER outcome
# (normalized score must be reversed before weighting)
# ---------------------------------------------------------------------------

_HIGHER_IS_BETTER = {
    "Barthel-Index",
    "SS-QOL",
    "MSQ",
    "IADL",
    "MRC",
    "KPS",
    "GPCOG",
    "AMTS",
    "MoCA",
    "ALSFRS-R",
    "EQ-5D-5L",
}

# ---------------------------------------------------------------------------
# Per-disease scale weights (from Overall Scoring Details.docx)
# ---------------------------------------------------------------------------

_DISEASE_WEIGHTS: Dict[str, Dict[str, float]] = {

    # ── 1. DEPRESSION / ANXIETY ─────────────────────────────────────────
    "depression-anxiety": {
        "BDI-II":      0.25,
        "GAD-7":       0.20,
        "DASS-21":     0.15,
        "MADRS":       0.15,
        "PSQI":        0.10,
        "COMPASS-31":  0.10,
        "EQ-5D-5L":    0.05,
    },

    # ── 2. CHRONIC PAIN ─────────────────────────────────────────────────
    "chronic-pain": {
        "Pain-Rating-Scale": 0.25,
        "DN4":               0.15,
        "painDETECT":        0.15,
        "DASS-21":           0.10,
        "GAD-7":             0.10,
        "PSQI":              0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.05,
    },

    # ── 3. FIBROMYALGIA ─────────────────────────────────────────────────
    "fibromyalgia": {
        "FIQR":              0.40,
        "FSS":               0.15,
        "Pain-Rating-Scale": 0.15,
        "VAS-Pain":          0.10,
        "painDETECT":        0.10,
        "COMPASS-31":        0.05,
        "EQ-5D-5L":          0.05,
    },

    # ── 4. MIGRAINE ─────────────────────────────────────────────────────
    "migraine": {
        "MIDAS":             0.30,
        "MSQ":               0.15,
        "Pain-Rating-Scale": 0.15,
        "DASS-21":           0.10,
        "BDI-II":            0.10,
        "PSQI":              0.10,
        "COMPASS-31":        0.05,
        "EQ-5D-5L":          0.05,
    },

    # ── 5. ATAXIA ───────────────────────────────────────────────────────
    "ataxia": {
        "SARA":              0.40,
        "DHI":               0.15,
        "VVAS-Ataxia":       0.15,
        "DASS-21":           0.10,
        "BDI-II":            0.10,
        "COMPASS-31":        0.05,
        "EQ-5D-5L":          0.05,
    },

    # ── 6. AFTER STROKE / TBI ───────────────────────────────────────────
    "after-stroke-tbi": {
        "Barthel-Index":     0.25,
        "SS-QOL":            0.20,
        "KPS":               0.10,
        "MRC":               0.10,
        "MAS":               0.10,
        "MoCA":              0.10,
        "DASS-21":           0.05,
        "COMPASS-31":        0.05,
        "painDETECT":        0.05,
    },

    # ── 7. DEMENTIA ─────────────────────────────────────────────────────
    "dementia": {
        "MoCA":              0.30,
        "AMTS":              0.20,
        "DSRS":              0.15,
        "GDS":               0.10,
        "IADL":              0.10,
        "DASS-21":           0.05,
        "COMPASS-31":        0.05,
        "EQ-5D-5L":          0.05,
    },

    # ── 8. PARKINSON'S DISEASE ──────────────────────────────────────────
    # Word doc: PDSS(30%), PFS(25%), MoCA(20%), PainDETECT(15%), COMPASS(10%)
    "parkinsons-disease": {
        "PDSS":              0.30,
        "PFS-16":            0.25,
        "MoCA":              0.20,
        "painDETECT":        0.15,
        "COMPASS-31":        0.10,
    },

    # ── 9. TINNITUS ─────────────────────────────────────────────────────
    "tinnitus": {
        "THI":               0.50,
        "DASS-21":           0.15,
        "GAD-7":             0.10,
        "PSQI":              0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.05,
    },

    # ── 10. INSOMNIA ────────────────────────────────────────────────────
    "insomnia": {
        "PSQI":              0.25,
        "ISI":               0.20,
        "AIS":               0.15,
        "SLEEP-50":          0.10,
        "FFS":               0.10,
        "DASS-21":           0.05,
        "GAD-7":             0.05,
        "COMPASS-31":        0.05,
        "EQ-5D-5L":          0.05,
    },

    # ── 11. MULTIPLE SCLEROSIS ──────────────────────────────────────────
    "multiple-sclerosis": {
        "MFIS":              0.30,
        "SARA":              0.20,
        "DHI":               0.15,
        "MoCA":              0.10,
        "Barthel-Index":     0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.05,
    },

    # ── 12. ADHD ────────────────────────────────────────────────────────
    "adhd": {
        "ASRSv1.1":          0.40,
        "SNAP-IV":           0.30,
        "DASS-21":           0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.10,
    },

    # ── 13. ALS ─────────────────────────────────────────────────────────
    "als": {
        "ALSFRS-R":          0.40,
        "MAS":               0.15,
        "BDI-II":            0.10,
        "GAD-7":             0.10,
        "DASS-21":           0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.05,
    },

    # ── 14. IRRITABLE BOWEL DISEASE ─────────────────────────────────────
    "irritable-bowel-disease": {
        "IBS-SSS":           0.40,
        "Pain-Rating-Scale": 0.15,
        "DASS-21":           0.10,
        "BDI-II":            0.10,
        "HDRS":              0.10,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.05,
    },

    # ── 15. AUTISM SPECTRUM DISORDERS ───────────────────────────────────
    "autism-spectrum-disorders": {
        "RAADS-14":          0.40,
        "PANS-31":           0.25,
        "DASS-21":           0.15,
        "COMPASS-31":        0.10,
        "EQ-5D-5L":          0.10,
    },

    # ── 16. ADDICTION DISORDERS ─────────────────────────────────────────
    "addiction-disorders": {
        "AUDIT":             0.50,
        "DASS-21":           0.20,
        "GAD-7":             0.10,
        "PSQI":              0.10,
        "EQ-5D-5L":          0.10,
    },
}

# Global severity bands (from Overall Scoring Details.docx)
_SEVERITY_BANDS = [
    (0,  20, "normal",     "Normal"),
    (21, 40, "mild",       "Mild"),
    (41, 60, "moderate",   "Moderate"),
    (61, 80, "severe",     "Severe"),
    (81, 100, "very_severe", "Very Severe"),
]


class DiseaseEngine:

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def calculate(
        self,
        disease_id: str,
        scale_results: Dict[str, Dict[str, float]],
    ) -> Optional[DiseaseScoreResult]:
        """
        Calculate composite disease severity score.

        Parameters
        ----------
        disease_id    : e.g. "depression-anxiety"
        scale_results : {scale_code: {"total": float, "max_possible": float}}
                        Only include completed scales.

        Returns None if the disease_id is not configured or no scales match.
        """
        weights = _DISEASE_WEIGHTS.get(disease_id)
        if not weights:
            return None

        available: Dict[str, float] = {}   # scale_code → normalized (0-100)
        breakdown: Dict[str, Any]  = {}
        missing: List[str] = []

        for scale_code, w in weights.items():
            result = scale_results.get(scale_code)
            if result is None:
                missing.append(scale_code)
                continue

            raw   = result.get("total", 0.0)
            max_s = result.get("max_possible", 0.0)

            norm = self._normalize(raw, max_s)
            if scale_code in _HIGHER_IS_BETTER:
                norm = 100.0 - norm

            available[scale_code] = norm
            breakdown[scale_code] = {
                "raw":        raw,
                "max":        max_s,
                "normalized": round(norm, 1),
                "weight":     w,
            }

        if not available:
            return None

        # Re-normalise weights for present scales
        total_w = sum(weights[s] for s in available)
        if total_w <= 0:
            return None

        weighted_sum = sum(
            available[s] * (weights[s] / total_w)
            for s in available
        )
        disease_score = round(weighted_sum, 1)

        # Update breakdown with effective weight
        for s in available:
            breakdown[s]["effective_weight"] = round(weights[s] / total_w, 4)

        level, label = self._get_severity(disease_score)

        return DiseaseScoreResult(
            disease_id=disease_id,
            disease_score=disease_score,
            severity_level=level,
            severity_label=label,
            scale_breakdown=breakdown,
            scales_used=len(available),
            scales_expected=len(weights),
            missing_scales=missing,
        )

    def get_disease_scales(self, disease_id: str) -> List[str]:
        """Return the list of scale codes assigned to a disease."""
        return list(_DISEASE_WEIGHTS.get(disease_id, {}).keys())

    def is_score_complete(
        self,
        disease_id: str,
        completed_scale_codes: List[str],
    ) -> bool:
        """True when all weighted scales for the disease have been completed."""
        required = set(_DISEASE_WEIGHTS.get(disease_id, {}).keys())
        return required.issubset(set(completed_scale_codes))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _normalize(self, raw: float, max_score: float) -> float:
        if max_score <= 0:
            return 0.0
        return round(min(100.0, (raw / max_score) * 100), 2)

    def _get_severity(self, score: float):
        for mn, mx, level, label in _SEVERITY_BANDS:
            if mn <= score <= mx:
                return level, label
        return "very_severe", "Very Severe"


disease_engine = DiseaseEngine()
