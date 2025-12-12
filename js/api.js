import { KEYS, API_URLS } from './config.js';

// --- ЗАПИТ ДО НОВИН ---
export async function fetchNewsData(query, category, pageToken) {
    let url = `${API_URLS.newsdata}?apikey=${KEYS.NEWSDATA}&language=uk&country=ua&size=10`;
    if (query) url += `&q=${query}`;
    if (category) url += `&category=${category}`;
    if (pageToken) url += `&page=${pageToken}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`News API Error ${res.status}`);
    return await res.json();
}

// --- ЗАПИТ ДО TMDB ---
export async function fetchTMDB(query, page) {
    let url = `${API_URLS.tmdb}`;
    if (query) {
        url += `/search/movie?api_key=${KEYS.TMDB}&language=uk-UA&query=${query}&page=${page}`;
    } else {
        url += `/movie/popular?api_key=${KEYS.TMDB}&language=uk-UA&page=${page}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Error ${res.status}`);
    return await res.json();
}

