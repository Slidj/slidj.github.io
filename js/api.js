import { API_KEY, BASE_URL, PROXY_URL, ALLOHA_TOKEN } from './config.js'; // 🔥 Додали ALLOHA_TOKEN

// Основна функція запиту до TMDB
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
        append_to_response: 'videos,images,credits,external_ids', // 🔥 Додали external_ids щоб знайти IMDB ID
        include_image_language: 'uk,en,null'
    };
    
    const data = await fetchTMDB(`/${type}/${id}`, params);
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

// 🔥 ГОЛОВНЕ ВИПРАВЛЕННЯ: ПОШУК ID ДЛЯ ПЛЕЄРА
export async function fetchKpId(movie) {
    if (movie.kpId) return movie.kpId;

    // Крок 1: Спробуємо отримати IMDB ID з TMDB (це найнадійніший спосіб)
    let imdbId = movie.imdb_id;
    if (!imdbId) {
        try {
            // Якщо IMDB ID немає в об'єкті, зробимо швидкий запит щоб отримати його
            const ext = await fetchTMDB(`/${movie.type === 'tv' ? 'tv' : 'movie'}/${movie.id}/external_ids`);
            if (ext && ext.imdb_id) imdbId = ext.imdb_id;
        } catch(e) {}
    }

    // Крок 2: Якщо є IMDB ID — шукаємо по ньому (це 100% результат)
    if (imdbId) {
        try {
            // 🔥 ВАЖЛИВО: Додали &token=${ALLOHA_TOKEN}
            const url = `https://api.rstprgapipt.com/balancer-api/search?imdb=${imdbId}&token=${ALLOHA_TOKEN}`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.data && json.data.length > 0) {
                return json.data[0].kp_id || json.data[0].kinopoisk_id;
            }
        } catch(e) { console.error("IMDB search failed", e); }
    }

    // Крок 3: Якщо IMDB не допоміг, шукаємо за назвою (як запасний варіант)
    const performSearch = async (titleToSearch) => {
        if (!titleToSearch) return null;
        try {
            const cleanTitle = titleToSearch.replace(/[^\w\sа-яА-Яіїєґ]/gi, '').trim();
            // 🔥 ВАЖЛИВО: Додали &token=${ALLOHA_TOKEN}
            const searchUrl = `https://api.rstprgapipt.com/balancer-api/search?title=${encodeURIComponent(cleanTitle)}&year=${movie.year}&token=${ALLOHA_TOKEN}`;
            
            const res = await fetch(searchUrl);
            const json = await res.json();
            
            if (json.data && json.data.length > 0) {
                return json.data[0].kp_id || json.data[0].kinopoisk_id;
            }
        } catch (e) {
            console.error('Title search failed', e);
        }
        return null;
    };

    let foundId = await performSearch(movie.title);
    if (!foundId && movie.original_title) {
        foundId = await performSearch(movie.original_title);
    }

    return foundId;
}

function formatMovie(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        original_title: item.original_title || item.original_name,
        imdb_id: item.external_ids?.imdb_id || null, // Зберігаємо, якщо є
        img: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'img/no-poster.png',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        desc: item.overview
    };
}
