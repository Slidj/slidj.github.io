import { state } from './state.js';

// Перевіряємо, чи ми в Telegram
const isTg = () => window.Telegram?.WebApp?.CloudStorage;

export async function loadCloudData() {
    return new Promise((resolve) => {
        // ВАРІАНТ 1: Ми в Telegram -> Тягнемо з хмари
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
        } 
        // ВАРІАНТ 2: Ми в Браузері -> Тягнемо з LocalStorage
        else {
            try {
                const saved = localStorage.getItem('saved_movies');
                const history = localStorage.getItem('history_movies');
                if (saved) state.savedItems = JSON.parse(saved);
                if (history) state.historyItems = JSON.parse(history);
            } catch (e) {
                console.error("Local storage error", e);
            }
            resolve();
        }
    });
}

export function saveCloudData() {
    const savedStr = JSON.stringify(state.savedItems);
    const historyStr = JSON.stringify(state.historyItems);

    // ВАРІАНТ 1: Зберігаємо в Telegram
    if (isTg()) {
        // CloudStorage має ліміт 4096 байт на ключ.
        // Якщо рядок задовгий - він не збережеться.
        // Тому ми контролюємо довжину масивів у функціях toggleSave та addToHistory
        window.Telegram.WebApp.CloudStorage.setItem('saved_movies', savedStr, (err, stored) => {
            if(err) console.warn("Save Error (Saved):", err);
        });
        window.Telegram.WebApp.CloudStorage.setItem('history_movies', historyStr, (err, stored) => {
            if(err) console.warn("Save Error (History):", err);
        });
    } 
    // ВАРІАНТ 2: Зберігаємо в Браузері
    else {
        localStorage.setItem('saved_movies', savedStr);
        localStorage.setItem('history_movies', historyStr);
    }
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
        if (btn) {
            const span = btn.querySelector('span');
            const svg = btn.querySelector('svg');
            if(span) span.innerText = 'В моє'; // Хардкод або t.saveBtn
            if(svg) { svg.setAttribute('fill', 'none'); svg.style.fill = 'none'; }
        }
    } else {
        // Додаємо
        let movie = state.activeMovie; 
        if (!movie) movie = state.feedMovies.find(m => m.id == id);
        if (!movie) movie = state.searchResults.find(m => m.id == id); // Шукаємо в пошуку
        if (!movie) movie = state.historyItems.find(m => m.id == id); // Шукаємо в історії
        
        if (movie) {
            // 🔥 ОПТИМІЗАЦІЯ: Зберігаємо тільки те, що треба для списку
            const minMovie = {
                id: movie.id,
                title: movie.title,
                img: movie.img,
                rating: movie.rating,
                year: movie.year,
                type: movie.type
                // Прибираємо heavy fields (original_title, imdb_id), щоб влазило більше.
                // При відкритті фільму ми все одно підвантажимо деталі з API.
            };
            state.savedItems.unshift(minMovie);
            
            // Ліміт збережених (щоб не впертися в 4096 байт)
            if (state.savedItems.length > 25) state.savedItems.pop();

            if (btn) {
                const span = btn.querySelector('span');
                const svg = btn.querySelector('svg');
                if(span) span.innerText = 'Збережено';
                if(svg) { svg.setAttribute('fill', 'white'); svg.style.fill = 'white'; }
            }
        }
    }
    saveCloudData();
}

export function addToHistory(movie) {
    // Видаляємо дублікат
    state.historyItems = state.historyItems.filter(i => i.id !== movie.id);
    
    // 🔥 ОПТИМІЗАЦІЯ: Максимально стискаємо об'єкт
    const minMovie = {
        id: movie.id,
        title: movie.title,
        img: movie.img,
        rating: movie.rating,
        type: movie.type
        // Ми не зберігаємо year, original_title, imdb_id в історії, щоб економити місце.
        // Для відображення в стрічці "Історія" цього достатньо.
    };
    
    state.historyItems.unshift(minMovie);
    
    // 🔥 ЖОРСТКИЙ ЛІМІТ: 20 елементів
    // Це гарантує, що JSON рядок буде менше 4096 байт
    if (state.historyItems.length > 20) {
        state.historyItems.pop();
    }
    
    saveCloudData();
}
