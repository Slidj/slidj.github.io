import { fetchNewsData, fetchTMDB } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints, userPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// Глобальні змінні стану
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

// --- ГОЛОВНА ЛОГІКА ---

async function loadContent(isMore = false) {
    if (!isMore) {
        container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
            const data = await fetchNewsData(currentQuery, currentCategory, isMore ? newsPageToken : null);
            
            const items = data.results.map(item => ({
                id: item.link,
                title: item.title,
                desc: item.description, // У новин опис був
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
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id,
                title: item.title,
                // 👇 ОСЬ ТУТ БУЛО ПРОПУЩЕНО ОПИС 👇
                desc: item.overview, 
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
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
        if (!isMore) container.innerHTML = `<div class="empty-state">Помилка: ${e.message}</div>`;
    }
}

// --- ФУНКЦІЇ ДЛЯ HTML (GLOBAL) ---

window.switchMode = function(mode) {
    appMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    let btnId = 'tab_feed';
    if (mode === 'movies') btnId = 'tab_movies';
    if (mode === 'saved') btnId = 'tab_saved';
    document.getElementById(btnId).classList.add('active');

    const filters = document.getElementById('filters_wrapper');
    const catSelect = document.getElementById('category_select');

    container.className = '';

    if (mode === 'news') {
        filters.style.display = 'flex';
        catSelect.classList.remove('hidden');
        if (feedNews.length === 0) loadContent();
        else {
             container.className = 'news-container list-view';
             renderList(feedNews, container, savedItems);
             loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';
        }
    } else if (mode === 'movies') {
        filters.style.display = 'flex';
        catSelect.classList.add('hidden');
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
    loadContent();
};

window.loadMore = function() {
    loadContent(true);
};

window.openLink = function(url) {
    addPoints(2);
    window.Telegram?.WebApp?.openLink(url) || window.open(url, '_blank');
};

window.shareItem = function(url, title) {
    addPoints(10);
    if (navigator.share) navigator.share({ title: title, url: url }).catch(console.error);
    else window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
};

window.toggleSave = function(idEnc, type, btn) {
    const id = decodeURIComponent(idEnc);
    let item;
    
    // Шукаємо об'єкт в поточній стрічці
    if (type === 'news') item = feedNews.find(i => i.id == id);
    else if (type === 'movie') item = feedMovies.find(i => i.id == id);
    
    // Якщо не знайшли в стрічці (наприклад, видаляємо з вкладки збережених), беремо зі збережених
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

// СТАРТ
loadContent();
