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

# Словник для перетворення на жирний шрифт Unicode
# МИ ЗАСТОСУЄМО ЦЕ ТІЛЬКИ ДО СТАТИЧНИХ МІТОК ДЛЯ ГАРАНТІЇ ФОРМАТУВАННЯ
UNICODE_BOLD_MAP = {
    # Латиниця та цифри (повна підтримка)
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
    
    # Кириличні (часткова підтримка з аналогами, або використання кирилиці)
    # Зверніть увагу: ми використовуємо Bold A/B/C/H/K/M/O/T/X/Z та схожі символи для кращого візуального ефекту
    'А': '𝗔', 'Б': 'Б', 'В': '𝗕', 'Г': 'Г', 'Д': 'Д', 'Е': '𝗘', 'Є': 'Є', 'Ж': 'Ж', 'З': 'З', 'И': 'И', 'І': '𝗜', 'Ї': 'Ї', 'Й': 'Й', 'К': '𝗞', 'Л': 'Л', 'М': '𝗠', 'Н': '𝗛', 'О': '𝗢', 'П': '𝗣', 'Р': 'Р', 'С': '𝗖', 'Т': '𝗧', 'У': 'У', 'Ф': 'Ф', 'Х': '𝗫', 'Ц': 'Ц', 'Ч': 'Ч', 'Ш': 'Ш', 'Щ': 'Щ', 'Ь': 'Ь', 'Ю': 'Ю', 'Я': 'Я',
    'а': '𝗮', 'б': 'б', 'в': '𝗯', 'г': 'г', 'д': 'д', 'е': '𝗲', 'є': 'є', 'ж': 'ж', 'з': 'з', 'и': 'и', 'і': '𝗶', 'ї': 'ї', 'й': 'й', 'к': '𝗸', 'л': 'л', 'м': '𝗺', 'н': '𝗵', 'о': '𝗼', 'п': '𝗽', 'р': 'р', 'с': '𝗰', 'т': '𝘁', 'у': 'у', 'ф': 'ф', 'х': '𝘅', 'ц': 'ц', 'ч': 'ч', 'ш': 'ш', 'щ': 'щ', 'ь': 'ь', 'ю': 'ю', 'я': 'я',
    
    # Інші символи
    ':': ':', '!': '!', '?': '?', ' ': ' '
}

# ----------------------------------------------------
# 2. ФУНКЦІЇ ФОРМАТУВАННЯ ТА ЗАВАНТАЖЕННЯ ШАБЛОНУ
# ----------------------------------------------------

def bold_unicode(text):
    """Конвертує текст у жирний шрифт Unicode."""
    if text is None:
        return ""
    # Використовуємо .upper() тільки для статичних міток, щоб уникнути проблеми з малими/великими літерами в кирилиці, 
    # коли викликаємо функцію. Для заголовків залишимо як є.
    return ''.join(UNICODE_BOLD_MAP.get(c, c) for c in text)


def _load_template(file_path="templates/news_template.txt"):
    # ... (Залишаємо цю функцію без змін)
    global NEWS_TEMPLATE
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            NEWS_TEMPLATE = f.read()
            print(f"Шаблон '{file_path}' успішно завантажено.")
    except FileNotFoundError:
        print(f"Помилка: Файл шаблону '{file_path}' не знайдено.")
        NEWS_TEMPLATE = (
            "{{title_prefix}} | {{current_time}}\n"
            "{{title_line}}\n"
            "{{description}}\n"
            "{{source_line}}\n"
            "{{url_line}}"
        )
    except Exception as e:
        print(f"Помилка при читанні шаблону: {e}")
        NEWS_TEMPLATE = (
            "{{title_prefix}} | {{current_time}}\n"
            "{{title_line}}\n"
            "{{description}}\n"
            "{{source_line}}\n"
            "{{url_line}}"
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
    
    # *** ВИПРАВЛЕННЯ: ГАРАНТОВАНЕ ЖИРНЕ ФОРМАТУВАННЯ СТАТИЧНИХ МІТОК ***
    
    # 1. Заголовок
    bold_prefix = bold_unicode("📢") + " " + bold_unicode(title_prefix) 
    
    # 2. Мітка "ЗАГОЛОВОК"
    # Для гарантії жирного шрифту для статичної мітки перетворюємо її на верхній регістр перед застосуванням Unicode
    bold_title_label = bold_unicode("ЗАГОЛОВОК:")
    
    # 3. Мітки джерела та посилання
    bold_source_label = bold_unicode("Джерело:")
    bold_url_label = bold_unicode("Посилання:")
    
    # Комбінуємо мітки та дані
    # Title залишаємо без Unicode, оскільки повне перетворення кирилиці неможливе
    styled_title_line = f"{bold_title_label} {title}"
    styled_source_line = f"📰 {bold_source_label} {source}"
    styled_url_line = f"🔗 {bold_url_label} {url}"
    
    safe_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M") 
    
    # Створюємо caption з використанням завантаженого шаблону
    caption = NEWS_TEMPLATE.replace('{{title_prefix}}', bold_prefix)
    caption = caption.replace('{{current_time}}', safe_time)
    caption = caption.replace('{{title_line}}', styled_title_line) 
    caption = caption.replace('{{source_line}}', styled_source_line) 
    caption = caption.replace('{{url_line}}', styled_url_line) 
    caption = caption.replace('{{description}}', description) 
    
    return {'caption': caption, 'image_url': image_url}


# ... (Увесь інший код, включаючи _fetch_newsdata, _fetch_newsapi, get_latest_news, publish_endpoint, залишається БЕЗ ЗМІН)

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
            print("NewsData.io: No suitable articles found after filtering.")
            return None
        print(f"NewsData.io Error/No Articles: {data.get('status')}. Code: {data.get('code')}")
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
            print("NewsAPI: No suitable articles found after filtering.")
            return None
        print(f"NewsAPI Error/No Articles: {data.get('code')}. Params: {params}")
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

app = Flask(__name__)

def _send_text_message(text_content):
    # ... (залишається без змін)
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
    }
    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
        print("Fallback to sendMessage (Plain Text) successful.")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Final Telegram send error (sendMessage): {e}")
        return False

@app.route('/publish', methods=['GET'])
def publish_endpoint():
    # ... (залишається без змін)
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY, NEWSDATA_API_KEY]):
        print("Error: Missing one of the required environment variables.")
        return "Error: Missing environment variables.", 500
    news_data = get_latest_news()
    if not news_data:
        print("Final result: No news found after all attempts. Exiting gracefully.")
        return "No news found after all attempts.", 200
    caption = news_data.get('caption', "")
    image_url = news_data.get('image_url')
    if image_url:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        photo_payload = {
            'chat_id': CHANNEL_ID,
            'photo': image_url,
            'caption': caption,
        }
        try:
            telegram_response = requests.post(telegram_photo_url, data=photo_payload)
            telegram_response.raise_for_status() 
            print("Публікація sendPhoto (Plain Text) успішна.")
            return "News published successfully (with photo, Plain Text)!", 200
        except requests.exceptions.RequestException as e:
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
    if _send_text_message(caption):
        return "News published successfully (fallback to text only, Plain Text)!", 200
    else:
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    _load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
