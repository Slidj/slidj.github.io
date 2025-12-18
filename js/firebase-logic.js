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

export async function initAdminSystem() {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return;

    const userRef = db.ref('users/' + user.id);
    userRef.once('value', (snapshot) => {
        const data = snapshot.val();
        const now = new Date().toISOString();
        if (!data || !data.created_at) userRef.update({ created_at: now.split('T')[0] });
        userRef.update({ id: user.id, first_name: user.first_name || '', username: user.username || '', last_visit: now });
    });

    // 1. Слухаємо налаштування та техроботи
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

    // 2. 🔥 ОНОВЛЕНО: Розумне прослуховування сповіщень
    db.ref('broadcast').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.text && data.timestamp) {
            const lastSeenTs = localStorage.getItem('last_notification_ts');
            
            // Показуємо лише якщо це НОВЕ повідомлення (час відрізняється)
            if (data.timestamp.toString() !== lastSeenTs) {
                showNotification(data.text);
                // Зберігаємо позначку часу, щоб не показувати знову при перезавантаженні
                localStorage.setItem('last_notification_ts', data.timestamp.toString());
            }
        }
    });

    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        const blockedScreen = document.getElementById('blocked_screen');
        if (snapshot.val() === true) blockedScreen.style.display = 'flex';
        else blockedScreen.style.display = 'none';
    });
}

function showNotification(text) {
    const bar = document.getElementById('notification_bar');
    const txt = document.getElementById('notif_text');
    if (!bar || !txt) return;
    txt.innerText = text;
    bar.classList.add('active');
    setTimeout(() => { window.closeNotification(); }, 7000);
}

window.closeNotification = function() { document.getElementById('notification_bar').classList.remove('active'); };

window.sendBroadcastNotification = function() {
    const input = document.getElementById('notif_input');
    const text = input.value.trim();
    if (!text) return;
    
    // 🔥 Додаємо унікальний timestamp при відправці
    db.ref('broadcast').set({ 
        text: text, 
        timestamp: Date.now() 
    }).then(() => {
        input.value = '';
        alert("Сповіщення надіслано!");
    });
};

// --- МЕНЮ ТА СТАТИСТИКА ---
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

async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    const listDiv = document.getElementById('admin_user_list');
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const ids = Object.keys(users);
        statsDiv.innerHTML = `👥 Користувачів: <b>${ids.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Ок'}`;
        listDiv.innerHTML = '';
        ids.reverse().forEach(id => {
            const u = users[id];
            const card = document.createElement('div');
            card.style = "background:#333; padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
            card.innerHTML = `<div style="color:white; font-size:12px;"><b>${u.first_name}</b><br><span style="color:#888;">${u.id}</span></div>
            <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px;">${u.blocked ? 'РОЗБАН' : 'БАН'}</button>`;
            listDiv.appendChild(card);
        });
    });
}

window.toggleMaintenanceMode = function() { db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance); };
window.toggleUserBlock = function(userId, status) { if(confirm("Змінити статус?")) db.ref(`users/${userId}/blocked`).set(!status).then(()=>loadAdminData()); };
function updateMaintenanceBtnUI(m) { const b = document.getElementById('maint_toggle_btn'); if(b){ b.innerText = m ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ'; b.style.background = m ? '#e50914' : '#fff'; b.style.color = m ? '#fff' : '#000'; } }
