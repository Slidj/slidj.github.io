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
let joystick, joyCursorKeys, cursorKeys;
let speed = 160;
let activeZone = null;
let furnitureGroup;
let walkTween;

function preload() {
    // ЗАВАНТАЖЕННЯ ПЛАГІНА ДЖОЙСТИКА
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    window.gameScene = this;
    createStardewAssets(this); // Малюємо графіку

    const roomX = window.innerWidth / 2;
    const roomY = window.innerHeight / 2;
    const roomW = 320; 
    const roomH = 320;

    // 1. ПІДЛОГА
    const floor = this.add.tileSprite(roomX, roomY, roomW, roomH, 'floor_wood');
    floor.setDepth(0); // Найнижчий шар

    // 2. СТІНИ
    const walls = this.physics.add.staticGroup();
    let topWall = this.add.tileSprite(roomX, roomY - roomH/2 - 20, roomW + 40, 60, 'wall_brick');
    this.physics.add.existing(topWall, true); walls.add(topWall);
    topWall.setDepth(1); // Трохи вище підлоги

    // Невидимі стіни по боках
    let botWall = this.add.rectangle(roomX, roomY + roomH/2 + 10, roomW, 20, 0x000000, 0);
    this.physics.add.existing(botWall, true); walls.add(botWall);
    let leftWall = this.add.rectangle(roomX - roomW/2 - 10, roomY, 20, roomH, 0x000000, 0);
    this.physics.add.existing(leftWall, true); walls.add(leftWall);
    let rightWall = this.add.rectangle(roomX + roomW/2 + 10, roomY, 20, roomH, 0x000000, 0);
    this.physics.add.existing(rightWall, true); walls.add(rightWall);

    // 3. МЕБЛІ
    furnitureGroup = this.physics.add.staticGroup();
    
    let bed = furnitureGroup.create(roomX - 100, roomY - 100, 'bed');
    bed.setData({ type: 'bed', text: '😴 Спати' });
    
    let fridge = furnitureGroup.create(roomX + 100, roomY - 110, 'fridge');
    fridge.setData({ type: 'fridge', text: '🍔 Їсти (10$)' });
    
    let pc = furnitureGroup.create(roomX + 100, roomY + 80, 'pc_table');
    pc.setData({ type: 'pc', text: '💻 Працювати' });

    // Килим
    let rug = this.add.image(roomX, roomY, 'rug');
    rug.setDepth(1); // На підлозі

    // 4. ГЕРОЙ
    player = this.physics.add.sprite(roomX, roomY, 'hero');
    player.setDepth(10);
    player.body.setSize(24, 16); 
    player.body.setOffset(4, 16); 
    
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.8);

    this.physics.add.collider(player, walls);
    this.physics.add.collider(player, furnitureGroup);

    // 5. ДЖОЙСТИК (ВАЖЛИВО: СТВОРЮЄМО В КІНЦІ І СТАВИМО DEPTH)
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5).setStrokeStyle(2, 0xaaaaaa),
            thumb: this.add.circle(0, 0, 25, 0xffffff, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        
        // --- ФІКС ПРОБЛЕМИ ---
        // Ставимо величезний пріоритет (Depth), щоб він був поверх паркету і стін
        joystick.base.setDepth(999999); 
        joystick.thumb.setDepth(999999);
        // Зробимо його видимим для камери (scrollFactor 0 означає "не рухайся за камерою")
        joystick.base.setScrollFactor(0);
        joystick.thumb.setScrollFactor(0);
    }
    cursorKeys = this.input.keyboard.createCursorKeys();

    // Таймер голоду
    this.time.addEvent({ delay: 5000, loop: true, callback: () => {
        if(stats.hunger > 0) stats.hunger -= 2;
        updateHtml();
    }});
    updateHtml();
}

function update() {
    player.body.setVelocity(0);
    let speedX = 0, speedY = 0;

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

    if (speedX !== 0 && speedY !== 0) { speedX *= 0.707; speedY *= 0.707; }
    player.body.setVelocity(speedX, speedY);
    
    // Анімація ходьби
    if (speedX !== 0 || speedY !== 0) {
        if (!walkTween || !walkTween.isPlaying()) {
            walkTween = this.tweens.add({
                targets: player, scaleY: 0.9, scaleX: 1.1, duration: 150, yoyo: true, repeat: -1
            });
        }
        if (speedX < 0) player.setFlipX(true);
        else if (speedX > 0) player.setFlipX(false);
    } else {
        if (walkTween) { walkTween.stop(); player.setScale(1); }
    }

    // Сортування (глибина)
    player.setDepth(player.y);
    furnitureGroup.children.iterate(item => { item.setDepth(item.y); });

    checkInteraction();
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
        player.setAlpha(0.5); player.body.enable = false;
        showFloatText(player.x, player.y - 40, "Zzz...", "#fff");
        setTimeout(() => {
            stats.energy = 100; player.setAlpha(1); player.body.enable = true;
            showFloatText(player.x, player.y - 40, "Повний заряд! ⚡", "#ff0");
            updateHtml();
        }, 2000);
    } 
    else if (type === 'fridge') {
        if (stats.money >= 10) {
            stats.money -= 10; stats.hunger = Math.min(100, stats.hunger + 40);
            showFloatText(player.x, player.y - 40, "Ням! 🍔", "#f88");
        } else {
            showFloatText(player.x, player.y - 40, "Треба гроші 💸", "#888");
        }
    } 
    else if (type === 'pc') {
        if (stats.energy >= 15) {
            stats.energy -= 15; stats.money += 20;
            showFloatText(player.x, player.y - 40, "Код пишеться... +20$", "#0f0");
            this.tweens.add({targets: activeZone, x: activeZone.x+2, duration: 50, yoyo: true, repeat: 5});
        } else {
            showFloatText(player.x, player.y - 40, "Втомився... 😴", "#888");
        }
    }
    updateHtml();
};

function updateHtml() { if(window.updateStats) window.updateStats(stats.energy, stats.hunger, stats.money); }
function showFloatText(x, y, msg, color) {
    let t = window.gameScene.add.text(x, y, msg, { font: '14px monospace', fill: color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(99999);
    window.gameScene.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

function createStardewAssets(scene) {
    // 1. ПАРКЕТ
    const floorC = document.createElement('canvas'); floorC.width=32; floorC.height=32;
    const fCtx = floorC.getContext('2d');
    fCtx.fillStyle="#e0c090"; fCtx.fillRect(0,0,32,32); 
    fCtx.fillStyle="#d0b080"; fCtx.fillRect(0,0,32,2); fCtx.fillRect(0,16,32,2); 
    fCtx.fillRect(15,2,2,14); fCtx.fillRect(5,18,2,14);
    scene.textures.addCanvas('floor_wood', floorC);

    // 2. ЦЕГЛА
    const wallC = document.createElement('canvas'); wallC.width=32; wallC.height=32;
    const wCtx = wallC.getContext('2d');
    wCtx.fillStyle="#8d5524"; wCtx.fillRect(0,0,32,32); 
    wCtx.fillStyle="#704018"; wCtx.fillRect(0, 10, 32, 2); wCtx.fillRect(0, 22, 32, 2);
    wCtx.fillRect(10, 0, 2, 10); wCtx.fillRect(20, 12, 2, 10); wCtx.fillRect(5, 24, 2, 8);
    wCtx.fillStyle="#503010"; wCtx.fillRect(0,0,32,4);
    scene.textures.addCanvas('wall_brick', wallC);

    // 3. ГЕРОЙ
    const heroC = document.createElement('canvas'); heroC.width=32; heroC.height=32;
    const hCtx = heroC.getContext('2d');
    hCtx.fillStyle="#ffcc00"; hCtx.fillRect(4, 4, 24, 24);
    hCtx.fillStyle="#000"; hCtx.fillRect(10, 10, 4, 4); hCtx.fillRect(20, 10, 4, 4);
    hCtx.fillStyle="#ff6666"; hCtx.fillRect(4, 18, 24, 10);
    scene.textures.addCanvas('hero', heroC);

    // 4. МЕБЛІ
    const bedC = document.createElement('canvas'); bedC.width=40; bedC.height=60;
    const bCtx = bedC.getContext('2d');
    bCtx.fillStyle="#8B4513"; bCtx.fillRect(0,0,40,60);
    bCtx.fillStyle="#fff"; bCtx.fillRect(4,4,32,15);
    bCtx.fillStyle="#5599ff"; bCtx.fillRect(2,22,36,36);
    scene.textures.addCanvas('bed', bedC);

    const frC = document.createElement('canvas'); frC.width=32; frC.height=56;
    const frCtx = frC.getContext('2d');
    frCtx.fillStyle="#eee"; frCtx.fillRect(0,0,32,56);
    frCtx.fillStyle="#ccc"; frCtx.fillRect(2,20,28,2); frCtx.fillStyle="#aaa"; frCtx.fillRect(4,24,2,10);
    scene.textures.addCanvas('fridge', frC);

    const pcC = document.createElement('canvas'); pcC.width=48; pcC.height=40;
    const pcCtx = pcC.getContext('2d');
    pcCtx.fillStyle="#8B4513"; pcCtx.fillRect(0,20,48,20);
    pcCtx.fillStyle="#222"; pcCtx.fillRect(10,0,28,20);
    pcCtx.fillStyle="#00ff00"; pcCtx.fillRect(12,2,24,16);
    scene.textures.addCanvas('pc_table', pcC);

    const rugC = document.createElement('canvas'); rugC.width=60; rugC.height=40;
    const rCtx = rugC.getContext('2d');
    rCtx.fillStyle="#cc4444"; rCtx.fillRect(0,0,60,40); rCtx.fillStyle="#aa2222"; rCtx.fillRect(5,5,50,30);
    scene.textures.addCanvas('rug', rugC);
}
