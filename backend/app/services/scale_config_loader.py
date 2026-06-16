"""
ScaleConfigLoader — merges the static scale_configs.py definitions with
live question/option data fetched from the database.

Usage (inside a FastAPI route):
    from app.services.scale_config_loader import scale_config_loader
    config = scale_config_loader.build(scale_code, db_questions)

db_questions is the list returned by _fetch_questions_for_scoring() in assessment.py:
    [{"question_index": int, "options": [{"value": str, "points": float}], ...}]
"""

import copy
from typing import Any, Dict, List

from app.services.scale_configs import get_scale_config


class ScaleConfigLoader:
    """
    Merges a static scale config (from scale_configs.py, derived from the
    scoring PDFs / Word docs) with live DB question data (option points).

    The result is a single dict that the ScaleEngine can consume directly.
    """

    def build(self, scale_code: str, db_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Build a complete scale_config dict ready for ScaleEngine.

        Parameters
        ----------
        scale_code   : e.g. "PHQ-9", "PSQI", "COMPASS-31"
        db_questions : list of question dicts from _fetch_questions_for_scoring()
                       Each dict must have at minimum:
                         - question_index (int)
                         - options: [{value, points}]
        """
        base = copy.deepcopy(get_scale_config(scale_code))

        # Build the questions list expected by ScaleEngine.
        # ScaleEngine accesses: question["options"], question["scoredInTotal"],
        # question["includeInScore"], question["supplementary"].
        questions = []
        for q in sorted(db_questions, key=lambda x: x.get("question_index", 0)):
            questions.append({
                "index":        q["question_index"],
                "type":         q.get("answer_type", "likert"),
                "options":      q.get("options", []),
                "scoredInTotal": q.get("scored_in_total", True),
                "includeInScore": q.get("include_in_score", True),
                "supplementary": q.get("supplementary", False),
            })

        base["questions"] = questions

        # Preserve any extra DB-level scale metadata (e.g. scale_name)
        base.setdefault("id", scale_code)

        return base

    def build_minimal(self, scale_code: str) -> Dict[str, Any]:
        """
        Return the static config only (no DB questions).
        Useful for disease_engine when only severity/max values are needed.
        """
        return copy.deepcopy(get_scale_config(scale_code))


scale_config_loader = ScaleConfigLoader()
