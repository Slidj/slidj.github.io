import { API_KEY, BASE_URL, PROXY_URL } from './config.js';
import { t } from './i18n.js';

async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    // Визначаємо мову (можна зробити динамічно, але поки зашиваємо на укр/рос для контенту)
    const userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const lang = (userLang === 'uk' || userLang === 'ru') ? 'uk-UA' : 'en-US';
    
    url.searchParams.append('language', lang);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    try {
        const res = await fetch(url);
        if(!res.ok) throw new Error('API Error');
        return await res.json();
    } catch (e) {
        console.error(e);
        return null;
    }
}

export async function fetchHomeContent(page = 1) {
    // Мікс популярних фільмів
    const data = await fetchTMDB('/trending/all/week', { page });
    return (data?.results || []).map(formatMovie);
}

export async function searchMovies(query) {
    const data = await fetchTMDB('/search/multi', { query, include_adult: false });
    return (data?.results || []).filter(i => i.media_type !== 'person').map(formatMovie);
}

// 🔥 ОНОВЛЕНО: Додано запит 'credits' (актори)
export async function fetchMovieDetails(id, type) {
    const append = 'videos,images,credits'; // <-- Ось тут ми просимо акторів
    const data = await fetchTMDB(`/${type}/${id}`, { append_to_response: append });
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

// Пошук ID на Kinopoisk (через проксі) для плеєра
export async function fetchKpId(movie) {
    // Якщо вже є кеш
    if (movie.kpId) return movie.kpId;
    
    // Спроба знайти через IMDB ID (найточніше)
    // Для цього треба було б окремо фечити external_ids, але спробуємо пошук по назві
    try {
        const cleanTitle = movie.title.replace(/[^\w\sа-яА-Яіїєґ]/gi, '');
        const searchUrl = `https://api.rstprgapipt.com/balancer-api/search?title=${encodeURIComponent(cleanTitle)}&year=${movie.year}`;
        
        const res = await fetch(searchUrl);
        const json = await res.json();
        
        // Шукаємо найбільш схожий
        if (json && json.length > 0) {
            // Тут можна додати логіку перевірки (наприклад, співпадіння року)
            const best = json[0];
            return best.id || best.kinopoisk_id;
        }
    } catch (e) {
        console.error('KP Search failed', e);
    }
    return null;
}

function formatMovie(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        img: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'img/no-poster.png',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        desc: item.overview
    };
}
