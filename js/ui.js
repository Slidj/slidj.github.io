// --- СТАН БАЛІВ ---
export let userPoints = parseInt(localStorage.getItem('userPoints')) || 0;

// Красива іконка "Поділитися" (SVG)
const shareIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>`;

export function addPoints(amount) {
    userPoints += amount;
    if (userPoints < 0) userPoints = 0;
    localStorage.setItem('userPoints', userPoints);
    updateRankDisplay();
    
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

export function updateRankDisplay() {
    const rankEl = document.getElementById('rank_name');
    const pointsEl = document.getElementById('points_count');
    
    let rank = "Читач 👶";
    if (userPoints >= 100) rank = "Кіноман 🍿";
    if (userPoints >= 500) rank = "Критик 🧐";
    if (userPoints >= 1000) rank = "Редактор 🎩";
    if (userPoints >= 5000) rank = "Магнат 👑";

    if (rankEl) rankEl.innerText = rank;
    if (pointsEl) pointsEl.innerText = userPoints;
}

// --- РЕНДЕРИНГ СПИСКУ (НОВИНИ) ---
export function renderList(items, container, savedItems, isAppend = false) {
    if (!isAppend) container.innerHTML = '';
    
    if (items.length === 0 && !isAppend) {
        container.innerHTML = '<div class="empty-state"><div class="empty-text">Нічого не знайдено</div></div>';
        return;
    }

    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id);
        const card = document.createElement('div');
        card.className = 'news-card';
        const safeId = encodeURIComponent(item.id);
        
        const imgHtml = item.img ? `<div class="news-image-container"><img src="${item.img}" onerror="this.style.display='none'"></div>` : '';

        card.innerHTML = `
            <div class="card-content" onclick="window.openLink('${item.url}')">
                ${imgHtml}
                <div class="news-text-content">
                    <h3>${item.title}</h3>
                    <p>${item.desc || ''}</p>
                </div>
            </div>
            <div class="card-footer">
                <div class="card-actions">
                     <button class="action-btn share-btn" onclick="window.shareItem('${item.url}', 'News')">${shareIcon}</button>
                     <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="window.toggleSave('${safeId}', 'news', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                     </button>
                </div>
                <div class="news-date">${item.date?.substring(0,10) || ''}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// --- РЕНДЕРИНГ СІТКИ (КІНО) ---
export function renderMovies(items, container, savedItems, isAppend = false) {
    if (!isAppend) container.innerHTML = '';
    
    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id);
        const card = document.createElement('div');
        card.className = 'movie-card';
        const safeId = encodeURIComponent(item.id);
        const imgSrc = item.img || 'https://via.placeholder.com/500x750?text=No+Poster';

        card.innerHTML = `
            <div style="position: relative;" onclick="window.openLink('${item.url}')">
                <img src="${imgSrc}" class="movie-poster">
                <div class="movie-rating">★ ${item.rating}</div>
            </div>
            <div class="movie-info">
                <div class="movie-title">${item.title}</div>
                <div class="movie-actions">
                     <button class="action-btn share-btn" onclick="window.shareItem('${item.url}', 'Movie')">${shareIcon}</button>
                     <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="window.toggleSave('${safeId}', 'movie', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                     </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
