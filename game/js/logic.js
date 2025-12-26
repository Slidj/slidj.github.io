// js/logic.js (FULL)

document.addEventListener("DOMContentLoaded", function() {
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.expand();
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (user && user.id) userId = user.id.toString();
    }
    initGame();
    setInterval(gameLoop, 1000);
});

function initGame() {
    const statusMsg = document.getElementById('empty-home-msg');
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
    let inventoryChanged = false;
    
    game.inventory.forEach(item => {
        const meta = gameData.items.find(x => x.id === item.id);
        const expireTime = meta ? (meta.expireTime || 30000) : 30000;
        if(item.category==='food' && !item.isSpoiled && now > item.expireTime) {
            item.isSpoiled = true; 
            saveNeeded = true;
            inventoryChanged = true;
        }
    });

    if(saveNeeded) { save(); render(); }

    if(document.getElementById('tab-inv').classList.contains('active')) {
        if(inventoryChanged) renderGrid(); else updateInventoryVisuals();
    }
    if(document.getElementById('tab-home').classList.contains('active')) renderHome();
}

// --- 🔥 НОВІ ФУНКЦІЇ МЕНЮ (BOTTOM SHEET) 🔥 ---

// 1. Меню для Їжі (Рюкзак)
window.openInventoryMenu = function(index) {
    const item = game.inventory[index];
    const meta = gameData.items.find(x => x.id === item.id) || item;
    
    const sheet = document.getElementById('sheet-content');
    const container = document.getElementById('action-sheet');
    
    let actionBtn = '';
    if(item.isSpoiled) {
        actionBtn = `<button class="sheet-btn btn-neutral" disabled style="opacity:0.5">🤢 Їсти не можна</button>`;
    } else {
        actionBtn = `<button class="sheet-btn btn-success" onclick="useFood(${index}); closeSheet()">😋 З'їсти</button>`;
    }

    sheet.innerHTML = `
        <div class="sheet-header">
            <div style="font-size:40px; margin-bottom:10px">${item.isSpoiled ? '🤢' : meta.icon}</div>
            <div class="sheet-title">${meta.name}</div>
            <div class="sheet-subtitle">${item.isSpoiled ? 'Зіпсовано (Тільки викинути)' : 'Свіже та поживне'}</div>
        </div>
        ${actionBtn}
        <button class="sheet-btn btn-danger" onclick="discardItem(${index}); closeSheet()">🗑️ Викинути</button>
        <button class="sheet-btn btn-cancel" onclick="closeSheet()">Скасувати</button>
    `;
    container.classList.add('open');
};

// 2. Меню для Меблів (Кімната)
window.openRoomMenu = function(itemId) {
    const item = game.room.find(i => i.id === itemId);
    const meta = gameData.items.find(x => x.id === itemId);
    if(!item || !meta) return;

    const sheet = document.getElementById('sheet-content');
    const container = document.getElementById('action-sheet');
    
    // Ціна ремонту і продажу
    const repairCost = Math.max(10, Math.floor((100 - item.hp) * 1.5)); 
    const sellPrice = Math.floor(meta.price * 0.5);

    let actionType = itemId === 'pc' ? 'work' : 'sleep';
    let actionName = itemId === 'pc' ? 'Працювати 💼' : 'Спати 💤';

    sheet.innerHTML = `
        <div class="sheet-header">
            <div style="font-size:40px; margin-bottom:10px">${meta.icon}</div>
            <div class="sheet-title">${meta.name}</div>
            <div class="sheet-subtitle">Стан: ${item.hp}% | ${item.hp < 30 ? '⚠️ Потребує ремонту' : 'Все добре'}</div>
        </div>
        
        <button class="sheet-btn btn-primary" onclick="startAction('${itemId}', '${actionType}'); closeSheet()">
            ▶️ ${actionName}
        </button>
        
        <button class="sheet-btn btn-neutral" onclick="repairItem('${itemId}', ${repairCost}); closeSheet()">
            🛠️ Ремонт (${repairCost}$)
        </button>
        
        <button class="sheet-btn btn-danger" onclick="sellItem('${itemId}', ${sellPrice}); closeSheet()">
            💸 Продати (${sellPrice}$)
        </button>
        
        <button class="sheet-btn btn-cancel" onclick="closeSheet()">Скасувати</button>
    `;
    container.classList.add('open');
};

// --- Дії з меню ---
window.discardItem = function(index) {
    game.inventory.splice(index, 1);
    save(); render(); renderGrid();
};

window.repairItem = function(itemId, cost) {
    const item = game.room.find(i => i.id === itemId);
    if(!item) return;
    if(item.hp >= 100) return alert("Предмет повністю цілий!");
    if(game.money < cost) return alert(`Немає грошей! Треба ${cost}$`);
    
    game.money -= cost;
    item.hp = 100;
    save(); render(); renderHome();
    alert("Відремонтовано!");
};

window.sellItem = function(itemId, price) {
    if(confirm(`Продати за ${price}$?`)) {
        const idx = game.room.findIndex(i => i.id === itemId);
        if(idx > -1) {
            game.room.splice(idx, 1);
            game.money += price;
            save(); render(); renderHome();
        }
    }
};

window.closeSheet = function() { 
    document.getElementById('action-sheet').classList.remove('open'); 
};

// --- СТАРІ ФУНКЦІЇ ---
window.buy = function(id) {
    const m = gameData.items.find(x=>x.id===id);
    if(game.money<m.price)return; game.money-=m.price;
    if(m.type==='device') game.room.push({id:m.id,name:m.name,category:'device',hp:100});
    else game.inventory.push({id:m.id,name:m.name,category:'food',expireTime:Date.now()+(m.expireTime||30000),totalLife:m.expireTime||30000,isSpoiled:false});
    save(); render(); renderShop(); renderHome(); renderGrid(); alert("Куплено: "+m.name);
};
window.useFood = function(index) {
    const item = game.inventory[index];
    if(item.isSpoiled) game.inventory.splice(index,1);
    else { const m=gameData.items.find(x=>x.id===item.id); game.inventory.splice(index,1); game.energy=Math.min(100,game.energy+(m?m.energyReward:0)); }
    save(); render(); renderGrid();
};
window.startAction = function(id,type) {
    if(isBusy)return; const item=game.room.find(i=>i.id===id); const m=gameData.items.find(x=>x.id===id);
    if(item.hp<=0){ if(game.money>=50 && confirm("Ремонт 50$?")){game.money-=50;item.hp=100;save();render();renderHome();} return; }
    if(m.energyCost>0 && game.energy<m.energyCost) return alert("Втома!");
    isBusy=true; document.getElementById(`timer-${id}`).style.opacity='1';
    const ov=document.getElementById('scene-overlay'); ov.classList.add('active');
    let s=Date.now(), d=3000;
    let int=setInterval(()=>{
        let p=Date.now()-s; let off=100*(p/d);
        document.getElementById(`timer-${id}`).style.strokeDashoffset=off;
        document.getElementById(`badge-${id}`).innerText=(p/1000).toFixed(1)+'s';
        if(p>=d){ clearInterval(int); document.getElementById(`timer-${id}`).style.opacity='0';
            document.getElementById(`badge-${id}`).innerText=(item.hp-(m.hpCost||0))+'%';
            game.money+=(m.moneyReward||0); game.energy=Math.min(100,Math.max(0,game.energy-(m.energyCost||0)+(m.energyReward||0))); item.hp=Math.max(0,item.hp-(m.hpCost||0));
            ov.classList.remove('active'); isBusy=false; save(); render(); renderHome();
        }
    },30);
};

// ADMIN
window.toggleAdmin = function() { const p=document.getElementById('admin-panel'); p.style.display=p.style.display==='flex'?'none':'flex'; if(p.style.display==='flex')renderAdminList(); }
window.createNewItem = function() { gameData.items.push({ id: "item_"+Date.now(), type: 'food', name: 'New', price: 10, icon: '📦', desc: '...', energyReward:0, moneyReward:0, hpCost:0, expireTime:30000 }); editItem(gameData.items.length-1); }
function editItem(index) {
    currentEditIndex = index; const i = gameData.items[index];
    document.getElementById('admin-item-list').style.display='none'; document.getElementById('admin-controls').style.display='none'; document.getElementById('admin-editor').style.display='block';
    document.getElementById('inp-id').value=i.id; document.getElementById('inp-type').value=i.type||'food'; document.getElementById('inp-name').value=i.name; document.getElementById('inp-icon').value=i.icon;
    document.getElementById('inp-price').value=i.price; document.getElementById('inp-desc').value=i.desc;
    document.getElementById('inp-energy').value=(i.energyReward||0)+(i.energyCost?-i.energyCost:0); document.getElementById('inp-money').value=i.moneyReward||0; document.getElementById('inp-hp').value=i.hpCost||0;
    document.getElementById('inp-time').value=(i.expireTime||30000)/1000;
}
window.saveAdminItem = function() {
    if(currentEditIndex===-1)return; const i = gameData.items[currentEditIndex];
    i.type=document.getElementById('inp-type').value; i.name=document.getElementById('inp-name').value; i.icon=document.getElementById('inp-icon').value;
    i.price=parseInt(document.getElementById('inp-price').value)||0; i.desc=document.getElementById('inp-desc').value;
    const en=parseInt(document.getElementById('inp-energy').value)||0;
    if(en>0){i.energyReward=en;i.energyCost=0;}else{i.energyReward=0;i.energyCost=Math.abs(en);}
    i.moneyReward=parseInt(document.getElementById('inp-money').value)||0; i.hpCost=parseInt(document.getElementById('inp-hp').value)||0;
    i.expireTime=(parseInt(document.getElementById('inp-time').value)||30)*1000;
    i.specs=[]; if(en>0)i.specs.push({t:`⚡ +${en}`,c:'tag-green'}); if(en<0)i.specs.push({t:`⚡ ${en}`,c:'tag-red'}); if(i.moneyReward>0)i.specs.push({t:`💰 +${i.moneyReward}$`,c:'tag-green'}); if(i.hpCost>0)i.specs.push({t:`💔 -${i.hpCost}`,c:'tag-orange'}); if(i.type==='food')i.specs.push({t:`⏳ ${i.expireTime/1000}c`,c:'tag-blue'});
    db.ref('gameData').set(gameData).then(()=>{alert("Saved!");cancelEdit();renderShop();});
}
window.cancelEdit = function(){currentEditIndex=-1;document.getElementById('admin-editor').style.display='none';document.getElementById('admin-item-list').style.display='grid';document.getElementById('admin-controls').style.display='block';}
window.deleteItem = function(){if(currentEditIndex===-1)return;if(confirm("Delete?")){gameData.items.splice(currentEditIndex,1);db.ref('gameData').set(gameData);cancelEdit();renderShop();}}

// UTILS
window.openShopFromMap=function(){switchTab('shop');}
window.openBank=function(){document.getElementById('action-sheet').classList.add('open');document.getElementById('sheet-content').innerHTML=`<div style="font-size:50px;text-align:center">🏦</div><div style="text-align:center;font-weight:bold">БАНК</div><div style="text-align:center;color:#888;margin-bottom:10px">Борг: ${game.debt}$</div><button class="sheet-btn" onclick="takeLoan()">Взяти 100$</button><button class="sheet-btn" onclick="closeSheet()">Закрити</button>`;}
window.takeLoan=function(){game.money+=100;game.debt+=150;save();render();closeSheet();alert("Борг +150$");}
window.startWorkFromMap=function(){if(game.energy<20)return alert("Мало сил!");const ov=document.getElementById('scene-overlay');ov.classList.add('active');setTimeout(()=>{game.money+=50;game.energy-=20;save();render();ov.classList.remove('active');alert("Зароблено 50$");},2000);}
window.switchTab=function(t,b){document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.getElementById('tab-'+t).classList.add('active');if(b&&b.classList.contains('nav-btn')){document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');}if(t==='home'){renderHome();render();}if(t==='inv')renderGrid();if(t==='shop')renderShop();}
window.hardReset=function(){if(confirm("RESET?")){game={money:300,energy:100,room:[],inventory:[],debt:0};save();location.reload();}}
