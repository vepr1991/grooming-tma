from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
import re

class AppointmentCreate(BaseModel):
    master_telegram_id: int  # ИСПРАВЛЕНО: было master_tg_id, стало как в БД
    service_id: int
    starts_at: datetime      # Pydantic сам преобразует ISO-строку в datetime
    
    client_name: str
    client_phone: str
    client_username: Optional[str] = None # ДОБАВЛЕНО: чтобы не падало, если фронт шлет юзернейм
    
    pet_name: str
    pet_breed: Optional[str] = None
    comment: Optional[str] = None
    
    # Идемпотентность (защита от двойного клика)
    idempotency_key: Optional[str] = None

    @field_validator('client_phone')
    def validate_phone(cls, v):
        # Оставляем простую проверку: цифры, +, -, пробелы, скобки
        if not re.match(r'^[\d\+\(\)\-\s]{10,20}$', v):
            raise ValueError('Некорректный формат телефона')
        return v
