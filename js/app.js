import { fetchNewsData, fetchTMDB } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- ГЛОБАЛЬНІ ЗМІННІ СТАНУ ---
let appMode = 'news';
let feedNews = [];
let feedMovies = [];

// Завантажуємо збережене
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];

// Завантажуємо історію переглядів (щоб не накручували бали)
let viewedItems = JSON.parse(localStorage.getItem('viewedItems')) || [];

let newsPageToken = null;
let moviePage = 1;

let currentQuery = '';
let currentCategory = '';

// Елементи DOM
const container = document.getElementById('content_container');
const loadMoreBtn = document.getElementById('load_more_container');

// --- ІНІЦІАЛІЗАЦІЯ TELEGRAM ---
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    const user = tg.initDataUnsafe?.user;
    
    if (user) {
        // Встановлюємо ім'я
        const headerTitle = document.getElementById('header_title');
        if (headerTitle) headerTitle.innerText = user.first_name;
        
        // Встановлюємо аватар
        const avatarImg = document.getElementById('user_avatar');
        const defaultAvatar = document.getElementById('default_avatar');
        
        if (user.photo_url && avatarImg) {
            avatarImg.src = user.photo_url;
            avatarImg.style.display = 'block';
            if (defaultAvatar) defaultAvatar.style.display = 'none';
        } else {
             if (defaultAvatar) defaultAvatar.style.display = 'flex';
        }
    }
}
updateRankDisplay(); // Оновлюємо ранги при старті

// --- ОСНОВНА ЛОГІКА ЗАВАНТАЖЕННЯ ---
async function loadContent(isMore = false) {
    // Якщо це не дозавантаження, керуємо відображенням статусу
    if (!isMore) {
        const preloader = document.getElementById('preloader');
        // Якщо прелоадер вже зник, показуємо текст "Завантаження..."
        if (!preloader || preloader.style.display === 'none') {
             container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        }
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
            // ================== НОВИНИ ==================
            const data = await fetchNewsData(currentQuery, currentCategory, isMore ? newsPageToken : null);
            
            const items = data.results.map(item => ({
                id: item.link, // ID новини = її посилання
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
            
            // 👇 ВИПРАВЛЕНО: Якщо isMore, передаємо тільки нові items, інакше весь feedNews
            renderList(isMore ? items : feedNews, container, savedItems, isMore);
            
            loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';

        } else if (appMode === 'movies') {
            // ================== КІНО ==================
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id, // ID фільму = число
                title: item.title,
                desc: item.overview, // Зберігаємо опис!
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                // Формуємо правильне посилання на сайт TMDB для людей
                url: `https://www.themoviedb.org/movie/${item.id}`,
                type: 'movie'
            }));

            moviePage = page;
            feedMovies = isMore ? [...feedMovies, ...items] : items;

            container.className = 'movies-grid';
            
            // 👇 ВИПРАВЛЕНО: Якщо isMore, передаємо тільки нові items, інакше весь feedMovies
            renderMovies(isMore ? items : feedMovies, container, savedItems, isMore);
            
            loadMoreBtn.style.display = 'block'; // У TMDB майже завжди є наступні сторінки
        }
    } catch (e) {
        console.error(e);
        if (!isMore) container.innerHTML = `<div class="empty-state"><div class="empty-text">Помилка</div><div class="empty-subtext">${e.message}</div></div>`;
    }
}


// --- ГЛОБАЛЬНІ ФУНКЦІЇ (Attached to window) ---

// 1. Перемикання вкладок
window.switchMode = function(mode) {
    appMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    let btnId = 'tab_feed';
    if (mode === 'movies') btnId = 'tab_movies';
    if (mode === 'saved') btnId = 'tab_saved';
    document.getElementById(btnId).classList.add('active');

    const filters = document.getElementById('filters_wrapper');
    const catSelect = document.getElementById('category_select');
    const searchInput = document.getElementById('search_input');

    container.className = '';

    if (mode === 'news') {
        filters.style.display = 'flex';
        catSelect.classList.remove('hidden');
        searchInput.placeholder = "Пошук новин...";
        
        if (feedNews.length === 0) loadContent();
        else {
             container.className = 'news-container list-view';
             renderList(feedNews, container, savedItems);
             loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';
        }
    } else if (mode === 'movies') {
        filters.style.display = 'flex';
        catSelect.classList.add('hidden');
        searchInput.placeholder = "Пошук фільмів...";

        if (feedMovies.length === 0) loadContent();
        else {
            container.className = 'movies-grid';
            renderMovies(feedMovies, container, savedItems);
            loadMoreBtn.style.display = 'block';
        }
    } else { // saved
        filters.style.display = 'none';
        container.className = 'news-container list-view';
        loadMoreBtn.style.display = 'none';
        renderList(savedItems, container, savedItems);
    }
};

// 2. Пошук
window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    
    // Скидаємо списки при новому пошуку
    feedNews = [];
    feedMovies = [];
    newsPageToken = null;
    moviePage = 1;
    
    loadContent();
};

// 3. Кнопка "Завантажити ще"
window.loadMore = function() {
    loadContent(true);
};

// 4. Відкриття посилання (з оптимізацією пам'яті)
window.openLink = function(url, idEncoded) {
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        
        // Перевіряємо, чи переглядали ми це раніше
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); // Нараховуємо бали
            viewedItems.push(id.toString()); // Додаємо в історію
            
            // 🛡️ ОПТИМІЗАЦІЯ: Тримаємо тільки останні 200 записів
            if (viewedItems.length > 200) {
                viewedItems.shift(); // Видаляємо найстаріший запис
            }
            
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else {
        // Fallback для старих елементів без ID
        addPoints(2);
    }

    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

// 5. Поділитися
window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(console.error);
    } else {
        window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
    }
};

// 6. Зберегти / Видалити
window.toggleSave = function(idEnc, type, btn) {
    const id = decodeURIComponent(idEnc);
    let item;
    
    // Шукаємо об'єкт в поточних списках
    if (type === 'news') item = feedNews.find(i => i.id == id);
    else if (type === 'movie') item = feedMovies.find(i => i.id == id);
    
    // Якщо не знайшли (наприклад, ми у вкладці збережених), шукаємо в збережених
    if (!item) item = savedItems.find(i => i.id == id);

    if (!item) return;

    const idx = savedItems.findIndex(s => s.id == item.id);
    
    if (idx === -1) {
        // ЗБЕРІГАЄМО
        savedItems.push(item);
        btn.classList.add('saved');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
        addPoints(5);
        
        if (window.Telegram?.WebApp?.HapticFeedback) 
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } else {
        // ВИДАЛЯЄМО
        savedItems.splice(idx, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        addPoints(-5); // Забираємо бали назад
        
        if (window.Telegram?.WebApp?.HapticFeedback) 
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
            
        // Якщо ми на вкладці збережених - оновлюємо список відразу
        if (appMode === 'saved') renderList(savedItems, container, savedItems);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

// --- СТАРТ ДОДАТКУ ---
async function initApp() {
    const preloader = document.getElementById('preloader');
    
    // Чекаємо мінімум 2 секунди (щоб показати відео) + завантаження контенту
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 5000));
    const contentPromise = loadContent();

    await Promise.all([contentPromise, minTimePromise]);

    // Прибираємо заставку
    if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.style.display = 'none'; }, 500);
    }
}

// Запуск
initApp();
