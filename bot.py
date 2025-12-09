import os
import requests
import asyncio
from telegram import Bot
from telegram.ext import Application, CommandHandler, ContextTypes
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# 1. Змінні середовища (ТОКЕН ТА ID КАНАЛУ + НОВИЙ КЛЮЧ API)
TELEGRAM_TOKEN = os.getenv("8554883873:AAHOUd8cHiOBNWUuyQxbg4ncAeM1QwvbumY") 
CHANNEL_ID = os.getenv("@you_broadcast") 
# !!! НОВИЙ КЛЮЧ !!!
NEWS_API_KEY = os.getenv("0d5a50de5cc3459891cdf8494ab3d236") 

if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY]):
    print("Помилка: Не встановлено один із необхідних ключів (TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY).")
    exit()

# URL та параметри для NewsAPI.org
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

# ----------------------------------------------------
# ФУНКЦІЯ ОТРИМАННЯ НОВИНИ З NEWSAPI
# ----------------------------------------------------

def get_latest_news() -> str:
    """Отримує одну свіжу новину з NewsAPI (з України)"""
    
    # Параметри запиту до API:
    # - country=ua (новини з України)
    # - category=general (загальні новини)
    # - pageSize=1 (беремо лише одну найсвіжішу новину)
    params = {
        'apiKey': NEWS_API_KEY,
        'country': 'ua',
        'category': 'general',
        'pageSize': 1
    }
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status() # Викличе виняток для кодів 4xx/5xx
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            article = data['articles'][0]
            
            title = article.get("title", "Без заголовка")
            source = article.get("source", {}).get("name", "Невідоме джерело")
            url = article.get("url", "#")
            
            # Форматування тексту для Telegram (використовуємо Markdown)
            news_text = (
                f"📰 **Свіжа Новина з України**\n\n"
                f"**{title}**\n\n"
                f"Джерело: {source}\n"
                f"[Читати повністю]({url})"
            )
            return news_text
        else:
            return "Не вдалося отримати новини або список статей порожній."
            
    except requests.exceptions.RequestException as e:
        return f"Помилка з'єднання з NewsAPI: {e}"
    except Exception as e:
        return f"Загальна помилка при обробці новини: {e}"

# ----------------------------------------------------
# ОСНОВНА ЛОГІКА БОТА ТА ПЛАНУВАЛЬНИК (Залишається без змін)
# ----------------------------------------------------

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обробляє команду /start."""
    await update.message.reply_text('Бот запущено! Планувальник працює у фоновому режимі.')

async def publish_job(bot: Bot) -> None:
    """Асинхронна функція для публікації новини."""
    news_text = get_latest_news()
    # parse_mode='Markdown' дозволяє відображати посилання та жирний текст
    await bot.send_message(chat_id=CHANNEL_ID, text=news_text, parse_mode='Markdown')

def main() -> None:
    """Головна функція для запуску бота та планувальника."""
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    scheduler = AsyncIOScheduler()
    
    # Додаємо завдання: публікувати новину КОЖНІ 2 ГОДИНИ
    scheduler.add_job(
        publish_job, 
        'interval', 
        hours=2, # <--- Ваш інтервал
        args=[application.bot]
    )
    
    application.add_handler(CommandHandler("start", start_command))

    scheduler.start()
    print("Бот та планувальник запущено...")
    
    # Запускаємо опитування
    application.run_polling(poll_interval=3)

if __name__ == '__main__':
    main()
  
