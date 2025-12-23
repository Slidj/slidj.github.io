// --- НАЛАШТУВАННЯ ---
const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#000000', 
    pixelArt: true, // Піксельна чіткість
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// --- ЗМІННІ ---
let player;
let joystick;
let joyCursorKeys;
let cursorKeys;
let speed = 200;

let trees;
let rocks;
let inventory = { wood: 0, stone: 0 };
let inventoryText;

// Освітлення
let shadowLayer; // Чорний шар
let lightSprite; // Картинка світла

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    // 1. Генерація графіки
    createPixelTextures(this);

    // 2. СВІТ (Земля) - Глибина 0
    const grass = this.add.tileSprite(0, 0, 2000, 2000, 'grass').setOrigin(0);
    grass.setScale(4); 
    grass.setTint(0x666666); // Трохи затемнюємо траву
    grass.setDepth(0);

    this.physics.world.setBounds(0, 0, 2000 * 4, 2000 * 4);

    // 3. ОБ'ЄКТИ (Дерева/Каміння)
    trees = this.physics.add.staticGroup();
    rocks = this.physics.add.staticGroup();

    // Саджаємо ліс
    for (let i = 0; i < 50; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let tree = trees.create(x, y, 'tree');
        tree.setScale(4).refreshBody(); 
        tree.body.setSize(10, 8);
        tree.body.setOffset(3, 24);
        // Глибина виставляється в update(), але ставимо початкову
        tree.setDepth(y); 
    }

    for (let i = 0; i < 30; i++) {
        let x = Phaser.Math.Between(100, 2500);
        let y = Phaser.Math.Between(100, 2500);
        let rock = rocks.create(x, y, 'rock');
        rock.setScale(4).refreshBody();
        rock.body.setSize(14, 10);
        rock.body.setOffset(1, 6);
        rock.setDepth(y);
    }

    // 4. ГРАВЕЦЬ
    player = this.physics.add.sprite(500, 500, 'hero');
    player.setScale(4);
    player.setCollideWorldBounds(true);
    player.body.setSize(10, 8);
    player.body.setOffset(3, 24);
    player.setDepth(500); 

    // Камера
    this.cameras.main.setBounds(0, 0, 8000, 8000);
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.0);

    // Колізії
    this.physics.add.collider(player, trees);
    this.physics.add.collider(player, rocks);

    // --- 5. СИСТЕМА ОСВІТЛЕННЯ (Виправлена) ---
    // Створюємо текстуру розміром з ЕКРАН (не світ), яка їздить за камерою
    shadowLayer = this.add.renderTexture(0, 0, window.innerWidth, window.innerHeight);
    shadowLayer.setScrollFactor(0); // Приклеюємо до екрану
    shadowLayer.setDepth(10000); // Дуже високо, але нижче джойстика
    
    // Створюємо "пензлик" світла (не додаємо на сцену, просто тримаємо в пам'яті)
    lightSprite = this.make.image({ key: 'light', add: false });
    lightSprite.setScale(3); // Радіус світла

    // --- 6. ІНТЕРФЕЙС ТА ДЖОЙСТИК (Найвищий пріоритет) ---
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100,
            radius: 50,
            base: this.add.circle(0, 0, 50, 0x444444, 0.5),
            thumb: this.add.circle(0, 0, 25, 0x888888, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
        
        // ВАЖЛИВО: Піднімаємо джойстик над темрявою
        joystick.base.setDepth(20000);
        joystick.thumb.setDepth(20000);
    }
    cursorKeys = this.input.keyboard.createCursorKeys();

    inventoryText = this.add.text(20, 20, 'Wood: 0 | Stone: 0', {
        font: '20px monospace', fill: '#ffaa00', backgroundColor: '#000000', padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(20000); // Теж над темрявою

    // Кнопка дії
    const actionBtn = document.getElementById('action-btn');
    if(actionBtn) {
        // Змінюємо z-index кнопки через CSS, щоб вона була поверх канвасу
        actionBtn.style.zIndex = "30000"; 
        
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

    // 1. Сортування глибини (Ефект 2.5D)
    // Об'єкти нижче по екрану перекривають ті, що вище
    player.setDepth(player.y);

    // 2. Оновлення темряви
    // Заливаємо екран чорним (з прозорістю 0.95)
    shadowLayer.fill(0x000000, 0.95);
    
    // Малюємо світло по центру екрану (бо гравець завжди в центрі камери)
    // erase - режим стирання чорного кольору
    shadowLayer.erase(lightSprite, window.innerWidth / 2, window.innerHeight / 2);
}

function tryGatherResource() {
    let hitSomething = false;
    const scene = game.scene.scenes[0];

    // Ефект удару (світлий спалах)
    const slash = scene.add.circle(player.x, player.y, 40, 0xffffff, 0.8);
    slash.setDepth(20000); // Поверх темряви, щоб було видно удар
    scene.tweens.add({ targets: slash, alpha: 0, scale: 1.5, duration: 150, onComplete: () => slash.destroy() });

    scene.physics.overlap(player, trees, (player, tree) => {
        if (hitSomething) return;
        scene.tweens.add({ targets: tree, alpha: 0.5, duration: 100, yoyo: true });
        inventory.wood++;
        updateInventory();
        tree.destroy(); 
        hitSomething = true;
        showFloatingText(player.x, player.y, "+ Wood", '#00ff00');
    });

    if (!hitSomething) {
        scene.physics.overlap(player, rocks, (player, rock) => {
            if (hitSomething) return;
