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
    if (!user) return;

    const userRef = db.ref('users/' + user.id);
    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            userRef.child('status').set('online');
            userRef.child('status').onDisconnect().set('offline');
        }
    });

    // 1. Одноразовий запис дати входу (щоб не перезаписувати постійно)
    userRef.once('value', (snapshot) => {
        const data = snapshot.val();
        const now = new Date().toISOString();
        if (!data || !data.created_at) userRef.update({ created_at: now.split('T')[0] });
        userRef.update({ id: user.id, first_name: user.first_name || '', username: user.username || '', last_visit: now });
    });

    // 2. 🔥 СЛУХАЧ ДАНИХ (для оновлення квитків в реальному часі)
    userRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const balanceEl = document.getElementById('user_ticket_balance');
        if (balanceEl && data) {
            // Якщо є поле tickets, показуємо його, інакше 0
            balanceEl.innerText = data.tickets || 0;
        }
    });

    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;
        const { isMaintenance, adminId } = currentSettings;

        if (isMaintenance && user.id != adminId) {
            const screen = document.getElementById('maintenance_screen');
            if(screen) screen.style.display = 'flex';
        }

        if (user.id == adminId) {
            window.isAdmin = true;
            const btn = document.getElementById('admin_menu_item');
            const preview = document.getElementById('admin_stats_preview');
            if(btn) btn.style.display = 'flex';
            if(preview) preview.style.display = 'block';
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
        const screen = document.getElementById('blocked_screen');
        if (snapshot.val() === true && screen) screen.style.display = 'flex';
    });
}

// 🔥 НОВА ФУНКЦІЯ: Збереження донату
window.saveDonation = function(stars) {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if(!user) return;
    
    const userRef = db.ref('users/' + user.id);
    
    // 1. Додаємо запис в історію донатів
    userRef.child('donations').push({
        amount: stars,
        date: new Date().toISOString(),
        type: 'stars'
    });

    // 2. Оновлюємо загальну суму
    userRef.child('total_donated').transaction((current) => {
        return (current || 0) + stars;
    });

    // 3. Якщо сума велика, даємо статус "Patron"
    if (stars >= 50) {
        userRef.update({ is_patron: true });
    }
};

// 🔥 ВИПРАВЛЕНА ФУНКЦІЯ ДАТИ (З ЦИФРАМИ І ВІДМІНЮВАННЯМ)
function formatRelativeDate(isoString) {
    if (!isoString) return '<span style="color:gray">Невідомо</span>';
    
    const date = new Date(isoString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Форматуємо час (11:00)
    const time = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `<span style="color:#46d369">Сьогодні о ${time}</span>`;
    if (diffDays === 1) return `<span style="color:#FFD700">Вчора о ${time}</span>`;
    
    // Виправляємо закінчення: 2 дні, 5 днів
    let suffix = 'днів';
    const lastDigit = diffDays % 10;
    const lastTwoDigits = diffDays % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
        suffix = 'днів';
    } else if (lastDigit === 1) {
        suffix = 'день';
    } else if (lastDigit >= 2 && lastDigit <= 4) {
        suffix = 'дні';
    }

    // Тепер точно повертаємо цифру!
    return `<span style="color:#aaa">${diffDays} ${suffix} тому о ${time}</span>`;
}

async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    const listDiv = document.getElementById('admin_user_list');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        const ids = Object.keys(users);
        if(statsDiv) statsDiv.innerHTML = `👥 Усього користувачів: <b>${ids.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Ок'}`;
        if(listDiv) {
            listDiv.innerHTML = '';
            ids.reverse().forEach(id => {
                const u = users[id];
                const isOnline = u.status === 'online';
                // Відображаємо зірочку, якщо донатив
                const patronBadge = u.total_donated > 0 ? '⭐' : '';
                
                const card = document.createElement('div');
                card.style = "background:#333; padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
                // Тут викликаємо нашу нову функцію formatRelativeDate
                card.innerHTML = `<div style="color:white; font-size:12px; display:flex; align-items:center;"><span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span><div><b>${u.first_name} ${patronBadge}</b> (@${u.username || '---'})<br><span style="color:#888; font-size:10px;">${formatRelativeDate(u.last_visit)}</span></div></div><button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px;">${u.blocked ? 'РОЗБАН' : 'БАН'}</button>`;
                listDiv.appendChild(card);
            });
        }
    });
}

function showNotification(text) {
    const bar = document.getElementById('notification_bar');
    const txt = document.getElementById('notif_text');
    if (bar && txt) {
        playSound('Notification.wav');
        txt.innerText = text;
        bar.classList.add('active');
        setTimeout(() => { bar.classList.remove('active'); }, 15000); 
    }
}

window.closeNotification = function() { document.getElementById('notification_bar')?.classList.remove('active'); };

window.sendBroadcastNotification = function() {
    const input = document.getElementById('notif_input');
    const text = input?.value.trim();
    if (!text) return;
    db.ref('broadcast').set({ text: text, timestamp: Date.now() }).then(() => { if(input) input.value = ''; alert("Надіслано!"); });
};

async function updateMenuStats() {
    const statsBox = document.getElementById('admin_stats_preview');
    const today = new Date().toISOString().split('T')[0];
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const all = Object.values(users);
        if(statsBox) statsBox.innerHTML = `🚀 Сьогодні: <b>+${all.filter(u => u.created_at === today).length}</b> | 👥 Усього: <b>${all.length}</b>`;
    });
}

window.openAdminPanel = function() { 
    const modal = document.getElementById('admin_modal');
    if (modal) { modal.style.display = 'block'; loadAdminData(); }
};

window.toggleMaintenanceMode = function() { 
    if(currentSettings) db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance); 
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
