import { API_KEY, BASE_URL, PROXY_URL } from './config.js';

// Основна функція запиту
async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    
    // Визначаємо мову користувача (за замовчуванням uk-UA)
    const userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const lang = (userLang === 'ru') ? 'ru-RU' : 'uk-UA';
    
    url.searchParams.append('language', lang);
    
    // Додаємо інші параметри
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
    const data = await fetchTMDB('/trending/all/week', { page });
    return (data?.results || []).map(formatMovie);
}

export async function searchMovies(query) {
    const data = await fetchTMDB('/search/multi', { query, include_adult: false });
    return (data?.results || []).filter(i => i.media_type !== 'person').map(formatMovie);
}

// 🔥 ОНОВЛЕНО: Додано параметр include_image_language
// Це змушує сервер віддавати англійські логотипи, навіть якщо мова інтерфейсу українська!
export async function fetchMovieDetails(id, type) {
    const params = {
        append_to_response: 'videos,images,credits',
        include_image_language: 'uk,en,null' // <-- ОСЬ ЦЕЙ РЯДОК ВСЕ ВИПРАВЛЯЄ
    };
    
    const data = await fetchTMDB(`/${type}/${id}`, params);
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

export async function fetchKpId(movie) {
    if (movie.kpId) return movie.kpId;
    
    try {
        const cleanTitle = movie.title.replace(/[^\w\sа-яА-Яіїєґ]/gi, '');
        // Використовуємо проксі для пошуку (замініть домен, якщо у вас свій)
        const searchUrl = `https://api.rstprgapipt.com/balancer-api/search?title=${encodeURIComponent(cleanTitle)}&year=${movie.year}`;
        
        const res = await fetch(searchUrl);
        const json = await res.json();
        
        if (json && json.length > 0) {
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
