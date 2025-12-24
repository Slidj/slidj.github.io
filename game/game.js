const tg = window.Telegram.WebApp;
tg.expand();

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#1a1a1a', // Темний фон за межами кімнати
    pixelArt: true, // ВАЖЛИВО ДЛЯ PIXEL ART
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

// --- ДАНІ СИМА ---
let stats = {
    energy: 100,
    hunger: 100,
    money: 50
};

// Змінні
let player;
let joystick, joyCursorKeys, cursorKeys;
let speed = 150;
let walls, furnitureGroup;
let activeZone = null; // Де зараз стоїть гравець

function preload() {
    this.load.plugin('rexvirtualjoystickplugin', 'https://cdn.jsdelivr.net/npm/phaser3-rex-plugins@1.1.57/dist/rexvirtualjoystickplugin.min.js', true);
}

function create() {
    // Експортуємо сцену в window, щоб HTML кнопка могла її викликати
    window.gameScene = this;

    // 1. ГЕНЕРУЄМО ГРАФІКУ (Тимчасова, в стилі піксель-арт)
    createPixelAssets(this);

    // 2. БУДУЄМО КІМНАТУ
    // Підлога (світле дерево)
    const floor = this.add.tileSprite(0, 0, 400, 400, 'floor').setOrigin(0);
    // Центруємо кімнату
    const roomX = (window.innerWidth - 400) / 2;
    const roomY = (window.innerHeight - 400) / 2;
    floor.setPosition(roomX, roomY);

    // Стіни
    walls = this.physics.add.staticGroup();
    // Верхня, Нижня, Ліва, Права
    walls.create(roomX + 200, roomY - 10, 'wall_h').refreshBody(); 
    walls.create(roomX + 200, roomY + 410, 'wall_h').refreshBody();
    walls.create(roomX - 10, roomY + 200, 'wall_v').refreshBody();
    walls.create(roomX + 410, roomY + 200, 'wall_v').refreshBody();

    // 3. МЕБЛІ (Інтерактивні зони)
    furnitureGroup = this.physics.add.staticGroup();

    // Ліжко (Спати)
    let bed = furnitureGroup.create(roomX + 60, roomY + 60, 'bed');
    bed.setData('type', 'bed'); bed.setData('text', '😴 Спати');

    // Холодильник (Їсти)
    let fridge = furnitureGroup.create(roomX + 340, roomY + 60, 'fridge');
    fridge.setData('type', 'fridge'); fridge.setData('text', '🍔 Їсти (10$)');

    // ПК (Працювати)
    let pc = furnitureGroup.create(roomX + 340, roomY + 300, 'pc');
    pc.setData('type', 'pc'); pc.setData('text', '💻 Працювати');

    // 4. ГРАВЕЦЬ
    player = this.physics.add.sprite(roomX + 200, roomY + 200, 'hero');
    player.setCollideWorldBounds(false); // Дозволяємо ходити по всій сцені, але стіни зупинять
    
    // Камера
    this.cameras.main.startFollow(player);
    this.cameras.main.setZoom(1.5); // Зумуємо, бо це піксель-арт

    // Колізії
    this.physics.add.collider(player, walls);
    this.physics.add.collider(player, furnitureGroup);

    // 5. ДЖОЙСТИК
    if (this.plugins.get('rexvirtualjoystickplugin')) {
        joystick = this.plugins.get('rexvirtualjoystickplugin').add(this, {
            x: 100, y: window.innerHeight - 100, radius: 50,
            base: this.add.circle(0, 0, 50, 0x888888, 0.5),
            thumb: this.add.circle(0, 0, 25, 0xffffff, 0.8),
            dir: '8dir', forceMin: 16, fixed: true
        });
        joyCursorKeys = joystick.createCursorKeys();
    }
    cursorKeys = this.input.keyboard.createCursorKeys();

    // 6. ТАЙМЕР ГОЛОДУ (Голод падає кожні 5 секунд)
    this.time.addEvent({
        delay: 5000, loop: true,
        callback: () => {
            stats.hunger = Math.max(0, stats.hunger - 2);
            updateHtml();
        }
    });

    updateHtml();
}

function update() {
    // Рух
    player.body.setVelocity(0);
    let speedX = 0, speedY = 0;

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

    player.body.setVelocity(speedX, speedY);

    // Перевірка взаємодії
    checkInteraction();
}

function checkInteraction() {
    let nearby = false;
    
    // Перевіряємо відстань до кожного меблевого об'єкту
    furnitureGroup.children.iterate((item) => {
        if (Phaser.Math.Distance.Between(player.x, player.y, item.x, item.y) < 60) {
            nearby = true;
            if (activeZone !== item) {
                activeZone = item;
                // Показуємо кнопку в HTML
                window.showButton(item.getData('text'), item.getData('type'));
            }
        }
    });

    if (!nearby && activeZone) {
        activeZone = null;
        window.hideButton();
    }
}

// Функція, яку викликає HTML кнопка
this.triggerAction = function(type) {
    if (type === 'bed') {
        // СПАТИ
        player.body.enable = false; // Блокуємо рух
        player.setAlpha(0.5);
        // Швидке відновлення
        setTimeout(() => {
            stats.energy = 100;
            player.body.enable = true;
            player.setAlpha(1);
            showFloatingText(player.x, player.y, "Виспався! ⚡", '#ffff00');
            updateHtml();
        }, 2000); // 2 секунди сну

    } else if (type === 'fridge') {
        // ЇСТИ
        if (stats.money >= 10) {
            stats.money -= 10;
            stats.hunger = Math.min(100, stats.hunger + 30);
            showFloatingText(player.x, player.y, "Ням-ням! 🍔", '#ff4444');
        } else {
            showFloatingText(player.x, player.y, "Мало грошей! 💸", '#888');
        }

    } else if (type === 'pc') {
        // ПРАЦЮВАТИ
        if (stats.energy >= 10) {
            stats.energy -= 10;
            stats.money += 15; // Зарплата
            showFloatingText(player.x, player.y, "Робота... +15$", '#00ff00');
        } else {
            showFloatingText(player.x, player.y, "Треба поспати! 😴", '#888');
        }
    }
    updateHtml();
};

function updateHtml() {
    if(window.updateStats) window.updateStats(stats.energy, stats.hunger, stats.money);
}

function showFloatingText(x, y, message, color) {
    let text = window.gameScene.add.text(x, y - 30, message, {
        font: '14px Arial', fill: color, stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5);
    window.gameScene.tweens.add({ targets: text, y: y - 60, alpha: 0, duration: 1000, onComplete: () => text.destroy() });
}

// --- ГЕНЕРАТОР ГРАФІКИ (SIMS STYLE) ---
function createPixelAssets(scene) {
    const make = (key, w, h, color, label) => {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        
        // Основний колір
        ctx.fillStyle = color; ctx.fillRect(0,0,w,h);
        // Обводка
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 4; ctx.strokeRect(0,0,w,h);
        
        // Деталі (щоб було схоже на меблі)
        if(key === 'bed') {
            ctx.fillStyle = "#fff"; ctx.fillRect(5, 5, w-10, 15); // Подушка
            ctx.fillStyle = "#ccddff"; ctx.fillRect(5, 25, w-10, h-30); // Ковдра
        }
        if(key === 'fridge') {
            ctx.fillStyle = "#ddd"; ctx.fillRect(5, 5, w-10, h/2-5); // Верхні двері
            ctx.fillRect(5, h/2+2, w-10, h/2-7); // Нижні
        }
        if(key === 'pc') {
            ctx.fillStyle = "#000"; ctx.fillRect(10, 5, w-20, h-20); // Монітор
            ctx.fillStyle = "#0f0"; ctx.fillRect(12, 7, w-24, h-24); // Екран
        }
        
        scene.textures.addCanvas(key, canvas);
    };

    make('hero', 24, 24, '#ffcc00'); // Жовтий чоловічок
    make('bed', 40, 60, '#8B4513');  // Ліжко
    make('fridge', 32, 50, '#eee');  // Холодильник
    make('pc', 40, 30, '#555');      // Стіл з ПК
    
    // Стіни і підлога
    make('wall_h', 420, 20, '#555');
    make('wall_v', 20, 420, '#555');
    
    const floorC = document.createElement('canvas'); floorC.width = 32; floorC.height = 32;
    const fCtx = floorC.getContext('2d');
    fCtx.fillStyle = "#d2b48c"; fCtx.fillRect(0,0,32,32); // Світлий беж
    fCtx.strokeStyle = "#c19a6b"; fCtx.strokeRect(0,0,32,32); // Плитка
    scene.textures.addCanvas('floor', floorC);
}
