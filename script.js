// ==========================================================
// 📜 Оновлений script.js для Новинного Web App (newsdata.io)
// Включає: Пошук + Фільтри Категорій
// ==========================================================

// !!! ЗАМІНІТЬ ЦЕЙ ПЛЕЙСХОЛДЕР НА ВАШ РЕАЛЬНИЙ API KEY newsdata.io
const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 

// Базовий Endpoint для новин
const BASE_API_URL = 'https://newsdata.io/api/1/news'; 

// Ініціалізація Telegram Web App SDK
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready(); 
    window.Telegram.WebApp.expand(); 
} 


/**
 * Рендерить масив новинних статей у DOM, використовуючи CSS-класи.
 */
function renderNews(articles) {
    const container = document.getElementById('news_container');
    container.innerHTML = '';
    
    container.classList.add('news-container'); 
    
    articles.forEach(article => {
        const card = document.createElement('a');
        card.href = article.link || '#'; 
        card.target = '_blank';
        card.className = 'news-card'; 

        const imageHtml = article.image_url 
            ? `<div class="news-image-container">
                 <img src="${article.image_url}" alt="${article.title}">
               </div>` 
            : '';

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


/**
 * Ініціює пошук та фільтрацію. Викликається кнопкою пошуку та зміною фільтра.
 */
window.performSearch = function() {
    const searchInput = document.getElementById('search_input');
    const categorySelect = document.getElementById('category_select'); // НОВЕ: Отримуємо фільтр

    // Отримання та кодування запиту
    const query = encodeURIComponent(searchInput.value.trim()); 
    // Отримання обраної категорії
    const category = categorySelect.value; 
    
    // Передаємо і запит, і категорію
    fetchAndRenderNews(query, category);
};


/**
 * Завантажує та рендерить новини, враховуючи пошуковий запит та категорію.
 * @param {string} [query=''] - Пошуковий запит (уже закодований)
 * @param {string} [category=''] - Обрана категорія
 */
async function fetchAndRenderNews(query = '', category = '') {
    const container = document.getElementById('news_container');
    
    const loadingMessage = query ? 
        `Пошук новин за запитом "${decodeURIComponent(query)}"...` : 
        'Завантаження новин...';
        
    container.innerHTML = `<p class="loading-status">${loadingMessage}</p>`; 
    
    // 1. Формування URL: базові параметри (API ключ, мова, розмір)
    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    
    // 2. Додавання параметрів
    if (query) {
        apiUrl += `&q=${query}`;
    }
    
    // НОВЕ: Додавання категорії
    if (category) {
        apiUrl += `&category=${category}`;
    }
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                 throw new Error(`API Key Error. Перевірте, чи ключ дійсний та не перевищено ліміт.`);
            }
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderNews(data.results); 
        } else {
            const message = (query || category) ? 
                `Новин за заданими критеріями не знайдено.` : 
                `Новини не знайдено.`;
                
            container.innerHTML = `<p class="loading-status">${message}</p>`;
        }
        
    } catch (error) {
        console.error("Помилка завантаження новин:", error);
        container.innerHTML = `<p class="loading-status">Помилка з'єднання: ${error.message}.</p>`;
    }
}


// ==========================================================
// 💻 ДОДАТКОВА ФУНКЦІОНАЛЬНІСТЬ: ПОШУК ПО ENTER
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search_input');
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                window.performSearch();
            }
        });
    }
});


// Запускаємо завантаження початкових новин при старті
fetchAndRenderNews();
