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
let currentMovieId = null; 

const container = document.getElementById('content_container');
const loadMoreBtn = document.getElementById('load_more_container');

// --- ІНІЦІАЛІЗАЦІЯ ---
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user) {
        document.getElementById('header_title').innerText = user.first_name;
        if (user.photo_url) document.getElementById('user_avatar').src = user.photo_url;
    }
}
updateRankDisplay(); 

function optimizeImage(url) {
    if (!url) return null;
    if (url.includes('tmdb.org')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover&output=webp`;
}

// --- 🎬 СПИСОК СЕРВЕРІВ (VidLink та резерви) ---
const MOVIE_SERVERS = [
    // 1. VidLink (Сучасний, швидкий, агрегує багато джерел)
    { name: "Server 1 (VidLink)", url: (id) => `https://vidlink.pro/movie/${id}` },
    
    // 2. VidSrc.CC (Новий агрегатор, часто працює там, де інші ні)
    { name: "Server 2 (CC)", url: (id) => `https://vidsrc.cc/v2/embed/movie/${id}` },
    
    // 3. SuperEmbed (Старий добрий надійний варіант, переважно англ)
    { name: "Server 3 (Super)", url: (id) => `https://www.2embed.cc/embed/${id}` }
];

window.changeServer = function(index) {
    const iframe = document.getElementById('video_frame');
    const btns = document.querySelectorAll('.server-btn');
    const server = MOVIE_SERVERS[index];
    
    if (!server || !iframe) return;

    // Оновлюємо кнопки
    btns.forEach((btn, i) => {
        if (i === index) {
            btn.style.backgroundColor = '#50a8eb';
            btn.style.color = 'white';
        } else {
            btn.style.backgroundColor = '#222';
            btn.style.color = '#888';
        }
    });

    // Завантажуємо нове джерело
    if (currentMovieId) {
        iframe.src = server.url(currentMovieId);
        
        // Оновлюємо кнопку "Відкрити в браузері"
        const extBtn = document.getElementById('external_open_btn');
        if (extBtn) {
            extBtn.onclick = function() {
                const link = server.url(currentMovieId);
                if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(link);
                else window.open(link, '_blank');
            };
        }
    }
};

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    
    if (iframe) iframe.src = ''; 
    if (modal) modal.style.display = 'none';
    
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.openPlayer = function(tmdbId) {
    currentMovieId = tmdbId;
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    const fab = document.getElementById('fab_wrapper');
    const contentDiv = modal.querySelector('.player-content');

    if (!modal || !iframe) return;

    // --- МЕНЮ ВИБОРУ СЕРВЕРА ---
    let controls = document.getElementById('server_controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'server_controls';
        controls.style.cssText = `
            position: absolute; top: 60px; left: 0; width: 100%; 
            display: flex; justify-content: center; gap: 8px; 
            z-index: 10001; flex-wrap: wrap; padding: 0 10px; box-sizing: border-box;
            pointer-events: none;
        `;
        
        MOVIE_SERVERS.forEach((server, index) => {
            const btn = document.createElement('button');
            btn.className = 'server-btn';
            btn.innerText = server.name;
            btn.onclick = () => window.changeServer(index);
            btn.style.cssText = `
                pointer-events: auto; padding: 6px 12px; border: 1px solid #444; border-radius: 20px; 
                background: #222; color: #ccc; font-size: 11px; cursor: pointer;
                transition: all 0.2s; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
            `;
            controls.appendChild(btn);
        });
        contentDiv.insertBefore(controls, iframe);
    }

    // --- КНОПКА "ВІДКРИТИ В БРАУЗЕРІ" ---
    let extBtn = document.getElementById('external_open_btn');
    if (!extBtn) {
        extBtn = document.createElement('button');
        extBtn.id = 'external_open_btn';
        extBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:5px; vertical-align:middle;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            Відкрити в браузері
        `;
        extBtn.style.cssText = `
            position: absolute; bottom: 25px; left: 50%; transform: translateX(-50%);
            padding: 8px 16px; border-radius: 20px; border: none;
            background: rgba(255, 59, 48, 0.9); color: white; font-weight: bold; font-size: 12px;
            z-index: 10002; cursor: pointer; backdrop-filter: blur(4px);
            white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        `;
        contentDiv.appendChild(extBtn);
    }

    // Очищаємо всі обмеження, щоб плеєр точно завантажився
    iframe.removeAttribute('sandbox'); 
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    
    // Запускаємо VidLink
    window.changeServer(0);
    
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
};

// --- ВІДКРИТТЯ ПОСИЛАНЬ ---
window.openLink = function(url, idEncoded) {
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

    // Якщо це цифри або TMDB -> Плеєр
    if (/^\d+$/.test(target)) {
        window.openPlayer(target);
        return;
    }
    if (target.includes('themoviedb.org') || target.includes('/movie/')) {
        const matches = target.match(/movie\/(\d+)/);
        if (matches && matches[1]) {
            window.openPlayer(matches[1]);
            return;
        }
    }

    // Новини -> Браузер
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(target);
    else window.open(target, '_blank');
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
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                desc: item.overview,
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
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

// --- ІНТЕРФЕЙС ---
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
        container.className = 'fade-out'; 
        const filters = document.getElementById('filters_wrapper');
        const catSelect = document.getElementById('category_select');
        const searchInput = document.getElementById('search_input');

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
