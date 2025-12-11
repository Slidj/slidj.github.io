// !!! ЗАМІНІТЬ ЦЕЙ ПЛЕЙСХОЛДЕР НА ВАШ РЕАЛЬНИЙ API KEY newsdata.io
const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 

// Крок 2: Оновлений Endpoint URL для 10 новин українською
const NEWS_API_URL = `https://newsdata.io/api/1/latest?apikey=${YOUR_API_KEY}&language=uk&size=10`;

// Сповіщаємо Telegram, що додаток готовий
window.Telegram.WebApp.ready();
// Змінюємо висоту Web App для кращого відображення
window.Telegram.WebApp.expand();


async function fetchAndRenderNews() {
    const container = document.getElementById('news_container');
    container.innerHTML = '<p>Завантаження новин...</p>'; // Індикатор завантаження
    
    try {
        const response = await fetch(NEWS_API_URL);
        if (!response.ok) {
            // Обробка помилок HTTP
            throw new Error(`HTTP Error: ${response.status}`);
        }
        const data = await response.json();
        
        // Крок 3: Перевіряємо масив "results" (ключове поле в newsdata.io)
        if (data.results && data.results.length > 0) {
            renderNews(data.results); 
        } else {
            container.innerHTML = `<p>Новини не знайдено або помилка API: ${data.status}</p>`;
        }
        
    } catch (error) {
        console.error("Помилка завантаження новин:", error);
        container.innerHTML = `<p>Помилка з'єднання: ${error.message}</p>`;
    }
}

function renderNews(articles) {
    const container = document.getElementById('news_container');
    container.innerHTML = '';
    
    articles.forEach(article => {
        // Створюємо картку-посилання
        const card = document.createElement('a');
        
        // Використовуємо ключові поля: link, image_url, title, description
        card.href = article.link || '#'; 
        card.target = '_blank';
        card.className = 'news-card';

        // Перевіряємо, чи є зображення, інакше не показуємо тег <img>
        const imageHtml = article.image_url 
            ? `<img src="${article.image_url}" alt="${article.title}">` 
            : '';

        card.innerHTML = `
            ${imageHtml}
            <h3>${article.title || 'Без заголовка'}</h3>
            <p>${article.description || ''}</p>
        `;
        
        container.appendChild(card);
    });
}

// Запускаємо завантаження новин
fetchAndRenderNews();
