// js/sounds.js

/**
 * Універсальна функція для відтворення звуків
 * @param {string} fileName - Назва файлу (наприклад, 'Click.wav')
 */
export function playSound(fileName) {
    // Шлях до папки зі звуками
    const audio = new Audio(`sounds/${fileName}`);
    
    // Скидаємо час на початок, щоб звук можна було відтворювати 
    // кілька разів поспіль без затримок
    audio.currentTime = 0; 
    
    // Встановлюємо гучність (0.5 - це 50%)
    audio.volume = 0.5;    

    // Відтворюємо звук
    audio.play().catch(error => {
        // Браузери часто блокують звук до першої взаємодії користувача з екраном
        console.warn(`Sound playback failed for ${fileName}:`, error);
    });
}
