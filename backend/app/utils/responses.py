from typing import Any, Optional


def success_response(
    data: Any = None,
    message: str = "Success",
    status_code: int = 200,
    meta: Optional[dict] = None,
) -> dict:
    response = {"success": True, "message": message, "data": data}
    if meta:
        response["meta"] = meta
    return response


def paginated_response(
    items: list,
    total: int,
    skip: int,
    limit: int,
    message: str = "Success",
) -> dict:
    return {
        "success": True,
        "message": message,
        "data": items,
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": (skip + limit) < total,
        },
    }
