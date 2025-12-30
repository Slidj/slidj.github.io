export const state = {
    // Головна стрічка
    feedMovies: [],
    currentPage: 1,
    isLoading: false,
    currentGenre: 'all',
    currentTab: 'home',
    
    // Дані для модалок
    activeMovie: null,
    currentHeroMovie: null,
    cachedKpId: null,
    
    // Історія та збережене
    savedItems: [],
    historyItems: [],

    // Для пошуку
    searchResults: [], 
    searchPage: 0,     
    searchTimeout: null,

    // 🔥 НОВЕ: Таймер для нарахування хвилин перегляду
    playerHeartbeatTimer: null
};
