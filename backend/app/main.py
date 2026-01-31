from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
import uuid
from datetime import datetime, timedelta

# Импортируем наши модули
from .auth import validate_telegram_data
from .db import supabase

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- PYDANTIC MODELS ---

class UserProfileUpdate(BaseModel):
    salon_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    duration_min: int = 60


class WorkingHourItem(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    slot_minutes: int = 30


class AppointmentCreate(BaseModel):
    service_id: int
    master_tg_id: int
    starts_at: str
    client_name: str  # <--- ДОБАВЛЕНО
    client_phone: str
    pet_name: str
    pet_breed: Optional[str] = None
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None


# --- ROUTES ---

@app.get("/health")
async def health_check():
    return {"status": "ok"}


# 1. АДМИНСКАЯ ЧАСТЬ
@app.get("/me")
async def get_my_profile(user=Depends(validate_telegram_data)):
    tg_id = user['id']
    res = supabase.table("masters").select("*").eq("telegram_id", tg_id).execute()
    if not res.data:
        new_user = {
            "telegram_id": tg_id,
            "username": user.get("username"),
            "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        }
        res = supabase.table("masters").insert(new_user).execute()
        return {"user": user, "profile": res.data[0]}
    return {"user": user, "profile": res.data[0]}


@app.patch("/me/profile")
async def update_profile(data: UserProfileUpdate, user=Depends(validate_telegram_data)):
    tg_id = user['id']
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    res = supabase.table("masters").update(update_data).eq("telegram_id", tg_id).execute()
    return res.data


@app.post("/uploads/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(validate_telegram_data)):
    file_content = await file.read()
    file_path = f"{user['id']}/avatar.png"
    try:
        supabase.storage.from_("avatars").upload(
            file_path, file_content, file_options={"content-type": file.content_type, "upsert": "true"}
        )
        public_url = supabase.storage.from_("avatars").get_public_url(file_path)
        return {"avatar_url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/me/services")
async def get_services(user=Depends(validate_telegram_data)):
    res = supabase.table("services").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@app.post("/me/services")
async def create_service(srv: ServiceCreate, user=Depends(validate_telegram_data)):
    data = srv.model_dump()
    data['master_telegram_id'] = user['id']
    res = supabase.table("services").insert(data).execute()
    return res.data


@app.delete("/me/services/{sid}")
async def delete_service(sid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("services").delete().eq("id", sid).eq("master_telegram_id", user['id']).execute()
    return {"status": "deleted"}


@app.get("/me/working-hours")
async def get_hours(user=Depends(validate_telegram_data)):
    res = supabase.table("working_hours").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@app.post("/me/working-hours")
async def set_hours(hours: List[WorkingHourItem], user=Depends(validate_telegram_data)):
    supabase.table("working_hours").delete().eq("master_telegram_id", user['id']).execute()
    data_list = []
    for h in hours:
        item = h.model_dump()
        item['master_telegram_id'] = user['id']
        data_list.append(item)
    if data_list:
        supabase.table("working_hours").insert(data_list).execute()
    return {"status": "updated"}


@app.get("/me/appointments")
async def get_my_appointments(user=Depends(validate_telegram_data)):
    res = supabase.table("appointments") \
        .select("*, services(name)") \
        .eq("master_telegram_id", user['id']) \
        .order("starts_at", desc=False) \
        .execute()
    return res.data


@app.post("/me/appointments/{aid}/confirm")
async def confirm_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "confirmed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data


@app.post("/me/appointments/{aid}/cancel")
async def cancel_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "cancelled"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data


# 2. ПУБЛИЧНАЯ ЧАСТЬ (CLIENT)

@app.get("/masters/{master_id}")
async def get_master_public_profile(master_id: int):
    res = supabase.table("masters") \
        .select("salon_name, description, avatar_url, address, phone") \
        .eq("telegram_id", master_id) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Master not found")
    return res.data[0]


@app.get("/masters/{master_id}/services")
async def get_master_services(master_id: int):
    res = supabase.table("services").select("*").eq("master_telegram_id", master_id).execute()
    return res.data


@app.get("/masters/{master_id}/availability")
async def get_master_availability(master_id: int, date: str):
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    weekday_iso = date_obj.isoweekday()

    wh_res = supabase.table("working_hours") \
        .select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("day_of_week", weekday_iso) \
        .execute()

    if not wh_res.data:
        return []

    schedule = wh_res.data[0]
    start_str = schedule['start_time']
    end_str = schedule['end_time']
    slot_min = schedule.get('slot_minutes', 30)

    slots = []
    work_start = datetime.strptime(f"{date} {start_str}", "%Y-%m-%d %H:%M:%S")
    work_end = datetime.strptime(f"{date} {end_str}", "%Y-%m-%d %H:%M:%S")

    current_slot = work_start
    while current_slot < work_end:
        slots.append(current_slot)
        current_slot += timedelta(minutes=slot_min)

    busy_res = supabase.table("appointments") \
        .select("starts_at") \
        .eq("master_telegram_id", master_id) \
        .neq("status", "cancelled") \
        .gte("starts_at", f"{date}T00:00:00") \
        .lte("starts_at", f"{date}T23:59:59") \
        .execute()

    busy_times = set()
    for b in busy_res.data:
        t_str = b['starts_at'].split('+')[0]
        try:
            t_dt = datetime.strptime(t_str, "%Y-%m-%dT%H:%M:%S")
        except ValueError:
            t_dt = datetime.strptime(t_str, "%Y-%m-%d %H:%M:%S")
        busy_times.add(t_dt)

    free_slots = []
    for s in slots:
        if s not in busy_times:
            free_slots.append(s.isoformat())

    return free_slots


@app.get("/masters/{master_id}/schedule")
async def get_master_schedule(master_id: int):
    """Возвращает график работы для подсветки календаря на клиенте"""
    res = supabase.table("working_hours").select("day_of_week, start_time, end_time").eq("master_telegram_id",
                                                                                         master_id).execute()
    return res.data


@app.post("/appointments")
async def create_appointment_public(app_data: AppointmentCreate, user=Depends(validate_telegram_data)):
    data = app_data.model_dump()
    data['master_telegram_id'] = data.pop('master_tg_id')
    data['client_telegram_id'] = user['id']
    data['client_username'] = user.get('username')
    data['status'] = 'pending'

    # Исправление ошибки с idempotency_key
    if not data.get('idempotency_key'):
        data['idempotency_key'] = str(uuid.uuid4())

    exist = supabase.table("appointments") \
        .select("id") \
        .eq("master_telegram_id", data['master_telegram_id']) \
        .eq("starts_at", data['starts_at']) \
        .neq("status", "cancelled") \
        .execute()

    if exist.data:
        raise HTTPException(status_code=409, detail="Slot already booked")

    res = supabase.table("appointments").insert(data).execute()
    return res.data