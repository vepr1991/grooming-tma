# (c) 2026 Владимир Коваленко. Все права защищены.
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
from datetime import datetime
from app.utils import send_telegram_message, compress_image
import pytz
import uuid

from app.auth import validate_telegram_data
from app.db import supabase
from app.utils import send_telegram_message
from app.schemas.master import (
    MasterProfileUpdate, ServiceCreate, ServiceUpdate, WorkingHourItem
)

router = APIRouter(prefix="/me", tags=["Admin"])


@router.get("")
async def get_my_profile(user=Depends(validate_telegram_data)):
    tg_id = user['id']
    # Добавляем is_premium в выборку
    res = supabase.table("masters").select("*, is_premium").eq("telegram_id", tg_id).execute()
    if not res.data:
        # Авто-регистрация
        new_user = {
            "telegram_id": tg_id,
            "username": user.get("username"),
            "full_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        }
        res = supabase.table("masters").insert(new_user).execute()
        return {"user": user, "profile": res.data[0]}
    return {"user": user, "profile": res.data[0]}


@router.patch("/profile")
async def update_profile(data: MasterProfileUpdate, user=Depends(validate_telegram_data)):
    tg_id = user['id']
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if 'photos' in update_data:
        if update_data['photos'] and len(update_data['photos']) > 0:
            update_data['avatar_url'] = update_data['photos'][0]
        else:
            update_data['avatar_url'] = None

    res = supabase.table("masters").update(update_data).eq("telegram_id", tg_id).execute()
    return res.data


@router.post("/upload-photo")
async def upload_photo(file: UploadFile = File(...), user=Depends(validate_telegram_data)):
    # 1. Проверка лимитов
    tg_id = user['id']
    res = supabase.table("masters").select("photos, is_premium").eq("telegram_id", tg_id).single().execute()
    
    if not res.data:
        raise HTTPException(status_code=404, detail="Master not found")
        
    master = res.data
    current_photos = master.get('photos') or []
    is_premium = master.get('is_premium', False)
    
    # --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
    # Лимит для ОТОБРАЖЕНИЯ в профиле: 10 (Pro) или 3 (Basic)
    display_limit = 10 if is_premium else 3
    
    # Лимит для ЗАГРУЗКИ (хранилища): даем запас +5 фото, чтобы можно было "менять" фото без удаления
    # Например, на Basic можно загрузить до 8 фото, но в профиль сохранятся только 3.
    upload_limit = display_limit + 5 
    
    if len(current_photos) >= upload_limit:
        raise HTTPException(
            status_code=403, 
            detail=f"Временное хранилище переполнено ({upload_limit} фото). Сохраните профиль, чтобы очистить место."
        )
    # -----------------------

    # 2. Сжатие и Загрузка
    try:
        original_bytes = await file.read()
        
        # Сжимаем
        compressed_bytes = compress_image(original_bytes, max_size=1024, quality=80)
        
        file_path = f"{user['id']}/{uuid.uuid4()}.jpg"
        bucket_name = "avatars"

        supabase.storage.from_(bucket_name).upload(
            path=file_path,
            file=compressed_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        public_url = supabase.storage.from_(bucket_name).get_public_url(file_path)
        return {"url": public_url}
        
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")

# --- Services ---

@router.get("/services")
async def get_services(user=Depends(validate_telegram_data)):
    res = supabase.table("services") \
        .select("*") \
        .eq("master_telegram_id", user['id']) \
        .eq("is_active", True) \
        .order("id") \
        .execute()
    return res.data


@router.post("/services")
async def create_service(srv: ServiceCreate, user=Depends(validate_telegram_data)):
    # 1. Получаем статус мастера
    master_info = supabase.table("masters").select("is_premium").eq("telegram_id", user['id']).single().execute()
    is_premium = master_info.data.get('is_premium', False)

    # 2. Если НЕ Premium — проверяем количество
    if not is_premium:
        count_res = supabase.table("services").select("id", count="exact").eq("master_telegram_id", user['id']).eq(
            "is_active", True).execute()
        current_count = count_res.count

        if current_count >= 10:
            raise HTTPException(status_code=403,
                                detail="На базовом тарифе доступно не более 10 услуг. Перейдите на Pro.")

    # 3. Сохраняем (код остаётся почти таким же, но category добавится автоматически из модели)
    data = srv.model_dump()
    data['master_telegram_id'] = user['id']
    data['is_active'] = True
    res = supabase.table("services").insert(data).execute()
    return res.data


@router.patch("/services/{service_id}")
async def update_service(
        service_id: int,
        srv: ServiceUpdate,
        user=Depends(validate_telegram_data)
):
    update_data = srv.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No data provided")

    res = supabase.table("services").update(update_data) \
        .eq("id", service_id) \
        .eq("master_telegram_id", user['id']) \
        .execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Service not found or access denied")

    return res.data[0]


@router.delete("/services/{sid}")
async def delete_service(sid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("services") \
        .update({"is_active": False}) \
        .eq("id", sid) \
        .eq("master_telegram_id", user['id']) \
        .execute()
    return {"status": "archived"}


# --- Working Hours ---

@router.get("/working-hours")
async def get_hours(user=Depends(validate_telegram_data)):
    res = supabase.table("working_hours").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@router.post("/working-hours")
async def set_hours(hours: List[WorkingHourItem], user=Depends(validate_telegram_data)):
    # 1. Проверяем подписку
    master_info = supabase.table("masters").select("is_premium").eq("telegram_id", user['id']).single().execute()
    is_premium = master_info.data.get('is_premium', False)

    data_list = []
    for h in hours:
        item = h.model_dump()
        item['master_telegram_id'] = user['id']

        # 2. ЛОГИКА ОГРАНИЧЕНИЯ
        # Если не премиум — принудительно ставим 30 (или 60) минут, игнорируя то, что прислал фронтенд
        if not is_premium:
            item['slot_minutes'] = 30  # Жесткий стандарт для Basic

        data_list.append(item)

    # Дальше сохранение как обычно...
    supabase.table("working_hours").delete().eq("master_telegram_id", user['id']).execute()
    if data_list:
        supabase.table("working_hours").insert(data_list).execute()
    return {"status": "updated"}


# --- Appointments ---

@router.get("/appointments")
async def get_my_appointments(user=Depends(validate_telegram_data)):
    res = supabase.table("appointments") \
        .select("*, services(name)") \
        .eq("master_telegram_id", user['id']) \
        .order("starts_at", desc=False) \
        .execute()
    return res.data


@router.post("/appointments/{aid}/confirm")
async def confirm_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "confirmed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()

    if res.data:
        try:
            master_res = supabase.table("masters").select("timezone").eq("telegram_id", user['id']).single().execute()
            tz_name = master_res.data.get('timezone', 'Asia/Almaty') if master_res.data else 'Asia/Almaty'

            details = supabase.table("appointments").select("*, services(name)").eq("id", aid).single().execute()
            appt = details.data

            if appt.get('client_telegram_id'):
                service_name = appt.get('services', {}).get('name', 'Груминг') if appt.get('services') else "Груминг"
                pet_name = appt.get('pet_name', 'Не указано')

                try:
                    utc_dt = datetime.fromisoformat(appt['starts_at'].replace('Z', '+00:00'))
                    master_tz = pytz.timezone(tz_name)
                    local_dt = utc_dt.astimezone(master_tz)
                    date_str = local_dt.strftime('%d.%m.%Y в %H:%M')
                except:
                    date_str = str(appt['starts_at'])

                msg = (
                    f"✅ <b>Ваша запись подтверждена!</b>\n\n"
                    f"🐶 Питомец: <b>{pet_name}</b>\n"
                    f"✂️ Услуга: {service_name}\n"
                    f"🗓 Время: {date_str}\n\n"
                    f"📍 Ждем вас!"
                )
                send_telegram_message(appt['client_telegram_id'], msg)
        except Exception as e:
            print(f"Notify error: {e}")
    return res.data


# --- НОВОЕ: Завершение записи ---
@router.post("/appointments/{aid}/complete")
async def complete_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "completed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()
    return res.data
# --------------------------------


@router.post("/appointments/{aid}/cancel")
async def cancel_appointment(aid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("appointments").update({"status": "cancelled"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()

    if res.data:
        try:
            master_res = supabase.table("masters").select("timezone").eq("telegram_id", user['id']).single().execute()
            tz_name = master_res.data.get('timezone', 'Asia/Almaty') if master_res.data else 'Asia/Almaty'

            details = supabase.table("appointments").select("*, services(name)").eq("id", aid).single().execute()
            appt = details.data

            if appt and appt.get('client_telegram_id'):
                service_name = appt.get('services', {}).get('name', 'Груминг') if appt.get('services') else "Груминг"
                pet_name = appt.get('pet_name', 'Не указано')

                try:
                    utc_dt = datetime.fromisoformat(appt['starts_at'].replace('Z', '+00:00'))
                    master_tz = pytz.timezone(tz_name)
                    local_dt = utc_dt.astimezone(master_tz)
                    date_str = local_dt.strftime('%d.%m.%Y в %H:%M')
                except:
                    date_str = str(appt.get('starts_at', ''))

                msg = (
                    f"🚫 <b>Запись отменена</b>\n\n"
                    f"К сожалению, мастер отменил вашу запись.\n\n"
                    f"🐶 Питомец: <b>{pet_name}</b>\n"
                    f"✂️ Услуга: {service_name}\n"
                    f"🗓 Время: {date_str}\n\n"
                    f"Пожалуйста, выберите другое удобное время."
                )
                send_telegram_message(appt['client_telegram_id'], msg)
        except Exception:
            pass
    return res.data
