import { fetchNewsData, fetchTMDB } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- ГЛОБАЛЬНІ ЗМІННІ СТАНУ ---
let appMode = 'news';
let feedNews = [];
let feedMovies = [];

// Збережене
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];

// Історія переглядів (захист від накрутки)
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
        if (!preloader || preloader.style.display === 'none') {
             container.innerHTML = '<p class="loading-status">Завантаження...</p>';
        }
        loadMoreBtn.style.display = 'none';
    }

    try {
        if (appMode === 'news') {
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
            renderList(isMore ? items : feedNews, container, savedItems, isMore);
            loadMoreBtn.style.display = newsPageToken ? 'block' : 'none';

        } else if (appMode === 'movies') {
            const page = isMore ? moviePage + 1 : 1;
            const data = await fetchTMDB(currentQuery, page);
            
            const items = data.results.map(item => ({
                id: item.id, 
                title: item.title,
                desc: item.overview,
                img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
                rating: item.vote_average.toFixed(1),
                url: `https://www.themoviedb.org/movie/${item.id}`,
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


// --- ГЛОБАЛЬНІ ФУНКЦІЇ ---

// 1. Керування FAB меню
window.toggleFab = function() {
    const wrapper = document.getElementById('fab_wrapper');
    const iconMenu = document.getElementById('icon_menu');
    const iconClose = document.getElementById('icon_close');
    
    // Перемикаємо клас .open
    wrapper.classList.toggle('open');
    
    // Змінюємо іконку
    const isOpen = wrapper.classList.contains('open');
    if (isOpen) {
        iconMenu.style.display = 'none';
        iconClose.style.display = 'block';
        if (window.Telegram?.WebApp?.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    } else {
        iconMenu.style.display = 'block';
        iconClose.style.display = 'none';
    }
};

// 2. Оновлене перемикання вкладок
window.switchMode = function(mode) {
    appMode = mode;
    
    // Підсвічуємо активну кнопку в меню
    const fabItems = document.querySelectorAll('.fab-item');
    fabItems.forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.fab-item[onclick*="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Закриваємо меню
    const wrapper = document.getElementById('fab_wrapper');
    if (wrapper.classList.contains('open')) {
        window.toggleFab();
    }

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

window.openLink = function(url, idEncoded) {
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); 
            viewedItems.push(id.toString()); 
            if (viewedItems.length > 200) viewedItems.shift(); 
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else {
        addPoints(2);
    }

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
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    } else {
        savedItems.splice(idx, 1);
        btn.classList.remove('saved');
        btn.querySelector('svg').setAttribute('fill', 'none');
        addPoints(-5);
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

    if (preloader) {
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.style.display = 'none'; }, 500);
    }
}

initApp();
