// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (HISTORY UPDATE)
// ============================================================

import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies } from './api.js';
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

// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
        try {
            tg.ready(); tg.expand();
            if(tg.requestFullscreen) tg.requestFullscreen();
            if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
            tg.setHeaderColor?.('#000000'); tg.setBackgroundColor?.('#000000');
            if(tg.initDataUnsafe?.user?.photo_url) {
                document.getElementById('user_avatar').src = tg.initDataUnsafe.user.photo_url;
                document.getElementById('user_avatar').style.display = 'block';
                document.getElementById('default_avatar').style.display = 'none';
            }
        } catch(e) {}
    }

    initLanguage();
    await loadCloudData();
    setupInfiniteScroll();
    switchMode('home');
    
    setTimeout(() => {
        const pre = document.getElementById('preloader');
        if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
    }, 500);
});

// --- NAVIGATION ---
async function switchMode(tab) {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');

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
    scrollArea.classList.remove('fade-in-anim');
    void scrollArea.offsetWidth; 
    scrollArea.classList.add('fade-in-anim');
    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex'; filters.style.display = 'flex'; search.style.display = 'none';
        content.style.display = 'grid'; trigger.style.display = 'flex';
        content.style.paddingTop = '0px';

        if (state.feedMovies.length > 0) {
            renderGrid(state.feedMovies, false);
        } else {
            content.innerHTML = ''; 
            showSkeletons(12);
            state.currentPage = 1; 
            loadContent(1);
        }
    } 
    else if (tab === 'search') {
        hero.style.display = 'none'; filters.style.display = 'none'; search.style.display = 'block';
        content.style.display = 'grid'; trigger.style.display = 'none';
        content.style.paddingTop = '0px';
        content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.searching}</div>`;
    } 
    else if (tab === 'saved') {
        hero.style.display = 'none'; filters.style.display = 'none'; search.style.display = 'none';
        content.style.display = 'grid'; trigger.style.display = 'none';
        content.style.paddingTop = 'calc(80px + var(--safe-top))';
        
        content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.syncing}</div>`;
        await loadCloudData();

        content.innerHTML = ''; 

        // 1. 🔥 Спочатку малюємо Історію (якщо є)
        if (state.historyItems.length > 0) {
            const historySection = renderHistorySection(state.historyItems);
            content.appendChild(historySection);
        }

        // 2. 🔥 Потім малюємо Збережене
        if (state.savedItems.length === 0) {
            if (state.historyItems.length === 0) {
                content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.emptyList}</div>`;
            } else {
                const msg = document.createElement('div');
                msg.innerHTML = `<div style="text-align:center; color:#555; padding:20px;">У "Моє" поки пусто</div>`;
                msg.style.gridColumn = '1/-1';
                content.appendChild(msg);
            }
        } else {
            if (state.historyItems.length > 0) {
                const title = document.createElement('div');
                title.className = 'similar-title';
                title.style.gridColumn = '1/-1';
                title.style.paddingLeft = '8px';
                title.style.marginTop = '10px';
                title.innerText = t.saved || 'Збережено'; 
                content.appendChild(title);
            }
            renderGrid(state.savedItems, true);
        }
    }
}

function setCategory(catId) {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');

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

// --- LOGIC ---
async function loadContent(page, isAppend = false) {
    state.isLoading = true;
    
    if (isAppend) {
        showSkeletons(3, true); 
    }

    try {
        const items = await fetchHomeContent(page);
        state.feedMovies = [...state.feedMovies, ...items];

        if (page === 1 && !isAppend && items.length > 0) {
            const rand = Math.floor(Math.random() * Math.min(5, items.length));
            setupHero(items[rand]);
        }
        
        removeSkeletons();
        renderGrid(items, isAppend);
    } catch(e) {
        removeSkeletons(); 
    } finally {
        state.isLoading = false;
    }
}

function setupInfiniteScroll() {
    const trigger = document.getElementById('infinite_trigger');
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && state.currentTab === 'home' && !state.isLoading) {
            state.currentPage++;
            loadContent(state.currentPage, true);
        }
    }, { threshold: 0.1 });
    if(trigger) observer.observe(trigger);
}

function performSearchDelayed() {
    clearTimeout(state.searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query || query.length < 2) return;

    state.searchTimeout = setTimeout(async () => {
        showSkeletons(6); 
        const results = await searchMovies(query);
        renderGrid(results, false);
    }, 600);
}
