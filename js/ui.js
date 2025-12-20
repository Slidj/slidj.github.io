import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchSimilar } from './api.js';
import { PLAYER_BASE_URL, BOT_USERNAME } from './config.js';
import { t } from './i18n.js';
import { playSound } from './sounds.js';

window.openDonateMenu = () => { window.toggleSideMenu(); playSound('Pop.wav'); const m = document.getElementById('donate_modal'); if (m) m.style.display = 'flex'; };
window.closeDonateMenu = () => { playSound('Bubble.wav'); const m = document.getElementById('donate_modal'); if (m) m.style.display = 'none'; };
window.selectDonateLevel = (stars) => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium'); let k = stars === 5 ? 'donateLvl1' : (stars === 20 ? 'donateLvl2' : 'donateLvl3'); window.Telegram?.WebApp?.showAlert(`${t[k]}: Незабаром!`); };

export function showSkeletons(count = 12, isAppend = false) {
    const c = document.getElementById('content_container'); if (!c) return; if (!isAppend) c.innerHTML = '';
    for (let i = 0; i < count; i++) { const d = document.createElement('div'); d.className = 'movie-poster-card skeleton temp-skeleton'; c.appendChild(d); }
}
export function removeSkeletons() { document.querySelectorAll('.temp-skeleton').forEach(el => el.remove()); }

export function renderGrid(items, isAppend = false) {
    const c = document.getElementById('content_container'); if (!c) return; if (!isAppend) c.innerHTML = '';
    items.forEach((item, index) => {
        const d = document.createElement('div'); d.className = 'movie-poster-card card-anim'; 
        d.onclick = () => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); openMoviePage(item); };
        const b = item.type === 'tv' ? `<div class="type-badge">${t.serialBadge}</div>` : '';
        d.innerHTML = `<img src="${item.img}" loading="lazy">${b}<div class="rating-mini">${item.rating}</div>`;
        c.appendChild(d);
    });
}

export async function setupHero(movie) {
    state.currentHeroMovie = movie;
    const hero = document.getElementById('hero_section'), title = document.getElementById('hero_title'), meta = document.getElementById('hero_meta');
    if (hero && movie) {
        let bg = movie.img || movie.backdrop;
        if (bg.includes('image.tmdb.org')) bg = bg.replace('/w500/', '/w1280/');
        hero.style.backgroundImage = `url('${bg}')`;
        if(title) title.innerText = movie.title;
        if(meta) meta.innerText = `${t.heroTrending} • ${movie.year}`;
        try {
            const data = await fetchMovieDetails(movie.id, movie.type === 'tv' ? 'tv' : 'movie');
            if(data.external_ids?.imdb_id) movie.imdb_id = data.external_ids.imdb_id;
            if (data.original_title) movie.original_title = data.original_title;
            if (data.images?.logos?.length > 0) {
                const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
                if (logo && title) title.innerHTML = `<img src="https://image.tmdb.org/t/p/w500${logo.file_path}" class="nf-logo" style="max-height:120px;">`;
            }
        } catch (e) { }
    }
}

export async function openMoviePage(movie) {
    playSound('Pop.wav');
    state.activeMovie = movie; addToHistory(movie);
    const modal = document.getElementById('movie_details_modal'), content = document.getElementById('movie_details_content');
    if (!modal || !content) return;
    content.classList.remove('modal-closing-anim');
    modal.style.display = 'block';
    content.innerHTML = `<div style="height:100vh; display:flex; justify-content:center; align-items:center;">${t.loading}</div>`;

    let details = { ...movie }, logoUrl = null, castHtml = '', trailersHtml = '', similarHtml = '';
    const apiType = movie.type === 'tv' ? 'tv' : 'movie';
    try {
        const data = await fetchMovieDetails(movie.id, apiType);
        if (data.external_ids?.imdb_id) state.activeMovie.imdb_id = details.imdb_id = data.external_ids.imdb_id;
        if (data.original_title) state.activeMovie.original_title = data.original_title;
        details.desc = data.overview || movie.desc;
        // 🔥 ВІК ТА ТРИВАЛІСТЬ
        const rt = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null);
        if (rt) details.runtime = rt > 60 ? `${Math.floor(rt/60)}${t.modalHour} ${rt%60}${t.modalMin}` : `${rt}${t.modalMin}`;
        details.age = data.adult ? '18+' : '16+';
        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }
        if (data.credits?.cast) castHtml = `<div class="cast-section"><div class="cast-title">${t.modalActors}</div><div class="cast-row">${data.credits.cast.slice(0,10).filter(p=>p.profile_path).map(p=>`<div class="cast-card"><img src="https://image.tmdb.org/t/p/w200${p.profile_path}" class="cast-img"><div class="cast-name">${p.name}</div></div>`).join('')}</div></div>`;
        if (data.videos?.results) {
            const trailers = data.videos.results.filter(v => v.type === 'Trailer').slice(0,3);
            trailersHtml = `<div class="trailer-section"><div class="trailer-title">${t.modalTrailers}</div><div class="trailer-row">${trailers.map(v => `<div class="trailer-card" onclick="window.ui_openTrailer('${v.key}')"><div class="trailer-img-box"><img src="https://img.youtube.com/vi/${v.key}/hqdefault.jpg"><div class="trailer-play-icon">▶</div></div></div>`).join('')}</div></div>`;
        }
    } catch (e) { }

    const similar = await fetchSimilar(movie.id, apiType);
    if (similar.length > 0) similarHtml = `<div class="similar-section"><div class="similar-title">${t.moreLikeThis}</div><div class="similar-row">${similar.map(m => `<div class="similar-card" onclick="window.ui_openSimilar('${m.id}','${m.type}')"><img src="${m.img}"><div class="similar-rating">${m.rating}</div></div>`).join('')}</div></div>`;

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${details.backdrop || details.img}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">${logoUrl ? `<img src="${logoUrl}" class="nf-logo">` : `<div class="nf-title-text">${details.title}</div>`}
                    <div class="nf-meta"><span class="nf-match">98% ${t.match}</span><span>${details.year}</span><span class="nf-age">${details.age}</span><span>${details.runtime || ''}</span><span class="nf-badge">HD</span></div>
                </div>
            </div>
            <div class="nf-btn-row">
                <button class="nf-btn nf-play" onclick="window.openPremiumPlayer('${movie.id}', this)"><svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg><span>${t.watch}</span></button>
                <button class="nf-btn nf-secondary" onclick="window.ui_toggleSave('${movie.id}', this)"><svg viewBox="0 0 24 24" fill="${isSaved(movie.id)?'white':'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg><span>${isSaved(movie.id)?t.saveBtnActive:t.saveBtn}</span></button>
            </div>
            <div class="nf-description">${details.desc || t.descMissing}</div>
            ${trailersHtml} ${castHtml} ${similarHtml}
            <div style="height: 50px;"></div>
        </div>
    `;

    window.ui_openSimilar = (id, type) => { const target = similar.find(m => m.id == id); if (target) openMoviePage(target); };
    window.ui_openTrailer = (key) => { const p = document.getElementById('player_modal'), f = document.getElementById('video_frame'); document.getElementById('movie_details_modal').style.display = 'none'; f.src = `https://www.youtube.com/embed/${key}?autoplay=1`; p.style.display = 'flex'; };
}

export function closeMoviePage() {
    const modal = document.getElementById('movie_details_modal'), content = document.getElementById('movie_details_content');
    if (!modal) return; playSound('Bubble.wav'); content.classList.add('modal-closing-anim');
    setTimeout(() => { modal.style.display = 'none'; content.innerHTML = ''; document.body.style.overflow = ''; state.activeMovie = null; if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide(); }, 300);
}

export function openPremiumPlayer(tmdbId, btn) {
    playSound('Click.wav');
    let movie = state.activeMovie || state.feedMovies.find(m => m.id == tmdbId) || state.currentHeroMovie;
    if (!movie) return;
    let url = PLAYER_BASE_URL.replace(/\/$/, '') + `?tmdb_id=${movie.id}&title=${encodeURIComponent(movie.original_title || movie.title)}`;
    if (movie.imdb_id) url += `&imdb_id=${movie.imdb_id}`;
    const p = document.getElementById('player_modal'), f = document.getElementById('video_frame');
    document.getElementById('movie_details_modal').style.display = 'none';
    f.src = url; p.style.display = 'flex';
}

export function closePlayer() {
    document.getElementById('player_modal').style.display = 'none'; document.getElementById('video_frame').src = '';
    if(state.activeMovie) document.getElementById('movie_details_modal').style.display = 'block';
}

export function renderHistorySection(items) {
    const section = document.createElement('div'); section.className = 'similar-section'; section.style.gridColumn = '1 / -1';
    let html = `<div class="similar-title" style="padding-left:10px;">${t.history}</div><div class="similar-row">`;
    items.forEach(m => { html += `<div class="similar-card" onclick="window.ui_openHistory('${m.id}')"><img src="${m.img}" loading="lazy"><div class="similar-rating">${m.rating}</div></div>`; });
    html += `</div>`; section.innerHTML = html;
    window.ui_openHistory = (id) => { const m = items.find(i => i.id == id); if(m) openMoviePage(m); };
    return section;
}
