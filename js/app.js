// ============================================================
// 🎬 MEDIA HUB: APP CORE (SMART BUTTON NO ALERTS)
// ============================================================

// --- АВАРІЙНИЙ ВИХІД ---
setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader && preloader.style.display !== 'none') {
        preloader.style.display = 'none';
    }
}, 4000);

// --- 1. НАЛАШТУВАННЯ ---
const API_KEY = '4f06fae67ddcf28e2e5b3f91193cb555';
const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_URL = 'https://image.tmdb.org/t/p/w1280'; 

let currentTab = 'home';
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
let currentHeroMovie = null;
let searchTimeout;

let currentPage = 1;
let isLoading = false;
let currentGenre = '';
let cachedKpId = null; 

// --- 2. ЗАПУСК ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        try {
            tg.ready(); tg.expand();
            if(tg.setHeaderColor) tg.setHeaderColor('#000000');
            if(tg.setBackgroundColor) tg.setBackgroundColor('#000000');
            if(tg.initDataUnsafe?.user?.photo_url) {
                const ava = document.getElementById('user_avatar');
                const def = document.getElementById('default_avatar');
                if(ava) { ava.src = tg.initDataUnsafe.user.photo_url; ava.style.display = 'block'; }
                if(def) def.style.display = 'none';
            }
        } catch(e) {}
    }

    setupInfiniteScroll(); 
    switchMode('home'); 
    
    try {
        await loadHomeContent(1);
    } catch(e) {}

    const preloader = document.getElementById('preloader');
    if(preloader) {
        preloader.style.opacity = '0';
        setTimeout(() => preloader.style.display = 'none', 500);
    }
}

// --- 3. СКРОЛ ---
function setupInfiniteScroll() {
    const trigger = document.getElementById('infinite_trigger');
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && currentTab === 'home' && !isLoading) {
            currentPage++;
            loadHomeContent(currentPage, true);
        }
    }, { threshold: 0.1 });

    if(trigger) observer.observe(trigger);
}

// --- 4. НАВІГАЦІЯ ---
window.switchMode = function(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(tab==='home' && navs[0]) navs[0].classList.add('active');
    if(tab==='search' && navs[1]) navs[1].classList.add('active');
    if(tab==='saved' && navs[2]) navs[2].classList.add('active');

    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const search = document.getElementById('search_bar_container');
    const content = document.getElementById('content_container');
    const trigger = document.getElementById('infinite_trigger');

    if (!hero || !content) return;

    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex';
        filters.style.display = 'flex';
        search.style.display = 'none';
        content.style.display = 'grid';
        if(trigger) trigger.style.display = 'flex';
        if (content.children.length === 0) {
            currentPage = 1;
            loadHomeContent(1);
        }
    } 
    else if (tab === 'search') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        search.style.display = 'block';
        content.style.display = 'grid';
        if(trigger) trigger.style.display = 'none';
        content.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Пошук...</div>';
    } 
    else if (tab === 'saved') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        search.style.display = 'none';
        content.style.display = 'grid';
        if(trigger) trigger.style.display = 'none';
        if (savedItems.length === 0) {
            content.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Список пустий</div>';
        } else {
            renderGrid(savedItems, false);
        }
    }
};

window.setCategory = function(catId) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.cat-btn');
    for(let btn of btns) {
        if(btn.getAttribute('onclick').includes(catId)) btn.classList.add('active');
    }
    currentGenre = catId;
    currentPage = 1;
    document.getElementById('content_container').innerHTML = ''; 
    loadHomeContent(1); 
};

// --- 5. ДАНІ ---
async function loadHomeContent(page = 1, isAppend = false) {
    isLoading = true;
    const loader = document.getElementById('scroll_loader');
    if(loader) loader.style.display = 'block';

    try {
        let url = '';
        if (currentGenre === '') {
            url = `https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=uk-UA&page=${page}`;
        } else if (currentGenre === 'movie') {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&page=${page}`;
        } else if (currentGenre === 'tv') {
            url = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&page=${page}`;
        } else {
            url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&with_genres=${currentGenre}&sort_by=popularity.desc&page=${page}`;
        }

        const response = await fetch(url);
        const data = await response.json();
        
        if (data.results) {
            const items = data.results.map(mapTMDB);
            if (page === 1 && !isAppend && items.length > 0) {
                const rand = Math.floor(Math.random() * Math.min(5, items.length));
                setupHero(items[rand]);
            }
            renderGrid(items, isAppend);
        }
    } catch (e) {} finally {
        isLoading = false;
        if(loader) loader.style.display = 'none';
    }
}

function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        desc: item.overview,
        img: item.poster_path ? TMDB_IMG_URL + item.poster_path : 'https://via.placeholder.com/200x300?text=No+Img',
        backdrop: item.backdrop_path ? TMDB_BACKDROP_URL + item.backdrop_path : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '----').split('-')[0],
        type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
    };
}

function renderGrid(items, isAppend) {
    const container = document.getElementById('content_container');
    if (!container) return;
    
    if (!isAppend) container.innerHTML = '';
    
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
    const title = document.getElementById('hero_title');
    const meta = document.getElementById('hero_meta');
    
    if (hero && movie) {
        const bg = movie.backdrop || movie.img;
        hero.style.backgroundImage = `url('${bg}')`;
        if(title) title.innerText = movie.title;
        if(meta) meta.innerText = `🔥 Trending • ${movie.year}`;
        preloadKpId(movie.id); 
    }
}

window.playHeroMovie = function() {
    if (currentHeroMovie) window.openPremiumPlayer(currentHeroMovie.id, null);
};
window.infoHeroMovie = function() {
    if (currentHeroMovie) window.openMoviePage(currentHeroMovie);
};

window.performSearchDelayed = function() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query || query.length < 2) return;

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
            const data = await res.json();
            if (data.results) {
                const results = data.results.filter(i => i.media_type !== 'person' && i.poster_path).map(mapTMDB);
                renderGrid(results, false);
            }
        } catch (e) {}
    }, 600);
};

// --- 6. PRELOAD & DETAILS ---
async function preloadKpId(tmdbId) {
    cachedKpId = null; 
    try {
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        if(data.data && data.data.id_kp) {
            cachedKpId = data.data.id_kp;
        }
    } catch(e) {}
}

window.openMoviePage = async function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    
    if (!modal || !content) return;

    preloadKpId(movie.id);

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    content.innerHTML = '<div style="height:100vh; display:flex; justify-content:center; align-items:center; color:#555;">Завантаження...</div>';

    let details = { ...movie };
    let logoUrl = null;
    let trailerKey = null;

    try {
        const type = movie.type === 'tv' ? 'tv' : 'movie';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images,release_dates,content_ratings&include_image_language=uk,en,null`);
        
        if (res.ok) {
            const data = await res.json();
            details.desc = data.overview || movie.desc;
            if (data.runtime) details.runtime = `${Math.floor(data.runtime/60)} год ${data.runtime%60} хв`;
            if (data.images?.logos?.length > 0) {
                const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
                logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
            }
            if (data.videos?.results) {
                const tr = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
                if(tr) trailerKey = tr.key;
            }
        }
    } catch (e) {}

    const titleHtml = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;
    const bgImage = details.backdrop || details.img;

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${bgImage}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    ${titleHtml}
                    <div class="nf-meta">
                        <span class="nf-match">98% Match</span>
                        <span>${details.year}</span>
                        <span class="nf-badge">HD</span>
                        <span>${details.runtime || ''}</span>
                    </div>
                </div>
            </div>

            <div class="nf-btn-row">
                <button class="nf-btn nf-play" id="btn-play-action" onclick="openPremiumPlayer('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                    <span>ДИВИТИСЬ</span>
                </button>
                <button class="nf-btn nf-secondary" onclick="toggleSave('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="${isSaved(movie.id) ? 'white' : 'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    <span>${isSaved(movie.id) ? 'Збережено' : 'Моє'}</span>
                </button>
            </div>

            <div class="nf-description">${details.desc || 'Опис відсутній.'}</div>

            ${trailerKey ? `
            <div class="nf-trailer">
                <iframe src="https://www.youtube.com/embed/${trailerKey}?rel=0&controls=1&modestbranding=1" frameborder="0" allowfullscreen></iframe>
            </div>` : ''}
            
            <div style="height: 50px;"></div>
        </div>
    `;

    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

window.closeMoviePage = function() {
    const modal = document.getElementById('movie_details_modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = '';
    document.body.style.overflow = '';
    cachedKpId = null; 
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
};

// ============================================================
// 🔥 BUTTON LOGIC: NO ALERTS, CHANGE TEXT
// ============================================================
window.openPremiumPlayer = async function(tmdbId, btn) {
    const span = btn ? btn.querySelector('span') : null;
    const originalText = span ? span.innerText : "ДИВИТИСЬ";
    
    // Якщо ID вже є
    if (cachedKpId) {
        launchPlayer(cachedKpId);
        return;
    }

    // 1. Змінюємо текст на "ПЕРЕВІРКА..."
    if(btn && span) {
        btn.style.opacity = 0.7;
        span.innerText = "ПЕРЕВІРКА...";
        btn.style.pointerEvents = 'none';
    }

    try {
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        
        // 2. Якщо знайдено -> Запускаємо
        if(data.data && data.data.id_kp) {
            // Відновлюємо кнопку перед запуском (щоб при поверненні вона була ок)
            if(btn && span) {
                btn.style.opacity = 1;
                span.innerText = originalText;
                btn.style.pointerEvents = 'auto';
            }
            launchPlayer(data.data.id_kp);
        } else {
            // 3. Якщо НЕ знайдено -> Кнопка стає СІРОЮ і пише НЕДОСТУПНО
            if(btn && span) {
                btn.classList.add('error'); // Додаємо клас .nf-btn.error з CSS
                span.innerText = "НЕДОСТУПНО";
                // Залишаємо pointerEvents = none, щоб не клікали
            }
        }
    } catch(e) {
        // Помилка мережі
        if(btn && span) {
            btn.classList.add('error');
            span.innerText = "ПОМИЛКА";
        }
    }
};

function launchPlayer(kpId) {
    const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
    const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    
    document.getElementById('movie_details_modal').style.display = 'none';
    iframe.src = url;
    modal.style.display = 'flex';
}

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    modal.style.display = 'none';
    iframe.src = '';
    document.getElementById('movie_details_modal').style.display = 'block';
};

window.toggleSave = function(id, btn) {
    let movie = feedMovies.find(m => m.id == id);
    if (!movie && currentHeroMovie && currentHeroMovie.id == id) movie = currentHeroMovie;
    if (!movie) movie = savedItems.find(m => m.id == id);

    if (!movie) return;

    const index = savedItems.findIndex(m => m.id == id);
    if (index === -1) {
        savedItems.push(movie);
        if (btn) { btn.querySelector('span').innerText = "Збережено"; btn.querySelector('svg').setAttribute('fill', 'white'); }
    } else {
        savedItems.splice(index, 1);
        if (btn) { btn.querySelector('span').innerText = "Зберегти"; btn.querySelector('svg').setAttribute('fill', 'none'); }
        if (currentTab === 'saved') renderGrid(savedItems, false);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

function isSaved(id) {
    return savedItems.some(m => m.id == id);
}

window.searchOnline = function(t) {
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`);
    else window.open(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`, '_blank');
};
