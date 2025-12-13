import { KEYS, API_URLS } from './config.js';

// --- 1. ЗАПИТ ДО НОВИН (NewsData.io) ---
// Використовується для показу свіжих новин, коли пошук пустий
export async function fetchNewsData(query, category, pageToken) {
    let url = `${API_URLS.newsdata}?apikey=${KEYS.NEWSDATA}&language=uk&country=ua&size=10`;

    if (query) {
        // Кодуємо запит, щоб "Київ погода" передавалося коректно
        const encodedQuery = encodeURIComponent(query.trim());
        url += `&q=${encodedQuery}`;
    }

    if (category) url += `&category=${category}`;
    if (pageToken) url += `&page=${pageToken}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`News API Error ${res.status}`);
    return await res.json();
}

// --- 2. ЗАПИТ ДО КІНО (TMDB) ---
// Шукає фільми або показує популярні
export async function fetchTMDB(query, page) {
    let url = `${API_URLS.tmdb}`;
    
    if (query) {
        const encodedQuery = encodeURIComponent(query.trim());
        url += `/search/movie?api_key=${KEYS.TMDB}&language=uk-UA&query=${encodedQuery}&page=${page}`;
    } else {
        url += `/movie/popular?api_key=${KEYS.TMDB}&language=uk-UA&page=${page}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Error ${res.status}`);
    return await res.json();
}

// --- 3. РОЗУМНИЙ ПОШУК (Google Custom Search) ---
// Використовується, коли користувач вводить щось у пошук (для новин)
export async function fetchGoogleSearch(query, page = 1) {
    // Google API використовує індекс 'start', а не номер сторінки.
    // Сторінка 1 = start 1, Сторінка 2 = start 11, Сторінка 3 = start 21...
    const start = (page - 1) * 10 + 1;
    
    const encodedQuery = encodeURIComponent(query.trim());
    
    // Формуємо URL запиту
    const url = `${API_URLS.googleSearch}?key=${KEYS.GOOGLE_KEY}&cx=${KEYS.GOOGLE_CX}&q=${encodedQuery}&start=${start}&num=10`;

    const res = await fetch(url);
    
    if (!res.ok) {
        // Обробка ліміту (100 запитів на день безкоштовно)
        if (res.status === 429) {
            throw new Error("Ліміт безкоштовного пошуку Google на сьогодні вичерпано 😔");
        }
        throw new Error(`Google Search Error ${res.status}`);
    }
    
    return await res.json();
}



// js/api.js

// ... (попередні функції fetchNews, fetchTMDB, fetchGoogle залишаються) ...

// --- ОТРИМАННЯ ПОСИЛАННЯ НА ВІДЕО (ALLOHA) ---
export async function fetchAllohaPlayer(tmdbId) {
    // Формуємо запит до бази
    const url = `${API_URLS.allohaApi}/?token=${KEYS.ALLOHA}&tmdb=${tmdbId}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    // Alloha зазвичай повертає структуру: { data: { iframe: "https://..." } }
    if (data && data.data && data.data.iframe) {
        return data.data.iframe;
    } else {
        throw new Error("Фільм поки що відсутній у базі Alloha");
    }
}
