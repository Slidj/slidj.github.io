// ==========================================================
// 📜 SCRIPT.JS: MEDIA HUB (NEWS + MOVIES)
// ==========================================================

// --- КЛЮЧІ API ---
const NEWSDATA_KEY = "pub_22e4e8780f9349e7a64a65f886ecae3a"; 
const GNEWS_KEY = "988894076e3186f8fbd93db235ee6fe9";       
const TMDB_KEY = "4dac8d33b5f9ef7b7c69d94b3f9cd56b"; // <--- НОВИЙ КЛЮЧ

const API_CONFIG = {
    newsdata: { url: 'https://newsdata.io/api/1/news' },
    gnews: { url: 'https://gnews.io/api/v4/search' },
    tmdb: { 
        url: 'https://api.themoviedb.org/3',
        imgBase: 'https://image.tmdb.org/t/p/w500' // База для картинок
    }
};

// --- СТАН ДОДАТКА ---
let appMode = 'news'; // 'news', 'movies', 'saved'
let currentApiSource = 'newsdata'; // для новин

// Пагінація
let newsPageToken = null;
let moviePage = 1;

// Дані
let feedNews = [];
let feedMovies = [];
let savedItems = [];
let userPoints = 0;

// Пошук
let currentQuery = '';
let currentCategory = '';

// PTR
let touchStartY = 0;
let isPulling = false;
const ptrSpinner = document.getElementById('ptr_spinner');


// --- ІНІЦІАЛІЗАЦІЯ ---
if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    try { tg.expand(); } catch (e) {}
    
    // Персоналізація
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('header_title').innerText = user.first_name;
        if (user.photo_url) {
            document.getElementById('user_avatar').src = user.photo_url;
            document.getElementById('user_avatar').style.display = 'block';
        } else {
            document.getElementById('default_avatar').style.display = 'flex';
        }
    } else {
        document.getElementById('default_avatar').style.display = 'flex';
    }
}

// Завантаження локальних даних
try {
    const storedSaved = localStorage.getItem('savedItems');
    if (storedSaved) savedItems = JSON.parse(storedSaved);

    const storedPoints = localStorage.getItem('userPoints');
    if (storedPoints) userPoints = parseInt(storedPoints);
    
    updateRankDisplay();
} catch (e) {}


// --- СИСТЕМА БАЛІВ ---
function updateRankDisplay() {
    const rankEl = document.getElementById('rank_name');
    const pointsEl = document.getElementById('points_count');
    
    let rank = "Читач 👶";
    if (userPoints >= 100) rank = "Кіноман 🍿";
    if (userPoints >= 500) rank = "Критик 🧐";
    if (userPoints >= 1000) rank = "Редактор 🎩";
    if (userPoints >= 5000) rank = "Магнат 👑";

    if (rankEl) rankEl.innerText = rank;
    if (pointsEl) pointsEl.innerText = userPoints;
}

function addPoints(amount) {
    userPoints += amount;
    localStorage.setItem('userPoints', userPoints);
    updateRankDisplay();
}


// --- ПЕРЕМИКАННЯ РЕЖИМІВ (TABS) ---
window.switchMode = function(mode) {
    appMode = mode;
    
    // Оновлення кнопок
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    let activeBtnId = 'tab_feed';
    if (mode === 'movies') activeBtnId = 'tab_movies';
    if (mode === 'saved') activeBtnId = 'tab_saved';
    document.getElementById(activeBtnId).classList.add('active');

    // Керування інтерфейсом
    const categorySelect = document.getElementById('category_select');
    const filtersWrapper = document.getElementById('filters_wrapper');
    const searchInput = document.getElementById('search_input');
    const container = document.getElementById('content_container');
    const loadMoreBtn = document.getElementById('load_more_container');

    // Скидаємо класи контейнера
    container.className = ''; 

    if (mode === 'news') {
        filtersWrapper.style.display = 'block';
        categorySelect.classList.remove('hidden');
        searchInput.placeholder = "Пошук новин...";
        container.classList.add('news-container', 'list-view');
        
        if (feedNews.length > 0) {
            renderList(feedNews);
            loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';
        } else {
            fetchContent();
        }
    } 
    else if (mode === 'movies') {
        filtersWrapper.style.display = 'block';
        categorySelect.classList.add('hidden'); // Ховаємо категорії новин
        searchInput.placeholder = "Пошук фільмів...";
        container.classList.add('movies-grid'); // Вмикаємо сітку
        
        if (feedMovies.length > 0) {
            renderMovies(feedMovies);
            loadMoreBtn.style.display = 'block';
        } else {
            fetchContent();
        }
    } 
    else if (mode === 'saved') {
        filtersWrapper.style.display = 'none';
        container.classList.add('news-container', 'list-view'); // Збережене показуємо списком
        loadMoreBtn.style.display = 'none';
        renderList(savedItems);
    }
};


// --- ГОЛОВНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ ---
async function fetchContent(isLoadMore = false) {
    const container = document.getElementById('content_container');
    const loadMoreBtn = document.getElementById('load_more_container');
    
    if (!isLoadMore && !isPulling) {
        container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
            await fetchNews(isLoadMore);
        } else if (appMode === 'movies') {
            await fetchMovies(isLoadMore);
        }
    } catch (error) {
        console.error(error);
        if (!isLoadMore && !isPulling) showState('error', error.message);
    }
}


// --- 1. ЛОГІКА НОВИН ---
async function fetchNews(isLoadMore) {
    // ... (Тут логіка Newsdata/Gnews як і була, скорочено для ясності) ...
    // Використовуємо global variables: newsPageToken, currentApiSource
    
    let url = '';
    // Проста логіка вибору джерела (можна розширити до backup system)
    if (currentApiSource === 'newsdata') {
        url = `${API_CONFIG.newsdata.url}?apikey=${NEWSDATA_KEY}&language=uk&size=10`;
        if (currentQuery) url += `&q=${currentQuery}`;
        if (currentCategory) url += `&category=${currentCategory}`;
        if (isLoadMore && newsPageToken) url += `&page=${newsPageToken}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`News API Error ${res.status}`);
    const data = await res.json();
    
    const items = data.results.map(item => ({
        type: 'news',
        id: item.link, // Унікальний ID
        title: item.title,
        desc: item.description,
        img: item.image_url,
        date: item.pubDate,
        url: item.link
    }));

    newsPageToken = data.nextPage || null;
    
    if (isLoadMore) feedNews = [...feedNews, ...items];
    else feedNews = items;

    renderList(feedNews, isLoadMore);
    document.getElementById('load_more_container').style.display = newsPageToken ? 'block' : 'none';
}


// --- 2. ЛОГІКА ФІЛЬМІВ (TMDB) ---
async function fetchMovies(isLoadMore) {
    if (!isLoadMore) moviePage = 1;
    else moviePage++;

    let url = `${API_CONFIG.tmdb.url}`;
    
    if (currentQuery) {
        url += `/search/movie?api_key=${TMDB_KEY}&language=uk-UA&query=${currentQuery}&page=${moviePage}`;
    } else {
        url += `/movie/popular?api_key=${TMDB_KEY}&language=uk-UA&page=${moviePage}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Error ${res.status}`);
    const data = await res.json();

    const items = data.results.map(item => ({
        type: 'movie',
        id: item.id,
        title: item.title,
        desc: item.overview,
        img: item.poster_path ? API_CONFIG.tmdb.imgBase + item.poster_path : null,
        date: item.release_date,
        rating: item.vote_average ? item.vote_average.toFixed(1) : '0.0',
        url: `https://www.themoviedb.org/movie/${item.id}` // Посилання на TMDB
    }));

    if (isLoadMore) feedMovies = [...feedMovies, ...items];
    else feedMovies = items;

    renderMovies(feedMovies, isLoadMore);
    document.getElementById('load_more_container').style.display = 'block'; // У TMDB завжди багато сторінок
}


// --- РЕНДЕРИНГ СПИСКУ (Новини і Збережене) ---
function renderList(items, append = false) {
    const container = document.getElementById('content_container');
    // Переконуємось, що ми в режимі списку
    container.className = 'news-container list-view'; 
    
    if (!append) container.innerHTML = '';
    
    if (items.length === 0) {
        if (!append) showState('no_results');
        return;
    }

    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id); // Порівняння з приведенням типів
        const card = document.createElement('div');
        card.className = 'news-card';
        
        // Для новин і фільмів у збереженому відображення схоже
        const imageHtml = item.img ? `<div class="news-image-container"><img src="${item.img}" onerror="this.style.display='none'"></div>` : '';
        const itemData = encodeURIComponent(JSON.stringify(item));

        card.innerHTML = `
            <div class="card-content" onclick="openLink('${item.url}')">
                ${imageHtml}
                <div class="news-text-content">
                    <h3>${item.title}</h3>
                    <p>${item.desc || (item.type === 'movie' ? 'Опис відсутній' : '')}</p>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-actions">
                    <button class="action-btn share-btn" onclick="shareItem('${item.url}', '${item.title.replace(/'/g, "")}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave('${itemData}', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
                <div class="news-date">${item.date ? item.date.substring(0,10) : ''}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- РЕНДЕРИНГ ФІЛЬМІВ (Сітка) ---
function renderMovies(items, append = false) {
    const container = document.getElementById('content_container');
    container.className = 'movies-grid'; // Вмикаємо сітку
    
    if (!append) container.innerHTML = '';
    
    if (items.length === 0) {
        if (!append) showState('no_results');
        return;
    }

    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id);
        const card = document.createElement('div');
        card.className = 'movie-card';
        
        const imgSrc = item.img || 'https://via.placeholder.com/500x750?text=No+Poster';
        const itemData = encodeURIComponent(JSON.stringify(item));

        card.innerHTML = `
            <div style="position: relative;" onclick="openLink('${item.url}')">
                <img src="${imgSrc}" class="movie-poster" alt="${item.title}">
                <div class="movie-rating">★ ${item.rating}</div>
            </div>
            <div class="movie-info">
                <div class="movie-title">${item.title}</div>
                <div class="movie-year">${item.date ? item.date.substring(0,4) : 'N/A'}</div>
                
                <div class="movie-actions">
                    <button class="action-btn share-btn" onclick="shareItem('${item.url}', '${item.title.replace(/'/g, "")}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave('${itemData}', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}


// --- СПІЛЬНІ ФУНКЦІЇ ---

window.openLink = function(url) {
    addPoints(2); // +2 бали за перегляд
    if (window.Telegram && window.Telegram.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
};

window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) navigator.share({ title: title, url: url }).catch(console.error);
    else window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
};

window.toggleSave = function(encodedData, btn) {
    const item = JSON.parse(decodeURIComponent(encodedData));
    const index = savedItems.findIndex(s => s.id == item.id); // Пошук по ID

    if (index === -1) {
        savedItems.push(item);
        btn.classList.add('saved');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
        addPoints(5); // +5 за збереження
    } else {
        savedItems.splice(index, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        if (appMode === 'saved') renderList(savedItems); // У збереженому завжди список
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

window.performSearch = function() {
    const input = document.getElementById('search_input');
    currentQuery = encodeURIComponent(input.value.trim());
    currentCategory = document.getElementById('category_select').value;
    
    // Скидаємо списки при пошуку
    feedNews = [];
    feedMovies = [];
    newsPageToken = null;
    moviePage = 1;
    
    fetchContent();
};

window.loadMore = function() {
    fetchContent(true);
};

// --- PULL TO REFRESH ---
// (Працює аналогічно для обох режимів)
if (ptrSpinner) {
    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && appMode !== 'saved') {
            touchStartY = e.touches[0].clientY;
            isPulling = false;
        }
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
        if (appMode === 'saved') return;
        const touchY = e.touches[0].clientY;
        const pullDistance = touchY - touchStartY;
        if (pullDistance > 0 && window.scrollY === 0) {
            if (pullDistance < 150) ptrSpinner.style.top = `${pullDistance / 2 - 50}px`;
            if (pullDistance > 60) isPulling = true;
        }
    }, { passive: true });
    window.addEventListener('touchend', () => {
        if (isPulling && window.scrollY === 0 && appMode !== 'saved') {
            ptrSpinner.style.top = '10px';
            if (window.Telegram && window.Telegram.WebApp.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            
            feedNews = [];
            feedMovies = [];
            newsPageToken = null;
            moviePage = 1;
            
            fetchContent().then(() => {
                setTimeout(() => { ptrSpinner.style.top = '-50px'; isPulling = false; }, 500);
            });
        } else {
            ptrSpinner.style.top = '-50px';
            isPulling = false;
        }
    });
}

// Старт
switchMode('news');
