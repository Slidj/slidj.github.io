// Конфігурація Firebase (ваші персональні ключі)
const firebaseConfig = {
  apiKey: "AIzaSyClU5qdQSfPbNpcB5LcIniw7Bf4njKcDkg",
  authDomain: "mediahub-admin-b4378.firebaseapp.com",
  projectId: "mediahub-admin-b4378",
  storageBucket: "mediahub-admin-b4378.firebasestorage.app",
  messagingSenderId: "629828316030",
  appId: "1:629828316030:web:d6c5a20c65e5219b40e12f",
  measurementId: "G-S1992VQRKM",
  // URL вашої бази даних
  databaseURL: "https://mediahub-admin-b4378-default-rtdb.firebaseio.com"
};

// Ініціалізація Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/**
 * Функція ініціалізації адмін-системи
 */
export async function initAdminSystem() {
    // Отримуємо дані користувача з Telegram
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!user) {
        console.warn("Адмін-система: Запуск не через Telegram.");
        return;
    }

    // 1. РЕЄСТРАЦІЯ: Записуємо дані того, хто зайшов, у папку "users"
    const userRef = db.ref('users/' + user.id);
    userRef.update({
        id: user.id,
        first_name: user.first_name || '',
        username: user.username || '',
        last_visit: new Date().toISOString()
    });

    // 2. ТЕХРОБОТИ: Стежимо за налаштуваннями в реальному часі
    db.ref('settings').on('value', (snapshot) => {
        const settings = snapshot.val();
        if (!settings) return;

        const isMaintenance = settings.isMaintenance;
        const adminId = settings.adminId;

        // Показуємо екран техробіт, якщо активовано і користувач не адмін
        if (isMaintenance && user.id != adminId) {
            document.getElementById('maintenance_screen').style.display = 'flex';
        } else {
            document.getElementById('maintenance_screen').style.display = 'none';
        }

        // Позначаємо в системі, що ви — адміністратор
        if (user.id == adminId) {
            window.isAdmin = true;
            console.log("🔓 Ви увійшли як адміністратор");
        }
    });

    // 3. БАН: Перевіряємо, чи не заблокований цей конкретний ID
    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            document.getElementById('blocked_screen').style.display = 'flex';
        } else {
            document.getElementById('blocked_screen').style.display = 'none';
        }
    });
}
