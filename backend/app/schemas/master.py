# backend/app/schemas/master.py
from pydantic import BaseModel
from typing import Optional, List

# --- Профиль Мастера ---
class MasterProfileUpdate(BaseModel):
    salon_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None

# --- Услуги ---
class ServiceBase(BaseModel):
    name: str
    price: float
    duration_min: int = 60
    description: Optional[str] = ""

class ServiceCreate(ServiceBase):
    pass

class ServiceResponse(ServiceBase):
    id: int
    master_telegram_id: int
    is_active: bool

# --- График работы ---
class WorkingHourItem(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    slot_minutes: int = 30