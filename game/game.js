// --- НАЛАШТУВАННЯ ---
const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#000',
    // ВАЖЛИВО: Вмикаємо режим піксель-арту для чіткості
    pixelArt: true,
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

let trees;
let rocks;

let inventory = { wood: 0, stone: 0 };
let inventoryText;

function preload() {
    // Завантаження плагіна джойстика
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    // --- ЗАВАНТАЖЕННЯ 2D СПРАЙТІВ ---
    // Використовуємо безкоштовні ассети з відкритого репозиторію
    const repoUrl = 'https://raw.githubusercontent.com/Slidj/game/main/assets/'; // Приклад (тимчасові посилання)

    // Я використовую надійні публічні посилання на піксель-арт.
    // Якщо вони не завантажаться, ми побачимо чорні квадрати.
    
    // Герой (Лицар)
    this.load.image('hero', 'https://img.itch.zone/aW1hZ2UvNTg1MTguMC92JTJGejI0ODg2LnBuZw==/original/6O%2B%2F%2Bm.png');
    // Трава (Тайл)
    this.load.image('grass', 'https://img.itch.zone/aW1hZ2UvNTg1MTguMC92JTJGTmVnd1lQLnBuZw==/original/sX7S4%2B.png');
    // Дерево
    this.load.image('tree', 'https://img.itch.zone/aW1hZ2UvNTg1MTguMC92JTJGcE9xUjVBLnBuZw==/original/P%2FjW8P.png');
    // Камінь
    this.load.image('rock', 'https://img.itch.zone/aW1hZ2UvNTg1MTguMC92JTJGbU5tWkxrLnBuZw==/original/%2BVgJkQ.png');
}

function create() {
    // 1. СВІТ
    // Трава (збільшуємо масштаб, бо спрайт маленький)
    const grass = this.add.tileSprite(0, 0, 2000, 2000, 'grass').setOrigin(0);
    grass.setScale(3); 

    this.physics.world.setBounds(0, 0, 2000 * 3, 2000 * 3);

    // 2. РЕСУРСИ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    // Розкидаємо дерева
    for (let i = 0; i < 40; i++) {
        let tx = Phaser.Math.Between(100, 1800);
        let ty = Phaser.Math.Between(100, 1800);
        // Створюємо дерево і збільшуємо його в 3 рази
        let tree = trees.create(tx, ty, 'tree');
        tree.setScale(3).refreshBody();
        // Зсуваємо колізію вниз, щоб герой міг заходити "за" дерево
        tree.body.setSize(tree.width * 0.5, tree.height * 0.2);
        tree.body.setOffset(tree.width * 0.25, tree.height * 0.8);
    }
    // Розкидаємо каміння
    for (let i = 0; i < 20; i++) {
        let rx = Phaser.Math.Between(100, 1800);
        let ry = Phaser.Math.Between(100, 1800);
        rocks.create(rx, ry, 'rock').setScale(3).refreshBody();
    }

    // 3. ГРАВЕЦЬ
    // Використовуємо спрайт героя, збільшуємо в 3 рази
    player = this.physics.add.sprite(1000, 1000, 'hero').setScale(3);
    player.setCollideWorldBounds(true);
    // Зменшуємо зону колізії героя до його ніг
    player.body.setSize(12, 16);
    player.body.setOffset(2, 16);
    
    // Камера
    this.cameras.main.setBounds(0, 0, 2000 * 3, 2000 * 3);
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.2); // Трохи наблизимо камеру

    // Колізія
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 4. ДЖОЙСТИК
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

    // 5. ІНТЕРФЕЙС
    inventoryText = this.add.text(20, 20, 'Wood: 0 | Stone: 0', {
        font: '20px monospace', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(100);

    // Кнопка дії
    const actionBtn = document.getElementById('action-btn');
    // Видаляємо старі слухачі, якщо вони були (щоб не дублювалися при перезавантаженні)
    let newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);
    
    newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryGatherResource(); });
    newBtn.addEventListener('mousedown', (e) => { e.preventDefault(); tryGatherResource(); });
}

function update() {
    player.body.setVelocity(0);
    let speedX = 0;
    let speedY = 0;

    if (joyCursorKeys) {
        if (joyCursorKeys.left.isDown) speedX = -speed;
        if (joyCursorKeys.right.isDown) speedX = speed;
        if (joyCursorKeys.up.isDown) speedY = -speed;
        if (joyCursorKeys.down.isDown) speedY = speed;
    }
    if (cursorKeys.left.isDown) speedX = -speed;
    if (cursorKeys.right.isDown) speedX = speed;
    if (cursorKeys.up.isDown) speedY = -speed;
    if (cursorKeys.down.isDown) speedY = speed;

    player.body.setVelocity(speedX, speedY);

    // Проста анімація повороту (дзеркальне відображення)
    if (speedX < 0) player.setFlipX(true); // Йде вліво
    else if (speedX > 0) player.setFlipX(false); // Йде вправо
}

function tryGatherResource() {
    let hitSomething = false;
    const scene = game.scene.scenes[0];

    scene.physics.overlap(player, trees, (player, tree) => {
        if (hitSomething) return;
        scene.tweens.add({ targets: tree, alpha: 0.5, duration: 100, yoyo: true });
        inventory.wood++;
        updateInventory();
        tree.disableBody(true, true); 
        hitSomething = true;
        showFloatingText(player.x, player.y, "+1 Wood 🌲");
    });

    if (!hitSomething) {
        scene.physics.overlap(player, rocks, (player, rock) => {
            if (hitSomething) return;
            scene.tweens.add({ targets: rock, alpha: 0.5, duration: 100, yoyo: true });
            inventory.stone++;
            updateInventory();
            rock.disableBody(true, true);
            hitSomething = true;
            showFloatingText(player.x, player.y, "+1 Stone 🪨");
        });
    }

    if (!hitSomething) {
        // Анімація "стрибка" при ударі в повітря
        scene.tweens.add({ targets: player, y: player.y - 10, duration: 100, yoyo: true });
    }
}

function updateInventory() {
    inventoryText.setText(`Wood: ${inventory.wood} | Stone: ${inventory.stone}`);
}

function showFloatingText(x, y, message) {
    const scene = game.scene.scenes[0];
    let text = scene.add.text(x, y - 20, message, {
        font: '18px monospace', fill: '#ffff00', stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(101);

    scene.tweens.add({
        targets: text, y: y - 60, alpha: 0, duration: 1000,
        onComplete: () => text.destroy()
    });
}
// Функцію createAssets видалено, вона більше не потрібна.
