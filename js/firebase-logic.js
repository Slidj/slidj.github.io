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
        if (!data || !data.created_at) {
            userRef.update({ created_at: now.split('T')[0] });
        }
        userRef.update({
            id: user.id,
            first_name: user.first_name || '',
            username: user.username || '',
            last_visit: now
        });
    });

    db.ref('settings').on('value', (snapshot) => {
        currentSettings = snapshot.val();
        if (!currentSettings) return;

        const { isMaintenance, adminId } = currentSettings;

        const maintScreen = document.getElementById('maintenance_screen');
        if (isMaintenance && user.id != adminId) {
            maintScreen.style.display = 'flex';
        } else {
            maintScreen.style.display = 'none';
        }

        if (user.id == adminId) {
            window.isAdmin = true;
            const adminMenu = document.getElementById('admin_menu_item');
            const adminPreview = document.getElementById('admin_stats_preview');
            if (adminMenu) adminMenu.style.display = 'flex';
            if (adminPreview) adminPreview.style.display = 'block';
            updateMenuStats();
            updateMaintenanceBtnUI(isMaintenance);
        }
    });

    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        const blockedScreen = document.getElementById('blocked_screen');
        if (snapshot.val() === true) blockedScreen.style.display = 'flex';
        else blockedScreen.style.display = 'none';
    });
}

window.toggleSideMenu = function() {
    const menu = document.getElementById('side_menu');
    const overlay = document.getElementById('menu_overlay');
    menu.classList.toggle('active');
    overlay.style.display = menu.classList.contains('active') ? 'block' : 'none';
    
    if (menu.classList.contains('active') && window.isAdmin) {
        updateMenuStats();
    }
};

window.openAdminFromMenu = function() {
    window.toggleSideMenu();
    window.openAdminPanel();
};

async function updateMenuStats() {
    const statsBox = document.getElementById('admin_stats_preview');
    if (!statsBox) return;
    const today = new Date().toISOString().split('T')[0];

    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const allUsers = Object.values(users);
        const newToday = allUsers.filter(u => u.created_at === today).length;
        const total = allUsers.length;
        statsBox.innerHTML = `🚀 Сьогодні нових: <b>+${newToday}</b><br>👥 Усього в базі: <b>${total}</b>`;
    });
}

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
    
    db.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const userIds = Object.keys(users);
        statsDiv.innerHTML = `👥 Усього користувачів: <b>${userIds.length}</b><br>⚙️ Статус: ${currentSettings?.isMaintenance ? '🚧 Техроботи' : '✅ Працює'}`;

        userListDiv.innerHTML = '';
        userIds.reverse().forEach(id => {
            const u = users[id];
            const card = document.createElement('div');
            card.style.background = '#333';
            card.style.padding = '10px';
            card.style.borderRadius = '5px';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.innerHTML = `
                <div style="color:white; font-size:12px;"><b>${u.first_name}</b> (@${u.username || '---'})<br><span style="color:#888; font-size:10px;">ID: ${u.id}</span></div>
                <button onclick="window.toggleUserBlock('${u.id}', ${u.blocked || false})" style="background:${u.blocked ? '#e50914' : '#444'}; color:white; border:none; padding:5px 10px; border-radius:3px; font-size:10px;">${u.blocked ? 'РОЗБЛОКУВАТИ' : 'БАН'}</button>`;
            userListDiv.appendChild(card);
        });
    });
}

window.toggleMaintenanceMode = function() {
    if (!currentSettings) return;
    db.ref('settings/isMaintenance').set(!currentSettings.isMaintenance);
};

window.toggleUserBlock = function(userId, currentStatus) {
    if (confirm(currentStatus ? "Розблокувати?" : "Заблокувати?")) {
        db.ref(`users/${userId}/blocked`).set(!currentStatus);
        loadAdminData();
    }
};

function updateMaintenanceBtnUI(isMaint) {
    const btn = document.getElementById('maint_toggle_btn');
    if (!btn) return;
    btn.innerText = isMaint ? 'ВИМКНУТИ ТЕХРОБОТИ' : 'УВІМКНУТИ ТЕХРОБОТИ';
    btn.style.background = isMaint ? '#e50914' : '#fff';
    btn.style.color = isMaint ? '#fff' : '#000';
}
