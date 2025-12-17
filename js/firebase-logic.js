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

// Зберігаємо поточні налаштування локально для зручності
let currentSettings = null;

export async function initAdminSystem() {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!user) return;

    // 1. Реєстрація користувача
    const userRef = db.ref('users/' + user.id);
    userRef.update({
        id: user.id,
        first_name: user.first_name || '',
        username: user.username || '',
        last_visit: new Date().toISOString()
    });

    // 2. Слухаємо налаштування (Maintenance & Admin Check)
    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;

        const { isMaintenance, adminId } = currentSettings;

        // Відображення екрану техробіт
        const maintScreen = document.getElementById('maintenance_screen');
        if (isMaintenance && user.id != adminId) {
            maintScreen.style.display = 'flex';
        } else {
            maintScreen.style.display = 'none';
        }

        // Показуємо кнопку адмінки ТІЛЬКИ власнику
        if (user.id == adminId) {
            window.isAdmin = true;
            const adminBtn = document.getElementById('admin_btn');
            if (adminBtn) adminBtn.style.display = 'block';
            
            // Оновлюємо колір кнопки техробіт в модальному вікні
            updateMaintenanceBtnUI(isMaintenance);
        }
    });

    // 3. Перевірка бану
    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        const blockedScreen = document.getElementById('blocked_screen');
        if (snapshot.val() === true) {
            blockedScreen.style.display = 'flex';
        } else {
            blockedScreen.style.display = 'none';
        }
    });
}

/**
 * ФУНКЦІЇ АДМІН-ПАНЕЛІ
 */

window.openAdminPanel = function() {
    const modal = document.getElementById('admin_modal');
    modal.style.display = 'block';
    loadAdminData();
};

window.closeAdminPanel = function() {
    document.getElementById('admin_modal').style.display = 'none';
};

async function loadAdminData() {
    const statsDiv = document.getElementById('admin_stats');
    const userListDiv = document.getElementById('admin_user_list');
    
    // Завантажуємо всіх користувачів
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const userIds = Object.keys(users);
        const totalUsers = userIds.length;
        
        statsDiv.innerHTML = `👥 Усього користувачів: <b>${totalUsers}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Працює'}`;

        userListDiv.innerHTML = '';
        userIds.reverse().forEach(id => {
            const u = users[id];
            const card = document.createElement('div');
            card.style.background = '#333';
            card.style.padding = '10px';
            card.style.borderRadius = '5px';
            card.style.fontSize = '12px';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';

            card.innerHTML = `
                <div style="color:white;">
                    <b>${u.first_name}</b> (@${u.username || '---'})<br>
                    <span style="color:#888; font-size:10px;">ID: ${u.id}</span>
                </div>
                <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" 
                        style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px; font-size:10px;">
                    ${u.blocked ? 'РОЗБЛОКУВАТИ' : 'БАН'}
                </button>
            `;
            userListDiv.appendChild(card);
        });
    });
}

window.toggleMaintenanceMode = function() {
    if (!currentSettings) return;
    const newState = !currentSettings.isMaintenance;
    db.ref('settings/isMaintenance').set(newState);
};

window.toggleUserBlock = function(userId, currentStatus) {
    const confirmMsg = currentStatus ? "Розблокувати користувача?" : "Заблокувати цього користувача?";
    if (confirm(confirmMsg)) {
        db.ref(`users/${userId}/blocked`).set(!currentStatus);
        loadAdminData(); // Оновити список
    }
};

function updateMaintenanceBtnUI(isMaint) {
    const btn = document.getElementById('maint_toggle_btn');
    if (!btn) return;
    btn.innerText = isMaint ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ';
    btn.style.background = isMaint ? '#e50914' : '#fff';
    btn.style.color = isMaint ? '#fff' : '#000';
}
