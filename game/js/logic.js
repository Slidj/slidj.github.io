// js/logic.js

document.addEventListener("DOMContentLoaded", function() {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user && user.id) userId = user.id.toString();
    }
    
    // START
    initGame();
    setInterval(gameLoop, 1000);
});

function initGame() {
    const statusMsg = document.getElementById('empty-home-msg');
    
    // 1. Config
    db.ref('gameData').once('value').then(snap => {
        if (snap.exists()) {
            gameData = snap.val();
            if(!gameData.items) gameData.items = [];
            if(!gameData.locations) gameData.locations = [];
        } else {
            gameData = DEFAULT_GAME_DATA;
            db.ref('gameData').set(DEFAULT_GAME_DATA);
        }
        renderMapPins();
        renderShop();
        return db.ref('users/' + userId).once('value');
    }).then(snap => {
        // 2. Player
        if (snap.exists()) {
            game = snap.val();
            if(!game.room) game.room = [];
            if(!game.inventory) game.inventory = [];
            if(!game.debt) game.debt = 0;
        } else {
            game = { money: 300, energy: 100, room: [], inventory: [], debt: 0 };
            save();
        }
        checkAdminStatus();
        if(statusMsg) statusMsg.style.display = 'none';
        render(); renderHome(); renderGrid();
    });
}

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

// --- ACTIONS ---
function buy(id) {
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
}

function useFood(index) {
    const item = game.inventory[index];
    const meta = gameData.items.find(x => x.id === item.id);
    const reward = meta ? (meta.energyReward || 0) : 0; 
    if(item.isSpoiled) { game.inventory.splice(index, 1); } 
    else { game.inventory.splice(index, 1); game.energy = Math.min(100, game.energy + reward); }
    save(); render(); renderGrid();
}

function startAction(itemId, type) {
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
    let duration = 3000; 
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
            game.money += moneyReward;
            game.energy = Math.min(100, Math.max(0, game.energy - enCost + enReward));
            item.hp = Math.max(0, item.hp - hpCost);
            ov.classList.remove('active');
            isBusy = false;
            save(); render(); renderHome();
        }
    }, 30);
}

// --- ADMIN ---
function toggleAdmin() {
    const panel = document.getElementById('admin-panel');
    if (panel.style.display === 'flex') panel.style.display = 'none';
    else { panel.style.display = 'flex'; renderAdminList(); }
}

function createNewItem() {
    const id = "item_" + Date.now(); 
    const newItem = { id: id, type: 'food', name: 'New Item', price: 10, icon: '📦', desc: '...', energyReward: 0, moneyReward: 0, hpCost: 0, expireTime: 30000 };
    gameData.items.push(newItem);
    editItem(gameData.items.length - 1);
}

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
    document.getElementById('inp-energy').value = (item.energyReward || 0) + (item.energyCost ? -item.energyCost : 0);
    document.getElementById('inp-money').value = item.moneyReward || 0;
    document.getElementById('inp-hp').value = item.hpCost || 0;
    document.getElementById('inp-time').value = (item.expireTime || 30000) / 1000;
}

function saveAdminItem() {
    if(currentEditIndex === -1) return;
    const item = gameData.items[currentEditIndex];
    item.type = document.getElementById('inp-type').value;
    item.name = document.getElementById('inp-name').value;
    item.icon = document.getElementById('inp-icon').value;
    item.price = parseInt(document.getElementById('inp-price').value) || 0;
    item.desc = document.getElementById('inp-desc').value;
    
    const energyInput = parseInt(document.getElementById('inp-energy').value) || 0;
    if (energyInput > 0) { item.energyReward = energyInput; item.energyCost = 0; } 
    else { item.energyReward = 0; item.energyCost = Math.abs(energyInput); }
    item.moneyReward = parseInt(document.getElementById('inp-money').value) || 0;
    item.hpCost = parseInt(document.getElementById('inp-hp').value) || 0;
    item.expireTime = (parseInt(document.getElementById('inp-time').value) || 30) * 1000;

    item.specs = [];
    if (energyInput > 0) item.specs.push({t: `⚡ +${energyInput}`, c: 'tag-green'});
    if (energyInput < 0) item.specs.push({t: `⚡ ${energyInput}`, c: 'tag-red'});
    if (item.moneyReward > 0) item.specs.push({t: `💰 +${item.moneyReward}$`, c: 'tag-green'});
    if (item.hpCost > 0) item.specs.push({t: `💔 -${item.hpCost}`, c: 'tag-orange'});
    if (item.type === 'food') item.specs.push({t: `⏳ ${item.expireTime/1000}c`, c: 'tag-blue'});

    db.ref('gameData').set(gameData).then(() => { alert("Збережено!"); cancelEdit(); renderShop(); });
}

function cancelEdit() {
    currentEditIndex = -1;
    document.getElementById('admin-editor').style.display = 'none';
    document.getElementById('admin-item-list').style.display = 'grid';
    document.getElementById('admin-controls').style.display = 'block';
}

function deleteItem() {
    if(currentEditIndex === -1) return;
    if(confirm("Видалити?")) {
        gameData.items.splice(currentEditIndex, 1);
        db.ref('gameData').set(gameData);
        cancelEdit();
        renderShop();
    }
}

// --- UTILS ---
function openShopFromMap() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-shop').classList.add('active');
    renderShop();
}
function openBank() {
    const sheet = document.getElementById('sheet-content');
    const container = document.getElementById('action-sheet');
    sheet.innerHTML = `<div style="font-size:50px;text-align:center">🏦</div><div style="text-align:center;font-weight:bold;margin-bottom:5px">БАНК</div><div style="text-align:center;color:#888;margin-bottom:15px">Борг: <span style="color:${game.debt>0?'red':'green'}">${game.debt}$</span></div><button class="sheet-btn" style="background:var(--accent)" onclick="takeLoan()">Взяти 100$</button><button class="sheet-btn" onclick="closeSheet()">Закрити</button>`;
    container.classList.add('open');
}
function takeLoan() { game.money += 100; game.debt += 150; save(); render(); closeSheet(); alert("Кредит взято!"); }
function startWorkFromMap() {
    if(game.energy < 20) return alert("Мало енергії!");
    const ov = document.getElementById('scene-overlay'); ov.classList.add('active');
    setTimeout(() => { game.money += 50; game.energy -= 20; ov.classList.remove('active'); save(); render(); alert("Зароблено 50$!"); }, 2000);
}
function closeSheet() { document.getElementById('action-sheet').classList.remove('open'); }
function switchTab(tabName, btn) {
    if (!btn && tabName === 'shop') btn = document.querySelector('.nav-btn:nth-child(3)');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+tabName).classList.add('active');
    if (btn && btn.classList.contains('nav-btn')) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    if (tabName === 'map') { const mapBtn = document.getElementById('nav-map'); if(mapBtn) { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); mapBtn.classList.add('active'); } }
    if(tabName === 'home') { renderHome(); render(); }
    if(tabName === 'inv') renderGrid();
    if(tabName === 'shop') renderShop();
}
