from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List
from datetime import datetime

from app.auth import validate_telegram_data
from app.db import supabase
from app.utils import send_telegram_message
from app.schemas.master import (
    MasterProfileUpdate, ServiceCreate, WorkingHourItem
)

router = APIRouter(prefix="/me", tags=["Admin"])


@router.get("")
async def get_my_profile(user=Depends(validate_telegram_data)):
    tg_id = user['id']
    res = supabase.table("masters").select("*").eq("telegram_id", tg_id).execute()
    if not res.data:
        # Авто-регистрация при первом входе
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
    res = supabase.table("masters").update(update_data).eq("telegram_id", tg_id).execute()
    return res.data


@router.get("/services")
async def get_services(user=Depends(validate_telegram_data)):
    res = supabase.table("services").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@router.post("/services")
async def create_service(srv: ServiceCreate, user=Depends(validate_telegram_data)):
    data = srv.model_dump()
    data['master_telegram_id'] = user['id']
    res = supabase.table("services").insert(data).execute()
    return res.data


@router.delete("/services/{sid}")
async def delete_service(sid: int, user=Depends(validate_telegram_data)):
    res = supabase.table("services").delete().eq("id", sid).eq("master_telegram_id", user['id']).execute()
    return {"status": "deleted"}


@router.get("/working-hours")
async def get_hours(user=Depends(validate_telegram_data)):
    res = supabase.table("working_hours").select("*").eq("master_telegram_id", user['id']).execute()
    return res.data


@router.post("/working-hours")
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
    # 1. Обновляем статус в БД
    res = supabase.table("appointments").update({"status": "confirmed"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()

    if res.data:
        # 2. Отправляем уведомление клиенту
        try:
            # Получаем детали записи, включая имя услуги
            details = supabase.table("appointments").select("*, services(name)").eq("id", aid).single().execute()
            appt = details.data

            if appt.get('client_telegram_id'):
                service_name = appt.get('services', {}).get('name', 'Груминг') if appt.get('services') else "Груминг"
                pet_name = appt.get('pet_name', 'Не указано')

                # TODO: Тут стоит поправить таймзону (сейчас UTC), но пока оставляем как есть по вашему запросу
                dt = datetime.fromisoformat(appt['starts_at'].replace('Z', '+00:00'))

                # Формируем красивое сообщение
                msg = (
                    f"✅ <b>Ваша запись подтверждена!</b>\n\n"
                    f"🐶 Питомец: <b>{pet_name}</b>\n"
                    f"✂️ Услуга: {service_name}\n"
                    f"🗓 Время: {dt.strftime('%d.%m в %H:%M')}\n\n"
                    f"📍 Ждем вас!"
                )

                send_telegram_message(appt['client_telegram_id'], msg)
        except Exception as e:
            print(f"Notify error: {e}")

    return res.data


@router.post("/appointments/{aid}/cancel")
async def cancel_appointment(aid: int, user=Depends(validate_telegram_data)):
    # 1. Обновляем статус
    res = supabase.table("appointments").update({"status": "cancelled"}) \
        .eq("id", aid).eq("master_telegram_id", user['id']).execute()

    # 2. Если успешно, отправляем уведомление
    if res.data:
        try:
            details = supabase.table("appointments") \
                .select("*, services(name)") \
                .eq("id", aid) \
                .single() \
                .execute()

            appt = details.data
            client_id = appt.get('client_telegram_id')

            if client_id:
                try:
                    # TODO: Здесь тоже можно будет внедрить таймзону мастера
                    dt = datetime.fromisoformat(appt['starts_at'].replace('Z', '+00:00'))
                    date_str = dt.strftime("%d.%m в %H:%M")
                except:
                    date_str = str(appt.get('starts_at', ''))

                service_name = "Груминг"
                if appt.get('services') and isinstance(appt['services'], dict):
                    service_name = appt['services'].get('name', service_name)

                # Достаем имя питомца
                pet_name = appt.get('pet_name', 'Не указано')

                msg_text = (
                    f"🚫 <b>Запись отменена</b>\n\n"
                    f"К сожалению, мастер отменил вашу запись.\n\n"
                    f"🐶 Питомец: <b>{pet_name}</b>\n"
                    f"✂️ Услуга: {service_name}\n"
                    f"🗓 Время: {date_str}\n\n"
                    f"Пожалуйста, выберите другое удобное время."
                )

                send_telegram_message(client_id, msg_text)

        except Exception as e:
            print(f"Error sending cancel notification: {e}")

    return res.data