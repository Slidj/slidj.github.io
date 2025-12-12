import { KEYS, API_URLS } from './config.js';

// --- ЗАПИТ ДО НОВИН ---
export async function fetchNewsData(query, category, pageToken) {
    let url = `${API_URLS.newsdata}?apikey=${KEYS.NEWSDATA}&language=uk&country=ua&size=10`;

    if (query) {
        // 👇 ГОЛОВНЕ ВИПРАВЛЕННЯ:
        // 1. .trim() прибирає пробіли на початку і в кінці.
        // 2. encodeURIComponent перетворює "Київ погода" на "Київ%20погода".
        // Тепер сервер бачитиме ВСІ слова, а не тільки перше.
        const encodedQuery = encodeURIComponent(query.trim());
        
        // NewsData за замовчуванням шукає статті, де є І те, І інше слово (AND logic)
        // Але якщо ви хочете "розумний" пошук (щоб шукало фразу навіть якщо слова розкидані),
        // то стандартного кодування зазвичай достатньо.
        url += `&q=${encodedQuery}`;
    }

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
        // 👇 Тут теж додаємо кодування, щоб можна було шукати "Людина павук"
        const encodedQuery = encodeURIComponent(query.trim());
        url += `/search/movie?api_key=${KEYS.TMDB}&language=uk-UA&query=${encodedQuery}&page=${page}`;
    } else {
        url += `/movie/popular?api_key=${KEYS.TMDB}&language=uk-UA&page=${page}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB Error ${res.status}`);
    return await res.json();
}
