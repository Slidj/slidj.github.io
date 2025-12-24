const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#111',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let stats = { energy: 100, hunger: 100, money: 50 };
let player;
// Змінні для нашого саморобного джойстика
let joyBase, joyThumb;
let isTouching = false;
let joyX = 0, joyY = 0; // Вектор руху (-1 до 1)

let cursorKeys;
let speed = 160;
let activeZone = null;
let furnitureGroup;
let walkTween;

function preload() {
    // НІЯКИХ ПЛАГІНІВ! Тільки вбудовані функції.
}

function create() {
    window.gameScene = this;
    
    // 1. СПРОБУЄМО ВИВЕСТИ ТЕКСТ (Щоб ти знав, що гра жива)
    this.add.text(10, 10, 'Game Started v1.0', { 
        font: '12px monospace', fill: '#0f0', backgroundColor: '#000' 
    }).setScrollFactor(0).setDepth(999999);

    createStardewAssets(this);

    const roomX = window.innerWidth / 2;
    const roomY = window.innerHeight / 2;
    const roomW = 320; const roomH = 320;

    // Світ
    const floor = this.add.tileSprite(roomX, roomY, roomW, roomH, 'floor_wood').setDepth(0);
    
    // Стіни
    const walls = this.physics.add.staticGroup();
    let topWall = this.add.tileSprite(roomX, roomY - roomH/2 - 20, roomW + 40, 60, 'wall_brick');
    this.physics.add.existing(topWall, true); walls.add(topWall); topWall.setDepth(1);
    
    // Невидимі стіни
    walls.add(this.add.rectangle(roomX, roomY+roomH/2+10, roomW, 20, 0, 0));
    walls.add(this.add.rectangle(roomX-roomW/2-10, roomY, 20, roomH, 0, 0));
    walls.add(this.add.rectangle(roomX+roomW/2+10, roomY, 20, roomH, 0, 0));
    // Додаємо фізику невидимим стінам вручну
    walls.children.iterate(w => { if(!w.body) this.physics.add.existing(w, true); });

    // Меблі
    furnitureGroup = this.physics.add.staticGroup();
    let bed = furnitureGroup.create(roomX - 100, roomY - 100, 'bed'); bed.setData({ type: 'bed', text: '😴 Спати' });
    let fridge = furnitureGroup.create(roomX + 100, roomY - 110, 'fridge'); fridge.setData({ type: 'fridge', text: '🍔 Їсти (10$)' });
    let pc = furnitureGroup.create(roomX + 100, roomY + 80, 'pc_table'); pc.setData({ type: 'pc', text: '💻 Працювати' });
    this.add.image(roomX, roomY, 'rug').setDepth(1);

    // Гравець
    player = this.physics.add.sprite(roomX, roomY, 'hero');
    player.setDepth(10);
    player.body.setSize(24, 16); player.body.setOffset(4, 16);

    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.8);

    this.physics.add.collider(player, walls);
    this.physics.add.collider(player, furnitureGroup);

    cursorKeys = this.input.keyboard.createCursorKeys();

    // --- СТВОРЕННЯ ВЛАСНОГО ДЖОЙСТИКА ---
    createCustomJoystick(this);

    // Таймер
    this.time.addEvent({ delay: 5000, loop: true, callback: () => {
        if(stats.hunger > 0) stats.hunger -= 2;
        updateHtml();
    }});
    updateHtml();
}

function update() {
    player.body.setVelocity(0);
    let speedX = 0, speedY = 0;

    // Використовуємо наш саморобний джойстик
    if (isTouching) {
        speedX = joyX * speed;
        speedY = joyY * speed;
    }

    // Клавіатура
    if (cursorKeys.left.isDown) speedX = -speed;
    if (cursorKeys.right.isDown) speedX = speed;
    if (cursorKeys.up.isDown) speedY = -speed;
    if (cursorKeys.down.isDown) speedY = speed;

    player.body.setVelocity(speedX, speedY);

    // Анімація
    if (speedX !== 0 || speedY !== 0) {
        if (!walkTween || !walkTween.isPlaying()) {
            walkTween = this.tweens.add({ targets: player, scaleY: 0.9, scaleX: 1.1, duration: 150, yoyo: true, repeat: -1 });
        }
        if (speedX < 0) player.setFlipX(true); else if (speedX > 0) player.setFlipX(false);
    } else {
        if (walkTween) { walkTween.stop(); player.setScale(1); }
    }

    // Сортування
    player.setDepth(player.y);
    furnitureGroup.children.iterate(item => { item.setDepth(item.y); });
    
    checkInteraction();
}

// --- НАШ ВЛАСНИЙ ДЖОЙСТИК (Без плагінів) ---
function createCustomJoystick(scene) {
    const baseX = 100;
    const baseY = window.innerHeight - 100;
    const radius = 50;

    // 1. Малюємо основу (Сіре коло)
    joyBase = scene.add.circle(baseX, baseY, radius, 0x888888, 0.5)
        .setScrollFactor(0).setDepth(999999).setInteractive();
    
    // Обводка
    scene.add.circle(baseX, baseY, radius, 0xaaaaaa).setStrokeStyle(2, 0xaaaaaa).setScrollFactor(0).setDepth(999999);

    // 2. Малюємо стік (Біле коло)
    joyThumb = scene.add.circle(baseX, baseY, 25, 0xffffff, 0.9)
        .setScrollFactor(0).setDepth(999999);

    // 3. Логіка дотиків
    scene.input.on('pointerdown', (pointer) => {
        // Перевіряємо, чи натиснули в районі джойстика
        if (Phaser.Math.Distance.Between(pointer.x, pointer.y, baseX, baseY) < 100) {
            isTouching = true;
        }
    });

    scene.input.on('pointermove', (pointer) => {
        if (isTouching) {
            let dist = Phaser.Math.Distance.Between(baseX, baseY, pointer.x, pointer.y);
            let angle = Phaser.Math.Angle.Between(baseX, baseY, pointer.x, pointer.y);

            // Обмежуємо рух радіусом
            if (dist > radius) dist = radius;

            // Рухаємо стік
            joyThumb.x = baseX + Math.cos(angle) * dist;
            joyThumb.y = baseY + Math.sin(angle) * dist;

            // Розраховуємо швидкість (-1 до 1)
            joyX = Math.cos(angle) * (dist / radius);
            joyY = Math.sin(angle) * (dist / radius);
        }
    });

    scene.input.on('pointerup', () => {
        isTouching = false;
        joyThumb.x = baseX;
        joyThumb.y = baseY;
        joyX = 0;
        joyY = 0;
    });
}

function checkInteraction() {
    let nearby = false;
    furnitureGroup.children.iterate((item) => {
        if (Phaser.Math.Distance.Between(player.x, player.y, item.x, item.y) < 60) {
            nearby = true;
            if (activeZone !== item) {
                activeZone = item;
                window.showButton(item.getData('text'), item.getData('type'));
            }
        }
    });
    if (!nearby && activeZone) {
        activeZone = null;
        window.hideButton();
    }
}

this.triggerAction = function(type) {
    if (type === 'bed') {
        player.setAlpha(0.5); player.body.enable = false; showFloatText(player.x, player.y - 40, "Zzz...", "#fff");
        setTimeout(() => { stats.energy = 100; player.setAlpha(1); player.body.enable = true; showFloatText(player.x, player.y - 40, "Повний заряд! ⚡", "#ff0"); updateHtml(); }, 2000);
    } 
    else if (type === 'fridge') {
        if (stats.money >= 10) { stats.money -= 10; stats.hunger = Math.min(100, stats.hunger + 40); showFloatText(player.x, player.y - 40, "Ням! 🍔", "#f88"); } 
        else { showFloatText(player.x, player.y - 40, "Треба гроші 💸", "#888"); }
    } 
    else if (type === 'pc') {
        if (stats.energy >= 15) { stats.energy -= 15; stats.money += 20; showFloatText(player.x, player.y - 40, "Працюю... +20$", "#0f0"); } 
        else { showFloatText(player.x, player.y - 40, "Втомився... 😴", "#888"); }
    }
    updateHtml();
};

function updateHtml() { if(window.updateStats) window.updateStats(stats.energy, stats.hunger, stats.money); }
function showFloatText(x, y, msg, color) {
    let t = window.gameScene.add.text(x, y, msg, { font: '14px monospace', fill: color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(99999);
    window.gameScene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

function createStardewAssets(scene) {
    const box = (k, w, h, c) => { const cv = document.createElement('canvas'); cv.width=w; cv.height=h; const x = cv.getContext('2d'); x.fillStyle=c; x.fillRect(0,0,w,h); scene.textures.addCanvas(k, cv); };
    
    const floorC = document.createElement('canvas'); floorC.width=32; floorC.height=32; const fCtx=floorC.getContext('2d'); fCtx.fillStyle="#e0c090"; fCtx.fillRect(0,0,32,32); fCtx.fillStyle="#d0b080"; fCtx.fillRect(0,0,32,2); fCtx.fillRect(0,16,32,2); fCtx.fillRect(15,2,2,14); fCtx.fillRect(5,18,2,14); scene.textures.addCanvas('floor_wood', floorC);
    const wallC = document.createElement('canvas'); wallC.width=32; wallC.height=32; const wCtx=wallC.getContext('2d'); wCtx.fillStyle="#8d5524"; wCtx.fillRect(0,0,32,32); wCtx.fillStyle="#704018"; wCtx.fillRect(0,10,32,2); wCtx.fillRect(0,22,32,2); wCtx.fillStyle="#503010"; wCtx.fillRect(0,0,32,4); scene.textures.addCanvas('wall_brick', wallC);
    const heroC = document.createElement('canvas'); heroC.width=32; heroC.height=32; const hCtx=heroC.getContext('2d'); hCtx.fillStyle="#ffcc00"; hCtx.fillRect(4,4,24,24); hCtx.fillStyle="#000"; hCtx.fillRect(10,10,4,4); hCtx.fillRect(20,10,4,4); hCtx.fillStyle="#ff6666"; hCtx.fillRect(4,18,24,10); scene.textures.addCanvas('hero', heroC);
    
    box('bed', 40, 60, '#8B4513');
    box('fridge', 32, 56, '#eee');
    box('pc_table', 48, 40, '#333');
    box('rug', 60, 40, '#cc4444');
}
