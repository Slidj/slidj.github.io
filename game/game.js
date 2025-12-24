const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#151515',
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
let speed = 200; // Трохи швидше
let activeZone = null;
let furnitureGroup;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    window.gameScene = this;
    createPixelAssets(this); // Малюємо меблі

    // ЦЕНТР КІМНАТИ
    const roomX = window.innerWidth / 2;
    const roomY = window.innerHeight / 2;
    const roomW = 400; const roomH = 400;

    // 1. ПІДЛОГА
    const floor = this.add.tileSprite(roomX, roomY, roomW, roomH, 'floor');
    
    // 2. СТІНИ (Колізія)
    const walls = this.physics.add.staticGroup();
    // Верх, Низ, Ліво, Право
    walls.create(roomX, roomY - 210, 'wall_h'); 
    walls.create(roomX, roomY + 210, 'wall_h');
    walls.create(roomX - 210, roomY, 'wall_v');
    walls.create(roomX + 210, roomY, 'wall_v');

    // 3. МЕБЛІ
    furnitureGroup = this.physics.add.staticGroup();
    
    // Ліжко (зліва зверху)
    let bed = furnitureGroup.create(roomX - 120, roomY - 120, 'bed');
    bed.setData({ type: 'bed', text: '😴 Спати' });
    
    // Холодильник (справа зверху)
    let fridge = furnitureGroup.create(roomX + 120, roomY - 120, 'fridge');
    fridge.setData({ type: 'fridge', text: '🍔 Їсти (10$)' });
    
    // ПК (справа знизу)
    let pc = furnitureGroup.create(roomX + 120, roomY + 100, 'pc');
    pc.setData({ type: 'pc', text: '💻 Працювати' });

    // 4. ГРАВЕЦЬ
    player = this.physics.add.sprite(roomX, roomY, 'hero');
    player.setCollideWorldBounds(false);
    player.setDepth(10); // Герой поверх підлоги
    
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.2);

    this.physics.add.collider(player, walls);
    this.physics.add.collider(player, furnitureGroup);

    // 5. ДЖОЙСТИК (ВИПРАВЛЕНО)
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5).setStrokeStyle(2, 0xaaaaaa),
            thumb: this.add.circle(0, 0, 25, 0xffffff, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        
        // ВАЖЛИВО: Джойстик поверх усього
        joystick.base.setDepth(9999);
        joystick.thumb.setDepth(9999);
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

    // Джойстик
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

    // Нормалізація
    if (speedX !== 0 && speedY !== 0) { speedX *= 0.707; speedY *= 0.707; }

    player.body.setVelocity(speedX, speedY);
    
    checkInteraction();
}

function checkInteraction() {
    let nearby = false;
    furnitureGroup.children.iterate((item) => {
        if (Phaser.Math.Distance.Between(player.x, player.y, item.x, item.y) < 70) {
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
        showFloatText(player.x, player.y - 50, "Zzz...", "#fff");
        setTimeout(() => {
            stats.energy = 100; player.setAlpha(1); player.body.enable = true;
            showFloatText(player.x, player.y - 50, "Бодрячком! ⚡", "#ff0");
            updateHtml();
        }, 2000);
    } 
    else if (type === 'fridge') {
        if (stats.money >= 10) {
            stats.money -= 10; stats.hunger = Math.min(100, stats.hunger + 40);
            showFloatText(player.x, player.y - 50, "Смачно! 🍔", "#f88");
        } else {
            showFloatText(player.x, player.y - 50, "Нема грошей 💸", "#888");
        }
    } 
    else if (type === 'pc') {
        if (stats.energy >= 15) {
            stats.energy -= 15; stats.money += 20;
            showFloatText(player.x, player.y - 50, "Кодинг... +20$", "#0f0");
        } else {
            showFloatText(player.x, player.y - 50, "Втомився... 😴", "#888");
        }
    }
    updateHtml();
};

function updateHtml() {
    if(window.updateStats) window.updateStats(stats.energy, stats.hunger, stats.money);
}

function showFloatText(x, y, msg, color) {
    let t = window.gameScene.add.text(x, y, msg, { font: '16px Arial', fill: color, stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(100);
    window.gameScene.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
}

function createPixelAssets(scene) {
    // Генератор квадратної графіки
    const box = (k, w, h, c) => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const x = cv.getContext('2d');
        x.fillStyle = c; x.fillRect(0,0,w,h);
        x.strokeStyle = "rgba(0,0,0,0.5)"; x.lineWidth = 4; x.strokeRect(0,0,w,h);
        scene.textures.addCanvas(k, cv);
    };
    box('hero', 30, 30, '#ffbb00');
    box('bed', 50, 70, '#5D4037');
    box('fridge', 40, 60, '#E0E0E0');
    box('pc', 50, 40, '#424242');
    box('wall_h', 420, 20, '#333');
    box('wall_v', 20, 420, '#333');
    
    const fl = document.createElement('canvas'); fl.width=32; fl.height=32;
    const fx = fl.getContext('2d'); fx.fillStyle="#8D6E63"; fx.fillRect(0,0,32,32);
    fx.strokeStyle="#6D4C41"; fx.strokeRect(0,0,32,32);
    scene.textures.addCanvas('floor', fl);
}
