(function () {
    'use strict';
    
    // --- КОНФІГУРАЦІЯ ---
    const API_KEY = '4dac8d33b5f9ef7b7c69d94b3f9cd56b'; // <--- ЗАМІНИТИ НА ВАШ КЛЮЧ
    const BASE_URL = 'https://api.themoviedb.org/3';
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300';
    
    // --- ОСНОВНИЙ КЛАС ПЛАГІНА ---
    class TmdbPlugin {
        constructor() {
            // Ініціалізація компонентів Lampa та змінних
            this.app = new Lampa.Component.Store('tmdb_popular_movies');
            this.component = this.app.render();
            this.wall = null;
            this.hasBuilt = false; // Прапор, щоб будувати інтерфейс лише один раз
        }

        async fetchMovies() {
            const URL_POPULAR = `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=uk-UA&page=1`;
            try {
                const response = await fetch(URL_POPULAR);
                const data = await response.json();
                return data.results.map(item => ({
                    id: item.id,
                    title: item.title,
                    poster: item.poster_path ? IMAGE_BASE_URL + item.poster_path : './img/no_poster.png',
                    movie: item // Зберігаємо для сторінки деталей
                }));
            } catch (error) {
                console.error('TMDB Fetch Error:', error);
                // Додаємо повідомлення про помилку, якщо запит не вдався
                this.component.innerHTML += '<p style="padding: 2em; text-align: center; color: white;">Неможливо завантажити дані. Перевірте API-ключ або підключення.</p>';
                return [];
            }
        }

        onSelect(element) {
            // Обробка натискання на постер (відкриття деталей)
            const item_data = element.movie;
            Lampa.Component.Details.call((details) => {
                details.render(item_data);
                Lampa.Controller.add('content', {
                    selector: details.render(),
                    onBack: () => {
                        details.destroy();
                        Lampa.Controller.toggle('content');
                    }
                });
                Lampa.Controller.toggle('content');
            }, item_data);
        }

        async build() {
            if (this.hasBuilt) return; // Запобігаємо повторній побудові

            this.component.appendChild(Lampa.Template.js('title', { title: 'Популярні фільми (TMDB)' }));
            
            const items = await this.fetchMovies();
            
            if (items.length > 0) {
                this.wall = new Lampa.Component.PosterWall();
                this.wall.render({ items: items, auto_scroll: false, empty: true });
                this.wall.onSelect = (element) => this.onSelect(element);
                this.component.appendChild(this.wall.render());

                Lampa.Controller.add('content', {
                    selector: this.component,
                    link: this.wall.render(),
                    onBack: () => Lampa.Controller.toggle('content')
                });
                this.hasBuilt = true;
            }
        }
        
        // --- МЕТОДИ ЖИТТЄВОГО ЦИКЛУ ---
        start() {
            // ❗❗❗ Важливо: Викликаємо побудову (яка включає fetch) тут, коли плагін обрано
            this.build(); 
            
            Lampa.Controller.add('content', this.component);
            Lampa.Controller.toggle('content');
            if (this.wall) {
                Lampa.Controller.set(this.wall.render());
                this.wall.controller.focus();
            } else {
                Lampa.Controller.set(this.component); // Фокусуємо на собі, якщо немає постерів
            }
        }

        destroy() {
            if (this.wall) this.wall.destroy();
            this.app.destroy();
        }
    }

    // --- РЕЄСТРАЦІЯ (ЗАМІНЮЄ info.json) ---
    Lampa.Utils.add({
        name: 'TmdbPlugin',        // Ім'я, яке відобразиться в меню
        component: TmdbPlugin,     
        type: 'all'                
    });

})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
