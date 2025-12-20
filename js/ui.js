import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchSimilar } from './api.js';
import { PLAYER_BASE_URL, BOT_USERNAME } from './config.js';
import { t } from './i18n.js';
import { playSound } from './sounds.js';

// --- КЕРУВАННЯ МЕНЮ ПІДТРИМКИ ---
window.openDonateMenu = () => {
    window.toggleSideMenu();
    playSound('Pop.wav');
    const modal = document.getElementById('donate_modal');
    if (modal) modal.style.display = 'flex';
};

window.closeDonateMenu = () => {
    playSound('Bubble.wav');
    const modal = document.getElementById('donate_modal');
    if (modal) modal.style.display = 'none';
};

window.selectDonateLevel = (stars) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    let msgKey = stars === 5 ? 'donateLvl1' : (stars === 20 ? 'donateLvl2' : 'donateLvl3');
    window.Telegram?.WebApp?.showAlert(`${t[msgKey]}: Можливість оплати ${stars} Stars з'явиться зовсім скоро!`);
};

// --- Скелетони ---
export function showSkeletons(count = 12, isAppend = false) {
    const container = document.getElementById('content_container');
    if (!container) return;
    if (!isAppend) container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'movie-poster-card skeleton temp-skeleton'; 
        container.appendChild(div);
    }
}

export function removeSkeletons() {
    const skeletons = document.querySelectorAll('.temp-skeleton');
    skeletons.forEach(el => el.remove());
}

// --- Головна сітка ---
export function renderGrid(items, isAppend = false) {
    const container = document.getElementById('content_container');
    if (!container) return;
    if (!isAppend) container.innerHTML = '';
    const hasShownGlow = sessionStorage.getItem('glow_shown');
    const isHome = state.currentTab === 'home';
    const shouldShowGlow = !isAppend && isHome && !hasShownGlow;
    items.forEach((item, index) => {
        const div = document.createElement('div');
        let glowClass = (shouldShowGlow && index < 3) ? ' trending-glow' : '';
        div.className = 'movie-poster-card card-anim' + glowClass; 
        div.style.animationDelay = `${index * 0.05}s`;
        div.onclick = () => {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
            openMoviePage(item);
        };
        const badgeHtml = item.type === 'tv' ? `<div class="type-badge">${t.serialBadge}</div>` : '';
        div.innerHTML = `<img src="${item.img}" loading="lazy">${badgeHtml}<div class="rating-mini">${item.rating}</div>`;
        container.appendChild(div);
    });
    if (shouldShowGlow) sessionStorage.setItem('glow_shown', 'true');
}

// --- Налаштування Hero ---
export async function setupHero(movie) {
    state.currentHeroMovie = movie;
    const hero = document.getElementById('hero_section');
    const title = document.getElementById('hero_title');
    const meta = document.getElementById('hero_meta');
    if (hero && movie) {
        let bg = movie.img || movie.backdrop;
        if (bg.includes('image.tmdb.org')) bg = bg.replace('/w500/', '/w1280/').replace('/w780/', '/w1280/');
        hero.style.backgroundImage = `url('${bg}')`;
        hero.style.backgroundPosition = 'center top'; 
        hero.style.backgroundSize = 'cover';
        if(title) { title.innerText = movie.title; title.style.display = 'block'; }
        if(meta) meta.innerText = `${t.heroTrending} • ${movie.year}`;
        
        try {
            const apiType = movie.type === 'tv' ? 'tv' : 'movie';
            const data = await fetchMovieDetails(movie.id, apiType);
            if(data.external_ids?.imdb_id) movie.imdb_id = data.external_ids.imdb_id;
            if (data.original_title) movie.original_title = data.original_title;
        } catch (e) { }
    }
}

// --- Відкриття сторінки фільму ---
export async function openMoviePage(movie) {
    playSound('Pop.wav');
    state.activeMovie = movie;
    addToHistory(movie);
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal) return;
    
    content.classList.remove('modal-closing-anim');
    modal.scrollTop = 0;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    content.innerHTML = `<div style="height:100vh; display:flex; justify-content:center; align-items:center; color:#555;">${t.loading}</div>`;

    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => closeMoviePage());
    }

    const apiType = movie.type === 'tv' ? 'tv' : 'movie';
    try {
        const data = await fetchMovieDetails(movie.id, apiType);
        // 🔥 Обов'язково зберігаємо ці дані для плеєра
        if (data.external_ids?.imdb_id) state.activeMovie.imdb_id = data.external_ids.imdb_id;
        if (data.original_title) state.activeMovie.original_title = data.original_title;
        movie.desc = data.overview || movie.desc;
    } catch (e) { }

    const matchScore = Math.floor(Math.random() * (99 - 95 + 1) + 95);

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${movie.backdrop || movie.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    <div class="nf-title-text">${movie.title}</div>
                    <div class="nf-meta">
                        <span class="nf-match">${matchScore}% ${t.match}</span>
                        <span>${movie.year}</span>
                        <span class="nf-badge">HD</span>
                    </div>
                </div>
            </div>
            <div class="nf-btn-row">
                <button class="nf-btn nf-play" onclick="window.openPremiumPlayer('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg><span>${t.watch}</span>
                </button>
                <div class="nf-actions-group">
                    <button class="nf-btn nf-secondary" onclick="window.ui_toggleSave('${movie.id}', this)">
                        <svg viewBox="0 0 24 24" fill="${isSaved(movie.id) ? 'white' : 'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                        <span>${isSaved(movie.id) ? t.saveBtnActive : t.saveBtn}</span>
                    </button>
                    <button class="nf-btn nf-secondary" onclick="window.ui_share('${movie.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="24" height="24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                        <span>${t.share}</span>
                    </button>
                </div>
            </div>
            <div class="nf-description">${movie.desc || t.descMissing}</div>
            <div style="height: 50px;"></div>
        </div>
    `;

    window.ui_share = (id) => { 
        let m = state.activeMovie || state.feedMovies.find(i=>i.id==id); 
        if(!m) return; 
        const botLink = `https://t.me/${BOT_USERNAME}/app?startapp=${m.type}_${m.id}`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(t.shareMessage)}`; 
        window.Telegram?.WebApp?.openTelegramLink(shareUrl); 
    };
}

// --- Плавне закриття ---
export function closeMoviePage() {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal || modal.style.display === 'none') return;
    playSound('Bubble.wav');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    content.classList.add('modal-closing-anim');
    setTimeout(() => {
        modal.style.display = 'none';
        content.classList.remove('modal-closing-anim');
        content.innerHTML = '';
        document.body.style.overflow = '';
        state.activeMovie = null; 
        if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
    }, 300);
}

// 🔥 ОНОВЛЕНО: Гнучкий та надійний пошук для плеєра
export function openPremiumPlayer(tmdbId, btn) {
    playSound('Click.wav');
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
    if (!PLAYER_BASE_URL) return;

    let movie = state.activeMovie || state.feedMovies.find(m => m.id == tmdbId) || state.currentHeroMovie;
    if (!movie) return;

    // Складаємо URL з використанням оригінальної назви та IMDb ID
    let baseUrl = PLAYER_BASE_URL.replace(/\/$/, '');
    let url = `${baseUrl}?tmdb_id=${movie.id}&title=${encodeURIComponent(movie.original_title || movie.title)}`;
    
    // Якщо є IMDb ID, обов'язково додаємо його — це прибирає помилку Not Found у 99% випадків
    if (movie.imdb_id) {
        url += `&imdb_id=${movie.imdb_id}`;
    }

    launchPlayer(url);
}

function launchPlayer(url) {
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    document.getElementById('movie_details_modal').style.display = 'none';
    iframe.src = url;
    modal.style.display = 'flex';
}

export function closePlayer() {
    document.getElementById('player_modal').style.display = 'none';
    document.getElementById('video_frame').src = '';
    document.getElementById('movie_details_modal').style.display = 'block';
}

export function renderHistorySection(items) {
    const section = document.createElement('div');
    section.className = 'similar-section'; 
    let html = `<div class="similar-title" style="padding-left:10px;">${t.history}</div><div class="similar-row" style="padding-left:10px;">`;
    items.forEach(m => { html += `<div class="similar-card" onclick="window.ui_openHistory('${m.id}')"><img src="${m.img}" loading="lazy"></div>`; });
    html += `</div>`;
    section.innerHTML = html;
    window.ui_openHistory = (id) => { const movie = items.find(m => m.id == id); if(movie) openMoviePage(movie); };
    return section;
}
