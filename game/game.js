const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
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
let joystick;
let cursorKeys; // Для клавіатури
let joyCursorKeys; // Для джойстика
let speed = 200; // Трохи збільшимо швидкість

function preload() {
    // Тут ми можемо завантажити картинки. 
    // Поки що використовуємо графіку двигуна.
}

function create() {
    // 1. Світ (Сітка)
    this.add.grid(0, 0, 2000, 2000, 32, 32, 0x006400).setOrigin(0);

    // 2. Гравець
    player = this.add.rectangle(400, 300, 32, 32, 0x3390ec);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);

    // 3. Камера
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(player);

    // 4. Створення джойстика
    // Він буде з'являтися в лівому нижньому куті
    joystick = this.plugins.get('rexVirtualJoystick').add(this, {
        x: 100,
        y: window.innerHeight - 100,
        radius: 50,
        base: this.add.circle(0, 0, 50, 0x888888, 0.5), // Сіра основа (напівпрозора)
        thumb: this.add.circle(0, 0, 25, 0xcccccc, 0.8), // Світлий "стік"
        dir: '8dir',   // 8 напрямків руху
        forceMin: 16,
        fixed: true    // false - джойстик з'являється там, де ти тикнеш. true - фіксований.
    });

    // Отримуємо об'єкт, схожий на клавіатуру, але від джойстика
    joyCursorKeys = joystick.createCursorKeys();

    // 5. Клавіатура (для тесту на ПК)
    cursorKeys = this.input.keyboard.createCursorKeys();
    
    // Додамо текст-підказку
    this.add.text(10, 10, 'Use Joystick to Move', { font: '16px Arial', fill: '#ffffff' }).setScrollFactor(0);
}

function update() {
    player.body.setVelocity(0);

    // Перевірка: або джойстик, або клавіатура
    let left = joyCursorKeys.left.isDown || cursorKeys.left.isDown;
    let right = joyCursorKeys.right.isDown || cursorKeys.right.isDown;
    let up = joyCursorKeys.up.isDown || cursorKeys.up.isDown;
    let down = joyCursorKeys.down.isDown || cursorKeys.down.isDown;

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
