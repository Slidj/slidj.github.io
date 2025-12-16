// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (LAZY SEARCH LOAD)
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
    setupInfiniteScroll(); // Запускаємо спостерігача за скролом
    switchMode('home');
    
    checkDeepLink();

    setTimeout(() => {
        const pre = document.getElementById('preloader');
        if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
    }, 500);
});

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
            desc: data.overview
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
        content.style.display = 'grid'; 
        // 🔥 ВАЖЛИВО: Trigger тепер має бути увімкнений і в пошуку, щоб працювала підгрузка!
        trigger.style.display = 'flex'; 
        content.style.paddingTop = '0px';
        
        // Якщо є старі результати - показуємо, якщо ні - текст
        if (state.searchResults.length > 0) {
            // Перемальовуємо те, що вже "відкрито"
            const limit = (state.searchPage) * 12; // скільки вже показали
            const initialBatch = state.searchResults.slice(0, Math.max(limit, 12));
            renderGrid(initialBatch, false);
        } else {
            content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.searching}</div>`;
        }
    } 
    else if (tab === 'saved') {
        hero.style.display = 'none'; filters.style.display = 'none'; search.style.display = 'none';
        content.style.display = 'grid'; trigger.style.display = 'none';
        content.style.paddingTop = 'calc(80px + var(--safe-top))';
        
        content.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">${t.syncing}</div>`;
        await loadCloudData();

        content.innerHTML = ''; 

        if (state.historyItems.length > 0) {
            const historySection = renderHistorySection(state.historyItems);
            content.appendChild(historySection);
        }

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

// --- HOME LOGIC ---
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

// --- 🔥 SEARCH LOGIC (LAZY LOADING) ---

function performSearchDelayed() {
    clearTimeout(state.searchTimeout);
    const query = document.getElementById('search_input').value;
    if (!query || query.length < 2) return;

    state.searchTimeout = setTimeout(async () => {
        showSkeletons(6); 
        
        // 1. Отримуємо ВСІ результати (але не показуємо їх одразу)
        const results = await searchMovies(query);
        
        // 2. Зберігаємо в state
        state.searchResults = results;
        state.searchPage = 0; // Скидаємо лічильник сторінок
        
        removeSkeletons(); // Прибираємо скелетони
        
        // 3. Очищаємо контейнер перед першим показом
        const container = document.getElementById('content_container');
        if (container) container.innerHTML = '';

        if (results.length === 0) {
            container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Нічого не знайдено</div>`;
        } else {
            // 4. Завантажуємо першу порцію (12 шт)
            loadNextSearchBatch();
        }

    }, 600);
}

// Функція, яка бере наступну порцію з пам'яті і малює її
function loadNextSearchBatch() {
    const BATCH_SIZE = 12; // Скільки підгружати за раз
    
    const start = state.searchPage * BATCH_SIZE;
    const end = start + BATCH_SIZE;
    
    // Беремо шматочок масиву
    const chunk = state.searchResults.slice(start, end);
    
    if (chunk.length > 0) {
        renderGrid(chunk, true); // Додаємо до існуючих (isAppend = true)
        state.searchPage++;      // Готуємось до наступної сторінки
    }
}

// --- 🔥 INFINITE SCROLL (ОНОВЛЕНО) ---
function setupInfiniteScroll() {
    const trigger = document.getElementById('infinite_trigger');
    
    const observer = new IntersectionObserver((entries) => {
        // Якщо доскролили до низу і зараз нічого не вантажиться
        if (entries[0].isIntersecting && !state.isLoading) {
            
            // СЦЕНАРІЙ 1: Головна сторінка (вантажимо з інтернету)
            if (state.currentTab === 'home') {
                state.currentPage++;
                loadContent(state.currentPage, true);
            }
            
            // СЦЕНАРІЙ 2: Пошук (беремо з пам'яті наступну порцію)
            else if (state.currentTab === 'search') {
                loadNextSearchBatch();
            }
        }
    }, { threshold: 0.1 });
    
    if(trigger) observer.observe(trigger);
}
