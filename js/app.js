import { fetchNewsData, fetchTMDB, fetchGoogleSearch } from './api.js';
import { renderList, renderMovies, updateRankDisplay, addPoints } from './ui.js';
import { API_URLS } from './config.js'; 

// --- STATE ---
let currentTab = 'home'; // home, search, saved
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
let moviePage = 1;
let currentHeroMovie = null;
const API_KEY = '4f06fae67ddcf28e2e5b3f91193cb555';

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

// Запуск
initApp();

async function initApp() {
    // 1. Завантажуємо фільми для Головної
    await loadHomeContent();
    // 2. Ховаємо прелоадер
    setTimeout(() => {
        document.getElementById('preloader').style.opacity = '0';
        setTimeout(() => document.getElementById('preloader').style.display = 'none', 500);
    }, 1000);
}

// --- NAVIGATION ---
window.switchMode = function(tab) {
    currentTab = tab;
    
    // UI Updates
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`.nav-item[onclick="switchMode('${tab}')"]`).classList.add('active');

    // Logic
    const content = document.getElementById('content_container');
    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const searchBar = document.getElementById('search_bar_container');

    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex';
        filters.style.display = 'flex';
        searchBar.style.display = 'none';
        renderGrid(feedMovies);
    } else if (tab === 'search') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'block';
        document.getElementById('search_input').focus();
        renderGrid([]); // Пусто спочатку
    } else if (tab === 'saved') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'none';
        renderGrid(savedItems);
    }
};

// --- DATA LOADING ---
async function loadHomeContent() {
    try {
        const data = await fetchTMDB('', 1); // Популярні фільми
        feedMovies = data.results.map(mapTMDB);
        
        // Встановлюємо Hero Movie (перший зі списку)
        if (feedMovies.length > 0) {
            setupHero(feedMovies[0]);
        }
        
        renderGrid(feedMovies);
    } catch (e) {
        console.error(e);
    }
}

// --- RENDER GRID (Netflix Style 3 columns) ---
function renderGrid(items) {
    const container = document.getElementById('content_container');
    container.innerHTML = '';
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card';
        div.onclick = () => window.openMoviePage(item);
        
        const imgUrl = item.img ? item.img : 'https://via.placeholder.com/200x300?text=No+Image';
        
        div.innerHTML = `
            <img src="${imgUrl}" loading="lazy" alt="${item.title}">
            ${item.rating ? `<div class="rating-mini">${item.rating}</div>` : ''}
        `;
        container.appendChild(div);
    });
}

// --- HERO SECTION LOGIC ---
function setupHero(movie) {
    currentHeroMovie = movie;
    const hero = document.getElementById('hero_section');
    // Використовуємо оригінальний TMDB backdrop якщо є
    // Але в нашому mapTMDB ми зберегли тільки poster. Треба хитрити або брати постер.
    // Для кращого вигляду краще зробити окремий запит деталей, але поки візьмемо постер
    // Або краще: візьмемо backdrop з API при завантаженні (я додав це нижче в mapTMDB)
    
    hero.style.backgroundImage = `url('${movie.backdrop || movie.img}')`;
    document.getElementById('hero_title').innerText = movie.title;
}

window.playHeroMovie = function() {
    if(currentHeroMovie) window.openPremiumPlayer(currentHeroMovie.id);
}
window.infoHeroMovie = function() {
    if(currentHeroMovie) window.openMoviePage(currentHeroMovie);
}

// --- MOVIE DETAILS (NETFLIX FULLSCREEN) ---
window.openMoviePage = async function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    modal.style.display = 'flex';
    
    // Запит деталей
    let details = movie;
    let logoUrl = null;
    let trailerKey = null;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images&include_image_language=uk,en,null`);
        const data = await res.json();
        
        details.desc = data.overview;
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

    // HTML Generator
    const titleHtml = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${details.backdropBig || details.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    ${titleHtml}
                    <div class="nf-meta">
                        <span class="nf-match">${details.match || 85}% Match</span>
                        <span>${details.year}</span>
                        <span class="nf-badge">16+</span>
                        <span>${details.runtime || ''}</span>
                    </div>
                </div>
            </div>

            <div class="nf-btn-row">
                <button class="nf-btn nf-play" onclick="openPremiumPlayer('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                    <span>Play</span>
                </button>
                <button class="nf-btn nf-secondary" onclick="searchOnline('${movie.title}')">
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24"><path d="M12 4v16m-8-8h16" stroke="currentColor" stroke-width="2"/></svg>
                    <span>My List / Find</span>
                </button>
            </div>

            <div class="nf-description">${details.desc || 'No description.'}</div>
            
            ${trailerKey ? `
            <div class="nf-trailer" style="margin:20px;">
                <iframe src="https://www.youtube.com/embed/${trailerKey}" frameborder="0" allowfullscreen></iframe>
            </div>` : ''}
            
            <div style="height:50px;"></div>
        </div>
    `;
};

window.closeMoviePage = function() {
    document.getElementById('movie_details_modal').style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = '';
}

// --- PLAYER LOGIC (With KP Conversion) ---
window.openPremiumPlayer = async function(tmdbId, btn) {
    if(btn) btn.style.opacity = 0.5;
    
    try {
        // Convert to KP
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        
        let kpId = null;
        if(data.data && data.data.id_kp) kpId = data.data.id_kp;
        
        if(!kpId) { alert("Server error: Movie ID not found."); if(btn) btn.style.opacity = 1; return; }

        const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
        const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        iframe.src = url;
        modal.style.display = 'flex';

    } catch(e) {
        alert("Connection error");
    }
    if(btn) btn.style.opacity = 1;
};

window.closePlayer = function() {
    document.getElementById('player_modal').style.display = 'none';
    document.getElementById('video_frame').src = '';
}

// --- HELPERS ---
window.searchOnline = function(t) {
    window.open(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`, '_blank');
}

// Mapper for TMDB Data
function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        desc: item.overview,
        img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
        backdrop: item.backdrop_path ? API_URLS.tmdbImg + item.backdrop_path : null, // Зберігаємо backdrop для Hero
        rating: item.vote_average.toFixed(1),
        type: 'movie'
    };
}

// Search Logic
let searchTimeout;
window.performSearchDelayed = function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
        const query = document.getElementById('search_input').value;
        if (!query) return;
        
        const data = await fetchGoogleSearch(query, 1); // Або TMDB Search
        // Для спрощення тут краще використовувати TMDB Search API
        // Але якщо у вас API.js налаштований на Google, ок.
        // Я зроблю припущення, що ми шукаємо через TMDB для кращого вигляду:
        
        const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
        const searchData = await res.json();
        const items = searchData.results.map(mapTMDB);
        renderGrid(items);
        
    }, 500);
}
