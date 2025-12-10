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

# 2. ВБУДОВАНИЙ ШАБЛОН (Надійний HTML)
NEWS_TEMPLATE = (
    "📢 <b>{{title_prefix}}</b> | <i>{{current_time}}</i>\n"
    "--------------------------\n"
    "<b>{{title}}</b>\n"
    "<i>🔎 Джерело: {{source}}</i>\n"
    "<a href='{{url}}'>➡️ Читати повністю</a>\n"
    "--------------------------"
)

# ----------------------------------------------------
# 3. ДОПОМІЖНІ ТА ОСНОВНІ ФУНКЦІЇ
# ----------------------------------------------------

def escape_html(text):
    """
    Екранує символи <, > та & для безпечного використання 
    в HTML-режимі Telegram.
    """
    if text is None:
        return ""
    # Порядок важливий: спочатку &
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

def _fetch_news(params: dict, title_prefix: str) -> dict | None:
    """Виконує запит до NewsAPI та знаходить першу придатну статтю."""
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
            
            # ЕКРАНУЄМО СПЕЦІАЛЬНІ СИМВОЛИ ДЛЯ БЕЗПЕКИ HTML
            title = escape_html(article.get("title", "Без заголовка"))
            source = escape_html(article.get("source", {}).get("name", "Невідоме джерело"))
            
            url = article.get("url", "#") 
            
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            
            # Створюємо caption з безпечними (екранованими) даними
            caption = NEWS_TEMPLATE.replace('{{title_prefix}}', title_prefix)
            caption = caption.replace('{{current_time}}', current_time)
            caption = caption.replace('{{title}}', title)
            caption = caption.replace('{{source}}', source)
            caption = caption.replace('{{url}}', url)
            
            return {
                'caption': caption
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

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY]):
        return "Error: Missing environment variables.", 500

    news_data = get_latest_news()
    
    # Вихід, якщо новин не знайдено
    if not news_data:
        print("Final result: No news found after all attempts. Exiting gracefully.")
        return "No news found after all attempts.", 200

    caption = news_data.get('caption', "")
    
    # --- ВИКОРИСТОВУЄМО ТІЛЬКИ sendMessage З HTML ---
    
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    # Перетворюємо '\n' на HTML-переноси <br>
    html_content = caption.replace('\n', '<br>')
    
    payload = {
        'chat_id': CHANNEL_ID,
        'text': html_content, 
        'parse_mode': 'HTML' 
    }
    
    try:
        telegram_response = requests.post(telegram_publish_url, data=payload)
        telegram_response.raise_for_status()
        
        print("Публікація sendMessage успішна.")
        return "News published successfully (text only)!", 200
        
    except requests.exceptions.RequestException as e:
        # Повертаємо 200 OK, навіть якщо Telegram відхилив запит (400)
        print(f"Final Telegram send error (sendMessage): {e}")
        return "Telegram final send failed. Check token/channel ID.", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
