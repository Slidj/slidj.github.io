import os
import requests
import json
from flask import Flask

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("8554883873:AAHOUd8cHiOBNWUuyQxbg4ncAeM1QwvbumY")
CHANNEL_ID = os.getenv("@you_broadcast")
NEWS_API_KEY = os.getenv("0d5a50de5cc3459891cdf8494ab3d236")

# URL Telegram API для надсилання повідомлень
TELEGRAM_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

app = Flask(__name__)

# ----------------------------------------------------
# 2. ФУНКЦІЯ ОТРИМАННЯ НОВИНИ (МЕТОД БЕЗ ЗМІН)
# ----------------------------------------------------

def get_latest_news() -> str:
    """Отримує одну свіжу новину з NewsAPI."""
    params = {
        'apiKey': NEWS_API_KEY,
        'country': 'ua',
        'category': 'general',
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
                f"📰 **Свіжа Новина з України**\n\n"
                f"**{title}**\n\n"
                f"Джерело: {source}\n"
                f"[Читати повністю]({url})"
            )
        else:
            return None # Повертаємо None, якщо новин немає
            
    except requests.exceptions.RequestException as e:
        print(f"Помилка з'єднання з NewsAPI: {e}")
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
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY]):
        return "Error: Missing configuration keys.", 500

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
  
