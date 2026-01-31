# backend/app/services/appointment_service.py
from fastapi import HTTPException
from app.db import supabase
from app.schemas.appointment import AppointmentCreate
import uuid


class AppointmentService:
    @staticmethod
    async def create(data: AppointmentCreate, client_id: int, client_username: str = None):
        """
        Создает запись с проверками безопасности и целостности данных.
        """
        appt_dict = data.model_dump()

        # 1. Маппинг полей (из Pydantic в названия колонок БД)
        # В модели мы используем master_tg_id, а в базе поле называется master_telegram_id
        master_id = appt_dict.pop('master_tg_id')
        appt_dict['master_telegram_id'] = master_id

        # 2. Обогащаем данными из авторизации (берем их из токена, а не от клиента)
        appt_dict['client_telegram_id'] = client_id
        appt_dict['client_username'] = client_username
        appt_dict['status'] = 'pending'

        # Генерация ключа идемпотентности, если фронт не прислал
        if not appt_dict.get('idempotency_key'):
            appt_dict['idempotency_key'] = str(uuid.uuid4())

        # --- SECURITY FIX (P0) ---
        # Проверяем, что запрашиваемая услуга действительно принадлежит указанному мастеру.
        # Это предотвращает подмену ID мастера злоумышленниками.
        service_check = supabase.table("services").select("id") \
            .eq("id", appt_dict['service_id']) \
            .eq("master_telegram_id", master_id) \
            .execute()

        if not service_check.data:
            raise HTTPException(status_code=400, detail="Услуга не найдена или не принадлежит этому мастеру")

        # --- RACE CONDITION FIX (P1) ---
        try:
            # Мы сразу пытаемся сделать INSERT.
            # Если слот занят, база данных (Postgres) выбросит ошибку уникального индекса idx_unique_slot.
            res = supabase.table("appointments").insert(appt_dict).execute()
            return res.data[0]

        except Exception as e:
            error_str = str(e).lower()
            # Ловим код ошибки Postgres 23505 (unique_violation) или текст "duplicate key"
            if "duplicate key" in error_str or "23505" in error_str:
                raise HTTPException(status_code=409, detail="Извините, это время уже занято")

            # Если это другая ошибка - пробрасываем её дальше (чтобы увидеть в логах)
            print(f"Database Error: {e}")
            raise HTTPException(status_code=500, detail="Ошибка базы данных")