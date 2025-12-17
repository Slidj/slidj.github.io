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
                resolve(); // Кажемо "Готово", код може йти далі
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
            resolve(); // Кажемо "Готово" миттєво
        }
    });
}

export function saveCloudData() {
    const savedStr = JSON.stringify(state.savedItems);
    const historyStr = JSON.stringify(state.historyItems);

    // ВАРІАНТ 1: Зберігаємо в Telegram
    if (isTg()) {
        window.Telegram.WebApp.CloudStorage.setItem('saved_movies', savedStr);
        window.Telegram.WebApp.CloudStorage.setItem('history_movies', historyStr);
    } 
    // ВАРІАНТ 2: Зберігаємо в Браузері
    else {
        localStorage.setItem('saved_movies', savedStr);
        localStorage.setItem('history_movies', historyStr);
    }
}

// --- Решта функцій без змін, але вони тепер використовують saveCloudData ---

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
            if(span) span.innerText = 'У "Моє"'; // Текст з api.js/i18n краще брати, але тут хардкод для прикладу
            if(svg) { svg.setAttribute('fill', 'none'); svg.style.fill = 'none'; }
        }
    } else {
        // Додаємо
        let movie = state.activeMovie; 
        if (!movie) movie = state.feedMovies.find(m => m.id == id);
        if (!movie) movie = state.historyItems.find(m => m.id == id); // Шукаємо в історії теж
        
        if (movie) {
            // Зберігаємо мінімум даних, щоб не забити пам'ять
            const minMovie = {
                id: movie.id,
                title: movie.title,
                img: movie.img,
                rating: movie.rating,
                year: movie.year,
                type: movie.type,
                original_title: movie.original_title, // Важливо для плеєра
                imdb_id: movie.imdb_id // Важливо для плеєра
            };
            state.savedItems.unshift(minMovie);
            
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
    // Видаляємо дублікат, якщо вже є
    state.historyItems = state.historyItems.filter(i => i.id !== movie.id);
    
    const minMovie = {
        id: movie.id,
        title: movie.title,
        img: movie.img,
        rating: movie.rating,
        year: movie.year,
        type: movie.type,
        original_title: movie.original_title,
        imdb_id: movie.imdb_id
    };
    
    // Додаємо на початок
    state.historyItems.unshift(minMovie);
    
    // Обмежуємо історію (наприклад, останні 50)
    if (state.historyItems.length > 50) {
        state.historyItems.pop();
    }
    
    saveCloudData();
}
