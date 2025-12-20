import { t } from './i18n.js';
import { playSound } from './sounds.js';

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
    if (!user) {
        console.warn("ADMIN SYSTEM: User not found (not in Telegram?)");
        return;
    }

    const userRef = db.ref('users/' + user.id);
    
    // Оновлення статусу та даних користувача
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
        userRef.update({ 
            id: user.id, 
            first_name: user.first_name || '', 
            username: user.username || '', 
            last_visit: now 
        });
    });

    // 🔥 СИСТЕМА ПЕРЕВІРКИ АДМІНА
    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;

        const { isMaintenance, adminId } = currentSettings;

        // Екран технічних робіт
        const maintScreen = document.getElementById('maintenance_screen');
        if (isMaintenance && String(user.id) !== String(adminId)) {
            if (maintScreen) maintScreen.style.display = 'flex';
        } else {
            if (maintScreen) maintScreen.style.display = 'none';
        }

        // 🔥 ПЕРЕВІРКА ПРАВ АДМІНІСТРАТОРА (Порівнюємо як рядки)
        if (String(user.id) === String(adminId)) {
            console.log("ADMIN SYSTEM: Access granted for ID", user.id);
            window.isAdmin = true;
            
            // Показуємо кнопку в меню
            const adminBtn = document.getElementById('admin_menu_item');
            const statsBox = document.getElementById('admin_stats_preview');
            
            if (adminBtn) adminBtn.style.display = 'flex';
            if (statsBox) statsBox.style.display = 'block';
            
            updateMenuStats();
            updateMaintenanceBtnUI(isMaintenance);
        } else {
            console.log("ADMIN SYSTEM: Regular user detected");
        }
    });

    // Сповіщення та блокування
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
        const blockedScreen = document.getElementById('blocked_screen');
        if (snapshot.val() === true) {
            if (blockedScreen) blockedScreen.style.display = 'flex';
        } else {
            if (blockedScreen) blockedScreen.style.display = 'none';
        }
    });
}

// Функції для адмін-панелі
async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    const listDiv = document.getElementById('admin_user_list');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const ids = Object.keys(users);
        if(statsDiv) statsDiv.innerHTML = `👥 Усього користувачів: <b>${ids.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Ок'}`;
        
        if (listDiv) {
            listDiv.innerHTML = '';
            ids.reverse().forEach(id => {
                const u = users[id];
                const isOnline = u.status === 'online';
                const card = document.createElement('div');
                card.style = "background:#333; padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
                card.innerHTML = `
                    <div style="color:white; font-size:12px; display:flex; align-items:center;">
                        <span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span>
                        <div><b>${u.first_name}</b> (@${u.username || '---'})<br>
                        <span style="color:#888; font-size:10px;">${formatRelativeDate(u.last_visit)}</span></div>
                    </div>
                    <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px;">
                        ${u.blocked ? 'РОЗБАН' : 'БАН'}
                    </button>`;
                listDiv.appendChild(card);
            });
        }
    });
}

async function updateMenuStats() {
    const statsBox = document.getElementById('admin_stats_preview');
    const today = new Date().toISOString().split('T')[0];
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const all = Object.values(users);
        if(statsBox) statsBox.innerHTML = `🚀 Сьогодні: <b>+${all.filter(u => u.created_at === today).length}</b> | 👥 Усього: <b>${all.length}</b>`;
    });
}

function showNotification(text) {
    const bar = document.getElementById('notification_bar');
    const txt = document.getElementById('notif_text');
    if (!bar || !txt) return;
    playSound('Notification.wav');
    txt.innerText = text;
    bar.classList.add('active');
    setTimeout(() => { window.closeNotification(); }, 15000); 
}

function formatRelativeDate(isoString) {
    if (!isoString) return t.statusLong;
    const date = new Date(isoString);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    if (diffInDays === 0) return `${t.statusOnline} ${timeStr}`;
    if (diffInDays === 1) return `${t.statusYesterday} ${timeStr}`;
    if (diffInDays < 7) return `${t.statusDays} ${timeStr}`;
    return `${t.statusLong} ${timeStr}`;
}

// Глобальні функції (використовуються в HTML та Admin Modal)
window.closeNotification = function() { document.getElementById('notification_bar')?.classList.remove('active'); };

window.sendBroadcastNotification = function() {
    const input = document.getElementById('notif_input');
    const text = input?.value.trim();
    if (!text) return;
    db.ref('broadcast').set({ text: text, timestamp: Date.now() }).then(() => { if(input) input.value = ''; alert("Надіслано!"); });
};

window.openAdminPanel = function() { 
    const modal = document.getElementById('admin_modal');
    if (modal) modal.style.display = 'block'; 
    loadAdminData(); 
};

window.toggleMaintenanceMode = function() { 
    if (currentSettings) db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance); 
};

window.toggleUserBlock = function(userId, status) { 
    if(confirm("Змінити статус?")) db.ref(`users/${userId}/blocked`).set(!status); 
};

function updateMaintenanceBtnUI(m) { 
    const b = document.getElementById('maint_toggle_btn'); 
    if(b){ 
        b.innerText = m ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ'; 
        b.style.background = m ? '#e50914' : '#fff'; 
        b.style.color = m ? '#fff' : '#000'; 
    } 
}
