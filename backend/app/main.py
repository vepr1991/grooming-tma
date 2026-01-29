from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone, time
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
    return supabase.table("services").select("*")\
        .eq("master_telegram_id", master_id)\
        .eq("is_active", True)\
        .order("price")\
        .execute().data


@app.get("/masters/{master_id}/availability")
def get_availability(master_id: int, date: str):
    print(f"DEBUG: Requesting availability for master {master_id} on {date}")
    try:
        # 1. Какой это день недели? (1=Понедельник, 7=Воскресенье)
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        dow = target_date.isoweekday()

        # 2. Получаем график работы
        wh_res = supabase.table("working_hours").select("*") \
            .eq("master_telegram_id", master_id).eq("day_of_week", dow).execute()

        if not wh_res.data:
            # Если графика нет - дефолт 10:00 - 20:00
            print("DEBUG: No custom schedule, using default 10-20")
            start_t = time(10, 0)
            end_t = time(20, 0)
            slot_min = 60  # По умолчанию час, чтобы проще тестировать
        else:
            wh = wh_res.data[0]
            # Supabase возвращает время как строку "HH:MM:SS"
            start_t = datetime.strptime(wh['start_time'], "%H:%M:%S").time()
            end_t = datetime.strptime(wh['end_time'], "%H:%M:%S").time()
            slot_min = wh['slot_minutes']

        # 3. Генерируем теоретические слоты (просто список времен)
        slots = []
        current_dt = datetime.combine(target_date, start_t)
        end_dt = datetime.combine(target_date, end_t)

        while current_dt < end_dt:
            slots.append(current_dt)  # Храним как объекты datetime
            current_dt += timedelta(minutes=slot_min)

        print(f"DEBUG: Generated {len(slots)} potential slots")

        # 4. Получаем занятые записи из БД
        # Ищем записи, которые начинаются в этот день (с 00:00 до 23:59)
        day_start = datetime.combine(target_date, time(0, 0)).isoformat()
        day_end = datetime.combine(target_date, time(23, 59)).isoformat()

        apps_res = supabase.table("appointments").select("starts_at") \
            .eq("master_telegram_id", master_id) \
            .in_("status", ["pending", "confirmed"]) \
            .gte("starts_at", day_start).lte("starts_at", day_end).execute()

        # Собираем занятые времена в список строк (обрезаем до минут для сравнения)
        # Postgres возвращает: "2026-01-29T10:00:00+00:00" или подобные
        taken_times = []
        for a in apps_res.data:
            # Парсим строку из БД обратно в datetime
            # Обрезаем таймзону для простоты сравнения (dirty hack but works for MVP)
            raw_time = a['starts_at'].split('+')[0].replace('T', ' ')
            # Если там есть секунды и доли, упрощаем до минут
            try:
                dt = datetime.fromisoformat(raw_time)
                taken_times.append(dt.strftime("%H:%M"))
            except ValueError:
                pass  # Пропускаем кривые даты

        print(f"DEBUG: Taken times: {taken_times}")

        # 5. Фильтруем
        available_slots = []
        for s in slots:
            slot_str = s.strftime("%H:%M")
            if slot_str not in taken_times:
                # Возвращаем полный ISO формат, который ждет фронтенд
                available_slots.append(s.isoformat())

        return available_slots

    except Exception as e:
        import traceback
        traceback.print_exc()  # Выведет полную ошибку в терминал Docker
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


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
    # Добавили .eq("is_active", True), чтобы скрытые услуги не приходили в список
    return supabase.table("services").select("*")\
        .eq("master_telegram_id", user['id'])\
        .eq("is_active", True)\
        .order("id").execute().data


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
    print(f"DEBUG: Creating appointment for master {app_data.master_tg_id}")
    try:
        # 1. Валидация
        srv = supabase.table("services").select("*").eq("id", app_data.service_id).single().execute()
        if not srv.data or srv.data['master_telegram_id'] != app_data.master_tg_id:
            raise HTTPException(400, "Invalid service")

        # 2. Подготовка данных
        data = app_data.model_dump(mode='json')

        # --- ИСПРАВЛЕНИЕ: Переименовываем поле для базы данных ---
        # Python: master_tg_id  ->  DB: master_telegram_id
        data['master_telegram_id'] = data.pop('master_tg_id')
        # --------------------------------------------------------

        data['client_telegram_id'] = user['id']

        # 3. Вставка
        print(f"DEBUG: Inserting data: {data}")
        res = supabase.table("appointments").insert(data).execute()

        # 4. Уведомление
        try:
            await notify_master(data['master_telegram_id'],
                                f"🗓 Новая запись!\nКлиент: {app_data.client_phone}\nПитомец: {app_data.pet_name}\nВремя: {app_data.starts_at}")
        except Exception as e:
            print(f"WARNING: Failed to notify master: {e}")

        return res.data[0]

    except Exception as e:
        import traceback
        traceback.print_exc()
        if "duplicate key" in str(e) or "idx_unique_slot" in str(e):
            raise HTTPException(409, "Slot already taken")
        raise HTTPException(500, f"Server error: {str(e)}")

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