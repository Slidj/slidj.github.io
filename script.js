// ==========================================================
// 📜 SCRIPT.JS: ФІНАЛЬНА ВЕРСІЯ (АВАТАР + ІМ'Я)
// ==========================================================

const YOUR_API_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; // <--- ВСТАВТЕ СЮДИ СВІЙ КЛЮЧ
const BASE_API_URL = 'https://newsdata.io/api/1/news'; 

// --- ГЛОБАЛЬНІ ЗМІННІ ---
let currentPageToken = null;
let currentQuery = '';
let currentCategory = '';
let activeTab = 'feed'; 
let savedArticles = [];
let touchStartY = 0;
let isPulling = false;
const ptrSpinner = document.getElementById('ptr_spinner');

// --- ІНІЦІАЛІЗАЦІЯ TELEGRAM ТА ПРОФІЛЮ ---
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    try { tg.expand(); } catch (e) {}

    // Отримуємо дані користувача
    const user = tg.initDataUnsafe?.user;
    
    // Елементи в header
    const headerTitle = document.getElementById('header_title');
    const avatarImg = document.getElementById('user_avatar');
    const defaultAvatar = document.getElementById('default_avatar');
    
    if (user && headerTitle) {
        // 1. Встановлюємо Ім'я (та Прізвище, якщо є)
        headerTitle.innerText = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        
        // 2. Логіка Аватара
        if (user.photo_url && avatarImg) {
            // Якщо є фото - показуємо його
            avatarImg.src = user.photo_url;
            avatarImg.style.display = 'block';
            if (defaultAvatar) defaultAvatar.style.display = 'none';
        } else {
            // Якщо фото немає - показуємо заглушку
            if (avatarImg) avatarImg.style.display = 'none';
            if (defaultAvatar) defaultAvatar.style.display = 'flex';
        }
    } else {
        // Якщо відкрили не в Telegram - показуємо заглушку
        if (avatarImg) avatarImg.style.display = 'none';
        if (defaultAvatar) defaultAvatar.style.display = 'flex';
    }
}

// Завантаження збережених новин з пам'яті телефону
try {
    const stored = localStorage.getItem('savedNews');
    if (stored) savedArticles = JSON.parse(stored);
} catch (e) { console.error(e); }


// --- ВІДОБРАЖЕННЯ СТАНІВ (Empty States) ---
function showState(type, errorDetails = "") {
    const container = document.getElementById('news_container');
    let icon, title, subtext;

    if (type === 'loading') {
        container.innerHTML = '<p class="loading-status">Завантаження новин...</p>';
        return;
    }

    if (type === 'no_results') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
        title = "Нічого не знайдено";
        subtext = "Спробуйте змінити запит";
    } else if (type === 'error') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        title = "Помилка завантаження";
        subtext = `Код: ${errorDetails}<br>Перевірте інтернет або API Key.`;
    } else if (type === 'empty_saved') {
        icon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
        title = "Немає збережених";
        subtext = "Натисніть на прапорець, щоб зберегти новину";
    }

    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">${icon}</div>
            <div class="empty-text">${title}</div>
            <div class="empty-subtext">${subtext}</div>
        </div>
    `;
    document.getElementById('load_more_container').style.display = 'none';
}

// --- РЕНДЕРИНГ НОВИН ---
function renderNews(articles, append = false) {
    const container = document.getElementById('news_container');
    if (!append) container.innerHTML = '';
    
    if (!articles || articles.length === 0) {
        if (!append) showState(activeTab === 'saved' ? 'empty_saved' : 'no_results');
        return;
    }

    articles.forEach(article => {
        const card = document.createElement('div');
        card.className = 'news-card'; 
        const isSaved = savedArticles.some(item => item.link === article.link);
        
        const safeLink = (article.link || '');
        const safeTitle = (article.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        card.onclick = (e) => {
            if (!e.target.closest('.action-btn')) {
                if (window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.openLink(article.link);
                else window.open(article.link, '_blank');
            }
        };

        const rawDate = article.pubDate || '';
        const formattedDate = rawDate ? rawDate.substring(0, 16).replace('T', ' ') : '';
        const imageHtml = article.image_url ? `<div class="news-image-container"><img src="${article.image_url}" alt="" onerror="this.style.display='none'"></div>` : '';

        const articleData = encodeURIComponent(JSON.stringify({
            title: article.title, link: article.link, description: article.description,
            pubDate: article.pubDate, image_url: article.image_url
        }));

        card.innerHTML = `
            <div class="card-content">
                ${imageHtml}
                <div class="news-text-content">
                    <h3>${article.title || 'Без заголовка'}</h3>
                    <p>${article.description || ''}</p>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="action-btn share-btn" onclick="shareArticle('${safeLink}', '${safeTitle}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave('${articleData}', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
                <div class="news-date">${formattedDate}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- ЛОГІКА ЗБЕРЕЖЕННЯ ---
window.toggleSave = function(encodedArticle, btn) {
    const article = JSON.parse(decodeURIComponent(encodedArticle));
    const index = savedArticles.findIndex(item => item.link === article.link);
    if (index === -1) {
        savedArticles.push(article);
        btn.classList.add('saved');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
        savedArticles.splice(index, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        if (activeTab === 'saved') renderNews(savedArticles);
    }
    localStorage.setItem('savedNews', JSON.stringify(savedArticles));
};

// --- ПЕРЕМИКАННЯ ВКЛАДОК ---
window.switchTab = function(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`tab_${tabName}`).classList.add('active');
    const feedControls = document.getElementById('feed_controls');
    const loadMoreBtn = document.getElementById('load_more_container');

    if (tabName === 'saved') {
        feedControls.style.display = 'none';
        loadMoreBtn.style.display = 'none';
        renderNews(savedArticles);
    } else {
        feedControls.style.display = 'flex';
        const container = document.getElementById('news_container');
        if (!container.hasChildNodes() || container.querySelector('.empty-state')) {
             fetchNews(currentQuery, currentCategory);
        } else {
             loadMoreBtn.style.display = currentPageToken ? 'block' : 'none';
        }
    }
};

// --- ЗАВАНТАЖЕННЯ З API ---
async function fetchNews(query = '', category = '', pageToken = null) {
    if (activeTab === 'saved') return;
    const loadMoreContainer = document.getElementById('load_more_container');
    const container = document.getElementById('news_container');

    if (!pageToken && !isPulling) {
        showState('loading');
        loadMoreContainer.style.display = 'none';
    }

    // Формуємо чистий URL (без _nocache, щоб уникнути помилки 422)
    let apiUrl = `${BASE_API_URL}?apikey=${YOUR_API_KEY}&language=uk&size=10`;
    if (query) apiUrl += `&q=${query}`;
    if (category) apiUrl += `&category=${category}`;
    if (pageToken) apiUrl += `&page=${pageToken}`;
    
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`${response.status}`);
        const data = await response.json();
        
        if (data.status === 'error') throw new Error(data.results.message || 'API Error');

        if (data.results && data.results.length > 0) {
            renderNews(data.results, !!pageToken);
            currentPageToken = data.nextPage || null;
            loadMoreContainer.style.display = currentPageToken ? 'block' : 'none';
        } else if (!pageToken) {
            showState('no_results');
            loadMoreContainer.style.display = 'none';
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        if (!pageToken && !isPulling) showState('error', error.message);
    }
}

// --- SHARE & SEARCH ---
window.shareArticle = function(url, title) {
    if (navigator.share) navigator.share({ title: title, url: url }).catch(console.error);
    else window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
};

window.performSearch = function() {
    const input = document.getElementById('search_input');
    if (!input) return;
    currentQuery = encodeURIComponent(input.value.trim());
    currentCategory = document.getElementById('category_select').value;
    currentPageToken = null;
    fetchNews(currentQuery, currentCategory);
};

window.loadMoreNews = function() { if (currentPageToken) fetchNews(currentQuery, currentCategory, currentPageToken); };

document.getElementById('search_input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('search_input').blur(); window.performSearch(); }
});

// --- PULL TO REFRESH ---
if (ptrSpinner) {
    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && activeTab === 'feed') {
            touchStartY = e.touches[0].clientY;
            isPulling = false;
        }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (activeTab !== 'feed') return;
        const touchY = e.touches[0].clientY;
        const pullDistance = touchY - touchStartY;
        if (pullDistance > 0 && window.scrollY === 0) {
            if (pullDistance < 150) ptrSpinner.style.top = `${pullDistance / 2 - 50}px`;
            if (pullDistance > 60) isPulling = true;
        }
    }, { passive: true });
    window.addEventListener('touchend', () => {
        if (isPulling && window.scrollY === 0 && activeTab === 'feed') {
            ptrSpinner.style.top = '10px';
            if (window.Telegram && window.Telegram.WebApp.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            currentPageToken = null;
            fetchNews(currentQuery, currentCategory).then(() => {
                setTimeout(() => { ptrSpinner.style.top = '-50px'; isPulling = false; }, 500);
            });
        } else {
            ptrSpinner.style.top = '-50px';
            isPulling = false;
        }
    });
}

// Старт
fetchNews();
