// ============================================================
// 🎬 MEDIA HUB: APP CORE (STANDALONE)
// ============================================================

// --- 1. НАЛАШТУВАННЯ ТА ЗМІННІ ---
const API_KEY = '4f06fae67ddcf28e2e5b3f91193cb555';
const TMDB_IMG_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_URL = 'https://image.tmdb.org/t/p/w1280'; // Вища якість для фону

let currentTab = 'home';
let feedMovies = [];
let savedItems = JSON.parse(localStorage.getItem('savedItems')) || [];
let currentHeroMovie = null;
let searchTimeout;

// --- 2. ЗАПОБІЖНИК ВІД ЗАВИСАННЯ ---
// Якщо скрипт зламається, цей код прибере кільце через 3 секунди
setTimeout(() => {
    const preloader = document.getElementById('preloader');
    if (preloader && preloader.style.display !== 'none') {
        console.warn("Forcing preloader hide (Safety Timeout)");
        preloader.style.display = 'none';
    }
}, 3000);

// --- 3. ІНІЦІАЛІЗАЦІЯ TELEGRAM ---
const tg = window.Telegram?.WebApp;
if (tg) {
    try {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#000000');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#000000');
        
        if (tg.initDataUnsafe?.user?.photo_url) {
            const ava = document.getElementById('user_avatar');
            const def = document.getElementById('default_avatar');
            if (ava) {
                ava.src = tg.initDataUnsafe.user.photo_url;
                ava.style.display = 'block';
                if (def) def.style.display = 'none';
            }
        }
    } catch (e) { console.error("TG Init Error:", e); }
}

// --- 4. ЗАПУСК ДОДАТКУ ---
initApp();

async function initApp() {
    try {
        // Завантажуємо головну сторінку
        await loadHomeContent();
        
        // Вмикаємо вкладку "Дім"
        switchMode('home');
        
    } catch (e) {
        console.error("Critical Start Error:", e);
    } finally {
        // Прибираємо прелоадер (успіх або помилка - неважливо)
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.style.opacity = '0';
            setTimeout(() => preloader.style.display = 'none', 500);
        }
    }
}

// --- 5. НАВІГАЦІЯ ---
window.switchMode = function(tab) {
    currentTab = tab;
    
    // Підсвітка кнопок
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Знаходимо потрібну кнопку за індексом, щоб уникнути помилок селектора
    const navItems = document.querySelectorAll('.nav-item');
    if (tab === 'home' && navItems[0]) navItems[0].classList.add('active');
    if (tab === 'search' && navItems[1]) navItems[1].classList.add('active');
    if (tab === 'saved' && navItems[2]) navItems[2].classList.add('active');

    // Перемикання блоків
    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const searchBar = document.getElementById('search_bar_container');
    const content = document.getElementById('content_container');

    if (!hero || !content) return; // Захист

    window.scrollTo({ top: 0 });

    if (tab === 'home') {
        hero.style.display = 'flex';
        filters.style.display = 'flex';
        searchBar.style.display = 'none';
        content.style.display = 'grid'; // Grid для сітки
        if (feedMovies.length > 0) renderGrid(feedMovies);
        else loadHomeContent(); // Спробувати ще раз, якщо пусто
    } 
    else if (tab === 'search') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'block';
        content.style.display = 'grid';
        content.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#555; padding:40px;">Почніть вводити назву...</div>';
        const input = document.getElementById('search_input');
        if (input) input.focus();
    } 
    else if (tab === 'saved') {
        hero.style.display = 'none';
        filters.style.display = 'none';
        searchBar.style.display = 'none';
        content.style.display = 'grid';
        if (savedItems.length === 0) {
            content.innerHTML = '<div style="grid-column: 1/-1; text-align:center; color:#555; padding:40px;">Список порожній</div>';
        } else {
            renderGrid(savedItems);
        }
    }
};

window.setCategory = function(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.cat-btn[onclick="setCategory('${cat}')"]`);
    if (btn) btn.classList.add('active');
    // Тут можна додати логіку фільтрації
};

// --- 6. ЗАВАНТАЖЕННЯ ДАНИХ (TMDB) ---
async function loadHomeContent() {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=uk-UA`);
        const data = await response.json();
        
        if (data.results) {
            feedMovies = data.results.map(mapTMDB);
            
            // Перший фільм - у Hero банер
            if (feedMovies.length > 0) setupHero(feedMovies[0]);
            
            renderGrid(feedMovies);
        }
    } catch (e) {
        console.error("API Error:", e);
        const container = document.getElementById('content_container');
        if (container) container.innerHTML = '<div style="color:red; padding:20px;">Помилка завантаження. Перевірте з\'єднання.</div>';
    }
}

// Допоміжна: Перетворення даних TMDB у наш формат
function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name, // TMDB повертає name для серіалів
        desc: item.overview,
        img: item.poster_path ? TMDB_IMG_URL + item.poster_path : 'https://via.placeholder.com/200x300?text=No+Poster',
        backdrop: item.backdrop_path ? TMDB_BACKDROP_URL + item.backdrop_path : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '----').split('-')[0],
        type: item.media_type || 'movie'
    };
}

// --- 7. РЕНДЕРИНГ ---
function renderGrid(items) {
    const container = document.getElementById('content_container');
    if (!container) return;
    container.innerHTML = '';
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card';
        div.onclick = () => window.openMoviePage(item); // Клік на постер
        
        div.innerHTML = `
            <img src="${item.img}" loading="lazy" alt="${item.title}">
            <div class="rating-mini">${item.rating}</div>
        `;
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
        if (title) title.innerText = movie.title;
        if (meta) meta.innerText = `Top 1 • ${movie.year} • ${movie.rating}`;
    }
}

// Функції кнопок Hero
window.playHeroMovie = function() {
    if (currentHeroMovie) window.openPremiumPlayer(currentHeroMovie.id, null);
};
window.infoHeroMovie = function() {
    if (currentHeroMovie) window.openMoviePage(currentHeroMovie);
};

// --- 8. ПОШУК ---
window.performSearchDelayed = function() {
    clearTimeout(searchTimeout);
    const query = document.getElementById('search_input').value;
    
    if (!query || query.length < 2) return;

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
            const data = await res.json();
            
            if (data.results) {
                const results = data.results
                    .filter(i => i.media_type !== 'person' && i.poster_path) // Тільки фільми/серіали з постерами
                    .map(mapTMDB);
                renderGrid(results);
            }
        } catch (e) { console.error(e); }
    }, 600);
};

// --- 9. СТОРІНКА ДЕТАЛЕЙ (NETFLIX STYLE) ---
window.openMoviePage = async function(movie) {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    
    if (!modal || !content) return;

    modal.style.display = 'block'; // Важливо для скролу
    document.body.style.overflow = 'hidden'; // Блокуємо фон
    
    // Прелоадер
    content.innerHTML = '<div style="height:100vh; display:flex; justify-content:center; align-items:center; color:#555;">Завантаження деталей...</div>';

    // Дозавантаження деталей
    let details = { ...movie }; // Копія об'єкта
    let logoUrl = null;
    let trailerKey = null;

    try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images,release_dates&include_image_language=uk,en,null`);
        
        if (res.ok) {
            const data = await res.json();
            details.desc = data.overview || movie.desc;
            details.runtime = data.runtime ? `${Math.floor(data.runtime/60)} год ${data.runtime%60} хв` : '';
            
            // Логотип
            if (data.images?.logos?.length > 0) {
                const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
                logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
            }
            // Трейлер
            if (data.videos?.results) {
                const tr = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
                if (tr) trailerKey = tr.key;
            }
        }
    } catch (e) { 
        // Якщо це серіал, запит вище впаде (бо там /movie/), але ми просто покажемо базові дані
        console.log("Details fetch skipped or failed"); 
    }

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
                        <span class="nf-match">95% Match</span>
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
                <button class="nf-btn nf-secondary" onclick="toggleSave('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="${isSaved(movie.id) ? 'white' : 'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    <span>${isSaved(movie.id) ? 'Збережено' : 'Зберегти'}</span>
                </button>
            </div>

            <div class="nf-description">
                ${details.desc || 'Опис відсутній.'}
            </div>

            ${trailerKey ? `
            <div class="nf-trailer">
                <iframe src="https://www.youtube.com/embed/${trailerKey}?rel=0&controls=1&modestbranding=1" frameborder="0" allowfullscreen></iframe>
            </div>` : ''}
            
            <div style="height: 50px;"></div>
        </div>
    `;

    // Кнопка Назад
    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(closeMoviePage);
    }
};

window.closeMoviePage = function() {
    const modal = document.getElementById('movie_details_modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = ''; // Очистити пам'ять
    document.body.style.overflow = '';
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
};

// --- 10. ВІДКРИТТЯ ПЛЕЄРА (Premium + Alloha) ---
window.openPremiumPlayer = async function(tmdbId, btn) {
    const originalText = btn ? btn.querySelector('span').innerText : "";
    
    // UI Feedback
    if(btn) {
        btn.style.opacity = 0.6;
        btn.querySelector('span').innerText = "Запуск...";
        btn.style.pointerEvents = 'none';
    }

    try {
        // Конвертація TMDB -> Kinopoisk ID
        const res = await fetch(`https://api.alloha.tv/?token=d317441359e505c343c2063edc97e7&tmdb=${tmdbId}`);
        const data = await res.json();
        
        let kpId = null;
        if(data.data && data.data.id_kp) kpId = data.data.id_kp;
        
        if(!kpId) {
            alert("На жаль, фільм не знайдено в базі.");
            resetBtn(btn, originalText);
            return;
        }

        // Запуск плеєра
        const playerToken = "eyJhbGciOiJIUzI1NiJ9.eyJ3ZWJTaXRlIjoiMzQiLCJpc3MiOiJhcGktd2VibWFzdGVyIiwic3ViIjoiNDEiLCJpYXQiOjE3NDMwNjA3ODAsImp0aSI6IjIzMTQwMmE0LTM3NTMtNGQ3OS1hNDBjLTA2YTY0MTE0MzNhOSIsInNjb3BlIjoiRExFIn0.4PmKGf512P-ov-tEjwr3gfOVxccjx8SSt28slJXypYU";
        const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${playerToken}&disabled_share=1`;

        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        
        // Ховаємо деталі, показуємо плеєр
        document.getElementById('movie_details_modal').style.display = 'none';
        iframe.src = url;
        modal.style.display = 'flex';

    } catch(e) {
        alert("Помилка з'єднання з сервером.");
    }
    
    resetBtn(btn, originalText);
};

function resetBtn(btn, text) {
    if(btn) {
        btn.style.opacity = 1;
        btn.querySelector('span').innerText = text || "ДИВИТИСЬ";
        btn.style.pointerEvents = 'auto';
    }
}

window.closePlayer = function() {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    modal.style.display = 'none';
    iframe.src = '';
    // Повертаємося до деталей
    document.getElementById('movie_details_modal').style.display = 'block';
};

// --- 11. ЗБЕРЕЖЕННЯ (My List) ---
window.toggleSave = function(id, btn) {
    // Шукаємо фільм у поточній стрічці або збережених
    let movie = feedMovies.find(m => m.id == id);
    if (!movie) movie = savedItems.find(m => m.id == id);
    // Якщо фільм прийшов з Hero, він може бути в currentHeroMovie
    if (!movie && currentHeroMovie && currentHeroMovie.id == id) movie = currentHeroMovie;

    if (!movie) return;

    const index = savedItems.findIndex(m => m.id == id);
    
    if (index === -1) {
        savedItems.push(movie);
        if (btn) {
            btn.querySelector('span').innerText = "Збережено";
            btn.querySelector('svg').setAttribute('fill', 'white');
        }
    } else {
        savedItems.splice(index, 1);
        if (btn) {
            btn.querySelector('span').innerText = "Зберегти";
            btn.querySelector('svg').setAttribute('fill', 'none');
        }
        // Якщо ми на вкладці "Моє", оновлюємо сітку
        if (currentTab === 'saved') renderGrid(savedItems);
    }
    localStorage.setItem('savedItems', JSON.stringify(savedItems));
};

function isSaved(id) {
    return savedItems.some(m => m.id == id);
}

// --- 12. ГЛОБАЛЬНИЙ ПОШУК (Кнопка в описі) ---
window.searchOnline = function(t) {
    if (window.Telegram?.WebApp) window.Telegram.WebApp.openLink(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`);
    else window.open(`https://www.google.com/search?q=дивитися+онлайн+${encodeURIComponent(t)}+eneyida`, '_blank');
};
