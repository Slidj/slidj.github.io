import os
import requests
import json
from flask import Flask
import random 
import datetime 
import re 

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY") 

# URL API
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"
NEWSDATA_URL = "https://newsdata.io/api/1/news"

NEWS_TEMPLATE = None
MARKDOWN_CHARS = r'_*[]()~`>#+-=|{}.!' # Символи, які MarkdownV2 вимагає екранувати

# ----------------------------------------------------
# 2. ФУНКЦІЇ ФОРМАТУВАННЯ ТА ЗАВАНТАЖЕННЯ ШАБЛОНУ
# ----------------------------------------------------

def escape_markdown(text):
    """Екранує спеціальні символи MarkdownV2, крім тих, що використовуються для форматування."""
    if text is None:
        return ""
    text = str(text)
    
    # Екрануємо кожен спеціальний символ
    for char in MARKDOWN_CHARS:
        text = text.replace(char, f'\\{char}')
        
    return text

def _load_template(file_path="templates/news_template.txt"):
    """Завантажує шаблон з файлу в папці templates/."""
    global NEWS_TEMPLATE
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            NEWS_TEMPLATE = f.read()
            print(f"Шаблон '{file_path}' успішно завантажено.")
    except FileNotFoundError:
        # ... (Резервний шаблон залишається незмінним, як у попередній версії)
        print(f"Помилка: Файл шаблону '{file_path}' не знайдено.")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "Джерело: {{source}}\n"
            "Посилання: {{url}}"
        )
    except Exception as e:
        print(f"Помилка при читанні шаблону: {e}")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "Джерело: {{source}}\n"
            "Посилання: {{url}}"
        )

# ----------------------------------------------------
# 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API
# ----------------------------------------------------

def _process_article(article, title_prefix, source_key, url_key, image_key=None):
    """Обробляє та форматує статтю, незалежно від джерела API."""
    if NEWS_TEMPLATE is None:
        _load_template()

    # Отримуємо дані
    title = article.get("title", "Без заголовка")
    source = article.get(source_key, {}).get("name", "Невідоме джерело") if isinstance(article.get(source_key), dict) else article.get(source_key, "Невідоме джерело")
    url = article.get(url_key, "#") 
    image_url = article.get(image_key) if image_key else None
    
    # Очищуємо від HTML
    title = re.sub('<[^<]+?>', '', title if title else "")
    source = re.sub('<[^<]+?>', '', source if source else "")
    
    # ЕКРАНУВАННЯ: Екрануємо текст перед вставкою, щоб він був безпечним для MarkdownV2
    safe_title = escape_markdown(title)
    safe_source = escape_markdown(source)
    safe_url = escape_markdown(url) 
    safe_title_prefix = escape_markdown(title_prefix)
    safe_time = escape_markdown(datetime.datetime.now().strftime("%d\\.%m\\.%Y %H\\:%M")) # Екрануємо : та .
    
    # Створюємо caption з використанням завантаженого шаблону
    caption = NEWS_TEMPLATE.replace('{{title_prefix}}', safe_title_prefix)
    caption = caption.replace('{{current_time}}', safe_time)
    caption = caption.replace('{{title}}', safe_title)
    caption = caption.replace('{{source}}', safe_source)
    caption = caption.replace('{{url}}', safe_url)
    
    return {'caption': caption, 'image_url': image_url}


def _fetch_newsdata(title_prefix: str) -> dict | None:
    """Виконує запит до NewsData.io для УКРАЇНСЬКИХ НОВИН."""
    if not NEWSDATA_API_KEY:
        print("NEWSDATA_API_KEY не налаштовано.")
        return None
        
    params = {
        'apikey': NEWSDATA_API_KEY,
        'language': 'uk',
        'country': 'ua',
        'size': 5
    }
    
    try:
        response = requests.get(NEWSDATA_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'success' and data['results']:
            articles = data['results']
            random.shuffle(articles)
            
            for article in articles:
                if article.get("title") and article.get("link"):
                    return _process_article(
                        article, 
                        title_prefix, 
                        source_key='source_id', 
                        url_key='link', 
                        image_key='image_url'
                    )
            return None
        return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsData.io Connection Error: {e}")
        return None

def _fetch_newsapi(params: dict, title_prefix: str) -> dict | None:
    """Виконує запит до NewsAPI (для Fallback на глобальні новини)."""
    if not NEWS_API_KEY:
        print("NEWS_API_KEY не налаштовано.")
        return None
        
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 5 
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            
            articles = data['articles']
            random.shuffle(articles) 
            
            for article in articles:
                if article.get("title") and article.get("url") and article.get("title") != "[Removed]":
                    return _process_article(
                        article, 
                        title_prefix, 
                        source_key='source', 
                        url_key='url', 
                        image_key='urlToImage'
                    )
            return None
        return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI Connection Error: {e}")
        return None


def get_latest_news() -> dict | None:
    """Спочатку спроба NewsData.io, потім Fallback на NewsAPI."""
    
    news_data = _fetch_newsdata("Свіжа Новина з України")
    if news_data:
        return news_data

    print("FALLBACK 1: NewsData.io failed. Trying NewsAPI global English news...")
    
    global_params = {'language': 'en', 'category': 'general'}
    news_data = _fetch_newsapi(global_params, "Світова Новина") 
    
    return news_data

# ----------------------------------------------------
# 4. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

app = Flask(__name__)

def _send_text_message(text_content):
    """Надсилає повідомлення як MarkdownV2 ( sendMessage )."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
        'parse_mode': 'MarkdownV2' # Активовано MarkdownV2
    }
    
    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
        print("Fallback to sendMessage (MarkdownV2) successful.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Final Telegram send error (sendMessage): {e}")
        return False

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY, NEWSDATA_API_KEY]):
        print("Error: Missing one of the required environment variables.")
        return "Error: Missing environment variables.", 500

    news_data = get_latest_news()
    
    if not news_data:
        print("Final result: No news found after all attempts. Exiting gracefully.")
        return "No news found after all attempts.", 200

    caption = news_data.get('caption', "")
    image_url = news_data.get('image_url')
    
    # -------------------------------------------------------------------------
    # 1. СПРОБА #1: SENDPHOTO (MarkdownV2)
    # -------------------------------------------------------------------------
    
    if image_url:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        photo_payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url,
            'caption': caption,
            'parse_mode': 'MarkdownV2' # Активовано MarkdownV2
        }
        
        try:
            telegram_response = requests.post(telegram_photo_url, data=photo_payload)
            telegram_response.raise_for_status() 
            
            print("Публікація sendPhoto (MarkdownV2) успішна.")
            return "News published successfully (with photo, MarkdownV2)!", 200
            
        except requests.exceptions.RequestException as e:
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
    
    # -------------------------------------------------------------------------
    # 2. СПРОБА #2: FALLBACK НА SENDMESSAGE (MarkdownV2)
    # -------------------------------------------------------------------------
    
    if _send_text_message(caption):
        return "News published successfully (fallback to text only, MarkdownV2)!", 200
    else:
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    _load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
