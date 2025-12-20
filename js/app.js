// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (v1.7.8)
// ============================================================

import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies, fetchMovieDetails } from './api.js';
import { renderGrid, setupHero, openMoviePage, closeMoviePage, openPremiumPlayer, closePlayer, showSkeletons, removeSkeletons, renderHistorySection } from './ui.js';
import { t, initLanguage } from './i18n.js';
import { initAdminSystem } from './firebase-logic.js'; 
import { playSound } from './sounds.js';

// --- ЕКСПОРТ ДЛЯ HTML ---
window.setCategory = setCategory;
window.switchMode = switchMode;
window.playHeroMovie = () => { if(state.currentHeroMovie) openPremiumPlayer(state.currentHeroMovie.id, null); };
window.infoHeroMovie = () => { if(state.currentHeroMovie) openMoviePage(state.currentHeroMovie); };
window.closeMoviePage = closeMoviePage;
window.closePlayer = closePlayer;
window.performSearchDelayed = performSearchDelayed;
window.openPremiumPlayer = openPremiumPlayer;

window.toggleSideMenu = () => {
    const menu = document.getElementById('side_menu');
    const overlay = document.getElementById('menu_overlay');
    if (menu && overlay) {
        const isActive = menu.classList.toggle('active');
        overlay.style.display = isActive ? 'block' : 'none';
        if (isActive) playSound('Tap.wav');
    }
};

window.openAdminFromMenu = () => {
    window.toggleSideMenu();
    const modal = document.getElementById('admin_modal');
    if (modal) modal.style.display = 'block';
    playSound('Pop.wav');
};

window.closeAdminPanel = () => {
    const modal = document.getElementById('admin_modal');
    if (modal) modal.style.display = 'none';
    playSound('Bubble.wav');
};

window.ui_toggleSave = (id, btn) => {
    toggleSave(id, btn);
    if (state.currentTab === 'saved') switchMode('saved');
};

const tg = window.Telegram?.WebApp;

// --- ІНІЦІАЛІЗАЦІЯ ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        // 🔥 СПОЧАТКУ ТЕЛЕГРАМ НАЛАШТУВАННЯ (для повного екрану)
        if (tg) {
            tg.ready(); 
            tg.expand(); // Розгорнути
            
            // Запит на повноекранний режим (прибирає назву бота зверху)
            if (tg.requestFullscreen) {
                tg.requestFullscreen();
            }
            
            // Вимкнення вертикальних свайпів
            if (tg.disableVerticalSwipes) {
                tg.disableVerticalSwipes();
            }

            // Кольори для безшовного вигляду
            tg.setHeaderColor?.('#000000'); 
            tg.setBackgroundColor?.('#000000');

            if(tg.initDataUnsafe?.user?.photo_url) {
                const avatar = document.getElementById('user_avatar');
                const defAvatar = document.getElementById('default_avatar');
                if (avatar && defAvatar) {
                    avatar.src = tg.initDataUnsafe.user.photo_url;
                    avatar.style.display = 'block';
                    defAvatar.style.display = 'none';
                }
            }
        }

        // Далі логіка адмінки та мови
        await initAdminSystem(); 
        initLanguage();

        await loadCloudData();
        setupInfiniteScroll(); 
        switchMode('home');
        checkDeepLink();

        setTimeout(() => {
            const pre = document.getElementById('preloader');
            if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
        }, 500);

    } catch (error) {
        console.error("INIT ERROR:", error);
    }
}

// ... (решта логіки: switchMode, loadContent, performSearch без змін) ...

async function switchMode(tab) {
    playSound('Tap.wav');
    state.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(tab==='home') navs[0].classList.add('active');
    if(tab==='search') navs[1].classList.add('active');
    if(tab==='saved') navs[2].classList.add('active');
    
    const hero = document.getElementById('hero_section'), filters = document.getElementById('filters_wrapper'), search = document.getElementById('search_bar_container'), content = document.getElementById('content_container'), trigger = document.getElementById('infinite_trigger');
    if (tab === 'home') { if(hero) hero.style.display = 'flex'; if(filters) filters.style.display = 'flex'; if(search) search.style.display = 'none'; if(content) { content.style.display = 'grid'; content.style.paddingTop = '0px'; } if(trigger) trigger.style.display = 'flex'; if (state.feedMovies.length > 0) renderGrid(state.feedMovies, false); else { if(content) content.innerHTML = ''; showSkeletons(12); state.currentPage = 1; loadContent(1); } } 
    else if (tab === 'search') { if(hero) hero.style.display = 'none'; if(filters) filters.style.display = 'none'; if(search) search.style.display = 'block'; if(content) { content.style.display = 'grid'; content.style.paddingTop = '0px'; } if(trigger) trigger.style.display = 'flex'; if (state.searchResults.length > 0) { const limit = (state.searchPage) * 12; renderGrid(state.searchResults.slice(0, Math.max(limit, 12)), false); } else if(content) content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.searching}</div>`; } 
    else if (tab === 'saved') { if(hero) hero.style.display = 'none'; if(filters) filters.style.display = 'none'; if(search) search.style.display = 'none'; if(content) { content.style.display = 'grid'; content.style.paddingTop = 'calc(80px + var(--safe-top))'; } if(trigger) trigger.style.display = 'none'; await loadCloudData(); if(content) { content.innerHTML = ''; if (state.historyItems.length > 0) content.appendChild(renderHistorySection(state.historyItems)); if (state.savedItems.length === 0) content.innerHTML += `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.emptyList}</div>`; else renderGrid(state.savedItems, true); } }
}

function setCategory(catId) {
    playSound('Tap.wav');
    state.currentGenre = catId; state.currentPage = 1; state.feedMovies = []; showSkeletons(12); loadContent(1); 
}

async function loadContent(page, isAppend = false) {
    state.isLoading = true; if (isAppend) showSkeletons(3, true); 
    try {
        const items = await fetchHomeContent(page, state.currentGenre || 'all');
        state.feedMovies = [...state.feedMovies, ...items];
        if (page === 1 && !isAppend && items.length > 0) setupHero(items[Math.floor(Math.random() * Math.min(5, items.length))]);
        removeSkeletons(); renderGrid(items, isAppend);
    } catch(e) { removeSkeletons(); } finally { state.isLoading = false; }
}

function performSearchDelayed() {
    clearTimeout(state.searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query || query.length < 2) return;
    state.searchTimeout = setTimeout(async () => {
        showSkeletons(6); const results = await searchMovies(query);
        state.searchResults = results; state.searchPage = 0; removeSkeletons();
        const container = document.getElementById('content_container');
        if (container) { container.innerHTML = ''; if (results.length === 0) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Нічого не знайдено</div>`; else loadNextSearchBatch(); }
    }, 600);
}

function loadNextSearchBatch() {
    const start = state.searchPage * 12;
    const chunk = state.searchResults.slice(start, start + 12);
    if (chunk.length > 0) { renderGrid(chunk, true); state.searchPage++; }
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (state.isLoading) return;
        if (document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 300) {
            if (state.currentTab === 'home') { state.currentPage++; loadContent(state.currentPage, true); } 
            else if (state.currentTab === 'search') loadNextSearchBatch();
        }
    });
}

async function checkDeepLink() {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam) return;
    try {
        const parts = startParam.split('_');
        const data = await fetchMovieDetails(parts[1], parts[0]);
        const movieObj = { id: data.id, title: data.title || data.name, img: `https://image.tmdb.org/t/p/w500${data.poster_path}`, backdrop: `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`, rating: data.vote_average?.toFixed(1) || 'N/A', year: (data.release_date || data.first_air_date || '').split('-')[0], type: parts[0], desc: data.overview, imdb_id: data.external_ids?.imdb_id, original_title: data.original_title };
        openMoviePage(movieObj);
    } catch (e) { }
}
