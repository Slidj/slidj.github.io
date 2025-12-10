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

# Змінні для шаблону
NEWS_TEMPLATE = ""
TEMPLATE_FILE = "templates/news_template.html"

# ----------------------------------------------------
# 2. ДОПОМІЖНІ ФУНКЦІЇ
# ----------------------------------------------------

def load_template():
    """
    Функція для завантаження шаблону з файлу. 
    Посилена перевірка: якщо файл порожній або відсутній, використовується вбудований резерв.
    """
    global NEWS_TEMPLATE
    
    # Вбудований резервний шаблон (безпечний, чистий текст)
    FALLBACK_TEMPLATE = (
        "Сьогоднішня Новина: {{title_prefix}}\n"
        "Час публікації: {{current_time}}\n"
        "\n"
        "Заголовок: {{title}}\n"
        "Джерело: {{source}}\n"
        "Повне посилання: {{url}}\n"
    )

    try:
        with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
            template_content = f.read().strip()
            
        if template_content:
            NEWS_TEMPLATE = template_content
            print(f"Template loaded successfully from {TEMPLATE_FILE}")
        else:
            # Якщо файл знайдено, але він порожній
            NEWS_TEMPLATE = FALLBACK_TEMPLATE
            print(f"Template file {TEMPLATE_FILE} is empty. Using fallback template.")

    except FileNotFoundError:
        NEWS_TEMPLATE = FALLBACK_TEMPLATE
        print(f"Error: Template file not found at {TEMPLATE_FILE}. Using fallback template.")
    except Exception as e:
        NEWS_TEMPLATE = FALLBACK_TEMPLATE
        print(f"Error loading template: {e}. Using fallback template.")

def escape_html(text):
    """Екранування тут залишаємо для загальної безпеки, хоча ми видаляємо HTML-теги пізніше."""
    if text is None:
        return ""
    text = text.replace('&', '&amp;')
    text = text.replace('<', '&lt;')
    text = text.replace('>', '&gt;')
    return text

# ----------------------------------------------------
# 3. ФУНКЦІЇ ОТРИМАННЯ НОВИНИ
# ----------------------------------------------------

def _fetch_news(params: dict, title_prefix: str) -> dict | None:
    """Виконує запит до NewsAPI та знаходить першу придатну статтю."""
    params['apiKey'] = NEWS_API_KEY
    params['pageSize'] = 5 
    
    try:
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'ok' and data['articles']:
            
            # Логіка уникнення дублікатів
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
            
            # Не екрануємо, оскільки ми перетворимо все на чистий текст
            title = article.get("title", "Без заголовка")
            source = article.get("source", {}).get("name", "Невідоме джерело")
            url = article.get("url", "#") 
            
            current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
            
            # ВИКОРИСТАННЯ ШАБЛОНУ (або завантаженого, або резервного)
            caption = NEWS_TEMPLATE.replace('{{title_prefix}}', title_prefix)
            caption = caption.replace('{{current_time}}', current_time)
            caption = caption.replace('{{title}}', title)
            caption = caption.replace('{{source}}', source)
            caption = caption.replace('{{url}}', url)
            
            return {'caption': caption}
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
    
    # 🌟 Вихід, якщо новин не знайдено (запобігає 500)
    if not news_data:
        print("Final result: No news found after all attempts. Exiting gracefully.")
        return "No news found after all attempts.", 200

    caption = news_data.get('caption', "")
    
    # --- ПЕРЕТВОРЕННЯ НА ЧИСТИЙ ТЕКСТ (УНИКНЕННЯ 400 BAD REQUEST) ---
    
    # 1. Замінюємо HTML-переноси (<br>) на звичайні переноси (\n)
    caption = caption.replace('<br>', '\n').replace('<BR>', '\n')
    # 2. Видаляємо всі інші HTML-теги (<...>). Це гарантує чистий текст!
    clean_text = re.sub('<[^<]+?>', '', caption)
    
    # Перевірка на випадок, якщо clean_text вийшов повністю порожнім
    if not clean_text.strip():
        clean_text = "Знайдено новину, але шаблон був порожнім. Перевірте templates/news_template.html"

    # --- ВИКОРИСТОВУЄМО ТІЛЬКИ sendMessage без parse_mode ---
    
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': CHANNEL_ID,
        'text': clean_text, 
    }

    try:
        telegram_response = requests.post(telegram_publish_url, data=payload)
        telegram_response.raise_for_status() 
        
        print(f"Публікація sendMessage успішна (чистий текст).")
        return "News published successfully (plain text guaranteed)!", 200
        
    except requests.exceptions.RequestException as e:
        # Повертаємо 200 OK, щоб UptimeRobot не скаржився, навіть якщо Telegram відхилив запит (400)
        print(f"Помилка відправки в Telegram (sendMessage): {e}")
        return f"Telegram sending failed. Error: {e}", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
