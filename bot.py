import os
import requests
import json
from flask import Flask

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# URL Telegram API для надсилання повідомлень
TELEGRAM_URL = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

app = Flask(__name__)

# ----------------------------------------------------
# 2. ФУНКЦІЇ ОТРИМАННЯ НОВИНИ (З РЕЗЕРВУВАННЯМ)
# ----------------------------------------------------

def _fetch_news(params: dict, title_prefix: str) -> str | None:
    """Внутрішня функція для виконання запиту до NewsAPI."""
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 1
    
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
                f"📰 **{title_prefix}**\n\n"
                f"**{title}**\n\n"
                f"Джерело: {source}\n"
                f"[Читати повністю]({url})"
            )
        else:
            # Виведення коду помилки API у лог, якщо немає статей
            print(f"NewsAPI Error/No Articles: {data.get('code')}. Params: {params}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI Connection Error: {e}")
        return None
    except Exception as e:
        print(f"General Error processing news: {e}")
        return None

def get_latest_news() -> str | None:
    """
    Спроба отримати новину по Україні. 
    Якщо не вдається, робить резервний запит на світову новину англійською.
    """
    # 1. Спроба отримати українську новину
    ukraine_params = {
        'country': 'ua', 
        'category': 'general',
    }
    news_text = _fetch_news(ukraine_params, "Свіжа Новина з України")
    
    if news_text:
        return news_text

    # 2. РЕЗЕРВ: Якщо українських новин немає, шукаємо світову англійською
    print("FALLBACK: No Ukrainian news found. Trying global English news...")
    global_params = {
        'language': 'en',
        'category': 'general',
    }
    news_text = _fetch_news(global_params, "Світова Новина (Резерв)")
    
    return news_text


# ----------------------------------------------------
# 3. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

# Ця функція викликається, коли UptimeRobot відправляє запит на /publish
@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    # Перевірка наявності змінних середовища
    if not TELEGRAM_TOKEN:
        return "Error: Missing TELEGRAM_TOKEN.", 500
    if not CHANNEL_ID:
        return "Error: Missing CHANNEL_ID.", 500
    if not NEWS_API_KEY:
        return "Error: Missing NEWS_API_KEY.", 500

    news_text = get_latest_news()
    
    if not news_text:
        # Тепер ця помилка означає, що не вдалося знайти НІ українських, НІ світових новин
        return "No news found or API error (after fallback attempt).", 200

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
