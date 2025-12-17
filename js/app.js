// ============================================================
// 🎬 MEDIA HUB: MAIN CONTROLLER (HYBRID: TG + BROWSER)
// ============================================================

import { state } from './state.js';
import { loadCloudData, toggleSave } from './storage.js';
import { fetchHomeContent, searchMovies, fetchMovieDetails } from './api.js';
import { renderGrid, setupHero, openMoviePage, closeMoviePage, openPremiumPlayer, closePlayer, showSkeletons, removeSkeletons, renderHistorySection } from './ui.js';
import { t, initLanguage } from './i18n.js';

// --- EXPORTS (Global functions for HTML onclick) ---
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

// Безпечний доступ до об'єкта Telegram
const tg = window.Telegram?.WebApp;

// --- INIT ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        // 1. Ініціалізація мови
        initLanguage();

        // 2. Налаштування Телеграма (ТІЛЬКИ якщо ми в ньому)
        if (tg) {
            try {
                tg.ready(); 
                tg.expand();
                if(tg.requestFullscreen) tg.requestFullscreen();
                if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
                // Налаштування кольорів хедера
                tg.setHeaderColor?.('#000000'); 
                tg.setBackgroundColor?.('#000000');
                
                // Аватарка (якщо є)
                if(tg.initDataUnsafe?.user?.photo_url) {
                    const avatar = document.getElementById('user_avatar');
                    const defAvatar = document.getElementById('default_avatar');
                    if (avatar && defAvatar) {
                        avatar.src = tg.initDataUnsafe.user.photo_url;
                        avatar.style.display = 'block';
                        defAvatar.style.display = 'none';
                    }
                }
                
                // Кнопка "Назад" (Android/Telegram)
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

        // 3. Завантаження даних (безпечне для браузера)
        await loadCloudData();

        // 4. Запуск скролу (Універсальний метод)
        setupInfiniteScroll(); 

        // 5. Старт додатку
        switchMode('home');
        checkDeepLink();

        // 6. Прибираємо прелоадер
        setTimeout(() => {
            const pre = document.getElementById('preloader');
            if(pre) { pre.style.opacity = '0'; setTimeout(() => pre.style.display = 'none', 500); }
        }, 500);

    } catch (error) {
        console.error("CRITICAL INIT ERROR:", error);
        // Аварійне відключення прелоадера, щоб користувач хоч щось побачив
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
            imdb_id: data.external_ids?.imdb_id, // Важливо для плеєра
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
    // Безпечна вібрація
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
        if(hero) hero.style.display = 'flex'; 
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
        
        // Якщо є старі результати - показуємо, якщо ні - текст
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
        console.error(e);
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
        
        // 1. Отримуємо ВСІ результати
        const results = await searchMovies(query);
        
        // 2. Зберігаємо в state
        state.searchResults = results;
        state.searchPage = 0; 
        
        removeSkeletons(); 
        
        const container = document.getElementById('content_container');
        if (container) container.innerHTML = '';

        if (results.length === 0) {
            if(container) container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#555; padding:40px;">Нічого не знайдено</div>`;
        } else {
            // 4. Завантажуємо першу порцію
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

// --- 🔥 INFINITE SCROLL (ROBUST BROWSER VERSION) ---
function setupInfiniteScroll() {
    // Функція, яка перевіряє позицію скролу
    const checkScroll = () => {
        if (state.isLoading) return;

        // Висота документа - скрол зверху - висота вікна
        const scrollBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
        
        // Якщо до низу залишилось менше 300 пікселів - вантажимо
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

    // Додаємо слухача на вікно (найнадійніший спосіб для браузерів)
    window.addEventListener('scroll', checkScroll);
    
    // Про всяк випадок перевіряємо і body (для деяких мобільних браузерів)
    document.body.addEventListener('scroll', checkScroll);
}
