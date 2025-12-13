import { fetchNewsData, fetchTMDB, fetchGoogleSearch } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- ГЛОБАЛЬНІ ЗМІННІ ---
let appMode = 'news';
let feedNews = [];
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
let viewedItems = JSON.parse(localStorage.getItem('viewedItems')) || [];

let newsPageToken = null;
let googlePage = 1;
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

// --- ОПТИМІЗАЦІЯ КАРТИНОК ---
function optimizeImage(url) {
    if (!url) return null;
    if (url.includes('tmdb.org')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover&output=webp`;
}

// --- 🎬 ЛОГІКА ПЛЕЄРА (VIDSRC) ---
window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    
    if (iframe) iframe.src = ''; 
    if (modal) modal.style.display = 'none';
    
    // Повертаємо меню FAB
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.openPlayer = function(tmdbId) {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    const fab = document.getElementById('fab_wrapper');

    if (!modal || !iframe) return;

    // Вставляємо посилання на плеєр
    iframe.src = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
};

// --- ВІДКРИТТЯ (Плеєр або Сайт) ---
window.openLink = function(url, idEncoded) {
    // 1. Статистика
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); viewedItems.push(id.toString());
            if (viewedItems.length > 200) viewedItems.shift(); 
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else {
        addPoints(2);
    }

    const target = url.toString();

    // 2. ПЕРЕВІРКА: Це ID фільму?
    // Якщо це просто цифри (наприклад "550") -> Вмикаємо плеєр
    if (/^\d+$/.test(target)) {
        window.openPlayer(target);
        return;
    }

    // Якщо це старе посилання TMDB -> Пробуємо витягнути ID
    if (target.includes('themoviedb.org') || target.includes('/movie/')) {
        const matches = target.match(/movie\/(\d+)/);
        if (matches && matches[1]) {
            window.openPlayer(matches[1]);
            return;
        }
    }

    // 3. Якщо це новина -> Відкриваємо браузер
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(target);
    } else {
        window.open(target, '_blank');
    }
};

// --- ЗАВАНТАЖЕННЯ ДАНИХ ---
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
            // ... НОВИНИ ...
            let items = [];
            if (currentQuery) {
                const pageNum = isMore ? googlePage + 1 : 1;
                const googleData = await fetchGoogleSearch(currentQuery, pageNum);
                if (googleData.items) {
                    items = googleData.items.map(item => {
                        let rawUrl = item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src;
                        return { id: item.link, title: item.title, desc: item.snippet, img: optimizeImage(rawUrl), date: "Web", url: item.link, type: 'news' };
                    });
                }
                googlePage = pageNum;
                loadMoreBtn.style.display = items.length > 0 ? 'block' : 'none';
            } else {
                const data = await fetchNewsData('', currentCategory, isMore ? newsPageToken : null);
                items = data.results.map(item => ({ id: item.link, title: item.title, desc: item.description, img: optimizeImage(item.image_url), date: item.pubDate, url: item.link, type: 'news' }));
                newsPageToken = data.nextPage;
                loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';
            }
            feedNews = isMore ? [...feedNews, ...items] : items;
            container.className = 'news-container list-view';
            renderList(isMore ? items : feedNews, container, savedItems, isMore);

        } else if (appMode === 'movies') {
            // ... ФІЛЬМИ ...
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                desc: item.overview,
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                
                // 👇 ТУТ ГОЛОВНА ЗМІНА:
                // Ми записуємо ТІЛЬКИ ID (число), а не посилання.
                // Це змусить openLink запустити плеєр.
                url: item.id, 
                
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

// --- FAB МЕНЮ ---
window.toggleFab = function() {
    const wrapper = document.getElementById('fab_wrapper');
    const iconMenu = document.getElementById('icon_menu');
    const iconClose = document.getElementById('icon_close');
    wrapper.classList.toggle('open');
    if (wrapper.classList.contains('open')) {
        iconMenu.style.display = 'none'; iconClose.style.display = 'block';
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    } else {
        iconMenu.style.display = 'block'; iconClose.style.display = 'none';
    }
};

window.switchMode = function(mode) {
    if (appMode === mode) return;
    const fabItems = document.querySelectorAll('.fab-item');
    fabItems.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.fab-item[onclick*="${mode}"]`)?.classList.add('active');

    const wrapper = document.getElementById('fab_wrapper');
    if (wrapper.classList.contains('open')) window.toggleFab();

    const container = document.getElementById('content_container');
    container.classList.add('fade-out');

    setTimeout(() => {
        appMode = mode;
        const filters = document.getElementById('filters_wrapper');
        const catSelect = document.getElementById('category_select');
        const searchInput = document.getElementById('search_input');

        container.className = 'fade-out'; 

        if (mode === 'news') {
            filters.style.display = 'flex'; catSelect.classList.remove('hidden'); searchInput.placeholder = "Пошук новин...";
            if (feedNews.length === 0) loadContent();
            else { 
                container.classList.add('news-container', 'list-view'); 
                renderList(feedNews, container, savedItems); 
                loadMoreBtn.style.display = (newsPageToken || (currentQuery && feedNews.length > 0)) ? 'block' : 'none';
            }
        } else if (mode === 'movies') {
            filters.style.display = 'flex'; catSelect.classList.add('hidden'); searchInput.placeholder = "Пошук фільмів...";
            if (feedMovies.length === 0) loadContent();
            else { 
                container.classList.add('movies-grid'); 
                renderMovies(feedMovies, container, savedItems); 
                loadMoreBtn.style.display = 'block'; 
            }
        } else { 
            filters.style.display = 'none'; container.classList.add('news-container', 'list-view'); 
            loadMoreBtn.style.display = 'none'; renderList(savedItems, container, savedItems);
        }

        window.scrollTo({ top: 0, behavior: 'auto' });
        requestAnimationFrame(() => container.classList.remove('fade-out'));
    }, 200);
};

window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    feedNews = []; feedMovies = []; newsPageToken = null; googlePage = 1; moviePage = 1;
    loadContent();
};

window.loadMore = function() { loadContent(true); };

window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) navigator.share({ title: title, url: url }).catch(console.error);
    else window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
};

window.toggleSave = function(idEnc, type, btn) {
    const id = decodeURIComponent(idEnc);
    let item;
    if (type === 'news') item = feedNews.find(i => i.id == id);
    else if (type === 'movie') item = feedMovies.find(i => i.id == id);
    if (!item) item = savedItems.find(i => i.id == id);
    if (!item) return;

    const idx = savedItems.findIndex(s => s.id == item.id);
    if (idx === -1) {
        savedItems.push(item); btn.classList.add('saved'); btn.querySelector('svg').setAttribute('fill', 'currentColor'); addPoints(5);
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } else {
        savedItems.splice(idx, 1); btn.classList.remove('saved'); btn.querySelector('svg').setAttribute('fill', 'none'); addPoints(-5);
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged();
        if (appMode === 'saved') renderList(savedItems, container, savedItems);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

async function initApp() {
    const preloader = document.getElementById('preloader');
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 2000));
    const contentPromise = loadContent();
    await Promise.all([contentPromise, minTimePromise]);
    if (preloader) { preloader.classList.add('fade-out'); setTimeout(() => { preloader.style.display = 'none'; }, 500); }
}

initApp();
