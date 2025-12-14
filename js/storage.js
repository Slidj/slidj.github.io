import { state } from './state.js';
// 🔥 Імпортуємо переклади
import { t } from './i18n.js';

// ... (функції loadCloudData, saveCloudData, isSaved залишаються ТАКИМИ САМИМИ, як були) ...
// Я пропущу їх тут для економії місця, скопіюй їх з минулого разу або залиш як є.
// ТРЕБА ОНОВИТИ ТІЛЬКИ toggleSave і updateBtnState 👇

export function loadCloudData() {
    return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        const localData = localStorage.getItem('savedItems');
        if (localData) { try { state.savedItems = JSON.parse(localData); } catch(e) {} }
        if (tg && tg.CloudStorage) {
            tg.CloudStorage.getItem('saved_movies_v1', (err, value) => {
                if (!err && value) {
                    try {
                        const cloudItems = JSON.parse(value);
                        if (Array.isArray(cloudItems) && cloudItems.length > 0) {
                            state.savedItems = cloudItems;
                            localStorage.setItem('savedItems', JSON.stringify(state.savedItems));
                        }
                    } catch (e) { console.error("Cloud Error", e); }
                }
                resolve();
            });
        } else { resolve(); }
    });
}

export function saveCloudData() {
    localStorage.setItem('savedItems', JSON.stringify(state.savedItems));
    const optimizedItems = state.savedItems.map(m => ({
        id: m.id, title: m.title, img: m.img, rating: m.rating, year: m.year, type: m.type
    }));
    const tg = window.Telegram?.WebApp;
    if (tg && tg.CloudStorage) {
        tg.CloudStorage.setItem('saved_movies_v1', JSON.stringify(optimizedItems), (err) => { if (err) console.error("Save Error", err); });
    }
}

export function isSaved(id) { return state.savedItems.some(m => m.id == id); }


export function toggleSave(id, btn) {
    let movie = state.feedMovies.find(m => m.id == id);
    if (!movie && state.currentHeroMovie && state.currentHeroMovie.id == id) movie = state.currentHeroMovie;
    if (!movie) movie = state.savedItems.find(m => m.id == id);

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
        // 🔥 t.saveBtnActive
        if(span) span.innerText = t.saveBtnActive; 
        if(svg) svg.setAttribute('fill', 'white');
    } else {
        // 🔥 t.saveBtn
        if(span) span.innerText = t.saveBtn; 
        if(svg) svg.setAttribute('fill', 'none');
    }
}
