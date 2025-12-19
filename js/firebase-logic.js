const firebaseConfig = {
  apiKey: "AIzaSyClU5qdQSfPbNpcB5LcIniw7Bf4njKcDkg",
  authDomain: "mediahub-admin-b4378.firebaseapp.com",
  projectId: "mediahub-admin-b4378",
  storageBucket: "mediahub-admin-b4378.firebasestorage.app",
  messagingSenderId: "629828316030",
  appId: "1:629828316030:web:d6c5a20c65e5219b40e12f",
  measurementId: "G-S1992VQRKM",
  databaseURL: "https://mediahub-admin-b4378-default-rtdb.europe-west1.firebasedatabase.app"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let currentSettings = null;

// 🔥 НОВЕ: Словник перекладів
const i18n = {
    uk: {
        maint_title: "Технічне обслуговування",
        maint_desc: "Ми оновлюємо Media Hub для вас. Поверніться за декілька годин!",
        block_title: "Доступ обмежено",
        block_desc: "Ваш аккаунт було заблоковано адміністратором.",
        cat_all: "Усі",
        cat_movies: "Фільми",
        cat_series: "Серіали",
        cat_cartoons: "Мультики",
        search_placeholder: "Пошук фільмів, серіалів...",
        btn_watch: "Дивитись",
        btn_info: "Інфо",
        nav_home: "Головна",
        nav_search: "Пошук",
        nav_my: "Моє",
        menu_title: "Меню",
        menu_admin: "⚙️ Адмін-панель",
        menu_profile: "👤 Мій профіль",
        status_online: "сьогодні о",
        status_yesterday: "вчора о",
        status_days: "дні назад о",
        status_long: "давно був о"
    },
    en: {
        maint_title: "Maintenance",
        maint_desc: "We are updating Media Hub for you. Please come back later!",
        block_title: "Access Denied",
        block_desc: "Your account has been blocked by the administrator.",
        cat_all: "All",
        cat_movies: "Movies",
        cat_series: "TV Shows",
        cat_cartoons: "Cartoons",
        search_placeholder: "Search movies, series...",
        btn_watch: "Watch",
        btn_info: "Info",
        nav_home: "Home",
        nav_search: "Search",
        nav_my: "My List",
        menu_title: "Menu",
        menu_admin: "⚙️ Admin Panel",
        menu_profile: "👤 My Profile",
        status_online: "today at",
        status_yesterday: "yesterday at",
        status_days: "days ago at",
        status_long: "long ago at"
    }
};

let currentLang = 'en'; // За замовчуванням англійська

export async function initAdminSystem() {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return;

    // 🔥 ВИЗНАЧЕННЯ МОВИ
    const tgLang = user.language_code; // 'uk', 'ru', 'en' тощо
    currentLang = (tgLang === 'uk') ? 'uk' : 'en'; // Якщо 'uk' - залишаємо, інакше (включаючи 'ru') - 'en'
    applyLanguage(currentLang);

    const userRef = db.ref('users/' + user.id);
    
    // Система присутності
    const connectedRef = db.ref('.info/connected');
    connectedRef.on('value', (snap) => {
        if (snap.val() === true) {
            userRef.child('status').set('online');
            userRef.child('status').onDisconnect().set('offline');
        }
    });

    userRef.once('value', (snapshot) => {
        const data = snapshot.val();
        const now = new Date().toISOString();
        if (!data || !data.created_at) userRef.update({ created_at: now.split('T')[0] });
        userRef.update({ id: user.id, first_name: user.first_name || '', username: user.username || '', last_visit: now });
    });

    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;
        const { isMaintenance, adminId } = currentSettings;

        const maintScreen = document.getElementById('maintenance_screen');
        if (isMaintenance && user.id != adminId) maintScreen.style.display = 'flex';
        else maintScreen.style.display = 'none';

        if (user.id == adminId) {
            window.isAdmin = true;
            if (document.getElementById('admin_menu_item')) document.getElementById('admin_menu_item').style.display = 'flex';
            if (document.getElementById('admin_stats_preview')) document.getElementById('admin_stats_preview').style.display = 'block';
            updateMenuStats();
            updateMaintenanceBtnUI(isMaintenance);
        }
    });

    db.ref('broadcast').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.text && data.timestamp) {
            const lastSeenTs = localStorage.getItem('last_notification_ts');
            if (data.timestamp.toString() !== lastSeenTs) {
                showNotification(data.text);
                localStorage.setItem('last_notification_ts', data.timestamp.toString());
            }
        }
    });

    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        if (snapshot.val() === true) document.getElementById('blocked_screen').style.display = 'flex';
        else document.getElementById('blocked_screen').style.display = 'none';
    });
}

// 🔥 НОВЕ: Функція застосування мови
function applyLanguage(lang) {
    const texts = i18n[lang];
    // Перекладаємо всі елементи з data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (texts[key]) el.innerText = texts[key];
    });
    // Перекладаємо плейсхолдери
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (texts[key]) el.placeholder = texts[key];
    });
}

// Оновлене форматування дати з урахуванням мови
function formatRelativeDate(isoString) {
    if (!isoString) return i18n[currentLang].status_long;
    const date = new Date(isoString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    const t = i18n[currentLang];

    if (diffInDays === 0) return `${t.status_online} ${timeStr}`;
    if (diffInDays === 1) return `${t.status_yesterday} ${timeStr}`;
    if (diffInDays < 7) return `${diffInDays} ${t.status_days} ${timeStr}`;
    return `${t.status_long} ${timeStr}`;
}

// Решта функцій (showNotification, loadAdminData тощо) залишаються без змін...
// Лише в loadAdminData переконайтеся, що викликаєте formatRelativeDate
async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    const listDiv = document.getElementById('admin_user_list');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const ids = Object.keys(users);
        if(statsDiv) statsDiv.innerHTML = `👥 Користувачів: <b>${ids.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Ок'}`;
        listDiv.innerHTML = '';
        ids.reverse().forEach(id => {
            const u = users[id];
            const isOnline = u.status === 'online';
            const card = document.createElement('div');
            card.style = "background:#333; padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
            card.innerHTML = `
                <div style="color:white; font-size:12px; display:flex; align-items:center;">
                    <span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span>
                    <div>
                        <b>${u.first_name}</b> (@${u.username || '---'})<br>
                        <span style="color:#888; font-size:10px;">${formatRelativeDate(u.last_visit)}</span>
                    </div>
                </div>
                <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px;">${u.blocked ? 'РОЗБАН' : 'БАН'}</button>
            `;
            listDiv.appendChild(card);
        });
    });
}

function showNotification(text) {
    const bar = document.getElementById('notification_bar');
    const txt = document.getElementById('notif_text');
    if (!bar || !txt) return;
    txt.innerText = text;
    bar.classList.add('active');
    setTimeout(() => { window.closeNotification(); }, 15000); 
}
window.closeNotification = function() { document.getElementById('notification_bar').classList.remove('active'); };
window.sendBroadcastNotification = function() {
    const input = document.getElementById('notif_input');
    const text = input.value.trim();
    if (!text) return;
    db.ref('broadcast').set({ text: text, timestamp: Date.now() }).then(() => {
        input.value = '';
        alert("Сповіщення надіслано!");
    });
};
window.toggleSideMenu = function() {
    const menu = document.getElementById('side_menu');
    const overlay = document.getElementById('menu_overlay');
    menu.classList.toggle('active');
    overlay.style.display = menu.classList.contains('active') ? 'block' : 'none';
};
window.openAdminFromMenu = function() { window.toggleSideMenu(); window.openAdminPanel(); };
async function updateMenuStats() {
    const statsBox = document.getElementById('admin_stats_preview');
    const today = new Date().toISOString().split('T')[0];
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const all = Object.values(users);
        if(statsBox) statsBox.innerHTML = `🚀 Сьогодні: <b>+${all.filter(u => u.created_at === today).length}</b> | 👥 Усього: <b>${all.length}</b>`;
    });
}
window.openAdminPanel = function() { document.getElementById('admin_modal').style.display = 'block'; loadAdminData(); };
window.closeAdminPanel = function() { document.getElementById('admin_modal').style.display = 'none'; };
window.toggleMaintenanceMode = function() { db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance); };
window.toggleUserBlock = function(userId, status) { if(confirm("Змінити статус?")) db.ref(`users/${userId}/blocked`).set(!status); };
function updateMaintenanceBtnUI(m) { const b = document.getElementById('maint_toggle_btn'); if(b){ b.innerText = m ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ'; b.style.background = m ? '#e50914' : '#fff'; b.style.color = m ? '#fff' : '#000'; } }
