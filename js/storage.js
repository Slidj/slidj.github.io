import { state } from './state.js';
import { t } from './i18n.js';

// --- LOAD DATA ---
export function loadCloudData() {
    return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        
        // 1. Load LocalStorage (Backup)
        try {
            const localSaved = localStorage.getItem('savedItems');
            if (localSaved) state.savedItems = JSON.parse(localSaved);
            
            const localHistory = localStorage.getItem('historyItems');
            if (localHistory) state.historyItems = JSON.parse(localHistory);
        } catch(e) {}

        // 2. Load CloudStorage (Primary)
        if (tg && tg.CloudStorage) {
            tg.CloudStorage.getItems(['saved_movies_v1', 'history_movies_v1'], (err, values) => {
                if (!err && values) {
                    try {
                        // Saved
                        if (values['saved_movies_v1']) {
                            const cloudSaved = JSON.parse(values['saved_movies_v1']);
                            if (Array.isArray(cloudSaved)) {
                                state.savedItems = cloudSaved;
                                localStorage.setItem('savedItems', JSON.stringify(state.savedItems));
                            }
                        }
                        // History
                        if (values['history_movies_v1']) {
                            const cloudHistory = JSON.parse(values['history_movies_v1']);
                            if (Array.isArray(cloudHistory)) {
                                state.historyItems = cloudHistory;
                                localStorage.setItem('historyItems', JSON.stringify(state.historyItems));
                            }
                        }
                    } catch (e) { console.error("Cloud Parse Error", e); }
                }
                resolve();
            });
        } else {
            resolve();
        }
    });
}

// --- SAVE DATA ---
export function saveCloudData() {
    // Save to LocalStorage
    localStorage.setItem('savedItems', JSON.stringify(state.savedItems));
    localStorage.setItem('historyItems', JSON.stringify(state.historyItems));

    // Optimize for Cloud (remove heavy descriptions)
    const optimize = (list) => list.map(m => ({
        id: m.id, title: m.title, img: m.img, rating: m.rating, year: m.year, type: m.type
    }));

    const tg = window.Telegram?.WebApp;
    if (tg && tg.CloudStorage) {
        tg.CloudStorage.setItem('saved_movies_v1', JSON.stringify(optimize(state.savedItems)));
        tg.CloudStorage.setItem('history_movies_v1', JSON.stringify(optimize(state.historyItems)));
    }
}

// --- HELPERS ---
export function isSaved(id) { return state.savedItems.some(m => m.id == id); }

// 🔥 НОВА ФУНКЦІЯ: Додати в історію
export function addToHistory(movie) {
    if (!movie) return;

    // Видаляємо, якщо вже є (щоб перемістити на початок)
    state.historyItems = state.historyItems.filter(m => m.id !== movie.id);
    
    // Додаємо в початок
    state.historyItems.unshift(movie);
    
    // Ліміт 20 штук
    if (state.historyItems.length > 20) {
        state.historyItems.pop();
    }
    
    saveCloudData();
}

export function toggleSave(id, btn) {
    let movie = state.feedMovies.find(m => m.id == id);
    if (!movie && state.currentHeroMovie && state.currentHeroMovie.id == id) movie = state.currentHeroMovie;
    if (!movie) movie = state.savedItems.find(m => m.id == id);
    if (!movie) movie = state.historyItems.find(m => m.id == id); // Шукаємо і в історії

    if (!movie) return;

    const index = state.savedItems.findIndex(m => m.id == id);
    if (index === -1) {
        state.savedItems.push(movie);
        if (btn) updateBtnState(btn, true);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } else {
        state.savedItems.splice(index, 1);
        if (btn) updateBtnState(btn, false);
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    }
    saveCloudData();
}

function updateBtnState(btn, saved) {
    const span = btn.querySelector('span');
    const svg = btn.querySelector('svg');
    if(saved) {
        if(span) span.innerText = t.saveBtnActive; 
        if(svg) svg.setAttribute('fill', 'white');
    } else {
        if(span) span.innerText = t.saveBtn; 
        if(svg) svg.setAttribute('fill', 'none');
    }
}
