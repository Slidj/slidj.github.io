const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#222',
    pixelArt: true, // Вмикаємо піксель-арт для чіткості
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
let lastDirection = 'down'; // Запам'ятовуємо, куди дивився герой

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    // Завантажуємо героя (256x256)
    this.load.spritesheet('hero_file', 'assets/male_base.png', { 
        frameWidth: 256, 
        frameHeight: 256 
    });
}

function create() {
    // 1. СТВОРЕННЯ АНІМАЦІЙ (Для 8 сторін)
    // У Flare спрайтах зазвичай 8 рядів по 4 кадри.
    // Порядок рядів: Південь, Південний Схід, Схід, Пн-Схід, Північ...
    
    // ВНИЗ (South) - Ряд 0 (кадри 0-3)
    this.anims.create({
        key: 'walk-down',
        frames: this.anims.generateFrameNumbers('hero_file', { start: 0, end: 3 }),
        frameRate: 8, repeat: -1
    });

    // ВПРАВО (East) - Ряд 2 (кадри 8-11)
    this.anims.create({
        key: 'walk-right',
        frames: this.anims.generateFrameNumbers('hero_file', { start: 8, end: 11 }),
        frameRate: 8, repeat: -1
    });

    // ВГОРУ (North) - Ряд 4 (кадри 16-19)
    this.anims.create({
        key: 'walk-up',
        frames: this.anims.generateFrameNumbers('hero_file', { start: 16, end: 19 }),
        frameRate: 8, repeat: -1
    });

    // ВЛІВО (West) - Ряд 6 (кадри 24-27)
    this.anims.create({
        key: 'walk-left',
        frames: this.anims.generateFrameNumbers('hero_file', { start: 24, end: 27 }),
        frameRate: 8, repeat: -1
    });

    // 2. СВІТ
    createEnvironmentAssets(this);
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'ground').setOrigin(0);
    ground.setDepth(-1000);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 3. ДЕКОРАЦІЇ
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    for (let i = 0; i < 40; i++) {
        let tree = trees.create(Phaser.Math.Between(100, 1900), Phaser.Math.Between(100, 1900), 'tree');
        tree.body.setSize(20, 10); tree.body.setOffset(22, 100); tree.setDepth(tree.y);
    }
    for (let i = 0; i < 20; i++) {
        let rock = rocks.create(Phaser.Math.Between(100, 1900), Phaser.Math.Between(100, 1900), 'rock');
        rock.setDepth(rock.y); rock.refreshBody();
    }

    // 4. ГЕРОЙ
    if (this.textures.exists('hero_file')) {
        player = this.physics.add.sprite(500, 500, 'hero_file');
        player.setScale(0.4); // Зменшуємо (бо 256px це багато)
        player.body.setSize(60, 40); // Колізія ніг
        player.body.setOffset(100, 180); 
    } else {
        // Якщо файл не завантажився - запасний квадрат
        player = this.add.rectangle(500, 500, 32, 32, 0xff0000);
        this.physics.add.existing(player);
    }

    player.setCollideWorldBounds(true);
    player.setDepth(500);
    this.cameras.main.startFollow(player);
    
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // 5. ДЖОЙСТИК
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

    // Зчитуємо джойстик
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

    // Нормалізація (щоб по діагоналі не біг швидше)
    if (speedX !== 0 && speedY !== 0) { speedX *= 0.707; speedY *= 0.707; }

    player.body.setVelocity(speedX, speedY);

    // --- ЛОГІКА АНІМАЦІЇ ---
    // Якщо рухаємось
    if (speedX !== 0 || speedY !== 0) {
        // Визначаємо пріоритетний напрямок
        if (Math.abs(speedX) > Math.abs(speedY)) {
            // Рух по горизонталі
            if (speedX > 0) {
                player.anims.play('walk-right', true);
                lastDirection = 'walk-right';
            } else {
                player.anims.play('walk-left', true);
                lastDirection = 'walk-left';
            }
        } else {
            // Рух по вертикалі
            if (speedY > 0) {
                player.anims.play('walk-down', true);
                lastDirection = 'walk-down';
            } else {
                player.anims.play('walk-up', true);
                lastDirection = 'walk-up';
            }
        }
    } else {
        // Якщо стоїмо - зупиняємо анімацію і показуємо перший кадр останнього напрямку
        player.anims.stop();
        // Можна додати idle-анімації, але поки просто зупинимо на поточному кадрі
    }

    // Z-Index (2.5D ефект)
    player.setDepth(player.y);
}

// Генератор середовища
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
    gCtx.fillStyle = "#2a2a2a"; gCtx.fillRect(0, 0, 64, 64);
    scene.textures.addCanvas('ground', groundC);
}
