// --- 1. СИСТЕМА ВИЛОВЛЮВАННЯ ПОМИЛОК (Щоб не було чорного екрану) ---
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const errorDiv = document.getElementById('error-log');
    errorDiv.style.display = 'block';
    errorDiv.innerText = `Error: ${msg}\nLine: ${lineNo}`;
    return false;
};

// --- 2. НАЛАШТУВАННЯ TELEGRAM ---
const tg = window.Telegram.WebApp;
tg.expand(); 

// --- 3. КОНФІГУРАЦІЯ ГРИ ---
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// --- 4. ЗМІННІ ---
let player;
let joystick;
let joyCursorKeys;
let cursorKeys;
let speed = 200;

function preload() {
    // ВАЖЛИВО: Правильне посилання на плагін джойстика
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
    
    // Завантажимо просту картинку для перевірки (зелений квадрат замість текстури)
    // this.load.image('logo', 'assets/logo.png'); 
}

function create() {
    // 1. Земля
    this.add.grid(0, 0, 2000, 2000, 40, 40, 0x004400).setOrigin(0);

    // 2. Гравець (Центр екрану)
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    player = this.add.rectangle(centerX, centerY, 40, 40, 0x3390ec);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);

    // 3. Камера
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(player);

    // 4. Створення джойстика
    // Перевіряємо, чи завантажився плагін, щоб гра не впала
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100,
            y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5),
            thumb: this.add.circle(0, 0, 25, 0xcccccc, 0.8),
            dir: '8dir',
            forceMin: 16,
            fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
    } else {
        // Якщо плагін не завантажився - виводимо текст
        this.add.text(10, 50, 'Joystick Error: Plugin failed', { fill: '#ff0000', backgroundColor: '#000' }).setScrollFactor(0);
    }

    // 5. Клавіатура
    cursorKeys = this.input.keyboard.createCursorKeys();

    // Текст статусу
    this.add.text(10, 10, 'Game v1.0: Running', { font: '16px Arial', fill: '#0f0', backgroundColor: '#000' }).setScrollFactor(0);
}

function update() {
    player.body.setVelocity(0);

    let left = false, right = false, up = false, down = false;

    // Джойстик
    if (joyCursorKeys) {
        left = joyCursorKeys.left.isDown;
        right = joyCursorKeys.right.isDown;
        up = joyCursorKeys.up.isDown;
        down = joyCursorKeys.down.isDown;
    }

    // Клавіатура
    if (cursorKeys.left.isDown) left = true;
    if (cursorKeys.right.isDown) right = true;
    if (cursorKeys.up.isDown) up = true;
    if (cursorKeys.down.isDown) down = true;

    if (left) player.body.setVelocityX(-speed);
    else if (right) player.body.setVelocityX(speed);

    if (up) player.body.setVelocityY(-speed);
    else if (down) player.body.setVelocityY(speed);
}
