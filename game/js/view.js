// js/view.js

function render() {
    if(!game) return;
    document.getElementById('money').innerText = game.money;
    document.getElementById('energy').innerText = game.energy;
}

function renderMapPins() {
    const cont = document.querySelector('.map-wrapper');
    if(!cont) return;
    cont.querySelectorAll('.map-pin').forEach(p => p.remove());
    if (!gameData.locations) return;
    gameData.locations.forEach(loc => {
        const pin = document.createElement('div');
        pin.className = 'map-pin';
        pin.style.top = loc.top + '%';
        pin.style.left = loc.left + '%';
        if (loc.type === 'shop') pin.onclick = openShopFromMap;
        if (loc.type === 'bank') pin.onclick = openBank;
        if (loc.type === 'work') pin.onclick = startWorkFromMap;
        pin.innerHTML = `<div class="pin-icon">${loc.icon}</div><div class="pin-label">${loc.name}</div>`;
        cont.appendChild(pin);
    });
}

function renderShop() {
    const cont = document.getElementById('shop-container');
    if(!cont) return; cont.innerHTML = "";
    if (!gameData.items) return;
    gameData.items.forEach(item => {
        let tags = item.specs ? item.specs.map(s => `<span class="tag ${s.c}">${s.t}</span>`).join('') : '';
        let btnTxt = `Купити ${item.price}$`;
        let dis = false;
        if (game && item.type === 'device' && game.room && game.room.some(i => i.id === item.id)) { btnTxt="Вже є"; dis=true; }
        else if (game && game.money < item.price) { btnTxt=`Треба ${item.price}$`; dis=true; }
        const div = document.createElement('div');
        div.className = 'shop-card';
        div.innerHTML = `<div class="shop-visual">${item.icon}</div><div class="shop-info"><div class="shop-header"><span class="shop-title">${item.name}</span><span class="shop-price">${item.price}$</span></div><div class="shop-desc">${item.desc}</div><div class="shop-tags">${tags}</div><button class="shop-btn" ${dis?'disabled':''}>${btnTxt}</button></div>`;
        if(!dis) div.querySelector('.shop-btn').onclick = function() { buy(item.id); };
        cont.appendChild(div);
    });
}

function renderHome() {
    if(isBusy || !game || !game.room) return;
    const grid = document.getElementById('home-grid');
    grid.innerHTML = "";
    const msg = document.getElementById('empty-home-msg');
    if(game.room.length === 0) { if(msg) msg.style.display = 'block'; } 
    else {
        if(msg) msg.style.display = 'none';
        game.room.forEach(item => {
            const meta = gameData.items.find(x => x.id === item.id) || item;
            let hpOff = 100 - item.hp;
            const div = document.createElement('div');
            div.className = 'app-card';
            div.innerHTML = `<div class="icon-wrapper"><div class="app-bg"><span class="app-emoji">${meta.icon}</span></div><svg class="progress-svg" viewBox="0 0 76 76"><rect class="squircle ring-bg-inner" x="8" y="8" width="60" height="60" rx="16" opacity="0.3"></rect><rect class="squircle ring-hp" x="8" y="8" width="60" height="60" rx="16" stroke="${item.hp > 50 ? '#30d158' : '#ff453a'}" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${hpOff}"></rect><rect class="squircle ring-timer" id="timer-${item.id}" x="3" y="3" width="70" height="70" rx="20" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"></rect></svg><div class="app-badge" id="badge-${item.id}">${item.hp}%</div></div><div class="app-label">${meta.name}</div>`;
            div.onclick = function() { startAction(item.id, item.id === 'pc' ? 'work' : 'sleep'); };
            grid.appendChild(div);
        });
    }
}

// 🔥 ФУНКЦІЯ 1: ПОВНИЙ РЕНДЕР (Викликається рідко)
function renderGrid() {
    const grid = document.getElementById('inventory-grid');
    if(!grid) return; grid.innerHTML = "";
    if(!game || !game.inventory || game.inventory.length === 0) { 
        grid.innerHTML = "<div style='color:#555;grid-column:1/-1;text-align:center'>Рюкзак пустий</div>"; return; 
    }
    
    game.inventory.forEach((item, index) => {
        const meta = gameData.items.find(x => x.id === item.id) || item;
        let emoji = meta.icon || '🍔';
        let color = "#30d158";
        let offset = 0;
        let wrapClass = "icon-wrapper";
        let badge = "";

        if(item.isSpoiled) { 
            emoji = "🤢"; color = "#555"; offset = 100;
            wrapClass += " spoiled-wrapper"; // Вмикає дим
            badge = `<div class="trash-badge">🗑️</div>`;
        } else {
            const left = Math.max(0, item.expireTime - Date.now());
            const total = meta.expireTime || 30000;
            offset = 100 - (100 * (left/total));
        }

        const div = document.createElement('div');
        div.className = 'app-card';
        div.innerHTML = `<div class="${wrapClass}" id="inv-item-${index}"><div class="app-bg"><span class="app-emoji">${emoji}</span></div><svg class="progress-svg" viewBox="0 0 76 76"><rect class="squircle" x="5" y="5" width="66" height="66" rx="18" fill="none" stroke="${color}" stroke-width="5" pathLength="100" stroke-dasharray="100" stroke-dashoffset="${offset}"></rect></svg>${badge}</div><div class="app-label">${meta.name}</div>`;
        div.onclick = function() { useFood(index); };
        grid.appendChild(div);
    });
}

// 🔥 ФУНКЦІЯ 2: ОНОВЛЕННЯ ТАЙМЕРІВ (Щоб не ламати анімацію)
function updateInventoryVisuals() {
    if(!game || !game.inventory) return;
    game.inventory.forEach((item, index) => {
        const el = document.getElementById(`inv-item-${index}`);
        if(el && !item.isSpoiled) {
            const left = Math.max(0, item.expireTime - Date.now());
            const total = item.totalLife || 30000; 
            const offset = 100 - (100 * (left/total));
            const circle = el.querySelector('rect[fill="none"]');
            if(circle) circle.style.strokeDashoffset = offset;
        }
    });
}

function renderAdminList() {
    const list = document.getElementById('admin-item-list');
    list.innerHTML = "";
    if(!gameData.items) return;
    gameData.items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'admin-item-btn';
        div.innerHTML = `<div class="admin-item-icon">${item.icon}</div><div>${item.name}</div><div style="font-size:10px; opacity:0.7">${item.price}$</div>`;
        div.onclick = function() { editItem(index); };
        list.appendChild(div);
    });
}
