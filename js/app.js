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
let currentMovie = null; // Зберігаємо дані про вибраний фільм

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

// --- ФУНКЦІОНАЛ МЕНЮ ВИБОРУ (HUB) ---

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    // Очищаємо вміст, щоб не висіли старі кнопки
    const content = document.getElementById('hub_content');
    if (content) content.remove();
    
    if (modal) modal.style.display = 'none';
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.openHub = function(movie) {
    const modal = document.getElementById('player_modal');
    const fab = document.getElementById('fab_wrapper');
    const contentDiv = modal.querySelector('.player-content');

    // Ховаємо iframe, якщо він там залишився від старих експериментів
    const oldIframe = document.getElementById('video_frame');
    if (oldIframe) oldIframe.style.display = 'none';

    // Очищаємо попереднє меню
    const oldHub = document.getElementById('hub_content');
    if (oldHub) oldHub.remove();

    // Створюємо гарне меню
    const hub = document.createElement('div');
    hub.id = 'hub_content';
    hub.style.cssText = `
        display: flex; flex-direction: column; gap: 15px; 
        width: 100%; max-width: 300px; margin: 0 auto; padding: 20px 0;
    `;

    // Заголовок
    const title = document.createElement('h3');
    title.innerText = movie.title;
    title.style.cssText = "color: white; text-align: center; margin: 0 0 10px 0;";
    hub.appendChild(title);

    // Функція для створення кнопок
    const createBtn = (text, color, icon, url) => {
        const btn = document.createElement('button');
        btn.innerHTML = `${icon} ${text}`;
        btn.style.cssText = `
            padding: 12px; border: none; border-radius: 12px;
            background: ${color}; color: white; font-weight: bold; font-size: 14px;
            cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2); transition: transform 0.1s;
        `;
        btn.onclick = () => {
            if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
            else window.open(url, '_blank');
        };
        // Ефект натискання
        btn.onmousedown = () => btn.style.transform = "scale(0.98)";
        btn.onmouseup = () => btn.style.transform = "scale(1)";
        return btn;
    };

    // 1. Кнопка Eneyida
    hub.appendChild(createBtn(
        "Дивитись на Eneyida", 
        "#ff9500", // Помаранчевий
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        `https://eneyida.tv/index.php?do=search&subaction=search&story=${encodeURIComponent(movie.title)}`
    ));

    // 2. Кнопка UaKino
    hub.appendChild(createBtn(
        "Дивитись на UaKino", 
        "#34c759", // Зелений
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
        `https://uakino.club/index.php?do=search&subaction=search&story=${encodeURIComponent(movie.title)}`
    ));

    // 3. Кнопка YouTube (Трейлер)
    hub.appendChild(createBtn(
        "Трейлер (YouTube)", 
        "#ff3b30", // Червоний
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>`,
        `https://www.youtube.com/results?search_query=трейлер+українською+${encodeURIComponent(movie.title)}`
    ));

    // 4. Кнопка TMDB (Інфо)
    hub.appendChild(createBtn(
        "Про фільм (TMDB)", 
        "#0a84ff", // Синій
        `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
        `https://www.themoviedb.org/movie/${movie.id}`
    ));

    contentDiv.appendChild(hub);

    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
};


// --- ВІДКРИТТЯ ---
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

    // ПЕРЕВІРКА: Це фільм?
    if (/^\d+$/.test(target)) {
        // Знаходимо фільм у масиві, щоб взяти назву
        let movie = feedMovies.find(m => m.id == target);
        // Якщо раптом не знайшли (рідкісний кейс), створюємо заглушку
        if (!movie) movie = { id: target, title: "Фільм" };
        
        window.openHub(movie);
        return;
    }
    
    // Якщо прийшло старе посилання TMDB
    if (target.includes('themoviedb.org') || target.includes('/movie/')) {
        const matches = target.match(/movie\/(\d+)/);
        if (matches && matches[1]) {
            let movie = feedMovies.find(m => m.id == matches[1]);
            if (!movie) movie = { id: matches[1], title: "Фільм" };
            window.openHub(movie);
            return;
        }
    }

    // Новини -> Просто відкриваємо
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(target);
    else window.open(target, '_blank');
};


// --- ЗАВАНТАЖЕННЯ ДАНИХ (Стандартне) ---
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
                
                // Зберігаємо ID. Відкриватиметься наше нове меню Hub
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

// --- ІНТЕРФЕЙС (Стандартний) ---
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
