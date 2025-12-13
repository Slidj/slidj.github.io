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
const API_KEY = '4f06fae67ddcf28e2e5b3f91193cb555'; // Твій ключ TMDB

// --- ІНІЦІАЛІЗАЦІЯ ---
if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.enableClosingConfirmation();
    if (tg.setHeaderColor) tg.setHeaderColor('#000000');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#000000');

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

// --- 🎬 ЛОГІКА КАРТКИ ФІЛЬМУ (HUB) ---

window.closeMoviePage = function() {
    const modal = document.getElementById('movie_details_modal');
    // Очищаємо iframe трейлера
    const content = document.getElementById('movie_details_content');
    if (content) content.innerHTML = ''; 
    
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; 
    }
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
};

// 🔥 ГОЛОВНА ФУНКЦІЯ ВІДКРИТТЯ КАРТКИ
window.openMoviePage = async function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    const fab = document.getElementById('fab_wrapper');

    if (!modal || !content) return;

    // 1. Показуємо стан завантаження
    modal.style.display = 'flex';
    if (fab) fab.style.display = 'none';
    document.body.style.overflow = 'hidden';
    content.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:white;">Завантаження деталей...</div>';

    // 2. Отримуємо повні деталі з TMDB (Трейлер, Час, Вік, ЛОГОТИПИ)
    let details = {};
    let logoUrl = null;

    try {
        // Додали images до запиту
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,release_dates,images&include_image_language=uk,en,null`);
        details = await res.json();

        // Шукаємо логотип (спочатку укр, потім англ)
        if (details.images && details.images.logos && details.images.logos.length > 0) {
            const logo = details.images.logos.find(l => l.iso_639_1 === 'uk') || details.images.logos.find(l => l.iso_639_1 === 'en') || details.images.logos[0];
            if (logo) logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }

    } catch (e) {
        console.error("Помилка деталей:", e);
        details = movie; 
    }

    // 3. Обробка даних
    const backdrop = details.backdrop_path ? API_URLS.tmdbImg + details.backdrop_path : (movie.img || '');
    const title = details.title || movie.title;
    const desc = details.overview || movie.desc || 'Опис відсутній.';
    const year = details.release_date ? details.release_date.split('-')[0] : 'N/A';
    
    // Час
    const runtime = details.runtime ? `${Math.floor(details.runtime/60)} год ${details.runtime%60} хв` : '';
    
    // Рейтинг
    const voteAvg = details.vote_average || 0;
    const votePercent = Math.round(voteAvg * 10);
    const ringColor = votePercent >= 70 ? '#21d07a' : (votePercent >= 40 ? '#d2d531' : '#db2360');
    
    // Вік
    let ageRating = '';
    if (details.release_dates && details.release_dates.results) {
        const uaRelease = details.release_dates.results.find(r => r.iso_3166_1 === 'UA') || details.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (uaRelease && uaRelease.release_dates.length > 0) {
            ageRating = uaRelease.release_dates[0].certification;
        }
    }
    
    // Трейлер
    let trailerKey = null;
    if (details.videos && details.videos.results) {
        const trailer = details.videos.results.find(v => v.site === "YouTube" && v.type === "Trailer");
        if (trailer) trailerKey = trailer.key;
    }

    // 4. Малюємо HTML
    // ЛОГІКА ЗАГОЛОВКУ: Якщо є картинка-лого -> показуємо її, якщо ні -> показуємо текст h1
    const headerHtml = logoUrl 
        ? `<img src="${logoUrl}" class="movie-logo-img" alt="${title}">` 
        : `<h1 class="movie-main-title">${title}</h1>`;

    content.innerHTML = `
        <div class="movie-backdrop" style="background-image: url('${backdrop}');"></div>
        
        <div class="movie-info-block">
            ${headerHtml}
            
            <div class="meta-tags">
                <div class="rating-circle" style="background: conic-gradient(${ringColor} ${votePercent}%, #333 ${votePercent}% 100%);">
                    <div style="background:#0d253f; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                        ${votePercent}<span style="font-size:8px; margin-top:2px;">%</span>
                    </div>
                </div>

                <div class="meta-tag">${year}</div>
                ${runtime ? `<div class="meta-tag">${runtime}</div>` : ''}
                ${ageRating ? `<div class="age-limit">${ageRating}</div>` : ''}
            </div>

            <p class="movie-desc-text">
                ${desc}
            </p>

            <div class="movie-actions-row">
                <button class="btn-primary-action btn-gold" onclick="openPremiumPlayer('${movie.id}', this)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="margin-right:10px;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    ДИВИТИСЬ
                </button>

                <button class="btn-secondary-action" onclick="searchOnline('${title}')" style="justify-content: space-between;">
                    <span>Знайти на Eneyida / UaKino</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
            </div>

            ${trailerKey ? `
                <div class="trailer-container">
                    <iframe src="https://www.youtube.com/embed/${trailerKey}?modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe>
                </div>
            ` : ''}
            
            <div style="height: 50px;"></div>
        </div>
    `;

    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

// --- ІНШІ ФУНКЦІЇ ---

window.openPremiumPlayer = async function(tmdbId, btnElement) {
    const originalText = btnElement ? btnElement.innerHTML : "ДИВИТИСЬ";
    if (btnElement) btnElement.innerHTML = "Завантаження...";

    let kpId = null;
    try {
        const response = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await response.json();
        if (data.status === 'success' && data.data && data.data.id_kp) {
            kpId = data.data.id_kp;
        } else {
            alert("Файл не знайдено. Спробуйте кнопку 'Знайти'.");
            if (btnElement) btnElement.innerHTML = originalText;
            return;
        }
    } catch (e) {
        alert("Помилка з'єднання.");
        if (btnElement) btnElement.innerHTML = originalText;
        return;
    }

    if (kpId) {
        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        const moviePage = document.getElementById('movie_details_modal');

        if (moviePage) moviePage.style.display = 'none';

        const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
        const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

        iframe.src = url;
        modal.style.display = 'flex';
        
        const closeBtn = modal.querySelector('.close-player');
        closeBtn.onclick = function() {
            modal.style.display = 'none';
            iframe.src = '';
            if (moviePage) moviePage.style.display = 'flex';
        };
    }
    
    if (btnElement) btnElement.innerHTML = originalText;
};

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.src = '';
    const fab = document.getElementById('fab_wrapper');
    if (fab) fab.style.display = 'flex';
};

window.searchOnline = function(title) {
    const query = `дивитися онлайн українською ${title} (eneyida OR uakino OR hdrezka)`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(url);
    else window.open(url, '_blank');
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
                        let rawUrl = null;
                        if (item.pagemap?.cse_thumbnail?.length > 0) rawUrl = item.pagemap.cse_thumbnail[0].src;
                        else if (item.pagemap?.cse_image?.length > 0) rawUrl = item.pagemap.cse_image[0].src;
                        return { id: item.link, title: item.title, desc: item.snippet, img: optimizeImage(rawUrl), date: "З інтернету", url: item.link, type: 'news' };
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
        const filters = document.getElementById('filters_wrapper');
        const catSelect = document.getElementById('category_select');
        const searchInput = document.getElementById('search_input');
        container.className = 'fade-out'; 
        if (mode === 'news') {
            filters.style.display = 'flex'; catSelect.classList.remove('hidden'); searchInput.placeholder = "Пошук новин...";
            if (feedNews.length === 0) loadContent(); else { container.classList.add('news-container', 'list-view'); renderList(feedNews, container, savedItems); loadMoreBtn.style.display = (newsPageToken || (currentQuery && feedNews.length > 0)) ? 'block' : 'none'; }
        } else if (mode === 'movies') {
            filters.style.display = 'flex'; catSelect.classList.add('hidden'); searchInput.placeholder = "Пошук фільмів...";
            if (feedMovies.length === 0) loadContent(); else { container.classList.add('movies-grid'); renderMovies(feedMovies, container, savedItems); loadMoreBtn.style.display = 'block'; }
        } else { filters.style.display = 'none'; container.classList.add('news-container', 'list-view'); loadMoreBtn.style.display = 'none'; renderList(savedItems, container, savedItems); }
        window.scrollTo({ top: 0, behavior: 'auto' });
        requestAnimationFrame(() => { container.classList.remove('fade-out'); });
    }, 200);
};

window.performSearch = function() {
    currentQuery = document.getElementById('search_input').value.trim();
    currentCategory = document.getElementById('category_select').value;
    feedNews = []; feedMovies = []; newsPageToken = null; googlePage = 1; moviePage = 1;
    loadContent();
};

window.loadMore = function() { loadContent(true); };

window.openLink = function(url, idEncoded) {
    if (idEncoded) {
        const id = decodeURIComponent(idEncoded);
        if (!viewedItems.includes(id.toString())) {
            addPoints(2); viewedItems.push(id.toString());
            if (viewedItems.length > 200) viewedItems.shift(); 
            localStorage.setItem('viewedItems', JSON.stringify(viewedItems));
        }
    } else addPoints(2);

    const target = url.toString();
    if (/^\d+$/.test(target)) {
        let movie = feedMovies.find(m => m.id == target);
        if (!movie) movie = savedItems.find(m => m.id == target);
        if (!movie) movie = { id: target, title: "Фільм", desc: "Деталі завантажуються...", img: "" };
        window.openMoviePage(movie);
        return;
    }
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
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(target); else window.open(target, '_blank');
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
