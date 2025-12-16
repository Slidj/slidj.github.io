import { API_KEY, BASE_URL, ALLOHA_TOKEN } from './config.js';

// --- БАЗОВІ ЗАПИТИ TMDB ---
async function fetchTMDB(endpoint, params = {}) {
    // Перевірка на випадок, якщо BASE_URL не підтягнувся
    const base = BASE_URL || 'https://api.themoviedb.org/3';
    const url = new URL(`${base}${endpoint}`);
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

    // Якщо це актор
    if (firstResult && firstResult.media_type === 'person') {
        try {
            const credits = await fetchTMDB(`/person/${firstResult.id}/combined_credits`);
            if (credits && credits.cast) {
                const allWorks = credits.cast.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                return deduplicate(allWorks.map(formatMovie));
            }
        } catch (e) {}
    }

    let results = [];
    (data?.results || []).forEach(item => {
        if (item.media_type === 'person') {
            if (item.known_for) results.push(...item.known_for);
        } else {
            results.push(item);
        }
    });
    return deduplicate(results.map(formatMovie));
}

function deduplicate(items) {
    const seen = new Set();
    return items.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });
}

export async function fetchMovieDetails(id, type) {
    const data = await fetchTMDB(`/${type}/${id}`, { 
        append_to_response: 'videos,images,credits,external_ids',
        include_image_language: 'uk,en,null'
    });
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

// 🔥 ПОТУЖНИЙ ПОШУК ID (ВИКОРИСТОВУЄМО ДЗЕРКАЛА)
export async function fetchKpId(movie) {
    if (movie.kpId) return movie.kpId;

    // Функція пошуку, яка перебирає дзеркала, якщо основне не працює
    const searchPlayer = async (params) => {
        // Список доменів (основний і запасні)
        const mirrors = [
            'https://api.rstprgapipt.com',  // Основний
            'https://api.apbugall.org',     // Дзеркало 1
            'https://api.alloha.tv'         // Офіційний
        ];

        for (const domain of mirrors) {
            try {
                let url = `${domain}/balancer-api/search?token=${ALLOHA_TOKEN}`;
                Object.keys(params).forEach(k => url += `&${k}=${encodeURIComponent(params[k])}`);
                
                // Ставимо тайм-аут 3 секунди, щоб не чекати вічно
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                const json = await res.json();
                
                if (json.data && json.data.length > 0) {
                    return json.data[0].kp_id || json.data[0].kinopoisk_id;
                }
            } catch (e) {
                // Якщо дзеркало не працює — пробуємо наступне
                console.warn(`Mirror failed: ${domain}`, e);
            }
        }
        return null;
    };

    // 1. Отримуємо IMDb ID
    let imdbId = movie.imdb_id;
    if (!imdbId) {
        const type = movie.type === 'tv' ? 'tv' : 'movie'; // Захист типу
        const ext = await fetchTMDB(`/${type}/${movie.id}/external_ids`);
        if (ext?.imdb_id) imdbId = ext.imdb_id;
    }

    // 2. Стратегія пошуку
    if (imdbId) {
        const id = await searchPlayer({ imdb: imdbId });
        if (id) return id;
    }

    let id = await searchPlayer({ title: movie.title, year: movie.year });
    if (id) return id;

    if (movie.original_title) {
        id = await searchPlayer({ title: movie.original_title, year: movie.year });
        if (id) return id;
    }

    return await searchPlayer({ title: movie.title });
}

function formatMovie(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        original_title: item.original_title || item.original_name,
        imdb_id: item.external_ids?.imdb_id || null, 
        img: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'img/no-poster.png',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        desc: item.overview
    };
}
