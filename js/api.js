import { API_KEY, ALLOHA_TOKEN, TMDB_IMG_URL, TMDB_BACKDROP_URL } from './config.js';
import { state } from './state.js';

// --- TMDB API ---
export async function fetchHomeContent(page = 1) {
    let url = '';
    if (state.currentGenre === '') {
        url = `https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}&language=uk-UA&page=${page}`;
    } else if (state.currentGenre === 'movie') {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&page=${page}`;
    } else if (state.currentGenre === 'tv') {
        url = `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=uk-UA&sort_by=popularity.desc&page=${page}`;
    } else {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=uk-UA&with_genres=${state.currentGenre}&sort_by=popularity.desc&page=${page}`;
    }
    
    const res = await fetch(url);
    const data = await res.json();
    return data.results ? data.results.map(mapTMDB) : [];
}

export async function searchMovies(query) {
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=uk-UA`);
    const data = await res.json();
    return data.results ? data.results.filter(i => i.media_type !== 'person' && i.poster_path).map(mapTMDB) : [];
}

export async function fetchMovieDetails(id, type) {
    const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&language=uk-UA&append_to_response=videos,images,release_dates,content_ratings&include_image_language=uk,en,null`);
    return await res.json();
}

// --- ALLOHA API (KP ID) ---
export async function fetchKpId(movie) {
    state.cachedKpId = null;
    try {
        // 1. Пошук по TMDB ID
        let res = await fetch(`https://api.alloha.tv/?token=${ALLOHA_TOKEN}&tmdb=${movie.id}`);
        let data = await res.json();
        if (data.data && data.data.id_kp) {
            state.cachedKpId = data.data.id_kp;
            return data.data.id_kp;
        }
        
        // 2. Пошук по назві (резерв)
        res = await fetch(`https://api.alloha.tv/?token=${ALLOHA_TOKEN}&name=${encodeURIComponent(movie.title)}`);
        data = await res.json();
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            state.cachedKpId = data.data[0].id_kp;
            return data.data[0].id_kp;
        }
    } catch(e) { console.error(e); }
    return null;
}

// --- HELPER ---
function mapTMDB(item) {
    return {
        id: item.id,
        title: item.title || item.name,
        desc: item.overview,
        img: item.poster_path ? TMDB_IMG_URL + item.poster_path : 'https://via.placeholder.com/200x300?text=No+Img',
        backdrop: item.backdrop_path ? TMDB_BACKDROP_URL + item.backdrop_path : null,
        rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
        year: (item.release_date || item.first_air_date || '----').split('-')[0],
        type: item.media_type || (item.first_air_date ? 'tv' : 'movie')
    };
}
