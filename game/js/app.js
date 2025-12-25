// js/app.js

// 🔥 РЕЖИМ РОЗРОБНИКА 🔥
// Постав false, коли будеш публікувати гру для людей
const DEV_MODE = true; 

let game;
let isBusy = false;

document.addEventListener("DOMContentLoaded", () => {
    // ... (Завантаження save/load без змін) ...
    try {
        const saved = localStorage.getItem('lifeSim_v31_map'); // Можна залишити той самий ключ
        if(saved) game = JSON.parse(saved);
        else game = { money: 300, energy: 100, room: [], inventory: [], debt: 0 };
        
        if(!game.room) game.room = [];
        if(!game.inventory) game.inventory = [];
        if(!game.debt) game.debt = 0;
    } catch(e) { 
        game = { money: 300, energy: 100, room: [], inventory: [], debt: 0 }; 
    }

    if(window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
    }

    // Додаємо слухача для Dev Mode на мапу
    const mapEl = document.getElementById('game-map');
    if(mapEl) {
        mapEl.addEventListener('click', (e) => {
            if(DEV_MODE && e.target === mapEl) { // Тільки якщо клік по фону, а не по піну
                const rect = mapEl.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const top = Math.round((y / rect.height) * 100);
                const left = Math.round((x / rect.width) * 100);
                
                // Копіюємо готовий об'єкт для data.js
                const codeSnippet = `{ id: 'new_place', type: 'shop', name: 'Назва', top: ${top}, left: ${left}, icon: '📍' },`;
                console.log(codeSnippet);
                alert("Координати (скопіюй з консолі або запам'ятай):\n" + `Top: ${top}, Left: ${left}`);
            }
        });
    }

    render(); renderHome(); renderShop(); renderGrid(); 
    renderMapPins(); // Малюємо мапу з data.js

    setInterval(gameLoop, 1000);
});

// ... (GameLoop, Render - без змін) ...
function gameLoop() {
    const now = Date.now();
    let saveNeeded = false;
    game.inventory.forEach(item => {
        if(item.category==='food' && !item.isSpoiled && now > item.expireTime) {
            item.isSpoiled = true; saveNeeded = true;
        }
    });
    if(saveNeeded) { save(); render(); renderGrid(); }
    if(document.getElementById('tab-home').classList.contains('active')) renderHome();
    if(document.getElementById('tab-inv').classList.contains('active')) renderGrid();
}

function render() {
    document.getElementById('money').innerText = game.money;
    document.getElementById('energy').innerText = game.energy;
}

// --- НОВА ФУНКЦІЯ: МАЛЮВАННЯ МАПИ З GAME_DATA ---
function renderMapPins() {
    const mapContainer = document.getElementById('game-map');
    // Не очищаємо повністю, щоб не вбити Dev Mode listener, видаляємо тільки піни
    const oldPins = mapContainer.querySelectorAll('.map-pin');
    oldPins.forEach(p => p.remove());

    // Беремо дані з data.js (GAME_DATA.locations)
    GAME_DATA.locations.forEach(loc => {
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.style.top = loc.top + '%';
        pin.style.left = loc.left + '%';
        
        if (loc.type === 'shop') pin.onclick = () => openShopFromMap();
        if (loc.type === 'bank') pin.onclick = () => openBank();
        if (loc.type === 'work') pin.onclick = () => startWorkFromMap();

        pin.innerHTML = `<div class="pin-icon">${loc.icon}</div><div class="pin-label">${loc.name}</div>`;
        mapContainer.appendChild(pin);
    });
}

// --- RENDER SHOP (Бере дані з GAME_DATA) ---
function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = "";
    
    // Беремо дані з data.js (GAME_DATA.items)
    GAME_DATA.items.forEach(item => {
        let tags = item.specs.map(s => `<span class="tag ${s.c}">${s.t}</span>`).join('');
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
                <div class="shop-tags">${tags}</div>
                <button class="shop-btn" onclick="buy('${item.id}')" ${dis?'disabled':''}>${btnTxt}</button>
            </div>
        </div>`;
    });
}

// ... (Решта функцій Buy, UseFood, StartAction) ...
// ВАЖЛИВО: Оновити buy() та startAction() щоб брали дані з GAME_DATA, а не зі старого масиву shopItems

function buy(id) {
    // Шукаємо в GAME_DATA
    const meta = GAME_DATA.items.find(x => x.id === id);
    if(game.money < meta.price) return;
    game.money -= meta.price;
    
    if(meta.type === 'device') {
        game.room.push({id:meta.id, name:meta.name, category:'device', hp:100});
    } else {
        // Використовуємо expireTime з налаштувань
        let time = meta.expireTime || 15000; 
        game.inventory.push({id:meta.id, name:meta.name, category:'food', expireTime:Date.now()+time, totalLife:time, isSpoiled:false});
    }
    save(); render(); renderShop(); renderHome(); renderGrid();
    alert("Куплено!");
}

function startAction(itemId, type) {
    if(isBusy) return;
    const item = game.room.find(i => i.id === itemId);
    if(!item) return; // Error handling

    // Знаходимо параметри балансу в data.js
    const meta = GAME_DATA.items.find(x => x.id === itemId);
    const hpCost = meta ? (meta.hpCost || 20) : 20;
    const enCost = meta ? (meta.energyCost || 10) : 10;
    const reward = meta ? (meta.moneyReward || 0) : 0;
    const enReward = meta ? (meta.energyReward || 0) : 0;

    if(item.hp <= 0) { 
        if(game.money >= 50 && confirm("Ремонт 50$?")) { game.money -= 50; item.hp = 100; save(); render(); renderHome(); }
        return;
    }
    if(game.energy < enCost && type === 'work') return alert("Втома!");

    isBusy = true;
    const timerRing = document.getElementById(`timer-${itemId}`);
    const badge = document.getElementById(`badge-${itemId}`);
    if(timerRing) timerRing.style.opacity = '1';
    
    let start = Date.now();
    let duration = 3000;
    
    let int = setInterval(() => {
        let p = Date.now() - start;
        let left = Math.max(0, duration - p);
        let offset = 100 * (p / duration); 
        if(timerRing) timerRing.style.strokeDashoffset = offset;
        if(badge) badge.innerText = (left/1000).toFixed(1) + 'с';
        if(left <= 0) {
            clearInterval(int);
            if(timerRing) timerRing.style.opacity = '0';
            if(badge) badge.innerText = (item.hp - hpCost) + '%';
        }
    }, 30);

    const ov = document.getElementById('scene-overlay');
    document.getElementById('overlay-icon').innerText = type==='work'?'👨‍💻':'😴';
    document.getElementById('overlay-text').innerText = type==='work'?'ПРОЦЕС...':'СОН';
    ov.classList.add('active');

    setTimeout(() => {
        // Застосовуємо баланс з data.js
        if(type==='work') { game.money += reward; game.energy -= enCost; item.hp -= hpCost; }
        if(type==='sleep') { game.energy = Math.min(100, game.energy + enReward); item.hp -= hpCost; }
        
        ov.classList.remove('active');
        isBusy = false;
        save(); render(); renderHome();
    }, duration);
}

// ... (Інші функції: UseFood, RenderHome, RenderGrid, Tabs, MapNav - залишаємо як були в v30) ...
// Тільки переконайся, що в коді ти не використовуєш стару змінну shopItems, а всюди GAME_DATA.items

function useFood(index) {
    const item = game.inventory[index];
    const meta = GAME_DATA.items.find(x => x.id === item.id);
    const enReward = meta ? (meta.energyReward || 20) : 20;

    if(item.isSpoiled) { game.inventory.splice(index, 1); } 
    else { game.inventory.splice(index, 1); game.energy = Math.min(100, game.energy + enReward); }
    save(); render(); renderGrid();
}

// --- Стандартні функції навігації ---
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
function save() { localStorage.setItem('lifeSim_v31_map', JSON.stringify(game)); }
window.hardReset = function() { localStorage.clear(); location.reload(); }
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
