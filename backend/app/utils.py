import httpx
from .config import BOT_TOKEN

async def notify_master(chat_id: int, message: str):
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"chat_id": chat_id, "text": message})