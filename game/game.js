const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#050505',
    pixelArt: true, // Для спрайтів це важливо
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 150; // Трохи повільніше для реалізму
let trees, rocks;

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);

    // --- ЗАВАНТАЖЕННЯ СПРАЖНІХ КАРТИНОК ---
    
    // 1. Спрайт-лист Лицаря (Це одна картинка, де багато кадрів в ряд)
    // Розмір кадру 48x48 пікселів
    this.load.spritesheet('knight', 
        'https://labs.phaser.io/assets/sprites/metroid.png', // Тимчасово візьмемо цей спрайт для тесту анімації (він якісний)
        { frameWidth: 32, frameHeight: 48 }
    );

    // 2. Тайли для землі (Сет "Diablo Dungeon")
    this.load.image('tiles', 'https://labs.phaser.io/assets/tilemaps/tiles/catastrophi_tiles_16.png');
    
    // 3. Елементи оточення
    this.load.image('tree_tex', 'https://labs.phaser.io/assets/sprites/palm-tree-left.png'); 
}

function create() {
    // 1. АНІМАЦІЇ (Нарізаємо спрайт)
    // Біг (кадри 0, 1, 2, 3)
    this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('knight', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });
    // Стоїть (кадр 0)
    this.anims.create({
        key: 'idle',
        frames: [ { key: 'knight', frame: 0 } ],
        frameRate: 20
    });

    // 2. СВІТ (Темний камінь)
    const ground = this.add.tileSprite(0, 0, 2000, 2000, 'tiles', 1); // Вибираємо темний тайл
    ground.setScale(3);
    ground.setTint(0x666666); // Затемнюємо
    ground.setDepth(-100);
    this.physics.world.setBounds(0, 0, 2000, 2000);

    // 3. ДЕКОРАЦІЇ
    trees = this.physics.add.staticGroup();
    for (let i = 0; i < 40; i++) {
        let x = Phaser.Math.Between(100, 1900);
        let y = Phaser.Math.Between(100, 1900);
        // Використовуємо спрайт дерева, фарбуємо в темний колір
        let tree = this.add.image(x, y, 'tree_tex');
        tree.setScale(2);
        tree.setTint(0x444444); // Темне, мертве дерево
        tree.setDepth(y); // 2.5D ефект
        
        // Додаємо невидимий блок для колізії (щоб впиратися в стовбур)
        let stump = trees.create(x, y + 30, null); // пустий об'єкт
        stump.setVisible(false);
        stump.body.setSize(20, 10);
        stump.refreshBody();
    }

    // 4. ГЕРОЙ
    player = this.physics.add.sprite(500, 500, 'knight');
    player.setScale(3); // Збільшуємо
    player.setCollideWorldBounds(true);
    player.body.setSize(16, 16); // Колізія тільки ніг
    player.body.setOffset(8, 32);
    player.setDepth(500);

    // Додаємо йому просту тінь
    const shadow = this.add.ellipse(0, 0, 20, 10, 0x000000, 0.5);
    player.setData('shadow', shadow);

    // Камера
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.2);

    this.physics.add.collider(player, trees);

    // 5. ВІНЄТКА (Атмосфера)
    createVignette(this);

    // 6. ДЖОЙСТИК
    createJoystick(this);
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

    // Нормалізація діагоналі
    if (speedX !== 0 && speedY !== 0) { speedX *= 0.707; speedY *= 0.707; }

    player.body.setVelocity(speedX, speedY);

    // --- АНІМАЦІЯ ---
    if (speedX !== 0 || speedY !== 0) {
        player.anims.play('run', true);
        
        // Поворот спрайта
        if (speedX < 0) player.setFlipX(true);
        else if (speedX > 0) player.setFlipX(false);
    } else {
        player.anims.play('idle', true);
    }

    // Глибина і Тінь
    player.setDepth(player.y);
    const shadow = player.getData('shadow');
    shadow.setPosition(player.x, player.y + 45);
    shadow.setDepth(player.y - 1);
    // Тінь теж скейлимо, бо герой великий
    shadow.setScale(3);
}

// --- ДОПОМІЖНІ ФУНКЦІЇ ---

function createVignette(scene) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grd = ctx.createRadialGradient(256, 256, 100, 256, 256, 400);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = grd; ctx.fillRect(0,0,512,512);
    scene.textures.addCanvas('vignette', canvas);

    const v = scene.add.image(scene.cameras.main.centerX, scene.cameras.main.centerY, 'vignette');
    v.setDisplaySize(window.innerWidth, window.innerHeight);
    v.setScrollFactor(0).setDepth(10000).setAlpha(0.8);
}

function createJoystick(scene) {
    if (scene.plugins.get('rexvirtualjoystickplugin')) {
        joystick = scene.plugins.get('rexvirtualjoystickplugin').add(scene, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: scene.add.circle(0, 0, 50, 0x222222, 0.5).setStrokeStyle(2, 0x888888), 
            thumb: scene.add.circle(0, 0, 25, 0x555555, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        joystick.base.setDepth(20000); joystick.thumb.setDepth(20000);
    }
    cursorKeys = scene.input.keyboard.createCursorKeys();
}
