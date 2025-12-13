import { fetchGoogleSearch } from './api.js'; 
// Прибрали fetchTMDB з імпорту, щоб не конфліктувало. Будемо робити прямий запит тут.
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
    // Налаштування кольорів Telegram
    if (tg.setHeaderColor) tg.setHeaderColor('#000000');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#000000');
    
    if(tg.initDataUnsafe?.user?.photo_url) {
        const ava = document.getElementById('user_avatar');
        const def = document.getElementById('default_avatar');
        if (ava && def) {
            ava.src = tg.initDataUnsafe.user.photo_url;
            ava.style.display = 'block';
            def.style.display = 'none';
        }
    }
}

// Запуск при завантаженні сторінки
initApp();

async function initApp() {
    console.log("App started...");
    
    // Запобіжник: якщо за 4 секунди нічого не завантажиться - прибираємо спінер примусово
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (preloader && preloader.style.display !== 'none') {
            console.warn("Forcing loader hide...");
            preloader.style.display = 'none';
        }
    }, 4000);

    try {
        // 1. Завантажуємо фільми для Головної
        await loadHomeContent();
    } catch (e) {
        console.error("Critical Init Error:", e);
    } finally {
        // 2. Ховаємо прелоадер у будь-якому випадку
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.style.opacity = '0';
            setTimeout(() => preloader.style.display = 'none', 500);
        }
    }
}

// --- NAVIGATION ---
window.switchMode = function(tab) {
    currentTab = tab;
    
    // UI Updates
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeBtn = document.querySelector(`.nav-item[onclick="switchMode('${tab}')"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Logic
    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const searchBar = document.getElementById('search_bar_container');
    const content = document.getElementById('content_container');

    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex';
        filters.style.display = 'flex';
        searchBar.style.display = 'none';
        renderGrid(feedMovies); // Повертаємо фільми головної
    } else if (tab === 'search') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'block';
        const input = document.getElementById('search_input');
        if (input) input.focus();
        content.innerHTML = '<div style="color:#777; text-align:center; padding:20px;">Введіть назву для пошуку...</div>';
    } else if (tab === 'saved') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'none';
        if (savedItems.length === 0) {
            content.innerHTML = '<div style="color:#777; text-align:center; padding:20px;">Тут поки порожньо</div>';
        } else {
            renderGrid(savedItems);
        }
    }
};

window.setCategory = function(cat) {
    // Проста імітація категорій для прикладу
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.cat-btn[onclick="setCategory('${cat}')"]`);
    if(btn) btn.classList.add('active');
    
    // Тут можна додати логіку фільтрації feedMovies
    alert("Категорії поки в розробці");
};

// --- DATA LOADING (DIRECT TMDB) ---
async function loadHomeContent() {
    try {
        // Прямий запит на Тренди (щоб не залежати від api.js)
        const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=uk-UA`);
        const data = await response.json();
        
        if (data.results) {
            feedMovies = data.results.map(mapTMDB);
            
            // Встановлюємо Hero Movie (перший зі списку)
            if (feedMovies.length > 0) {
                setupHero(feedMovies[0]);
            }
            
            renderGrid(feedMovies);
        }
    } catch (e) {
        console.error("Home Load Error:", e);
        document.getElementById('content_container').innerHTML = '<div style="color:red; text-align:center;">Помилка завантаження. Перевірте інтернет.</div>';
    }
}

// --- RENDER GRID ---
function renderGrid(items) {
    const container = document.getElementById('content_container');
    if (!container) return;
    container.innerHTML = '';
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card';
        div.onclick = () => window.openMoviePage(item);
        
        const imgUrl = item.img ? item.img : 'https://via.placeholder.com/200x300?text=No+Image';
        const rating = item.rating ? item.rating.toFixed(1) : '';

        div.innerHTML = `
            <img src="${imgUrl}" loading="lazy" alt="${item.title}">
            ${rating ? `<div class="rating-mini">${rating}</div>` : ''}
        `;
        container.appendChild(div);
    });
}

// --- HERO SECTION LOGIC ---
function setupHero(movie) {
    currentHeroMovie = movie;
    const hero = document.getElementById('hero_section');
    if (!hero) return;

    // Використовуємо backdrop
    const bgImage = movie.backdrop || movie.img;
    hero.style.backgroundImage = `url('${bgImage}')`;
    
    const titleEl = document.getElementById('hero_title');
    if (titleEl) titleEl.innerText = movie.title;
    
    const metaEl = document.getElementById('hero_meta');
    if (metaEl) metaEl.innerText = `Trending • ${movie.rating ? movie.rating.toFixed(1) : ''}`;
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
    
    if (!modal || !content) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Початковий стан з тими даними, що вже є
    content.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100vh;color:#888;background:#000;">Завантаження...</div>';

    // Запит деталей
    let details = movie;
    let logoUrl = null;
    let trailerKey = null;

    try {
        // Отримуємо повні деталі
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images&include_image_language=uk,en,null`);
        
        if (res.ok) {
            const data = await res.json();
            details.desc = data.overview || movie.desc;
            details.year = data.release_date?.split('-')[0] || '2025';
            details.match = Math.round(data.vote_average * 10);
            details.runtime = data.runtime ? `${Math.floor(data.runtime/60)} год ${data.runtime%60} хв` : '';
            details.backdropBig = data.backdrop_path ? API_URLS.tmdbImg + data.backdrop_path : (movie.backdrop || movie.img);

            // Шукаємо лого
            if (data.images?.logos?.length > 0) {
                const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
                logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
            }
            
            // Шукаємо трейлер
            if (data.videos?.results) {
                const tr = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
                if(tr) trailerKey = tr.key;
            }
        }
    } catch (e) { console.error("Details Error", e); }

    // HTML Generator
    const titleHtml = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;
    const bgImage = details.backdropBig || details.img;

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${bgImage}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    ${titleHtml}
                    <div class="nf-meta">
                        <span class="nf-match">${details.match || 80}% Match</span>
                        <span>${details.year || ''}</span>
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
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <span>Знайти на Eneyida</span>
                </button>
            </div>

            <div class="nf-description">${details.desc || 'Опис відсутній.'}</div>
            
            ${trailerKey ? `
            <div class="nf-trailer">
                <iframe src="https://www.youtube.com/embed/${trailerKey}?modestbranding=1&rel=0&controls=1" frameborder="0" allowfullscreen></iframe>
            </div>` : ''}
            
            <div style="height:50px;"></div>
        </div>
    `;
    
    // Кнопка назад в ТГ
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

window.closeMoviePage = function() {
    document.getElementById('movie_details_modal').style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = '';
    document.body.style.overflow = '';
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.hide();
    }
}

// --- PLAYER LOGIC (With KP Conversion) ---
window.openPremiumPlayer = async function(tmdbId, btn) {
    if(btn) btn.style.opacity = 0.5;
    
    try {
        // 1. Convert TMDB -> KP
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        
        let kpId = null;
        if(data.data && data.data.id_kp) kpId = data.data.id_kp;
        
        if(!kpId) { 
            alert("Фільм не знайдено в базі плеєра."); 
            if(btn) btn.style.opacity = 1; 
            return; 
        }

        // 2. Open Player
        const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
        const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        iframe.src = url;
        modal.style.display = 'flex';

    } catch(e) {
        alert("Помилка з'єднання");
    }
    if(btn) btn.style.opacity = 1;
};

window.closePlayer = function() {
    document.getElementById('player_modal').style.display = 'none';
    document.getElementById('video_frame').src = '';
}

// --- HELPERS ---
window.searchOnline = function(t) {
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`);
    else window.open(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`, '_blank');
}

// Mapper for TMDB Data
function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        desc: item.overview,
        img: item.poster_path ? API_URLS.tmdbImg + item.poster_path : null,
        backdrop: item.backdrop_path ? API_URLS.tmdbImg + item.backdrop_path : null,
        rating: item.vote_average,
        type: item.media_type || 'movie'
    };
}

// Search Logic
let searchTimeout;
window.performSearchDelayed = function() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('search_input').value;
    
    if (!query) {
        renderGrid([]);
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
            const searchData = await res.json();
            const items = searchData.results.filter(i => i.media_type !== 'person').map(mapTMDB);
            renderGrid(items);
        } catch(e) { console.error(e); }
    }, 600);
}
