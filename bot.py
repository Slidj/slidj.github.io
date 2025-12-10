import os
import requests
import json
import re 
import random 
import datetime 
import io
import textwrap 
from collections import deque
from flask import Flask
from PIL import Image, ImageDraw, ImageFont 

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY") 

# URL API
NEWS_API_URL = "https://newsapi.org/v2/top-headlines"
NEWSDATA_URL = "https://newsdata.io/api/1/news"

NEWS_TEMPLATE = None
PUBLISHED_TITLES = deque(maxlen=20) 

# Конфігурація зображень
MIN_IMAGE_SIZE = 600
# Шляхи до локальних шрифтів у папці fonts/
FONT_BOLD_PATH = "fonts/Roboto-Bold.ttf"
FONT_REGULAR_PATH = "fonts/Roboto-Regular.ttf" 

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
        NEWS_TEMPLATE = "Template loaded internally."


def _clean_text(text):
    """Виконує очищення тексту від HTML, надлишкових URL та пробілів."""
    if text is None:
        return ""
    
    cleaned_text = re.sub('<[^<]+?>', '', text)
    url_pattern = r'https?://\S+|www\.\S+'
    cleaned_text = re.sub(url_pattern, '', cleaned_text)
    cleaned_text = cleaned_text.replace('[Removed]', '')
    cleaned_text = '\n'.join(line.strip() for line in cleaned_text.splitlines() if line.strip())
    
    return cleaned_text.strip()


def _generate_news_image(image_url: str, title: str, description: str, source: str) -> bytes | None:
    """
    Генерує фінальне зображення, на яке накладається весь текст новини (Image-as-Post).
    """
    
    # 1. СТВОРЕННЯ/ОТРИМАННЯ ФОНУ
    final_image = None
    width, height = 1000, 600
    
    try:
        if image_url:
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            img_data = response.content
            
            with Image.open(io.BytesIO(img_data)) as img:
                img = img.convert("RGB")
                img_ratio = img.width / img.height
                target_ratio = width / height
                
                if img_ratio > target_ratio:
                    new_width = int(img.height * target_ratio)
                    left = (img.width - new_width) // 2
                    img = img.crop((left, 0, left + new_width, img.height))
                else:
                    new_height = int(img.width / target_ratio)
                    top = (img.height - new_height) // 2
                    img = img.crop((0, top, img.width, top + new_height))
                    
                final_image = img.resize((width, height))
                
    except Exception as e:
        print(f"Error processing source image or bad URL: {e}. Generating fallback.")
    
    if final_image is None:
        final_image = Image.new('RGB', (width, height), color = 'rgb(40, 60, 90)')
        
    draw = ImageDraw.Draw(final_image)
    
    # Додавання напівпрозорого темного шару для кращої читабельності тексту
    draw.rectangle([0, 0, width, height], fill=(0, 0, 0, 150))
    
    
    # 2. ЗАВАНТАЖЕННЯ ШРИФТІВ
    try:
        font_title = ImageFont.truetype(FONT_BOLD_PATH, 42)
        font_body = ImageFont.truetype(FONT_REGULAR_PATH, 30) # *** ЗБІЛЬШЕНИЙ РОЗМІР ***
        font_source = ImageFont.truetype(FONT_REGULAR_PATH, 20)
    except Exception as e:
        print(f"Font loading failed ({e}). Using default small font.")
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()
        font_source = ImageFont.load_default()


    # 3. ФОРМАТУВАННЯ ТЕКСТУ
    padding = 50
    current_y = padding
    max_text_width_char = 90
    
    # A. ЗАГОЛОВОК
    title_wrapped = textwrap.fill(title, width=60)
    
    try:
        left, top, right, bottom = draw.textbbox((0, 0), title_wrapped, font=font_title)
    except:
        left, top, right, bottom = (0, 0, 500, 50)
        
    text_width = right - left
    
    # Малюємо контур
    outline_color = (0, 0, 0)
    for offset in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
        draw.text(((width - text_width) // 2 + offset[0], current_y + offset[1]), 
                  title_wrapped, font=font_title, fill=outline_color)
        
    draw.text(((width - text_width) // 2, current_y), title_wrapped, font=font_title, fill='white')
    
    # Оновлення позиції Y
    current_y += (bottom - top) + 30 
    
    # B. ОПИС ТА ТІЛО НОВИНИ
    description_wrapped = textwrap.fill(description, width=max_text_width_char) # *** ГАРАНТОВАНЕ ПЕРЕНЕСЕННЯ ***
    
    draw.multiline_text((padding, current_y), description_wrapped, font=font_body, fill='white')

    # Розрахунок кінцевої позиції Y для джерела
    try:
        _, _, _, desc_bottom = draw.textbbox((padding, current_y), description_wrapped, font=font_body)
        current_y = desc_bottom + 30
    except:
         current_y += (len(description_wrapped.splitlines()) * 30) + 30
    
    
    # C. ДЖЕРЕЛО
    source_text = f"🌍 Джерело: {source}"
    
    draw.text((padding, current_y), source_text, font=font_source, fill=(200, 200, 200))

    
    # 4. Збереження зображення
    byte_io = io.BytesIO()
    final_image.save(byte_io, format='JPEG', quality=85) 
    return byte_io.getvalue()


# ----------------------------------------------------
# 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API 
# ----------------------------------------------------

def _process_article(article, title_prefix, source_key, url_key, image_key=None, description_key='description'):
    if NEWS_TEMPLATE is None:
        _load_template()

    title = article.get("title", "Без заголовка")
    description = article.get(description_key)
    if not description:
        description = article.get('content', "Детальний опис відсутній.")
    
    source = article.get(source_key, {}).get("name", "Невідоме джерело") if isinstance(article.get(source_key), dict) else article.get(source_key, "Невідоме джерело")
    url = article.get(url_key, "#") 
    image_url = article.get(image_key) if image_key else None
    
    safe_title = _clean_text(title)
    safe_source = _clean_text(source)
    safe_description = _clean_text(description) 
    
    if safe_title in PUBLISHED_TITLES:
        print(f"Skipping duplicate title: {safe_title}")
        return None 
        
    PUBLISHED_TITLES.append(safe_title) 
    
    return {
        'title': safe_title, 
        'image_url': image_url, 
        'url': url, 
        'description': safe_description,
        'source': safe_source
    }


def _fetch_newsdata(title_prefix: str) -> dict | None:
    if not NEWSDATA_API_KEY:
        return None
        
    params = {'apikey': NEWSDATA_API_KEY, 'language': 'uk', 'country': 'ua', 'size': 5}
    
    try:
        response = requests.get(NEWSDATA_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        if data['status'] == 'success' and data['results']:
            articles = data['results']
            random.shuffle(articles)
            
            for article in articles:
                result = _process_article(article, title_prefix, source_key='source_id', url_key='link', image_key='image_url', description_key='description')
                if result:
                    return result
            return None 
        return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsData.io Connection Error: {e}")
        return None

def _fetch_newsapi(params: dict, title_prefix: str) -> dict | None:
    if not NEWS_API_KEY:
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
                result = _process_article(article, title_prefix, source_key='source', url_key='url', image_key='urlToImage', description_key='description')
                if result:
                    return result
            return None
        return None
            
    except requests.exceptions.RequestException as e:
        print(f"NewsAPI Connection Error: {e}")
        return None


def get_latest_news() -> dict | None:
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
    return json.dumps(keyboard)

def _send_text_message(text_content, url):
    """FALLBACK: Надсилає повідомлення як Чистий Текст з кнопкою."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    keyboard = _create_inline_keyboard(url)
    fallback_text = f"📢 Новина: {text_content[:200]}..." # Обмежимо текст у fallback
    
    payload = {
        'chat_id': CHANNEL_ID,
        'text': fallback_text, 
        'reply_markup': keyboard 
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
        print("Final result: No news found or all were duplicates.")
        return "No news found after all attempts or all were duplicates.", 200 

    article_title = news_data.get('title', 'Без заголовка')
    article_description = news_data.get('description', 'Детальний опис відсутній.')
    article_source = news_data.get('source', 'Невідоме джерело')
    image_url = news_data.get('image_url')
    article_url = news_data.get('url') 
    
    keyboard = _create_inline_keyboard(article_url)
    
    # -------------------------------------------------------------------------
    # 1. ГЕНЕРАЦІЯ ЗОБРАЖЕННЯ З ПОВНИМ ТЕКСТОМ НОВИНИ
    # -------------------------------------------------------------------------
    
    processed_image_bytes = _generate_news_image(image_url, article_title, article_description, article_source)
    
    # -------------------------------------------------------------------------
    # 2. СПРОБА #1: SENDPHOTO (з новиною як зображенням)
    # -------------------------------------------------------------------------
    
    if processed_image_bytes:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        
        files = {'photo': ('news_image.jpg', processed_image_bytes, 'image/jpeg')}
        
        payload = {
            'chat_id': CHANNEL_ID,
            'caption': "📰 Натисніть 'Читати повністю' для джерела.",
            'reply_markup': keyboard 
        }
        
        try:
            telegram_response = requests.post(telegram_photo_url, data=payload, files=files)
            telegram_response.raise_for_status() 
            
            print("Публікація sendPhoto (Зображення-Новина з кнопкою) успішна.")
            return "News published successfully (Image-as-Post)! ", 200
            
        except requests.exceptions.RequestException as e:
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
    
    # -------------------------------------------------------------------------
    # 3. СПРОБА #2: FALLBACK НА SENDMESSAGE (Тільки посилання)
    # -------------------------------------------------------------------------
    
    if _send_text_message(article_title, article_url): 
        return "News published successfully (fallback to text link with button)!", 200
    else:
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    _load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
