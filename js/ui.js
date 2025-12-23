import { state } from './state.js';
import { isSaved, toggleSave, addToHistory } from './storage.js';
import { fetchMovieDetails, fetchSimilar } from './api.js';
import { PLAYER_BASE_URL, BOT_USERNAME } from './config.js';
import { t } from './i18n.js';
import { playSound } from './sounds.js';

window.openDonateMenu = () => { window.toggleSideMenu(); playSound('Pop.wav'); const m = document.getElementById('donate_modal'); if (m) m.style.display = 'flex'; };
window.closeDonateMenu = () => { playSound('Bubble.wav'); const m = document.getElementById('donate_modal'); if (m) m.style.display = 'none'; };

// 🔥 ОПЛАТА TELEGRAM STARS
window.selectDonateLevel = (stars) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');

    const links = {
        5:  "https://t.me/$dg8POh3jOErKFgAAXydTAL3IV5g",
        20: "https://t.me/$IGZ5qh3jOErLFgAAdaeivliYG7k",
        50: "https://t.me/$8xXaLh3jOErMFgAA3wPWf_AsLvM"
    };

    const invoiceUrl = links[stars];

    if (!invoiceUrl) {
        console.error("Link not found for stars:", stars);
        return;
    }

    sessionStorage.setItem('pending_donation', stars);

    if (window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(invoiceUrl, (status) => {
            if (status === 'paid') {
                window.processSuccessfulDonation(stars);
            } else if (status === 'failed') {
                window.Telegram.WebApp.showAlert('Оплата не пройшла. Спробуйте ще раз.');
            } else if (status === 'cancelled') {
                console.log("Оплату скасовано");
            }
        });
    } else {
        window.open(invoiceUrl, '_blank');
    }
};

window.processSuccessfulDonation = (stars) => {
    window.closeDonateMenu();
    playSound('Notification.wav');
    if(window.saveDonation) window.saveDonation(stars);
    const notif = document.getElementById('notification_bar');
    const txt = document.getElementById('notif_text');
    if(notif && txt) {
        txt.innerText = `Дякуємо! Ви підтримали нас на ${stars} Stars! 🌟`;
        notif.classList.add('active');
        setTimeout(() => notif.classList.remove('active'), 5000);
    }
};

export function showSkeletons(count = 12, isAppend = false) {
    const c = document.getElementById('content_container'); if (!c) return; if (!isAppend) c.innerHTML = '';
    for (let i = 0; i < count; i++) { const d = document.createElement('div'); d.className = 'movie-poster-card skeleton temp-skeleton'; c.appendChild(d); }
}
export function removeSkeletons() { document.querySelectorAll('.temp-skeleton').forEach(el => el.remove()); }

export function renderGrid(items, isAppend = false) {
    const c = document.getElementById('content_container'); 
    if (!c) return; 
    if (!isAppend) c.innerHTML = '';
    
    items.forEach((item, index) => {
        const d = document.createElement('div'); 
        d.className = 'movie-poster-card card-anim'; 
        d.onclick = () => { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light'); openMoviePage(item); };
        
        let badgeHtml = '';
        if (item.type === 'tv') badgeHtml += `<div class="type-badge">${t.serialBadge}</div>`;
        
        // Бейдж TOP-10
        if (state.currentTab === 'home' && index < 10 && !isAppend) {
             badgeHtml += `<div class="top10-badge"><span>TOP</span>${index + 1}</div>`;
        }

        d.innerHTML = `<img src="${item.img}" loading="lazy">${badgeHtml}<div class="rating-mini">${item.rating}</div>`;
        c.appendChild(d);
    });
}

// 🔥 Кнопка "Play Something" (Рандом)
export function toggleRandomButton(isVisible) {
    const fab = document.getElementById('random_fab');
    if (fab) fab.style.display = isVisible ? 'flex' : 'none';
}

// Рандомний вибір
window.playRandomMovie = () => {
    playSound('Tap.wav');
    const items = state.feedMovies;
    if (!items || items.length === 0) {
        window.Telegram?.WebApp?.showAlert("Стрічка ще вантажиться...");
        return;
    }
    const randomItem = items[Math.floor(Math.random() * items.length)];
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    openMoviePage(randomItem);
};

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
    state.activeMovie = movie; 
    addToHistory(movie);
    
    const modal = document.getElementById('movie_details_modal');
    const content = document.getElementById('movie_details_content');
    if (!modal || !content) return;

    document.body.style.overflow = 'hidden';
    content.classList.remove('modal-closing-anim');
    
    let initialBackdrop = movie.backdrop || movie.img;
    if(initialBackdrop && initialBackdrop.includes('/w500/')) {
        initialBackdrop = initialBackdrop.replace('/w500/', '/w1280/'); 
    }

    content.innerHTML = `
        <div class="nf-container">
            <div class="nf-hero">
                <div class="nf-backdrop" style="background-image: url('${initialBackdrop}');"></div>
                <div class="nf-gradient"></div>
                <div class="nf-hero-content">
                    <div id="dynamic_title_area" class="title-fade-in" style="min-height: 50px;"></div>
                    <div class="nf-meta"><span>Завантаження...</span></div>
                </div>
            </div>
            <div style="padding: 40px; display: flex; justify-content: center; align-items: center; color: #666;">
                <div class="netflix-loader"></div>
            </div>
        </div>
    `;
    modal.style.display = 'block';

    const apiType = movie.type === 'tv' ? 'tv' : 'movie';
    
    try {
        const [data, similar] = await Promise.all([
            fetchMovieDetails(movie.id, apiType),
            fetchSimilar(movie.id, apiType)
        ]);

        let details = { ...movie }; 
        let logoUrl = null, castHtml = '', trailersHtml = '', similarHtml = '';

        if (data.external_ids?.imdb_id) state.activeMovie.imdb_id = details.imdb_id = data.external_ids.imdb_id;
        if (data.original_title) state.activeMovie.original_title = data.original_title;
        
        details.desc = data.overview || movie.desc;
        const rt = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null);
        if (rt) details.runtime = rt > 60 ? `${Math.floor(rt/60)}${t.modalHour} ${rt%60}${t.modalMin}` : `${rt}${t.modalMin}`;
        details.age = data.adult ? '18+' : '16+';

        if (data.images?.logos?.length > 0) {
            const logo = data.images.logos.find(l => l.iso_639_1 === 'uk') || 
                         data.images.logos.find(l => l.iso_639_1 === 'en') || 
                         data.images.logos[0];
            logoUrl = `https://image.tmdb.org/t/p/w500${logo.file_path}`;
        }

        if (data.credits?.cast) {
            castHtml = `<div class="cast-section"><div class="cast-title">${t.modalActors}</div><div class="cast-row">${data.credits.cast.slice(0,10).filter(p=>p.profile_path).map(p=>`<div class="cast-card"><img src="https://image.tmdb.org/t/p/w200${p.profile_path}" class="cast-img"><div class="cast-name">${p.name}</div></div>`).join('')}</div></div>`;
        }
        if (data.videos?.results) {
            const trailers = data.videos.results.filter(v => v.type === 'Trailer').slice(0,3);
            if(trailers.length > 0) {
                trailersHtml = `<div class="trailer-section"><div class="trailer-title">${t.modalTrailers}</div><div class="trailer-row">${trailers.map(v => `<div class="trailer-card" onclick="window.ui_openTrailer('${v.key}')"><div class="trailer-img-box"><img src="https://img.youtube.com/vi/${v.key}/mqdefault.jpg" loading="lazy"><div class="trailer-play-icon">▶</div></div></div>`).join('')}</div></div>`;
            }
        }
        if (similar && similar.length > 0) {
            similarHtml = `<div class="similar-section"><div class="similar-title">${t.moreLikeThis}</div><div class="similar-row">${similar.map(m => `<div class="similar-card" onclick="window.ui_openSimilar('${m.id}','${m.type}')"><img src="${m.img}" loading="lazy"><div class="similar-rating">${m.rating}</div></div>`).join('')}</div></div>`;
        }

        // Розрахунок рейтингу
        let matchPercent = ''; 
        if (details.rating && details.rating !== 'N/A') {
            const numericRating = parseFloat(details.rating);
            if (!isNaN(numericRating) && numericRating > 0) {
                matchPercent = Math.round(numericRating * 10) + '%';
            }
        }
        const matchLabel = matchPercent ? `<span class="nf-match">${matchPercent} ${t.match}</span>` : '';

        content.innerHTML = `
            <div class="nf-container">
                <div class="nf-hero">
                    <div class="nf-backdrop" style="background-image: url('${details.backdrop || details.img}');"></div>
                    <div class="nf-gradient"></div>
                    <div class="nf-hero-content">
                        <div id="dynamic_title_area" class="title-fade-in" style="min-height: 50px;"></div>
                        <div class="nf-meta">
                            ${matchLabel}
                            <span>${details.year}</span>
                            <span class="nf-age">${details.age}</span>
                            <span>${details.runtime || ''}</span>
                            <span class="nf-badge">HD</span>
                        </div>
                    </div>
                </div>
                <div class="nf-btn-row">
                    <button class="nf-btn nf-play" onclick="window.openPremiumPlayer('${movie.id}', this)">
                        <svg viewBox="0 0 24 24" fill="black" width="24" height="24"><path d="M8 5v14l11-7z"/></svg>
                        <span>${t.watch}</span>
                    </button>
                    <div class="nf-actions-group">
                        <button class="nf-btn nf-secondary" onclick="window.ui_toggleSave('${movie.id}', this)">
                            <svg viewBox="0 0 24 24" fill="${isSaved(movie.id)?'white':'none'}" stroke="white" stroke-width="2" width="24" height="24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                            <span>${isSaved(movie.id)?t.saveBtnActive:t.saveBtn}</span>
                        </button>
                        <button class="nf-btn nf-secondary" onclick="window.ui_share('${movie.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" width="24" height="24"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            <span>${t.share}</span>
                        </button>
                    </div>
                </div>
                <div class="nf-description">${details.desc || t.descMissing}</div>
                ${trailersHtml} 
                ${castHtml} 
                ${similarHtml}
                <div style="height: 50px;"></div>
            </div>
        `;

        const titleArea = document.getElementById('dynamic_title_area');
        if (titleArea) {
            if (logoUrl) {
                const img = new Image();
                img.src = logoUrl;
                img.className = "nf-logo";
                img.onload = () => {
                    titleArea.innerHTML = ''; 
                    titleArea.appendChild(img);
                    requestAnimationFrame(() => titleArea.classList.add('title-visible'));
                };
            } else {
                titleArea.innerHTML = `<div class="nf-title-text">${details.title}</div>`;
                requestAnimationFrame(() => titleArea.classList.add('title-visible'));
            }
        }

        window.ui_openSimilar = (id, type) => { const target = similar.find(m => m.id == id); if (target) openMoviePage(target); };
        window.ui_openTrailer = (key) => { const p = document.getElementById('player_modal'), f = document.getElementById('video_frame'); document.getElementById('movie_details_modal').style.display = 'none'; f.src = `https://www.youtube.com/embed/${key}?autoplay=1`; p.style.display = 'flex'; };
        window.ui_share = (id) => { 
            let m = state.activeMovie || state.feedMovies.find(i=>i.id==id); 
            if(!m) return; 
            const botLink = `https://t.me/${BOT_USERNAME}/app?startapp=${m.type}_${m.id}`;
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(t.shareMessage + " " + m.title)}`; 
            window.Telegram?.WebApp?.openTelegramLink(shareUrl); 
        };

    } catch (e) { 
        console.error("Помилка завантаження деталей:", e);
        content.innerHTML = `<div style="padding:50px; text-align:center;">Помилка завантаження даних.<br>Спробуйте пізніше.</div>`;
    }
}

export function closeMoviePage() {
    const modal = document.getElementById('movie_details_modal'), content = document.getElementById('movie_details_content');
    if (!modal) return; 
    playSound('Bubble.wav'); 
    
    document.body.style.overflow = '';
    content.classList.add('modal-closing-anim');
    setTimeout(() => { modal.style.display = 'none'; content.innerHTML = ''; state.activeMovie = null; if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide(); }, 300);
}

// 🔥 ОНОВЛЕНО: ЛОГІКА ПОВНОГО ЕКРАНУ
export function openPremiumPlayer(tmdbId, btn) {
    playSound('Click.wav');
    let movie = state.activeMovie || state.feedMovies.find(m => m.id == tmdbId) || state.currentHeroMovie;
    if (!movie) return;
    
    // Формуємо посилання
    let url = PLAYER_BASE_URL.replace(/\/$/, '') + `?tmdb_id=${movie.id}&title=${encodeURIComponent(movie.original_title || movie.title)}`;
    if (movie.imdb_id) url += `&imdb_id=${movie.imdb_id}`;
    
    const p = document.getElementById('player_modal');
    const f = document.getElementById('video_frame');
    
    // Ховаємо деталі фільму, щоб вони не перекривали плеєр
    const details = document.getElementById('movie_details_modal');
    if(details) details.style.display = 'none';
    
    // 1. Пробуємо розгорнути Telegram (якщо підтримується)
    if (window.Telegram?.WebApp?.requestFullscreen) {
        window.Telegram.WebApp.requestFullscreen();
    }
    // 2. Блокуємо орієнтацію та ховаємо хедер
    if (window.Telegram?.WebApp?.expand) {
        window.Telegram.WebApp.expand();
    }

    f.src = url; 
    p.style.display = 'flex';
}

// 🔥 ФІКС: ТЕПЕР МИ НЕ ВИХОДИМО З ПОВНОГО ЕКРАНУ
export function closePlayer() {
    const p = document.getElementById('player_modal');
    const f = document.getElementById('video_frame');
    
    p.style.display = 'none'; 
    f.src = ''; 
    
    // ❌ ВИДАЛИВ: exitFullscreen()
    // Цей рядок повертав системну смугу. Ми його прибрали.
    
    // ✅ ДОДАВ: На всяк випадок ПІДТВЕРДЖУЄМО повний екран
    if (window.Telegram?.WebApp?.requestFullscreen) {
        window.Telegram.WebApp.requestFullscreen();
    }
    
    // І переконуємось, що додаток розгорнуто
    if (window.Telegram?.WebApp?.expand) {
        window.Telegram.WebApp.expand();
    }

    // Тримаємо хедер чорним
    if (window.Telegram?.WebApp?.setHeaderColor) {
        window.Telegram.WebApp.setHeaderColor('#000000');
        window.Telegram.WebApp.setBackgroundColor('#000000');
    }

    // Повертаємо вікно з деталями
    if(state.activeMovie) {
        const details = document.getElementById('movie_details_modal');
        if(details) details.style.display = 'block';
    }
}

export function renderHistorySection(items) {
    const section = document.createElement('div'); section.className = 'similar-section'; section.style.gridColumn = '1 / -1';
    let html = `<div class="similar-title" style="padding-left:10px;">${t.history}</div><div class="similar-row" style="padding-left:10px;">`;
    items.forEach(m => { html += `<div class="similar-card" onclick="window.ui_openHistory('${m.id}')"><img src="${m.img}" loading="lazy"><div class="similar-rating">${m.rating}</div></div>`; });
    html += `</div>`; section.innerHTML = html;
    window.ui_openHistory = (id) => { const m = items.find(i => i.id == id); if(m) openMoviePage(m); };
    return section;
}

// ==========================================
// 🎄 ЛОГІКА СВЯТКОВОЇ ІКОНКИ
// ==========================================

window.saveHolidayIcon = (filename) => {
    if (!window.firebase) return;
    firebase.database().ref('settings/holiday_icon').set(filename)
        .then(() => { window.Telegram?.WebApp?.showAlert('Іконку змінено!'); })
        .catch(e => console.error(e));
};

export function initHolidayIconListener() {
    if (!window.firebase) return;
    
    const iconEl = document.getElementById('holiday_icon');
    const selectEl = document.getElementById('holiday_select');

    firebase.database().ref('settings/holiday_icon').on('value', (snapshot) => {
        const filename = snapshot.val();
        
        if (filename && filename !== "") {
            iconEl.src = `images/holidays/${filename}`;
            iconEl.style.display = 'block';
            iconEl.classList.add('logo-anim');
        } else {
            iconEl.style.display = 'none';
            iconEl.src = '';
            iconEl.classList.remove('logo-anim');
        }

        if (selectEl) selectEl.value = filename || "";
    });
}

const checkFirebaseInterval = setInterval(() => {
    if (window.firebase) {
        clearInterval(checkFirebaseInterval);
        initHolidayIconListener();
    }
}, 500);

// 🔥 Слухаємо кліки по меню в index.html, щоб ховати кнопку FAB
document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', (e) => {
        const fab = document.getElementById('random_fab');
        const isHome = e.currentTarget.innerText.includes('Головна') || e.currentTarget.innerText.includes('Home');
        if(fab) fab.style.display = isHome ? 'flex' : 'none';
    });
});
