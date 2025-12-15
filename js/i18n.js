// ============================================================
// 🌍 LOCALIZATION (UKRAINIAN & ENGLISH)
// ============================================================

export const t = {
    searchPlaceholder: "Search...",
    tabHome: "Home",
    tabSearch: "Search",
    tabSaved: "My List",
    catAll: "Trending",
    catMovies: "Movies",
    catSeries: "TV Shows",
    catCartoons: "Cartoons",
    emptyList: "List is empty",
    searching: "Searching...",
    syncing: "Syncing...",
    watch: "WATCH",
    saved: "Saved",
    saveBtn: "My List", 
    saveBtnActive: "Saved", 
    match: "Match",
    serialBadge: "SERIES",
    heroTrending: "🔥 Trending",
    descMissing: "No description available.",
    loading: "Loading...",
    unavailable: "UNAVAILABLE",
    checking: "CHECKING...",
    moreLikeThis: "More Like This",
    history: "Watch History",
    share: "Share" // 🔥 NEW
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
        emptyList: "Список пустий",
        searching: "Пошук...",
        syncing: "Синхронізація...",
        watch: "ДИВИТИСЬ",
        saved: "Збережено",
        saveBtn: "Моє",
        saveBtnActive: "Збережено",
        match: "Рейтинг",
        serialBadge: "СЕРІАЛ",
        heroTrending: "🔥 У тренді",
        descMissing: "Опис відсутній.",
        loading: "Завантаження...",
        unavailable: "НЕДОСТУПНО",
        checking: "ПЕРЕВІРКА...",
        moreLikeThis: "Схоже",
        history: "Історія переглядів",
        share: "Поділитись" // 🔥 NEW
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
        emptyList: "List is empty",
        searching: "Searching...",
        syncing: "Syncing...",
        watch: "WATCH",
        saved: "Saved",
        saveBtn: "My List",
        saveBtnActive: "Saved",
        match: "Match",
        serialBadge: "SERIES",
        heroTrending: "🔥 Trending",
        descMissing: "No description available.",
        loading: "Loading...",
        unavailable: "UNAVAILABLE",
        checking: "CHECKING...",
        moreLikeThis: "More Like This",
        history: "Watch History",
        share: "Share" // 🔥 NEW
    }
};

export function initLanguage() {
    const userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    const targetLang = (userLang === 'uk' || userLang === 'ru' || userLang === 'be') ? 'uk' : 'en';
    Object.assign(t, dictionaries[targetLang]);
    updateStaticInterface();
}

function updateStaticInterface() {
    const cats = document.querySelectorAll('.cat-btn');
    if(cats.length >= 4) {
        cats[0].innerText = t.catAll;
        cats[1].innerText = t.catMovies;
        cats[2].innerText = t.catSeries;
        cats[3].innerText = t.catCartoons;
    }

    const navs = document.querySelectorAll('.nav-item span');
    if(navs.length >= 3) {
        navs[0].innerText = t.tabHome;
        navs[1].innerText = t.tabSearch;
        navs[2].innerText = t.tabSaved;
    }

    const searchInput = document.getElementById('search_input');
    if(searchInput) searchInput.placeholder = t.searchPlaceholder;
}
