import asyncio
import os
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL")  # https://your-domain.com

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    args = message.text.split(" ")

    # Режим Клиента (если перешли по ссылке t.me/bot?start=123)
    if len(args) > 1 and args[1].isdigit():
        master_id = args[1]

        # ИСПРАВЛЕНИЕ: Мы явно добавляем ?start_param=... в URL
        # Теперь WebApp при открытии увидит этот параметр в адресной строке
        kb = InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="📅 Записаться онлайн",
                web_app=WebAppInfo(url=f"{WEBAPP_URL}/client.html?start_param={master_id}")
            )
        ]])
        await message.answer(f"Вы перешли по ссылке к мастеру #{master_id}. Нажмите кнопку:", reply_markup=kb)
        return

    # Режим Мастера (просто /start)
    kb = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(
            text="🔧 Админка мастера",
            web_app=WebAppInfo(url=f"{WEBAPP_URL}/admin.html")
        )
    ]])
    await message.answer("Привет, Мастер! Управляй своим салоном здесь.", reply_markup=kb)

    # Генерация ссылки для мастера
    my_link = f"https://t.me/{(await bot.me()).username}?start={message.from_user.id}"
    await message.answer(f"Твоя ссылка для клиентов:\n`{my_link}`", parse_mode="Markdown")


async def main():
    print("Bot started...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())