const tg = window.Telegram.WebApp;
tg.expand();

// Стан гри
let game = {
    money: 300, // Даємо гроші на старт для тесту
    energy: 100,
    health: 100,
    inventory: [] // Тут зберігаємо, що купили ('pc', 'bed')
};

// Завантаження (якщо є)
if (localStorage.getItem('visSim')) {
    game = JSON.parse(localStorage.getItem('visSim'));
}

// Оновлення екрану (Головна функція)
function render() {
    // 1. Оновлюємо цифри
    document.getElementById('money').innerText = game.money;
    document.getElementById('energy').innerText = game.energy;
    document.getElementById('health').innerText = game.health;

    // 2. ОНОВЛЮЄМО ВІЗУАЛ (Магія тут!)
    
    // Якщо маємо ПК -> показуємо картинку ПК
    if (game.inventory.includes('pc')) {
        document.getElementById('visual-pc').style.display = 'block';
    }
    
    // Якщо маємо Ліжко -> показуємо картинку ліжка
    if (game.inventory.includes('bed')) {
        document.getElementById('visual-bed').style.display = 'block';
    }

    // 3. Зміна фону залежно від локації (поки ручна)
    // document.getElementById('game-scene').style.backgroundImage = "url('assets/bg-home.jpg')";
}

// Дії
function startAction(type) {
    if (type === 'work') {
        if (game.energy >= 10) {
            game.energy -= 10;
            game.money += 15;
            
            // Анімація героя (наприклад, змінити емодзі на 👨‍💻 на секунду)
            const hero = document.getElementById('visual-hero');
            hero.innerText = "👨‍💻";
            setTimeout(() => { hero.innerText = "🧍"; }, 1000);
            
            save();
            render();
        } else {
            tg.showAlert("Треба відпочити!");
        }
    }
}

// Магазин
function buyItem(item) {
    let price = 0;
    if (item === 'pc') price = 200;
    if (item === 'bed') price = 100;

    if (game.money >= price) {
        if (game.inventory.includes(item)) return tg.showAlert("Вже є!");
        
        game.money -= price;
        game.inventory.push(item);
        
        tg.showAlert(`Куплено: ${item.toUpperCase()}! Дивись у кімнату.`);
        save();
        render();
    } else {
        tg.showAlert("Нема грошей!");
    }
}

// Навігація
window.switchTab = function(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
};

function save() { localStorage.setItem('visSim', JSON.stringify(game)); }

// Запуск
render();
