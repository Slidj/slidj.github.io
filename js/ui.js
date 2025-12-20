import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchSimilar } from './api.js';
import { PLAYER_BASE_URL, BOT_USERNAME } from './config.js';
import { t } from './i18n.js';
import { playSound } from './sounds.js';

// ... (усі window.openDonateMenu та скелетони залишаються без змін) ...

export function renderGrid(items, isAppend = false) {
    const container = document.getElementById('content_container');
    if (!container) return;
    if (!isAppend) container.innerHTML = '';
    items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'movie-poster-card card-anim'; 
        div.style.animationDelay = `${index * 0.05}s`;
        div.onclick = () => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); openMoviePage(item); };
        const badgeHtml = item.type === 'tv' ? `<div class="type-badge">${t.serialBadge}</div>` : '';
        div.innerHTML = `<img src="${item.img}" loading="lazy">${badgeHtml}<div class="rating-mini">${item.rating}</div>`;
        container.appendChild(div);
    });
}

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

    let details = { ...movie };
    let logoUrl = null, castHtml = '', trailersHtml = '', similarHtml = '';
    const apiType = movie.type === 'tv' ? 'tv' : 'movie';

    try {
        const data = await fetchMovieDetails(movie.id, apiType);
        if (data.external_ids?.imdb_id) state.activeMovie.imdb_id = details.imdb_id = data.external_ids.imdb_id;
        if (data.original_title) state.activeMovie.original_title = data.original_title;
        details.desc = data.overview || movie.desc;
        
        const rt = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null);
        if (rt) {
            const hrs = Math.floor(rt / 60);
            const mins = rt % 60;
            details.runtime = hrs > 0 ? `${hrs}${t.modalHour} ${mins}${t.modalMin}` : `${mins}${t.modalMin}`;
        }
        details.age = data.adult ? '18+' : '16+';

        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }

        if (data.credits?.cast?.length > 0) {
            const topCast = data.credits.cast.slice(0, 10).filter(p => p.profile_path); 
            castHtml = `<div class="cast-section"><div class="cast-title">${t.modalActors}</div><div class="cast-row">${topCast.map(p => `<div class="cast-card"><img src="https://image.tmdb.org/t/p/w200${p.profile_path}" class="cast-img"><div class="cast-name">${p.name}</div></div>`).join('')}</div></div>`;
        }

        if (data.videos?.results?.length > 0) {
            const trailers = data.videos.results.filter(v => v.type === 'Trailer').slice(0, 3);
            trailersHtml = `<div class="trailer-section"><div class="trailer-title">${t.modalTrailers}</div><div class="trailer-row">${trailers.map(v => `<div class="trailer-card" onclick="window.ui_openTrailer('${v.key}')"><div class="trailer-img-box"><img src="https://img.youtube.com/vi/${v.key}/hqdefault.jpg"><div class="trailer-play-icon">▶</div></div></div>`).join('')}</div></div>`;
        }
    } catch (e) { }

    const similarMovies = await fetchSimilar(movie.id, apiType);
    if (similarMovies.length > 0) {
        similarHtml = `<div class="similar-section"><div class="similar-title">${t.moreLikeThis}</div><div class="similar-row">${similarMovies.map(m => `<div class="similar-card" onclick="window.ui_openSimilar('${m.id}', '${m.type}')"><img src="${m.img}"><div class="similar-rating">${m.rating}</div></div>`).join('')}</div></div>`;
    }

    const titleHtml = logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`;
    const matchScore = Math.floor(Math.random() * (99 - 95 + 1) + 95);

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${details.backdrop || details.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">${titleHtml}
                    <div class="nf-meta">
                        <span class="nf-match">${matchScore}% ${t.match}</span>
                        <span>${details.year}</span>
                        <span class="nf-age">${details.age || '16+'}</span>
                        <span>${details.runtime || ''}</span>
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
            <div class="nf-description">${details.desc || t.descMissing}</div>
            ${trailersHtml} ${castHtml} ${similarHtml}
            <div style="height: 50px;"></div>
        </div>
    `;

    window.ui_openSimilar = (id, type) => { const target = similarMovies.find(m => m.id == id); if (target) openMoviePage(target); };
    window.ui_openTrailer = (key) => {
        const pModal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        document.getElementById('movie_details_modal').style.display = 'none';
        iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1`;
        pModal.style.display = 'flex';
    };
    window.ui_share = (id) => { 
        let m = state.activeMovie || state.feedMovies.find(i=>i.id==id); 
        if(!m) return; 
        const botLink = `https://t.me/${BOT_USERNAME}/app?startapp=${m.type}_${m.id}`;
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(t.shareMessage)}`; 
        window.Telegram?.WebApp?.openTelegramLink(shareUrl); 
    };
}
// ... (решта функцій без змін) ...
export function closeMoviePage() {
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal || modal.style.display === 'none') return;
    playSound('Bubble.wav');
    content.classList.add('modal-closing-anim');
    setTimeout(() => { modal.style.display = 'none'; content.classList.remove('modal-closing-anim'); content.innerHTML = ''; document.body.style.overflow = ''; state.activeMovie = null; if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide(); }, 300);
}
export function openPremiumPlayer(tmdbId, btn) {
    playSound('Click.wav');
    if (!PLAYER_BASE_URL) return;
    let movie = state.activeMovie || state.feedMovies.find(m => m.id == tmdbId) || state.currentHeroMovie;
    if (!movie) return;
    let url = PLAYER_BASE_URL.replace(/\/$/, '') + `?tmdb_id=${movie.id}&title=${encodeURIComponent(movie.original_title || movie.title)}`;
    if (movie.imdb_id) url += `&imdb_id=${movie.imdb_id}`;
    const pModal = document.getElementById('player_modal');
    const iframe = document.getElementById('video_frame');
    document.getElementById('movie_details_modal').style.display = 'none';
    iframe.src = url;
    pModal.style.display = 'flex';
}
export function closePlayer() {
    document.getElementById('player_modal').style.display = 'none';
    document.getElementById('video_frame').src = '';
    document.getElementById('movie_details_modal').style.display = 'block';
}
export function renderHistorySection(items) {
    const section = document.createElement('div');
    section.className = 'similar-section'; 
    section.style.gridColumn = '1 / -1';
    let html = `<div class="similar-title" style="padding-left:10px;">${t.history}</div><div class="similar-row" style="padding-left:10px;">`;
    items.forEach(m => { html += `<div class="similar-card" onclick="window.ui_openHistory('${m.id}')"><img src="${m.img}" loading="lazy"><div class="similar-rating">${m.rating}</div></div>`; });
    html += `</div>`;
    section.innerHTML = html;
    window.ui_openHistory = (id) => { const m = items.find(i => i.id == id); if(m) openMoviePage(m); };
    return section;
}
