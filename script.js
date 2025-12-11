// ==========================================================
// 📜 Оновлений script.js для Новинного Web App (newsdata.io)
// FIX: Уточнена логіка формування API URL для пошуку.
// ==========================================================

// !!! ЗАМІНІТЬ ЦЕЙ ПЛЕЙСХОЛДЕР НА ВАШ РЕАЛЬНИЙ API KEY newsdata.io
const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 

// Базовий Endpoint для новин (використовуємо /news для пошуку)
const BASE_API_URL = 'https://newsdata.io/api/1/news'; 

// Ініціалізація Telegram Web App SDK
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready(); 
    window.Telegram.WebApp.expand(); 
} 


/**
 * Рендерить масив новинних статей у DOM, використовуючи CSS-класи.
 * Ця функція не змінюється.
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
 * Завантажує та рендерить новини, опціонально з використанням пошукового запиту.
 * @param {string} [query=''] - Пошуковий запит (уже закодований)
 */
async function fetchAndRenderNews(query = '') {
    const container = document.getElementById('news_container');
    
    // Якщо запит не порожній, показуємо, що ми шукаємо
    const loadingMessage = query ? 
        `Пошук новин за запитом "${decodeURIComponent(query)}"...` : 
        'Завантаження останніх новин...';
        
    container.innerHTML = `<p class="loading-status">${loadingMessage}</p>`; 
    
    // 1. Формування URL: базові параметри (API ключ, мова, розмір)
    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    
    if (query) {
        // Якщо є пошуковий запит, додаємо його до URL
        apiUrl += `&q=${query}`;
    }
    
    try {
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
             // Якщо помилка 401/403 (несанкціоновано), це може бути API Key
            if (response.status === 401 || response.status === 403) {
                 throw new Error(`API Key Error. Перевірте, чи ключ дійсний та не перевищено ліміт.`);
            }
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderNews(data.results); 
        } else {
            // Змінюємо повідомлення, якщо пошук не дав результатів
            const message = query ? 
                `Новин за запитом "${decodeURIComponent(query)}" не знайдено.` : 
                `Новини не знайдено.`;
                
            container.innerHTML = `<p class="loading-status">${message}</p>`;
        }
        
    } catch (error) {
        console.error("Помилка завантаження новин:", error);
        container.innerHTML = `<p class="loading-status">Помилка з'єднання: ${error.message}.</p>`;
    }
}


/**
 * Ініціює пошук при натисканні кнопки або клавіші Enter.
 * Ця функція викликається через onclick="performSearch()" в index.html
 */
window.performSearch = function() {
    const searchInput = document.getElementById('search_input');
    // Обрізаємо пробіли та кодуємо для URL
    const query = encodeURIComponent(searchInput.value.trim()); 
    
    // Викликаємо функцію завантаження новин з параметром пошуку
    fetchAndRenderNews(query);
};


// ==========================================================
// 💻 ДОДАТКОВА ФУНКЦІОНАЛЬНІСТЬ: ПОШУК ПО ENTER
// ==========================================================

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search_input');
    
    if (searchInput) {
        // Додаємо слухача події 'keypress' до поля введення
        searchInput.addEventListener('keypress', (event) => {
            // Перевіряємо, чи натиснута клавіша "Enter"
            if (event.key === 'Enter') {
                // Запобігаємо стандартній дії (наприклад, надсилання форми)
                event.preventDefault(); 
                
                // Викликаємо нашу функцію пошуку
                window.performSearch();
            }
        });
    }
});


// Запускаємо завантаження початкових новин (без пошуку) при завантаженні скрипта
fetchAndRenderNews();
