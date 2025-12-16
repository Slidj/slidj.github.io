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

    // 🔥 НОВЕ: Для пошуку та пагінації результатів
    searchResults: [], // Тут лежить повний список знайденого (наприклад 100 фільмів)
    searchPage: 0,     // Яку "сторінку" (порцію) ми зараз показуємо
    searchTimeout: null
};
