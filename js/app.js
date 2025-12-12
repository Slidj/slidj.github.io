import { fetchNewsData, fetchTMDB } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints, userPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- ГЛОБАЛЬНІ ЗМІННІ ---
let appMode = 'news';
let feedNews = [];
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];

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
        const headerTitle = document.getElementById('header_title');
        if (headerTitle) headerTitle.innerText = user.first_name;
        
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
updateRankDisplay(); 

// --- ОСНОВНА ЛОГІКА ЗАВАНТАЖЕННЯ ---
async function loadContent(isMore = false) {
    if (!isMore) {
        const preloader = document.getElementById('preloader');
        // Якщо прелоадер вже зник, показуємо текст завантаження
        if (!preloader || preloader.style.display === 'none') {
             container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        }
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
            // 1. НОВИНИ
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
            renderList(feedNews, container, savedItems, isMore);
            loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';

        } else if (appMode === 'movies') {
            // 2. КІНО
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                desc: item.overview, 
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                
                // 👇 ОСЬ ТУТ БУЛА ПРОБЛЕМА. ТЕПЕР ТУТ ТОЧНО ПОСИЛАННЯ НА САЙТ 👇
                url: `https://www.themoviedb.org/movie/${item.id}`,
                
                type: 'movie'
            }));

            moviePage = page;
            feedMovies = isMore ? [...feedMovies, ...items] : items;

            container.className = 'movies-grid';
            renderMovies(feedMovies, container, savedItems, isMore);
            loadMoreBtn.style.display = 'block'; 
        }
    } catch (e) {
        console.error(e);
        if (!isMore) container.innerHTML = `<div class="empty-state"><div class="empty-text">Помилка</div><div class="empty-subtext">${e.message}</div></div>`;
    }
}


// --- ГЛОБАЛЬНІ ФУНКЦІЇ ---

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

window.openLink = function(url) {
    addPoints(2);
    // Примусово відкриваємо в новому вікні, якщо це не Telegram-посилання
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openLink(url);
    } else {
        window.open(url, '_blank');
    }
};

window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(console.error);
    } else {
        window.Telegram?.WebApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
    }
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
        savedItems.push(item);
        btn.classList.add('saved');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
        addPoints(5);
    } else {
        savedItems.splice(idx, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        addPoints(-5);
        if (appMode === 'saved') renderList(savedItems, container, savedItems);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

// ПРЕЛОАДЕР ТА СТАРТ
async function initApp() {
    const preloader = document.getElementById('preloader');
    
    // Чекаємо 2 секунди + завантаження
    const minTimePromise = new Promise(resolve => setTimeout(resolve, 6000));
    const contentPromise = loadContent();

    await Promise.all([contentPromise, minTimePromise]);

    if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.style.display = 'none'; }, 500);
    }
}

initApp();
