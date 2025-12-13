import { fetchNewsData, fetchTMDB, fetchGoogleSearch } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- STATE ---
let currentTab = 'home';
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
const API_KEY = '4f06fae67ddcf28e2e5b3f91193cb555';
let currentHeroMovie = null;

// --- INIT ---
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#000000');
    tg.setBackgroundColor('#000000');
    if(tg.initDataUnsafe?.user?.photo_url) {
        document.getElementById('user_avatar').src = tg.initDataUnsafe.user.photo_url;
        document.getElementById('user_avatar').style.display = 'block';
        document.getElementById('default_avatar').style.display = 'none';
    }
}

// ЗАПУСК
initApp();

async function initApp() {
    // 1. Вмикаємо головну вкладку ОДРАЗУ
    switchMode('home'); 

    // 2. Завантажуємо контент
    await loadHomeContent();
    
    // 3. Ховаємо прелоадер
    setTimeout(() => {
        const loader = document.getElementById('preloader');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }
    }, 800);
}

// --- NAVIGATION ---
window.switchMode = function(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // Знаходимо кнопку (безпечно)
    const btns = document.querySelectorAll('.nav-item');
    if (tab === 'home' && btns[0]) btns[0].classList.add('active');
    if (tab === 'search' && btns[1]) btns[1].classList.add('active');
    if (tab === 'saved' && btns[2]) btns[2].classList.add('active');

    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const searchBar = document.getElementById('search_bar_container');
    const content = document.getElementById('content_container');

    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex';
        filters.style.display = 'flex';
        searchBar.style.display = 'none';
        content.style.display = 'grid';
        if(feedMovies.length > 0) renderGrid(feedMovies);
    } else if (tab === 'search') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'block';
        content.innerHTML = '';
        document.getElementById('search_input').focus();
    } else if (tab === 'saved') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'none';
        content.style.display = 'grid';
        renderGrid(savedItems);
    }
};

// --- DATA ---
async function loadHomeContent() {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=uk-UA`);
        const data = await response.json();
        
        if (data.results) {
            feedMovies = data.results.map(mapTMDB);
            if (feedMovies.length > 0) setupHero(feedMovies[0]);
            renderGrid(feedMovies);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderGrid(items) {
    const container = document.getElementById('content_container');
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card';
        div.onclick = () => window.openMoviePage(item);
        div.innerHTML = `<img src="${item.img}" loading="lazy"><div class="rating-mini">${item.rating}</div>`;
        container.appendChild(div);
    });
}

function setupHero(movie) {
    currentHeroMovie = movie;
    const hero = document.getElementById('hero_section');
    const bg = movie.backdrop || movie.img;
    hero.style.backgroundImage = `url('${bg}')`;
    document.getElementById('hero_title').innerText = movie.title;
    document.getElementById('hero_meta').innerText = `Trending • ${movie.rating}`;
}

window.playHeroMovie = function() {
    if(currentHeroMovie) window.openPremiumPlayer(currentHeroMovie.id, null);
}
window.infoHeroMovie = function() {
    if(currentHeroMovie) window.openMoviePage(currentHeroMovie);
}

// --- MOVIE PAGE (SCROLL FIX) ---
window.openMoviePage = async function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    
    // Вмикаємо модалку
    modal.style.display = 'block'; // Block для скролу!
    document.body.style.overflow = 'hidden'; // Блокуємо скрол фону
    
    // Лоадер
    content.innerHTML = '<div style="height:100vh; display:flex; justify-content:center; align-items:center; color:#777;">Завантаження...</div>';

    // Дані
    let details = movie;
    let logoUrl = null;
    let trailerKey = null;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images&include_image_language=uk,en,null`);
        const data = await res.json();
        
        details.desc = data.overview || movie.desc;
        details.year = data.release_date?.split('-')[0] || '2025';
        details.match = Math.round(data.vote_average * 10);
        details.runtime = data.runtime ? `${Math.floor(data.runtime/60)} год ${data.runtime%60} хв` : '';
        details.backdropBig = data.backdrop_path ? API_URLS.tmdbImg + data.backdrop_path : (movie.backdrop || movie.img);

        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }
        if (data.videos?.results) {
            const tr = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
            if(tr) trailerKey = tr.key;
        }
    } catch (e) { console.error(e); }

    const headerElement = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${details.backdropBig || details.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    ${headerElement}
                    <div class="nf-meta">
                        <span class="nf-match">${details.match || 80}% Match</span>
                        <span>${details.year}</span>
                        <span class="nf-badge">HD</span>
                        <span>${details.runtime || ''}</span>
                    </div>
                </div>
            </div>

            <div class="nf-btn-row">
                <button class="nf-btn nf-play" onclick="openPremiumPlayer('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                    <span>ДИВИТИСЬ</span>
                </button>
                <button class="nf-btn nf-secondary" onclick="searchOnline('${movie.title}')">
                    <span>Пошук</span>
                </button>
            </div>

            <div class="nf-description">${details.desc || 'Опис відсутній.'}</div>
            
            ${trailerKey ? `
            <div class="nf-trailer">
                <iframe src="https://www.youtube.com/embed/${trailerKey}?modestbranding=1&rel=0&controls=1" frameborder="0" allowfullscreen></iframe>
            </div>` : ''}
        </div>
    `;
    
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

window.closeMoviePage = function() {
    document.getElementById('movie_details_modal').style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = '';
    document.body.style.overflow = '';
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
};

// --- PLAYER ---
window.openPremiumPlayer = async function(tmdbId, btn) {
    const originalText = btn ? btn.querySelector('span').innerText : "";
    
    // ВІЗУАЛЬНИЙ ЕФЕКТ НАТИСКАННЯ
    if(btn) {
        btn.style.opacity = 0.6;
        btn.querySelector('span').innerText = "Запуск...";
    }

    try {
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        
        let kpId = null;
        if(data.data && data.data.id_kp) kpId = data.data.id_kp;
        
        if(!kpId) { 
            alert("Файл не знайдено.");
            if(btn) { btn.style.opacity = 1; btn.querySelector('span').innerText = originalText; }
            return; 
        }

        const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
        const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        
        // ХОВАЄМО ДЕТАЛІ, ПОКАЗУЄМО ПЛЕЄР
        document.getElementById('movie_details_modal').style.display = 'none';
        iframe.src = url;
        modal.style.display = 'flex'; // Flex для центрування

    } catch(e) {
        alert("Помилка з'єднання");
    }
    
    if(btn) { btn.style.opacity = 1; btn.querySelector('span').innerText = originalText; }
};

window.closePlayer = function() {
    document.getElementById('player_modal').style.display = 'none';
    document.getElementById('video_frame').src = '';
    // Повертаємо вікно деталей
    document.getElementById('movie_details_modal').style.display = 'block';
}

// Helpers
function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        desc: item.overview,
        img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
        backdrop: item.backdrop_path ? API_URLS.tmdbImg + item.backdrop_path : null,
        rating: item.vote_average.toFixed(1),
        type: item.media_type || 'movie'
    };
}

window.searchOnline = function(t) {
    window.open(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`, '_blank');
}

// Search Logic
let searchTimeout;
window.performSearchDelayed = function() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query) { renderGrid([]); return; }

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
            const searchData = await res.json();
            const items = searchData.results.filter(i => i.media_type !== 'person').map(mapTMDB);
            renderGrid(items);
        } catch(e) { console.error(e); }
    }, 600);
}
