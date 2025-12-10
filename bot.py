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

# URL API
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"

# 2. ВБУДОВАНИЙ ШАБЛОН (ЧИСТИЙ ТЕКСТ)
NEWS_TEMPLATE = (
    "📢 {{title_prefix}} | {{current_time}}\n"
    "--------------------------\n"
    "ЗАГОЛОВОК: {{title}}\n"
    "🔎 Джерело: {{source}}\n"
    "➡️ Посилання: {{url}}\n"
    "--------------------------"
)

# ----------------------------------------------------
# 3. ДОПОМІЖНІ ТА ОСНОВНІ ФУНКЦІЇ
# ----------------------------------------------------

# Функція escape_html більше не потрібна, оскільки ми використовуємо чистий текст

def _fetch_news(params: dict, title_prefix: str) -> dict | None:
    """Виконує запит до NewsAPI та знаходить першу придатну статтю, повертаючи URL зображення."""
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 5 
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            
            article = None
            articles = data['articles']
            random.shuffle(articles) 
            
            for art in articles:
                title = art.get("title")
                url = art.get("url")
                
                if title and url and title != "[Removed]":
                    article = art
                    break 
            
            if not article:
                print("No suitable articles found after filtering.")
                return None
            
            # --- Формування даних для публікації ---
            
            title = article.get("title", "Без заголовка")
            source = article.get("source", {}).get("name", "Невідоме джерело")
            
            # Очищуємо від будь-якого HTML для чистого тексту
            title = re.sub('<[^<]+?>', '', title)
            source = re.sub('<[^<]+?>', '', source)
            
            url = article.get("url", "#") 
            image_url = article.get("urlToImage") # Повертаємо URL зображення
            
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            
            # Створюємо caption
            caption = NEWS_TEMPLATE.replace('{{title_prefix}}', title_prefix)
            caption = caption.replace('{{current_time}}', current_time)
            caption = caption.replace('{{title}}', title)
            caption = caption.replace('{{source}}', source)
            caption = caption.replace('{{url}}', url)
            
            return {
                'caption': caption,
                'image_url': image_url  # Повертаємо URL зображення
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
    """Спроба України, потім резерв світової новини."""
    ukraine_params = {'country': 'ua', 'category': 'general'}
    news_data = _fetch_news(ukraine_params, "Свіжа Новина з України")
    
    if news_data:
        return news_data

    print("FALLBACK: No Ukrainian news found. Trying global English news...")
    global_params = {'language': 'en', 'category': 'general'}
    news_data = _fetch_news(global_params, "Світова Новина") 
    
    return news_data

# ----------------------------------------------------
# 4. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

app = Flask(__name__)

def _send_text_message(text_content):
    """Надсилає повідомлення як чистий текст ( sendMessage )."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
        # parse_mode ВИДАЛЕНО
    }
    
    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
        print("Fallback to sendMessage (plain text) successful.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Final Telegram send error (sendMessage): {e}")
        return False

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY]):
        return "Error: Missing environment variables.", 500

    news_data = get_latest_news()
    
    if not news_data:
        print("Final result: No news found after all attempts. Exiting gracefully.")
        return "No news found after all attempts.", 200

    caption = news_data.get('caption', "")
    image_url = news_data.get('image_url')
    
    # -------------------------------------------------------------------------
    # 1. СПРОБА #1: SENDPHOTO (без HTML)
    # -------------------------------------------------------------------------
    
    if image_url:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        photo_payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url,
            'caption': caption,
            # parse_mode ВИДАЛЕНО
        }
        
        try:
            telegram_response = requests.post(telegram_photo_url, data=photo_payload)
            telegram_response.raise_for_status() 
            
            print("Публікація sendPhoto (plain text) успішна.")
            return "News published successfully (with photo, plain text)!", 200
            
        except requests.exceptions.RequestException as e:
            # Якщо sendPhoto не спрацював, переходимо до Fallback
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
            # Продовжуємо до наступного блоку (Fallback)

    else:
        print("Image URL missing. Falling back to sendMessage...")
        # Продовжуємо до наступного блоку (Fallback)

    # -------------------------------------------------------------------------
    # 2. СПРОБА #2: FALLBACK НА SENDMESSAGE (Тільки чистий текст)
    # -------------------------------------------------------------------------
    
    if _send_text_message(caption):
        return "News published successfully (fallback to text only)!", 200
    else:
        # Повертаємо 200 OK
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
