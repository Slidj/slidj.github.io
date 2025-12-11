// Перевірка, чи завантажено Telegram Web App API
if (window.Telegram && window.Telegram.WebApp) {
    const WebApp = window.Telegram.WebApp;
    
    // Крок 2: Сповістити Telegram, що додаток готовий до показу.
    // Це приховує завантажувальний спіннер.
    WebApp.ready();
    
    // --- Отримання та відображення даних користувача ---
    
    let user_name = "Невідомий користувач";
    
    // WebApp.initDataUnsafe містить дані користувача, якщо вони доступні
    if (WebApp.initDataUnsafe && WebApp.initDataUnsafe.user) {
        const user = WebApp.initDataUnsafe.user;
        
        // Формування імені: використовуємо ім'я та прізвище, якщо вони є
        user_name = user.first_name;
        if (user.last_name) {
            user_name += ` ${user.last_name}`;
        }
        user_name += ` (ID: ${user.id})`;
    }

    // Оновлення елемента HTML
    document.getElementById('user_info').innerText = user_name;


    // --- Функція для надсилання даних боту ---

    // Крок 3: Функція, яка надсилає довільний рядок даних назад боту.
    function sendData() {
        const message = `Користувач ${user_name} натиснув кнопку.`;
        
        // Надсилання даних. Бот повинен бути налаштований на їх обробку.
        WebApp.sendData(message);
        
        // За бажанням, можна закрити Web App після відправки
        WebApp.close();
    }
    
    // Робимо функцію доступною глобально, щоб вона працювала з onclick
    window.sendData = sendData;

} else {
    // Це трапиться, якщо index.html відкрити не в Telegram
    document.getElementById('user_info').innerText = "Додаток відкрито поза Telegram. API недоступне.";
}
