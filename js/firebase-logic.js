// Конфігурація Firebase з вашого проєкту
const firebaseConfig = {
  apiKey: "AIzaSyClU5qdQSfPbNpcB5LcIniw7Bf4njKcDkg",
  authDomain: "mediahub-admin-b4378.firebaseapp.com",
  projectId: "mediahub-admin-b4378",
  storageBucket: "mediahub-admin-b4378.firebasestorage.app",
  messagingSenderId: "629828316030",
  appId: "1:629828316030:web:d6c5a20c65e5219b40e12f",
  measurementId: "G-S1992VQRKM",
  
  // 🔥 ВИПРАВЛЕНО: Ваша точна адреса бази даних
  databaseURL: "https://mediahub-admin-b4378-default-rtdb.europe-west1.firebasedatabase.app"
};

// Ініціалізація Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/**
 * Ініціалізація адмін-системи
 */
export async function initAdminSystem() {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!user) {
        console.warn("Адмін-система: Дані користувача Telegram недоступні.");
        return;
    }

    // 1. Реєструємо користувача
    const userRef = db.ref('users/' + user.id);
    userRef.update({
        id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
        last_visit: new Date().toISOString(),
        platform: window.Telegram?.WebApp?.platform || 'unknown'
    });

    // 2. Слухаємо тех. роботи та ID адміна
    db.ref('settings').on('value', (snapshot) => {
        const settings = snapshot.val();
        if (!settings) return;

        const isMaintenance = settings.isMaintenance;
        const adminId = settings.adminId;

        if (isMaintenance && user.id != adminId) {
            document.getElementById('maintenance_screen').style.display = 'flex';
        } else {
            document.getElementById('maintenance_screen').style.display = 'none';
        }

        if (user.id == adminId) {
            window.isAdmin = true;
            console.log("🔓 Режим адміністратора активовано");
        }
    });

    // 3. Слухаємо персональний бан
    db.ref('users/' + user.id + '/blocked').on('value', (snapshot) => {
        if (snapshot.val() === true) {
            document.getElementById('blocked_screen').style.display = 'flex';
        } else {
            document.getElementById('blocked_screen').style.display = 'none';
        }
    });
}
