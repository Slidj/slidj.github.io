// js/data.js

// 1. НАЛАШТУВАННЯ ТОВАРІВ І МЕБЛІВ
const GAME_DATA = {
    items: [
        // ТЕХНІКА (Йде в кімнату)
        { 
            id: 'pc', 
            type: 'device', 
            name: 'iMac Pro', 
            price: 150, 
            icon: '🖥️', 
            desc: 'Для заробітку. Клікай щоб працювати.', 
            specs: [{t:'⚡ -10',c:'tag-red'}, {t:'💰 +20$',c:'tag-green'}],
            // Налаштування балансу
            energyCost: 10,
            moneyReward: 20,
            hpCost: 20
        },
        { 
            id: 'bed', 
            type: 'device', 
            name: 'Smart Bed', 
            price: 100, 
            icon: '🛏️', 
            desc: 'Відновлює сили. Клікай щоб спати.', 
            specs: [{t:'⚡ +30',c:'tag-green'}, {t:'⏳ 3с',c:'tag-blue'}],
            energyReward: 30,
            hpCost: 5
        },
        
        // ЇЖА (Йде в рюкзак)
        { 
            id: 'pizza', 
            type: 'food', 
            name: 'Pepperoni', 
            price: 20, 
            icon: '🍕', 
            desc: 'Дає енергію.', 
            specs: [{t:'⚡ +20',c:'tag-green'}, {t:'Термін 30с',c:'tag-orange'}],
            energyReward: 20,
            expireTime: 30000 // 30 секунд
        },
        { 
            id: 'sushi', 
            type: 'food', 
            name: 'Sushi', 
            price: 45, 
            icon: '🍣', 
            desc: 'Смачна риба.', 
            specs: [{t:'⚡ +35',c:'tag-green'}, {t:'Термін 15с',c:'tag-red'}],
            energyReward: 35,
            expireTime: 15000 // 15 секунд
        }
    ],

    // 2. ЛОКАЦІЇ НА МАПІ
    locations: [
        { id: 'shop_main', type: 'shop', name: 'iShop', top: 40, left: 20, icon: '🛒' },
        { id: 'bank_central', type: 'bank', name: 'Банк', top: 30, left: 70, icon: '🏦' },
        { id: 'office_1', type: 'work', name: 'Офіс', top: 70, left: 50, icon: '🏢' },
        // Додай сюди нову локацію, коли дізнаєшся координати
    ]
};
