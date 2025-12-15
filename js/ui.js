import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchKpId, fetchSimilar } from './api.js';
import { PLAYER_TOKEN } from './config.js';
import { t } from './i18n.js';

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

// --- GRID RENDER ---
export function renderGrid(items, isAppend = false) {
    const container = document.getElementById('content_container');
    if (!container) return;
    
    if (!isAppend) container.innerHTML = '';
    
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card card-anim'; 
        div.style.animationDelay = `${index * 0.05}s`;
        
        div.onclick = () => {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
            openMoviePage(item);
        };
        
        const badgeHtml = item.type === 'tv' ? `<div class="type-badge">${t.serialBadge}</div>` : '';
        div.innerHTML = `<img src="${item.img}" loading="lazy">${badgeHtml}<div class="rating-mini">${item.rating}</div>`;
        container.appendChild(div);
    });
}

// 🔥 ВИПРАВЛЕНО: Малює стрічку історії
export function renderHistorySection(items) {
    const section = document.createElement('div');
    section.className = 'similar-section'; 
    section.style.marginTop = '10px';
    section.style.marginBottom = '30px';

    // 🔥 ГОЛОВНИЙ ФІКС: Розтягуємо блок на всю ширину Grid-сітки
    section.style.gridColumn = '1 / -1'; 
    section.style.width = '100%';
    section.style.minWidth = '0'; // Важливо для роботи скролу всередині Grid
    
    const titleText = t.history || 'Watch History'; 
    
    let html = `<div class="similar-title" style="padding-left:10px;">${titleText}</div><div class="similar-row" style="padding-left:10px;">`;
    
    items.forEach(m => {
        html += `
            <div class="similar-card" onclick="window.ui_openHistory('${m.id}')">
                <img src="${m.img}" loading="lazy">
                <div class="similar-rating">${m.rating}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    section.innerHTML = html;

    window.ui_openHistory = (id) => {
        const movie = state.historyItems.find(m => m.id == id);
        if(movie) {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
            openMoviePage(movie);
        }
    };

    return section;
}


// --- HERO SECTION ---
export function setupHero(movie) {
    state.currentHeroMovie = movie;
    const hero = document.getElementById('hero_section');
    const title = document.getElementById('hero_title');
    const meta = document.getElementById('hero_meta');
    
    if (hero && movie) {
        const bg = movie.backdrop || movie.img;
        hero.style.backgroundImage = `url('${bg}')`;
        if(title) title.innerText = movie.title;
        if(meta) meta.innerText = `${t.heroTrending} • ${movie.year}`;
        fetchKpId(movie); 
    }
}

// --- MOVIE PAGE ---
export async function openMoviePage(movie) {
    state.activeMovie = movie;
    addToHistory(movie);

    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal) return;

    modal.scrollTop = 0;
    state.cachedKpId = null; 
    
    fetchKpId(movie); 
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    content.innerHTML = `<div style="height:100vh; display:flex; justify-content:center; align-items:center; color:#555;">${t.loading}</div>`;

    if (window.Telegram?.WebApp?.BackButton) {
        window.Telegram.WebApp.BackButton.show();
        window.Telegram.WebApp.BackButton.onClick(() => {
            window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
            closeMoviePage();
        });
    }

    let details = { ...movie };
    let logoUrl = null, trailerKey = null;
    const apiType = movie.type === 'tv' ? 'tv' : 'movie';

    try {
        const data = await fetchMovieDetails(movie.id, apiType);
        details.desc = data.overview || movie.desc;
        if (data.runtime) details.runtime = `${Math.floor(data.runtime/60)} год ${data.runtime%60} хв`;
        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }
        if (data.videos?.results) {
            const tr = data.videos.results.find(v => v.site === 'YouTube' && v.type === 'Trailer');
            if(tr) trailerKey = tr.key;
        }
    } catch (e) {}

    const similarMovies = await fetchSimilar(movie.id, apiType);

    const titleHtml = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;
    const matchScore = Math.floor(Math.random() * (99 - 95 + 1) + 95);

    let similarHtml = '';
    if (similarMovies.length > 0) {
        const cards = similarMovies.map(m => `
            <div class="similar-card" onclick="window.ui_openSimilar('${m.id}', '${m.type}')">
                <img src="${m.img}" loading="lazy">
                <div class="similar-rating">${m.rating}</div>
            </div>
        `).join('');
        
        similarHtml = `
            <div class="similar-section">
                <div class="similar-title">${t.moreLikeThis}</div>
                <div class="similar-row">${cards}</div>
            </div>
        `;
    }

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${details.backdrop || details.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    ${titleHtml}
                    <div class="nf-meta">
                        <span class="nf-match">${matchScore}% ${t.match}</span>
                        <span>${details.year}</span>
                        <span class="nf-age">${details.type === 'tv' ? '16+' : '13+'}</span>
                        <span>${details.runtime || ''}</span>
                        <span class="nf-badge">HD</span>
                    </div>
                </div>
            </div>
            <div class="nf-btn-row">
                <button class="nf-btn nf-play" onclick="window.openPremiumPlayer('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg><span>${t.watch}</span>
                </button>
                <button class="nf-btn nf-secondary" onclick="window.ui_toggleSave('${movie.id}', this)">
                    <svg viewBox="0 0 24 24" fill="${isSaved(movie.id) ? 'white' : 'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    <span>${isSaved(movie.id) ? t.saveBtnActive : t.saveBtn}</span>
                </button>
            </div>
            <div class="nf-description">${details.desc || t.descMissing}</div>
            ${similarHtml}
            ${trailerKey ? `<div class="nf-trailer"><iframe src="https://www.youtube.com/embed/${trailerKey}?rel=0&controls=1&modestbranding=1" frameborder="0" allowfullscreen></iframe></div>` : ''}
            <div style="height: 50px;"></div>
        </div>
    `;

    window.ui_openSimilar = (id, type) => {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
        const target = similarMovies.find(m => m.id == id);
        if (target) openMoviePage(target);
    };
}

export function closeMoviePage() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    const modal = document.getElementById('movie_details_modal');
    if (modal) modal.style.display = 'none';
    document.getElementById('movie_details_content').innerHTML = '';
    document.body.style.overflow = '';
    state.activeMovie = null; 
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
}

// --- PLAYER ---
export async function openPremiumPlayer(tmdbId, btn) {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
    const span = btn?.querySelector('span');
    const originalText = span ? span.innerText : t.watch;

    if (state.cachedKpId) { launchPlayer(state.cachedKpId); return; }

    if(btn) { btn.style.opacity = 0.7; if(span) span.innerText = t.checking; btn.style.pointerEvents = 'none'; }

    let movie = state.activeMovie 
             || state.feedMovies.find(m => m.id == tmdbId) 
             || state.savedItems.find(m => m.id == tmdbId) 
             || state.historyItems.find(m => m.id == tmdbId) 
             || state.currentHeroMovie;

    if (!movie) {
        if(btn && span) { btn.classList.add('error'); span.innerText = "ERROR"; }
        return;
    }

    let kpId = await fetchKpId(movie);

    if (kpId) {
        if(btn) { btn.style.opacity = 1; if(span) span.innerText = originalText; btn.style.pointerEvents = 'auto'; }
        launchPlayer(kpId);
    } else {
        if(btn && span) { btn.classList.add('error'); span.innerText = t.unavailable; }
    }
}

function launchPlayer(kpId) {
    const url = `https://api.rstprgapipt.com/balancer-api/iframe?kp=${kpId}&token=${PLAYER_TOKEN}&disabled_share=1`;
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    document.getElementById('movie_details_modal').style.display = 'none';
    iframe.src = url;
    modal.style.display = 'flex';
}

export function closePlayer() {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    const modal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    modal.style.display = 'none';
    iframe.src = '';
    document.getElementById('movie_details_modal').style.display = 'block';
}
