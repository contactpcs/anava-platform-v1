from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.utils.exceptions import NotFoundError
from app.limiter import limiter

router = APIRouter()

_CHOICE_TYPES = {"radio", "likert", "checkbox"}
_NUMERIC_TYPES = {"number", "slider"}


def _parse_numeric_constraints(options: list, question: dict) -> dict:
    """
    For number/slider questions, options hold metadata rows like:
      label="Minimum: 0", option_value="0"
      label="Maximum: 30", option_value="1", points=30
    Extract min/max from those labels, or fall back to question.min_value/max_value.
    """
    min_val = question.get("min_value")
    max_val = question.get("max_value")

    for o in options:
        label = (o.get("option_label") or "").lower()
        if label.startswith("minimum"):
            try:
                min_val = float(o["option_value"])
            except (TypeError, ValueError):
                pass
        elif label.startswith("maximum"):
            try:
                max_val = float(o.get("points") if o.get("points") is not None else o["option_value"])
            except (TypeError, ValueError):
                pass

    return {
        "min": min_val if min_val is not None else 0,
        "max": max_val if max_val is not None else 100,
    }


@router.get("/{question_id:path}/options")
@limiter.limit("120/minute")
async def get_question_options(
    request: Request,
    question_id: str,
    current_user: dict = Depends(get_current_user),
):
    """
    Return all options for a question, shaped by its answer_type.

    • radio / likert / checkbox  → discrete list of { option_id, value, label, points, display_order }
    • number / slider            → numeric constraints { min, max } + raw options list
    • text                       → empty options list (free-text input)
    """
    admin = get_supabase_admin()

    q_result = await admin.table("prs_questions").select(
        "question_id, answer_type, min_value, max_value, skip_logic, is_required"
    ).eq("question_id", question_id).limit(1).execute()

    if not q_result.data:
        raise NotFoundError(f"Question '{question_id}' not found")

    question = q_result.data[0]
    answer_type = question.get("answer_type", "radio")

    opts_result = await admin.table("prs_options").select(
        "option_id, option_label, option_value, points, display_order"
    ).eq("question_id", question_id).eq("status", True).order("display_order").execute()

    raw_options = opts_result.data or []

    if answer_type in _CHOICE_TYPES:
        options_payload = [
            {
                "option_id":     o["option_id"],
                "value":         o["option_value"],
                "label":         o["option_label"],
                "points":        o.get("points", 0),
                "display_order": o.get("display_order", 0),
            }
            for o in raw_options
        ]
        return success_response({
            "question_id": question_id,
            "answer_type": answer_type,
            "is_required": question.get("is_required", True),
            "options":     options_payload,
        })

    elif answer_type in _NUMERIC_TYPES:
        constraints = _parse_numeric_constraints(raw_options, question)
        options_payload = [
            {
                "option_id":     o["option_id"],
                "value":         o["option_value"],
                "label":         o["option_label"],
                "points":        o.get("points", 0),
                "display_order": o.get("display_order", 0),
            }
            for o in raw_options
        ]
        return success_response({
            "question_id": question_id,
            "answer_type": answer_type,
            "is_required": question.get("is_required", True),
            "min":         constraints["min"],
            "max":         constraints["max"],
            "options":     options_payload,
        })

    else:
        return success_response({
            "question_id": question_id,
            "answer_type": answer_type,
            "is_required": question.get("is_required", True),
            "options":     [],
        })
