(function() {
    'use strict';

    // Функція, яка викликається при натисканні (для тестових цілей)
    function handleSlidjSelect() {
        // Виводимо повідомлення на екран Lampa
        Lampa.Noty.show('Slidj: Функція заблокована (тільки для тесту).');
    }

    // Реєстрація компонента
    Lampa.Utils.add({
        name: 'Slidj',             // Назва
        
        // 1. КОМПОНЕНТ: Встановлюємо 'false' для неклікабельності
        component: false,          
        
        type: 'all',               
        
        // 2. ДІЯ: Викликаємо функцію при натисканні
        onSelect: handleSlidjSelect, 

        // 3. ІКОНКА: Використовуємо простіший текст-іконку (або вбудований клас)
        // Ми використовуємо вбудований клас 'icon-settings' як приклад:
        icon: 'icon-settings' 
        // АБО: можете використати HTML-символ (наприклад, "⚙️" або "🔒")
        // icon: '🔒' 
    });

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
