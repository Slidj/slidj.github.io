import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies, fetchMovieDetails } from './api.js';
import { renderGrid, setupHero, openMoviePage, closeMoviePage, openPremiumPlayer, closePlayer, showSkeletons, removeSkeletons, renderHistorySection } from './ui.js?v=2';
import { t, initLanguage } from './i18n.js?v=3';
import { initAdminSystem } from './firebase-logic.js?v=2'; 
import { playSound } from './sounds.js';

// --- ЕКСПОРТИ ---
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

window.openAdminFromMenu = () => { window.toggleSideMenu(); if (window.openAdminPanel) window.openAdminPanel(); playSound('Pop.wav'); };
window.closeAdminPanel = () => { document.getElementById('admin_modal').style.display = 'none'; playSound('Bubble.wav'); };
window.ui_toggleSave = (id, btn) => { toggleSave(id, btn); if (state.currentTab === 'saved') switchMode('saved'); };

const tg = window.Telegram?.WebApp;
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        if (tg) {
            tg.ready(); tg.expand(); 
            if(tg.requestFullscreen) tg.requestFullscreen();
            tg.setHeaderColor?.('#000000'); tg.setBackgroundColor?.('#000000');
            
            updateUserProfile();
            setTimeout(() => updateUserProfile(), 500);

            tg.onEvent('invoiceClosed', (object) => {
                if (object.status === 'paid') {
                    const stars = parseInt(sessionStorage.getItem('pending_donation')) || 0;
                    if(stars > 0) window.processSuccessfulDonation(stars);
                }
            });
        }

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
    } catch (e) { console.error(e); }
}

function updateUserProfile() {
    let user = tg?.initDataUnsafe?.user;
    if (user) {
        const headerAvatar = document.getElementById('user_avatar');
        const headerDefault = document.getElementById('default_avatar');
        const photoUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name)}&background=333&color=fff`;

        if (headerAvatar && headerDefault) {
            headerAvatar.src = photoUrl;
            headerAvatar.style.display = 'block';
            headerDefault.style.display = 'none';
        }
        
        const menuName = document.getElementById('menu_username_text');
        const menuAvatar = document.getElementById('menu_avatar_img');
        
        if (menuName) menuName.innerText = user.first_name + (user.last_name ? ' ' + user.last_name : '');
        if (menuAvatar) menuAvatar.src = photoUrl;
    }
}

async function switchMode(tab) {
    playSound('Tap.wav');
    state.currentTab = tab;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(tab==='home') navs[0].classList.add('active');
    if(tab==='search') navs[1].classList.add('active');
    if(tab==='saved') navs[2].classList.add('active');

    const hero = document.getElementById('hero_section'), filters = document.getElementById('filters_wrapper'), search = document.getElementById('search_bar_container'), content = document.getElementById('content_container'), trigger = document.getElementById('infinite_trigger');
    
    if (tab === 'home') {
        if(hero) hero.style.display = 'flex'; if(filters) filters.style.display = 'flex'; if(search) search.style.display = 'none';
        if(content) { content.style.display = 'grid'; content.style.paddingTop = '0px'; }
        if(trigger) trigger.style.display = 'flex';
        if (state.feedMovies.length > 0) renderGrid(state.feedMovies, false);
        else { if(content) content.innerHTML = ''; showSkeletons(12); state.currentPage = 1; loadContent(1); }
    } 
    else if (tab === 'search') {
        if(hero) hero.style.display = 'none'; if(filters) filters.style.display = 'none'; 
        if(search) search.style.display = 'block'; 
        
        // 🔥 ВИПРАВЛЕННЯ: Додаємо великий відступ зверху, щоб картки не ховались під пошуком
        if(content) { 
            content.style.display = 'grid'; 
            content.style.paddingTop = 'calc(130px + var(--safe-top))'; 
        }
        
        if(trigger) trigger.style.display = 'flex';
        
        if (state.searchResults.length > 0) {
            renderGrid(state.searchResults, false);
        } else {
            const input = document.getElementById('search_input');
            if(content) {
                if(!input || !input.value) content.innerHTML = ''; 
                else content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.searching}</div>`;
            }
        }
    } 
    else if (tab === 'saved') {
        if(hero) hero.style.display = 'none'; if(filters) filters.style.display = 'none'; if(search) search.style.display = 'none';
        if(content) { content.style.display = 'grid'; content.style.paddingTop = 'calc(80px + var(--safe-top))'; content.innerHTML = ''; }
        if(trigger) trigger.style.display = 'none';
        await loadCloudData();
        if(content) {
            if (state.historyItems.length > 0) content.appendChild(renderHistorySection(state.historyItems));
            if (state.savedItems.length > 0) {
                const title = document.createElement('div'); title.className = 'similar-title'; title.style.gridColumn = '1/-1'; title.innerText = t.tabSaved; content.appendChild(title);
                renderGrid(state.savedItems, true);
            } else if (!state.historyItems.length) content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.emptyList}</div>`;
        }
    }
}

function setCategory(catId, btnElement) {
    playSound('Tap.wav');
    if (btnElement) {
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
    }
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
    const query = document.getElementById('search_input')?.value;
    const container = document.getElementById('content_container');

    if (!query || query.length < 2) {
        state.searchResults = [];
        state.currentSearchQuery = "";
        if (container) container.innerHTML = '';
        return;
    }

    state.searchTimeout = setTimeout(async () => {
        showSkeletons(6); 
        state.currentSearchQuery = query;
        state.searchPage = 1;
        
        const results = await searchMovies(query, 1);
        state.searchResults = results; 
        state.searchPage = 1;
        
        removeSkeletons();
        if (container) { 
            container.innerHTML = ''; 
            if (!results.length) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Нічого не знайдено</div>`; 
            else renderGrid(results, true); 
        }
    }, 600);
}

async function loadSearchContent(page) {
    if (!state.currentSearchQuery) return;
    state.isLoading = true;
    showSkeletons(3, true);
    
    try {
        const results = await searchMovies(state.currentSearchQuery, page);
        state.searchResults = [...state.searchResults, ...results];
        removeSkeletons();
        if (results.length > 0) renderGrid(results, true);
    } catch(e) { 
        removeSkeletons(); 
    } finally { 
        state.isLoading = false; 
    }
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (state.isLoading) return;
        
        if (document.documentElement.scrollHeight - window.scrollY - window.innerHeight < 300) {
            if (state.currentTab === 'home') { 
                state.currentPage++; 
                loadContent(state.currentPage, true); 
            } 
            else if (state.currentTab === 'search') {
                state.searchPage++;
                loadSearchContent(state.searchPage);
            }
        }
    });
}

async function checkDeepLink() {
    const startParam = tg?.initDataUnsafe?.start_param;
    if (!startParam) return;
    try {
        const parts = startParam.split('_');
        const data = await fetchMovieDetails(parts[1], parts[0]);
        const m = { id: data.id, title: data.title || data.name, img: `https://image.tmdb.org/t/p/w500${data.poster_path}`, backdrop: `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`, rating: data.vote_average?.toFixed(1) || 'N/A', year: (data.release_date || data.first_air_date || '').split('-')[0], type: parts[0], desc: data.overview, imdb_id: data.external_ids?.imdb_id, original_title: data.original_title };
        openMoviePage(m);
    } catch (e) { }
}
