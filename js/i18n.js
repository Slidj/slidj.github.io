// ============================================================
// 🌍 LOCALIZATION (UKRAINIAN & ENGLISH)
// ============================================================

export const t = {
    // Основні
    searchPlaceholder: "Search...",
    tabHome: "Home",
    tabSearch: "Search",
    tabSaved: "My List",
    catAll: "Trending",
    catMovies: "Movies",
    catSeries: "TV Shows",
    catCartoons: "Cartoons",
    watch: "WATCH",
    saveBtn: "My List", 
    saveBtnActive: "Saved", 
    share: "Share",
    loading: "Loading...",
    
    // Адмін-панель та меню
    menuTitle: "Menu",
    menuAdmin: "⚙️ Admin Panel",
    menuProfile: "👤 Profile",
    maintTitle: "Maintenance",
    maintDesc: "We are updating Media Hub. Please come back later!",
    blockTitle: "Access Denied",
    blockDesc: "Your account has been blocked.",
    statusOnline: "today at",
    statusYesterday: "yesterday at",
    statusDays: "days ago at",
    statusLong: "long ago at",

    // Деталі фільму
    modalRelease: "Release Date",
    modalGenres: "Genres",
    modalRuntime: "Runtime",
    modalRating: "Rating",
    modalActors: "Cast",
    modalTrailers: "Trailers",
    modalMin: "min"
};

const dictionaries = {
    uk: {
        searchPlaceholder: "Пошук...",
        tabHome: "Головна",
        tabSearch: "Пошук",
        tabSaved: "Моє",
        catAll: "У тренді",
        catMovies: "Фільми",
        catSeries: "Серіали",
        catCartoons: "Мультики",
        watch: "ДИВИТИСЬ",
        saveBtn: "Моє",
        saveBtnActive: "Збережено",
        share: "Поділитись",
        loading: "Завантаження...",
        
        menuTitle: "Меню",
        menuAdmin: "⚙️ Адмін-панель",
        menuProfile: "👤 Профіль",
        maintTitle: "Технічне обслуговування",
        maintDesc: "Ми оновлюємо Media Hub. Поверніться пізніше!",
        blockTitle: "Доступ обмежено",
        blockDesc: "Ваш аккаунт заблоковано.",
        statusOnline: "сьогодні о",
        statusYesterday: "вчора о",
        statusDays: "дні назад о",
        statusLong: "давно був о",

        modalRelease: "Дата виходу",
        modalGenres: "Жанри",
        modalRuntime: "Тривалість",
        modalRating: "Рейтинг",
        modalActors: "Актори",
        modalTrailers: "Трейлери",
        modalMin: "хв"
    },
    en: {
        searchPlaceholder: "Search...",
        tabHome: "Home",
        tabSearch: "Search",
        tabSaved: "My List",
        catAll: "Trending",
        catMovies: "Movies",
        catSeries: "TV Shows",
        catCartoons: "Cartoons",
        watch: "WATCH",
        saveBtn: "My List",
        saveBtnActive: "Saved",
        share: "Share",
        loading: "Loading...",
        
        menuTitle: "Menu",
        menuAdmin: "⚙️ Admin Panel",
        menuProfile: "👤 Profile",
        maintTitle: "Maintenance",
        maintDesc: "We are updating Media Hub. Please come back later!",
        blockTitle: "Access Denied",
        blockDesc: "Your account has been blocked.",
        statusOnline: "today at",
        statusYesterday: "yesterday at",
        statusDays: "days ago at",
        statusLong: "long ago at",

        modalRelease: "Release Date",
        modalGenres: "Genres",
        modalRuntime: "Runtime",
        modalRating: "Rating",
        modalActors: "Cast",
        modalTrailers: "Trailers",
        modalMin: "min"
    }
};

export function initLanguage() {
    const userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const targetLang = (userLang === 'uk' || userLang === 'ru' || userLang === 'be' || !userLang) ? 'uk' : 'en';
    
    if (dictionaries[targetLang]) {
        Object.assign(t, dictionaries[targetLang]);
    }
    
    updateStaticInterface();
}

function updateStaticInterface() {
    // Оновлюємо елементи з data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });

    // Оновлюємо плейсхолдери
    const searchInput = document.getElementById('search_input');
    if(searchInput) searchInput.placeholder = t.searchPlaceholder;
}
