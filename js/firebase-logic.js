// Конфігурація Firebase з вашого проєкту
const firebaseConfig = {
  apiKey: "AIzaSyClU5qdQSfPbNpcB5LcIniw7Bf4njKcDkg",
  authDomain: "mediahub-admin-b4378.firebaseapp.com",
  projectId: "mediahub-admin-b4378",
  storageBucket: "mediahub-admin-b4378.firebasestorage.app",
  messagingSenderId: "629828316030",
  appId: "1:629828316030:web:d6c5a20c65e5219b40e12f",
  measurementId: "G-S1992VQRKM",
  // Додаємо URL бази даних (стандартний формат для Firebase)
  databaseURL: "https://mediahub-admin-b4378-default-rtdb.firebaseio.com"
};

// Ініціалізація Firebase (Compat версія)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/**
 * Ініціалізація адмін-системи: реєстрація користувача та перевірка статусів
 */
export async function initAdminSystem() {
    // Отримуємо дані користувача з Telegram
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!user) {
        console.warn("Адмін-система: Дані користувача Telegram недоступні.");
        return;
    }

    // 1. Реєструємо або оновлюємо дані користувача в базі
    const userRef = db.ref('users/' + user.id);
    userRef.update({
        id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        last_visit: new Date().toISOString(),
        platform: window.Telegram?.WebApp?.platform || 'unknown'
    });

    // 2. Слухаємо загальні налаштування (Тех. роботи та ID адміна)
    db.ref('settings').on('value', (snapshot) => {
        const settings = snapshot.val();
        if (!settings) return;

        const isMaintenance = settings.isMaintenance;
        const adminId = settings.adminId;

        // Якщо увімкнено тех. роботи і користувач НЕ є адміном
        if (isMaintenance && user.id != adminId) {
            document.getElementById('maintenance_screen').style.display = 'flex';
        } else {
            document.getElementById('maintenance_screen').style.display = 'none';
        }

        // Перевірка статусу адміна для поточної сесії
        if (user.id == adminId) {
            window.isAdmin = true;
            console.log("🔓 Режим адміністратора активовано");
        }
    });

    // 3. Слухаємо персональний статус блокування користувача
    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            document.getElementById('blocked_screen').style.display = 'flex';
        } else {
            document.getElementById('blocked_screen').style.display = 'none';
        }
    });
}
