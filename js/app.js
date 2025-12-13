// js/app.js - PART 1

// 👇 Додали fetchAllohaPlayer до імпортів
import { fetchNewsData, fetchTMDB, fetchGoogleSearch, fetchAllohaPlayer } from './api.js';
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

// --- ФУНКЦІЯ ОПТИМІЗАЦІЇ ЗОБРАЖЕНЬ ---
function optimizeImage(url) {
    if (!url) return null;
    if (url.includes('tmdb.org')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=200&h=200&fit=cover&output=webp`;
}

// --- 🎬 ЛОГІКА ВІДЕО ПЛЕЄРА (ALLOHA) ---
window.openPlayer = async function(tmdbId) {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    
    // Показуємо вікно завантаження
    modal.style.display = 'flex';
    document.getElementById('fab_wrapper').style.display = 'none'; // Ховаємо меню
    
    try {
        iframe.src = ''; // Очищаємо старе
        
        // 1. Запитуємо посилання у Alloha
        // (Якщо виникне помилка CORS або токена - спрацює catch)
        const videoUrl = await fetchAllohaPlayer(tmdbId);
        
        // 2. Вставляємо посилання в плеєр
        iframe.src = videoUrl;
        
    } catch (e) {
        console.error("Alloha Error:", e);
        
        // ЗАПАСНИЙ ВАРІАНТ (VidSrc), якщо Alloha не спрацювала
        console.log("Спроба запустити запасний плеєр...");
        iframe.src = `https://vidsrc.xyz/embed/movie/${tmdbId}`;
    }
};

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    
    iframe.src = ''; // Зупиняємо відео
    modal.style.display = 'none';
    
    // Повертаємо меню
    document.getElementById('fab_wrapper').style.display = 'flex';
};
// js/app.js - PART 2

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
            
            // --- НОВИНИ: GOOGLE vs СТАНДАРТ ---
            if (currentQuery) {
                const pageNum = isMore ? googlePage + 1 : 1;
                const googleData = await fetchGoogleSearch(currentQuery, pageNum);
                
                if (googleData.items) {
                    items = googleData.items.map(item => {
                        let rawUrl = null;
                        if (item.pagemap?.cse_thumbnail?.length > 0) rawUrl = item.pagemap.cse_thumbnail[0].src;
                        else if (item.pagemap?.cse_image?.length > 0) rawUrl = item.pagemap.cse_image[0].src;

                        return {
                            id: item.link, title: item.title, desc: item.snippet,
                            img: optimizeImage(rawUrl), 
                            date: "З інтернету", url: item.link, type: 'news'
                        };
                    });
                }
                googlePage = pageNum;
                loadMoreBtn.style.display = items.length > 0 ? 'block' : 'none';

            } else {
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
            // --- ФІЛЬМИ (TMDB + ALLOHA ID) ---
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                desc: item.overview,
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                
                // 👇 ВАЖЛИВО: Зберігаємо чистий ID для плеєра
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
// js/app.js - PART 3

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

// --- ПЕРЕМИКАННЯ ВКЛАДОК (АНІМАЦІЯ) ---
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
        requestAnimationFrame(() => { container.classList.remove('fade-out'); });
    }, 200);
};

// --- ДІЇ КОРИСТУВАЧА ---
window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    feedNews = []; feedMovies = []; newsPageToken = null; googlePage = 1; moviePage = 1;
    loadContent();
};

window.loadMore = function() { loadContent(true); };

// 👇 ОНОВЛЕНЕ ВІДКРИТТЯ (Посилання або Плеєр)
window.openLink = function(urlOrId, idEncoded) {
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); viewedItems.push(id.toString());
            if (viewedItems.length > 200) viewedItems.shift(); 
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else addPoints(2);

    const target = urlOrId.toString();

    // Якщо це число (ID фільму) -> відкриваємо плеєр
    // (Перевіряємо, чи НЕ починається з http)
    if (!target.startsWith('http')) {
        window.openPlayer(target);
    } else {
        // Якщо це лінк (новина) -> браузер
        if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(target);
        else window.open(target, '_blank');
    }
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
