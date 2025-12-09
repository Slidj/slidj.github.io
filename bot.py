import os
import requests
import asyncio
from telegram import Bot
from telegram.ext import Application, CommandHandler, ContextTypes
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# 1. Змінні середовища (ТОКЕН ТА ID КАНАЛУ)
# Бот буде брати їх з налаштувань сервера, а не з коду!
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN") 
CHANNEL_ID = os.getenv("CHANNEL_ID") 

if not TELEGRAM_TOKEN or not CHANNEL_ID:
    print("Помилка: Не встановлено TELEGRAM_TOKEN або CHANNEL_ID.")
    exit()

# ----------------------------------------------------
# ФУНКЦІЯ ОТРИМАННЯ НОВИНИ (Приклад)
# ----------------------------------------------------

def get_latest_news() -> str:
    """Функція для отримання актуальної новини."""
    try:
        # ЗАМІНІТЬ ЦЕ НА РЕАЛЬНИЙ ПАРСИНГ АБО API ЗВІДКИ ВИ БЕРЕТЕ НОВИНИ
        response = requests.get("https://jsonplaceholder.typicode.com/posts/1")
        response.raise_for_status() # Перевірка на помилки HTTP
        data = response.json()
        
        title = data.get("title", "Новина без заголовка")
        body = data.get("body", "Деталі відсутні...")
        
        return f"📰 **Свіжа Новина (Автоматично):**\n\n**{title.capitalize()}**\n\n{body[:150]}..."
    except Exception as e:
        return f"Помилка при отриманні новини: {e}"

# ----------------------------------------------------
# ОСНОВНА ЛОГІКА БОТА
# ----------------------------------------------------

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обробляє команду /start для перевірки, чи бот живий."""
    await update.message.reply_text('Бот запущено! Планувальник працює у фоновому режимі.')

async def publish_job(bot: Bot) -> None:
    """Асинхронна функція для публікації новини."""
    news_text = get_latest_news()
    await bot.send_message(chat_id=CHANNEL_ID, text=news_text, parse_mode='Markdown')

def main() -> None:
    """Головна функція для запуску бота та планувальника."""
    
    # Створюємо екземпляр бота
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # Ініціалізуємо планувальник
    scheduler = AsyncIOScheduler()
    
    # Додаємо завдання: публікувати новину КОЖНІ 2 ГОДИНИ
    # 'application.bot' передається в publish_job для надсилання повідомлення
    scheduler.add_job(
        publish_job, 
        'interval', 
        hours=2, # <--- Ваш інтервал
        args=[application.bot]
    )
    
    # Додаємо обробник /start для перевірки
    application.add_handler(CommandHandler("start", start_command))

    # Запускаємо планувальник
    scheduler.start()
    
    print("Бот та планувальник запущено...")
    
    # Бот має продовжувати працювати, щоб планувальник міг виконувати завдання
    application.run_polling(poll_interval=3)

if __name__ == '__main__':
    main()
  
