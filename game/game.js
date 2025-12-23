const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#222',
    pixelArt: false, // Вимикаємо, бо картинка високої якості (256px)
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 200;
let trees, rocks;
let isUsingFile = false;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    // --- ЗАВАНТАЖЕННЯ ГЕРОЯ 256x256 ---
    // ВАЖЛИВО: Ми ставимо розмір 256, як в описі!
    this.load.spritesheet('hero_file', 'assets/male_base.png', { 
        frameWidth: 256, 
        frameHeight: 256 
    });

    this.load.on('loaderror', function (file) {
        console.log('Error loading file:', file.src);
    });
}

function create() {
    // 1. СВІТ
    createEnvironmentAssets(this);
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'ground').setOrigin(0);
    ground.setDepth(-1000);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 2. ДЕКОРАЦІЇ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();
    for (let i = 0; i < 50; i++) {
        let tree = trees.create(Phaser.Math.Between(100, 1900), Phaser.Math.Between(100, 1900), 'tree');
        tree.setScale(2); // Дерева теж трохи збільшимо
        tree.body.setSize(20, 10); tree.body.setOffset(22, 100); tree.setDepth(tree.y);
    }
    for (let i = 0; i < 30; i++) {
        let rock = rocks.create(Phaser.Math.Between(100, 1900), Phaser.Math.Between(100, 1900), 'rock');
        rock.setDepth(rock.y); rock.refreshBody();
    }

    // --- 3. НАЛАШТУВАННЯ ГЕРОЯ ---
    
    if (this.textures.exists('hero_file')) {
        isUsingFile = true;
        
        // Створюємо анімацію ходьби (перші 4 кадри)
        this.anims.create({
            key: 'walk',
            frames: this.anims.generateFrameNumbers('hero_file', { start: 0, end: 3 }), 
            frameRate: 6, // Швидкість анімації
            repeat: -1
        });
        
        player = this.physics.add.sprite(500, 500, 'hero_file');
        
        // МАСШТАБ: Зменшуємо його в 2 рази, бо 256px це забагато
        player.setScale(0.4); 
        
        // КОЛІЗІЯ: Налаштовуємо "коробку" тіла, бо в картинці 256x256 багато пустого місця
        // Методом "тику": центр знизу
        player.body.setSize(60, 40); 
        player.body.setOffset(100, 180); 
        
        this.add.text(10, 40, 'Hero 256px Loaded!', { fill: '#0f0', backgroundColor: '#000' }).setScrollFactor(0).setDepth(999999);
    } else {
        // ЗАПАСНИЙ ВАРІАНТ (якщо файл не знайдено)
        generateFallbackHero(this);
        player = this.physics.add.sprite(500, 500, 'fallback_hero');
        player.setScale(2);
        this.add.text(10, 40, 'Error: male_base.png not found', { fill: '#f00', backgroundColor: '#000' }).setScrollFactor(0).setDepth(999999);
    }

    player.setCollideWorldBounds(true);
    player.setDepth(500);
    this.cameras.main.startFollow(player);
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 4. ДЖОЙСТИК
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x444444, 0.5).setStrokeStyle(2, 0x888888),
            thumb: this.add.circle(0, 0, 25, 0xffffff, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        joystick.base.setDepth(999999); joystick.thumb.setDepth(999999);
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

    if (speedX !== 0 && speedY !== 0) { speedX *= 0.707; speedY *= 0.707; }

    player.body.setVelocity(speedX, speedY);

    if (speedX !== 0 || speedY !== 0) {
        // Якщо є анімація 'walk' - граємо її
        if(player.anims.exists('walk')) player.anims.play('walk', true);
        
        // Поворот (дзеркальний)
        if (speedX < 0) player.setFlipX(true);
        else if (speedX > 0) player.setFlipX(false);
    } else {
        player.anims.stop();
        if(isUsingFile) player.setFrame(0); 
    }
    player.setDepth(player.y);
}

// Генератор середовища (щоб не було темно)
function createEnvironmentAssets(scene) {
    const treeC = document.createElement('canvas'); treeC.width = 64; treeC.height = 128;
    const tCtx = treeC.getContext('2d');
    tCtx.fillStyle = "#210"; tCtx.fillRect(28, 90, 8, 38); 
    tCtx.fillStyle = "#131"; tCtx.beginPath(); tCtx.moveTo(0, 90); tCtx.lineTo(32, 30); tCtx.lineTo(64, 90); tCtx.fill();
    tCtx.beginPath(); tCtx.moveTo(8, 60); tCtx.lineTo(32, 10); tCtx.lineTo(56, 60); tCtx.fill();
    scene.textures.addCanvas('tree', treeC);

    const rockC = document.createElement('canvas'); rockC.width = 48; rockC.height = 48;
    const rCtx = rockC.getContext('2d');
    rCtx.fillStyle = "#555"; rCtx.beginPath(); rCtx.moveTo(10, 40); rCtx.lineTo(20, 5); rCtx.lineTo(40, 10); rCtx.lineTo(30, 45); rCtx.fill();
    scene.textures.addCanvas('rock', rockC);

    const groundC = document.createElement('canvas'); groundC.width = 64; groundC.height = 64;
    const gCtx = groundC.getContext('2d');
    gCtx.fillStyle = "#2a2a2a"; gCtx.fillRect(0, 0, 64, 64); // Темно-сіра
    scene.textures.addCanvas('ground', groundC);
}

function generateFallbackHero(scene) {
    // Заглушка, якщо файл не знайдено
    const frameW = 64; const frameH = 64;
    const canvas = document.createElement('canvas'); canvas.width = frameW * 4; canvas.height = frameH;
    const ctx = canvas.getContext('2d');
    const drawFrame = (offsetX) => {
        const cx = offsetX + 32;
        ctx.fillStyle = "#800"; ctx.fillRect(cx-10, 20, 20, 30);
        ctx.fillStyle = "#ddd"; ctx.beginPath(); ctx.arc(cx, 15, 10, 0, Math.PI*2); ctx.fill();
    };
    for(let i=0; i<4; i++) drawFrame(i*64);
    scene.textures.addCanvas('fallback_hero', canvas);
}
