import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, update } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔥 ТВОЇ КЛЮЧІ 🔥
const firebaseConfig = {
  apiKey: "AIzaSyBApfHQizLRlYhILiq9_4m9WPyUKUEqtVI",
  authDomain: "lifeos-game.firebaseapp.com",
  databaseURL: "https://lifeos-game-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lifeos-game",
  storageBucket: "lifeos-game.firebasestorage.app",
  messagingSenderId: "347406442798",
  appId: "1:347406442798:web:54edee1509017485545abf",
  measurementId: "G-4KC3QSJG5H"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let game;
let gameData = { items: [], locations: [] }; 
let userId = "test_user_local"; 
let isBusy = false;

document.addEventListener("DOMContentLoaded", async () => {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user && user.id) userId = user.id.toString();
    }

    await Promise.all([loadGameData(), loadPlayerProgress()]);
    checkAdminStatus();

    render(); renderHome(); renderShop(); renderGrid(); renderMapPins();
    setInterval(gameLoop, 1000);
});

// --- FIREBASE ---
async function checkAdminStatus() {
    try {
        const snap = await get(ref(db, 'admins/' + userId));
        if (snap.exists() && snap.val() === true) {
            document.querySelector('.admin-toggle').style.display = 'block';
        }
    } catch (e) {}
}

async function loadGameData() {
    const snap = await get(ref(db, 'gameData'));
    if (snap.exists()) {
        gameData = snap.val();
        if (!gameData.items) gameData.items = [];
        if (!gameData.locations) gameData.locations = [];
    }
}

async function loadPlayerProgress() {
    const snap = await get(ref(db, 'users/' + userId));
    if (snap.exists()) {
        game = snap.val();
        if (!game.room) game.room = [];
        if (!game.inventory) game.inventory = [];
        if (!game.debt) game.debt = 0;
    } else {
        game = { money: 300, energy: 100, room: [], inventory: [], debt: 0 };
        save();
    }
}

function save() { if (game) update(ref(db, 'users/' + userId), game); }

// --- GAME LOOP ---
function gameLoop() {
    if (!game || !gameData) return;
    const now = Date.now();
    let saveNeeded = false;
    
    game.inventory.forEach(item => {
        const meta = gameData.items.find(x => x.id === item.id);
        const expireTime = meta ? (meta.expireTime || 30000) : 30000;
        if(item.category==='food' && !item.isSpoiled && now > item.expireTime) {
            item.isSpoiled = true; saveNeeded = true;
        }
    });

    if(saveNeeded) { save(); render(); renderGrid(); }
    if(document.getElementById('tab-home').classList.contains('active')) renderHome();
    if(document.getElementById('tab-inv').classList.contains('active')) renderGrid();
}

function render() {
    if(!game) return;
    document.getElementById('money').innerText = game.money;
    document.getElementById('energy').innerText = game.energy;
}

// --- RENDERING ---
function renderMapPins() {
    const mapContainer = document.querySelector('.map-wrapper');
    mapContainer.querySelectorAll('.map-pin').forEach(p => p.remove());
    if (!gameData.locations) return;

    gameData.locations.forEach(loc => {
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.style.top = loc.top + '%';
        pin.style.left = loc.left + '%';
        if (loc.type === 'shop') pin.onclick = () => window.openShopFromMap();
        if (loc.type === 'bank') pin.onclick = () => window.openBank();
        if (loc.type === 'work') pin.onclick = () => window.startWorkFromMap();
        pin.innerHTML = `<div class="pin-icon">${loc.icon}</div><div class="pin-label">${loc.name}</div>`;
        mapContainer.appendChild(pin);
    });
}

function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = "";
    if (!gameData.items) return;

    gameData.items.forEach(item => {
        // Генеруємо теги автоматично, якщо їх немає, або беремо збережені
        let tagsHTML = "";
        if (item.specs && item.specs.length > 0) {
            tagsHTML = item.specs.map(s => `<span class="tag ${s.c}">${s.t}</span>`).join('');
        }

        let btnTxt = `Купити ${item.price}$`;
        let dis = false;
        
        if (item.type === 'device' && game.room.some(i => i.id === item.id)) { btnTxt="Вже є"; dis=true; }
        else if (game.money < item.price) { btnTxt=`Треба ${item.price}$`; dis=true; }

        container.innerHTML += `
        <div class="shop-card">
            <div class="shop-visual">${item.icon}</div>
            <div class="shop-info">
                <div class="shop-header"><span class="shop-title">${item.name}</span><span class="shop-price">${item.price}$</span></div>
                <div class="shop-desc">${item.desc}</div>
                <div class="shop-tags">${tagsHTML}</div>
                <button class="shop-btn" id="btn-buy-${item.id}">${btnTxt}</button>
            </div>
        </div>`;
        
        setTimeout(() => {
            const btn = document.getElementById(`btn-buy-${item.id}`);
            if(btn && !dis) btn.onclick = () => window.buy(item.id);
        }, 0);
    });
}

function renderHome() {
    if(isBusy || !game) return;
    const grid = document.getElementById('home-grid');
    grid.innerHTML = "";
    if(game.room.length === 0) { document.getElementById('empty-home-msg').style.display = 'block'; } 
    else {
        document.getElementById('empty-home-msg').style.display = 'none';
        game.room.forEach(item => {
            const meta = gameData.items.find(x => x.id === item.id) || item;
            let hpColor = item.hp > 50 ? '#30d158' : '#ff453a';
            let hpOffset = 100 - item.hp;
            let action = item.id === 'pc' ? 'work' : 'sleep'; 
            
            const div = document.createElement('div');
            div.className = 'app-card';
            div.innerHTML = `
                <div class="icon-wrapper">
                    <div class="app-bg"><span class="app-emoji">${meta.icon}</span></div>
                    <svg class="progress-svg" viewBox="0 0 76 76">
                        <rect class="squircle ring-bg-inner" x="8" y="8" width="60" height="60" rx="16" opacity="0.3"></rect>
                        <rect class="squircle ring-hp" x="8" y="8" width="60" height="60" rx="16" stroke="${hpColor}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${hpOffset}"></rect>
                        <rect class="squircle ring-timer" id="timer-${item.id}" x="3" y="3" width="70" height="70" rx="20" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></rect>
                    </svg>
                    <div class="app-badge" id="badge-${item.id}">${item.hp}%</div>
                </div>
                <div class="app-label">${meta.name}</div>
            `;
            div.onclick = () => window.startAction(item.id, action);
            grid.appendChild(div);
        });
    }
}

function renderGrid() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = "";
    if(!game || game.inventory.length === 0) { grid.innerHTML = "<div style='color:#555;grid-column:1/-1;text-align:center'>Рюкзак пустий</div>"; return; }
    
    game.inventory.forEach((item, index) => {
        const meta = gameData.items.find(x => x.id === item.id) || item;
        let emoji = meta.icon || '🍔';
        let color = "#30d158";
        let offset = 0;
        if(item.isSpoiled) { emoji="🤢"; color="#555"; offset=100; }
        else {
            const left = Math.max(0, item.expireTime - Date.now());
            const total = meta.expireTime || 30000;
            offset = 100 - (100 * (left/total));
        }
        const div = document.createElement('div');
        div.className = 'app-card';
        div.innerHTML = `
            <div class="icon-wrapper">
                <div class="app-bg"><span class="app-emoji">${emoji}</span></div>
                <svg class="progress-svg" viewBox="0 0 76 76">
                    <rect class="squircle" x="5" y="5" width="66" height="66" rx="18" fill="none" stroke="${color}" stroke-width="5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${offset}"></rect>
                </svg>
            </div>
            <div class="app-label">${meta.name}</div>
        `;
        div.onclick = () => window.useFood(index);
        grid.appendChild(div);
    });
}

// --- ADMIN LOGIC (ROBUST) ---
let currentEditIndex = -1;

window.toggleAdmin = function() {
    const panel = document.getElementById('admin-panel');
    if (panel.style.display === 'flex') panel.style.display = 'none';
    else {
        panel.style.display = 'flex';
        renderAdminList();
    }
};

function renderAdminList() {
    const list = document.getElementById('admin-item-list');
    list.innerHTML = "";
    gameData.items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'admin-item-btn';
        div.innerHTML = `${item.icon} ${item.name}`;
        div.onclick = () => editItem(index);
        list.appendChild(div);
    });
}

window.createNewItem = function() {
    const id = "item_" + Date.now(); // Unique ID
    const newItem = {
        id: id,
        type: 'food',
        name: 'New Item',
        price: 10,
        icon: '📦',
        desc: 'Опис...',
        energyReward: 0,
        moneyReward: 0,
        hpCost: 0,
        expireTime: 30000
    };
    gameData.items.push(newItem);
    editItem(gameData.items.length - 1); // Одразу відкрити редактор
};

function editItem(index) {
    currentEditIndex = index;
    const item = gameData.items[index];
    
    document.getElementById('admin-item-list').style.display = 'none';
    document.getElementById('admin-controls').style.display = 'none';
    document.getElementById('admin-editor').style.display = 'block';
    
    document.getElementById('inp-id').value = item.id;
    document.getElementById('inp-type').value = item.type || 'food';
    document.getElementById('inp-name').value = item.name;
    document.getElementById('inp-icon').value = item.icon;
    document.getElementById('inp-price').value = item.price;
    document.getElementById('inp-desc').value = item.desc;
    
    // Effects
    document.getElementById('inp-energy').value = (item.energyReward || 0) + (item.energyCost ? -item.energyCost : 0);
    document.getElementById('inp-money').value = item.moneyReward || 0;
    document.getElementById('inp-hp').value = item.hpCost || 0;
    
    // Time (seconds)
    document.getElementById('inp-time').value = (item.expireTime || 30000) / 1000;
}

window.saveAdminItem = async function() {
    if(currentEditIndex === -1) return;
    const item = gameData.items[currentEditIndex];
    
    // Basic Info
    item.type = document.getElementById('inp-type').value;
    item.name = document.getElementById('inp-name').value;
    item.icon = document.getElementById('inp-icon').value;
    item.price = parseInt(document.getElementById('inp-price').value) || 0;
    item.desc = document.getElementById('inp-desc').value;
    
    // Stats Parsing
    const energyInput = parseInt(document.getElementById('inp-energy').value) || 0;
    if (energyInput > 0) {
        item.energyReward = energyInput;
        item.energyCost = 0;
    } else {
        item.energyReward = 0;
        item.energyCost = Math.abs(energyInput);
    }
    
    item.moneyReward = parseInt(document.getElementById('inp-money').value) || 0;
    item.hpCost = parseInt(document.getElementById('inp-hp').value) || 0;
    item.expireTime = (parseInt(document.getElementById('inp-time').value) || 30) * 1000;

    // AUTO-GENERATE SPECS TAGS
    item.specs = [];
    if (energyInput > 0) item.specs.push({t: `⚡ +${energyInput}`, c: 'tag-green'});
    if (energyInput < 0) item.specs.push({t: `⚡ ${energyInput}`, c: 'tag-red'});
    if (item.moneyReward > 0) item.specs.push({t: `💰 +${item.moneyReward}$`, c: 'tag-green'});
    if (item.hpCost > 0) item.specs.push({t: `💔 -${item.hpCost}`, c: 'tag-orange'});
    if (item.type === 'food') item.specs.push({t: `⏳ ${item.expireTime/1000}c`, c: 'tag-blue'});

    // SAVE
    await set(ref(db, 'gameData'), gameData);
    
    alert("Збережено!");
    window.cancelEdit();
    renderShop();
};

window.cancelEdit = function() {
    currentEditIndex = -1;
    document.getElementById('admin-editor').style.display = 'none';
    document.getElementById('admin-item-list').style.display = 'flex';
    document.getElementById('admin-controls').style.display = 'block';
};

window.deleteItem = async function() {
    if(currentEditIndex === -1) return;
    if(confirm("Видалити цей предмет назавжди?")) {
        gameData.items.splice(currentEditIndex, 1);
        await set(ref(db, 'gameData'), gameData);
        window.cancelEdit();
        renderShop();
    }
};

// --- ACTIONS ---
window.buy = function(id) {
    const meta = gameData.items.find(x => x.id === id);
    if(game.money < meta.price) return;
    game.money -= meta.price;
    
    if(meta.type === 'device') {
        game.room.push({id:meta.id, name:meta.name, category:'device', hp:100});
    } else {
        let time = meta.expireTime || 15000;
        game.inventory.push({id:meta.id, name:meta.name, category:'food', expireTime:Date.now()+time, totalLife:time, isSpoiled:false});
    }
    save(); render(); renderShop(); renderHome(); renderGrid();
    alert("Куплено: " + meta.name);
};

window.useFood = function(index) {
    const item = game.inventory[index];
    const meta = gameData.items.find(x => x.id === item.id);
    const reward = meta ? (meta.energyReward || 0) : 0; // Fix: 0 if undefined

    if(item.isSpoiled) { 
        game.inventory.splice(index, 1); 
    } else { 
        game.inventory.splice(index, 1); 
        game.energy = Math.min(100, game.energy + reward); 
    }
    save(); render(); renderGrid();
};

window.startAction = function(itemId, type) {
    if(isBusy) return;
    const item = game.room.find(i => i.id === itemId);
    const meta = gameData.items.find(x => x.id === itemId);
    if(!item || !meta) return;

    const hpCost = meta.hpCost || 0;
    const enCost = meta.energyCost || 0;
    const moneyReward = meta.moneyReward || 0;
    const enReward = meta.energyReward || 0;

    if(item.hp <= 0) { 
        if(game.money >= 50 && confirm("Ремонт 50$?")) { game.money -= 50; item.hp = 100; save(); render(); renderHome(); }
        return;
    }
    if(enCost > 0 && game.energy < enCost) return alert("Втома!");

    isBusy = true;
    const timerRing = document.getElementById(`timer-${itemId}`);
    const badge = document.getElementById(`badge-${itemId}`);
    if(timerRing) timerRing.style.opacity = '1';
    
    let start = Date.now();
    let duration = 3000; // Можна теж винести в адмінку (meta.duration)
    
    const ov = document.getElementById('scene-overlay');
    document.getElementById('overlay-icon').innerText = meta.icon;
    document.getElementById('overlay-text').innerText = 'ПРОЦЕС...';
    ov.classList.add('active');
    
    let int = setInterval(() => {
        let p = Date.now() - start;
        let offset = 100 * (p / duration); 
        if(timerRing) timerRing.style.strokeDashoffset = offset;
        if(badge) badge.innerText = (p/1000).toFixed(1) + 's';
        if(p >= duration) {
            clearInterval(int);
            if(timerRing) timerRing.style.opacity = '0';
            if(badge) badge.innerText = (item.hp - hpCost) + '%';
            
            // Apply Effects
            game.money += moneyReward;
            game.energy = Math.min(100, Math.max(0, game.energy - enCost + enReward));
            item.hp = Math.max(0, item.hp - hpCost);

            ov.classList.remove('active');
            isBusy = false;
            save(); render(); renderHome();
        }
    }, 30);
};

window.openShopFromMap = function() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-shop').classList.add('active');
    renderShop();
};
window.openBank = function() {
    const sheet = document.getElementById('sheet-content');
    const container = document.getElementById('action-sheet');
    sheet.innerHTML = `<div style="font-size:50px;text-align:center">🏦</div><div style="text-align:center;font-weight:bold;margin-bottom:5px">БАНК</div><div style="text-align:center;color:#888;margin-bottom:15px">Борг: <span style="color:${game.debt>0?'red':'green'}">${game.debt}$</span></div><button class="sheet-btn" style="background:var(--accent)" onclick="window.takeLoan()">Взяти 100$</button><button class="sheet-btn" onclick="window.closeSheet()">Закрити</button>`;
    container.classList.add('open');
};
window.takeLoan = function() { game.money += 100; game.debt += 150; save(); render(); window.closeSheet(); alert("Кредит взято!"); };
window.startWorkFromMap = function() {
    if(game.energy < 20) return alert("Мало енергії!");
    const ov = document.getElementById('scene-overlay'); ov.classList.add('active');
    setTimeout(() => { game.money += 50; game.energy -= 20; ov.classList.remove('active'); save(); render(); alert("Зароблено 50$!"); }, 2000);
};
window.closeSheet = function() { document.getElementById('action-sheet').classList.remove('open'); };
window.switchTab = function(tabName, btn) {
    if (!btn && tabName === 'shop') btn = document.querySelector('.nav-btn:nth-child(3)');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+tabName).classList.add('active');
    if (btn && btn.classList.contains('nav-btn')) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    if (tabName === 'map') { const mapBtn = document.getElementById('nav-map'); if(mapBtn) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); mapBtn.classList.add('active'); } }
    if(tabName === 'home') { renderHome(); render(); }
    if(tabName === 'inv') renderGrid();
    if(tabName === 'shop') renderShop();
};
window.hardReset = function() {
    if(confirm("Скинути ВСЕ?")) {
        game = { money: 300, energy: 100, room: [], inventory: [], debt: 0 };
        save();
        location.reload();
    }
};
