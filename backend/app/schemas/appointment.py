# backend/app/services/appointment_service.py
from datetime import datetime, timedelta
from app.db import supabase
from app.schemas.appointment import AppointmentCreate

class AppointmentService:
    @staticmethod
    async def create(data: AppointmentCreate, client_id: int, client_username: str = None):
        # 1. Превращаем Pydantic модель в словарь
        appt_dict = data.model_dump()
        
        # 2. Логика получения ID мастера (адаптивная)
        # Сначала ищем новое название поля, если нет - старое
        master_id = appt_dict.get('master_telegram_id') or appt_dict.get('master_tg_id')
        
        if not master_id:
            raise ValueError("Master ID is missing")

        # 3. Формируем данные для вставки в БД
        # ВАЖНО: Используем ключи, которые точно есть в вашей таблице appointments
        insert_data = {
            "master_telegram_id": master_id,
            "service_id": appt_dict['service_id'],
            "client_telegram_id": client_id,
            "client_username": client_username,
            "client_name": appt_dict['client_name'],
            "client_phone": appt_dict['client_phone'],
            "pet_name": appt_dict['pet_name'],
            "pet_breed": appt_dict.get('pet_breed'),
            "comment": appt_dict.get('comment'),
            "starts_at": appt_dict['starts_at'].isoformat(), # Приводим дату к строке
            "status": "pending"
        }

        # 4. Вставка в БД
        res = supabase.table("appointments").insert(insert_data).execute()
        
        # Возвращаем созданную запись (первый элемент списка)
        if res.data:
            return res.data[0]
        return None
