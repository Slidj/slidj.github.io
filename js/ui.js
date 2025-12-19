import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchSimilar } from './api.js';
import { PLAYER_BASE_URL } from './config.js'; 
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

export function renderHistorySection(items) {
    const section = document.createElement('div');
    section.className = 'similar-section'; 
    section.style.marginTop = '10px'; section.style.marginBottom = '30px'; section.style.gridColumn = '1 / -1'; section.style.width = '100%'; section.style.minWidth = '0'; 
    const titleText = t.history || 'Watch History'; 
    let html = `<div class="similar-title" style="padding-left:10px;">${titleText}</div><div class="similar-row" style="padding-left:10px;">`;
    items.forEach(m => {
        html += `<div class="similar-card" onclick="window.ui_openHistory('${m.id}')"><img src="${m.img}" loading="lazy"><div class="similar-rating">${m.rating}</div></div>`;
    });
    html += `</div>`;
    section.innerHTML = html;
    window.ui_openHistory = (id) => { const movie = state.historyItems.find(m => m.id == id); if(movie) openMoviePage(movie); };
    return section;
}

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
            
            if (data.images?.logos?.length > 0) {
                const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
                if (logo && title) {
                    const logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
                    title.innerHTML = `<img src="${logoUrl}" alt="${movie.title}" class="nf-logo" style="max-height: 120px; width: auto; margin-bottom: 10px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">`;
                }
            }
        } catch (e) { }
    }
}

export async function openMoviePage(movie) {
    if (typeof gtag === 'function') {
        gtag('event', 'view_item', {
            'item_id': movie.id,
            'item_name': movie.title,
            'content_type': movie.type
        });
    }

    state.activeMovie = movie;
    addToHistory(movie);
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal) return;
    modal.scrollTop = 0;
    
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
    let logoUrl = null, castHtml = '', trailersHtml = '', techHtml = '';
    const apiType = movie.type === 'tv' ? 'tv' : 'movie';

    try {
        const data = await fetchMovieDetails(movie.id, apiType);
        
        if (data.external_ids?.imdb_id) {
            state.activeMovie.imdb_id = data.external_ids.imdb_id;
            details.imdb_id = data.external_ids.imdb_id;
        }
        if (data.original_title) {
            state.activeMovie.original_title = data.original_title;
        }

        details.desc = data.overview || movie.desc;
        
        // 🔥 ПЕРЕКЛАДЕНО: Тривалість
        if (data.runtime) {
            const hrs = Math.floor(data.runtime/60);
            const mins = data.runtime%60;
            details.runtime = `${hrs}${t.modalHour} ${mins}${t.modalMin}`;
        }

        // 🔥 ПЕРЕКЛАДЕНО: Технічна інформація
        const directors = data.credits?.crew?.filter(c => c.job === 'Director').map(d => d.name).join(', ');
        const writers = data.credits?.crew?.filter(c => c.job === 'Writer' || c.job === 'Screenplay').map(w => w.name).join(', ');
        const genres = data.genres?.map(g => g.name).join(', ');

        techHtml = `
            <div class="nf-tech-info">
                ${directors ? `<div class="tech-item"><span class="tech-label">${t.modalDirector}:</span> ${directors}</div>` : ''}
                ${writers ? `<div class="tech-item"><span class="tech-label">${t.modalWriters}:</span> ${writers}</div>` : ''}
                ${genres ? `<div class="tech-item"><span class="tech-label">${t.modalGenres}:</span> ${genres}</div>` : ''}
            </div>
        `;
        
        // 🔥 ПЕРЕКЛАДЕНО: Секція акторів
        if (data.credits?.cast?.length > 0) {
            const topCast = data.credits.cast.slice(0, 10).filter(p => p.profile_path); 
            if(topCast.length > 0) {
                const castCards = topCast.map(p => `
                    <div class="cast-card" onclick="window.ui_searchActor('${p.name.replace(/'/g, "\\'")}')">
                        <img src="https://image.tmdb.org/t/p/w200${p.profile_path}" class="cast-img" loading="lazy">
                        <div class="cast-name">${p.name}</div>
                        <div class="cast-role">${p.character || ''}</div>
                    </div>
                `).join('');
                castHtml = `<div class="cast-section"><div class="cast-title">${t.modalActors}</div><div class="cast-row">${castCards}</div></div>`;
            }
        }

        // Лого
        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || data.images.logos.find(l => l.iso_639_1 === 'en') || data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }

        // 🔥 ПЕРЕКЛАДЕНО: Секція трейлерів
        if (data.videos?.results?.length > 0) {
            const videos = data.videos.results.filter(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'));
            
            if (videos.length > 0) {
                const videoCards = videos.map(v => `
                    <div class="trailer-card" onclick="window.ui_openTrailer('${v.key}')">
                        <div class="trailer-img-box">
                            <img src="https://img.youtube.com/vi/${v.key}/hqdefault.jpg" loading="lazy">
                            <div class="trailer-play-icon">
                                <svg viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                    </div>
                `).join('');
                trailersHtml = `<div class="trailer-section"><div class="trailer-title">${t.modalTrailers}</div><div class="trailer-row">${videoCards}</div></div>`;
            }
        }

    } catch (e) { console.error(e); }

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
        similarHtml = `<div class="similar-section"><div class="similar-title">${t.moreLikeThis}</div><div class="similar-row">${cards}</div></div>`;
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
            
            ${techHtml} ${trailersHtml}
            ${castHtml}
            ${similarHtml}
            
            <div style="height: 50px;"></div>
        </div>
    `;

    window.ui_openSimilar = (id, type) => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); const target = similarMovies.find(m => m.id == id); if (target) openMoviePage(target); };
    
    // 🔥 ПЕРЕКЛАДЕНО: Повідомлення для "Поділитись"
    window.ui_share = (id) => { 
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); 
        let m = state.activeMovie || state.feedMovies.find(i=>i.id==id); 
        if(!m) return; 
        const startParam = `${m.type}_${m.id}`; 
        const botLink = `https://t.me/younews_app_bot/app?startapp=${startParam}`; 
        const text = `🎬 ${t.shareMessage} "${m.title}" (${m.year}) у MEDIA HUB!`; 
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`; 
        window.Telegram?.WebApp?.openTelegramLink(shareUrl); 
    };

    window.ui_searchActor = (name) => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); closeMoviePage(); switchMode('search'); const input = document.getElementById('search_input'); if(input) { input.value = name; if(window.performSearchDelayed) window.performSearchDelayed(); } };
    
    window.ui_openTrailer = (key) => {
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
        const modal = document.getElementById('player_modal');
        const iframe = document.getElementById('video_frame');
        document.getElementById('movie_details_modal').style.display = 'none';
        iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&rel=0`;
        modal.style.display = 'flex';
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

export function openPremiumPlayer(tmdbId, btn) {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
    const span = btn?.querySelector('span');
    const originalText = span ? span.innerText : t.watch;

    if (!PLAYER_BASE_URL) {
        alert("🚨 ПОМИЛКА: Немає PLAYER_BASE_URL");
        return;
    }

    let movie = state.activeMovie || state.feedMovies.find(m => m.id == tmdbId) || state.savedItems.find(m => m.id == tmdbId) || state.historyItems.find(m => m.id == tmdbId) || state.currentHeroMovie;

    if (!movie) { alert("Помилка: Фільм не знайдено"); return; }

    if(btn) { btn.style.opacity = 0.7; if(span) span.innerText = t.checking; }

    let baseUrl = PLAYER_BASE_URL.replace(/\/$/, '');
    let params = `?tmdb_id=${movie.id}`;
    if (movie.imdb_id) params += `&imdb_id=${movie.imdb_id}`;
    params += `&title=${encodeURIComponent(movie.original_title || movie.title)}`;
    params += `&translation=2`;

    let url = baseUrl + params;
    launchPlayer(url);

    if(btn) { 
        setTimeout(() => {
            btn.style.opacity = 1; 
            if(span) span.innerText = originalText; 
        }, 1000);
    }
}

function launchPlayer(url) {
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
