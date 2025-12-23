const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#222',
    pixelArt: true, // Для PNG краще true
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 150;
let trees, rocks;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    // --- ЗАВАНТАЖУЄМО ТВОГО ГЕРОЯ ---
    // Увага: frameWidth і frameHeight мають співпадати з розміром клітинки в твоєму файлі.
    // Я поставив 64x64. Якщо герой виглядає обрізаним або "поїхав", спробуй змінити на 32 або 48.
    this.load.spritesheet('hero', 'assets/male_base.png', { 
        frameWidth: 64, 
        frameHeight: 64 
    });
}

function create() {
    // --- 1. АНІМАЦІЯ ---
    // Нам треба вгадати, які кадри відповідають за біг.
    // Зазвичай в таких файлах:
    // Ряд 1 (кадри 0-8) - Біг вгору
    // Ряд 2 (кадри 9-17) - Біг вліво
    // Ряд 3 (кадри 18-26) - Біг вниз
    // Ряд 4 (кадри 27-35) - Біг вправо
    
    // Створимо універсальну анімацію (беремо перші 4 кадри для тесту)
    this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNumbers('hero', { start: 0, end: 3 }), 
        frameRate: 8,
        repeat: -1
    });

    // 2. СВІТ (Генеруємо кодом, поки немає файлів для землі)
    createEnvironmentAssets(this);
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'ground').setOrigin(0);
    ground.setDepth(-1000);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 3. ДЕКОРАЦІЇ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    for (let i = 0; i < 50; i++) {
        let x = Phaser.Math.Between(100, 1900);
        let y = Phaser.Math.Between(100, 1900);
        let tree = trees.create(x, y, 'tree');
        tree.body.setSize(20, 10); tree.body.setOffset(22, 100); tree.setDepth(y);
    }
    for (let i = 0; i < 30; i++) {
        let rock = rocks.create(x, y, 'rock');
        rock.setDepth(y); rock.refreshBody();
    }

    // 4. ГЕРОЙ
    player = this.physics.add.sprite(500, 500, 'hero');
    player.setScale(1.5); // Масштаб
    player.setCollideWorldBounds(true);
    player.body.setSize(20, 20); // Колізія
    player.setDepth(500);

    this.cameras.main.startFollow(player);

    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 5. ДЖОЙСТИК
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5),
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

    // Анімація
    if (speedX !== 0 || speedY !== 0) {
        player.anims.play('walk', true);
        if (speedX < 0) player.setFlipX(true);
        else if (speedX > 0) player.setFlipX(false);
    } else {
        player.anims.stop();
        // player.setFrame(0); // Можна розкоментувати, щоб скидати кадр
    }

    player.setDepth(player.y);
}

// Генератор для дерев і землі (поки що)
function createEnvironmentAssets(scene) {
    const treeC = document.createElement('canvas');
    treeC.width = 64; treeC.height = 128;
    const tCtx = treeC.getContext('2d');
    tCtx.fillStyle = "#210"; tCtx.fillRect(28, 90, 8, 38); 
    tCtx.fillStyle = "#131"; 
    tCtx.beginPath(); tCtx.moveTo(0, 90); tCtx.lineTo(32, 30); tCtx.lineTo(64, 90); tCtx.fill();
    tCtx.beginPath(); tCtx.moveTo(8, 60); tCtx.lineTo(32, 10); tCtx.lineTo(56, 60); tCtx.fill();
    scene.textures.addCanvas('tree', treeC);

    const rockC = document.createElement('canvas');
    rockC.width = 48; rockC.height = 48;
    const rCtx = rockC.getContext('2d');
    rCtx.fillStyle = "#555";
    rCtx.beginPath(); rCtx.moveTo(10, 40); rCtx.lineTo(20, 5); rCtx.lineTo(40, 10); rCtx.lineTo(30, 45); rCtx.fill();
    scene.textures.addCanvas('rock', rockC);

    const groundC = document.createElement('canvas');
    groundC.width = 64; groundC.height = 64;
    const gCtx = groundC.getContext('2d');
    gCtx.fillStyle = "#222"; gCtx.fillRect(0, 0, 64, 64);
    scene.textures.addCanvas('ground', groundC);
}
