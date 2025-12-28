export const t = {
    searchPlaceholder: "Search...",
    tabHome: "Home",
    tabSearch: "Search",
    tabSaved: "My List",
    catAll: "Trending",
    catMovies: "Movies",
    catSeries: "TV Shows",
    catCartoons: "Cartoons",
    watch: "WATCH",
    btnInfo: "Info",
    saveBtn: "My List", 
    saveBtnActive: "Saved", 
    share: "Share",
    shareMessage: "Watch",
    loading: "Loading...",
    emptyList: "List is empty",
    searching: "Searching...",
    syncing: "Syncing...",
    checking: "CHECKING...",
    menuTitle: "Menu",
    menuAdmin: "⚙️ Admin Panel",
    menuProfile: "👤 Profile",
    menuDonate: "⭐ Support Project",
    menuPromo: "Enter Promo Code",
    promoTitle: "🎁 Get a Gift",
    promoInputPlaceholder: "Enter code...",
    promoBtnActivate: "ACTIVATE",
    promoBtnCancel: "Cancel",
    bonusTitle: "+0.5 Ticket",
    bonusHalfMsg: "Lucky you! You found half a ticket.<br><span style='color: #aaa; font-size: 14px;'>Come back tomorrow to get the second half!</span>",
    bonusFullMsg: "Welcome back! Ticket completed.<br><span style='color: #46d369; font-weight: bold;'>(Total +1.0)</span>",
    bonusBtn: "AWESOME!",
    donateTitle: "Support MEDIA HUB",
    donateDesc: "Your support helps us pay for servers and add new movies.",
    donateLvl1: "☕ Cup of Coffee",
    donateLvl2: "🍿 Movie Ticket",
    donateLvl3: "👑 Project Patron",
    donateClose: "Maybe Later",
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
    modalMin: "min",
    modalHour: "h",
    modalDirector: "Director",
    modalWriters: "Writers",
    descMissing: "No description available.",
    moreLikeThis: "More Like This",
    match: "Match",
    serialBadge: "SERIES",
    heroTrending: "🔥 Trending",
    history: "Watch History"
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
        btnInfo: "Інфо",
        saveBtn: "Моє",
        saveBtnActive: "Збережено",
        share: "Поділитись",
        shareMessage: "Дивись",
        loading: "Завантаження...",
        emptyList: "Список порожній",
        searching: "Пошук...",
        syncing: "Синхронізація...",
        checking: "ПЕРЕВІРКА...",
        menuTitle: "Меню",
        menuAdmin: "⚙️ Адмін-панель",
        menuProfile: "👤 Профіль",
        menuDonate: "⭐ Підтримати проект",
        menuPromo: "Ввести промокод",
        promoTitle: "🎁 Отримати подарунок",
        promoInputPlaceholder: "Введіть код...",
        promoBtnActivate: "АКТИВУВАТИ",
        promoBtnCancel: "Скасувати",
        bonusTitle: "+0.5 Ticket",
        bonusHalfMsg: "Вам пощастило! Ви знайшли половинку квитка.<br><span style='color: #aaa; font-size: 14px;'>Зайдіть завтра, щоб гарантовано забрати другу частину!</span>",
        bonusFullMsg: "Ви повернулися! Квиток зібрано повністю.<br><span style='color: #46d369; font-weight: bold;'>(Разом +1.0)</span>",
        bonusBtn: "СУПЕР!",
        donateTitle: "Підтримка MEDIA HUB",
        donateDesc: "Ваші донати допомагають нам оплачувати сервери та додавати нові фільми.",
        donateLvl1: "☕ Чашка кави",
        donateLvl2: "🍿 Квиток у кіно",
        donateLvl3: "👑 Меценат проекту",
        donateClose: "Можливо пізніше",
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
        modalMin: "хв",
        modalHour: "год",
        modalDirector: "Режисер",
        modalWriters: "Сценарій",
        descMissing: "Опис відсутній.",
        moreLikeThis: "Схоже на це",
        match: "збіг",
        serialBadge: "СЕРІАЛ",
        heroTrending: "🔥 У тренді",
        history: "Історія переглядів"
    }
};

export function initLanguage() {
    // 1. Отримуємо мову від Телеграму або беремо 'uk' за замовчуванням
    let userLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code || 'uk';
    
    // 2. Переводимо в нижній регістр (щоб UK-UA стало uk-ua)
    userLang = userLang.toLowerCase();

    // 3. 🔥 ВИПРАВЛЕННЯ: Перевіряємо, чи ПОЧИНАЄТЬСЯ код з 'uk'
    // Це спрацює і для 'uk', і для 'uk-ua', і для 'uk-UA'
    const isUkrainian = userLang.startsWith('uk') || userLang === 'ru' || userLang === 'be'; // Можна додати ru/be до української, якщо треба
    
    const targetLang = isUkrainian ? 'uk' : 'en'; 

    // 4. Застосовуємо словник
    if (dictionaries[targetLang]) Object.assign(t, dictionaries[targetLang]);
    
    updateStaticInterface();
}

function updateStaticInterface() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        // Використовуємо innerHTML, щоб працювали теги <br> і <span> в тексті
        if (t[key]) el.innerHTML = t[key]; 
    });
    
    const searchInput = document.getElementById('search_input');
    if(searchInput) searchInput.placeholder = t.searchPlaceholder;

    const promoInput = document.getElementById('user_promo_input');
    if(promoInput) promoInput.placeholder = t.promoInputPlaceholder;
}
