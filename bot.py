import os
from flask import Flask
# Імпортуємо всі потрібні функції з нового модуля
from news_processor import (
    get_latest_news, 
    send_news_to_telegram, 
    update_and_pin_greeting,
    load_template
)

# 1. КОНСТАНТИ З ПЕРЕМІННИХ СЕРЕДОВИЩА (для перевірки перед запуском)
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")
NEWS_API_KEY = os.getenv("NEWS_API_KEY")
NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY") 


# ----------------------------------------------------
# 2. ОСНОВНА ЛОГІКА FLASK (WEB SERVICE)
# ----------------------------------------------------

app = Flask(__name__)

@app.route('/publish', methods=['GET'])
def publish_endpoint():  
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID, NEWS_API_KEY, NEWSDATA_API_KEY]):
        print("Error: Missing one of the required environment variables.")
        return "Error: Missing environment variables.", 500

    # 1. Отримуємо новину з news_processor
    news_data = get_latest_news()
    
    if not news_data:  
        print("Final result: No news found or all were duplicates.")
        return "No news found after all attempts or all were duplicates.", 200 

    # 2. Відправляємо новину через news_processor
    success, message = send_news_to_telegram(news_data)
    
    if success:
        return message, 200
    else:
        return message, 500 

@app.route('/greet', methods=['GET'])
def greet_endpoint():
    
    if not all([TELEGRAM_TOKEN, CHANNEL_ID]):
        return "Error: Missing Telegram credentials for greeting.", 500
        
    # Оновлюємо привітання через news_processor
    success, message = update_and_pin_greeting()
    
    if success:
        return message, 200
    else:
        print(f"Error in /greet: {message}")
        return f"Failed to update greeting: {message}", 500

@app.route('/', methods=['GET'])
def home():
    return "Bot is alive and ready to publish. Check /publish or /greet.", 200

if __name__ == '__main__':
    # Завантажуємо шаблон при запуску
    load_template() 
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
