const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; // ЗАМІНІТЬ НА СВІЙ
const BASE_API_URL = 'https://newsdata.io/api/1/news'; 

let currentPageToken = null;
let currentQuery = '';
let currentCategory = '';

// Ініціалізація Telegram
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
}

/**
 * Рендерить новини в контейнер
 */
function renderNews(articles, append = false) {
    const container = document.getElementById('news_container');
    if (!append) container.innerHTML = '';
    
    articles.forEach(article => {
        const card = document.createElement('a');
        card.href = article.link || '#'; 
        card.target = '_blank';
        card.className = 'news-card'; 

        // Форматування дати (YYYY-MM-DD HH:MM)
        const rawDate = article.pubDate || '';
        const formattedDate = rawDate ? rawDate.substring(0, 16) : '';

        const imageHtml = article.image_url 
            ? `<div class="news-image-container"><img src="${article.image_url}" alt=""></div>` 
            : '';

        card.innerHTML = `
            ${imageHtml}
            <div class="news-text-content">
              <h3>${article.title || 'Без заголовка'}</h3>
              <p>${article.description || 'Опис відсутній'}</p>
              <div class="news-date">${formattedDate}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * Завантаження новин з API
 */
async function fetchNews(query = '', category = '', pageToken = null) {
    const loadMoreContainer = document.getElementById('load_more_container');
    const container = document.getElementById('news_container');

    if (!pageToken) {
        container.innerHTML = '<p class="loading-status">Завантаження новин...</p>';
        loadMoreContainer.style.display = 'none';
    }

    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    if (query) apiUrl += `&q=${query}`;
    if (category) apiUrl += `&category=${category}`;
    if (pageToken) apiUrl += `&page=${pageToken}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            renderNews(data.results, !!pageToken);
            currentPageToken = data.nextPage || null;
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
 * Пошук
 */
window.performSearch = function() {
    currentQuery = encodeURIComponent(document.getElementById('search_input').value.trim());
    currentCategory = document.getElementById('category_select').value;
    currentPageToken = null;
    fetchNews(currentQuery, currentCategory);
};

/**
 * Завантажити ще
 */
window.loadMoreNews = function() {
    if (currentPageToken) {
        fetchNews(currentQuery, currentCategory, currentPageToken);
    }
};

// Слухач на Enter для пошуку
document.getElementById('search_input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') window.performSearch();
});

// Перший запуск
fetchNews();
