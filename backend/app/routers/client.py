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
    res = supabase.table("masters") \
        .select("salon_name, description, avatar_url, address, phone, timezone") \
        .eq("telegram_id", master_id) \
        .execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Master not found")
    return res.data[0]


@router.get("/masters/{master_id}/services")
async def get_master_services(master_id: int):
    res = supabase.table("services").select("*").eq("master_telegram_id", master_id).execute()
    return res.data


@router.get("/masters/{master_id}/schedule")
async def get_master_schedule(master_id: int):
    res = supabase.table("working_hours").select("day_of_week, start_time, end_time").eq("master_telegram_id",
                                                                                         master_id).execute()
    return res.data


@router.get("/masters/{master_id}/availability")
async def get_master_availability(master_id: int, date: str):
    """
    Рассчитывает свободные слоты с учетом часового пояса мастера.
    """
    # 1. Получаем часовой пояс мастера
    master_res = supabase.table("masters").select("timezone").eq("telegram_id", master_id).single().execute()
    if not master_res.data:
        raise HTTPException(404, "Master not found")

    tz_name = master_res.data.get('timezone', 'Asia/Almaty')
    try:
        master_tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        master_tz = pytz.timezone('Asia/Almaty')

    # 2. Парсим дату запроса в контексте часового пояса мастера
    try:
        # date приходит как "YYYY-MM-DD". Создаем полночь этого дня в зоне мастера.
        # Например: 2026-02-01 00:00:00+05:00
        naive_date = datetime.strptime(date, "%Y-%m-%d")
        target_date = master_tz.localize(naive_date)
    except ValueError:
        raise HTTPException(400, "Invalid date format YYYY-MM-DD")

    weekday_iso = target_date.isoweekday()

    # 3. Получаем график на этот день недели
    wh_res = supabase.table("working_hours") \
        .select("*") \
        .eq("master_telegram_id", master_id) \
        .eq("day_of_week", weekday_iso) \
        .execute()

    if not wh_res.data:
        return []

    schedule = wh_res.data[0]
    slot_min = schedule.get('slot_minutes', 30)

    # 4. Формируем границы рабочего дня (Aware Datetimes)
    # start_time - это строка "10:00:00".
    # Нам нужно приклеить её к дате и присвоить таймзону.
    start_time_parts = list(map(int, schedule['start_time'].split(':')))
    end_time_parts = list(map(int, schedule['end_time'].split(':')))

    work_start = target_date.replace(hour=start_time_parts[0], minute=start_time_parts[1], second=0)
    work_end = target_date.replace(hour=end_time_parts[0], minute=end_time_parts[1], second=0)

    # 5. Генерируем все возможные слоты
    slots = []
    current = work_start
    while current < work_end:
        slots.append(current)
        current += timedelta(minutes=slot_min)

    # 6. Получаем занятые слоты из БД
    # Важно: Supabase/Postgres возвращает время в ISO с таймзоной (обычно UTC или +00:00)
    # Нам нужно искать записи, которые пересекаются с нашими сутками (в UTC)

    # Конвертируем границы дня в UTC для запроса к БД (опционально, но надежнее)
    day_start_utc = target_date.astimezone(pytz.utc)
    day_end_utc = (target_date + timedelta(days=1)).astimezone(pytz.utc)

    busy_res = supabase.table("appointments") \
        .select("starts_at") \
        .eq("master_telegram_id", master_id) \
        .neq("status", "cancelled") \
        .gte("starts_at", day_start_utc.isoformat()) \
        .lt("starts_at", day_end_utc.isoformat()) \
        .execute()

    busy_times = set()
    for b in busy_res.data:
        # Парсим строку из БД (она с таймзоной, например "2026-02-01T10:00:00+00:00")
        # fromisoformat в Python 3.11+ отлично жует такие строки.
        # Для совместимости заменяем 'Z' на '+00:00'
        t_str = b['starts_at'].replace('Z', '+00:00')
        try:
            t_dt = datetime.fromisoformat(t_str)
            # Приводим занятое время к часовому поясу мастера для точного сравнения
            busy_times.add(t_dt.astimezone(master_tz))
        except ValueError:
            pass

    # 7. Фильтруем (сравниваем aware datetimes)
    # Если слоты и busy_times имеют таймзону, Python сравнит их корректно в абсолютном времени
    free_slots = []
    for s in slots:
        if s not in busy_times:
            # Отдаем фронтенду ISO-строку с таймзоной (например 2026-02-01T14:00:00+05:00)
            free_slots.append(s.isoformat())

    return free_slots


@router.post("/appointments")
async def create_appointment_public(
        app_data: AppointmentCreate,
        user=Depends(validate_telegram_data)
):
    # Используем сервис
    new_appt = await AppointmentService.create(
        data=app_data,
        client_id=user['id'],
        client_username=user.get('username')
    )

    # Уведомление мастеру
    try:
        # Парсим для красивого вывода
        dt_str = new_appt['starts_at'].replace('Z', '+00:00')
        dt = datetime.fromisoformat(dt_str)

        # Пытаемся получить таймзону мастера, чтобы в уведомлении было ЕГО время, а не UTC
        # (Опциональное улучшение, пока оставим вывод как есть или в UTC)
        # Для простоты выводим время как есть (обычно с тем смещением, как записалось)

        msg = (
            f"🆕 <b>Новая запись!</b>\n"
            f"👤 {new_appt.get('client_name')}\n"
            f"📞 {new_appt.get('client_phone')}\n"
            f"🐶 {new_appt.get('pet_name')}\n"
            f"🗓 {dt.strftime('%d.%m в %H:%M')}"
        )
        send_telegram_message(new_appt['master_telegram_id'], msg)
    except Exception as e:
        print(f"Notify error: {e}")

    return new_appt