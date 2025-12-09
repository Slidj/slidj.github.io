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

# ----------------------------------------------------
# 2. ФУНКЦІЇ ОТРИМАННЯ НОВИНИ (З ЗОБРАЖЕННЯМИ ТА РЕЗЕРВУВАННЯМ)
# ----------------------------------------------------

def _fetch_news(params: dict, title_prefix: str) -> dict | None:
    """Внутрішня функція для виконання запиту до NewsAPI та формування даних для публікації."""
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 5  # Запитуємо 5 статей для випадкового вибору
    
    # URL NewsAPI для топових заголовків
    NEWS_API_URL = "https://newsapi.org/v2/top-headlines"
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            
            # ВИБИРАЄМО ВИПАДКОВУ СТАТТЮ
            article = random.choice(data['articles']) 
            
            title = article.get("title", "Без заголовка")
            source = article.get("source", {}).get("name", "Невідоме джерело")
            url = article.get("url", "#")
            # <--- ВИЙМАЄМО URL ЗОБРАЖЕННЯ ДЛЯ sendPhoto
            image_url = article.get("urlToImage") 
            
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            
            # HTML-ФОРМАТУВАННЯ ДЛЯ ПІДПИСУ (CAPTION)
            caption = (
                f"<b>📢 {title_prefix}</b> | <i>{current_time}</i>\n" 
                f"__________________________\n" 
                f"<b>{title}</b>\n\n" 
                f"<i>🔎 Джерело: {source}</i>" 
                f"\n\n<a href='{url}'>➡️ Читати повністю на сайті</a>" 
                f"\n__________________________"
            )

            # ПОВЕРТАЄМО СЛОВНИК З ТЕКСТОМ ТА ЗОБРАЖЕННЯМ
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
    """
    Спроба отримати новину по Україні. 
    Якщо не вдається, робить резервний запит на світову новину англійською.
    """
    # 1. Спроба отримати українську новину
    ukraine_params = {
        'country': 'ua', 
        'category': 'general',
    }
    news_data = _fetch_news(ukraine_params, "Свіжа Новина з України")
    
    if news_data:
        return news_data

    # 2. РЕЗЕРВ: Якщо українських новин немає, шукаємо світову англійською
    print("FALLBACK: No Ukrainian news found. Trying global English news...")
    global_params = {
        'language': 'en',
        'category': 'general',
    }
    # Тут прибрано "(Резерв)"
    news_data = _fetch_news(global_params, "Світова Новина") 
    
    return news_data

# ----------------------------------------------------
# 3. ОСНОВНА ЛОГІКА ПУБЛІКАЦІЇ ТА WEB SERVICE
# ----------------------------------------------------

app = Flask(__name__)

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    if not TELEGRAM_TOKEN:
        return "Error: Missing TELEGRAM_TOKEN.", 500
    if not CHANNEL_ID:
        return "Error: Missing CHANNEL_ID.", 500
    if not NEWS_API_KEY:
        return "Error: Missing NEWS_API_KEY.", 500

    news_data = get_latest_news()
    
    if not news_data:
        return "No news found or API error (after fallback attempt).", 200

    # ВИЗНАЧАЄМО МЕТОД: sendPhoto чи sendMessage
    image_url = news_data.get('image_url')
    caption = news_data.get('caption')
    
    if image_url:
        # 1. МЕТОД SENDPHOTO (ЗІ ЗОБРАЖЕННЯМ)
        telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url, # URL ЗОБРАЖЕННЯ
            'caption': caption, # ТЕКСТ (caption)
            'parse_mode': 'HTML'
        }
    else:
        # 2. МЕТОД SENDMESSAGE (РЕЗЕРВНИЙ, ТІЛЬКИ ТЕКСТ)
        telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        payload = {
            'chat_id': CHANNEL_ID,
            'text': caption, # ТЕКСТ (text)
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
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
