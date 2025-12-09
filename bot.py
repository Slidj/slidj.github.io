import os
import requests
import json
from flask import Flask
import random 
import datetime 

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# URL API
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

# Змінні для шаблону
NEWS_TEMPLATE = ""
TEMPLATE_FILE = "templates/news_template.html"

# ----------------------------------------------------
# 2. ДОПОМІЖНІ ФУНКЦІЇ
# ----------------------------------------------------

def load_template():
    """Функція для завантаження шаблону з файлу."""
    global NEWS_TEMPLATE
    try:
        # Читаємо файл шаблону
        with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
            NEWS_TEMPLATE = f.read().strip()
        print(f"Template loaded successfully from {TEMPLATE_FILE}")
    except FileNotFoundError:
        print(f"Error: Template file not found at {TEMPLATE_FILE}. Using fallback template.")
        # Резервний шаблон на випадок помилки
        NEWS_TEMPLATE = (
            "<b>📢 {{title_prefix}}</b> | <i>{{current_time}}</i>\n"
            "__________________________\n"
            "<b>{{title}}</b>\n\n"
            "<i>🔎 Джерело: {{source}}</i>"
            "\n\n<a href='{{url}}'>➡️ Читати повністю</a>"
            "\n__________________________"
        )
    except Exception as e:
        print(f"Error loading template: {e}. Using fallback template.")
        NEWS_TEMPLATE = "" # Використовуємо пустий шаблон, щоб уникнути помилок

def escape_html(text):
    """Екранує символи <, > та & для безпечного використання в HTML-підписах (caption)."""
    if text is None:
        return ""
    # Екранування, щоб запобігти розриву HTML-парсера Telegram
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

# ----------------------------------------------------
# 3. ФУНКЦІЇ ОТРИМАННЯ НОВИНИ
# ----------------------------------------------------

def _fetch_news(params: dict, title_prefix: str) -> dict | None:
    """Виконує запит до NewsAPI, обробляє дані та формує словник для публікації."""
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 5  # Для випадкового вибору
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            
            article = random.choice(data['articles']) 
            
            # Екрануємо отримані дані, щоб вони не зламали HTML-форматування
            title = escape_html(article.get("title", "Без заголовка"))
            source = escape_html(article.get("source", {}).get("name", "Невідоме джерело"))
            url = article.get("url", "#") 
            image_url = article.get("urlToImage") 
            
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            
            # ВИКОРИСТАННЯ ЗОВНІШНЬОГО ШАБЛОНУ
            caption = NEWS_TEMPLATE.replace('{{title_prefix}}', title_prefix)
            caption = caption.replace('{{current_time}}', current_time)
            caption = caption.replace('{{title}}', title)
            caption = caption.replace('{{source}}', source)
            caption = caption.replace('{{url}}', url)
            
            return {
                'caption': caption,
                'image_url': image_url
            }
        else:
            print(f"NewsAPI Error/No Articles: {data.get('code')}. Params: {params}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI Connection Error: {e}")
        return None
    except Exception as e:
        print(f"General Error processing news: {e}")
        return None

def get_latest_news() -> dict | None:
    """Виконує головну логіку: спроба України, потім резерв світової новини."""
    # 1. Спроба отримати українську новину
    ukraine_params = {
        'country': 'ua', 
        'category': 'general',
    }
    news_data = _fetch_news(ukraine_params, "Свіжа Новина з України")
    
    if news_data:
        return news_data

    # 2. РЕЗЕРВ: Світова новина (назву змінено)
    print("FALLBACK: No Ukrainian news found. Trying global English news...")
    global_params = {
        'language': 'en',
        'category': 'general',
    }
    news_data = _fetch_news(global_params, "Світова Новина") 
    
    return news_data

# ----------------------------------------------------
# 4. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

app = Flask(__name__)

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    # Перевірка змінних середовища
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY]):
        return "Error: Missing environment variables.", 500

    news_data = get_latest_news()
    
    if not news_data:
        return "No news found or API error (after fallback attempt).", 200

    image_url = news_data.get('image_url')
    caption = news_data.get('caption')
    
    if image_url:
        # МЕТОД SENDPHOTO (ЗІ ЗОБРАЖЕННЯМ)
        telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url, 
            'caption': caption, # Підпис, що містить HTML
            'parse_mode': 'HTML'
        }
    else:
        # МЕТОД SENDMESSAGE (ТІЛЬКИ ТЕКСТ)
        telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        payload = {
            'chat_id': CHANNEL_ID,
            'text': caption, 
            'parse_mode': 'HTML'
        }

    try:
        telegram_response = requests.post(telegram_publish_url, data=payload)
        telegram_response.raise_for_status() 
        
        print(f"Публікація успішна. Статус Telegram: {telegram_response.status_code}")
        return "News published successfully!", 200
    except requests.exceptions.RequestException as e:
        print(f"Помилка відправки в Telegram: {e}")
        return "Telegram sending failed.", 500

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    # 1. Завантажуємо шаблон перед запуском Flask
    load_template() 
    # 2. Запускаємо Flask
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
