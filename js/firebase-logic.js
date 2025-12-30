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

// Змінні адмінки
let adminAllUserIds = [];   
let adminUsersData = {};    
let adminCurrentPage = 1;   
const adminItemsPerPage = 10; 

// 🔥 НОВА ФУНКЦІЯ: НАРАХУВАННЯ ХВИЛИН (HEARTBEAT)
export function processWatchHeartbeat(minutesToAdd) {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return;

    const userRef = db.ref('users/' + user.id);

    // Використовуємо транзакцію для атомарної зміни даних
    userRef.transaction((userData) => {
        if (!userData) return userData; // Якщо юзера ще немає (рідкісний кейс), нічого не робимо

        // 1. Додаємо хвилини
        let minutes = (userData.watch_minutes || 0) + minutesToAdd;
        let tickets = (userData.tickets || 0);
        
        // 2. Перевіряємо, чи набралась година (60 хв)
        if (minutes >= 60) {
            const hoursToAdd = Math.floor(minutes / 60); // Скільки повних годин
            const reward = hoursToAdd * 0.5; // 0.5 тікета за годину
            
            minutes = minutes % 60; // Залишаємо решту хвилин (напр. 65 -> 5)
            tickets += reward;
        }

        // 3. Зберігаємо оновлені дані
        userData.watch_minutes = minutes;
        userData.tickets = tickets;
        
        return userData;
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Heartbeat error:", error);
        } else if (committed) {
            // Тут можна додати логіку сповіщення, якщо баланс змінився,
            // але краще робити це тихо, щоб не відволікати від фільму.
        }
    });
}

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

    // ЛОГІКА БОНУСІВ (STREAK SYSTEM)
    userRef.once('value', (snapshot) => {
        const data = snapshot.val() || {};
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        const updateData = { 
            id: user.id, 
            first_name: user.first_name || '', 
            username: user.username || '', 
            last_visit: now.toISOString() 
        };
        if (!data.created_at) updateData.created_at = todayStr;

        const lastBonusDate = data.last_bonus_date;
        const bonusState = data.bonus_state;

        if (lastBonusDate !== todayStr) {
            let giveBonus = false;
            let bonusType = ''; 

            if (bonusState === 'half') {
                const d1 = new Date(lastBonusDate);
                const d2 = new Date(todayStr);
                const diffTime = d2 - d1;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);

                if (diffDays === 1 || diffDays < 1.1) { 
                    giveBonus = true;
                    bonusType = 'full';
                } else {
                    if (Math.random() < 0.25) { 
                        giveBonus = true;
                        bonusType = 'half';
                    } else {
                        updateData.bonus_state = null; 
                    }
                }
            } else {
                if (Math.random() < 0.25) {
                    giveBonus = true;
                    bonusType = 'half';
                }
            }

            if (giveBonus) {
                const currentTickets = (data.tickets && !isNaN(parseFloat(data.tickets))) ? parseFloat(data.tickets) : 0;
                updateData.tickets = currentTickets + 0.5;
                updateData.last_bonus_date = todayStr;
                updateData.bonus_state = (bonusType === 'half') ? 'half' : null;

                setTimeout(() => {
                    if (window.showDailyBonus) window.showDailyBonus(bonusType);
                }, 2000);
            }
        }
        userRef.update(updateData);
    });

    userRef.on('value', (snapshot) => {
        const data = snapshot.val();
        const balanceEl = document.getElementById('user_ticket_balance');
        if (balanceEl && data) {
            // Показуємо тікети, округлені до 1 знаку (якщо треба) або як є
            balanceEl.innerText = data.tickets !== undefined ? Number(data.tickets).toString() : 0;
        }
    });

    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;
        const { isMaintenance, adminId } = currentSettings;
        if (isMaintenance && user.id != adminId) { const screen = document.getElementById('maintenance_screen'); if(screen) screen.style.display = 'flex'; }
        if (user.id == adminId) { window.isAdmin = true; const btn = document.getElementById('admin_menu_item'); const preview = document.getElementById('admin_stats_preview'); if(btn) btn.style.display = 'flex'; if(preview) preview.style.display = 'block'; updateMenuStats(); updateMaintenanceBtnUI(isMaintenance); }
    });

    db.ref('broadcast').on('value', (snapshot) => { const data = snapshot.val(); if (data && data.text && data.timestamp) { const lastSeenTs = localStorage.getItem('last_notification_ts'); if (data.timestamp.toString() !== lastSeenTs) { showNotification(data.text); localStorage.setItem('last_notification_ts', data.timestamp.toString()); } } });
    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => { const screen = document.getElementById('blocked_screen'); if (snapshot.val() === true && screen) screen.style.display = 'flex'; });
}

window.saveDonation = function(stars) { const user = window.Telegram?.WebApp?.initDataUnsafe?.user; if(!user) return; const userRef = db.ref('users/' + user.id); userRef.child('donations').push({ amount: stars, date: new Date().toISOString(), type: 'stars' }); userRef.child('total_donated').transaction((current) => { return (current || 0) + stars; }); if (stars >= 50) { userRef.update({ is_patron: true }); } };

window.changeUserBalance = function(userId, userName) {
    const input = prompt(`Зміна балансу для ${userName}.\n\nВведіть суму:\n👉 10 (щоб додати)\n👉 -10 (щоб відняти)`, "0");
    if (input === null) return;
    const amount = parseFloat(input);
    if (isNaN(amount) || amount === 0) { alert("Введіть коректне число (не нуль)."); return; }
    db.ref('users/' + userId + '/tickets').transaction((current) => {
        let newBal = (current || 0) + amount;
        if (newBal < 0) newBal = 0;
        return newBal;
    }, (error, committed, snapshot) => {
        if (error) { alert("Помилка оновлення бази."); } 
        else if (committed) { alert(`Успішно! Новий баланс: ${snapshot.val()}`); }
    });
};

function formatRelativeDate(isoString) {
    if (!isoString) return '<span style="color:gray">Невідомо</span>';
    const date = new Date(isoString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const time = date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `<span style="color:#46d369">Сьогодні о ${time}</span>`;
    if (diffDays === 1) return `<span style="color:#FFD700">Вчора о ${time}</span>`;
    let suffix = 'днів'; const lastDigit = diffDays % 10; const lastTwoDigits = diffDays % 100; if (lastTwoDigits >= 11 && lastTwoDigits <= 19) { suffix = 'днів'; } else if (lastDigit === 1) { suffix = 'день'; } else if (lastDigit >= 2 && lastDigit <= 4) { suffix = 'дні'; }
    return `<span style="color:#aaa">${diffDays} ${suffix} тому о ${time}</span>`;
}

// ПАГІНАЦІЯ АДМІНКИ
async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    db.ref('users').on('value', (snapshot) => {
        adminUsersData = snapshot.val() || {};
        adminAllUserIds = Object.keys(adminUsersData).reverse();
        if(statsDiv) statsDiv.innerHTML = `👥 Усього користувачів: <b>${adminAllUserIds.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Ок'}`;
        renderAdminPage();
    });
}

function renderAdminPage() {
    const listDiv = document.getElementById('admin_user_list');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    const totalPages = Math.ceil(adminAllUserIds.length / adminItemsPerPage);
    if (adminCurrentPage > totalPages && totalPages > 0) adminCurrentPage = totalPages;
    if (adminCurrentPage < 1) adminCurrentPage = 1;
    const start = (adminCurrentPage - 1) * adminItemsPerPage;
    const end = start + adminItemsPerPage;
    const usersOnPage = adminAllUserIds.slice(start, end);

    usersOnPage.forEach(id => {
        const u = adminUsersData[id];
        const isOnline = u.status === 'online';
        const patronBadge = u.total_donated > 0 ? '⭐' : '';
        const card = document.createElement('div');
        card.style = "background:#333; padding:10px; border-radius:5px; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;";
        card.innerHTML = `
            <div style="color:white; font-size:12px; display:flex; align-items:center;">
                <span class="status-dot ${isOnline ? 'status-online' : 'status-offline'}"></span>
                <div><b>${u.first_name} ${patronBadge}</b> (@${u.username || '---'})<br><span style="color:#888; font-size:10px;">${formatRelativeDate(u.last_visit)} | 🎟️ ${u.tickets || 0} (watch: ${u.watch_minutes || 0}m)</span></div>
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick="window.changeUserBalance('${u.id}', '${u.first_name}')" style="background:#3498db; color:white; border:none; padding:5px 8px; border-radius:3px; font-weight:bold;">±🎟️</button>
                <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px;">${u.blocked ? 'РОЗБАН' : 'БАН'}</button>
            </div>
        `;
        listDiv.appendChild(card);
    });

    if (totalPages > 1) {
        const paginationDiv = document.createElement('div');
        paginationDiv.style = "display:flex; gap:5px; justify-content:center; margin-top:15px; flex-wrap:wrap;";
        if (adminCurrentPage > 1) paginationDiv.innerHTML += `<button onclick="window.changeAdminPage(${adminCurrentPage - 1})" style="padding:5px 10px; background:#444; color:white; border:none; border-radius:3px;">❮</button>`;
        let startPage = Math.max(1, adminCurrentPage - 2);
        let endPage = Math.min(totalPages, adminCurrentPage + 2);
        if (startPage > 1) paginationDiv.innerHTML += `<span style="color:#666; align-self:center;">...</span>`;
        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === adminCurrentPage;
            paginationDiv.innerHTML += `<button onclick="window.changeAdminPage(${i})" style="padding:5px 10px; background:${isActive ? '#e50914' : '#444'}; color:white; border:none; border-radius:3px;">${i}</button>`;
        }
        if (endPage < totalPages) paginationDiv.innerHTML += `<span style="color:#666; align-self:center;">...</span>`;
        if (adminCurrentPage < totalPages) paginationDiv.innerHTML += `<button onclick="window.changeAdminPage(${adminCurrentPage + 1})" style="padding:5px 10px; background:#444; color:white; border:none; border-radius:3px;">❯</button>`;
        listDiv.appendChild(paginationDiv);
    }
}

window.changeAdminPage = function(page) { adminCurrentPage = page; renderAdminPage(); document.getElementById('admin_modal').children[0].scrollTo(0,0); };

function showNotification(text) { const bar = document.getElementById('notification_bar'); const txt = document.getElementById('notif_text'); if (bar && txt) { playSound('Notification.wav'); txt.innerText = text; bar.classList.add('active'); setTimeout(() => { bar.classList.remove('active'); }, 15000); } }
window.closeNotification = function() { document.getElementById('notification_bar')?.classList.remove('active'); };
window.sendBroadcastNotification = function() { const input = document.getElementById('notif_input'); const text = input?.value.trim(); if (!text) return; db.ref('broadcast').set({ text: text, timestamp: Date.now() }).then(() => { if(input) input.value = ''; alert("Надіслано!"); }); };
async function updateMenuStats() { const statsBox = document.getElementById('admin_stats_preview'); const today = new Date().toISOString().split('T')[0]; db.ref('users').once('value', (snapshot) => { const users = snapshot.val() || {}; const all = Object.values(users); if(statsBox) statsBox.innerHTML = `🚀 Сьогодні: <b>+${all.filter(u => u.created_at === today).length}</b> | 👥 Усього: <b>${all.length}</b>`; }); }
window.openAdminPanel = function() { const modal = document.getElementById('admin_modal'); if (modal) { modal.style.display = 'block'; loadAdminData(); } };
window.toggleMaintenanceMode = function() { if(currentSettings) db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance); };
window.toggleUserBlock = function(userId, status) { if(confirm("Змінити статус?")) db.ref(`users/${userId}/blocked`).set(!status); };
function updateMaintenanceBtnUI(m) { const b = document.getElementById('maint_toggle_btn'); if(b){ b.innerText = m ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ'; b.style.background = m ? '#e50914' : '#fff'; b.style.color = m ? '#fff' : '#000'; } }

// ПРОМОКОДИ
window.createPromoCode = function() {
    const name = document.getElementById('promo_name')?.value.trim().toUpperCase();
    const reward = parseFloat(document.getElementById('promo_reward')?.value);
    const limit = parseInt(document.getElementById('promo_limit')?.value);

    if (!name || !reward || !limit) {
        alert("Заповніть всі поля!");
        return;
    }

    db.ref('promos/' + name).set({
        reward: reward,
        limit: limit,
        used_count: 0,
        created_at: Date.now()
    }).then(() => {
        alert(`✅ Код ${name} створено!\nНагорода: ${reward} 🎟️\nМісць: ${limit}`);
        document.getElementById('promo_name').value = '';
        document.getElementById('promo_reward').value = '';
        document.getElementById('promo_limit').value = '';
    }).catch(e => alert("Помилка: " + e.message));
};

window.activatePromoCode = function() {
    const codeInput = document.getElementById('user_promo_input');
    const code = codeInput?.value.trim().toUpperCase();
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;

    if (!code || !user) return;

    const promoRef = db.ref('promos/' + code);
    const userPromoRef = db.ref(`users/${user.id}/used_promos/${code}`);

    userPromoRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            alert("❌ Ви вже використали цей код!");
            return;
        }

        promoRef.transaction((promo) => {
            if (promo) {
                if (promo.used_count < promo.limit) {
                    promo.used_count++; 
                    return promo;
                } else {
                    return; 
                }
            }
            return 0; 
        }, (error, committed, snapshot) => {
            if (error) {
                alert("Помилка мережі.");
            } else if (!committed) {
                const val = snapshot.val();
                if (!val) alert("❌ Такого коду не існує!");
                else alert("⚠️ Цей код вже закінчився (ліміт вичерпано)!");
            } else {
                const reward = snapshot.val().reward;
                db.ref(`users/${user.id}/tickets`).transaction((current) => (current || 0) + reward);
                userPromoRef.set(true);

                document.getElementById('promo_input_modal').style.display = 'none';
                codeInput.value = '';
                alert(`🎉 ВІТАЄМО!\nВи отримали +${reward} Tickets!`);
                playSound('Notification.wav');
                window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            }
        });
    });
};

window.openPromoModal = function() {
    const m = document.getElementById('promo_input_modal');
    if(m) {
        m.style.display = 'flex';
        document.getElementById('side_menu').classList.remove('active');
        document.getElementById('menu_overlay').style.display = 'none';
    }
};
