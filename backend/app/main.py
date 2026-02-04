# (c) 2026 Владимир Коваленко. Все права защищены.
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler  # [NEW]

from app.db import supabase
from app.auth import validate_telegram_data
from app.routers import admin, client, analytics
from app.reminders import check_reminders  # [NEW] Импортируем нашу функцию


# [NEW] Настройка жизненного цикла (Startup/Shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запуск планировщика
    scheduler = AsyncIOScheduler()
    # Добавляем задачу: запускать check_reminders каждую минуту
    scheduler.add_job(check_reminders, 'interval', minutes=1)
    scheduler.start()
    print("⏰ Scheduler started!")

    yield

    # Остановка (если нужно)
    scheduler.shutdown()


# Передаем lifespan в приложение
app = FastAPI(title="Grooming TMA API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(client.router)
app.include_router(analytics.router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/uploads/avatar")
async def upload_avatar_legacy(file: UploadFile = File(...), user=Depends(validate_telegram_data)):
    file_content = await file.read()
    file_path = f"{user['id']}/avatar.png"
    try:
        supabase.storage.from_("avatars").upload(
            file_path, file_content, file_options={"content-type": file.content_type, "upsert": "true"}
        )
        public_url = supabase.storage.from_("avatars").get_public_url(file_path)
        return {"avatar_url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))