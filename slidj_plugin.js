(function() {
    'use strict';
    
    // 1. Створюємо валідний, але порожній компонент
    class SlidjComponent {
        constructor() {
            // Ініціалізуємо компонент, але без вмісту
            this.app = new Lampa.Component.Store('slidj_app_store');
            this.component = this.app.render(); 
            this.component.innerHTML = ''; // Порожній вміст
        }
        
        render() { return this.component; }
        
        // Тут ми вимикаємо будь-яку дію, щоб сторінка не відкривалася
        start() { 
            Lampa.Noty.show('Slidj: Неклікабельна функція.');
            // Не викликаємо Lampa.Controller.add/toggle, щоб залишитися на поточному екрані
        }

        destroy() { this.app.destroy(); }
    }

    // 2. Реєстрація з валідним компонентом
    Lampa.Utils.add({
        name: 'Slidj',
        component: SlidjComponent, // <-- Використовуємо наш валідний клас
        type: 'all',
        
        // ВИДАЛЯЄМО onSelect, оскільки логіка перенесена у start()
        
        // Використовуємо просту вбудовану іконку, щоб уникнути помилок синтаксису
        icon: 'icon-tv' 
    });

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
