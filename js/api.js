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



// --- НОВИЙ РОЗУМНИЙ ПОШУК GOOGLE ---
export async function fetchGoogleSearch(query, page = 1) {
    // Google використовує "start" замість номера сторінки.
    // Сторінка 1 -> start=1, Сторінка 2 -> start=11, Сторінка 3 -> start=21
    const start = (page - 1) * 10 + 1;
    
    const encodedQuery = encodeURIComponent(query.trim());
    
    // Формуємо URL
    const url = `${API_URLS.googleSearch}?key=${KEYS.GOOGLE_KEY}&cx=${KEYS.GOOGLE_CX}&q=${encodedQuery}&start=${start}&num=10&searchType=image`; 
    // searchType=image - якщо хочете шукати картинки, але краще прибрати цей параметр, 
    // щоб шукало статті, а картинки брало з метаданих. 
    
    // 👇 Правильний запит для змішаного пошуку (текст + картинки в метаданих)
    const finalUrl = `${API_URLS.googleSearch}?key=${KEYS.GOOGLE_KEY}&cx=${KEYS.GOOGLE_CX}&q=${encodedQuery}&start=${start}&num=10`;

    const res = await fetch(finalUrl);
    
    if (!res.ok) {
        // Якщо ліміт 100 запитів вичерпано, Google поверне 429
        if (res.status === 429) {
            throw new Error("Ліміт безкоштовного пошуку Google на сьогодні вичерпано 😔");
        }
        throw new Error(`Google Search Error ${res.status}`);
    }
    
    return await res.json();
}
