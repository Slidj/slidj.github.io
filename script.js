const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; // НЕ ЗАБУДЬТЕ ВСТАВИТИ КЛЮЧ
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
 * Рендерить новини.
 * ОНОВЛЕНО: Додано футер з кнопкою "Поділитися" та датою.
 */
function renderNews(articles, append = false) {
    const container = document.getElementById('news_container');
    if (!append) container.innerHTML = '';
    
    articles.forEach(article => {
        const card = document.createElement('div'); // Змінили 'a' на 'div', щоб кнопка працювала окремо
        card.className = 'news-card'; 
        
        // Клік по картці відкриває новину, якщо це не клік по кнопці "Поділитися"
        card.onclick = (e) => {
            if (!e.target.closest('.share-btn')) {
                window.open(article.link, '_blank');
            }
        };

        const rawDate = article.pubDate || '';
        const formattedDate = rawDate ? rawDate.substring(0, 16) : '';

        // Екранування лапок для безпечної передачі в функцію
        const safeTitle = (article.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeLink = (article.link || '').replace(/'/g, "\\'");

        const imageHtml = article.image_url 
            ? `<div class="news-image-container"><img src="${article.image_url}" alt=""></div>` 
            : '';

        card.innerHTML = `
            <div style="display:flex; gap:12px; width:100%;">
                ${imageHtml}
                <div class="news-text-content">
                    <h3>${article.title || 'Без заголовка'}</h3>
                    <p>${article.description || ''}</p>
                </div>
            </div>
            
            <div class="card-footer">
                <button class="share-btn" onclick="shareArticle('${safeLink}', '${safeTitle}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="18" cy="5" r="3"></circle>
                        <circle cx="6" cy="12" r="3"></circle>
                        <circle cx="18" cy="19" r="3"></circle>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                </button>
                <div class="news-date">${formattedDate}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

/**
 * НОВЕ: Функція "Поділитися"
 * Використовує нативний механізм телефону або відкриває посилання Telegram.
 */
window.shareArticle = function(url, title) {
    // Вібрація при натисканні (тактильний відгук)
    if (window.Telegram && window.Telegram.WebApp.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    if (navigator.share) {
        // Нативний шеринг (Android/iOS)
        navigator.share({
            title: title,
            url: url
        }).catch(console.error);
    } else {
        // Фоллбек для десктопа: відкриваємо вікно шерингу Telegram
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
        window.Telegram.WebApp.openTelegramLink(tgUrl);
    }
};

/**
 * Завантаження новин
 */
async function fetchNews(query = '', category = '', pageToken = null) {
    const loadMoreContainer = document.getElementById('load_more_container');
    const container = document.getElementById('news_container');
    
    // Якщо це не підвантаження сторінки, показуємо статус
    if (!pageToken) {
        // Якщо це Pull-to-refresh, ми не очищаємо контейнер відразу, щоб уникнути миготіння
        if (!isPulling) { 
            container.innerHTML = '<p class="loading-status">Завантаження новин...</p>';
            loadMoreContainer.style.display = 'none';
        }
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

window.performSearch = function() {
    currentQuery = encodeURIComponent(document.getElementById('search_input').value.trim());
    currentCategory = document.getElementById('category_select').value;
    currentPageToken = null;
    fetchNews(currentQuery, currentCategory);
};

window.loadMoreNews = function() {
    if (currentPageToken) {
        fetchNews(currentQuery, currentCategory, currentPageToken);
    }
};

document.getElementById('search_input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') window.performSearch();
});

// ==========================================================
// 🔄 PULL-TO-REFRESH ЛОГІКА
// ==========================================================
let touchStartY = 0;
let isPulling = false;
const ptrThreshold = 150; // Скільки пікселів треба потягнути вниз
const ptrSpinner = document.getElementById('ptr_spinner');

window.addEventListener('touchstart', (e) => {
    // Фіксуємо початок дотику тільки якщо ми на самому верху сторінки
    if (window.scrollY === 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = false;
    }
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    const touchY = e.touches[0].clientY;
    const pullDistance = touchY - touchStartY;

    // Якщо тягнемо вниз і ми нагорі
    if (pullDistance > 0 && window.scrollY === 0) {
        // Візуалізація: показуємо спінер
        if (pullDistance < ptrThreshold) {
             ptrSpinner.style.top = `${pullDistance / 2 - 50}px`; // Плавне опускання
        }
        
        // Якщо потягнули достатньо
        if (pullDistance > 50) {
            isPulling = true;
        }
    }
}, { passive: true });

window.addEventListener('touchend', () => {
    if (isPulling && window.scrollY === 0) {
        // Запуск оновлення
        ptrSpinner.style.top = '10px'; // Фіксуємо спінер
        
        // Тактильний відгук
        if (window.Telegram && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }

        // Оновлюємо новини (скидаємо токени сторінок)
        currentPageToken = null;
        fetchNews(currentQuery, currentCategory).then(() => {
            // Ховаємо спінер після завантаження
            setTimeout(() => {
                ptrSpinner.style.top = '-50px';
                isPulling = false;
            }, 500);
        });
    } else {
        // Просто ховаємо спінер, якщо потягнули недостатньо
        ptrSpinner.style.top = '-50px';
    }
});

// Перший запуск
fetchNews();
