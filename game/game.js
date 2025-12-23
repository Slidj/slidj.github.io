// --- НАЛАШТУВАННЯ ---
const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#1a1a1a', // Темний фон підкладки
    pixelArt: true, // ВАЖЛИВО: Робить пікселі чіткими
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
    // Тільки плагін джойстика беремо з інтернету (він надійний)
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    // 1. СТВОРЮЄМО ПІКСЕЛЬ-АРТ (Магія коду)
    createPixelTextures(this);

    // 2. СВІТ
    // Трава (Тайл 16x16, збільшений в 4 рази)
    const grass = this.add.tileSprite(0, 0, 2000, 2000, 'grass').setOrigin(0);
    grass.setScale(4); 

    this.physics.world.setBounds(0, 0, 2000 * 4, 2000 * 4);

    // 3. РЕСУРСИ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    // Садимо дерева
    for (let i = 0; i < 50; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let tree = trees.create(x, y, 'tree');
        tree.setScale(4).refreshBody(); // Збільшуємо пікселі в 4 рази
        // Робимо так, щоб герой ходив "за" деревом (колізія по пеньку)
        tree.body.setSize(10, 8);
        tree.body.setOffset(3, 24);
    }

    // Розкидаємо каміння
    for (let i = 0; i < 30; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let rock = rocks.create(x, y, 'rock');
        rock.setScale(4).refreshBody();
        rock.body.setSize(14, 10);
        rock.body.setOffset(1, 6);
    }

    // 4. ГРАВЕЦЬ (ЛИЦАР)
    player = this.physics.add.sprite(500, 500, 'hero');
    player.setScale(4); // Великий піксельний герой
    player.setCollideWorldBounds(true);
    player.body.setSize(10, 8); // Колізія тільки на ногах
    player.body.setOffset(3, 24);

    // Камера
    this.cameras.main.setBounds(0, 0, 8000, 8000);
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.0);

    // Колізія
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

    // 6. ІНТЕРФЕЙС
    inventoryText = this.add.text(20, 20, 'Wood: 0 | Stone: 0', {
        font: '20px monospace', fill: '#ffffff', backgroundColor: '#000000aa', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(100);

    // Кнопка дії
    const actionBtn = document.getElementById('action-btn');
    if(actionBtn) {
        let newBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newBtn, actionBtn);
        newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tryGatherResource(); });
        newBtn.addEventListener('mousedown', (e) => { e.preventDefault(); tryGatherResource(); });
    }
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

    // Поворот героя
    if (speedX < 0) player.setFlipX(true);
    else if (speedX > 0) player.setFlipX(false);
}

function tryGatherResource() {
    let hitSomething = false;
    const scene = game.scene.scenes[0];

    scene.physics.overlap(player, trees, (player, tree) => {
        if (hitSomething) return;
        scene.tweens.add({ targets: tree, alpha: 0.5, duration: 100, yoyo: true });
        inventory.wood++;
        updateInventory();
        tree.destroy(); 
        hitSomething = true;
        showFloatingText(player.x, player.y, "+1 Wood 🌲");
    });

    if (!hitSomething) {
        scene.physics.overlap(player, rocks, (player, rock) => {
            if (hitSomething) return;
            scene.tweens.add({ targets: rock, alpha: 0.5, duration: 100, yoyo: true });
            inventory.stone++;
            updateInventory();
            rock.destroy();
            hitSomething = true;
            showFloatingText(player.x, player.y, "+1 Stone 🪨");
        });
    }

    if (!hitSomething) {
        scene.tweens.add({ targets: player, y: player.y - 10, duration: 100, yoyo: true });
    }
}

function updateInventory() {
    inventoryText.setText(`Wood: ${inventory.wood} | Stone: ${inventory.stone}`);
}

function showFloatingText(x, y, message) {
    const scene = game.scene.scenes[0];
    let text = scene.add.text(x, y - 40, message, {
        font: '20px monospace', fill: '#ffff00', stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setDepth(101);

    scene.tweens.add({
        targets: text, y: y - 100, alpha: 0, duration: 1000,
        onComplete: () => text.destroy()
    });
}

// --- ГЕНЕРАТОР ПІКСЕЛЬ-АРТУ ---
function createPixelTextures(scene) {
    // Функція малювання з тексту
    const makeTexture = (key, data, palette) => {
        const canvas = document.createElement('canvas');
        canvas.width = data[0].length;
        canvas.height = data.length;
        const ctx = canvas.getContext('2d');
        
        for (let y = 0; y < data.length; y++) {
            for (let x = 0; x < data[y].length; x++) {
                const pixel = data[y][x];
                if (pixel !== '.' && palette[pixel]) {
                    ctx.fillStyle = palette[pixel];
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        scene.textures.addCanvas(key, canvas);
    };

    // 1. ЛИЦАР (16x16)
    // s = silver (armor), r = red (plume), f = face, . = empty
    const heroPalette = { 's': '#C0C0C0', 'd': '#696969', 'r': '#FF0000', 'f': '#FFCCAA', 'b': '#000000' };
    const heroData = [
        "......rr........",
        ".....rrrr.......",
        "....ssssrr......",
        "...ssbbfssr.....",
        "...ssfffsr......",
        "...ssssss.......",
        "..ssssssss......",
        ".ddssssssdd.....",
        "d.ssssssss.d....",
        "d.ssssssss.d....",
        "..ssssssss......",
        "..ssssssss......",
        "...dd..dd.......",
        "...ss..ss.......",
        "...ss..ss.......",
        "..dd....dd......"
    ];
    makeTexture('hero', heroData, heroPalette);

    // 2. ДЕРЕВО (16x32)
    // g = green, G = dark green, b = brown
    const treePalette = { 'g': '#228B22', 'G': '#006400', 'b': '#8B4513' };
    const treeData = [
        "......GGG.......",
        "....GGggGGG.....",
        "...GggggggGG....",
        "..GggggggggGG...",
        "..GggggggggGG...",
        "..GggggggggGG...",
        "...GGgggggGG....",
        "....GGgggGG.....",
        "......GGG.......",
        ".......b........",
        ".......b........",
        ".......b........",
        ".......b........",
        ".......b........",
        "......bbb.......",
        ".....bbbbb......"
    ];
    makeTexture('tree', treeData, treePalette);

    // 3. КАМІНЬ (16x16)
    const rockPalette = { 'g': '#808080', 'd': '#505050', 'l': '#A0A0A0' };
    const rockData = [
        "................",
        ".....ggggg......",
        "...ggllllggg....",
        "..gglllllllgg...",
        ".gglllggglllgg..",
        ".ggllggggglllgg.",
        ".ggllgdddglllgg.",
        "gglllgdddglllgg.",
        "gglllggggglllgg.",
        "ggllllgggllllgg.",
        ".gglllllllllgg..",
        ".gglllllllllgg..",
        "..ggglllllggg...",
        "...ggggggggg....",
        ".....ggggg......",
        "................"
    ];
    makeTexture('rock', rockData, rockPalette);

    // 4. ТРАВА (16x16)
    const grassPalette = { 'g': '#2d5a27', 'l': '#3e7a36' };
    const grassData = [
        "gggggggggggggggg",
        "gggglggggggggggg",
        "gggggggggggglggg",
        "ggglgggggggggggg",
        "gggggggggggggggg",
        "ggggggggglgggggg",
        "gggggggggggggggg",
        "gglggggggggggggg",
        "gggggggggggggggg",
        "ggggggggglgggggg",
        "gggggggggggggggg",
        "gggglggggggggggg",
        "gggggggggggglggg",
        "gggggggggggggggg",
        "gglggggggggggggg",
        "gggggggggggggggg"
    ];
    makeTexture('grass', grassData, grassPalette);
}
