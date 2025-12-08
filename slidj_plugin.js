(function() {
    'use strict';

    // 1. Функція, яка виконується, коли користувач намагається натиснути на пункт
    function handleSlidjSelect() {
        // Виводимо повідомлення на екран Lampa
        Lampa.Noty.show('Slidj: Неклікабельний пункт.', true);
    }
    
    // 2. Функція-заглушка для компонента (максимальна сумісність ES5)
    // Це забезпечує, що Lampa отримає валідне посилання на компонент, а не "false", 
    // що іноді спричиняє Script Error.
    function SlidjComponent() {
        this.render = function() {
            var div = document.createElement('div');
            // Можемо вставити текст-заглушку, який видно, якщо пункт випадково відкриється
            div.innerHTML = '<h1 style="color:#FFF;">Slidj заглушка</h1>';
            return div;
        };
        
        // Перехоплюємо старт, щоб він не перемикав екран, і викликаємо onSelect
        this.start = handleSlidjSelect;
        
        this.destroy = function() {};
    }

    // 3. Реєстрація компонента в системі Lampa
    Lampa.Utils.add({
        name: 'Slidj',
        component: SlidjComponent, // Посилаємось на нашу функцію-заглушку
        type: 'all',
        
        // Іконка (використовуємо просту вбудовану іконку Lampa для безпеки)
        icon: 'icon-puzzle' 
    });

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
