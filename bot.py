import os
import requests
import json
from flask import Flask

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
# ВАЖЛИВО: os.getenv() приймає лише НАЗВУ ЗМІННОЇ, а не її значення.
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# URL Telegram API для надсилання повідомлень
TELEGRAM_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

app = Flask(__name__)

# ----------------------------------------------------
# 2. ФУНКЦІЯ ОТРИМАННЯ НОВИНИ (ВИПРАВЛЕНО ДЛЯ ДІАГНОСТИКИ)
# ----------------------------------------------------

def get_latest_news() -> str:
    """Отримує одну свіжу новину з NewsAPI (тимчасово розширено критерії)."""
    params = {
        'apiKey': NEWS_API_KEY,
        # ТИМЧАСОВА ДІАГНОСТИКА: Прибираємо 'ua' та 'general' для перевірки ключа.
        # Якщо з'являється світова новина, ключ працює, а проблема в контенті.
        'language': 'en', # Додаємо 'en' для більшої ймовірності отримати результат
        'pageSize': 1
    }
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            article = data['articles'][0]
            title = article.get("title", "Без заголовка")
            source = article.get("source", {}).get("name", "Невідоме джерело")
            url = article.get("url", "#")
            
            return (
                f"📰 **Свіжа Новина (Діагностика)**\n\n"
                f"**{title}**\n\n"
                f"Джерело: {source}\n"
                f"[Читати повністю]({url})"
            )
        else:
            # Новий вивід у лог, щоб зрозуміти, чому немає новин (наприклад, перевищено ліміт)
            print(f"Помилка NewsAPI (не знайдено статей) або пуста відповідь: {data.get('code')}")
            return None # Повертаємо None, якщо новин немає
            
    except requests.exceptions.RequestException as e:
        print(f"Помилка з'єднання з NewsAPI (можливо, недійсний ключ API або мережева помилка): {e}")
        return None
    except Exception as e:
        print(f"Загальна помилка при обробці новини: {e}")
        return None

# ----------------------------------------------------
# 3. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

# Ця функція викликається, коли UptimeRobot відправляє запит на /publish
@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    # Діагностичний код залишаємо для виявлення відсутнього ключа:
    if not TELEGRAM_TOKEN:
        return "Error: Missing TELEGRAM_TOKEN.", 500
    if not CHANNEL_ID:
        return "Error: Missing CHANNEL_ID.", 500
    if not NEWS_API_KEY:
        return "Error: Missing NEWS_API_KEY.", 500

    news_text = get_latest_news()
    
    if not news_text:
        return "No news found or API error.", 200

    # Надсилання повідомлення через прямий HTTP-запит до Telegram API
    payload = {
        'chat_id': CHANNEL_ID,
        'text': news_text,
        'parse_mode': 'Markdown'
    }

    try:
        telegram_response = requests.post(TELEGRAM_URL, data=payload)
        telegram_response.raise_for_status() 
        
        print(f"Публікація успішна. Статус Telegram: {telegram_response.status_code}")
        return "News published successfully!", 200
    except requests.exceptions.RequestException as e:
        print(f"Помилка відправки в Telegram: {e}")
        return "Telegram sending failed.", 500

# Ця функція, щоб Render перевіряв, чи сервіс живий
@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    # Flask буде запускатися на порту, який надає Render
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
  
