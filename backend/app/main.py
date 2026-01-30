from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import json

# Импортируем наши модули (предполагаем, что auth.py и db.py настроены корректно)
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


# --- ROUTES ---

@app.get("/health")
async def health_check():
    return {"status": "ok"}


# 1. ПРОФИЛЬ МАСТЕРА
@app.get("/me")
async def get_my_profile(user=Depends(validate_telegram_data)):
    # user - это dict с данными из initData (id, username, first_name...)
    tg_id = user['id']

    # Пытаемся найти пользователя в БД
    res = supabase.table("users").select("*").eq("telegram_id", tg_id).execute()

    if not res.data:
        # Если нет - создаем (первый вход)
        new_user = {
            "telegram_id": tg_id,
            "username": user.get("username"),
            "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        }
        res = supabase.table("users").insert(new_user).execute()
        return {"user": user, "profile": res.data[0]}

    return {"user": user, "profile": res.data[0]}


@app.patch("/me/profile")
async def update_profile(data: UserProfileUpdate, user=Depends(validate_telegram_data)):
    tg_id = user['id']
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    res = supabase.table("users").update(update_data).eq("telegram_id", tg_id).execute()
    return res.data


# 2. ЗАГРУЗКА АВАТАРА
@app.post("/uploads/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(validate_telegram_data)):
    # В Supabase Storage должен быть создан bucket "avatars" (Public)
    file_content = await file.read()
    file_path = f"{user['id']}/avatar.png"  # Перезаписываем старый, чтобы не плодить файлы

    # Загружаем в Supabase Storage
    try:
        supabase.storage.from_("avatars").upload(
            file_path,
            file_content,
            file_options={"content-type": file.content_type, "upsert": "true"}
        )
        # Получаем публичную ссылку
        public_url = supabase.storage.from_("avatars").get_public_url(file_path)
        return {"avatar_url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 3. УСЛУГИ
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


# 4. ГРАФИК РАБОТЫ
@app.get("/me/working-hours")
async def get_hours(user=Depends(validate_telegram_data)):
    res = supabase.table("working_hours").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@app.post("/me/working-hours")
async def set_hours(hours: List[WorkingHourItem], user=Depends(validate_telegram_data)):
    # Сначала удаляем старые, потом пишем новые (простая стратегия)
    supabase.table("working_hours").delete().eq("master_telegram_id", user['id']).execute()

    data_list = []
    for h in hours:
        item = h.model_dump()
        item['master_telegram_id'] = user['id']
        data_list.append(item)

    if data_list:
        supabase.table("working_hours").insert(data_list).execute()

    return {"status": "updated"}


# 5. КЛИЕНТСКАЯ ЧАСТЬ (Публичный список мастеров/услуг)
# Для простоты клиент может запрашивать /masters, но пока используем прямые ID в client.html

@app.get("/masters/{master_id}/catalog")
async def get_master_catalog(master_id: int):
    # Данные мастера
    u_res = supabase.table("users").select("salon_name, address, phone, description, avatar_url").eq("telegram_id",
                                                                                                     master_id).execute()
    # Услуги
    s_res = supabase.table("services").select("*").eq("master_telegram_id", master_id).execute()
    # Часы работы (для календаря)
    w_res = supabase.table("working_hours").select("*").eq("master_telegram_id", master_id).execute()

    return {
        "master": u_res.data[0] if u_res.data else None,
        "services": s_res.data,
        "schedule": w_res.data
    }


@app.get("/masters/{master_id}/slots")
async def get_slots(master_id: int, date: str):
    # Здесь должна быть логика расчета свободных слотов
    # Для MVP просто возвращаем список занятых времен
    res = supabase.table("appointments") \
        .select("starts_at, services(duration_min)") \
        .eq("master_telegram_id", master_id) \
        .eq("status", "confirmed") \
        .filter("starts_at", "gte", f"{date}T00:00:00") \
        .filter("starts_at", "lte", f"{date}T23:59:59") \
        .execute()
    return res.data


# 6. ЗАПИСИ (APPOINTMENTS)

@app.post("/appointments")
async def create_appointment(app_data: AppointmentCreate, user=Depends(validate_telegram_data)):
    """
    Создание записи клиентом.
    Автоматически берем Telegram ID и Username клиента из initData.
    """
    data = app_data.model_dump()

    # Переносим ID мастера из тела в поле для БД, если нужно переименование
    # В модели: master_tg_id -> В БД: master_telegram_id
    data['master_telegram_id'] = data.pop('master_tg_id')

    # Данные клиента из авторизации
    data['client_telegram_id'] = user['id']
    data['client_username'] = user.get('username')  # <--- Сохраняем Username!

    data['status'] = 'pending'

    res = supabase.table("appointments").insert(data).execute()

    # TODO: Здесь можно отправить уведомление мастеру через бота

    return res.data


@app.get("/me/appointments")
async def get_my_appointments(user=Depends(validate_telegram_data)):
    # Получаем записи с названием услуги (join)
    # Supabase syntax for join: services(name)
    res = supabase.table("appointments") \
        .select("*, services(name)") \
        .eq("master_telegram_id", user['id']) \
        .order("starts_at", desc=False) \
        .execute()
    return res.data


@app.post("/me/appointments/{aid}/confirm")
async def confirm_appointment(aid: int, user=Depends(validate_telegram_data)):
    # Проверяем, что запись принадлежит этому мастеру
    res = supabase.table("appointments").update({"status": "confirmed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data


# --- НОВЫЙ ЭНДПОИНТ: ОТМЕНА ЗАПИСИ ---
@app.post("/me/appointments/{aid}/cancel")
async def cancel_appointment(aid: int, user=Depends(validate_telegram_data)):
    # Ставим статус 'cancelled'
    res = supabase.table("appointments").update({"status": "cancelled"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data