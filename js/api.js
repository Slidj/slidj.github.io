import { API_KEY, BASE_URL, ALLOHA_TOKEN } from './config.js';

// --- БАЗОВІ ЗАПИТИ ДО TMDB ---
async function fetchTMDB(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    
    // Мова інтерфейсу (для тексту і картинок)
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

// Пошук фільмів (для інтерфейсу)
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

// Отримання деталей фільму
export async function fetchMovieDetails(id, type) {
    const params = {
        // 🔥 ВАЖЛИВО: Ми просимо 'external_ids', щоб отримати IMDb ID
        append_to_response: 'videos,images,credits,external_ids', 
        include_image_language: 'uk,en,null'
    };
    
    const data = await fetchTMDB(`/${type}/${id}`, params);
    return data || {};
}

export async function fetchSimilar(id, type) {
    const data = await fetchTMDB(`/${type}/${id}/recommendations`);
    return (data?.results || []).map(formatMovie);
}

// 🔥 ГОЛОВНА ФУНКЦІЯ: ПОШУК ID ДЛЯ ПЛЕЄРА
export async function fetchKpId(movie) {
    // Якщо ми вже знайшли ID раніше — віддаємо його одразу
    if (movie.kpId) return movie.kpId;

    // Функція запиту до бази плеєра
    const searchPlayer = async (params) => {
        try {
            // Формуємо URL з твоїм токеном
            let url = `https://api.rstprgapipt.com/balancer-api/search?token=${ALLOHA_TOKEN}`;
            Object.keys(params).forEach(k => url += `&${k}=${encodeURIComponent(params[k])}`);
            
            const res = await fetch(url);
            const json = await res.json();
            
            // Якщо знайшли — повертаємо ID (kp_id або kinopoisk_id)
            if (json.data && json.data.length > 0) {
                return json.data[0].kp_id || json.data[0].kinopoisk_id;
            }
        } catch (e) {
            console.error("Player search error:", e);
        }
        return null;
    };

    let foundId = null;

    // 1️⃣ СПРОБА: Шукаємо за IMDb ID (Найнадійніше!)
    let imdbId = movie.imdb_id;
    // Якщо в об'єкті немає ID, спробуємо його доввантажити
    if (!imdbId) {
        try {
            const ext = await fetchTMDB(`/${movie.type === 'tv' ? 'tv' : 'movie'}/${movie.id}/external_ids`);
            if (ext?.imdb_id) imdbId = ext.imdb_id;
        } catch(e){}
    }

    if (imdbId) {
        // Шукаємо в базі плеєра за паспортом (IMDb)
        foundId = await searchPlayer({ imdb: imdbId });
        if (foundId) return foundId;
    }

    // 2️⃣ СПРОБА: Якщо IMDb не спрацював, шукаємо за назвою (Українська)
    foundId = await searchPlayer({ title: movie.title, year: movie.year });
    if (foundId) return foundId;

    // 3️⃣ СПРОБА: Шукаємо за Оригінальною назвою (Англійська)
    if (movie.original_title && movie.original_title !== movie.title) {
        foundId = await searchPlayer({ title: movie.original_title, year: movie.year });
        if (foundId) return foundId;
    }

    // 4️⃣ СПРОБА: Шукаємо тільки за назвою (без року, іноді він відрізняється)
    foundId = await searchPlayer({ title: movie.title });
    
    return foundId;
}

// Форматування даних (тепер зберігаємо більше інфи)
function formatMovie(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        original_title: item.original_title || item.original_name, // Потрібно для пошуку
        imdb_id: item.external_ids?.imdb_id || null,             // Потрібно для пошуку
        img: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'img/no-poster.png',
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '').split('-')[0],
        type: item.media_type || (item.title ? 'movie' : 'tv'),
        desc: item.overview
    };
}
