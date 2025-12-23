const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#050505',
    pixelArt: false, // Вимикаємо піксель-арт для м'яких градієнтів (як в 3D)
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 180;
let trees, rocks;
let shadowLayer;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    // 1. СТВОРЕННЯ "DIABLO" ГРАФІКИ
    createDiabloAssets(this);

    // 2. АНІМАЦІЇ
    // Створюємо анімацію бігу з кадрів, які ми намалювали кодом
    this.anims.create({
        key: 'run',
        frames: [
            { key: 'hero_run1' },
            { key: 'hero_base' },
            { key: 'hero_run2' },
            { key: 'hero_base' }
        ],
        frameRate: 8,
        repeat: -1
    });

    // 3. СВІТ (Темна земля)
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'ground').setOrigin(0);
    ground.setDepth(-100);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 4. ОБ'ЄКТИ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    // Генерація лісу (Темні сосни)
    for (let i = 0; i < 60; i++) {
        let x = Phaser.Math.Between(100, 1900);
        let y = Phaser.Math.Between(100, 1900);
        let tree = trees.create(x, y, 'tree');
        tree.body.setSize(20, 10); // Колізія тільки по пеньку
        tree.body.setOffset(22, 100); // Зміщуємо колізію вниз
        tree.setDepth(y); // 2.5D сортування
    }

    // Генерація каменів
    for (let i = 0; i < 30; i++) {
        let x = Phaser.Math.Between(100, 1900);
        let y = Phaser.Math.Between(100, 1900);
        let rock = rocks.create(x, y, 'rock');
        rock.setDepth(y);
        rock.refreshBody();
    }

    // 5. ГЕРОЙ
    player = this.physics.add.sprite(500, 500, 'hero_base');
    player.setCollideWorldBounds(true);
    // Колізія героя (овал під ногами)
    player.body.setCircle(16, 16, 32); 
    player.setDepth(500);

    // Тінь під героєм
    const shadow = this.add.ellipse(0, 0, 40, 20, 0x000000, 0.5);
    player.setData('shadow', shadow); // Прив'язуємо тінь до героя

    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.1); // Трохи наближаємо

    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 6. ОСВІТЛЕННЯ (ВІНЄТКА)
    const darkness = this.add.image(window.innerWidth/2, window.innerHeight/2, 'vignette');
    darkness.setDisplaySize(window.innerWidth, window.innerHeight);
    darkness.setScrollFactor(0).setDepth(10000).setAlpha(0.85); // Сильна темрява по краях

    // 7. ДЖОЙСТИК (Поверх усього)
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x222222, 0.5).setStrokeStyle(2, 0x888888), 
            thumb: this.add.circle(0, 0, 25, 0x555555, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        joystick.base.setDepth(20000); joystick.thumb.setDepth(20000);
    }
    cursorKeys = this.input.keyboard.createCursorKeys();
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

    // Нормалізація швидкості по діагоналі
    if (speedX !== 0 && speedY !== 0) {
        speedX *= 0.707;
        speedY *= 0.707;
    }

    player.body.setVelocity(speedX, speedY);

    // --- ЛОГІКА АНІМАЦІЇ ---
    if (speedX !== 0 || speedY !== 0) {
        // Якщо рухаємось - граємо анімацію
        player.anims.play('run', true);
    } else {
        // Стоїмо - зупиняємо анімацію
        player.anims.stop();
        player.setTexture('hero_base');
    }

    // Поворот (Flip)
    if (speedX < 0) player.setFlipX(true);
    else if (speedX > 0) player.setFlipX(false);

    // Сортування глибини (2.5D)
    player.setDepth(player.y);
    
    // Рух тіні разом з героєм
    const shadow = player.getData('shadow');
    shadow.setPosition(player.x, player.y + 25);
    shadow.setDepth(player.y - 1); // Тінь завжди під героєм
}

// --- ГЕНЕРАТОР ГРАФІКИ КЛАСУ "DIABLO" ---
function createDiabloAssets(scene) {
    // 1. ГЕРОЙ (Створення 3-х кадрів для анімації)
    const drawHero = (key, legState) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Тінь/Контур
        ctx.shadowColor = "black"; ctx.shadowBlur = 5;

        // Ноги (Темні штани)
        ctx.fillStyle = "#2a2a2a";
        if (legState === 0) { // Стоїть
            ctx.fillRect(22, 40, 8, 15); ctx.fillRect(34, 40, 8, 15);
        } else if (legState === 1) { // Ліва вперед
            ctx.fillRect(20, 38, 8, 15); ctx.fillRect(36, 42, 8, 13);
        } else { // Права вперед
            ctx.fillRect(24, 42, 8, 13); ctx.fillRect(38, 38, 8, 15);
        }

        // Тіло (Срібна броня з градієнтом)
        let armorGrd = ctx.createLinearGradient(0, 0, 64, 64);
        armorGrd.addColorStop(0, "#444"); armorGrd.addColorStop(0.5, "#aaa"); armorGrd.addColorStop(1, "#444");
        ctx.fillStyle = armorGrd;
        
        // Малюємо нагрудник (форма щита)
        ctx.beginPath();
        ctx.moveTo(20, 20); ctx.lineTo(44, 20); ctx.lineTo(40, 45); ctx.lineTo(24, 45);
        ctx.fill();

        // Голова (Шолом)
        let helmGrd = ctx.createRadialGradient(32, 16, 2, 32, 16, 12);
        helmGrd.addColorStop(0, "#ddd"); helmGrd.addColorStop(1, "#222");
        ctx.fillStyle = helmGrd;
        ctx.beginPath(); ctx.arc(32, 18, 10, 0, Math.PI * 2); ctx.fill();

        // Червоний плюмаж (як у Diablo)
        ctx.fillStyle = "#800000";
        ctx.beginPath(); ctx.moveTo(32, 8); ctx.quadraticCurveTo(40, 12, 38, 20); ctx.lineTo(32, 14); ctx.fill();

        // Плечі (Наплічники)
        ctx.fillStyle = armorGrd;
        ctx.beginPath(); ctx.arc(18, 24, 8, 0, Math.PI * 2); ctx.fill(); // Ліве
        ctx.beginPath(); ctx.arc(46, 24, 8, 0, Math.PI * 2); ctx.fill(); // Праве

        // Зброя (Меч у правій руці)
        ctx.fillStyle = "#ccc";
        ctx.beginPath(); ctx.moveTo(50, 25); ctx.lineTo(60, 10); ctx.lineTo(62, 12); ctx.lineTo(52, 28); ctx.fill();

        scene.textures.addCanvas(key, canvas);
    };

    drawHero('hero_base', 0); // Стоїть
    drawHero('hero_run1', 1); // Крок 1
    drawHero('hero_run2', 2); // Крок 2

    // 2. ДЕРЕВО (Висока темна сосна)
    const treeC = document.createElement('canvas');
    treeC.width = 64; treeC.height = 128;
    const tCtx = treeC.getContext('2d');

    // Стовбур
    tCtx.fillStyle = "#1a0f00"; tCtx.fillRect(28, 100, 8, 28);

    // Хвоя (Трикутники з градієнтом)
    let treeGrd = tCtx.createLinearGradient(0, 0, 64, 128);
    treeGrd.addColorStop(0, "#0d1f0d"); // Дуже темно-зелений (майже чорний)
    treeGrd.addColorStop(1, "#1a331a"); // Трохи світліший низ

    tCtx.fillStyle = treeGrd;
    // Нижні гілки
    tCtx.beginPath(); tCtx.moveTo(0, 100); tCtx.lineTo(32, 40); tCtx.lineTo(64, 100); tCtx.fill();
    // Середні гілки
    tCtx.beginPath(); tCtx.moveTo(8, 70); tCtx.lineTo(32, 20); tCtx.lineTo(56, 70); tCtx.fill();
    // Верхівка
    tCtx.beginPath(); tCtx.moveTo(16, 40); tCtx.lineTo(32, 0); tCtx.lineTo(48, 40); tCtx.fill();

    scene.textures.addCanvas('tree', treeC);

    // 3. КАМІНЬ (Ізометричний блок)
    const rockC = document.createElement('canvas');
    rockC.width = 48; rockC.height = 48;
    const rCtx = rockC.getContext('2d');
    
    let rockGrd = rCtx.createLinearGradient(0, 0, 48, 48);
    rockGrd.addColorStop(0, "#666"); rockGrd.addColorStop(1, "#222");
    rCtx.fillStyle = rockGrd;
    
    rCtx.beginPath();
    rCtx.moveTo(10, 40); rCtx.lineTo(5, 20); rCtx.lineTo(20, 5); rCtx.lineTo(40, 10);
    rCtx.lineTo(45, 30); rCtx.lineTo(30, 45); rCtx.fill();
    
    // Блік
    rCtx.fillStyle = "rgba(255,255,255,0.1)";
    rCtx.beginPath(); rCtx.moveTo(20, 5); rCtx.lineTo(40, 10); rCtx.lineTo(25, 20); rCtx.fill();

    scene.textures.addCanvas('rock', rockC);

    // 4. ЗЕМЛЯ (Темний ґрунт з текстурою)
    const groundC = document.createElement('canvas');
    groundC.width = 64; groundC.height = 64;
    const gCtx = groundC.getContext('2d');
    
    gCtx.fillStyle = "#110b05"; // Дуже темна коричнева
    gCtx.fillRect(0, 0, 64, 64);
    
    // Тріщини/Деталі
    gCtx.fillStyle = "#1a1109";
    for(let i=0; i<10; i++) {
        gCtx.fillRect(Math.random()*60, Math.random()*60, 4, 4);
    }
    scene.textures.addCanvas('ground', groundC);

    // 5. ВІНЄТКА (Темрява)
    const vigC = document.createElement('canvas');
    vigC.width = 512; vigC.height = 512;
    const vCtx = vigC.getContext('2d');
    const vGrd = vCtx.createRadialGradient(256, 256, 100, 256, 256, 350);
    vGrd.addColorStop(0, "rgba(0,0,0,0)");
    vGrd.addColorStop(1, "rgba(0,0,0,1)");
    vCtx.fillStyle = vGrd;
    vCtx.fillRect(0,0,512,512);
    scene.textures.addCanvas('vignette', vigC);
}
