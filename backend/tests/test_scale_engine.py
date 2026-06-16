import pytest
from app.services.scale_engine import ScaleEngine, ScoreResult

engine = ScaleEngine()


def make_scale(scoring_type="sum", questions=None, **kwargs):
    q = questions or [
        {"type": "likert", "scoredInTotal": True, "options": [
            {"value": 0, "points": 0}, {"value": 1, "points": 1},
            {"value": 2, "points": 2}, {"value": 3, "points": 3}
        ]}
        for _ in range(5)
    ]
    return {"scoringType": scoring_type, "questions": q, "maxScore": 15, **kwargs}


def test_sum_basic():
    scale = make_scale()
    responses = {0: 1, 1: 2, 2: 3, 3: 0, 4: 1}
    result = engine.calculate_score(scale, responses)
    assert result.total == 7.0


def test_sum_skip_unscored():
    questions = [
        {"type": "likert", "scoredInTotal": False, "options": [{"value": 3, "points": 3}]},
        {"type": "likert", "scoredInTotal": True, "options": [{"value": 2, "points": 2}]},
    ]
    scale = make_scale(questions=questions)
    responses = {0: 3, 1: 2}
    result = engine.calculate_score(scale, responses)
    assert result.total == 2.0


def test_severity_bands():
    scale = {
        "severityBands": [
            {"min": 0, "max": 4, "level": "minimal", "label": "Minimal"},
            {"min": 5, "max": 9, "level": "mild", "label": "Mild"},
            {"min": 10, "max": 21, "level": "moderate", "label": "Moderate"},
        ]
    }
    sev = engine.get_severity(scale, 7)
    assert sev is not None
    assert sev.level == "mild"


def test_subscale_sum():
    scale = {
        "scoringType": "subscale-sum",
        "maxScore": 42,
        "subscales": [
            {"id": "anxiety", "name": "Anxiety", "questionIndices": [0, 1, 2], "multiplier": 2},
            {"id": "depression", "name": "Depression", "questionIndices": [3, 4, 5], "multiplier": 2},
        ],
        "questions": [{"type": "likert", "options": [{"value": i, "points": i} for i in range(4)]} for _ in range(6)],
    }
    responses = {0: 1, 1: 2, 2: 0, 3: 3, 4: 1, 5: 2}
    result = engine.calculate_score(scale, responses)
    assert result.subscale_scores["anxiety"]["score"] == 6.0
    assert result.subscale_scores["depression"]["score"] == 12.0
    assert result.total == 18.0


def test_binary_cutoff():
    scale = make_scale(scoring_type="binary_cutoff", cutoff=5)
    responses = {0: 1, 1: 2, 2: 1, 3: 0, 4: 2}
    result = engine.calculate_score(scale, responses)
    assert result.extra["is_positive"] is True
    assert result.extra["cutoff"] == 5


def test_to_float():
    assert engine._to_float("3") == 3.0
    assert engine._to_float(None) is None
    assert engine._to_float("abc") is None
