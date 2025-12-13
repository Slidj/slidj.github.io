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
    tg.enableClosingConfirmation();
    
    // Встановлюємо чорний колір хедера для краси
    if (tg.setHeaderColor) tg.setHeaderColor('#000000');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#000000');

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

// --- ФУНКЦІЯ ОПТИМІЗАЦІЇ ЗОБРАЖЕНЬ ---
function optimizeImage(url) {
    if (!url) return null;
    if (url.includes('tmdb.org')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover&output=webp`;
}

// --- 🎬 ЛОГІКА КАРТКИ ФІЛЬМУ (HUB) ---

window.closeMoviePage = function() {
    const modal = document.getElementById('movie_details_modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Повертаємо скрол основній сторінці
    }
    
    // Показуємо FAB меню
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
    
    // Ховаємо кнопку "Назад" в Telegram
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
    }
};

window.openMoviePage = function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    const fab = document.getElementById('fab_wrapper');

    if (!modal || !content) return;

    // Ховаємо скрол на основній сторінці
    document.body.style.overflow = 'hidden';

    // Підготовка даних
    const backdrop = movie.img || ''; 
    const rating = movie.rating || 'N/A';
    
    // Малюємо картку
    content.innerHTML = `
        <div class="movie-backdrop" style="background-image: url('${backdrop}');"></div>
        
        <div class="movie-info-block">
            <h1 class="movie-main-title">${movie.title}</h1>
            
            <div class="movie-meta-row">
                <span class="rating-badge">IMDb ${rating}</span>
                <span>Фільм</span>
                <span>ID: ${movie.id}</span>
            </div>

            <p class="movie-desc-text">
                ${movie.desc || 'Опис відсутній. Перейдіть до перегляду, щоб дізнатися більше.'}
            </p>

            <div class="movie-actions-row">
                <button class="btn-primary-action" onclick="searchOnline('${movie.title}')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    Знайти (Eneyida / UaKino)
                </button>

                <button class="btn-secondary-action" onclick="openTrailer('${movie.title}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                    Трейлер
                </button>

                <button class="btn-secondary-action" onclick="openTMDB('${movie.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    Інформація TMDB
                </button>
            </div>
        </div>
    `;

    // Відкриваємо
    modal.style.display = 'flex';
    
    // Ховаємо кнопку меню (FAB), щоб не заважала
    if (fab) fab.style.display = 'none';

    // Вмикаємо системну кнопку "Назад" в Telegram
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

// --- ФУНКЦІЇ ДЛЯ КНОПОК КАРТКИ ---
window.searchOnline = function(title) {
    // Розумний пошук через Google по українських сайтах
    const query = `дивитися онлайн українською ${title} (eneyida OR uakino OR hdrezka)`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
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
                // GOOGLE SEARCH
                const pageNum = isMore ? googlePage + 1 : 1;
                const googleData = await fetchGoogleSearch(currentQuery, pageNum);
                
                if (googleData.items) {
                    items = googleData.items.map(item => {
                        let rawUrl = null;
                        if (item.pagemap?.cse_thumbnail?.length > 0) rawUrl = item.pagemap.cse_thumbnail[0].src;
                        else if (item.pagemap?.cse_image?.length > 0) rawUrl = item.pagemap.cse_image[0].src;

                        return {
                            id: item.link, title: item.title, desc: item.snippet,
                            img: optimizeImage(rawUrl), date: "З інтернету", url: item.link, type: 'news'
                        };
                    });
                }
                googlePage = pageNum;
                loadMoreBtn.style.display = items.length > 0 ? 'block' : 'none';

            } else {
                // STANDARD NEWS
                const data = await fetchNewsData('', currentCategory, isMore ? newsPageToken : null);
                items = data.results.map(item => ({
                    id: item.link, title: item.title, desc: item.description,
                    img: item.image_url ? optimizeImage(item.image_url) : null,
                    date: item.pubDate, url: item.link, type: 'news'
                }));
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
                url: item.id, // Зберігаємо ID, щоб потім знайти фільм
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
        iconMenu.style.display = 'none'; iconClose.style.display = 'block';
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    } else {
        iconMenu.style.display = 'block'; iconClose.style.display = 'none';
    }
};

// --- ПЕРЕМИКАННЯ ВКЛАДОК ---
window.switchMode = function(mode) {
    if (appMode === mode) return;

    const fabItems = document.querySelectorAll('.fab-item');
    fabItems.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.fab-item[onclick*="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');

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
            filters.style.display = 'none'; 
            container.classList.add('news-container', 'list-view'); 
            loadMoreBtn.style.display = 'none';
            renderList(savedItems, container, savedItems);
        }

        window.scrollTo({ top: 0, behavior: 'auto' });
        requestAnimationFrame(() => {
            container.classList.remove('fade-out');
        });

    }, 200);
};

window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    feedNews = []; feedMovies = []; newsPageToken = null; googlePage = 1; moviePage = 1;
    loadContent();
};

window.loadMore = function() { loadContent(true); };

// --- ОНОВЛЕНА ФУНКЦІЯ ВІДКРИТТЯ (Головна логіка) ---
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

    // 1. ПЕРЕВІРЯЄМО, ЧИ ЦЕ ФІЛЬМ (за ID або посиланням TMDB)
    
    // Якщо прийшло просто число (ID)
    if (/^\d+$/.test(target)) {
        let movie = feedMovies.find(m => m.id == target);
        // Якщо не знайшли в стрічці, шукаємо в збережених
        if (!movie) movie = savedItems.find(m => m.id == target);
        // Якщо все одно немає (рідкісний випадок), робимо об'єкт-заглушку
        if (!movie) movie = { id: target, title: "Фільм", desc: "Деталі завантажуються...", img: "" };
        
        window.openMoviePage(movie);
        return;
    }
    
    // Якщо прийшло посилання на TMDB
    if (target.includes('themoviedb.org') || target.includes('/movie/')) {
        const matches = target.match(/movie\/(\d+)/);
        if (matches && matches[1]) {
            const id = matches[1];
            let movie = feedMovies.find(m => m.id == id) || savedItems.find(m => m.id == id);
            if (!movie) movie = { id: id, title: "Фільм", desc: "...", img: "" };
            
            window.openMoviePage(movie);
            return;
        }
    }

    // 2. ЯКЩО ЦЕ НОВИНА -> ВІДКРИВАЄМО В БРАУЗЕРІ
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(target); 
    else window.open(target, '_blank');
};

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
