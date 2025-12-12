import { fetchNewsData, fetchTMDB } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- ГЛОБАЛЬНІ ЗМІННІ ---
let appMode = 'news';
let feedNews = [];
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
let viewedItems = JSON.parse(localStorage.getItem('viewedItems')) || [];

let newsPageToken = null;
let moviePage = 1;
let currentQuery = '';
let currentCategory = '';

const container = document.getElementById('content_container');
const loadMoreBtn = document.getElementById('load_more_container');

// --- ІНІЦІАЛІЗАЦІЯ TELEGRAM ---
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    const user = tg.initDataUnsafe?.user;
    
    if (user) {
        document.getElementById('header_title').innerText = user.first_name;
        if (user.photo_url) {
            document.getElementById('user_avatar').src = user.photo_url;
            document.getElementById('user_avatar').style.display = 'block';
        } else {
             document.getElementById('default_avatar').style.display = 'flex';
        }
    }
}
updateRankDisplay(); 

// --- ОСНОВНА ФУНКЦІЯ ЗАВАНТАЖЕННЯ ---
async function loadContent(isMore = false) {
    if (!isMore) {
        const preloader = document.getElementById('preloader');
        if (!preloader || preloader.style.display === 'none') {
             container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        }
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
            const data = await fetchNewsData(currentQuery, currentCategory, isMore ? newsPageToken : null);
            
            const items = data.results.map(item => ({
                id: item.link, 
                title: item.title,
                desc: item.description,
                img: item.image_url,
                date: item.pubDate,
                url: item.link,
                type: 'news'
            }));

            newsPageToken = data.nextPage;
            feedNews = isMore ? [...feedNews, ...items] : items;
            
            container.className = 'news-container list-view';
            renderList(isMore ? items : feedNews, container, savedItems, isMore);
            loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';

        } else if (appMode === 'movies') {
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                desc: item.overview,
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                url: `https://www.themoviedb.org/movie/${item.id}`,
                type: 'movie'
            }));

            moviePage = page;
            feedMovies = isMore ? [...feedMovies, ...items] : items;

            container.className = 'movies-grid';
            renderMovies(isMore ? items : feedMovies, container, savedItems, isMore);
            loadMoreBtn.style.display = 'block'; 
        }
    } catch (e) {
        console.error(e);
        if (!isMore) container.innerHTML = `<div class="empty-state"><div class="empty-text">Помилка</div><div class="empty-subtext">${e.message}</div></div>`;
    }
}
// --- КЕРУВАННЯ FAB МЕНЮ ---
window.toggleFab = function() {
    const wrapper = document.getElementById('fab_wrapper');
    const iconMenu = document.getElementById('icon_menu');
    const iconClose = document.getElementById('icon_close');
    
    wrapper.classList.toggle('open');
    
    if (wrapper.classList.contains('open')) {
        iconMenu.style.display = 'none';
        iconClose.style.display = 'block';
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    } else {
        iconMenu.style.display = 'block';
        iconClose.style.display = 'none';
    }
};

// --- ПЕРЕМИКАННЯ ВКЛАДОК (З АНІМАЦІЄЮ FADE) ---
window.switchMode = function(mode) {
    if (appMode === mode) return;

    // 1. Оновлюємо активну іконку в меню
    const fabItems = document.querySelectorAll('.fab-item');
    fabItems.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.fab-item[onclick*="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Закриваємо меню
    const wrapper = document.getElementById('fab_wrapper');
    if (wrapper.classList.contains('open')) {
        window.toggleFab();
    }

    // 2. ЗАПУСКАЄМО АНІМАЦІЮ ЗНИКНЕННЯ
    const container = document.getElementById('content_container');
    container.classList.add('fade-out');

    // 3. Чекаємо 200мс, поки контент зникне
    setTimeout(() => {
        appMode = mode;
        
        const filters = document.getElementById('filters_wrapper');
        const catSelect = document.getElementById('category_select');
        const searchInput = document.getElementById('search_input');

        // Скидаємо класи відображення, але залишаємо fade-out
        container.className = 'fade-out'; 

        // Логіка перемикання блоків
        if (mode === 'news') {
            filters.style.display = 'flex';
            catSelect.classList.remove('hidden');
            searchInput.placeholder = "Пошук новин...";
            
            if (feedNews.length === 0) loadContent();
            else {
                 container.classList.add('news-container', 'list-view');
                 renderList(feedNews, container, savedItems);
                 loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';
            }
        } else if (mode === 'movies') {
            filters.style.display = 'flex';
            catSelect.classList.add('hidden');
            searchInput.placeholder = "Пошук фільмів...";

            if (feedMovies.length === 0) loadContent();
            else {
                container.classList.add('movies-grid');
                renderMovies(feedMovies, container, savedItems);
                loadMoreBtn.style.display = 'block';
            }
        } else { // saved
            filters.style.display = 'none';
            container.classList.add('news-container', 'list-view');
            loadMoreBtn.style.display = 'none';
            renderList(savedItems, container, savedItems);
        }

        // Прокрутка вгору
        window.scrollTo({ top: 0, behavior: 'auto' });

        // 4. ЗАПУСКАЄМО АНІМАЦІЮ ПОЯВИ
        requestAnimationFrame(() => {
            container.classList.remove('fade-out');
        });

    }, 200); // Таймер має співпадати з CSS transition
};
// --- ПОШУК І ЗАВАНТАЖЕННЯ ---
window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    
    feedNews = [];
    feedMovies = [];
    newsPageToken = null;
    moviePage = 1;
    
    loadContent();
};

window.loadMore = function() {
    loadContent(true);
};

// --- ВІДКРИТТЯ ПОСИЛАНЬ (З ІСТОРІЄЮ ПЕРЕГЛЯДІВ) ---
window.openLink = function(url, idEncoded) {
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        
        // Перевіряємо, чи бачили ми це раніше
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); 
            viewedItems.push(id.toString());
            
            // Тримаємо тільки останні 200 записів
            if (viewedItems.length > 200) {
                viewedItems.shift(); 
            }
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else {
        addPoints(2);
    }

    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

// --- ПОДІЛИТИСЯ ---
window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(console.error);
    } else {
        window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
    }
};

// --- ЗБЕРЕЖЕННЯ (ЗАКЛАДКИ) ---
window.toggleSave = function(idEnc, type, btn) {
    const id = decodeURIComponent(idEnc);
    let item;
    
    if (type === 'news') item = feedNews.find(i => i.id == id);
    else if (type === 'movie') item = feedMovies.find(i => i.id == id);
    if (!item) item = savedItems.find(i => i.id == id);

    if (!item) return;

    const idx = savedItems.findIndex(s => s.id == item.id);
    
    if (idx === -1) {
        savedItems.push(item);
        btn.classList.add('saved');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
        addPoints(5);
        if (window.Telegram?.WebApp?.HapticFeedback) 
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } else {
        savedItems.splice(idx, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        addPoints(-5);
        if (window.Telegram?.WebApp?.HapticFeedback) 
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
            
        if (appMode === 'saved') renderList(savedItems, container, savedItems);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

// --- СТАРТ ДОДАТКУ ---
async function initApp() {
    const preloader = document.getElementById('preloader');
    
    // Чекаємо мінімум 2 секунди + завантаження контенту
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 2000));
    const contentPromise = loadContent();

    await Promise.all([contentPromise, minTimePromise]);

    if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.style.display = 'none'; }, 500);
    }
}

initApp();
