(function() {
    'use strict';

    // 1. Клас нашого компонента
    class SimplePlayerApp {
        constructor() {
            // Використовуємо базовий компонент Lampa
            this.app = new Lampa.Component.Store('simple_player_app');
            this.component = this.app.render();
            
            // Встановлюємо простий вміст для відображення
            this.component.innerHTML = '<div style="padding: 30px; color: #fff;"><h1>Простий Плеєр (Тест)</h1><p>Цей текст лише для перевірки завантаження плагіна.</p></div>';

            // Налаштовуємо контролер, щоб дозволити вихід
            Lampa.Controller.add('content', {
                selector: this.component,
                onBack: () => {
                    Lampa.Controller.toggle('content');
                }
            });
        }
        
        // Метод для відображення
        render() {
            return this.component;
        }

        // Метод для початку роботи (викликається, коли його обирають)
        start() {
            Lampa.Controller.add('content', this.component);
            Lampa.Controller.toggle('content');
            // Фокус встановлюємо на себе, щоб працювала кнопка "Назад"
            Lampa.Controller.set(this.component);
        }

        // Метод для знищення
        destroy() {
            this.app.destroy();
        }
    }

    // 2. Реєстрація компонента в системі Lampa
    Lampa.Utils.add({
        name: 'TestPlayer',        // <--- Назва, що з'явиться в меню
        component: SimplePlayerApp,
        type: 'all',               // Додає в головний список (Додатки)
        
        // Іконка (просто використовуємо існуючу системну іконку)
        // Lampa має вбудовані іконки, наприклад, 'movie' або 'player'
        icon: '<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"><path d="M405.3,161.4c-6.8-6.8-17.9-6.8-24.8,0L256,285.9L131.5,161.4c-6.8-6.8-17.9-6.8-24.8,0s-6.8,17.9,0,24.8l124.5,124.5c6.8,6.8,17.9,6.8,24.8,0l124.5-124.5C412.1,179.3,412.1,168.2,405.3,161.4z M256,0C114.6,0,0,114.6,0,256s114.6,256,256,256s256-114.6,256-256S397.4,0,256,0z M256,482.7C130.6,482.7,31.3,383.4,31.3,256S130.6,29.3,256,29.3S480.7,128.6,480.7,256S381.4,482.7,256,482.7z"/></svg>'
    });
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
