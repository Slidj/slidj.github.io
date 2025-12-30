// js/intro.js

document.addEventListener("DOMContentLoaded", () => {
    // 1. Створюємо HTML елементи програмно (Лого + Сканер)
    const loaderHTML = `
        <div id="intro-loader">
            <div class="intro-wrapper">
                <h1 class="netflix-title-splash">MEDIA-HUB</h1>
                <div class="cylon-track">
                    <div class="cylon-eye"></div>
                </div>
            </div>
        </div>
    `;
    
    // Вставляємо їх на самий початок body
    document.body.insertAdjacentHTML("afterbegin", loaderHTML);

    // 2. Логіка зникнення (таймер)
    const preloader = document.getElementById('intro-loader');
    
    if (preloader) {
        setTimeout(() => {
            preloader.style.opacity = '0';
            setTimeout(() => {
                preloader.style.display = 'none';
                preloader.style.visibility = 'hidden';
                // Видаляємо елемент з DOM повністю, щоб не займав пам'ять
                preloader.remove(); 
            }, 800);
        }, 3500);
    }
});
