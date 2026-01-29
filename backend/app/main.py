from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone, time
from zoneinfo import ZoneInfo
import uuid

from .db import supabase
from .auth import validate_telegram_data
from .models import MasterUpdate, ServiceModel, AppointmentCreate
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
    return supabase.table("services").select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("is_active", True) \
        .order("price") \
        .execute().data


@app.get("/masters/{master_id}/availability")
def get_availability(master_id: int, date: str):
    """
    date: YYYY-MM-DD
    Возвращает свободные слоты в ISO формате (Честный UTC).
    """
    try:
        # 1. Получаем настройки мастера (Таймзона)
        m_settings = supabase.table("masters").select("timezone").eq("telegram_id", master_id).single().execute()
        master_tz_name = m_settings.data.get('timezone') or 'Asia/Almaty'
        try:
            master_tz = ZoneInfo(master_tz_name)
        except:
            master_tz = ZoneInfo('Asia/Almaty')

        # 2. Работаем с датой
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
        dow = target_date.isoweekday()  # 1=Mon, 7=Sun

        # 3. Получаем график работы
        wh_res = supabase.table("working_hours").select("*") \
            .eq("master_telegram_id", master_id).eq("day_of_week", dow).execute()

        if not wh_res.data:
            # Дефолт: 10:00 - 20:00
            start_t = time(10, 0)
            end_t = time(20, 0)
            slot_min = 60
        else:
            wh = wh_res.data[0]
            start_t = datetime.strptime(wh['start_time'], "%H:%M:%S").time()
            end_t = datetime.strptime(wh['end_time'], "%H:%M:%S").time()
            slot_min = wh['slot_minutes']

        # 4. Генерируем слоты: Сначала в ВРЕМЕНИ МАСТЕРА, потом конвертируем в UTC
        slots = []
        # Создаем datetime с информацией о часовом поясе мастера!
        current_dt = datetime.combine(target_date, start_t, tzinfo=master_tz)
        end_dt = datetime.combine(target_date, end_t, tzinfo=master_tz)

        while current_dt < end_dt:
            # Конвертируем в UTC для отправки на фронт и проверки в БД
            utc_slot = current_dt.astimezone(timezone.utc)
            slots.append(utc_slot)

            # Прибавляем минуты к локальному времени
            current_dt += timedelta(minutes=slot_min)

        # 5. Получаем занятые записи (они в БД хранятся в UTC)
        # Нам нужно найти все записи, которые попадают в этот день по времени мастера
        day_start_utc = datetime.combine(target_date, time(0, 0), tzinfo=master_tz).astimezone(timezone.utc).isoformat()
        day_end_utc = datetime.combine(target_date, time(23, 59), tzinfo=master_tz).astimezone(timezone.utc).isoformat()

        apps_res = supabase.table("appointments").select("starts_at") \
            .eq("master_telegram_id", master_id) \
            .in_("status", ["pending", "confirmed"]) \
            .gte("starts_at", day_start_utc).lte("starts_at", day_end_utc).execute()

        taken_times = set()
        for a in apps_res.data:
            # Парсим время из БД
            taken_dt = datetime.fromisoformat(a['starts_at'])
            # Сравниваем в формате HH:MM (UTC)
            taken_times.add(taken_dt.strftime("%H:%M"))

        # 6. Фильтруем
        available_slots = []
        for s in slots:
            # s уже в UTC. Берем его время UTC.
            slot_utc_str = s.strftime("%H:%M")
            if slot_utc_str not in taken_times:
                # Отправляем полный ISO (например 2026-01-30T14:00:00+00:00)
                available_slots.append(s.isoformat())

        return available_slots

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


# --- AUTH / ME ---

@app.get("/me")
def get_me(user=Depends(validate_telegram_data)):
    uid = user['id']
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
    data = update.model_dump(exclude_unset=True)
    data['telegram_id'] = user['id']

    exist = supabase.table("masters").select("id").eq("telegram_id", user['id']).execute()
    if not exist.data:
        supabase.table("masters").insert(data).execute()
    else:
        supabase.table("masters").update(data).eq("telegram_id", user['id']).execute()
    return {"status": "ok"}


@app.get("/me/services")
def get_my_services(user=Depends(validate_telegram_data)):
    return supabase.table("services").select("*") \
        .eq("master_telegram_id", user['id']) \
        .eq("is_active", True) \
        .order("id").execute().data


@app.post("/me/services")
def create_service(srv: ServiceModel, user=Depends(validate_telegram_data)):
    data = srv.model_dump()
    data['master_telegram_id'] = user['id']
    return supabase.table("services").insert(data).execute().data


@app.delete("/me/services/{sid}")
def delete_service(sid: int, user=Depends(validate_telegram_data)):
    return supabase.table("services").update({"is_active": False}) \
        .eq("id", sid).eq("master_telegram_id", user['id']).execute().data


@app.get("/me/appointments")
def get_my_appointments(user=Depends(validate_telegram_data)):
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
    try:
        # 1. Валидация услуги
        srv = supabase.table("services").select("*").eq("id", app_data.service_id).single().execute()
        if not srv.data or srv.data['master_telegram_id'] != app_data.master_tg_id:
            raise HTTPException(400, "Invalid service")

        # 2. Подготовка данных (Всегда храним в UTC!)
        data = app_data.model_dump(mode='json')
        data['master_telegram_id'] = data.pop('master_tg_id')
        data['client_telegram_id'] = user['id']

        # 3. Вставка в БД
        res = supabase.table("appointments").insert(data).execute()

        # 4. Уведомление мастера (конвертируем UTC -> Master Timezone)
        try:
            # А. Получаем настройки мастера
            m_settings = supabase.table("masters").select("timezone").eq("telegram_id",
                                                                         data['master_telegram_id']).single().execute()
            master_tz_name = m_settings.data.get('timezone') or 'Asia/Almaty'

            # Б. Берем время из заявки (оно в UTC)
            utc_dt = app_data.starts_at
            if utc_dt.tzinfo is None:
                utc_dt = utc_dt.replace(tzinfo=timezone.utc)

            # В. Конвертируем в город мастера
            try:
                local_dt = utc_dt.astimezone(ZoneInfo(master_tz_name))
            except Exception:
                local_dt = utc_dt.astimezone(ZoneInfo('Asia/Almaty'))

            # Г. Форматируем
            formatted_time = local_dt.strftime("%d.%m.%Y в %H:%M")

            msg_text = (
                f"🗓 *Новая запись!*\n"
                f"👤 Клиент: {app_data.client_phone}\n"
                f"🐾 Питомец: {app_data.pet_name}\n"
                f"⏰ Время: *{formatted_time}* ({master_tz_name})"
            )

            await notify_master(data['master_telegram_id'], msg_text)
        except Exception as e:
            print(f"WARNING: Failed to notify master: {e}")

        return res.data[0]

    except Exception as e:
        err_str = str(e).lower()
        if "duplicate key" in err_str or "violates unique constraint" in err_str:
            raise HTTPException(409, "Это время только что заняли. Пожалуйста, выберите другое.")

        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Server error: {str(e)}")


# --- UPLOADS (Supabase Storage) ---
@app.post("/uploads/avatar")
async def upload_avatar(file: UploadFile = File(...), user=Depends(validate_telegram_data)):
    file_ext = file.filename.split('.')[-1]
    filename = f"{user['id']}_{uuid.uuid4()}.{file_ext}"
    file_bytes = await file.read()
    try:
        res = supabase.storage.from_("avatars").upload(
            path=filename,
            file=file_bytes,
            file_options={"content-type": file.content_type}
        )
        public_url = supabase.storage.from_("avatars").get_public_url(filename)
        return {"avatar_url": public_url}
    except Exception as e:
        print(f"Storage upload error: {e}")
        raise HTTPException(500, "Failed to upload image")