(function() {
    'use strict';

    // 1. Створюємо фіктивну функцію для нашого плагіна
    function TestPushApp() {
        // Тут має бути вся логіка, але ми її пропускаємо
        return {
            render: function() { 
                const div = document.createElement('div');
                div.innerHTML = '<h1 style="color:white; padding: 50px;">Push Test Active</h1>';
                return div;
            },
            start: function() { 
                Lampa.Controller.toggle('content');
            },
            destroy: function() {}
        };
    }

    // 2. Створення об'єкта плагіна з метаданими
    const plugin_data = {
        name: 'TestPush',         // <--- НОВА НАЗВА
        component: TestPushApp,
        type: 'all',
        icon: '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256,0C114.6,0,0,114.6,0,256s114.6,256,256,256s256-114.6,256-256S397.4,0,256,0z M256,482.7C130.6,482.7,31.3,383.4,31.3,256S130.6,29.3,256,29.3S480.7,128.6,480.7,256S381.4,482.7,256,482.7z"/></svg>'
    };

    // 3. Спроба інтеграції через Lampa.App.push
    if (Lampa.App) {
        Lampa.App.push(plugin_data);
    } else {
        // Якщо push не спрацював, повертаємося до класичної реєстрації як запасний варіант
        Lampa.Utils.add(plugin_data);
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
