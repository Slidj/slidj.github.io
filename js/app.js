// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (HYBRID: TG + BROWSER)
// ============================================================

import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies, fetchMovieDetails } from './api.js';
import { renderGrid, setupHero, openMoviePage, closeMoviePage, openPremiumPlayer, closePlayer, showSkeletons, removeSkeletons, renderHistorySection } from './ui.js';
import { t, initLanguage } from './i18n.js';

// --- EXPORTS ---
window.setCategory = setCategory;
window.switchMode = switchMode;
window.playHeroMovie = () => { if(state.currentHeroMovie) openPremiumPlayer(state.currentHeroMovie.id, null); };
window.infoHeroMovie = () => { if(state.currentHeroMovie) openMoviePage(state.currentHeroMovie); };
window.closeMoviePage = closeMoviePage;
window.closePlayer = closePlayer;
window.performSearchDelayed = performSearchDelayed;
window.openPremiumPlayer = openPremiumPlayer;
window.ui_toggleSave = (id, btn) => {
    toggleSave(id, btn);
    if (state.currentTab === 'saved') switchMode('saved');
};

const tg = window.Telegram?.WebApp;

// --- INIT ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        initLanguage();

        if (tg) {
            try {
                tg.ready(); 
                tg.expand();
                if(tg.requestFullscreen) tg.requestFullscreen();
                if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
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
                
                if (tg.BackButton) {
                    tg.BackButton.onClick(() => {
                        if (state.activeMovie) {
                            closeMoviePage();
                        } else if (state.searchQuery || state.currentTab !== 'home') {
                            switchMode('home');
                        }
                    });
                }
            } catch(e) {
                console.warn("Telegram API setup warning:", e);
            }
        }

        await loadCloudData();
        setupInfiniteScroll(); 

        switchMode('home');
        checkDeepLink();

        setTimeout(() => {
            const pre = document.getElementById('preloader');
            if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
        }, 500);

    } catch (error) {
        console.error("CRITICAL INIT ERROR:", error);
        const pre = document.getElementById('preloader');
        if(pre) pre.style.display = 'none';
    }
}

async function checkDeepLink() {
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!startParam) return;

    const parts = startParam.split('_');
    if (parts.length !== 2) return;

    const type = parts[0];
    const id = parts[1];

    const pre = document.getElementById('preloader');
    if(pre) { pre.style.opacity = '1'; pre.style.display = 'flex'; }

    try {
        const data = await fetchMovieDetails(id, type);
        
        const movieObj = {
            id: data.id,
            title: data.title || data.name,
            img: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
            backdrop: `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`,
            rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
            year: (data.release_date || data.first_air_date || '').split('-')[0],
            type: type,
            desc: data.overview,
            imdb_id: data.external_ids?.imdb_id,
            original_title: data.original_title
        };

        openMoviePage(movieObj);

    } catch (e) {
        console.error("Deep link error:", e);
    } finally {
        if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
    }
}

// --- NAVIGATION ---
async function switchMode(tab) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    state.currentTab = tab;
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navs = document.querySelectorAll('.nav-item');
    if(tab==='home') navs[0].classList.add('active');
    if(tab==='search') navs[1].classList.add('active');
    if(tab==='saved') navs[2].classList.add('active');

    const hero = document.getElementById('hero_section');
    const filters = document.getElementById('filters_wrapper');
    const search = document.getElementById('search_bar_container');
    const content = document.getElementById('content_container');
    const trigger = document.getElementById('infinite_trigger');

    const scrollArea = document.getElementById('main_scroll_area');
    if(scrollArea) {
        scrollArea.classList.remove('fade-in-anim');
        void scrollArea.offsetWidth; 
        scrollArea.classList.add('fade-in-anim');
    }
    window.scrollTo({top:0});

    if (tab === 'home') {
        if(hero) hero.style.display = 'flex'; // Завжди показуємо банер
        if(filters) filters.style.display = 'flex'; 
        if(search) search.style.display = 'none';
        if(content) { content.style.display = 'grid'; content.style.paddingTop = '0px'; }
        if(trigger) trigger.style.display = 'flex';

        if (state.feedMovies.length > 0) {
            renderGrid(state.feedMovies, false);
        } else {
            if(content) content.innerHTML = ''; 
            showSkeletons(12);
            state.currentPage = 1; 
            loadContent(1);
        }
    } 
    else if (tab === 'search') {
        if(hero) hero.style.display = 'none'; 
        if(filters) filters.style.display = 'none'; 
        if(search) search.style.display = 'block';
        if(content) { content.style.display = 'grid'; content.style.paddingTop = '0px'; }
        if(trigger) trigger.style.display = 'flex'; 
        
        if (state.searchResults.length > 0) {
            const limit = (state.searchPage) * 12; 
            const initialBatch = state.searchResults.slice(0, Math.max(limit, 12));
            renderGrid(initialBatch, false);
        } else {
            if(content) content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.searching}</div>`;
        }
    } 
    else if (tab === 'saved') {
        if(hero) hero.style.display = 'none'; 
        if(filters) filters.style.display = 'none'; 
        if(search) search.style.display = 'none';
        if(content) { content.style.display = 'grid'; content.style.paddingTop = 'calc(80px + var(--safe-top))'; }
        if(trigger) trigger.style.display = 'none';
        
        if(content) content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.syncing}</div>`;
        await loadCloudData();

        if(content) content.innerHTML = ''; 

        if (state.historyItems.length > 0) {
            const historySection = renderHistorySection(state.historyItems);
            if(content) content.appendChild(historySection);
        }

        if (state.savedItems.length === 0) {
            if (state.historyItems.length === 0) {
                if(content) content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.emptyList}</div>`;
            } else {
                const msg = document.createElement('div');
                msg.innerHTML = `<div style="text-align:center; color:#555; padding:20px;">У "Моє" поки пусто</div>`;
                msg.style.gridColumn = '1/-1';
                if(content) content.appendChild(msg);
            }
        } else {
            if (state.historyItems.length > 0) {
                const title = document.createElement('div');
                title.className = 'similar-title';
                title.style.gridColumn = '1/-1'; 
                title.style.paddingLeft = '8px';
                title.style.marginTop = '10px';
                title.innerText = t.saved || 'Збережено'; 
                if(content) content.appendChild(title);
            }
            renderGrid(state.savedItems, true);
        }
    }
}

function setCategory(catId) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');

    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.cat-btn');
    for(let btn of btns) {
        if(btn.getAttribute('onclick').includes(`'${catId}'`)) btn.classList.add('active');
    }
    state.currentGenre = catId;
    state.currentPage = 1;
    state.feedMovies = []; 
    showSkeletons(12);
    loadContent(1); 
}

// --- 🔥 ОНОВЛЕНО: БАНЕР ТЕПЕР ОНОВЛЮЄТЬСЯ І НЕ ЗНИКАЄ ---
async function loadContent(page, isAppend = false) {
    state.isLoading = true;
    
    if (isAppend) {
        showSkeletons(3, true); 
    }

    try {
        const category = state.currentGenre || 'all';
        const items = await fetchHomeContent(page, category);
        
        state.feedMovies = [...state.feedMovies, ...items];

        // 🔥 ЛОГІКА HERO БАНЕРА (ЗМІНЕНО)
        // Тепер ми оновлюємо банер ДЛЯ ВСІХ категорій, якщо це перша сторінка
        if (page === 1 && !isAppend && items.length > 0) {
            // Беремо випадковий фільм з топ-5 отриманих результатів
            const rand = Math.floor(Math.random() * Math.min(5, items.length));
            setupHero(items[rand]);
            
            // Завжди показуємо банер
            const hero = document.getElementById('hero_section');
            if(hero) hero.style.display = 'flex';
        }
        
        removeSkeletons();
        renderGrid(items, isAppend);
    } catch(e) {
        removeSkeletons(); 
        console.error(e);
    } finally {
        state.isLoading = false;
    }
}

function performSearchDelayed() {
    clearTimeout(state.searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query || query.length < 2) return;

    state.searchTimeout = setTimeout(async () => {
        showSkeletons(6); 
        const results = await searchMovies(query);
        state.searchResults = results;
        state.searchPage = 0; 
        removeSkeletons(); 
        const container = document.getElementById('content_container');
        if (container) container.innerHTML = '';

        if (results.length === 0) {
            if(container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Нічого не знайдено</div>`;
        } else {
            loadNextSearchBatch();
        }
    }, 600);
}

function loadNextSearchBatch() {
    const BATCH_SIZE = 12; 
    const start = state.searchPage * BATCH_SIZE;
    const end = start + BATCH_SIZE;
    const chunk = state.searchResults.slice(start, end);
    if (chunk.length > 0) {
        renderGrid(chunk, true); 
        state.searchPage++;      
    }
}

function setupInfiniteScroll() {
    const checkScroll = () => {
        if (state.isLoading) return;
        const scrollBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
        if (scrollBottom < 300) {
            if (state.currentTab === 'home') {
                state.currentPage++;
                loadContent(state.currentPage, true);
            } 
            else if (state.currentTab === 'search') {
                loadNextSearchBatch();
            }
        }
    };
    window.addEventListener('scroll', checkScroll);
    document.body.addEventListener('scroll', checkScroll);
}
