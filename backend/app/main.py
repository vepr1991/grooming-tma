from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json
from datetime import datetime, timedelta

# Импортируем наши модули
from .auth import validate_telegram_data
from .db import supabase

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- PYDANTIC MODELS (Схемы данных) ---

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
    day_of_week: int  # 1=Mon, 7=Sun
    start_time: str  # "09:00"
    end_time: str  # "18:00"
    slot_minutes: int = 30


class AppointmentCreate(BaseModel):
    service_id: int
    master_tg_id: int
    starts_at: str  # ISO format datetime
    client_phone: str
    pet_name: str
    pet_breed: Optional[str] = None
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None  # Добавили поле, которое шлет фронт


# --- ROUTES ---

@app.get("/health")
async def health_check():
    return {"status": "ok"}


# ==========================================================
# 1. АДМИНСКАЯ ЧАСТЬ (ТРЕБУЕТ АВТОРИЗАЦИЮ validate_telegram_data)
# ==========================================================

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
            file_path,
            file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
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


# ==========================================================
# 2. КЛИЕНТСКАЯ ЧАСТЬ (ПУБЛИЧНЫЕ МЕТОДЫ, БЕЗ АВТОРИЗАЦИИ)
# ==========================================================

# 2.1 Получить публичный профиль мастера
@app.get("/masters/{master_id}")
async def get_master_public_profile(master_id: int):
    # Выбираем только публичные поля
    res = supabase.table("masters") \
        .select("salon_name, description, avatar_url, address, phone") \
        .eq("telegram_id", master_id) \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Master not found")

    return res.data[0]


# 2.2 Получить услуги мастера
@app.get("/masters/{master_id}/services")
async def get_master_services(master_id: int):
    res = supabase.table("services").select("*").eq("master_telegram_id", master_id).execute()
    return res.data


# 2.3 Получить доступные слоты (название как в client.ts -> availability)
@app.get("/masters/{master_id}/availability")
async def get_master_availability(master_id: int, date: str):
    """
    date формат YYYY-MM-DD
    Возвращает список свободных слотов в формате ISO.
    """
    # 1. Получаем график работы на этот день недели
    date_obj = datetime.strptime(date, "%Y-%m-%d")
    weekday_iso = date_obj.isoweekday()  # 1=Mon, 7=Sun

    wh_res = supabase.table("working_hours") \
        .select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("day_of_week", weekday_iso) \
        .execute()

    if not wh_res.data:
        return []  # Мастер не работает в этот день

    schedule = wh_res.data[0]
    start_str = schedule['start_time']  # "09:00:00"
    end_str = schedule['end_time']  # "18:00:00"
    slot_min = schedule.get('slot_minutes', 30)

    # 2. Генерируем все возможные слоты
    slots = []
    # Парсим время начала и конца
    work_start = datetime.strptime(f"{date} {start_str}", "%Y-%m-%d %H:%M:%S")
    work_end = datetime.strptime(f"{date} {end_str}", "%Y-%m-%d %H:%M:%S")

    current_slot = work_start
    while current_slot < work_end:
        slots.append(current_slot)
        current_slot += timedelta(minutes=slot_min)

    # 3. Получаем уже занятые записи (confirmed или pending)
    # Чтобы не показывать слот, если он занят
    busy_res = supabase.table("appointments") \
        .select("starts_at") \
        .eq("master_telegram_id", master_id) \
        .neq("status", "cancelled") \
        .gte("starts_at", f"{date}T00:00:00") \
        .lte("starts_at", f"{date}T23:59:59") \
        .execute()

    busy_times = set()
    for b in busy_res.data:
        # Приводим к datetime для сравнения
        # Supabase возвращает ISO string, например "2023-10-25T10:00:00" (иногда с +00:00)
        # Упрощенно обрежем до секунд
        t_str = b['starts_at'].split('+')[0]
        t_dt = datetime.strptime(t_str, "%Y-%m-%dT%H:%M:%S")
        busy_times.add(t_dt)

    # 4. Фильтруем слоты
    free_slots = []
    for s in slots:
        if s not in busy_times:
            # Возвращаем в ISO формате
            free_slots.append(s.isoformat())

    return free_slots


# 2.4 Создание записи (Публичный метод, но берет данные клиента из initData если есть)
@app.post("/appointments")
async def create_appointment_public(app_data: AppointmentCreate, user=Depends(validate_telegram_data)):
    data = app_data.model_dump()

    # Убираем лишние поля (idempotency_key не пишем в БД, если нет колонки)
    if 'idempotency_key' in data:
        del data['idempotency_key']

    data['master_telegram_id'] = data.pop('master_tg_id')
    data['client_telegram_id'] = user['id']
    data['client_username'] = user.get('username')
    data['status'] = 'pending'

    # Проверка на занятость слота перед записью
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