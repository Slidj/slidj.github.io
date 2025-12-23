// --- НАЛАШТУВАННЯ ---
const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#000',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// --- ЗМІННІ ---
let player;
let joystick;
let joyCursorKeys;
let cursorKeys;
let speed = 200;

// Групи ресурсів
let trees;
let rocks;

// Інвентар
let inventory = { wood: 0, stone: 0 };
let inventoryText;

// Стан
let isActionPressed = false;

function preload() {
    // Завантаження плагіна джойстика
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    // 1. ГЕНЕРАЦІЯ ГРАФІКИ (Щоб не качати картинки)
    createAssets(this);

    // 2. СВІТ
    // Створюємо траву (TiledSprite - повторювана текстура)
    this.add.tileSprite(0, 0, 2000, 2000, 'grass').setOrigin(0);
    // Обмежуємо світ
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 3. РЕСУРСИ (Генеруємо випадково)
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    for (let i = 0; i < 30; i++) {
        let tx = Phaser.Math.Between(100, 1900);
        let ty = Phaser.Math.Between(100, 1900);
        trees.create(tx, ty, 'tree').setScale(0.8).refreshBody();
    }
    for (let i = 0; i < 15; i++) {
        let rx = Phaser.Math.Between(100, 1900);
        let ry = Phaser.Math.Between(100, 1900);
        rocks.create(rx, ry, 'rock').setScale(0.8).refreshBody();
    }

    // 4. ГРАВЕЦЬ
    player = this.physics.add.sprite(1000, 1000, 'hero');
    player.setCollideWorldBounds(true);
    
    // Камера
    this.cameras.main.setBounds(0, 0, 2000, 2000);
    this.cameras.main.startFollow(player);

    // Колізія (Гравець не може пройти крізь дерево)
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 5. ДЖОЙСТИК
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5),
            thumb: this.add.circle(0, 0, 25, 0xcccccc, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
    }
    cursorKeys = this.input.keyboard.createCursorKeys();

    // 6. ІНТЕРФЕЙС (Інвентар)
    // Закріплюємо текст на екрані (setScrollFactor(0))
    inventoryText = this.add.text(20, 20, 'Wood: 0 | Stone: 0', {
        font: '20px Arial', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(100);

    // 7. ЛОГІКА КНОПКИ ДІЇ (HTML кнопка)
    const actionBtn = document.getElementById('action-btn');
    actionBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryGatherResource(); });
    actionBtn.addEventListener('mousedown', (e) => { e.preventDefault(); tryGatherResource(); });
}

function update() {
    // Рух гравця
    player.body.setVelocity(0);
    let speedX = 0;
    let speedY = 0;

    if (joyCursorKeys) {
        if (joyCursorKeys.left.isDown) speedX = -speed;
        if (joyCursorKeys.right.isDown) speedX = speed;
        if (joyCursorKeys.up.isDown) speedY = -speed;
        if (joyCursorKeys.down.isDown) speedY = speed;
    }
    // Клавіатура
    if (cursorKeys.left.isDown) speedX = -speed;
    if (cursorKeys.right.isDown) speedX = speed;
    if (cursorKeys.up.isDown) speedY = -speed;
    if (cursorKeys.down.isDown) speedY = speed;

    player.body.setVelocity(speedX, speedY);
}

// Функція добування ресурсів
function tryGatherResource() {
    // Перевіряємо, чи торкається гравець дерева
    // Використовуємо overlap для перевірки близькості
    
    let hitSomething = false;

    // Перевірка дерев
    game.scene.scenes[0].physics.overlap(player, trees, (player, tree) => {
        if (hitSomething) return; // Рубаємо тільки одне за раз
        
        // Ефект "удару"
        game.scene.scenes[0].tweens.add({ targets: tree, alpha: 0.5, duration: 100, yoyo: true });

        // Шанс добути (імітація HP дерева)
        inventory.wood++;
        updateInventory();
        
        // Видаляємо дерево (для спрощення - з одного удару)
        tree.disableBody(true, true); 
        hitSomething = true;
        showFloatingText(player.x, player.y, "+1 Wood 🌲");
    });

    // Перевірка каміння
    if (!hitSomething) {
        game.scene.scenes[0].physics.overlap(player, rocks, (player, rock) => {
            if (hitSomething) return;
            inventory.stone++;
            updateInventory();
            rock.disableBody(true, true);
            hitSomething = true;
            showFloatingText(player.x, player.y, "+1 Stone 🪨");
        });
    }

    if (!hitSomething) {
        // Анімація удару в повітря
        game.scene.scenes[0].tweens.add({ targets: player, angle: 360, duration: 200 });
    }
}

function updateInventory() {
    inventoryText.setText(`Wood: ${inventory.wood} | Stone: ${inventory.stone}`);
}

function showFloatingText(x, y, message) {
    let text = game.scene.scenes[0].add.text(x, y - 20, message, {
        font: '16px Arial', fill: '#ffff00', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);

    game.scene.scenes[0].tweens.add({
        targets: text, y: y - 50, alpha: 0, duration: 1000,
        onComplete: () => text.destroy()
    });
}

// --- ДОДАТКОВА ФУНКЦІЯ: СТВОРЕННЯ ГРАФІКИ КОДОМ ---
function createAssets(scene) {
    const g = scene.make.graphics();

    // 1. Герой (Білий круг з обводкою)
    g.fillStyle(0xffffff); g.fillCircle(16, 16, 14);
    g.lineStyle(2, 0x000000); g.strokeCircle(16, 16, 14);
    g.generateTexture('hero', 32, 32); g.clear();

    // 2. Трава (Зелений квадрат з крапками)
    g.fillStyle(0x2d5a27); g.fillRect(0, 0, 64, 64); // Темно-зелений
    g.fillStyle(0x3e7a36); // Світлі плями
    g.fillCircle(10, 10, 4); g.fillCircle(40, 50, 6); g.fillCircle(55, 20, 3);
    g.generateTexture('grass', 64, 64); g.clear();

    // 3. Дерево (Коричневий стовбур + зелена крона)
    g.fillStyle(0x8B4513); g.fillRect(12, 20, 8, 20); // Стовбур
    g.fillStyle(0x228B22); g.fillCircle(16, 15, 14); // Крона
    g.generateTexture('tree', 32, 40); g.clear();

    // 4. Камінь (Сіра брила)
    g.fillStyle(0x808080); 
    g.fillCircle(16, 16, 12);
    g.generateTexture('rock', 32, 32); g.clear();
}
