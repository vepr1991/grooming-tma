# backend/app/schemas/appointment.py
from pydantic import BaseModel, field_validator
from typing import Optional
import re

class AppointmentCreate(BaseModel):
    service_id: int
    master_tg_id: int
    starts_at: str
    client_name: str
    client_phone: str
    pet_name: str
    pet_breed: Optional[str] = None
    comment: Optional[str] = None
    idempotency_key: Optional[str] = None

    @field_validator('client_phone')
    def validate_phone(cls, v):
        # Простая проверка: только цифры, +, скобки, дефисы, пробелы. Минимум 10 символов.
        if not re.match(r'^[\d\+\(\)\-\s]{10,20}$', v):
            raise ValueError('Некорректный формат телефона')
        return v