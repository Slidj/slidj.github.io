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
# Змінна для відстеження ротації: False = шукаємо Україну, True = шукаємо Світ
LAST_FETCH_WAS_UKRAINE = False 

# Конфігурація зображень
MIN_IMAGE_SIZE = 400 
# ФІКСОВАНИЙ ШЛЯХ ДО ЛОКАЛЬНОГО ШРИФТУ
FONT_PATH = "fonts/Roboto-Bold.ttf" 

# Шаблон для привітання
GREETING_TEMPLATE = (
    "👋 **Ласкаво просимо на наш новинний канал!**\n\n"
    "Тут ви знайдете найсвіжіші та перевірені новини. Наші публікації виходять кілька разів на день.\n\n"
    "---"
    "⏰ Останнє оновлення привітання: {current_time}"
)
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
        print(f"Помилка: Файл шаблону '{file_path}' не знайдено. Використовуємо шаблон за замовчуванням.")
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
    1. Перевіряє та обробляє зображення-фон.
    2. Використовує динамічний цикл для підгонки тексту до заданої ширини/кількості рядків.
    3. Додає контрастний шар та накладає заголовок.
    """
    
    # ------------------ ПАРАМЕТРИ ПІДГОНКИ ------------------
    MAX_WRAP_WIDTH = 45     # Максимальна кількість символів у рядку
    MAX_LINES = 4           # Максимальна кількість рядків
    MIN_FONT_SIZE = 30      # Мінімальний допустимий розмір шрифту
    DEFAULT_FONT_SIZE = 42  # Початковий розмір шрифту
    # --------------------------------------------------------
    
    final_image = None
    fallback_used = False

    # Блок завантаження та перевірки зображення
    try:
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
    
    if final_image is None:
        width, height = 800, 450
        final_image = Image.new('RGB', (width, height), color = 'rgb(40, 60, 90)')
        fallback_used = True
        print("Generated placeholder image.")

    draw = ImageDraw.Draw(final_image) 
    
    # Якщо використовується заглушка, робимо текст трохи вужчим
    wrap_width = MAX_WRAP_WIDTH - 10 if fallback_used else MAX_WRAP_WIDTH
    
    current_title = title
    font_size = DEFAULT_FONT_SIZE
    
    # ------------------ ЦИКЛ ДИНАМІЧНОЇ ПІДГОНКИ ТЕКСТУ ------------------
    while True:
        try:
            # Спроба завантажити шрифт
            font = ImageFont.truetype(FONT_PATH, font_size)
        except Exception:
            font = ImageFont.load_default()
            
        # 1. Переносимо слова по рядках
        # subsequent_indent використовується для кращого візуального центрування багаторядкового тексту
        title_wrapped = textwrap.fill(current_title, width=wrap_width, subsequent_indent='  ')
        lines = title_wrapped.splitlines()
        
        # 2. Перевірка: чи не занадто багато рядків?
        if len(lines) > MAX_LINES:
            
            # Якщо рядків занадто багато, скорочуємо оригінальний заголовок.
            # Обрізаємо заголовок до кількості символів, які гарантовано помістяться
            max_chars = wrap_width * (MAX_LINES - 1) 
            
            if len(current_title) > max_chars:
                # Скорочуємо текст, щоб забезпечити місце для трикрапки
                truncated_title = current_title[:max_chars].rsplit(' ', 1)[0]
                current_title = truncated_title + '...'
                print(f"Title truncated aggressively to fit {MAX_LINES} lines.")
                continue # Починаємо цикл знову з укороченим текстом
                
        # 3. Якщо рядків в межах норми, перевіряємо ширину (для контролю шрифту)
        
        try:
            # Використовуємо textbbox для точного розрахунку ширини/висоти тексту
            left, top, right, bottom = draw.textbbox((0, 0), title_wrapped, font=font)
            text_width = right - left
            text_height = bottom - top
        except Exception:
            # Fallback, якщо textbbox не працює
            text_width = final_image.width * 0.8
            text_height = font_size * len(lines)
            
        # Якщо ширина тексту (при поточному шрифті) занадто велика
        if text_width > (final_image.width * 0.9) and font_size > MIN_FONT_SIZE:
            font_size -= 2 # Зменшуємо шрифт
            print(f"Decreasing font size to {font_size}.")
            continue # Починаємо цикл знову з меншим шрифтом
            
        # 4. Успішне завершення: текст помістився і шрифт підібраний
        break
    # ------------------ КІНЕЦЬ ЦИКЛУ ПІДГОНКИ ------------------
    
    # Розрахунок позиції (центр знизу)
    x_center = (final_image.width - text_width) / 2
    y_text = final_image.height - text_height - 20 
    
    # ------------------ ДОДАВАННЯ ТЕМНОГО ШАРУ ------------------
    draw_overlay = ImageDraw.Draw(final_image, 'RGBA') 
    overlay_color = (0, 0, 0, 102) 
    padding_y = 15 
    
    rect_coords = [
        0,                                   
        y_text - padding_y,                  
        final_image.width,                   
        y_text + text_height + padding_y     
    ]
    
    draw_overlay.rectangle(rect_coords, fill=overlay_color)
    
    # ------------------ НАКЛАДАННЯ ТЕКСТУ ------------------
    draw = ImageDraw.Draw(final_image) 
    text_color = 'white'
    outline_color = 'black'
    
    # Контур (обведення)
    for offset in [(1, 1), (1, -1), (-1, 1), (-1, -1)]:
        draw.text((x_center + offset[0], y_text + offset[1]), title_wrapped, font=font, fill=outline_color)
    
    # Сам текст
    draw.text((x_center, y_text), title_wrapped, font=font, fill=text_color)
    
    # Збереження зображення в пам'яті (bytes)
    byte_io = io.BytesIO()
    final_image.convert("RGB").save(byte_io, format='JPEG', quality=85) 
    return byte_io.getvalue()
# ----------------------------------------------------
# 3. ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ API (Ротація)
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


def _fetch_ukraine_newsdata(title_prefix: str) -> dict | None:
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
        print(f"NewsData.io (Ukraine) Connection Error: {e}")
        return None

def _fetch_global_newsdata(title_prefix: str) -> dict | None:
    if not NEWSDATA_API_KEY:
        return None
        
    params = {
        'apikey': NEWSDATA_API_KEY,
        'language': 'uk', 
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
                
                # --- ВИПРАВЛЕННЯ ПОМИЛКИ (AttributeError: 'list' object has no attribute 'lower') ---
                source_country_data = article.get('country', ['XX']) 

                if isinstance(source_country_data, list) and source_country_data:
                    source_country = source_country_data[0].lower()
                elif isinstance(source_country_data, str):
                    source_country = source_country_data.lower()
                else:
                    source_country = 'xx'
                # -------------------------------------------------------------------------------------

                if source_country == 'ua':
                    continue 
                
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
        print(f"NewsData.io (Global) Connection Error: {e}")
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
    global LAST_FETCH_WAS_UKRAINE
    
    # Ротація: Якщо минулого разу була Україна, шукаємо Світ, і навпаки
    if LAST_FETCH_WAS_UKRAINE:
        print("Fetching Global News...")
        news_data = _fetch_global_newsdata("Світова Новина")
        LAST_FETCH_WAS_UKRAINE = False
        
        if news_data:
            return news_data
            
        print("Global News not found. Falling back to Ukraine News...")
        news_data = _fetch_ukraine_newsdata("Свіжа Новина з України")
        
    else:
        print("Fetching Ukraine News...")
        news_data = _fetch_ukraine_newsdata("Свіжа Новина з України")
        LAST_FETCH_WAS_UKRAINE = True
        
        if news_data:
            return news_data
            
        print("Ukraine News not found. Falling back to Global News...")
        news_data = _fetch_global_newsdata("Світова Новина")
        
    if news_data:
        return news_data
        
    # Фінальний ФОЛБЕК на NewsAPI (англомовні)
    print("FALLBACK 2: NewsData.io failed completely. Trying NewsAPI global English news...")
    global_params = {'language': 'en', 'category': 'general'}
    news_data = _fetch_newsapi(global_params, "Світова Новина") 
    
    return news_data
def _send_text_message(text_content, url=None):
    """Надсилає повідомлення як Чистий Текст ( sendMessage ). Якщо є url, додає кнопку."""
    telegram_publish_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    
    payload = {
        'chat_id': CHANNEL_ID,
        'text': text_content, 
        'parse_mode': 'Markdown' 
    }
    
    if url and url != '#':
        payload['reply_markup'] = _create_inline_keyboard(url)

    try:
        response = requests.post(telegram_publish_url, data=payload)
        response.raise_for_status()
        return True, response.json()
    except requests.exceptions.RequestException as e:
        print(f"Final Telegram send error (sendMessage): {e}")
        return False, None

def _send_and_pin_greeting():
    """Надсилає нове привітання та закріплює його в каналі."""
    current_time = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    greeting_text = GREETING_TEMPLATE.format(current_time=current_time)

    if not all([TELEGRAM_TOKEN, CHANNEL_ID]):
        return False, "Missing Telegram credentials."

    # 1. Надсилаємо повідомлення
    success, send_data = _send_text_message(greeting_text)
    
    if not success:
        return False, "Error sending greeting message."
            
    message_id = send_data['result']['message_id']
    
    # 2. Закріплюємо повідомлення
    pin_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/pinChatMessage"
    pin_payload = {
        'chat_id': CHANNEL_ID,
        'message_id': message_id,
        'disable_notification': False, 
    }
    
    try:
        pin_response = requests.post(pin_url, json=pin_payload)
        pin_response.raise_for_status()
        
        if pin_response.json()['ok']:
            print(f"Greeting message ID {message_id} successfully pinned.")
            return True, "Greeting pinned successfully."
        else:
            return False, f"Error pinning message: {pin_response.json().get('description')}"
            
    except requests.exceptions.RequestException as e:
        return False, f"Telegram API error during pin: {e}"


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


@app.route('/publish', methods=['GET'])
def publish_endpoint():  
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY, NEWSDATA_API_KEY]):
        print("Error: Missing one of the required environment variables.")
        return "Error: Missing environment variables.", 500

    news_data = get_latest_news()
    
    if not news_data:  
        print("Final result: No news found or all were duplicates.")
        return "No news found after all attempts or all were duplicates.", 200 

    caption = news_data.get('caption', "")
    image_url = news_data.get('image_url')
    article_url = news_data.get('url') 
    article_title = news_data.get('title') 
    
    # -------------------------------------------------------------------------
    # 1. СТВОРЕННЯ АБО ОБРОБКА ЗОБРАЖЕННЯ
    # -------------------------------------------------------------------------
    
    processed_image_bytes = _get_image_with_title(image_url, article_title)
    
    # -------------------------------------------------------------------------
    # 2. СПРОБА #1: SENDPHOTO (з локально обробленим зображенням)
    # -------------------------------------------------------------------------
    
    if processed_image_bytes:
        telegram_photo_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        
        files = {'photo': ('news_image.jpg', processed_image_bytes, 'image/jpeg')}
        
        payload = {
            'chat_id': CHANNEL_ID,
            'caption': caption,
            'reply_markup': _create_inline_keyboard(article_url),
            'parse_mode': 'Markdown'
        }
        
        try:
            telegram_response = requests.post(telegram_photo_url, data=payload, files=files)
            telegram_response.raise_for_status() 
            
            print("Публікація sendPhoto (з обробленим зображенням та кнопкою) успішна.")
            return "News published successfully (with processed photo and button)!", 200
            
        except requests.exceptions.RequestException as e:
            print(f"sendPhoto failed ({e}). Falling back to sendMessage...")
    
    # -------------------------------------------------------------------------
    # 3. СПРОБА #2: FALLBACK НА SENDMESSAGE (Текст + Кнопка)
    # -------------------------------------------------------------------------
    
    if _send_text_message(caption, article_url)[0]: 
        return "News published successfully (fallback to text only with button)!", 200
    else:
        return "Telegram final send failed. (Fallback failed)", 200 

@app.route('/greet', methods=['GET'])
def greet_endpoint():
    """Оновлює закріплене привітання, надсилаючи нове повідомлення та закріплюючи його."""
    success, message = _send_and_pin_greeting()
    
    if success:
        return message, 200
    else:
        print(f"Error in /greet: {message}")
        return f"Failed to update greeting: {message}", 500

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish.", 200

if __name__ == '__main__':
    _load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
