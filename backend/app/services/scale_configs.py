"""
Scale configuration definitions.
Source of truth: 'Scoring caluculation for each scale in detail.docx'
and 'Overall Scoring Details.docx' (D:/PCS/Scales pdfs/).

Each entry contains ONLY structural/algorithmic data needed by ScaleEngine.
Question text and options (points) are fetched from the database at runtime
and merged by ScaleConfigLoader.

Convention:
  - questionIndices / subscale items are 0-based (match DB display_order index)
  - direction: "negative" = higher raw score is worse (default)
                "positive" = higher raw score is better (reversed when normalising)
"""

from typing import Dict, Any

# ---------------------------------------------------------------------------
# Helper: shared severity band shapes
# ---------------------------------------------------------------------------

def _bands(*tuples):
    """Build a list of severity band dicts from (min, max, level, label) tuples."""
    return [{"min": mn, "max": mx, "level": lvl, "label": lbl}
            for mn, mx, lvl, lbl in tuples]


# ---------------------------------------------------------------------------
# SCALE CONFIGS
# Keyed by scale_code exactly as stored in prs_scales.scale_code
# ---------------------------------------------------------------------------

SCALE_CONFIGS: Dict[str, Dict[str, Any]] = {

    # ------------------------------------------------------------------
    # AIS – Athens Insomnia Scale
    # 8 items (0-3 each), total 0-24; cutoff 6 = insomnia
    # ------------------------------------------------------------------
    "AIS": {
        "id": "AIS",
        "scoringType": "sum",
        "maxScore": 24,
        "cutoff": 6,
        "severityBands": _bands(
            (0,  5,  "normal",   "No Insomnia"),
            (6,  10, "mild",     "Mild Insomnia"),
            (11, 17, "moderate", "Moderate Insomnia"),
            (18, 24, "severe",   "Severe Insomnia"),
        ),
    },

    # ------------------------------------------------------------------
    # ALSFRS-R – ALS Functional Rating Scale (Revised)
    # 12 items (0-4 each), total 0-48; higher = better function
    # Word doc says "10 measures, max 40" (original ALSFRS).
    # We implement the -R version (12 items, max 48) as per PDF.
    # ------------------------------------------------------------------
    "ALSFRS-R": {
        "id": "ALSFRS-R",
        "scoringType": "subscale-sum",
        "maxScore": 48,
        "direction": "positive",
        "subscales": [
            {"id": "bulbar",       "name": "Bulbar",       "questionIndices": [0, 1, 2]},
            {"id": "fine_motor",   "name": "Fine Motor",   "questionIndices": [3, 4, 5]},
            {"id": "gross_motor",  "name": "Gross Motor",  "questionIndices": [6, 7, 8]},
            {"id": "respiratory",  "name": "Respiratory",  "questionIndices": [9, 10, 11]},
        ],
        "severityBands": _bands(
            (40, 48, "normal",   "Minimal Impairment"),
            (30, 39, "mild",     "Mild Impairment"),
            (20, 29, "moderate", "Moderate Impairment"),
            (10, 19, "severe",   "Severe Impairment"),
            (0,   9, "critical", "Critical Impairment"),
        ),
    },

    # ------------------------------------------------------------------
    # AMTS – Abbreviated Mental Test Score
    # 10 questions (1 point each), total 0-10
    # 0-3 severe impairment; 4-6 moderate; >6 normal
    # ------------------------------------------------------------------
    "AMTS": {
        "id": "AMTS",
        "scoringType": "sum",
        "maxScore": 10,
        "direction": "positive",
        "severityBands": _bands(
            (7,  10, "normal",   "Normal"),
            (4,   6, "moderate", "Moderate Impairment"),
            (0,   3, "severe",   "Severe Impairment"),
        ),
    },

    # ------------------------------------------------------------------
    # ASRSv1.1 – Adult ADHD Self-Report Scale v1.1
    # Part A: 6 items; screening positive if ≥4 items in shaded zone
    # Part B: 12 items – informational only, no total score
    # ------------------------------------------------------------------
    "ASRSv1.1": {
        "id": "ASRSv1.1",
        "scoringType": "asrs-screening",
        "maxScore": 6,
        "screeningThreshold": 4,
        "partA": [0, 1, 2, 3, 4, 5],
    },

    # ------------------------------------------------------------------
    # AUDIT – Alcohol Use Disorders Identification Test
    # 10 items, total 0-40
    # ------------------------------------------------------------------
    "AUDIT": {
        "id": "AUDIT",
        "scoringType": "sum",
        "maxScore": 40,
        "severityBands": _bands(
            (0,   7, "low",      "Low Risk"),
            (8,  15, "mild",     "Hazardous Use"),
            (16, 19, "moderate", "Harmful Use"),
            (20, 40, "severe",   "Alcohol Dependence"),
        ),
    },

    # ------------------------------------------------------------------
    # Barthel-Index – Barthel Index of ADL
    # 10 items, total 0-100; higher = more independent
    # ------------------------------------------------------------------
    "Barthel-Index": {
        "id": "Barthel-Index",
        "scoringType": "sum",
        "maxScore": 100,
        "direction": "positive",
        "severityBands": _bands(
            (91, 100, "slight",   "Slight Dependency"),
            (61,  90, "moderate", "Moderate Dependency"),
            (21,  60, "severe",   "Severe Dependency"),
            (0,   20, "total",    "Total Dependency"),
        ),
    },

    # ------------------------------------------------------------------
    # BDI-II – Beck Depression Inventory II
    # 21 items (0-3), total 0-63
    # ------------------------------------------------------------------
    "BDI-II": {
        "id": "BDI-II",
        "scoringType": "sum",
        "maxScore": 63,
        "subscales": [
            {"id": "cognitive_affective", "name": "Cognitive-Affective",
             "questionIndices": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]},
            {"id": "somatic",            "name": "Somatic-Performance",
             "questionIndices": [14, 15, 16, 17, 18, 19, 20]},
        ],
        "severityBands": _bands(
            (0,  10, "normal",   "Normal"),
            (11, 16, "mild",     "Mild Mood Disturbance"),
            (17, 20, "borderline", "Borderline Clinical Depression"),
            (21, 30, "moderate", "Moderate Depression"),
            (31, 40, "severe",   "Severe Depression"),
            (41, 63, "extreme",  "Extreme Depression"),
        ),
    },

    # ------------------------------------------------------------------
    # BPQ-Short-Form – Body Perception Questionnaire Short Form
    # 20 items, total 0-100
    # ------------------------------------------------------------------
    "BPQ-Short-Form": {
        "id": "BPQ-Short-Form",
        "scoringType": "sum",
        "maxScore": 100,
        "severityBands": _bands(
            (0,  20, "normal",   "Minimal Autonomic Symptoms"),
            (21, 40, "mild",     "Mild Autonomic Symptoms"),
            (41, 60, "moderate", "Moderate Autonomic Symptoms"),
            (61, 80, "severe",   "Severe Autonomic Symptoms"),
            (81, 100, "very_severe", "Very Severe Autonomic Symptoms"),
        ),
    },

    # ------------------------------------------------------------------
    # COMPASS-31 – Composite Autonomic Symptom Score 31
    # 31 items across 6 weighted domains, total 0-100
    # Domain multipliers from scoring doc:
    #   Orthostatic (items 1-4):   ×4     → max 40
    #   Vasomotor (items 5-7):     ×0.8333 → max 5
    #   Secretomotor (items 8-11): ×2.1429 → max 15
    #   GI (items 12-23):          ×0.8929 → max 25
    #   Bladder (items 24-26):     ×1.111  → max 10
    #   Pupillomotor (items 27-31):×0.333  → max 5
    # ------------------------------------------------------------------
    "COMPASS-31": {
        "id": "COMPASS-31",
        "scoringType": "compass31",
        "maxScore": 100,
        "domains": [
            {"id": "orthostatic",   "name": "Orthostatic Intolerance",
             "questionIndices": [0, 1, 2, 3],        "multiplier": 4.0,       "maxWeighted": 40},
            {"id": "vasomotor",     "name": "Vasomotor",
             "questionIndices": [4, 5, 6],            "multiplier": 0.8333,    "maxWeighted": 5},
            {"id": "secretomotor",  "name": "Secretomotor",
             "questionIndices": [7, 8, 9, 10],        "multiplier": 2.142857,  "maxWeighted": 15},
            {"id": "gastrointestinal", "name": "Gastrointestinal",
             "questionIndices": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
             "multiplier": 0.892857,  "maxWeighted": 25},
            {"id": "bladder",       "name": "Bladder",
             "questionIndices": [23, 24, 25],         "multiplier": 1.111,     "maxWeighted": 10},
            {"id": "pupillomotor",  "name": "Pupillomotor",
             "questionIndices": [26, 27, 28, 29, 30], "multiplier": 0.333,     "maxWeighted": 5},
        ],
        "severityBands": _bands(
            (0,  23, "remission", "Remission / Low"),
            (24, 40, "mild",      "Mild"),
            (41, 63, "moderate",  "Moderate"),
            (64, 82, "severe",    "Severe"),
            (83, 100, "very_severe", "Very Severe"),
        ),
    },

    # ------------------------------------------------------------------
    # DASS-21 – Depression Anxiety Stress Scales (21 items)
    # Three 7-item subscales; EACH subscale score = sum × 2
    # Subscale indices (0-based, from standard DASS-21 item numbering):
    #   Depression: items 3,5,10,13,16,17,21 → 0-idx: 2,4,9,12,15,16,20
    #   Anxiety:    items 2,4,7,9,15,19,20   → 0-idx: 1,3,6,8,14,18,19
    #   Stress:     items 1,6,8,11,12,14,18  → 0-idx: 0,5,7,10,11,13,17
    # ------------------------------------------------------------------
    "DASS-21": {
        "id": "DASS-21",
        "scoringType": "dass21",
        "maxScore": 63,
        "subscales": [
            {
                "id": "depression", "name": "Depression",
                "questionIndices": [2, 4, 9, 12, 15, 16, 20],
                "multiplier": 2,
                "severityBands": _bands(
                    (0,  9,  "normal",   "Normal"),
                    (10, 13, "mild",     "Mild Depression"),
                    (14, 20, "moderate", "Moderate Depression"),
                    (21, 27, "severe",   "Severe Depression"),
                    (28, 42, "extremely_severe", "Extremely Severe Depression"),
                ),
            },
            {
                "id": "anxiety", "name": "Anxiety",
                "questionIndices": [1, 3, 6, 8, 14, 18, 19],
                "multiplier": 2,
                "severityBands": _bands(
                    (0,  7,  "normal",   "Normal"),
                    (8,  9,  "mild",     "Mild Anxiety"),
                    (10, 14, "moderate", "Moderate Anxiety"),
                    (15, 19, "severe",   "Severe Anxiety"),
                    (20, 42, "extremely_severe", "Extremely Severe Anxiety"),
                ),
            },
            {
                "id": "stress", "name": "Stress",
                "questionIndices": [0, 5, 7, 10, 11, 13, 17],
                "multiplier": 2,
                "severityBands": _bands(
                    (0,  14, "normal",   "Normal"),
                    (15, 18, "mild",     "Mild Stress"),
                    (19, 25, "moderate", "Moderate Stress"),
                    (26, 33, "severe",   "Severe Stress"),
                    (34, 42, "extremely_severe", "Extremely Severe Stress"),
                ),
            },
        ],
        "severityBands": _bands(
            (0,  29, "normal",   "Normal"),
            (30, 40, "mild",     "Mild"),
            (41, 60, "moderate", "Moderate"),
            (61, 80, "severe",   "Severe"),
            (81, 126, "very_severe", "Very Severe"),
        ),
    },

    # ------------------------------------------------------------------
    # DHI – Dizziness Handicap Inventory
    # 25 items (Yes=4, Sometimes=2, No=0), total 0-100
    # 3 subscales: Functional (F), Physical (P), Emotional (E)
    # ------------------------------------------------------------------
    "DHI": {
        "id": "DHI",
        "scoringType": "sum",
        "maxScore": 100,
        "severityBands": _bands(
            (0,  15, "normal",   "No Handicap"),
            (16, 34, "mild",     "Mild Handicap"),
            (36, 52, "moderate", "Moderate Handicap"),
            (54, 100, "severe",  "Severe Handicap"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">", "threshold": 10,
             "message": "Dizziness score >10: refer to balance specialist",
             "priority": "moderate"},
        ],
    },

    # ------------------------------------------------------------------
    # DN4 – Douleur Neuropathique 4
    # 10 items (Yes=1, No=0); score ≥4 = neuropathic pain
    # ------------------------------------------------------------------
    "DN4": {
        "id": "DN4",
        "scoringType": "sum",
        "maxScore": 10,
        "cutoff": 4,
        "severityBands": _bands(
            (0, 3,  "unlikely",  "Neuropathic Pain Unlikely"),
            (4, 10, "likely",    "Neuropathic Pain Likely"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 4,
             "message": "DN4 ≥4: neuropathic pain probable",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # DSRS – Dementia Severity Rating Scale
    # 12 items, total 0-54; 0-18 mild, 19-36 moderate, 37+ severe
    # ------------------------------------------------------------------
    "DSRS": {
        "id": "DSRS",
        "scoringType": "sum",
        "maxScore": 54,
        "severityBands": _bands(
            (0,  18, "mild",     "Mild Dementia"),
            (19, 36, "moderate", "Moderate Dementia"),
            (37, 54, "severe",   "Severe Dementia"),
        ),
    },

    # ------------------------------------------------------------------
    # EDSS – Expanded Disability Status Scale
    # Clinician-rated 0-10 (steps of 0.5); total = single score
    # ------------------------------------------------------------------
    "EDSS": {
        "id": "EDSS",
        "scoringType": "clinician",
        "maxScore": 10,
        "severityBands": _bands(
            (0,  1.5, "normal",   "Normal"),
            (2,  3.5, "mild",     "Mild Disability"),
            (4,  5.5, "moderate", "Moderate Disability"),
            (6,  7.5, "severe",   "Severe Disability"),
            (8,  10,  "critical", "Very Severe / Bedbound"),
        ),
    },

    # ------------------------------------------------------------------
    # EQ-5D-5L – EuroQol 5-Dimension 5-Level
    # 5 dimensions (level 1-5) + VAS (0-100)
    # Scoring: VAS is the primary outcome; dimensions form a profile
    # ------------------------------------------------------------------
    "EQ-5D-5L": {
        "id": "EQ-5D-5L",
        "scoringType": "profile-and-vas",
        "maxScore": 100,
        "direction": "positive",
    },

    # ------------------------------------------------------------------
    # FFS – Flinders Fatigue Scale
    # 7 items; items 1-4 & 6-7 are 0-4 Likert; item 5 is a multi-select
    # checklist (each tick = 1 point); total range 0-31
    # Item 5 indices (0-based): index 4 = checklist question
    # ------------------------------------------------------------------
    "FFS": {
        "id": "FFS",
        "scoringType": "ffs",
        "maxScore": 31,
        "checklistIndex": 4,
        "severityBands": _bands(
            (0,  12, "normal",     "Normal"),
            (13, 15, "borderline", "Borderline Fatigue"),
            (16, 20, "moderate",   "Moderate Fatigue"),
            (21, 31, "severe",     "Severe Fatigue"),
        ),
    },

    # ------------------------------------------------------------------
    # FIQR – Revised Fibromyalgia Impact Questionnaire
    # 21 items (0-10 each) across 3 domains:
    #   Function  (9 items,  indices 0-8):  raw / 3
    #   Overall   (2 items,  indices 9-10): raw / 1
    #   Symptoms  (10 items, indices 11-20): raw / 2
    # Total 0-100; higher = more severe
    # ------------------------------------------------------------------
    "FIQR": {
        "id": "FIQR",
        "scoringType": "fiqr-weighted",
        "maxScore": 100,
        "domains": {
            "function": {
                "name": "Function",
                "items": [0, 1, 2, 3, 4, 5, 6, 7, 8],
                "divisor": 3,
                "maxWeighted": 30,
            },
            "overall": {
                "name": "Overall Impact",
                "items": [9, 10],
                "divisor": 1,
                "maxWeighted": 20,
            },
            "symptoms": {
                "name": "Symptoms",
                "items": [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
                "divisor": 2,
                "maxWeighted": 50,
            },
        },
        "severityBands": _bands(
            (0,  39, "mild",     "Mild Impact"),
            (40, 59, "moderate", "Moderate Impact"),
            (60, 100, "severe",  "Severe Impact"),
        ),
    },

    # ------------------------------------------------------------------
    # FSS – Fatigue Severity Scale
    # 9 items (1-7 each); score = MEAN; mean ≥ 4 = significant fatigue
    # Total sum cut-off is 36 (≡ mean 4.0)
    # ------------------------------------------------------------------
    "FSS": {
        "id": "FSS",
        "scoringType": "mean",
        "maxScore": 7,
        "cutoff": 4.0,
        "severityBands": _bands(
            (1.0, 3.99, "normal",   "No Significant Fatigue"),
            (4.0, 4.99, "mild",     "Mild Fatigue"),
            (5.0, 5.99, "moderate", "Moderate Fatigue"),
            (6.0, 7.0,  "severe",   "Severe Fatigue"),
        ),
    },

    # ------------------------------------------------------------------
    # GAD-7 – Generalized Anxiety Disorder 7
    # 7 items (0-3), total 0-21; Q8 (PHQ item) not scored
    # ------------------------------------------------------------------
    "GAD-7": {
        "id": "GAD-7",
        "scoringType": "sum",
        "maxScore": 21,
        "scoredQuestions": [0, 1, 2, 3, 4, 5, 6],
        "severityBands": _bands(
            (0,  4,  "minimal",  "Minimal Anxiety"),
            (5,  9,  "mild",     "Mild Anxiety"),
            (10, 14, "moderate", "Moderate Anxiety"),
            (15, 21, "severe",   "Severe Anxiety"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 10,
             "message": "GAD-7 ≥10: consider referral for anxiety disorder",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # GDS – Global Deterioration Scale
    # Single clinician-rated item, stages 1-7
    # ------------------------------------------------------------------
    "GDS": {
        "id": "GDS",
        "scoringType": "single-selection",
        "maxScore": 7,
        "severityBands": _bands(
            (1, 1, "stage1", "No Subjective Complaints"),
            (2, 2, "stage2", "Very Mild Cognitive Decline"),
            (3, 3, "stage3", "Mild Cognitive Decline"),
            (4, 4, "stage4", "Moderate Cognitive Decline"),
            (5, 5, "stage5", "Moderately Severe Decline"),
            (6, 6, "stage6", "Severe Cognitive Decline"),
            (7, 7, "stage7", "Very Severe Cognitive Decline"),
        ),
    },

    # ------------------------------------------------------------------
    # GPCOG – General Practitioner Assessment of Cognition
    # Patient section: 9 items (binary), score ≥5 = probably normal
    # Informant section: 6 items; lower = more decline
    # ------------------------------------------------------------------
    "GPCOG": {
        "id": "GPCOG",
        "scoringType": "binary_cutoff",
        "maxScore": 9,
        "direction": "positive",
        "cutoff": 5,
        "severityBands": _bands(
            (5, 9, "normal",   "Probably Normal"),
            (3, 4, "possible", "Possible Impairment – needs informant"),
            (0, 2, "impaired", "Cognitive Impairment Likely"),
        ),
    },

    # ------------------------------------------------------------------
    # HDRS – Hamilton Depression Rating Scale (17-item)
    # Total 0-52; 0-7 normal; 20+ required for clinical trial entry
    # ------------------------------------------------------------------
    "HDRS": {
        "id": "HDRS",
        "scoringType": "sum",
        "maxScore": 52,
        "severityBands": _bands(
            (0,  7,  "normal",   "Normal / Remission"),
            (8,  13, "mild",     "Mild Depression"),
            (14, 18, "moderate", "Moderate Depression"),
            (19, 22, "severe",   "Severe Depression"),
            (23, 52, "very_severe", "Very Severe Depression"),
        ),
    },

    # ------------------------------------------------------------------
    # IADL – Lawton Instrumental Activities of Daily Living
    # 8 domains (0 or 1 each); max 8 (women) / 5 (men); higher = better
    # We use max 8 universally; gender adjustment in reporting layer
    # ------------------------------------------------------------------
    "IADL": {
        "id": "IADL",
        "scoringType": "sum",
        "maxScore": 8,
        "direction": "positive",
        "severityBands": _bands(
            (7,  8, "independent", "Independent"),
            (5,  6, "mild",        "Mild Impairment"),
            (3,  4, "moderate",    "Moderate Impairment"),
            (0,  2, "severe",      "Severe Impairment"),
        ),
    },

    # ------------------------------------------------------------------
    # IBS-SSS – IBS Symptom Severity Scale
    # 5 VAS items (0-100 each) + Q2 = days × 10; total 0-500
    # ------------------------------------------------------------------
    "IBS-SSS": {
        "id": "IBS-SSS",
        "scoringType": "ibs-sss",
        "maxScore": 500,
        "severityBands": _bands(
            (0,   75,  "remission", "Normal / Remission"),
            (75,  175, "mild",      "Mild IBS"),
            (175, 300, "moderate",  "Moderate IBS"),
            (300, 500, "severe",    "Severe IBS"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 175,
             "message": "IBS-SSS ≥175: active IBS confirmed",
             "priority": "moderate"},
        ],
    },

    # ------------------------------------------------------------------
    # ISI – Insomnia Severity Index
    # 7 items (0-4), total 0-28
    # ------------------------------------------------------------------
    "ISI": {
        "id": "ISI",
        "scoringType": "sum",
        "maxScore": 28,
        "severityBands": _bands(
            (0,  7,  "none",        "No Clinically Significant Insomnia"),
            (8,  14, "subthreshold","Subthreshold Insomnia"),
            (15, 21, "moderate",    "Clinical Insomnia (Moderate)"),
            (22, 28, "severe",      "Clinical Insomnia (Severe)"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 15,
             "message": "ISI ≥15: clinical insomnia – evaluate further",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # KPS – Karnofsky Performance Status Scale
    # Single clinician-rated item, 0-100 in steps of 10; higher = better
    # ------------------------------------------------------------------
    "KPS": {
        "id": "KPS",
        "scoringType": "single-selection",
        "maxScore": 100,
        "direction": "positive",
        "severityBands": _bands(
            (80, 100, "normal",   "Normal / Minor Symptoms"),
            (50,  70, "moderate", "Unable to Work; Some Self-Care"),
            (30,  40, "severe",   "Disabled; Special Care Needed"),
            (10,  20, "critical", "Very Sick; Hospital Care Needed"),
            (0,    0, "dead",     "Dead"),
        ),
    },

    # ------------------------------------------------------------------
    # LANSS – Leeds Assessment of Neuropathic Symptoms and Signs
    # 7 items, binary/weighted; total 0-24; score ≥12 = neuropathic pain
    # ------------------------------------------------------------------
    "LANSS": {
        "id": "LANSS",
        "scoringType": "weighted-sum",
        "maxScore": 24,
        "cutoff": 12,
        "severityBands": _bands(
            (0,  11, "unlikely",  "Neuropathic Mechanisms Unlikely"),
            (12, 24, "likely",    "Neuropathic Mechanisms Likely"),
        ),
    },

    # ------------------------------------------------------------------
    # MADRS – Montgomery-Asberg Depression Rating Scale
    # 10 clinician-rated items (0-6), total 0-60
    # ------------------------------------------------------------------
    "MADRS": {
        "id": "MADRS",
        "scoringType": "sum",
        "maxScore": 60,
        "severityBands": _bands(
            (0,  6,  "normal",          "Normal / No Symptoms"),
            (7,  19, "mild",            "Mild Depression"),
            (20, 30, "moderate",        "Moderate Depression"),
            (31, 39, "severe",          "Severe Depression"),
            (40, 60, "extremely_severe","Extremely Severe Depression"),
        ),
    },

    # ------------------------------------------------------------------
    # MAS – Modified Ashworth Scale
    # Clinician-rated per muscle group (0, 1, 1+→2, 2→3, 3→4, 4→5)
    # Stored as 0-5 numeric; average across tested groups
    # ------------------------------------------------------------------
    "MAS": {
        "id": "MAS",
        "scoringType": "mean",
        "maxScore": 5,
        "severityBands": _bands(
            (0, 0, "normal",   "No Increase in Tone"),
            (1, 1, "mild",     "Slight Increase"),
            (2, 2, "moderate", "More Marked Increase"),
            (3, 3, "severe",   "Considerable Increase"),
            (4, 5, "rigid",    "Rigid / Difficult to Move"),
        ),
    },

    # ------------------------------------------------------------------
    # MFIS – Modified Fatigue Impact Scale
    # 21 items (0-4), three subscales:
    #   Physical    (9 items):    items 4,6,7,10,13,14,17,20,21 → 0-idx: 3,5,6,9,12,13,16,19,20
    #   Cognitive   (10 items):   items 1,2,3,5,11,12,15,16,18,19 → 0-idx: 0,1,2,4,10,11,14,15,17,18
    #   Psychosocial (2 items):   items 8,9 → 0-idx: 7,8
    # Total 0-84
    # ------------------------------------------------------------------
    "MFIS": {
        "id": "MFIS",
        "scoringType": "subscale-sum",
        "maxScore": 84,
        "subscales": [
            {"id": "physical",     "name": "Physical",
             "questionIndices": [3, 5, 6, 9, 12, 13, 16, 19, 20], "maxScore": 36},
            {"id": "cognitive",    "name": "Cognitive",
             "questionIndices": [0, 1, 2, 4, 10, 11, 14, 15, 17, 18], "maxScore": 40},
            {"id": "psychosocial", "name": "Psychosocial",
             "questionIndices": [7, 8], "maxScore": 8},
        ],
        "severityBands": _bands(
            (0,  37, "normal",   "Not Fatigued"),
            (38, 84, "fatigued", "Significant Fatigue Impact"),
        ),
    },

    # ------------------------------------------------------------------
    # MIDAS – Migraine Disability Assessment
    # 5 items (number of days), total = sum; grades I-IV
    # Grade I: 0-5, II: 6-10, III: 11-20, IV: 21+
    # No strict upper bound (could be 270 in worst case: 90 days × 3 items)
    # ------------------------------------------------------------------
    "MIDAS": {
        "id": "MIDAS",
        "scoringType": "sum-numeric",
        "maxScore": 270,
        "scoredQuestions": [0, 1, 2, 3, 4],
        "severityBands": _bands(
            (0,  5,  "grade1", "Grade I – Little or No Disability"),
            (6,  10, "grade2", "Grade II – Mild Disability"),
            (11, 20, "grade3", "Grade III – Moderate Disability"),
            (21, 270, "grade4", "Grade IV – Severe Disability"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 11,
             "message": "MIDAS Grade III+: significant migraine disability",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # MRC – Medical Research Council Muscle Strength Scale
    # 6 bilateral muscle groups (0-5 each × 2 sides × 3 regions = 60)
    # Higher = stronger; total 0-60
    # ------------------------------------------------------------------
    "MRC": {
        "id": "MRC",
        "scoringType": "sum",
        "maxScore": 60,
        "direction": "positive",
        "severityBands": _bands(
            (48, 60, "normal",   "Normal Strength"),
            (36, 47, "mild",     "Mild Weakness"),
            (24, 35, "moderate", "Moderate Weakness"),
            (12, 23, "severe",   "Severe Weakness"),
            (0,  11, "critical", "Quadriplegic Range"),
        ),
    },

    # ------------------------------------------------------------------
    # MSQ – Migraine-Specific Quality of Life Questionnaire v2.1
    # 14 items across 3 subscales; each rescaled 0-100 (higher = better QoL)
    #   Role-Restrictive (7 items, 0-1):    (sum - 7) × 100 / 35
    #   Role-Preventive  (4 items, 0-2):    (sum - 4) × 100 / 20
    #   Emotional        (3 items, 0-3):    (sum - 3) × 100 / 15
    # Items are scored 1-6 Likert; formula: ((sum of N items) - N) × 100 / (N × max_per_item - N)
    # ------------------------------------------------------------------
    "MSQ": {
        "id": "MSQ",
        "scoringType": "msq-transformed",
        "maxScore": 300,
        "direction": "positive",
        "subscales": [
            {"id": "role_restrictive", "name": "Role-Restrictive",
             "questionIndices": [0, 1, 2, 3, 4, 5, 6],
             "nItems": 7, "maxPerItem": 6, "minPerItem": 1},
            {"id": "role_preventive",  "name": "Role-Preventive",
             "questionIndices": [7, 8, 9, 10],
             "nItems": 4, "maxPerItem": 6, "minPerItem": 1},
            {"id": "emotional",        "name": "Emotional Function",
             "questionIndices": [11, 12, 13],
             "nItems": 3, "maxPerItem": 6, "minPerItem": 1},
        ],
    },

    # ------------------------------------------------------------------
    # Pain-Rating-Scale – Numerical Rating Scale (NRS) 0-10
    # ------------------------------------------------------------------
    "Pain-Rating-Scale": {
        "id": "Pain-Rating-Scale",
        "scoringType": "nrs",
        "maxScore": 10,
        "severityBands": _bands(
            (0, 0,  "none",     "No Pain"),
            (1, 3,  "mild",     "Mild Pain"),
            (4, 6,  "moderate", "Moderate Pain"),
            (7, 10, "severe",   "Severe Pain"),
        ),
    },

    # ------------------------------------------------------------------
    # painDETECT – Neuropathic Pain Screening
    # 9 items: Q1-Q7 sensory (0-5 each), Q8 pain course (-1 to +1),
    # Q9 radiation (0 or 2); total range -1 to 38
    # ≤12 = neuropathic unlikely; 13-18 = possible; ≥19 = likely
    # ------------------------------------------------------------------
    "painDETECT": {
        "id": "painDETECT",
        "scoringType": "paindetect",
        "maxScore": 38,
        "cutoffUnlikely": 12,
        "cutoffLikely": 19,
        "severityBands": _bands(
            (-1, 12, "unlikely",  "Neuropathic Pain Unlikely"),
            (13, 18, "possible",  "Neuropathic Pain Possible"),
            (19, 38, "likely",    "Neuropathic Pain Likely"),
        ),
    },

    # ------------------------------------------------------------------
    # PANS-31 – Psychiatric Assessment Neurological Symptoms 31
    # 31 items; sum score
    # ------------------------------------------------------------------
    "PANS-31": {
        "id": "PANS-31",
        "scoringType": "sum",
        "maxScore": 155,
    },

    # ------------------------------------------------------------------
    # PFS-16 – Parkinson Fatigue Scale 16
    # 16 items (1-5 each); three scoring options; we use ORDINAL (sum 16-80)
    # ------------------------------------------------------------------
    "PFS-16": {
        "id": "PFS-16",
        "scoringType": "pfs-dual",
        "maxScore": 80,
        "subscales": [
            {"id": "subjective",  "name": "Subjective Fatigue",
             "questionIndices": [0, 1, 2, 3, 4, 5, 6]},
            {"id": "functional",  "name": "Functional Impact",
             "questionIndices": [7, 8, 9, 10, 11, 12, 13, 14, 15]},
        ],
        "severityBands": _bands(
            (16, 47, "low",    "Low Fatigue"),
            (48, 63, "moderate", "Moderate Fatigue"),
            (64, 80, "severe", "Severe Fatigue"),
        ),
    },

    # ------------------------------------------------------------------
    # PHQ-9 – Patient Health Questionnaire-9
    # 9 items (0-3), total 0-27; Q9 is suicide risk item
    # ------------------------------------------------------------------
    "PHQ-9": {
        "id": "PHQ-9",
        "scoringType": "sum",
        "maxScore": 27,
        "scoredQuestions": [0, 1, 2, 3, 4, 5, 6, 7, 8],
        "severityBands": _bands(
            (0,  4,  "minimal",  "Minimal Depression"),
            (5,  9,  "mild",     "Mild Depression"),
            (10, 14, "moderate", "Moderate Depression"),
            (15, 19, "moderately_severe", "Moderately Severe Depression"),
            (20, 27, "severe",   "Severe Depression"),
        ),
        "riskRules": [
            {"type": "item_threshold", "questionIndex": 8,
             "operator": ">=", "threshold": 1,
             "message": "PHQ-9 Q9 ≥1: suicidal ideation reported – immediate review required",
             "priority": "critical"},
        ],
    },

    # ------------------------------------------------------------------
    # PSQI – Pittsburgh Sleep Quality Index
    # 19 self-rated + 5 partner-rated items; scored into 7 components
    # Each component 0-3; total 0-21; score >5 = poor sleeper
    # ------------------------------------------------------------------
    "PSQI": {
        "id": "PSQI",
        "scoringType": "psqi",
        "maxScore": 21,
        "components": [
            {
                "id": 1, "name": "Subjective Sleep Quality",
                "type": "item",
                "questionIndex": 17,
            },
            {
                "id": 2, "name": "Sleep Latency",
                "type": "latency_sum",
                "latencyIndex": 1,
                "item5aIndex": 4,
                "scoringBands": [
                    {"min": 0, "max": 0, "score": 0},
                    {"min": 1, "max": 2, "score": 1},
                    {"min": 3, "max": 4, "score": 2},
                    {"min": 5, "max": 6, "score": 3},
                ],
            },
            {
                "id": 3, "name": "Sleep Duration",
                "type": "duration",
                "questionIndex": 3,
            },
            {
                "id": 4, "name": "Habitual Sleep Efficiency",
                "type": "sleep_efficiency",
                "bedtimeIndex": 0,
                "waketimeIndex": 2,
                "minutesAsleepIndex": 3,
            },
            {
                "id": 5, "name": "Sleep Disturbances",
                "type": "sum_categorize",
                "questionIndices": [5, 6, 7, 8, 9, 10, 11, 12, 13],
                "scoringBands": [
                    {"min": 0,  "max": 0,  "score": 0},
                    {"min": 1,  "max": 9,  "score": 1},
                    {"min": 10, "max": 18, "score": 2},
                    {"min": 19, "max": 27, "score": 3},
                ],
            },
            {
                "id": 6, "name": "Use of Sleep Medication",
                "type": "item",
                "questionIndex": 14,
            },
            {
                "id": 7, "name": "Daytime Dysfunction",
                "type": "sum_categorize",
                "questionIndices": [15, 16],
                "scoringBands": [
                    {"min": 0, "max": 0, "score": 0},
                    {"min": 1, "max": 2, "score": 1},
                    {"min": 3, "max": 4, "score": 2},
                    {"min": 5, "max": 6, "score": 3},
                ],
            },
        ],
        "severityBands": _bands(
            (0,  5,  "good",     "Good Sleep Quality"),
            (6,  10, "moderate", "Poor Sleep Quality"),
            (11, 15, "poor",     "Very Poor Sleep Quality"),
            (16, 21, "severe",   "Severely Disturbed Sleep"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">", "threshold": 5,
             "message": "PSQI >5: poor sleeper – clinical evaluation recommended",
             "priority": "moderate"},
        ],
    },

    # ------------------------------------------------------------------
    # RAADS-14 – Ritvo Autism Asperger Diagnostic Scale 14
    # 14 items; sum score
    # ------------------------------------------------------------------
    "RAADS-14": {
        "id": "RAADS-14",
        "scoringType": "sum",
        "maxScore": 42,
        "cutoff": 14,
        "severityBands": _bands(
            (0,  13, "unlikely", "ASD Unlikely"),
            (14, 42, "likely",   "ASD Possible – Further Evaluation Recommended"),
        ),
    },

    # ------------------------------------------------------------------
    # SARA – Scale for Assessment and Rating of Ataxia
    # 8 clinician-rated items (variable max each), total 0-40
    # Higher = more severe ataxia
    # ------------------------------------------------------------------
    "SARA": {
        "id": "SARA",
        "scoringType": "sum",
        "maxScore": 40,
        "severityBands": _bands(
            (0,  3,  "normal",   "Normal / No Ataxia"),
            (4,  10, "mild",     "Mild Ataxia"),
            (11, 20, "moderate", "Moderate Ataxia"),
            (21, 30, "severe",   "Severe Ataxia"),
            (31, 40, "very_severe", "Very Severe Ataxia"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">", "threshold": 5,
             "message": "SARA >5: clinically significant ataxia",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # SLEEP-50 – SLEEP-50 Questionnaire
    # 50 items (1-4), 9 subscales + total; higher = worse sleep
    # Subscale indices (0-based):
    #   Sleep Apnea (8 items):         0-7
    #   Insomnia (9 items):            8-16
    #   Narcolepsy (5 items):          17-21
    #   RLS/PLMD (3 items):            22-24
    #   Circadian Rhythm (4 items):    25-28
    #   Sleepwalking (4 items):        29-32
    #   Nightmares (5 items):          33-37
    #   Sleep Hygiene (7 items):       38-44
    #   Daytime Functioning (5 items): 45-49
    # ------------------------------------------------------------------
    "SLEEP-50": {
        "id": "SLEEP-50",
        "scoringType": "subscale-sum",
        "maxScore": 200,
        "subscales": [
            {"id": "sleep_apnea",      "name": "Sleep Apnea",
             "questionIndices": [0, 1, 2, 3, 4, 5, 6, 7]},
            {"id": "insomnia",         "name": "Insomnia",
             "questionIndices": [8, 9, 10, 11, 12, 13, 14, 15, 16]},
            {"id": "narcolepsy",       "name": "Narcolepsy",
             "questionIndices": [17, 18, 19, 20, 21]},
            {"id": "rls_plmd",         "name": "Restless Legs / PLMD",
             "questionIndices": [22, 23, 24]},
            {"id": "circadian",        "name": "Circadian Rhythm",
             "questionIndices": [25, 26, 27, 28]},
            {"id": "sleepwalking",     "name": "Sleepwalking",
             "questionIndices": [29, 30, 31, 32]},
            {"id": "nightmares",       "name": "Nightmares",
             "questionIndices": [33, 34, 35, 36, 37]},
            {"id": "sleep_hygiene",    "name": "Sleep Hygiene",
             "questionIndices": [38, 39, 40, 41, 42, 43, 44]},
            {"id": "daytime_function", "name": "Daytime Functioning",
             "questionIndices": [45, 46, 47, 48, 49]},
        ],
    },

    # ------------------------------------------------------------------
    # SNAP-IV – Swanson, Nolan, Pelham Rating Scale IV (26-item)
    # 26 items (0-3 each); 3 subscales
    #   Inattention (9 items):         Q1-9  → 0-idx: 0-8
    #   Hyperactivity/Impulsivity (9): Q10-18 → 0-idx: 9-17
    #   Opposition/Defiance (8):       Q19-26 → 0-idx: 18-25
    # ------------------------------------------------------------------
    "SNAP-IV": {
        "id": "SNAP-IV",
        "scoringType": "subscale-sum",
        "maxScore": 78,
        "subscales": [
            {
                "id": "inattention", "name": "Inattention",
                "questionIndices": [0, 1, 2, 3, 4, 5, 6, 7, 8],
                "maxScore": 27,
                "severityBands": _bands(
                    (0,  12, "normal",   "Not Clinically Significant"),
                    (13, 17, "mild",     "Mild"),
                    (18, 22, "moderate", "Moderate"),
                    (23, 27, "severe",   "Severe"),
                ),
            },
            {
                "id": "hyperactivity", "name": "Hyperactivity/Impulsivity",
                "questionIndices": [9, 10, 11, 12, 13, 14, 15, 16, 17],
                "maxScore": 27,
                "severityBands": _bands(
                    (0,  12, "normal",   "Not Clinically Significant"),
                    (13, 17, "mild",     "Mild"),
                    (18, 22, "moderate", "Moderate"),
                    (23, 27, "severe",   "Severe"),
                ),
            },
            {
                "id": "opposition", "name": "Opposition/Defiance",
                "questionIndices": [18, 19, 20, 21, 22, 23, 24, 25],
                "maxScore": 24,
                "severityBands": _bands(
                    (0,  7,  "normal",   "Not Clinically Significant"),
                    (8,  13, "mild",     "Mild"),
                    (14, 18, "moderate", "Moderate"),
                    (19, 24, "severe",   "Severe"),
                ),
            },
        ],
    },

    # ------------------------------------------------------------------
    # SS-QOL – Stroke-Specific Quality of Life Scale
    # 49 items (1-5), 12 domain averages → summary average × 49 → 49-245
    # Higher = better; each domain is unweighted average
    # ------------------------------------------------------------------
    "SS-QOL": {
        "id": "SS-QOL",
        "scoringType": "ssqol",
        "maxScore": 245,
        "direction": "positive",
        "domains": [
            {"id": "mobility",       "name": "Mobility",               "questionIndices": [0, 1, 2, 3, 4, 5]},
            {"id": "energy",         "name": "Energy",                  "questionIndices": [6, 7, 8]},
            {"id": "upper_extremity","name": "Upper Extremity Function","questionIndices": [9, 10, 11, 12, 13]},
            {"id": "work",           "name": "Work & Productivity",     "questionIndices": [14, 15, 16]},
            {"id": "mood",           "name": "Mood",                    "questionIndices": [17, 18, 19, 20, 21]},
            {"id": "self_care",      "name": "Self-Care",               "questionIndices": [22, 23, 24, 25, 26]},
            {"id": "social_roles",   "name": "Social Roles",            "questionIndices": [27, 28, 29, 30, 31]},
            {"id": "family_roles",   "name": "Family Roles",            "questionIndices": [32, 33, 34]},
            {"id": "vision",         "name": "Vision",                  "questionIndices": [35, 36, 37]},
            {"id": "language",       "name": "Language",                "questionIndices": [38, 39, 40, 41, 42]},
            {"id": "thinking",       "name": "Thinking",                "questionIndices": [43, 44, 45]},
            {"id": "personality",    "name": "Personality",             "questionIndices": [46, 47, 48]},
        ],
        "severityBands": _bands(
            (196, 245, "normal",   "Minimal Disability"),
            (147, 195, "mild",     "Mild Disability"),
            (98,  146, "moderate", "Moderate Disability"),
            (49,   97, "severe",   "Severe Disability"),
        ),
    },

    # ------------------------------------------------------------------
    # THI – Tinnitus Handicap Inventory
    # 25 items (Yes=4, Sometimes=2, No=0); total 0-100
    # ------------------------------------------------------------------
    "THI": {
        "id": "THI",
        "scoringType": "sum",
        "maxScore": 100,
        "severityBands": _bands(
            (0,  16, "slight",       "Slight Handicap (Grade 1)"),
            (18, 36, "mild",         "Mild Handicap (Grade 2)"),
            (38, 56, "moderate",     "Moderate Handicap (Grade 3)"),
            (58, 76, "severe",       "Severe Handicap (Grade 4)"),
            (78, 100, "catastrophic","Catastrophic Handicap (Grade 5)"),
        ),
    },

    # ------------------------------------------------------------------
    # VAS-Pain – Visual Analogue Scale for Pain
    # 1 item, 0-100 mm line; higher = more pain
    # ------------------------------------------------------------------
    "VAS-Pain": {
        "id": "VAS-Pain",
        "scoringType": "nrs",
        "maxScore": 100,
        "severityBands": _bands(
            (0,   4,  "none",     "No Pain"),
            (5,  44,  "mild",     "Mild Pain"),
            (45, 74,  "moderate", "Moderate Pain"),
            (75, 100, "severe",   "Severe Pain"),
        ),
    },

    # ------------------------------------------------------------------
    # VVAS-Ataxia – Visual Vertigo Analogue Scale
    # 9 items (0-10 each); total = mean × 10 → range 0-100
    # ------------------------------------------------------------------
    "VVAS-Ataxia": {
        "id": "VVAS-Ataxia",
        "scoringType": "vvas",
        "maxScore": 100,
        "severityBands": _bands(
            (0,    0,   "none",     "No Visual Vertigo"),
            (0.1, 40,   "mild",     "Mild Visual Vertigo"),
            (40.01, 70, "moderate", "Moderate Visual Vertigo"),
            (70.01, 100, "severe",  "Severe Visual Vertigo"),
        ),
    },

    # ------------------------------------------------------------------
    # MoCA – Montreal Cognitive Assessment
    # 30 items across 8 cognitive domains, total 0-30; higher = better
    # +1 point added for ≤12 years education (applied at reporting layer)
    # Domains: Visuospatial/Executive (5), Naming (3), Memory (0/recall),
    #          Attention (6), Language (3), Abstraction (2), Delayed Recall (5),
    #          Orientation (6)
    # Score ≥26 = Normal; <26 = possible cognitive impairment
    # ------------------------------------------------------------------
    "MoCA": {
        "id": "MoCA",
        "scoringType": "subscale-sum",
        "maxScore": 30,
        "direction": "positive",
        "subscales": [
            {"id": "visuospatial",  "name": "Visuospatial / Executive",
             "questionIndices": [0, 1, 2, 3, 4],          "maxScore": 5},
            {"id": "naming",        "name": "Naming",
             "questionIndices": [5, 6, 7],                 "maxScore": 3},
            {"id": "attention",     "name": "Attention",
             "questionIndices": [8, 9, 10, 11, 12, 13],   "maxScore": 6},
            {"id": "language",      "name": "Language",
             "questionIndices": [14, 15, 16],              "maxScore": 3},
            {"id": "abstraction",   "name": "Abstraction",
             "questionIndices": [17, 18],                  "maxScore": 2},
            {"id": "delayed_recall","name": "Delayed Recall",
             "questionIndices": [19, 20, 21, 22, 23],     "maxScore": 5},
            {"id": "orientation",   "name": "Orientation",
             "questionIndices": [24, 25, 26, 27, 28, 29], "maxScore": 6},
        ],
        "severityBands": _bands(
            (26, 30, "normal",   "Normal Cognition"),
            (18, 25, "mild",     "Mild Cognitive Impairment"),
            (10, 17, "moderate", "Moderate Cognitive Impairment"),
            (0,   9, "severe",   "Severe Cognitive Impairment"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": "<", "threshold": 26,
             "message": "MoCA <26: possible cognitive impairment – further evaluation recommended",
             "priority": "high"},
        ],
    },

    # ------------------------------------------------------------------
    # PDSS – Parkinson's Disease Sleep Scale (PDSS-2)
    # 15 items (0-4 each): 0=Never, 1=Occasionally, 2=Half the time,
    #                      3=Most of the time, 4=Very frequent
    # Total 0-60; higher = worse nocturnal disturbance
    # Source: Scoring caluculation for each scale in detail.docx
    # ------------------------------------------------------------------
    "PDSS": {
        "id": "PDSS",
        "scoringType": "sum",
        "maxScore": 60,
        "severityBands": _bands(
            (0,  15, "normal",   "Good Sleep Quality"),
            (16, 30, "mild",     "Mild Sleep Disturbance"),
            (31, 45, "moderate", "Moderate Sleep Disturbance"),
            (46, 60, "severe",   "Severe Sleep Disturbance"),
        ),
        "riskRules": [
            {"type": "total_threshold", "operator": ">=", "threshold": 16,
             "message": "PDSS >=16: nocturnal disturbance present – sleep management review recommended",
             "priority": "moderate"},
        ],
    },
}


def get_scale_config(scale_code: str) -> Dict[str, Any]:
    """Return config for scale_code, or an empty fallback."""
    return SCALE_CONFIGS.get(scale_code, {"id": scale_code, "scoringType": "sum", "maxScore": 0})
