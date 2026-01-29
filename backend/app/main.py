from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone
import shutil
import os
import uuid

from .db import supabase
from .auth import validate_telegram_data
from .models import MasterUpdate, ServiceModel, WorkingHoursModel, AppointmentCreate
from .utils import notify_master

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- PUBLIC ROUTES ---

@app.get("/masters/{master_id}")
def get_master_profile(master_id: int):
    res = supabase.table("masters").select("*").eq("telegram_id", master_id).execute()
    if not res.data:
        raise HTTPException(404, "Master not found")
    return res.data[0]


@app.get("/masters/{master_id}/services")
def get_master_services(master_id: int):
    res = supabase.table("services").select("*").eq("master_telegram_id", master_id).eq("is_active", True).execute()
    return res.data


@app.get("/masters/{master_id}/availability")
def get_availability(master_id: int, date: str):
    # 1. Get Working Hours for that day (dow)
    target_date = datetime.strptime(date, "%Y-%m-%d").date()
    dow = target_date.isoweekday()  # 1=Mon

    wh_res = supabase.table("working_hours").select("*") \
        .eq("master_telegram_id", master_id).eq("day_of_week", dow).execute()

    if not wh_res.data:
        # Fallback: 10:00-20:00
        start_t = datetime.strptime("10:00", "%H:%M").time()
        end_t = datetime.strptime("20:00", "%H:%M").time()
        slot_min = 30
    else:
        wh = wh_res.data[0]
        start_t = datetime.strptime(wh['start_time'], "%H:%M:%S").time()
        end_t = datetime.strptime(wh['end_time'], "%H:%M:%S").time()
        slot_min = wh['slot_minutes']

    # 2. Generate all slots
    slots = []
    current = datetime.combine(target_date, start_t)
    end_dt = datetime.combine(target_date, end_t)

    while current < end_dt:
        slots.append(current.isoformat())
        current += timedelta(minutes=slot_min)

    # 3. Get existing appointments
    start_range = datetime.combine(target_date, time(0, 0)).isoformat()
    end_range = datetime.combine(target_date, time(23, 59)).isoformat()

    apps_res = supabase.table("appointments").select("starts_at") \
        .eq("master_telegram_id", master_id) \
        .in_("status", ["pending", "confirmed"]) \
        .gte("starts_at", start_range).lte("starts_at", end_range).execute()

    taken_times = {a['starts_at'] for a in apps_res.data}

    # 4. Filter
    # Приводим к единому формату ISO (Postgres может возвращать с Z или +05)
    # Упрощенная логика: сравниваем строки начала (для продакшна лучше timestamp compare)
    available = [s for s in slots if
                 f"{s}+00:00" not in taken_times and f"{s}+05:00" not in taken_times and s not in taken_times]  # Hacky timezone check fix for demo

    return available


# --- AUTH / ME ---

@app.get("/me")
def get_me(user=Depends(validate_telegram_data)):
    uid = user['id']
    # Check if master
    m_res = supabase.table("masters").select("*").eq("telegram_id", uid).execute()
    role = "client"
    profile = None
    if m_res.data:
        role = "master"
        profile = m_res.data[0]
    return {"role": role, "user": user, "profile": profile}


# --- MASTER ROUTES ---

@app.patch("/me/profile")
def update_profile(update: MasterUpdate, user=Depends(validate_telegram_data)):
    # Upsert logic: if not exists, create
    data = update.model_dump(exclude_unset=True)
    data['telegram_id'] = user['id']

    # Check exist
    exist = supabase.table("masters").select("id").eq("telegram_id", user['id']).execute()
    if not exist.data:
        supabase.table("masters").insert(data).execute()
    else:
        supabase.table("masters").update(data).eq("telegram_id", user['id']).execute()
    return {"status": "ok"}


@app.get("/me/services")
def get_my_services(user=Depends(validate_telegram_data)):
    return supabase.table("services").select("*").eq("master_telegram_id", user['id']).order("id").execute().data


@app.post("/me/services")
def create_service(srv: ServiceModel, user=Depends(validate_telegram_data)):
    data = srv.model_dump()
    data['master_telegram_id'] = user['id']
    return supabase.table("services").insert(data).execute().data


@app.delete("/me/services/{sid}")
def delete_service(sid: int, user=Depends(validate_telegram_data)):
    # Soft delete
    return supabase.table("services").update({"is_active": False}) \
        .eq("id", sid).eq("master_telegram_id", user['id']).execute().data


@app.get("/me/appointments")
def get_my_appointments(user=Depends(validate_telegram_data)):
    # Simple list for now
    return supabase.table("appointments").select("*, services(name)") \
        .eq("master_telegram_id", user['id']).order("starts_at", desc=True).limit(50).execute().data


@app.post("/me/appointments/{aid}/confirm")
async def confirm_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "confirmed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data


# --- BOOKING ---

@app.post("/appointments")
async def create_appointment(app_data: AppointmentCreate, user=Depends(validate_telegram_data)):
    # 1. Validate service
    srv = supabase.table("services").select("*").eq("id", app_data.service_id).single().execute()
    if not srv.data or srv.data['master_telegram_id'] != app_data.master_tg_id:
        raise HTTPException(400, "Invalid service")

    # 2. Insert (Database constraint handles idempotency & slot uniqueness)
    try:
        data = app_data.model_dump()
        data['client_telegram_id'] = user['id']
        res = supabase.table("appointments").insert(data).execute()

        # Notify Master
        await notify_master(app_data.master_tg_id,
                            f"🗓 Новая запись!\nКлиент: {app_data.client_phone}\nПитомец: {app_data.pet_name}\nВремя: {app_data.starts_at}")

        return res.data[0]
    except Exception as e:
        if "duplicate key" in str(e) or "idx_unique_slot" in str(e):
            raise HTTPException(409, "Slot already taken or duplicate request")
        raise HTTPException(500, str(e))


# --- UPLOADS (Local Mock) ---
@app.post("/uploads/avatar")
def upload_avatar(file: UploadFile = File(...)):
    # Save locally to volume
    os.makedirs("static/avatars", exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    path = f"static/avatars/{filename}"
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    # В реальности тут должен быть Supabase Storage upload
    # Возвращаем URL (предполагая, что static раздается nginx/fastapi)
    return {"avatar_url": f"/static/avatars/{filename}"}


# Serve static files (dev only)
from fastapi.staticfiles import StaticFiles

if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")