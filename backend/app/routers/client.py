# (c) 2026 Владимир Коваленко. Все права защищены.
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
import pytz

from app.auth import validate_telegram_data
from app.db import supabase
from app.utils import send_telegram_message
from app.schemas.appointment import AppointmentCreate
from app.services.appointment_service import AppointmentService

router = APIRouter(tags=["Client"])


@router.get("/masters/{master_id}")
async def get_master_public_profile(master_id: int):
    # Добавляем is_premium в выборку
    res = supabase.table("masters") \
        .select("salon_name, description, avatar_url, address, phone, timezone, photos, is_premium") \
        .eq("telegram_id", master_id) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Master not found")
    return res.data[0]


@router.get("/masters/{master_id}/services")
async def get_master_services(master_id: int):
    res = supabase.table("services") \
        .select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("is_active", True) \
        .execute()
    return res.data


@router.get("/masters/{master_id}/schedule")
async def get_master_schedule(master_id: int):
    res = supabase.table("working_hours").select("day_of_week, start_time, end_time").eq("master_telegram_id",
                                                                                         master_id).execute()
    return res.data


# backend/app/routers/client.py

# ... (импорты остаются те же)

@router.get("/masters/{master_id}/availability")
async def get_master_availability(master_id: int, service_id: int, date: str):  # [ИЗМЕНЕНО] Добавили service_id
    # 1. Получаем настройки мастера
    master_res = supabase.table("masters").select("timezone, is_premium").eq("telegram_id",
                                                                             master_id).single().execute()
    if not master_res.data:
        raise HTTPException(404, "Master not found")

    master_data = master_res.data
    tz_name = master_data.get('timezone', 'Asia/Almaty')
    is_premium = master_data.get('is_premium', False)

    # [НОВОЕ] 1.1 Получаем длительность запрашиваемой услуги
    srv_res = supabase.table("services").select("duration_min").eq("id", service_id).single().execute()
    if not srv_res.data:
        raise HTTPException(404, "Service not found")
    requested_duration = srv_res.data.get('duration_min', 60)

    try:
        master_tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        master_tz = pytz.timezone('Asia/Almaty')

    try:
        naive_date = datetime.strptime(date, "%Y-%m-%d")
        target_date = master_tz.localize(naive_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format YYYY-MM-DD")

    # 2. Генерируем сетку
    weekday_iso = target_date.isoweekday()
    wh_res = supabase.table("working_hours") \
        .select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("day_of_week", weekday_iso) \
        .execute()

    if not wh_res.data:
        return []

    schedule = wh_res.data[0]

    db_slot = schedule.get('slot_minutes', 30)
    slot_min = 30 if not is_premium else db_slot

    start_parts = list(map(int, schedule['start_time'].split(':')))
    end_parts = list(map(int, schedule['end_time'].split(':')))

    work_start = target_date.replace(hour=start_parts[0], minute=start_parts[1], second=0)
    work_end = target_date.replace(hour=end_parts[0], minute=end_parts[1], second=0)

    potential_slots = []
    current = work_start
    while current < work_end:
        potential_slots.append(current)
        current += timedelta(minutes=slot_min)

    # 3. Получаем занятые интервалы
    day_start_utc = target_date.astimezone(pytz.utc)
    day_end_utc = (target_date + timedelta(days=1)).astimezone(pytz.utc)

    busy_res = supabase.table("appointments") \
        .select("starts_at, services(duration_min)") \
        .eq("master_telegram_id", master_id) \
        .neq("status", "cancelled") \
        .gte("starts_at", day_start_utc.isoformat()) \
        .lt("starts_at", day_end_utc.isoformat()) \
        .execute()

    busy_intervals = []
    for b in busy_res.data:
        t_str = b['starts_at'].replace('Z', '+00:00')
        try:
            appt_start = datetime.fromisoformat(t_str).astimezone(master_tz)
            duration = 60
            if b.get('services') and b['services'].get('duration_min'):
                duration = b['services']['duration_min']

            appt_end = appt_start + timedelta(minutes=duration)
            busy_intervals.append((appt_start, appt_end))
        except ValueError:
            pass

    # 4. Фильтруем слоты (С учетом "хвоста" новой услуги)
    now_in_master_tz = datetime.now(master_tz)
    free_slots = []

    for slot in potential_slots:
        # Пропускаем прошлое
        if slot <= now_in_master_tz:
            continue

        # Вычисляем, когда закончится НОВАЯ услуга, если начать её в этот слот
        requested_end = slot + timedelta(minutes=requested_duration)

        # Если услуга вылезает за рабочий день — скрываем слот
        if requested_end > work_end:
            continue

        # Проверка пересечений
        is_overlap = False
        for (busy_start, busy_end) in busy_intervals:
            # Формула пересечения: (StartA < EndB) и (StartB < EndA)
            if slot < busy_end and busy_start < requested_end:
                is_overlap = True
                break

        if not is_overlap:
            free_slots.append(slot.isoformat())

    return free_slots

@router.post("/appointments")
async def create_appointment_public(
        app_data: AppointmentCreate,
        user=Depends(validate_telegram_data)
):
    new_appt = await AppointmentService.create(
        data=app_data,
        client_id=user['id'],
        client_username=user.get('username')
    )

    try:
        service_name = "Услуга"
        try:
            srv_res = supabase.table("services").select("name").eq("id", new_appt['service_id']).single().execute()
            if srv_res.data:
                service_name = srv_res.data.get('name', 'Услуга')
        except:
            pass

        tz_name = 'Asia/Almaty'
        try:
            master_res = supabase.table("masters").select("timezone").eq("telegram_id", new_appt[
                'master_telegram_id']).single().execute()
            if master_res.data and master_res.data.get('timezone'):
                tz_name = master_res.data['timezone']
        except:
            pass

        try:
            utc_dt = datetime.fromisoformat(new_appt['starts_at'].replace('Z', '+00:00'))
            master_tz = pytz.timezone(tz_name)
            local_dt = utc_dt.astimezone(master_tz)
            date_str = local_dt.strftime('%d.%m.%Y в %H:%M')
        except:
            date_str = str(new_appt['starts_at'])

        client_line = f"👤 Клиент: {new_appt.get('client_name', 'Не указано')}"
        if new_appt.get('client_username'):
            client_line += f" (@{new_appt['client_username']})"

        pet_line = f"🐶 Питомец: {new_appt.get('pet_name', 'Не указано')}"
        if new_appt.get('pet_breed'):
            pet_line += f" ({new_appt['pet_breed']})"

        comment_section = ""
        if new_appt.get('comment'):
            comment_section = f"\n💬 Комментарий: {new_appt['comment']}"

        msg = (
            f"🆕 <b>Новая запись!</b>\n\n"
            f"{client_line}\n"
            f"📞 Телефон: {new_appt.get('client_phone')}\n"
            f"{pet_line}\n"
            f"✂️ Услуга: {service_name}\n"
            f"🗓 Время: {date_str}\n\n"
            f"{comment_section}"
        )
        send_telegram_message(new_appt['master_telegram_id'], msg)
    except Exception as e:
        print(f"Notify error: {e}")

    return new_appt