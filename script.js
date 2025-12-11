// ==========================================================
// 📜 ПОВНИЙ script.js: Пошук + Категорії + "Завантажити ще"
// ==========================================================

const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 
const BASE_API_URL = 'https://newsdata.io/api/1/news'; 

let currentPageToken = null; // Для зберігання токена наступної сторінки від newsdata.io
let currentQuery = '';
let currentCategory = '';

if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready(); 
    window.Telegram.WebApp.expand(); 
} 

/**
 * Рендерить новини. 
 * @param {boolean} append - Якщо true, додає до списку, якщо false - очищує список.
 */
function renderNews(articles, append = false) {
    const container = document.getElementById('news_container');
    if (!append) container.innerHTML = '';
    
    container.classList.add('news-container'); 
    
    articles.forEach(article => {
        const card = document.createElement('a');
        card.href = article.link || '#'; 
        card.target = '_blank';
        card.className = 'news-card'; 

        const imageHtml = article.image_url 
            ? `<div class="news-image-container"><img src="${article.image_url}" alt=""></div>` 
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
 * Основна функція запиту
 */
async function fetchNews(query = '', category = '', pageToken = null) {
    const loadMoreContainer = document.getElementById('load_more_container');
    const container = document.getElementById('news_container');

    // Показуємо статус завантаження
    if (!pageToken) {
        container.innerHTML = '<p class="loading-status">Завантаження новин...</p>';
        loadMoreContainer.style.display = 'none';
    }

    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    if (query) apiUrl += `&q=${query}`;
    if (category) apiUrl += `&category=${category}`;
    if (pageToken) apiUrl += `&page=${pageToken}`; // Додаємо токен наступної сторінки

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            renderNews(data.results, !!pageToken);
            
            // Зберігаємо токен для наступного завантаження
            currentPageToken = data.nextPage || null;
            
            // Показуємо кнопку, якщо є наступна сторінка
            loadMoreContainer.style.display = currentPageToken ? 'block' : 'none';
        } else if (!pageToken) {
            container.innerHTML = '<p class="loading-status">Новин не знайдено.</p>';
        }
    } catch (error) {
        console.error("Помилка:", error);
        if (!pageToken) container.innerHTML = '<p class="loading-status">Помилка завантаження.</p>';
    }
}

/**
 * Викликається при пошуку або зміні категорії (скидає все на 1 сторінку)
 */
window.performSearch = function() {
    currentQuery = encodeURIComponent(document.getElementById('search_input').value.trim());
    currentCategory = document.getElementById('category_select').value;
    currentPageToken = null; // Скидаємо сторінку
    fetchNews(currentQuery, currentCategory);
};

/**
 * Викликається кнопкою "Завантажити ще"
 */
window.loadMoreNews = function() {
    if (currentPageToken) {
        fetchNews(currentQuery, currentCategory, currentPageToken);
    }
};

// Початкове завантаження
fetchNews();
