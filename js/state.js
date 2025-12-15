export const state = {
    currentTab: 'home',
    feedMovies: [],      // Стрічка
    savedItems: [],      // Збережене
    
    activeMovie: null,   // 🔥 НОВЕ: Фільм, який зараз відкритий у вікні
    
    currentHeroMovie: null,
    currentPage: 1,
    isLoading: false,
    currentGenre: '',
    cachedKpId: null,
    searchTimeout: null
};
