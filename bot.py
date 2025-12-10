import os
import requests
import json
from flask import Flask
import random 
import datetime 
import re 
from collections import deque # Використовуємо deque для ефективного кешування

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY") 

# URL API
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"
NEWSDATA_URL = "https://newsdata.io/api/1/news"

NEWS_TEMPLATE = None

# *** НОВЕ: КЕШУВАННЯ ДЛЯ ДЕДУПЛІКАЦІЇ ***
# Deque - це двостороння черга. Коли вона заповнена, при додаванні нового елемента 
# автоматично видаляється найстаріший.
PUBLISHED_TITLES = deque(maxlen=20) 
# ----------------------------------------------------
# 2. ФУНКЦІЇ ЗАВАНТАЖЕННЯ ШАБЛОНУ ТА ОЧИЩЕННЯ
# ----------------------------------------------------

def _load_template(file_path="templates/news_template.txt"):
    """Завантажує шаблон з файлу в папці templates/."""
    global NEWS_TEMPLATE
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            NEWS_TEMPLATE = f.read()
    except FileNotFoundError:
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "{{description}}\n"
            "📰 Джерело: {{source}}\n"
        )
    except Exception as e:
        print(f"Помилка при читанні шаблону: {e}")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "ЗАГОЛОВОК: {{title}}\n"
            "{{description}}\n"
            "📰 Джерело: {{source}}\n"
        )

def _clean_text(text):
    """Виконує очищення тексту від HTML, надлишкових URL та пробілів."""
    if text is None:
        return ""
    
    # 1. Видалення HTML-тегів (вже було, але важливо)
    cleaned_text = re.sub('<[^<]+?>', '', text)
    
    # 2. Видалення URL-адрес з тексту (залишаємо URL лише для кнопки)
    url_pattern = r'https?://\S+|www\.\S+'
    cleaned_text = re.sub(url_pattern, '', cleaned_text)
    
    # 3. Видалення зайвих символів, наприклад, квадратних дужок [Removed]
    cleaned_text = cleaned_text.replace('[Removed]', '')
    
    # 4. Прибирання зайвих пробілів та порожніх рядків
    cleaned_text = '\n'.join(line.strip() for line in cleaned_text.splitlines() if line.strip())
    
    return cleaned_text.strip()


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
    
    # Очищуємо всі текстові поля
    safe_title = _clean_text(title)
    safe_source = _clean_text(source)
    safe_description = _clean_text(description) 
    
    # *** НОВЕ: ПЕРЕВІРКА ДУБЛІКАТІВ ТА КЕШУВАННЯ ***
    if safe_title in PUBLISHED_TITLES:
        print(f"Skipping duplicate title: {safe_title}")
        return None # Пропускаємо цю статтю
        
    PUBLISHED_TITLES.append(safe_title) # Додаємо новий заголовок до кешу
    
    safe_title_prefix = title_prefix
    safe_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M") 
    
    # Створюємо caption з використанням завантаженого шаблону
    caption = NEWS_TEMPLATE.replace('{{title_prefix}}', safe_title_prefix)
    caption = caption.replace('{{current_time}}', safe_time)
    caption = caption.replace('{{title}}', safe_title)
    caption = caption.replace('{{source}}', safe_source)
    caption = caption.replace('{{description}}', safe_description) 
    # {{url}} видалено з шаблону, оскільки ми його винесли в кнопку
    
    return {'caption': caption, 'image_url': image_url, 'url': url}


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
            
            # Обробляємо всі отримані статті, доки не знайдемо НЕ-ДУБЛІКАТ
            for article in articles:
                result = _process_article(
                    article, 
                    title_prefix, 
                    source_key='source_id', 
                    url_key='link', 
                    image_key='image_url',
                    description_key='description' 
                )
                if result:
                    return result
            return None # Усі статті були дублікатами
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
            
            # Обробляємо всі отримані статті, доки не знайдемо НЕ-ДУБЛІКАТ
            for article in articles:
                result = _process_article(
                    article, 
                    title_prefix, 
                    source_key='source', 
                    url_key='url', 
                    image_key='urlToImage',
                    description_key='description' 
                )
                if result:
                    return result
            return None # Усі статті були дублікатами
        return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI Connection Error: {e}")
        return None


def get_latest_news() -> dict | None:
    # ... (залишається без змін)
    
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
    # повертаємо JSON-рядок
    return json.dumps(keyboard)

def _send_text_message(text_content, url):
    """Надсилає повідомлення як Чистий Текст ( sendMessage ) з кнопкою."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    keyboard = _create_inline_keyboard(url)

    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
        'reply_markup': keyboard # Додаємо кнопки
    }
    
    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
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
        return "No news found after all attempts or all were duplicates.", 200 # Оновлений текст

    caption = news_data.get('caption', "")
    image_url = news_data.get('image_url')
    article_url = news_data.get('url') # Отримуємо URL статті
    
    keyboard = _create_inline_keyboard(article_url)
    
    # -------------------------------------------------------------------------
    # 1. СПРОБА #1: SENDPHOTO (Plain Text)
    # -------------------------------------------------------------------------
    
    if image_url:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        photo_payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url,
            'caption': caption,
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
    
    if _send_text_message(caption, article_url): 
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
