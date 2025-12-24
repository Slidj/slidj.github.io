const tg = window.Telegram.WebApp;
tg.expand();

// --- СТАН ГРИ ---
let game = {
    money: 300,       // Стартовий капітал
    energy: 100,
    health: 100,
    inventory: [],    // Тут будуть покупки: ['pc', 'bed']
    isBusy: false     // Чи зайнятий герой прямо зараз
};

// Завантаження збереження
if (localStorage.getItem('myLifeSimSave')) {
    game = JSON.parse(localStorage.getItem('myLifeSimSave'));
}

// --- ОСНОВНИЙ РЕНДЕР ---
function render() {
    // 1. Цифри
    document.getElementById('money').innerText = game.money;
    document.getElementById('energy').innerText = game.energy;
    document.getElementById('health').innerText = game.health;

    // 2. Відображення куплених меблів
    // Якщо в інвентарі є 'pc', показуємо блок visual-pc
    if (game.inventory.includes('pc')) {
        document.getElementById('visual-pc').style.display = 'block';
    }
    if (game.inventory.includes('bed')) {
        document.getElementById('visual-bed').style.display = 'block';
    }
}

// --- ЛОГІКА РУХУ ГЕРОЯ ---
function moveHero(state) {
    const hero = document.getElementById('visual-hero');
    
    // Скидаємо класи станів, залишаємо тільки базовий
    hero.className = ''; 
    hero.innerText = "🧍"; // Стандартна поза

    if (state === 'work') {
        hero.classList.add('state-working');
        hero.innerText = "👨‍💻"; // Емодзі кодера
        document.getElementById('status-text').innerText = "Працюю...";
    } 
    else if (state === 'sleep') {
        hero.classList.add('state-sleeping');
        hero.innerText = "😴"; // Емодзі сну
        document.getElementById('status-text').innerText = "Сплю...";
    }
    else {
        document.getElementById('status-text').innerText = "Вільний";
    }
}

// --- ДІЇ (Action System) ---
function startAction(type) {
    if (game.isBusy) {
        tg.showAlert("Спочатку закінчи поточну дію!");
        return;
    }

    let duration = 3000; // 3 секунди (для тесту)

    // РОБОТА
    if (type === 'work') {
        // Перевірка умов
        if (!game.inventory.includes('pc')) return tg.showAlert("Тобі потрібен ПК! Купи його в магазині.");
        if (game.energy < 10) return tg.showAlert("Мало енергії!");

        // Старт
        game.isBusy = true;
        game.energy -= 10;
        moveHero('work'); // Герой їде до компа
        
        // Таймер
        setTimeout(() => {
            game.money += 15;
            game.isBusy = false;
            moveHero('idle'); // Герой повертається
            tg.showAlert("Зароблено +15$");
            save();
            render();
        }, duration);
    }

    // СОН
    if (type === 'sleep') {
        if (!game.inventory.includes('bed')) return tg.showAlert("Тобі потрібне ліжко!");
        
        game.isBusy = true;
        moveHero('sleep'); // Герой їде до ліжка

        setTimeout(() => {
            game.energy = Math.min(100, game.energy + 20);
            game.isBusy = false;
            moveHero('idle');
            save();
            render();
        }, duration);
    }
    
    save();
    render();
}

// --- МАГАЗИН ---
function buyItem(item) {
    if (game.inventory.includes(item)) return tg.showAlert("Вже куплено!");

    let cost = 0;
    if (item === 'pc') cost = 200;
    if (item === 'bed') cost = 150;

    if (game.money >= cost) {
        game.money -= cost;
        game.inventory.push(item);
        tg.showAlert(`Вітаю! ${item.toUpperCase()} доставлено.`);
        save();
        render();
    } else {
        tg.showAlert("Немає грошей!");
    }
}

function buyFood() {
    if (game.money >= 20) {
        game.money -= 20;
        game.energy = Math.min(100, game.energy + 10);
        game.health = Math.min(100, game.health + 5);
        tg.showAlert("Ням-ням!");
        save();
        render();
    } else {
        tg.showAlert("Немає грошей!");
    }
}

// --- НАВІГАЦІЯ ---
window.switchTab = function(tabName, btn) {
    // Ховаємо всі вкладки
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // Показуємо потрібну
    document.getElementById('tab-' + tabName).classList.add('active');
    
    // Активна кнопка
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
};

function save() { localStorage.setItem('myLifeSimSave', JSON.stringify(game)); }

// Перший запуск
render();
