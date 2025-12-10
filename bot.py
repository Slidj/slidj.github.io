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

# ----------------------------------------------------
# 2. ФУНКЦІЇ ЗАВАНТАЖЕННЯ ШАБЛОНУ
# ----------------------------------------------------

def _load_template(file_path="templates/news_template.txt"):
    """Завантажує шаблон з файлу в папці templates/."""
    global NEWS_TEMPLATE
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            NEWS_TEMPLATE = f.read()
            print(f"Шаблон '{file_path}' успішно завантажено.")
    except FileNotFoundError:
        print(f"Помилка: Файл шаблону '{file_path}' не знайдено.")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "{{description}}\n"
            "📰 Джерело: {{source}}\n"
            "🔗 Посилання: {{url}}"
        )
    except Exception as e:
        print(f"Помилка при читанні шаблону: {e}")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "{{description}}\n"
            "📰 Джерело: {{source}}\n"
            "🔗 Посилання: {{url}}"
        )

# ----------------------------------------------------
# 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API
# ----------------------------------------------------

def _process_article(article, title_prefix, source_key, url_key, image_key=None, description_key='description'):
    """Обробляє та форматує статтю, незалежно від джерела API."""
    if NEWS_TEMPLATE is None:
        _load_template()

    # Отримуємо дані
    title = article.get("title", "Без заголовка")
    description = article.get(description_key)
    if not description:
        description = article.get('content', "Детальний опис відсутній.")
    
    source = article.get(source_key, {}).get("name", "Невідоме джерело") if isinstance(article.get(source_key), dict) else article.get(source_key, "Невідоме джерело")
    url = article.get(url_key, "#") 
    image_url = article.get(image_key) if image_key else None
    
    # Очищуємо від HTML
    title = re.sub('<[^<]+?>', '', title if title else "")
    source = re.sub('<[^<]+?>', '', source if source else "")
    description = re.sub('<[^<]+?>', '', description if description else "Детальний опис відсутній.")
    
    # *** ЧИСТИЙ ТЕКСТ: ВСЕ ЗАЛИШАЄТЬСЯ ЗВИЧАЙНИМ ***
    safe_title = title
    safe_source = source
    safe_url = url
    safe_description = description 
    safe_title_prefix = title_prefix
    safe_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M") 
    
    # Створюємо caption з використанням завантаженого шаблону
    caption = NEWS_TEMPLATE.replace('{{title_prefix}}', safe_title_prefix)
    caption = caption.replace('{{current_time}}', safe_time)
    caption = caption.replace('{{title}}', safe_title)
    caption = caption.replace('{{source}}', safe_source)
    caption = caption.replace('{{url}}', safe_url)
    caption = caption.replace('{{description}}', safe_description) 
    
    # Повертаємо URL окремо для кнопок
    return {'caption': caption, 'image_url': image_url, 'url': url} 


def _fetch_newsdata(title_prefix: str) -> dict | None:
    # ... (залишається без змін)
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
                        image_key='image_url',
                        description_key='description' 
                    )
            return None
        return None
    except requests.exceptions.RequestException as e:
        print(f"NewsData.io Connection Error: {e}")
        return None

def _fetch_newsapi(params: dict, title_prefix: str) -> dict | None:
    # ... (залишається без змін)
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
                        image_key='urlToImage',
                        description_key='description' 
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

# НОВА ДОПОМІЖНА ФУНКЦІЯ ДЛЯ СТВОРЕННЯ КНОПОК
def _create_inline_keyboard(url: str):
    """Створює JSON для inline-клавіатури з кнопкою посилання."""
    # Прибираємо посилання з тексту, оскільки тепер воно буде в кнопці
    # Важливо: використовуємо тільки одну кнопку в один ряд
    keyboard = {
        'inline_keyboard': [
            [
                {
                    'text': "➡️ Читати повністю",
                    'url': url
                }
            ]
        ]
    }
    return json.dumps(keyboard)

def _send_text_message(text_content, url):
    """Надсилає повідомлення як Чистий Текст ( sendMessage ) з кнопкою."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    # Видаляємо URL з кінця тексту, оскільки ми його винесемо в кнопку
    text_content_clean = re.sub(r'🔗 Посилання: .*$', '', text_content).strip()
    
    keyboard = _create_inline_keyboard(url)

    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content_clean, 
        'reply_markup': keyboard # Додаємо кнопки
    }
    
    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
        print("Fallback to sendMessage (Plain Text) with button successful.")
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
    article_url = news_data.get('url') # Отримуємо URL статті
    
    keyboard = _create_inline_keyboard(article_url)
    
    # Очищаємо текст від старого посилання (якщо воно там є), оскільки ми його виносимо в кнопку
    caption_clean = re.sub(r'🔗 Посилання: .*$', '', caption).strip()
    
    # -------------------------------------------------------------------------
    # 1. СПРОБА #1: SENDPHOTO (Plain Text)
    # -------------------------------------------------------------------------
    
    if image_url:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        photo_payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url,
            'caption': caption_clean,
            'reply_markup': keyboard # Додаємо кнопки
        }
        
        try:
            telegram_response = requests.post(telegram_photo_url, data=photo_payload)
            telegram_response.raise_for_status() 
            
            print("Публікація sendPhoto (Plain Text) з кнопкою успішна.")
            return "News published successfully (with photo and button)!", 200
            
        except requests.exceptions.RequestException as e:
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
    
    # -------------------------------------------------------------------------
    # 2. СПРОБА #2: FALLBACK НА SENDMESSAGE (Plain Text)
    # -------------------------------------------------------------------------
    
    if _send_text_message(caption, article_url): # Використовуємо _send_text_message, яка також додасть кнопки
        return "News published successfully (fallback to text only with button)!", 200
    else:
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    _load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
