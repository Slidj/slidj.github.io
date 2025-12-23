// Ініціалізація Telegram
const tg = window.Telegram.WebApp;
tg.expand(); // Розгорнути на весь екран

// Конфігурація гри
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d', // Темно-сірий фон
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }, // Гравітації немає (вигляд зверху)
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Запуск гри
const game = new Phaser.Game(config);

// Змінні
let player;
let joystick;
let joyCursorKeys;
let cursorKeys; // Для клавіатури (тест на ПК)
let speed = 200;
let debugText;

function preload() {
    // 1. Завантажуємо плагін джойстика прямо тут (надійно)
    var url = 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js';
    this.load.plugin('rexvirtualjoystickplugin', url, true);
    
    // Тут можна додати завантаження картинок у майбутньому
}

function create() {
    // 1. Малюємо "землю" (сітка)
    this.add.grid(0, 0, 2000, 2000, 40, 40, 0x004400).setOrigin(0);

    // 2. Створюємо гравця (Квадрат)
    // Розміщуємо його по центру екрану
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    player = this.add.rectangle(centerX, centerY, 40, 40, 0x3390ec);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true); // Не виходити за межі

    // 3. Камера слідує за гравцем
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(player);

    // 4. Створення джойстика
    joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
        x: 100, // Позиція зліва
        y: window.innerHeight - 100, // Позиція знизу
        radius: 60,
        base: this.add.circle(0, 0, 60, 0x888888, 0.5),
        thumb: this.add.circle(0, 0, 30, 0xcccccc, 0.8),
        dir: '8dir',
        forceMin: 16,
        fixed: true
    });
    
    // Підключаємо керування джойстиком
    joyCursorKeys = joystick.createCursorKeys();

    // 5. Підключаємо клавіатуру (для ПК)
    cursorKeys = this.input.keyboard.createCursorKeys();

    // Текст для перевірки, що гра не зависла
    debugText = this.add.text(10, 10, 'Game Loaded! Use Joystick.', { 
        font: '16px Arial', 
        fill: '#ffffff',
        backgroundColor: '#000000'
    }).setScrollFactor(0); // Текст закріплено на екрані
}

function update() {
    // Зупиняємо гравця перед кожним кадром
    player.body.setVelocity(0);

    // Перевірка джойстика або клавіатури
    let left = false;
    let right = false;
    let up = false;
    let down = false;

    // Читаємо джойстик
    if (joyCursorKeys) {
        left = joyCursorKeys.left.isDown;
        right = joyCursorKeys.right.isDown;
        up = joyCursorKeys.up.isDown;
        down = joyCursorKeys.down.isDown;
    }

    // Читаємо клавіатуру (як запасний варіант)
    if (cursorKeys.left.isDown) left = true;
    if (cursorKeys.right.isDown) right = true;
    if (cursorKeys.up.isDown) up = true;
    if (cursorKeys.down.isDown) down = true;

    // Рух
    if (left) {
        player.body.setVelocityX(-speed);
    } else if (right) {
        player.body.setVelocityX(speed);
    }

    if (up) {
        player.body.setVelocityY(-speed);
    } else if (down) {
        player.body.setVelocityY(speed);
    }
}
