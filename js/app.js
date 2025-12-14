// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (MODULAR)
// ============================================================

import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies } from './api.js';
import { renderGrid, setupHero, openMoviePage, closeMoviePage, openPremiumPlayer, closePlayer } from './ui.js';

// --- ЕКСПОРТ ДЛЯ HTML (Бо модулі ізольовані) ---
window.setCategory = setCategory;
window.switchMode = switchMode;
window.playHeroMovie = () => { if(state.currentHeroMovie) openPremiumPlayer(state.currentHeroMovie.id, null); };
window.infoHeroMovie = () => { if(state.currentHeroMovie) openMoviePage(state.currentHeroMovie); };
window.closeMoviePage = closeMoviePage;
window.closePlayer = closePlayer;
window.performSearchDelayed = performSearchDelayed;
window.openPremiumPlayer = openPremiumPlayer;
// Спеціальна обгортка для збереження, щоб UI знав про неї
window.ui_toggleSave = (id, btn) => {
    toggleSave(id, btn);
    // Якщо ми в вкладці "Saved", треба перемалювати, якщо видалили
    if (state.currentTab === 'saved') switchMode('saved');
};


// --- INIT ---
document.addEventListener('DOMContentLoaded', async () => {
    // TG Init
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

    await loadCloudData();
    setupInfiniteScroll();
    switchMode('home');
    
    // Прибираємо прелоадер
    setTimeout(() => {
        const pre = document.getElementById('preloader');
        if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
    }, 500);
});

// --- NAVIGATION ---
function switchMode(tab) {
    state.currentTab = tab;
    
    // UI Updates
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

    // Анімація переходу
    const scrollArea = document.getElementById('main_scroll_area');
    scrollArea.classList.remove('fade-in-anim');
    void scrollArea.offsetWidth; 
    scrollArea.classList.add('fade-in-anim');
    window.scrollTo({top:0});

    if (tab === 'home') {
        hero.style.display = 'flex'; filters.style.display = 'flex'; search.style.display = 'none';
        content.style.display = 'grid'; trigger.style.display = 'flex';
        content.style.paddingTop = '0px';

        const dirty = content.innerHTML.includes('Пошук...') || content.innerHTML.includes('Список пустий');
        if (content.children.length === 0 || dirty) {
            content.innerHTML = ''; state.currentPage = 1; loadContent(1);
        }
    } 
    else if (tab === 'search') {
        hero.style.display = 'none'; filters.style.display = 'none'; search.style.display = 'block';
        content.style.display = 'grid'; trigger.style.display = 'none';
        content.style.paddingTop = '0px';
        content.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Пошук...</div>';
    } 
    else if (tab === 'saved') {
        hero.style.display = 'none'; filters.style.display = 'none'; search.style.display = 'none';
        content.style.display = 'grid'; trigger.style.display = 'none';
        content.style.paddingTop = 'calc(80px + var(--safe-top))';
        
        if (state.savedItems.length === 0) {
            content.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Список пустий</div>';
        } else {
            renderGrid(state.savedItems, false);
        }
    }
}

function setCategory(catId) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.cat-btn');
    for(let btn of btns) {
        if(btn.getAttribute('onclick').includes(`'${catId}'`)) btn.classList.add('active');
    }
    state.currentGenre = catId;
    state.currentPage = 1;
    document.getElementById('content_container').innerHTML = ''; 
    loadContent(1); 
}

// --- LOGIC ---
async function loadContent(page, isAppend = false) {
    state.isLoading = true;
    const loader = document.getElementById('scroll_loader');
    if(loader) loader.style.display = 'block';

    try {
        const items = await fetchHomeContent(page);
        state.feedMovies = [...state.feedMovies, ...items];

        if (page === 1 && !isAppend && items.length > 0) {
            const rand = Math.floor(Math.random() * Math.min(5, items.length));
            setupHero(items[rand]);
        }
        renderGrid(items, isAppend);
    } catch(e) {} finally {
        state.isLoading = false;
        if(loader) loader.style.display = 'none';
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
        const results = await searchMovies(query);
        state.feedMovies = [...state.feedMovies, ...results];
        renderGrid(results, false);
    }, 600);
}
