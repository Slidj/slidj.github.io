// ==========================================================
// 📜 Оновлений script.js для Новинного Web App (newsdata.io)
// ==========================================================

const YOUR_API_KEY = "ВАШ_API_KEY_З_NEWSDATA_IO"; 
const BASE_API_URL = 'https://newsdata.io/api/1/news'; // Використовуємо /news для пошуку

// ... (window.Telegram.WebApp.ready() та expand() залишаються) ...

if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready(); 
    window.Telegram.WebApp.expand(); 
} 

/**
 * Ініціює пошук при натисканні кнопки.
 * Ця функція викликається через onclick="performSearch()" в index.html
 */
window.performSearch = function() {
    const searchInput = document.getElementById('search_input');
    // Обрізаємо пробіли та кодуємо для URL
    const query = encodeURIComponent(searchInput.value.trim()); 
    
    // Викликаємо функцію завантаження новин з параметром пошуку
    fetchAndRenderNews(query);
};

// Залишаємо стару функцію renderNews без змін (ми її вже оновили)
function renderNews(articles) {
    // ... (код renderNews залишається тут без змін) ...
    const container = document.getElementById('news_container');
    container.innerHTML = '';
    
    container.classList.add('news-container'); 
    
    articles.forEach(article => {
        // ... (ваш код рендерингу) ...
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
 * @param {string} [query=''] - Пошуковий запит (кодується в performSearch)
 */
async function fetchAndRenderNews(query = '') {
    const container = document.getElementById('news_container');
    container.innerHTML = '<p class="loading-status">Завантаження новин...</p>'; 
    
    // 1. Формування URL: використовуємо "q" для пошукового запиту
    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    
    if (query) {
        // Якщо є запит, додаємо його до URL
        apiUrl += `&q=${query}`;
    }
    
    try {
        const response = await fetch(apiUrl);
        // ... (обробка відповіді та помилок залишається) ...
        
        if (!response.ok) {
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


// Запускаємо завантаження початкових новин (без пошуку) при старті
fetchAndRenderNews();
