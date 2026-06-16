from app.database import get_supabase_admin


async def allocate_doctor_to_patient(patient_id: str, city: str) -> str | None:
    """Find an available doctor in the patient's city and assign them."""
    admin = get_supabase_admin()
    doctors = (await admin.table("doctors").select(
        "id, current_patient_count, max_patients, availability"
    ).eq("availability", "available").execute()).data

    if not doctors:
        return None

    available = [d for d in doctors if d["current_patient_count"] < d["max_patients"]]
    if not available:
        return None

    doctor = min(available, key=lambda d: d["current_patient_count"])
    doctor_id = doctor["id"]

    await admin.table("patients").update({"assigned_doctor_id": doctor_id}).eq("id", patient_id).execute()
    await admin.table("doctors").update({
        "current_patient_count": doctor["current_patient_count"] + 1
    }).eq("id", doctor_id).execute()

    return doctor_id
