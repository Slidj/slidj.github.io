// js/ui.js

export function renderList(items, container, savedItems, append = false) {
    if (!append) container.innerHTML = '';
    
    if (!items || items.length === 0) {
        if (!append) container.innerHTML = '<div class="empty-state"><div class="empty-text">Нічого не знайдено</div></div>';
        return;
    }

    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id);
        const card = document.createElement('div');
        card.className = 'news-card';
        
        // Кодуємо ID для передачі в функцію
        const idEncoded = encodeURIComponent(item.id);
        
        // Формуємо картинку
        // Якщо картинки немає - показуємо заглушку або градієнт
        let imgHTML = '';
        if (item.img) {
            imgHTML = `<div class="news-image-container"><img src="${item.img}" alt="" loading="lazy"></div>`;
        } else {
             imgHTML = `<div class="news-image-container" style="background: #ddd;"></div>`;
        }

        card.innerHTML = `
            <div class="card-content" onclick="openLink('${item.url}', '${idEncoded}')">
                ${imgHTML}
                <div class="news-text-content">
                    <h3>${item.title}</h3>
                    <p>${item.desc || 'Опис відсутній...'}</p>
                </div>
            </div>
            <div class="card-footer">
                <span class="news-date">${item.date ? new Date(item.date).toLocaleDateString() : ''}</span>
                <div class="card-actions">
                    <button class="action-btn share-btn" onclick="shareItem('${item.url}', '${item.title.replace(/'/g, "\\'")}')">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                    </button>
                    <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave('${idEncoded}', '${item.type}', this)">
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

export function renderMovies(items, container, savedItems, append = false) {
    if (!append) container.innerHTML = '';

    if (!items || items.length === 0) {
        if (!append) container.innerHTML = '<div class="empty-state"><div class="empty-text">Фільми не знайдено</div></div>';
        return;
    }

    items.forEach(item => {
        const isSaved = savedItems.some(s => s.id == item.id);
        const card = document.createElement('div');
        card.className = 'movie-card';
        const idEncoded = encodeURIComponent(item.id);

        // 👇 ВАЖЛИВО: onclick передає item.url (який тепер є ID фільму)
        // class="movie-poster" - зображення
        // class="movie-info" - текст
        card.innerHTML = `
            <img src="${item.img || 'img/no-poster.png'}" class="movie-poster" alt="${item.title}" onclick="openLink('${item.url}', '${idEncoded}')">
            ${item.rating ? `<div class="movie-rating">${item.rating}</div>` : ''}
            
            <div class="movie-info">
                <div class="movie-title" onclick="openLink('${item.url}', '${idEncoded}')">${item.title}</div>
                <div class="movie-actions">
                    <button class="action-btn share-btn" onclick="shareItem('https://www.themoviedb.org/movie/${item.id}', '${item.title.replace(/'/g, "\\'")}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    </button>
                    <button class="action-btn bookmark-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave('${idEncoded}', 'movie', this)">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Функції рангу (залишаються без змін)
export function updateRankDisplay() {
    const points = parseInt(localStorage.getItem('userPoints')) || 0;
    const rankEl = document.getElementById('user_rank');
    if (!rankEl) return;
    
    let rankName = 'Новачок';
    if (points > 100) rankName = 'Дослідник';
    if (points > 500) rankName = 'Кіноман';
    if (points > 1000) rankName = 'Експерт';
    if (points > 5000) rankName = 'Легенда';
    
    rankEl.innerText = `${rankName} (${points} балів)`;
}

export function addPoints(amount) {
    let points = parseInt(localStorage.getItem('userPoints')) || 0;
    points += amount;
    localStorage.setItem('userPoints', points);
    updateRankDisplay();
}
