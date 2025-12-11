// ==========================================================
// 📜 SCRIPT.JS: DUAL API SYSTEM (Newsdata + GNews)
// ==========================================================

// --- НАЛАШТУВАННЯ API ---
const NEWSDATA_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a";  // 200 запитів
const GNEWS_KEY = "988894076e3186f8fbd93db235ee6fe9";        // 100 запитів (Резерв)

const API_CONFIG = {
    newsdata: {
        url: 'https://newsdata.io/api/1/news',
    },
    gnews: {
        url: 'https://gnews.io/api/v4/search',
    }
};

// --- ГЛОБАЛЬНІ ЗМІННІ ---
let currentPageToken = null; // Для Newsdata
let usedApiSource = 'newsdata'; // 'newsdata' або 'gnews'
let currentQuery = '';
let currentCategory = '';
let activeTab = 'feed'; 
let savedArticles = [];
let feedArticles = [];

// Змінні PTR
let touchStartY = 0;
let isPulling = false;
const ptrSpinner = document.getElementById('ptr_spinner');

// --- ІНІЦІАЛІЗАЦІЯ ---
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    try { tg.expand(); } catch (e) {}

    const user = tg.initDataUnsafe?.user;
    const headerTitle = document.getElementById('header_title');
    const avatarImg = document.getElementById('user_avatar');
    const defaultAvatar = document.getElementById('default_avatar');
    
    if (user && headerTitle) {
        headerTitle.innerText = user.first_name + (user.last_name ? ` ${user.last_name}` : '');
        if (user.photo_url && avatarImg) {
            avatarImg.src = user.photo_url;
            avatarImg.style.display = 'block';
            if (defaultAvatar) defaultAvatar.style.display = 'none';
        } else {
            if (avatarImg) avatarImg.style.display = 'none';
            if (defaultAvatar) defaultAvatar.style.display = 'flex';
        }
    } else {
        if (avatarImg) avatarImg.style.display = 'none';
        if (defaultAvatar) defaultAvatar.style.display = 'flex';
    }
}

try {
    const stored = localStorage.getItem('savedNews');
    if (stored) savedArticles = JSON.parse(stored);
} catch (e) { console.error(e); }


// --- ВІДОБРАЖЕННЯ СТАНІВ ---
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
        title = "Ліміти вичерпано";
        subtext = `Спроба обох джерел невдала.<br>${errorDetails}`;
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
        const isSaved = savedArticles.some(item => item.url === article.url);
        
        const safeLink = (article.url || '');
        const safeTitle = (article.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        card.onclick = (e) => {
            if (!e.target.closest('.action-btn')) {
                if (window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.openLink(article.url);
                else window.open(article.url, '_blank');
            }
        };

        const rawDate = article.date || '';
        const formattedDate = rawDate ? rawDate.substring(0, 16).replace('T', ' ') : '';
        const hasImage = article.image && article.image !== 'null';
        const imageHtml = hasImage ? `<div class="news-image-container"><img src="${article.image}" alt="" onerror="this.style.display='none'"></div>` : '';

        const articleData = encodeURIComponent(JSON.stringify({
            title: article.title, 
            url: article.url, 
            description: article.description,
            date: article.date, 
            image: article.image
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

// --- НОРМАЛІЗАЦІЯ ДАНИХ ---
function normalizeArticles(data, source) {
    if (source === 'newsdata') {
        return data.results.map(item => ({
            title: item.title,
            description: item.description,
            url: item.link,           
            image: item.image_url,    
            date: item.pubDate        
        }));
    } else if (source === 'gnews') {
        return data.articles.map(item => ({
            title: item.title,
            description: item.description,
            url: item.url,
            image: item.image,
            date: item.publishedAt 
        }));
    }
    return [];
}

// --- ЛОГІКА ЗБЕРЕЖЕННЯ ---
window.toggleSave = function(encodedArticle, btn) {
    const article = JSON.parse(decodeURIComponent(encodedArticle));
    const index = savedArticles.findIndex(item => item.url === article.url);
    
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
        if (feedArticles.length > 0) {
            renderNews(feedArticles);
            // GNews не підтримує пагінацію в безкоштовному тарифі, тому кнопка "Ще" тільки для Newsdata
            const canLoadMore = (usedApiSource === 'newsdata' && currentPageToken);
            loadMoreBtn.style.display = canLoadMore ? 'block' : 'none';
        } else {
            fetchNews(currentQuery, currentCategory);
        }
    }
};

// --- РОЗУМНЕ ЗАВАНТАЖЕННЯ ---
async function fetchNews(query = '', category = '', token = null) {
    if (activeTab === 'saved') return;
    const loadMoreContainer = document.getElementById('load_more_container');
    
    if (!token && !isPulling) {
        showState('loading');
        loadMoreContainer.style.display = 'none';
    }

    // 1. Пробуємо NEWSDATA
    if (usedApiSource === 'newsdata') {
        try {
            await fetchFromNewsData(query, category, token);
            return;
        } catch (error) {
            console.warn("Newsdata failed/limited. Switching to GNews...", error);
            usedApiSource = 'gnews'; 
            currentPageToken = null; 
        }
    }

    // 2. Пробуємо GNEWS (якщо Newsdata впав)
    if (usedApiSource === 'gnews') {
        try {
            await fetchFromGNews(query, category);
        } catch (error) {
            console.error("All APIs failed", error);
            if (!token && !isPulling) showState('error', error.message);
        }
    }
}

async function fetchFromNewsData(query, category, pageToken) {
    let apiUrl = `${API_CONFIG.newsdata.url}?apikey=${NEWSDATA_KEY}&language=uk&size=10`;
    if (query) apiUrl += `&q=${query}`;
    if (category) apiUrl += `&category=${category}`;
    if (pageToken) apiUrl += `&page=${pageToken}`;

    const response = await fetch(apiUrl);
    
    if (response.status === 401 || response.status === 429 || response.status === 403) {
        throw new Error("Limit Exceeded");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    if (data.status === 'error') throw new Error(data.results.message);

    const normalized = normalizeArticles(data, 'newsdata');
    processResponse(normalized, data.nextPage || null);
}

async function fetchFromGNews(query, category) {
    // GNews не підтримує категорії в безкоштовному тарифі так само гнучко, тому ігноруємо category для стабільності
    let apiUrl = `${API_CONFIG.gnews.url}?token=${GNEWS_KEY}&lang=uk&max=10`;
    if (query) apiUrl += `&q=${query}`;
    else apiUrl += `&q=новини`; // GNews вимагає параметр q

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`GNews Error: ${response.status}`);
    
    const data = await response.json();
    const normalized = normalizeArticles(data, 'gnews');
    
    // GNews Free не дає пагінацію (page), тому nextToken = null
    processResponse(normalized, null);
}

function processResponse(articles, nextToken) {
    const loadMoreContainer = document.getElementById('load_more_container');
    
    if (articles.length > 0) {
        if (!currentPageToken && usedApiSource === 'newsdata') {
             feedArticles = articles;
        } else if (!isPulling) {
             feedArticles = [...feedArticles, ...articles];
        } else {
             feedArticles = articles;
        }

        renderNews(articles, (currentPageToken));
        currentPageToken = (usedApiSource === 'newsdata') ? nextToken : null;
        
        loadMoreContainer.style.display = nextToken ? 'block' : 'none';
    } else {
        if (!currentPageToken) {
            feedArticles = [];
            showState('no_results');
        }
        loadMoreContainer.style.display = 'none';
    }
}

// --- ІНШЕ ---
window.shareArticle = function(url, title) {
    if (navigator.share) navigator.share({ title: title, url: url }).catch(console.error);
    else window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
};

window.performSearch = function() {
    const input = document.getElementById('search_input');
    if (!input) return;
    
    feedArticles = []; 
    currentQuery = encodeURIComponent(input.value.trim());
    currentCategory = document.getElementById('category_select').value;
    
    currentPageToken = null;
    usedApiSource = 'newsdata'; // Скидаємо на головний API при новому пошуку
    
    fetchNews(currentQuery, currentCategory);
};

window.loadMoreNews = function() { fetchNews(currentQuery, currentCategory, currentPageToken); };

document.getElementById('search_input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('search_input').blur(); window.performSearch(); }
});

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
            
            feedArticles = [];
            currentPageToken = null;
            usedApiSource = 'newsdata';
            
            fetchNews(currentQuery, currentCategory).then(() => {
                setTimeout(() => { ptrSpinner.style.top = '-50px'; isPulling = false; }, 500);
            });
        } else {
            ptrSpinner.style.top = '-50px';
            isPulling = false;
        }
    });
}

fetchNews();
