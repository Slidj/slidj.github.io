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

// --- ІНІЦІАЛІЗАЦІЯ ---
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.enableClosingConfirmation(); // Запитувати перед закриттям
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

// --- 🎬 СТОРІНКА ФІЛЬМУ (ВЛАСНИЙ ДИЗАЙН) ---

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    // Очищаємо вміст
    const page = document.getElementById('movie_page_content');
    if (page) page.remove();
    
    if (modal) modal.style.display = 'none';
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.openMoviePage = function(movie) {
    const modal = document.getElementById('player_modal');
    const fab = document.getElementById('fab_wrapper');
    const contentDiv = modal.querySelector('.player-content');

    // Прибираємо старий iframe якщо він там є
    const iframe = document.getElementById('video_frame');
    if (iframe) iframe.style.display = 'none';

    // Очищаємо попередній контент
    const oldPage = document.getElementById('movie_page_content');
    if (oldPage) oldPage.remove();

    // --- ГЕНЕРУЄМО ДИЗАЙН ---
    const page = document.createElement('div');
    page.id = 'movie_page_content';
    
    // Стилі для контейнера (щоб був скрол, якщо опис довгий)
    page.style.cssText = `
        width: 100%; height: 100%; overflow-y: auto;
        display: flex; flex-direction: column; 
        background: #111; color: white; border-radius: 12px;
        position: relative;
    `;

    // Фон (Backdrop) - беремо картинку фільму і розмиваємо
    const backdropUrl = movie.img || ''; 
    
    page.innerHTML = `
        <div style="
            position: absolute; top: 0; left: 0; width: 100%; height: 250px;
            background-image: url('${backdropUrl}'); background-size: cover; background-position: center;
            opacity: 0.4; mask-image: linear-gradient(to bottom, black, transparent);
            -webkit-mask-image: linear-gradient(to bottom, black, transparent);
            z-index: 0;
        "></div>

        <button onclick="closePlayer()" style="
            position: absolute; top: 15px; right: 15px; z-index: 10;
            background: rgba(0,0,0,0.5); border: none; color: white;
            width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
            font-size: 20px; display: flex; align-items: center; justify-content: center;
        ">&times;</button>

        <div style="z-index: 1; padding: 20px; margin-top: 100px;">
            
            <div style="display: flex; gap: 15px; align-items: flex-end; margin-bottom: 20px;">
                <img src="${movie.img}" style="
                    width: 100px; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                    border: 2px solid rgba(255,255,255,0.1);
                ">
                <div>
                    <h1 style="margin: 0; font-size: 22px; line-height: 1.2;">${movie.title}</h1>
                    <div style="color: #ffd700; margin-top: 5px; font-weight: bold;">★ ${movie.rating || '0.0'}</div>
                </div>
            </div>

            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0; color: #888; font-size: 12px; text-transform: uppercase;">Про фільм</h4>
                <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #ddd;">
                    ${movie.desc || 'Опис відсутній.'}
                </p>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button onclick="searchOnline('${movie.title}')" style="
                    padding: 14px; border-radius: 12px; border: none; font-weight: bold;
                    background: linear-gradient(90deg, #34c759, #30b350); color: white;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                    box-shadow: 0 4px 10px rgba(52, 199, 89, 0.3);
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Знайти (UaKino / Eneyida)
                </button>

                <button onclick="openTrailer('${movie.title}')" style="
                    padding: 14px; border-radius: 12px; border: none; font-weight: bold;
                    background: rgba(255,255,255,0.1); color: white;
                    display: flex; align-items: center; justify-content: center; gap: 10px;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                    Трейлер YouTube
                </button>

                <button onclick="openTMDB('${movie.id}')" style="
                    padding: 14px; border-radius: 12px; border: none; font-weight: bold;
                    background: transparent; color: #50a8eb; border: 1px solid #50a8eb;
                ">
                    Деталі на TMDB
                </button>
            </div>
            
            <div style="height: 50px;"></div> </div>
    `;

    contentDiv.appendChild(page);
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
};

// --- ФУНКЦІЇ ДЛЯ КНОПОК ---
window.searchOnline = function(title) {
    // Шукаємо в Google по українських сайтах (найкращий варіант)
    const url = `https://www.google.com/search?q=дивитися+онлайн+українською+${encodeURIComponent(title)}+eneyida+uakino`;
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
};

window.openTrailer = function(title) {
    const url = `https://www.youtube.com/results?search_query=трейлер+українською+${encodeURIComponent(title)}`;
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
};

window.openTMDB = function(id) {
    const url = `https://www.themoviedb.org/movie/${id}`;
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
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

    // 1. ПЕРЕВІРКА: Це ID фільму? -> ВІДКРИВАЄМО НАШУ СТОРІНКУ
    if (/^\d+$/.test(target)) {
        let movie = feedMovies.find(m => m.id == target);
        // Якщо фільм не знайдено (наприклад з збережених), робимо об'єкт з мінімумом
        if (!movie) {
            // Шукаємо в збережених
            movie = savedItems.find(m => m.id == target);
        }
        if (movie) {
            window.openMoviePage(movie);
            return;
        }
    }
    
    // Стара перевірка посилань
    if (target.includes('themoviedb.org') || target.includes('/movie/')) {
        const matches = target.match(/movie\/(\d+)/);
        if (matches && matches[1]) {
            const id = matches[1];
            let movie = feedMovies.find(m => m.id == id) || savedItems.find(m => m.id == id);
            if (movie) {
                window.openMoviePage(movie);
                return;
            }
        }
    }

    // Якщо це просто посилання (новина)
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
                
                // Передаємо ID
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
