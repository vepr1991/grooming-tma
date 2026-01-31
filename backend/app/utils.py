import httpx
from .config import BOT_TOKEN


async def send_telegram_message(chat_id: int, message: str):
    if not chat_id:
        return

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }

    async with httpx.AsyncClient() as client:
        try:
            # Используем safe-call, чтобы не ронять сервер при ошибке телеграма
            await client.post(url, json=payload)
        except Exception as e:
            print(f"Failed to send TG message: {e}")