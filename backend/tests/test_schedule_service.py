from datetime import date, time

from app.services.schedule_service import build_day_slots, _dow

# A Wednesday
WED = date(2026, 6, 17)


def _weekly(start="09:00:00", end="12:00:00", dur=30, b_start=None, b_end=None,
            is_active=True, ef=None, eu=None):
    return {
        "day_of_week": _dow(WED),
        "start_time": start, "end_time": end,
        "slot_duration_minutes": dur,
        "break_start": b_start, "break_end": b_end,
        "is_active": is_active,
        "effective_from": ef, "effective_until": eu,
    }


def starts(slots):
    return [s["start_time"] for s in slots]


def test_basic_window_generates_contiguous_slots():
    slots = build_day_slots(WED, [_weekly()], None, set())
    assert starts(slots) == ["09:00:00", "09:30:00", "10:00:00", "10:30:00", "11:00:00", "11:30:00"]
    assert all(s["is_available"] for s in slots)
    assert slots[-1]["end_time"] == "12:00:00"


def test_break_window_excluded():
    slots = build_day_slots(WED, [_weekly(b_start="10:00:00", b_end="10:30:00")], None, set())
    # the 10:00 slot overlaps the break and is removed; adjacent slots remain
    assert "10:00:00" not in starts(slots)
    assert "09:30:00" in starts(slots)   # ends exactly at break start -> kept
    assert "10:30:00" in starts(slots)   # starts exactly at break end -> kept
    assert len(slots) == 5


def test_booked_slot_dropped_when_not_including_unavailable():
    slots = build_day_slots(WED, [_weekly()], None, {"09:00:00"})
    assert "09:00:00" not in starts(slots)
    assert len(slots) == 5


def test_booked_slot_marked_when_including_unavailable():
    slots = build_day_slots(WED, [_weekly()], None, {"09:00:00"}, include_unavailable=True)
    by_start = {s["start_time"]: s for s in slots}
    assert by_start["09:00:00"]["is_available"] is False
    assert by_start["09:30:00"]["is_available"] is True
    assert len(slots) == 6


def test_full_day_off_override_returns_no_slots():
    slots = build_day_slots(WED, [_weekly()], {"is_available": False}, set())
    assert slots == []


def test_modified_hours_override_replaces_weekly():
    override = {"is_available": True, "start_time": "14:00:00", "end_time": "15:00:00"}
    slots = build_day_slots(WED, [_weekly()], override, set())
    assert starts(slots) == ["14:00:00", "14:30:00"]


def test_effective_from_in_future_skips_window():
    slots = build_day_slots(WED, [_weekly(ef="2026-12-01")], None, set())
    assert slots == []


def test_inactive_weekly_row_skipped():
    slots = build_day_slots(WED, [_weekly(is_active=False)], None, set())
    assert slots == []
