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

// --- 🎬 KINOBOX (АГРЕГАТОР З УКР ОЗВУЧКОЮ) ---
function loadKinoboxScript() {
    return new Promise((resolve, reject) => {
        if (window.kbox) { resolve(); return; }
        const script = document.createElement('script');
        script.src = "https://kinobox.tv/kinobox.min.js"; // Офіційний скрипт
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Функція запуску Kinobox
async function initKinoboxPlayer(tmdbId) {
    const container = document.getElementById('kinobox_container');
    if (!container) return;

    try {
        await loadKinoboxScript();
        
        // Очищаємо контейнер перед запуском
        container.innerHTML = '';

        // Запуск Kinobox з налаштуваннями для України
        new window.Kinobox('.kinobox_player', {
            search: { tmdb: tmdbId },
            menu: {
                enable: true, // Показує меню вибору озвучки/якості
                default: 'menu_list',
                mobile: true,
                format: '{N} :: {T} ({Q})'
            },
            players: {
                // Пріоритет джерел (саме тут шукається UA)
                videocdn: { enable: true, position: 1 },
                alloha: { enable: true, position: 2 },
                ashdi: { enable: true, position: 3 },
                collaps: { enable: true, position: 4 },
                hdvb: { enable: true, position: 5 }
            },
            view: { mobile: true }
        }).init();
    } catch (e) {
        console.error("Kinobox Error:", e);
        container.innerHTML = '<div style="color:white; text-align:center; padding:20px;">Не вдалося завантажити плеєр. Спробуйте натиснути "Запасний плеєр".</div>';
    }
}

// --- ПЕРЕМИКАЧ СЕРВЕРІВ ---
window.changeSource = function(type) {
    const iframe = document.getElementById('video_frame');
    const kbox = document.getElementById('kinobox_container');
    const btns = document.querySelectorAll('.server-btn');

    if (type === 'kinobox') {
        // Ховаємо iframe, показуємо Kinobox
        iframe.style.display = 'none';
        iframe.src = '';
        kbox.style.display = 'block';
        if (currentMovieId) initKinoboxPlayer(currentMovieId);
        
        btns[0].style.backgroundColor = '#50a8eb'; btns[0].style.color = 'white';
        btns[1].style.backgroundColor = '#222'; btns[1].style.color = '#888';
    } else {
        // Ховаємо Kinobox, показуємо VidLink
        kbox.style.display = 'none';
        kbox.innerHTML = ''; // Зупиняємо скрипт
        iframe.style.display = 'block';
        if (currentMovieId) iframe.src = `https://vidlink.pro/movie/${currentMovieId}`;
        
        btns[1].style.backgroundColor = '#50a8eb'; btns[1].style.color = 'white';
        btns[0].style.backgroundColor = '#222'; btns[0].style.color = '#888';
    }
};

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    const kbox = document.getElementById('kinobox_container');

    if (iframe) iframe.src = '';
    if (kbox) kbox.innerHTML = ''; // Очищаємо Kinobox
    
    if (modal) modal.style.display = 'none';
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.openPlayer = function(tmdbId) {
    currentMovieId = tmdbId;
    const modal = document.getElementById('player_modal');
    const contentDiv = modal.querySelector('.player-content');
    const fab = document.getElementById('fab_wrapper');

    if (!modal) return;

    // 1. Створюємо контейнер для Kinobox, якщо немає
    let kboxDiv = document.getElementById('kinobox_container');
    if (!kboxDiv) {
        kboxDiv = document.createElement('div');
        kboxDiv.id = 'kinobox_container';
        kboxDiv.className = 'kinobox_player';
        kboxDiv.style.cssText = "width: 100%; height: 100%; min-height: 250px; background: #000;";
        
        // Вставляємо його ПЕРЕД iframe
        const iframe = document.getElementById('video_frame');
        contentDiv.insertBefore(kboxDiv, iframe);
    }

    // 2. Додаємо кнопки перемикання (UA / ENG)
    let controls = document.getElementById('source_controls');
    if (!controls) {
        controls = document.createElement('div');
        controls.id = 'source_controls';
        controls.style.cssText = `
            position: absolute; top: 60px; left: 0; width: 100%; 
            display: flex; justify-content: center; gap: 10px; z-index: 10001;
        `;
        
        const btnUa = document.createElement('button');
        btnUa.className = 'server-btn';
        btnUa.innerText = "🇺🇦 UA (Kinobox)";
        btnUa.onclick = () => window.changeSource('kinobox');
        btnUa.style.cssText = "padding: 8px 15px; border-radius: 20px; border:none; background: #50a8eb; color: white; font-weight: bold; font-size: 12px;";

        const btnEng = document.createElement('button');
        btnEng.className = 'server-btn';
        btnEng.innerText = "🌎 Backup (VidLink)";
        btnEng.onclick = () => window.changeSource('eng');
        btnEng.style.cssText = "padding: 8px 15px; border-radius: 20px; border:none; background: #222; color: #888; font-weight: bold; font-size: 12px;";

        controls.appendChild(btnUa);
        controls.appendChild(btnEng);
        contentDiv.appendChild(controls); // Додаємо кнопки в кінець контейнера, але CSS підніме їх вгору
        
        // Важливо: перемістити controls на початок, щоб не перекривалися плеєром
        contentDiv.insertBefore(controls, contentDiv.firstChild); 
    }

    // 3. Відкриваємо модалку і запускаємо Kinobox за замовчуванням
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
    
    // Запускаємо UA версію
    window.changeSource('kinobox');
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
