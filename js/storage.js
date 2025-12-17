import { state } from './state.js';

// Перевіряємо, чи ми в Telegram
const isTg = () => window.Telegram?.WebApp?.CloudStorage;

export async function loadCloudData() {
    return new Promise((resolve) => {
        if (isTg()) {
            window.Telegram.WebApp.CloudStorage.getItems(['saved_movies', 'history_movies'], (err, values) => {
                if (!err && values) {
                    if (values.saved_movies) {
                        try { state.savedItems = JSON.parse(values.saved_movies); } catch (e) {}
                    }
                    if (values.history_movies) {
                        try { state.historyItems = JSON.parse(values.history_movies); } catch (e) {}
                    }
                }
                resolve(); 
            });
        } else {
            // Браузер
            try {
                const saved = localStorage.getItem('saved_movies');
                const history = localStorage.getItem('history_movies');
                if (saved) state.savedItems = JSON.parse(saved);
                if (history) state.historyItems = JSON.parse(history);
            } catch (e) {}
            resolve();
        }
    });
}

// Функція для безпечного збереження
function safeSave(key, dataArray) {
    try {
        const jsonStr = JSON.stringify(dataArray);
        
        if (isTg()) {
            window.Telegram.WebApp.CloudStorage.setItem(key, jsonStr, (err, stored) => {
                if (err) {
                    console.warn(`Error saving ${key}:`, err);
                    // Якщо помилка (швидше за все ліміт), пробуємо видалити останній елемент і зберегти знову
                    if (dataArray.length > 1) {
                        dataArray.pop(); 
                        safeSave(key, dataArray); // Рекурсивна спроба
                    }
                }
            });
        } else {
            localStorage.setItem(key, jsonStr);
        }
    } catch (e) {
        console.error("Save error", e);
    }
}

export function saveCloudData() {
    safeSave('saved_movies', state.savedItems);
    safeSave('history_movies', state.historyItems);
}

export function isSaved(id) {
    return state.savedItems.some(i => i.id == id);
}

export function toggleSave(id, btn) {
    if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    const index = state.savedItems.findIndex(i => i.id == id);
    
    if (index >= 0) {
        // Видаляємо
        state.savedItems.splice(index, 1);
        updateBtnState(btn, false);
    } else {
        // Додаємо
        const movie = findMovieById(id);
        if (movie) {
            state.savedItems.unshift(minifyMovie(movie));
            // ЛІМІТ: 20 штук для збережених
            if (state.savedItems.length > 20) state.savedItems.pop();
            updateBtnState(btn, true);
        }
    }
    saveCloudData();
}

export function addToHistory(movie) {
    if (!movie || !movie.id) return;

    // Видаляємо дублікат
    state.historyItems = state.historyItems.filter(i => i.id !== movie.id);
    
    // Додаємо на початок
    state.historyItems.unshift(minifyMovie(movie));
    
    // 🔥 ЖОРСТКИЙ ЛІМІТ: 15 штук для історії
    // Це дає гарантію, що ми вліземо в ліміт навіть з довгими назвами
    if (state.historyItems.length > 15) {
        state.historyItems.pop();
    }
    
    saveCloudData();
}

// --- Допоміжні функції ---

function findMovieById(id) {
    return state.activeMovie || 
           state.feedMovies.find(m => m.id == id) || 
           state.searchResults.find(m => m.id == id) || 
           state.historyItems.find(m => m.id == id);
}

function minifyMovie(movie) {
    // Зберігаємо тільки критично важливі дані
    return {
        id: movie.id,
        title: movie.title ? movie.title.substring(0, 50) : 'Movie', // Обрізаємо дуже довгі назви
        img: movie.img,
        rating: movie.rating,
        type: movie.type
    };
}

function updateBtnState(btn, saved) {
    if (!btn) return;
    const span = btn.querySelector('span');
    const svg = btn.querySelector('svg');
    // Тексти можна брати з t.saveBtn, але тут спрощено для надійності
    if(span) span.innerText = saved ? 'Збережено' : 'В моє';
    if(svg) { 
        svg.setAttribute('fill', saved ? 'white' : 'none'); 
        svg.style.fill = saved ? 'white' : 'none'; 
    }
}
