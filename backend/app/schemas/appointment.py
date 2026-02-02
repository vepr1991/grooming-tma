from datetime import datetime, timedelta
from app.db import supabase
from app.schemas.appointment import AppointmentCreate

class AppointmentService:
    @staticmethod
    async def create(data: AppointmentCreate, client_id: int, client_username: str = None):
        # 1. Превращаем Pydantic-модель в словарь
        appt_dict = data.model_dump()
        
        # 2. Формируем данные для вставки
        # Мы берем значение по ключу 'master_telegram_id', который теперь точно есть в словаре
        insert_data = {
            "master_telegram_id": appt_dict['master_telegram_id'], 
            "service_id": appt_dict['service_id'],
            "client_telegram_id": client_id,
            "client_username": client_username,
            "client_name": appt_dict['client_name'],
            "client_phone": appt_dict['client_phone'],
            "pet_name": appt_dict['pet_name'],
            "pet_breed": appt_dict.get('pet_breed'),
            "comment": appt_dict.get('comment'),
            "starts_at": appt_dict['starts_at'].isoformat(),
            "status": "pending"
        }

        # 3. Вставка в БД
        res = supabase.table("appointments").insert(insert_data).execute()
        
        if res.data:
            return res.data[0]
        return None
