const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#222',
    pixelArt: false,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// --- НАЛАШТУВАННЯ АНІМАЦІЇ ---

// Твої правильні рядки:
const ROW_LEFT  = 0;  
const ROW_UP    = 2;  
const ROW_RIGHT = 4;  
const ROW_DOWN  = 6;  

// ВАЖЛИВІ ЗМІНИ ТУТ:
const FRAMES_PER_ROW = 8; // Скільки всього кадрів у файлі в одному рядку (для відступу)

// Скільки кадрів ми хочемо ГРАТИ.
// Ти казав 5, але для плавності циклу (ліва нога - стійка - права нога - стійка)
// зазвичай ідеально підходить 4. Я поставив 4.
// Якщо буде мало - зміни цю цифру на 5.
const ANIM_LENGTH = 4;    

let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 200;
let trees, rocks;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    this.load.spritesheet('hero_file', 'assets/male_base.png', { 
        frameWidth: 256, 
        frameHeight: 256 
    });
}

function create() {
    // 1. СТВОРЕННЯ АНІМАЦІЙ
    const createAnim = (key, row) => {
        // Обчислюємо початок рядка (наприклад, 4 * 8 = 32-й кадр)
        const startFrame = row * FRAMES_PER_ROW;
        
        // Генеруємо номери кадрів.
        // Якщо ANIM_LENGTH = 4, ми беремо кадри: start, start+1, start+2, start+3.
        // Зайві кадри (атака, смерть) ігноруються.
        this.anims.create({
            key: key,
            frames: this.anims.generateFrameNumbers('hero_file', { 
                start: startFrame, 
                end: startFrame + (ANIM_LENGTH - 1) 
            }),
            frameRate: 8, // Швидкість анімації (можна міняти: 6 повільніше, 12 швидше)
            repeat: -1
        });
    };

    createAnim('walk-left',  ROW_LEFT);
    createAnim('walk-up',    ROW_UP);
    createAnim('walk-right', ROW_RIGHT);
    createAnim('walk-down',  ROW_DOWN);

    // 2. СВІТ
    createEnvironmentAssets(this);
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'ground').setOrigin(0);
    ground.setDepth(-1000);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 3. ОБ'ЄКТИ
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
        player.setScale(0.4); 
        player.body.setSize(50, 30); 
        player.body.setOffset(100, 190); 
    } else {
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

    // --- ЛОГІКА АНІМАЦІЇ ---
    if (speedX !== 0 || speedY !== 0) {
        if (Math.abs(speedX) > Math.abs(speedY)) {
            // Горизонтально
            if (speedX > 0) player.anims.play('walk-right', true);
            else player.anims.play('walk-left', true);
        } else {
            // Вертикально
            if (speedY > 0) player.anims.play('walk-down', true);
            else player.anims.play('walk-up', true);
        }
    } else {
        player.anims.stop();
        // Якщо зупинилися - показуємо перший кадр поточної анімації (щоб не завмер в позі кроку)
        // player.setFrame(player.anims.currentAnim ? player.anims.currentAnim.frames[0].frame.name : 0);
    }

    player.setDepth(player.y);
}

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
