# (c) 2026 Владимир Коваленко. Все права защищены.
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta, time
import pytz

from app.auth import validate_telegram_data
from app.db import supabase
# Не забываем про нашу защиту от XSS
from app.utils import send_telegram_message, escape_html
from app.schemas.appointment import AppointmentCreate
from app.services.appointment_service import AppointmentService

router = APIRouter(tags=["Client"])


@router.get("/masters/{master_id}")
async def get_master_public_profile(master_id: int):
    # Выбираем только публичные поля
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
        .select("id, name, price, duration_min, description, category") \
        .eq("master_telegram_id", master_id) \
        .eq("is_active", True) \
        .order("price") \
        .execute()
    return res.data


@router.get("/masters/{master_id}/schedule")
async def get_master_schedule(master_id: int):
    # Клиенту нужно знать только дни и время работы
    res = supabase.table("working_hours") \
        .select("day_of_week, start_time, end_time") \
        .eq("master_telegram_id", master_id) \
        .execute()
    return res.data


@router.get("/masters/{master_id}/availability")
async def get_master_availability(master_id: int, service_id: int, date: str):
    """
    Оптимизированный поиск слотов.
    Сложность снижена с O(N*M) до O(N+M) за счет сортировки и линейного прохода.
    """
    # 1. Параллельная загрузка данных (в идеале), но здесь делаем последовательно, но эффективно.
    # Загружаем таймзону и премиум статус (легкий запрос)
    master_res = supabase.table("masters") \
        .select("timezone, is_premium") \
        .eq("telegram_id", master_id) \
        .single() \
        .execute()

    if not master_res.data:
        raise HTTPException(404, "Master not found")

    master_data = master_res.data
    tz_name = master_data.get('timezone', 'Asia/Almaty')
    is_premium = master_data.get('is_premium', False)

    try:
        master_tz = pytz.timezone(tz_name)
    except pytz.UnknownTimeZoneError:
        master_tz = pytz.timezone('Asia/Almaty')

    # 2. Валидация даты
    try:
        naive_date = datetime.strptime(date, "%Y-%m-%d")
        target_date_start = master_tz.localize(naive_date)
        # Конец дня (23:59:59)
        target_date_end = target_date_start + timedelta(days=1) - timedelta(seconds=1)
    except ValueError:
        raise HTTPException(400, "Invalid date format YYYY-MM-DD")

    # Нельзя смотреть прошлое (оптимизация)
    now_in_tz = datetime.now(master_tz)
    if target_date_end < now_in_tz:
        return []

    # 3. Получаем длительность услуги
    srv_res = supabase.table("services").select("duration_min").eq("id", service_id).single().execute()
    if not srv_res.data:
        raise HTTPException(404, "Service not found")
    duration = srv_res.data.get('duration_min', 60)

    # 4. Получаем график на этот день недели
    weekday_iso = target_date_start.isoweekday()  # 1=Mon, 7=Sun
    wh_res = supabase.table("working_hours") \
        .select("start_time, end_time, slot_minutes") \
        .eq("master_telegram_id", master_id) \
        .eq("day_of_week", weekday_iso) \
        .maybe_single() \
        .execute()

    if not wh_res.data:
        return []  # Мастер не работает в этот день

    schedule = wh_res.data
    slot_step = 30 if not is_premium else schedule.get('slot_minutes', 30)

    # Парсим время начала и конца работы
    # start_time строка вида "09:00:00"
    def parse_time_to_dt(time_str, base_date):
        t = datetime.strptime(time_str, "%H:%M:%S").time()
        return base_date.replace(hour=t.hour, minute=t.minute, second=0)

    work_start_dt = parse_time_to_dt(schedule['start_time'], target_date_start)
    work_end_dt = parse_time_to_dt(schedule['end_time'], target_date_start)

    # Корректировка, если смотрим "сегодня" - нельзя записаться в прошлое
    if work_start_dt < now_in_tz:
        # Округляем текущее время до следующего слота
        # Например, сейчас 14:12, шаг 30 -> начало в 14:30
        minute_remainder = now_in_tz.minute % slot_step
        minutes_to_add = slot_step - minute_remainder
        next_slot_time = now_in_tz + timedelta(minutes=minutes_to_add)
        next_slot_time = next_slot_time.replace(second=0, microsecond=0)

        work_start_dt = max(work_start_dt, next_slot_time)

    # 5. Загружаем занятые интервалы (Appointments)
    # Конвертируем диапазон дня в UTC для запроса к БД
    day_start_utc = target_date_start.astimezone(pytz.utc)
    day_end_utc = target_date_end.astimezone(pytz.utc)

    busy_res = supabase.table("appointments") \
        .select("starts_at, services(duration_min)") \
        .eq("master_telegram_id", master_id) \
        .neq("status", "cancelled") \
        .gte("starts_at", day_start_utc.isoformat()) \
        .lt("starts_at", day_end_utc.isoformat()) \
        .order("starts_at") \
        .execute()

    # Формируем список занятых интервалов [(start, end), ...]
    busy_intervals = []
    for appt in busy_res.data:
        utc_start = datetime.fromisoformat(appt['starts_at'].replace('Z', '+00:00'))
        local_start = utc_start.astimezone(master_tz)

        srv_dur = 60
        if appt.get('services') and appt['services'].get('duration_min'):
            srv_dur = appt['services']['duration_min']

        local_end = local_start + timedelta(minutes=srv_dur)
        busy_intervals.append((local_start, local_end))

    # 6. Алгоритм генерации слотов (Linear Scan)
    free_slots = []
    current_slot = work_start_dt

    # Индекс текущего занятого интервала, который мы проверяем
    busy_idx = 0
    total_busy = len(busy_intervals)

    while current_slot + timedelta(minutes=duration) <= work_end_dt:
        slot_end = current_slot + timedelta(minutes=duration)
        is_busy = False

        # Проверяем пересечение с занятыми интервалами
        # Так как busy_intervals отсортированы, мы можем не проверять старые
        while busy_idx < total_busy:
            busy_start, busy_end = busy_intervals[busy_idx]

            # Если занятый интервал уже прошел (он целиком раньше текущего слота)
            if busy_end <= current_slot:
                busy_idx += 1
                continue

            # Если занятый интервал еще не начался (он целиком позже текущего слота)
            if busy_start >= slot_end:
                # Пересечения нет, и так как массив отсортирован,
                # следующие интервалы тоже будут позже. Выходим из внутреннего цикла.
                break

            # Иначе - есть пересечение
            is_busy = True
            break

        if not is_busy:
            free_slots.append(current_slot.isoformat())

        # Переходим к следующему шагу
        current_slot += timedelta(minutes=slot_step)

    return free_slots


@router.post("/appointments")
async def create_appointment_public(
        app_data: AppointmentCreate,
        user=Depends(validate_telegram_data)
):
    # 1. Создаем запись в БД
    new_appt = await AppointmentService.create(
        data=app_data,
        client_id=user['id'],
        client_username=user.get('username')
    )

    # 2. Отправляем уведомление мастеру (Fire & Forget, ошибки не должны ломать ответ API)
    try:
        service_name = "Услуга"
        # Пытаемся получить красивое имя услуги
        try:
            srv_res = supabase.table("services").select("name").eq("id", new_appt['service_id']).single().execute()
            if srv_res.data:
                service_name = escape_html(srv_res.data.get('name', 'Услуга'))
        except:
            pass

        # Определяем таймзону мастера для красивой даты
        tz_name = 'Asia/Almaty'
        try:
            master_res = supabase.table("masters").select("timezone").eq("telegram_id", new_appt[
                'master_telegram_id']).single().execute()
            if master_res.data and master_res.data.get('timezone'):
                tz_name = master_res.data['timezone']
        except:
            pass

        # Форматируем дату
        try:
            utc_dt = datetime.fromisoformat(new_appt['starts_at'].replace('Z', '+00:00'))
            master_tz = pytz.timezone(tz_name)
            local_dt = utc_dt.astimezone(master_tz)
            date_str = local_dt.strftime('%d.%m.%Y в %H:%M')
        except:
            date_str = str(new_appt['starts_at'])

        # Безопасная сборка данных (XSS защита)
        safe_client_name = escape_html(new_appt.get('client_name', 'Не указано'))
        safe_username = escape_html(new_appt.get('client_username'))
        safe_phone = escape_html(new_appt.get('client_phone'))
        safe_pet_name = escape_html(new_appt.get('pet_name', 'Не указано'))
        safe_pet_breed = escape_html(new_appt.get('pet_breed'))
        safe_comment = escape_html(new_appt.get('comment'))

        client_line = f"👤 Клиент: {safe_client_name}"
        if safe_username:
            client_line += f" (@{safe_username})"

        pet_line = f"🐶 Питомец: {safe_pet_name}"
        if safe_pet_breed:
            pet_line += f" ({safe_pet_breed})"

        comment_section = ""
        if safe_comment:
            comment_section = f"\n💬 Комментарий: {safe_comment}"

        msg = (
            f"🆕 <b>Новая запись!</b>\n\n"
            f"{client_line}\n"
            f"📞 Телефон: {safe_phone}\n"
            f"{pet_line}\n"
            f"✂️ Услуга: {service_name}\n"
            f"🗓 Время: {date_str}\n\n"
            f"{comment_section}"
        )
        send_telegram_message(new_appt['master_telegram_id'], msg)

    except Exception as e:
        print(f"Notify error (non-critical): {e}")

    return new_appt