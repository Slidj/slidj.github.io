// js/core.js

// 1. КОНФІГУРАЦІЯ
const firebaseConfig = {
  apiKey: "AIzaSyBApfHQizLRlYhILiq9_4m9WPyUKUEqtVI",
  authDomain: "lifeos-game.firebaseapp.com",
  databaseURL: "https://lifeos-game-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lifeos-game",
  storageBucket: "lifeos-game.firebasestorage.app",
  messagingSenderId: "347406442798",
  appId: "1:347406442798:web:54edee1509017485545abf",
  measurementId: "G-4KC3QSJG5H"
};

// Перевірка
if (typeof firebase === 'undefined') {
    alert("CRITICAL ERROR: Firebase SDK not loaded.");
} else {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

// 2. ГЛОБАЛЬНИЙ СТАН
let game = null;
let gameData = { items: [], locations: [] }; 
let userId = "test_user_local"; 
let isBusy = false;
let currentEditIndex = -1;

const DEFAULT_GAME_DATA = {
    items: [
        { id: 'pc', type: 'device', name: 'iMac Pro', price: 150, icon: '🖥️', desc: 'Заробіток.', specs: [{t:'⚡ -10',c:'tag-red'},{t:'💰 +20$',c:'tag-green'}], energyCost: 10, moneyReward: 20 },
        { id: 'pizza', type: 'food', name: 'Pepperoni', price: 20, icon: '🍕', desc: 'Енергія.', specs: [{t:'⚡ +20',c:'tag-green'}], energyReward: 20, expireTime: 30000 }
    ],
    locations: [
        { id: 'shop_main', type: 'shop', name: 'iShop', top: 40, left: 20, icon: '🛒' },
        { id: 'bank_central', type: 'bank', name: 'Банк', top: 30, left: 70, icon: '🏦' },
        { id: 'office_1', type: 'work', name: 'Офіс', top: 70, left: 50, icon: '🏢' }
    ]
};

// 3. ФУНКЦІЇ БАЗИ ДАНИХ
function save() {
    if (!game) return;
    db.ref('users/' + userId).update(game);
}

function checkAdminStatus() {
    db.ref('admins').once('value').then(snap => {
        if (!snap.exists()) {
            db.ref('admins/' + userId).set(true); // Перший вхід = Адмін
            document.querySelector('.admin-toggle').style.display = 'block';
        } else if (snap.child(userId).exists() && snap.child(userId).val() === true) {
            document.querySelector('.admin-toggle').style.display = 'block';
        }
    });
}
