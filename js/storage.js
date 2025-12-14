import { state } from './state.js';

// Завантаження даних (LocalStorage -> Cloud)
export function loadCloudData() {
    return new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        
        // 1. LocalStorage
        const localData = localStorage.getItem('savedItems');
        if (localData) {
            try { state.savedItems = JSON.parse(localData); } catch(e) {}
        }

        // 2. Telegram Cloud
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
        } else {
            resolve();
        }
    });
}

// Збереження даних
export function saveCloudData() {
    localStorage.setItem('savedItems', JSON.stringify(state.savedItems));

    // Оптимізація для економії місця в хмарі
    const optimizedItems = state.savedItems.map(m => ({
        id: m.id, title: m.title, img: m.img, rating: m.rating, year: m.year, type: m.type
    }));

    const tg = window.Telegram?.WebApp;
    if (tg && tg.CloudStorage) {
        tg.CloudStorage.setItem('saved_movies_v1', JSON.stringify(optimizedItems), (err) => {
            if (err) console.error("Save Error", err);
        });
    }
}

// Перевірка чи збережено
export function isSaved(id) {
    return state.savedItems.some(m => m.id == id);
}

// Перемикач (Зберегти/Видалити)
export function toggleSave(id, btn) {
    let movie = state.feedMovies.find(m => m.id == id);
    if (!movie && state.currentHeroMovie && state.currentHeroMovie.id == id) movie = state.currentHeroMovie;
    if (!movie) movie = state.savedItems.find(m => m.id == id);

    if (!movie) return;

    const index = state.savedItems.findIndex(m => m.id == id);
    if (index === -1) {
        state.savedItems.push(movie);
        if (btn) updateBtnState(btn, true);
    } else {
        state.savedItems.splice(index, 1);
        if (btn) updateBtnState(btn, false);
        // Якщо ми на вкладці "Моє", треба оновити сітку (імпортуємо динамічно або через подію, але поки просто збережемо)
    }
    saveCloudData();
}

function updateBtnState(btn, saved) {
    const span = btn.querySelector('span');
    const svg = btn.querySelector('svg');
    if(saved) {
        if(span) span.innerText = "Збережено";
        if(svg) svg.setAttribute('fill', 'white');
    } else {
        if(span) span.innerText = "Моє";
        if(svg) svg.setAttribute('fill', 'none');
    }
}
