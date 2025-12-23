const tg = window.Telegram.WebApp;
tg.expand(); // На весь екран

// Конфігурація гри
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d', // Колір фону (землі)
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // В RPG немає гравітації вниз
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let player;
let cursors;
let moveState = { up: false, down: false, left: false, right: false };
let speed = 160;

function preload() {
    // Тут будемо завантажувати картинки.
    // Поки що Phaser намалює квадрати сам, якщо картинок немає.
}

function create() {
    // 1. Створюємо "землю" (поки просто сітка)
    this.add.grid(0, 0, 2000, 2000, 32, 32, 0x006400).setOrigin(0);

    // 2. Створюємо Гравця (Синій квадрат)
    // x=400, y=300, ширина=32, висота=32, колір=0x3390ec (Telegram Blue)
    player = this.add.rectangle(400, 300, 32, 32, 0x3390ec);
    
    // Додаємо фізику гравцю
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true); // Не виходити за межі світу

    // 3. Камера слідує за гравцем
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(player);

    // 4. Налаштування керування (Клавіатура для ПК)
    cursors = this.input.keyboard.createCursorKeys();

    // 5. Налаштування керування (Сенсорні кнопки для Телеграм)
    setupTouchControls();
}

function update() {
    // Скидаємо швидкість
    player.body.setVelocity(0);

    // Логіка руху (Перевіряємо і клавіатуру, і сенсорні кнопки)
    if (cursors.left.isDown || moveState.left) {
        player.body.setVelocityX(-speed);
    } else if (cursors.right.isDown || moveState.right) {
        player.body.setVelocityX(speed);
    }

    if (cursors.up.isDown || moveState.up) {
        player.body.setVelocityY(-speed);
    } else if (cursors.down.isDown || moveState.down) {
        player.body.setVelocityY(speed);
    }
}

// Функція для підключення екранних кнопок
function setupTouchControls() {
    const ids = ['btn-up', 'btn-down', 'btn-left', 'btn-right'];
    const directions = ['up', 'down', 'left', 'right'];

    ids.forEach((id, index) => {
        const btn = document.getElementById(id);
        const dir = directions[index];

        // Коли натиснули
        btn.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            moveState[dir] = true; 
        });
        btn.addEventListener('mousedown', (e) => { 
            e.preventDefault(); 
            moveState[dir] = true; 
        });

        // Коли відпустили
        btn.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            moveState[dir] = false; 
        });
        btn.addEventListener('mouseup', (e) => { 
            e.preventDefault(); 
            moveState[dir] = false; 
        });
        btn.addEventListener('mouseleave', () => { 
            moveState[dir] = false; 
        });
    });
}
