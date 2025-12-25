const shopItems = [
    { id: 'pc', type: 'device', name: 'iMac Pro', price: 150, icon: '🖥️', desc: 'Для заробітку.', specs: [{t:'⚡ -10',c:'tag-red'},{t:'💰 +20$',c:'tag-green'}] },
    { id: 'bed', type: 'device', name: 'Smart Bed', price: 100, icon: '🛏️', desc: 'Відновлює сили.', specs: [{t:'⚡ +30',c:'tag-green'},{t:'⏳ 3с',c:'tag-blue'}] },
    { id: 'pizza', type: 'food', name: 'Pepperoni', price: 20, icon: '🍕', desc: 'Дає енергію.', specs: [{t:'⚡ +20',c:'tag-green'},{t:'Термін 30с',c:'tag-orange'}] },
    { id: 'sushi', type: 'food', name: 'Sushi', price: 45, icon: '🍣', desc: 'Смачна риба.', specs: [{t:'⚡ +35',c:'tag-green'},{t:'Термін 15с',c:'tag-red'}] }
];

let game;
let isBusy = false;

document.addEventListener("DOMContentLoaded", () => {
    try {
        const saved = localStorage.getItem('lifeSim_v29_map');
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

    render(); renderHome(); renderShop(); renderGrid();
    setInterval(gameLoop, 1000);
});

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

    const pc = game.room.find(i => i.id === 'pc');
    const bed = game.room.find(i => i.id === 'bed');
    
    const pcEl = document.getElementById('item-pc');
    if(pc) { pcEl.style.display='block'; pcEl.className = pc.hp<=0?'room-item broken-visual':'room-item'; } else { pcEl.style.display='none'; }
    
    const bedEl = document.getElementById('item-bed');
    if(bed) { bedEl.style.display='block'; bedEl.className = bed.hp<=0?'room-item broken-visual':'room-item'; } else { bedEl.style.display='none'; }
}

// --- MAP ACTIONS ---
function openShopFromMap() {
    // Вручну перемикаємо на вкладку Shop, але не міняємо активну кнопку в Nav (щоб світилась Map)
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-shop').classList.add('active');
    renderShop();
}

function openBank() {
    document.getElementById('sheet-content').innerHTML = `
        <div style="font-size:50px;text-align:center">🏦</div>
        <div style="text-align:center;font-weight:bold;margin-bottom:5px">БАНК</div>
        <div style="text-align:center;color:#888;margin-bottom:15px">Борг: <span style="color:${game.debt>0?'red':'green'}">${game.debt}$</span></div>
        <button class="sheet-btn" style="background:var(--accent)" onclick="takeLoan()">Взяти 100$</button>
        <button class="sheet-btn" onclick="closeSheet()">Закрити</button>
    `;
    document.getElementById('action-sheet').classList.add('open');
}

function takeLoan() {
    game.money += 100; game.debt += 150; 
    save(); render(); closeSheet();
    alert("Кредит взято! Борг 150$");
}

function startWorkFromMap() {
    if(game.energy < 20) return alert("Мало енергії для роботи в офісі!");
    
    // Анімація "поїздки" на роботу
    const ov = document.getElementById('scene-overlay');
    document.getElementById('overlay-icon').innerText = '🏢';
    document.getElementById('overlay-text').innerText = 'РОБОТА В ОФІСІ...';
    ov.classList.add('active');
    
    setTimeout(() => {
        game.money += 50; 
        game.energy -= 20;
        ov.classList.remove('active');
        save(); render();
        alert("Зароблено 50$!");
    }, 2000);
}

// --- STANDARD RENDERERS ---
function renderHome() {
    if(isBusy) return;
    const grid = document.getElementById('home-grid');
    grid.innerHTML = "";
    
    if(game.room.length === 0) {
        document.getElementById('empty-home-msg').style.display = 'block';
    } else {
        document.getElementById('empty-home-msg').style.display = 'none';
        game.room.forEach(item => {
            let hpColor = item.hp > 50 ? '#30d158' : (item.hp > 20 ? '#ff9f0a' : '#ff453a');
            let hpOffset = 100 - item.hp; 
            let icon = item.id === 'pc' ? '🖥️' : '🛏️';
            let action = item.id === 'pc' ? 'work' : 'sleep';
            
            grid.innerHTML += `
            <div class="app-card" onclick="startAction('${item.id}', '${action}')">
                <div class="icon-wrapper">
                    <div class="app-bg"><span class="app-emoji">${icon}</span></div>
                    <svg class="progress-svg" viewBox="0 0 76 76">
                        <rect class="squircle ring-bg-inner" x="8" y="8" width="60" height="60" rx="16" opacity="0.3"></rect>
                        <rect class="squircle ring-hp" x="8" y="8" width="60" height="60" rx="16" stroke="${hpColor}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${hpOffset}"></rect>
                        <rect class="squircle ring-timer" id="timer-${item.id}" x="3" y="3" width="70" height="70" rx="20" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></rect>
                    </svg>
                    <div class="app-badge" id="badge-${item.id}">${item.hp}%</div>
                </div>
                <div class="app-label">${item.name}</div>
            </div>`;
        });
    }
}

function renderGrid() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = "";
    if(game.inventory.length === 0) { grid.innerHTML = "<div style='color:#555;grid-column:1/-1;text-align:center'>Рюкзак пустий</div>"; return; }
    
    game.inventory.forEach((item, index) => {
        let emoji = item.id==='pizza'?'🍕':'🍣';
        let badge = "";
        let color = "#30d158";
        let offset = 0;

        if(item.isSpoiled) { emoji="🤢"; color="#555"; badge="🗑️"; offset=100; }
        else {
            const left = Math.max(0, item.expireTime - Date.now());
            badge = Math.ceil(left/1000)+"с"; color="#0a84ff";
            offset = 100 - (100 * (left/item.totalLife));
        }

        grid.innerHTML += `
        <div class="app-card" onclick="useFood(${index})">
            <div class="icon-wrapper">
                <div class="app-bg"><span class="app-emoji">${emoji}</span></div>
                <svg class="progress-svg" viewBox="0 0 76 76">
                    <rect class="squircle" x="5" y="5" width="66" height="66" rx="18" fill="none" stroke="${color}" stroke-width="5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${offset}"></rect>
                </svg>
                <div class="app-badge">${badge}</div>
            </div>
            <div class="app-label">${item.name}</div>
        </div>`;
    });
}

function renderShop() {
    const container = document.getElementById('shop-container');
    container.innerHTML = "";
    shopItems.forEach(item => {
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

let isBusy = false;
function startAction(itemId, type) {
    if(isBusy) return;
    const item = game.room.find(i => i.id === itemId);
    if(!item) return;
    if(item.hp <= 0) { 
        if(game.money >= 50 && confirm("Ремонт 50$?")) { game.money -= 50; item.hp = 100; save(); render(); renderHome(); }
        return;
    }
    if(game.energy < 10) return alert("Втома!");

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
            if(badge) badge.innerText = (item.hp - (type==='work'?20:5)) + '%';
        }
    }, 30);

    const ov = document.getElementById('scene-overlay');
    document.getElementById('overlay-icon').innerText = type==='work'?'👨‍💻':'😴';
    document.getElementById('overlay-text').innerText = type==='work'?'КОДИНГ':'СОН';
    ov.classList.add('active');

    setTimeout(() => {
        if(type==='work') { game.money+=20; game.energy-=10; item.hp-=20; }
        if(type==='sleep') { game.energy+=30; item.hp-=5; }
        ov.classList.remove('active');
        isBusy = false;
        save(); render(); renderHome();
    }, duration);
}

function useFood(index) {
    const item = game.inventory[index];
    if(item.isSpoiled) { game.inventory.splice(index, 1); } 
    else { game.inventory.splice(index, 1); game.energy = Math.min(100, game.energy + 20); }
    save(); render(); renderGrid();
}

function buy(id) {
    const meta = shopItems.find(x => x.id === id);
    if(game.money < meta.price) return;
    game.money -= meta.price;
    if(meta.type === 'device') { game.room.push({id:meta.id, name:meta.name, category:'device', hp:100}); } 
    else { let time = id==='pizza'?30000:15000; game.inventory.push({id:meta.id, name:meta.name, category:'food', expireTime:Date.now()+time, totalLife:time, isSpoiled:false}); }
    save(); render(); renderShop(); renderHome(); renderGrid();
    alert("Куплено!");
}

function closeSheet() { document.getElementById('action-sheet').classList.remove('open'); }
function save() { localStorage.setItem('lifeSim_v29_map', JSON.stringify(game)); }
window.hardReset = function() { localStorage.clear(); location.reload(); }

window.switchTab = function(tabName, btn) {
    // Якщо клік з мапи (без кнопки), шукаємо кнопку в навігації
    if (!btn) {
        if (tabName === 'shop') btn = document.querySelector('.nav-btn:nth-child(3)'); // Але у нас немає кнопки Shop, тому ігноруємо
    }

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+tabName).classList.add('active');
    
    // Оновлюємо активну кнопку тільки якщо вона є в навігації
    if (btn && btn.classList.contains('nav-btn')) {
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    
    // Коли йдемо з магазину назад на мапу
    if (tabName === 'map') {
        // Знаходимо кнопку мапи і підсвічуємо
        const mapBtn = document.querySelectorAll('.nav-btn')[1]; // 2-га кнопка
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        mapBtn.classList.add('active');
    }

    if(tabName === 'home') { renderHome(); render(); }
    if(tabName === 'inv') renderGrid();
    if(tabName === 'shop') renderShop();
};
