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
MIN_IMAGE_SIZE = 400 
# *** ФІКСОВАНИЙ ШЛЯХ ДО ЛОКАЛЬНОГО ШРИФТУ ***
FONT_PATH = "fonts/Roboto-Bold.ttf" 


# ----------------------------------------------------
# 2. ФУНКЦІЇ ЗАВАНТАЖЕННЯ ШАБЛОНУ ТА ОЧИЩЕННЯ
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
            "---"
            "📰 ЗАГОЛОВОК: {{title}}\n"
            "---"
            "{{description}}\n"
            "-------------------------------------\n"
            "🌍 Джерело: {{source}}\n"
        )
    except Exception as e:
        print(f"Помилка при читанні шаблону: {e}")
        NEWS_TEMPLATE = (
            "📢 {{title_prefix}} | {{current_time}}\n"
            "---"
            "📰 ЗАГОЛОВОК: {{title}}\n"
            "---"
            "{{description}}\n"
            "-------------------------------------\n"
            "🌍 Джерело: {{source}}\n"
        )

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


def _get_image_with_title(image_url: str, title: str) -> bytes | None:
    """
    1. Завантажує та перевіряє зображення.
    2. Якщо неякісне, генерує заглушку.
    3. Додає напівпрозорий темний шар ТІЛЬКИ в області тексту для контрасту.
    4. Накладає жирний заголовок.
    Повертає зображення як bytes (готове до відправки).
    """
    final_image = None
    fallback_used = False

    try:
        # Спроба завантажити та перевірити оригінальне зображення
        if image_url:
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()
            img_data = response.content
            
            with Image.open(io.BytesIO(img_data)) as img:
                width, height = img.size
                
                if width >= MIN_IMAGE_SIZE and height >= MIN_IMAGE_SIZE:
                    final_image = img.convert("RGB")
                else:
                    print(f"Image too small: {width}x{height}. Generating fallback.")

    except Exception as e:
        print(f"Error processing source image or bad URL: {e}. Generating fallback.")
    
    # FALLBACK: Якщо немає зображення або воно неякісне, генеруємо заглушку
    if final_image is None:
        width, height = 800, 450
        final_image = Image.new('RGB', (width, height), color = 'rgb(40, 60, 90)')
        fallback_used = True
        print("Generated placeholder image.")

    # ----------------------------------------------------
    # 1. ПІДГОТОВКА ДО РОЗМІЩЕННЯ ТЕКСТУ (ДЛЯ РОЗРАХУНКУ ОБЛАСТІ)
    # ----------------------------------------------------
    
    draw = ImageDraw.Draw(final_image) 
    
    font_size_target = 42 
    
    try:
        font = ImageFont.truetype(FONT_PATH, font_size_target)
    except Exception:
        font = ImageFont.load_default()
        
    # ВИПРАВЛЕНО: Обмеження ширини для перенесення слів, щоб не виходило за рамки
    wrap_width = 35 if fallback_used else 45 
    title_wrapped = textwrap.fill(title, width=wrap_width) 
    
    # Розрахунок розміру тексту
    try:
        # Використовуємо textbbox для точного розрахунку ширини/висоти тексту
        left, top, right, bottom = draw.textbbox((0, 0), title_wrapped, font=font)
        text_width = right - left
        text_height = bottom - top
    except Exception as e:
        text_width = 600
        text_height = 35 * len(title_wrapped.splitlines())
        
    # Розрахунок позиції (центр знизу)
    x_center = (final_image.width - text_width) / 2
    y_text = final_image.height - text_height - 20 
    
    # ----------------------------------------------------
    # 2. ДОДАВАННЯ ТЕМНОГО НАПІВПРОЗОРОГО ШАРУ ТІЛЬКИ НАД ТЕКСТОМ
    # ----------------------------------------------------
    
    # Створюємо Draw у режимі RGBA для накладання прозорого елемента
    draw_overlay = ImageDraw.Draw(final_image, 'RGBA') 
    
    # Чорний колір з прозорістю 40% (102/255)
    overlay_color = (0, 0, 0, 102) 
    
    padding_y = 15 # Додатковий відступ зверху/знизу тексту
    
    # Координати прямокутника: (x1, y1, x2, y2)
    rect_coords = [
        0,                                   # x1: Від лівого краю зображення
        y_text - padding_y,                  # y1: Трохи вище тексту
        final_image.width,                   # x2: До правого краю зображення
        y_text + text_height + padding_y     # y2: Трохи нижче тексту
    ]
    
    draw_overlay.rectangle(rect_coords, fill=overlay_color)
    
    # ----------------------------------------------------
    # 3. НАКЛАДАННЯ ЖИРНОГО ТЕКСТУ ЗАГОЛОВКА
    # ----------------------------------------------------
    
    # Накладання самого тексту (використовуємо x_center і y_text)
    draw = ImageDraw.Draw(final_image) # Перемикаємося на звичайний Draw для контуру/тексту
    
    text_color = 'white'
    outline_color = 'black'
    
    # Контур
    for offset in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
        draw.text((x_center + offset[0], y_text + offset[1]), title_wrapped, font=font, fill=outline_color)
    
    # Сам текст
    draw.text((x_center, y_text), title_wrapped, font=font, fill=text_color)
    
    # Збереження зображення в пам'яті (bytes)
    byte_io = io.BytesIO()
    final_image.convert("RGB").save(byte_io, format='JPEG', quality=85) 
    return byte_io.getvalue()


# ----------------------------------------------------
# 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API (Без змін)
# ----------------------------------------------------

def _process_article(article, title_prefix, source_key, url_key, image_key=None, description_key='description'):
    """Обробляє та форматує статтю, незалежно від джерела API."""
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
    
    safe_title_prefix = title_prefix
    safe_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M") 
    
    caption = NEWS_TEMPLATE.replace('{{title_prefix}}', safe_title_prefix)
    caption = caption.replace('{{current_time}}', safe_time)
    caption = caption.replace('{{title}}', safe_title)
    caption = caption.replace('{{source}}', safe_source)
    caption = caption.replace('{{description}}', safe_description) 
    
    return {'caption': caption, 'image_url': image_url, 'url': url, 'title': safe_title} 


def _fetch_newsdata(title_prefix: str) -> dict | None:
    if not NEWSDATA_API_KEY:
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
    """Надсилає повідомлення як Чистий Текст ( sendMessage ) з кнопкою (для Fallback)."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    keyboard = _create_inline_keyboard(url)

    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
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
    
    if not news
