const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#000000', // Повна темрява фону
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player;
let joystick;
let joyCursorKeys;
let cursorKeys;
let speed = 200;

let trees;
let rocks;
let inventory = { wood: 0, stone: 0 };
let inventoryText;

// Для освітлення
let lightLayer; 
let spotlight;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    createPixelTextures(this);

    // 1. СВІТ (Робимо землю темнішою, як у Diablo)
    const grass = this.add.tileSprite(0, 0, 2000, 2000, 'grass').setOrigin(0);
    grass.setScale(4); 
    grass.setTint(0x555555); // Затінюємо саму траву, щоб вона не була яскравою

    this.physics.world.setBounds(0, 0, 2000 * 4, 2000 * 4);

    // 2. РЕСУРСИ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    for (let i = 0; i < 60; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let tree = trees.create(x, y, 'tree');
        tree.setScale(4).refreshBody(); 
        tree.body.setSize(10, 8);
        tree.body.setOffset(3, 24);
        tree.setDepth(y); // Сортування глибини (щоб герой заходив ЗА дерево)
    }

    for (let i = 0; i < 40; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let rock = rocks.create(x, y, 'rock');
        rock.setScale(4).refreshBody();
        rock.body.setSize(14, 10);
        rock.body.setOffset(1, 6);
        rock.setDepth(y);
    }

    // 3. ГРАВЕЦЬ
    player = this.physics.add.sprite(500, 500, 'hero');
    player.setScale(4);
    player.setCollideWorldBounds(true);
    player.body.setSize(10, 8);
    player.body.setOffset(3, 24);
    player.setDepth(500); // Початкова глибина

    // Камера
    this.cameras.main.setBounds(0, 0, 8000, 8000);
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.0);

    // Колізії
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 4. СИСТЕМА ОСВІТЛЕННЯ (Fog of War)
    // Створюємо чорну текстуру поверх всього світу
    lightLayer = this.add.renderTexture(0, 0, 2000 * 4, 2000 * 4);
    lightLayer.setDepth(10000); // Поверх усього
    lightLayer.fill(0x000000, 0.95); // Чорний колір, 95% непрозорості (темрява)
    lightLayer.setBlendMode(Phaser.BlendModes.MULTIPLY); // Режим накладання

    // "Пензлик" світла (круглий градієнт)
    spotlight = this.make.image({
        x: 0, y: 0, key: 'light', add: false
    });
    spotlight.setScale(6); // Розмір світла

    // 5. ДЖОЙСТИК ТА UI
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x444444, 0.5),
            thumb: this.add.circle(0, 0, 25, 0x888888, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        }).on('update', dumpJoyState, this);
        joyCursorKeys = joystick.createCursorKeys();
        
        // Джойстик має бути поверх темряви
        joystick.base.setDepth(20000);
        joystick.thumb.setDepth(20000);
    }
    cursorKeys = this.input.keyboard.createCursorKeys();

    inventoryText = this.add.text(20, 20, 'Wood: 0 | Stone: 0', {
        font: '20px monospace', fill: '#ffaa00', backgroundColor: '#000000', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(20000);

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

    if (speedX < 0) player.setFlipX(true);
    else if (speedX > 0) player.setFlipX(false);

    // --- ОНОВЛЕННЯ ГЛИБИНИ ---
    // Це створює 2.5D ефект: якщо ти нижче дерева на екрані, ти його перекриваєш.
    // Якщо ти вище дерева - воно перекриває тебе.
    player.setDepth(player.y);

    // --- ОНОВЛЕННЯ СВІТЛА ---
    // Очищаємо шар світла (робимо його знову темним)
    lightLayer.fill(0x000000, 0.98); // Дуже темно
    
    // "Вирізаємо" дірку у темряві навколо гравця
    // erase - стирає чорний колір, відкриваючи світ під ним
    lightLayer.erase(spotlight, player.x, player.y);
}

function tryGatherResource() {
    let hitSomething = false;
    const scene = game.scene.scenes[0];

    // Ефект "маху мечем" - спалах
    const slash = scene.add.circle(player.x, player.y, 40, 0xffffff, 0.8);
    slash.setDepth(player.y + 1);
    scene.tweens.add({ targets: slash, alpha: 0, scale: 1.5, duration: 150, onComplete: () => slash.destroy() });

    scene.physics.overlap(player, trees, (player, tree) => {
        if (hitSomething) return;
        scene.tweens.add({ targets: tree, alpha: 0.5, duration: 100, yoyo: true, onComplete: () => tree.setAlpha(1) });
        inventory.wood++;
        updateInventory();
        tree.destroy(); 
        hitSomething = true;
        showFloatingText(player.x, player.y, "+ Wood", '#00ff00');
    });

    if (!hitSomething) {
        scene.physics.overlap(player, rocks, (player, rock) => {
            if (hitSomething) return;
            scene.tweens.add({ targets: rock, alpha: 0.5, duration: 100, yoyo: true, onComplete: () => rock.setAlpha(1) });
            inventory.stone++;
            updateInventory();
            rock.destroy();
            hitSomething = true;
            showFloatingText(player.x, player.y, "+ Stone", '#aaaaaa');
        });
    }
}

function updateInventory() {
    inventoryText.setText(`Wood: ${inventory.wood} | Stone: ${inventory.stone}`);
}

function showFloatingText(x, y, message, color) {
    const scene = game.scene.scenes[0];
    let text = scene.add.text(x, y - 40, message, {
        font: '16px monospace', fill: color, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setDepth(100000); // Поверх темряви

    scene.tweens.add({
        targets: text, y: y - 80, alpha: 0, duration: 1000,
        onComplete: () => text.destroy()
    });
}

function createPixelTextures(scene) {
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

    // ГЕРОЙ
    const heroPalette = { 's': '#888888', 'r': '#880000', 'f': '#CCAA88', 'b': '#000000' };
    const heroData = [
        "......rr........", ".....rrrr.......", "....ssssrr......", "...ssbbfssr.....",
        "...ssfffsr......", "...ssssss.......", "..ssssssss......", ".ddssssssdd.....",
        "d.ssssssss.d....", "d.ssssssss.d....", "..ssssssss......", "..ssssssss......",
        "...dd..dd.......", "...ss..ss.......", "...ss..ss.......", "..dd....dd......"
    ];
    makeTexture('hero', heroData, heroPalette);

    // ДЕРЕВО (Більш темне)
    const treePalette = { 'g': '#114411', 'G': '#002200', 'b': '#331100' };
    const treeData = [
        "......GGG.......", "....GGggGGG.....", "...GggggggGG....", "..GggggggggGG...",
        "..GggggggggGG...", "..GggggggggGG...", "...GGgggggGG....", "....GGgggGG.....",
        "......GGG.......", ".......b........", ".......b........", ".......b........",
        ".......b........", ".......b........", "......bbb.......", ".....bbbbb......"
    ];
    makeTexture('tree', treeData, treePalette);

    // КАМІНЬ
    const rockPalette = { 'g': '#444444', 'd': '#222222', 'l': '#666666' };
    const rockData = [
        "................", ".....ggggg......", "...ggllllggg....", "..gglllllllgg...",
        ".gglllggglllgg..", ".ggllggggglllgg.", ".ggllgdddglllgg.", "gglllgdddglllgg.",
        "gglllggggglllgg.", "ggllllgggllllgg.", ".gglllllllllgg..", ".gglllllllllgg..",
        "..ggglllllggg...", "...ggggggggg....", ".....ggggg......", "................"
    ];
    makeTexture('rock', rockData, rockPalette);

    // ТРАВА
    const grassPalette = { 'g': '#1a3315', 'l': '#2b4d24' };
    const grassData = [
        "gggggggggggggggg", "gggglggggggggggg", "gggggggggggglggg", "ggglgggggggggggg",
        "gggggggggggggggg", "ggggggggglgggggg", "gggggggggggggggg", "gglggggggggggggg",
        "gggggggggggggggg", "ggggggggglgggggg", "gggggggggggggggg", "gggglggggggggggg",
        "gggggggggggglggg", "gggggggggggggggg", "gglggggggggggggg", "gggggggggggggggg"
    ];
    makeTexture('grass', grassData, grassPalette);

    // СВІТЛО (Градієнт) 
    const lightCanvas = document.createElement('canvas');
    lightCanvas.width = 128; lightCanvas.height = 128;
    const lCtx = lightCanvas.getContext('2d');
    const grd = lCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255, 255, 200, 1)');   // Центр (яскравий)
    grd.addColorStop(0.5, 'rgba(255, 200, 100, 0.5)'); // Середина (жовта)
    grd.addColorStop(1, 'rgba(0, 0, 0, 0)');     // Краї (прозорі)
    lCtx.fillStyle = grd;
    lCtx.fillRect(0, 0, 128, 128);
    scene.textures.addCanvas('light', lightCanvas);
}

function dumpJoyState() {} // Заглушка
