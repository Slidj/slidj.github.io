// ==========================================================
// 📜 Оновлений script.js для Новинного Web App (newsdata.io)
// ==========================================================

// !!! ЗАМІНІТЬ ЦЕЙ ПЛЕЙСХОЛДЕР НА ВАШ РЕАЛЬНИЙ API KEY newsdata.io
const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 

// Endpoint URL для 10 новин українською
const NEWS_API_URL = `https://newsdata.io/api/1/latest?apikey=${YOUR_API_KEY}&language=uk&size=10`;

// Сповіщаємо Telegram, що додаток готовий
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready(); 
    // Розгортаємо Web App на повну висоту
    window.Telegram.WebApp.expand(); 
} 


async function fetchAndRenderNews() {
    const container = document.getElementById('news_container');
    container.innerHTML = '<p class="loading-status">Завантаження новин...</p>'; 
    
    try {
        const response = await fetch(NEWS_API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderNews(data.results); 
        } else {
            container.innerHTML = `<p class="loading-status">Новини не знайдено або помилка API: ${data.status}</p>`;
        }
        
    } catch (error) {
        console.error("Помилка завантаження новин:", error);
        container.innerHTML = `<p class="loading-status">Помилка з'єднання: ${error.message}. Перевірте API Key.</p>`;
    }
}


/**
 * Рендерить масив новинних статей у DOM.
 * Ця функція використовує нові CSS-класи для стилізації.
 * @param {Array<Object>} articles - Масив новинних об'єктів від newsdata.io
 */
function renderNews(articles) {
    const container = document.getElementById('news_container');
    container.innerHTML = '';
    
    // Переконаємося, що контейнер має зовнішні відступи
    container.classList.add('news-container'); 
    
    articles.forEach(article => {
        // 1. Створюємо основну картку (посилання)
        const card = document.createElement('a');
        card.href = article.link || '#'; 
        card.target = '_blank';
        card.className = 'news-card'; // Основний клас для стилізації

        // 2. Створення HTML для зображення
        const imageHtml = article.image_url 
            ? `<div class="news-image-container">
                 <img src="${article.image_url}" alt="${article.title}">
               </div>` 
            : '';

        // 3. Збираємо вміст картки
        card.innerHTML = `
            ${imageHtml}
            <div class="news-text-content">
              <h3>${article.title || 'Без заголовка'}</h3>
              <p>${article.description || ''}</p>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Запускаємо завантаження новин при старті
fetchAndRenderNews();
