import { API_KEY, BASE_URL, PROXY_URL, ALLOHA_TOKEN } from './config.js';

// --- БАЗОВІ ФУНКЦІЇ ---
async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    
    const userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const lang = (userLang === 'ru') ? 'ru-RU' : 'uk-UA';
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
    const data = await fetchTMDB('/trending/all/week', { page });
    return (data?.results || []).map(formatMovie);
}

export async function searchMovies(query) {
    const data = await fetchTMDB('/search/multi', { query, include_adult: false });
    const firstResult = data?.results?.[0];

    // Якщо це актор — тягнемо його фільми
    if (firstResult && firstResult.media_type === 'person') {
        try {
            const credits = await fetchTMDB(`/person/${firstResult.id}/combined_credits`);
            if (credits && credits.cast) {
                const allWorks = credits.cast.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                return deduplicate(allWorks.map(formatMovie));
            }
        } catch (e) {
            console.error("Full credits fetch failed", e);
        }
    }

    let results = [];
    (data?.results || []).forEach(item => {
        if (item.media_type === 'person') {
            if (item.known_for && Array.isArray(item.known_for)) {
                results.push(...item.known_for);
            }
        } else {
            results.push(item);
        }
    });

    return deduplicate(results.map(formatMovie));
}

function deduplicate(items) {
    const unique = [];
    const seenIds = new Set();
    items.forEach(m => {
        if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            unique.push(m);
        }
    });
    return unique;
}

export async function fetchMovieDetails(id, type) {
    const params = {
        append_to_response: 'videos,images,credits,external_ids', // 🔥 Треба для точного пошуку
        include_image_language: 'uk,en,null'
    };
    
    const data = await fetchTMDB(`/${type}/${id}`, params);
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

// 🔥 ПОТУЖНИЙ ПОШУК ID ДЛЯ ПЛЕЄРА (4 РІВНІ ПЕРЕВІРКИ)
export async function fetchKpId(movie) {
    if (movie.kpId) return movie.kpId;

    // Функція-помічник для запиту до бази плеєра
    const searchAlloha = async (params) => {
        try {
            // Додаємо токен до кожного запиту!
            let url = `https://api.rstprgapipt.com/balancer-api/search?token=${ALLOHA_TOKEN}`;
            Object.keys(params).forEach(k => url += `&${k}=${encodeURIComponent(params[k])}`);
            
            const res = await fetch(url);
            const json = await res.json();
            
            if (json.data && json.data.length > 0) {
                return json.data[0].kp_id || json.data[0].kinopoisk_id;
            }
        } catch (e) {
            console.error("Alloha search error:", e);
        }
        return null;
    };

    let foundId = null;

    // 1. СПРОБА: Шукаємо по IMDB ID (Найточніше)
    let imdbId = movie.imdb_id;
    // Якщо ID немає в об'єкті, спробуємо його отримати
    if (!imdbId) {
        const ext = await fetchTMDB(`/${movie.type === 'tv' ? 'tv' : 'movie'}/${movie.id}/external_ids`);
        if (ext?.imdb_id) imdbId = ext.imdb_id;
    }

    if (imdbId) {
        foundId = await searchAlloha({ imdb: imdbId });
        if (foundId) return foundId;
    }

    // 2. СПРОБА: Шукаємо по назві + рік (Українська)
    foundId = await searchAlloha({ title: movie.title, year: movie.year });
    if (foundId) return foundId;

    // 3. СПРОБА: Шукаємо по оригінальній назві + рік (Англійська)
    if (movie.original_title && movie.original_title !== movie.title) {
        foundId = await searchAlloha({ title: movie.original_title, year: movie.year });
        if (foundId) return foundId;
    }

    // 4. СПРОБА: Шукаємо БЕЗ року (якщо рік в базах відрізняється)
    foundId = await searchAlloha({ title: movie.title });
    
    return foundId;
}

function formatMovie(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        original_title: item.original_title || item.original_name, // Важливо для пошуку
        imdb_id: item.external_ids?.imdb_id || null, 
        img: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'img/no-poster.png',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        desc: item.overview
    };
}
