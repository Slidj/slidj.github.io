// js/logic.js

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
    let inventoryChanged = false; // Чи змінився стан (зіпсувалось щось?)
    
    game.inventory.forEach(item => {
        const meta = gameData.items.find(x => x.id === item.id);
        const expireTime = meta ? (meta.expireTime || 30000) : 30000;
        
        // Перевірка
        if(item.category==='food' && !item.isSpoiled && now > item.expireTime) {
            item.isSpoiled = true; 
            saveNeeded = true;
            inventoryChanged = true; // Стан змінився, треба перемалювати кнопки
        }
    });

    if(saveNeeded) { save(); render(); }

    // 🔥 АНІМАЦІЙНИЙ ФІКС: 
    // Якщо нічого не зіпсувалось - просто оновлюємо таймери (щоб дим не зникав)
    // Якщо зіпсувалось - повний рендер
    if(document.getElementById('tab-inv').classList.contains('active')) {
        if(inventoryChanged) {
            renderGrid(); 
        } else {
            updateInventoryVisuals(); 
        }
    }
    
    if(document.getElementById('tab-home').classList.contains('active')) renderHome();
}

// ... (решта функцій buy, useFood, startAction, admin functions без змін) ...
// Скопіюй сюди функції дій з попереднього logic.js (buy, useFood, startAction, toggleAdmin, etc.)
// Я їх не дублюю, щоб не захаращувати відповідь, бо вони не змінювалися.
// Головне - оновити gameLoop вище!
