import requests
from .config import BOT_TOKEN

def send_telegram_message(chat_id: int, text: str):
    """Отправляет сообщение в Telegram через Bot API"""
    if not BOT_TOKEN:
        print("WARNING: BOT_TOKEN not set, notification skipped")
        return

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }

    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code != 200:
            print(f"Telegram API Error: {response.text}")
    except Exception as e:
        print(f"Failed to send notification: {e}")