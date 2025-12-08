(function () {
    'use strict';
    
    // --- КОНФІГУРАЦІЯ ---
    var API_KEY = '4dac8d33b5f9ef7b7c69d94b3f9cd56b'; // <--- ЗАМІНИТИ НА ВАШ КЛЮЧ
    var BASE_URL = 'https://api.themoviedb.org/3';
    var IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w300';
    
    // --- ОСНОВНИЙ КЛАС ПЛАГІНА ---
    function TmdbPlugin() {
        this.app = new Lampa.Component.Store('tmdb_popular_movies');
        this.component = this.app.render();
        this.wall = null;
        this.hasBuilt = false; 
    }

    // Метод для запиту даних з TMDB (на основі Lampa.Utils.request)
    TmdbPlugin.prototype.fetchMovies = function(callback) {
        var self = this;
        var URL_POPULAR = BASE_URL + '/movie/popular?api_key=' + API_KEY + '&language=uk-UA&page=1';
        
        Lampa.Utils.request({
            url: URL_POPULAR,
            
            callback: function(data) {
                var json = JSON.parse(data);
                if (!json.results) {
                    self.displayError('Помилка: Невірний формат даних.');
                    return callback([]);
                }
                
                var items = json.results.map(function(item) {
                    return {
                        id: item.id,
                        title: item.title,
                        poster: item.poster_path ? IMAGE_BASE_URL + item.poster_path : './img/no_poster.png',
                        movie: item
                    };
                });
                callback(items);
            },
            
            error: function(xhr, status) {
                console.error('TMDB Fetch Error:', status);
                self.displayError('Неможливо завантажити дані. Перевірте API-ключ або підключення.');
                callback([]);
            }
        });
    };

    // Метод для відображення помилки
    TmdbPlugin.prototype.displayError = function(message) {
        this.component.innerHTML = '<p style="padding: 2em; text-align: center; color: white;">' + message + '</p>';
    };

    // Обробка натискання на постер
    TmdbPlugin.prototype.onSelect = function(element) {
        var item_data = element.movie;
        Lampa.Component.Details.call(function(details) {
            details.render(item_data);
            Lampa.Controller.add('content', {
                selector: details.render(),
                onBack: function() {
                    details.destroy();
                    Lampa.Controller.toggle('content');
                }
            });
            Lampa.Controller.toggle('content');
        }, item_data);
    };

    // Побудова інтерфейсу після отримання даних
    TmdbPlugin.prototype.build = function(items) {
        var self = this;
        if (self.hasBuilt) return;

        self.component.appendChild(Lampa.Template.js('title', { title: 'Популярні фільми (TMDB)' }));
        
        if (items.length > 0) {
            self.wall = new Lampa.Component.PosterWall();
            self.wall.render({ items: items, auto_scroll: false, empty: true });
            self.wall.onSelect = self.onSelect;
            self.component.appendChild(self.wall.render());

            Lampa.Controller.add('content', {
                selector: self.component,
                link: self.wall.render(),
                onBack: function() {
                    Lampa.Controller.toggle('content');
                }
            });
            self.hasBuilt = true;
        }
    };
    
    // --- МЕТОДИ ЖИТТЄВОГО ЦИКЛУ ---
    // start() викликається при виборі плагіна з меню
    TmdbPlugin.prototype.start = function() {
        var self = this;
        
        // Починаємо завантаження даних, коли плагін обрано
        self.fetchMovies(function(items) {
            self.build(items);
            
            // Навігація
            Lampa.Controller.add('content', self.component);
            Lampa.Controller.toggle('content');
            
            if (self.wall) {
                Lampa.Controller.set(self.wall.render());
                self.wall.controller.focus();
            } else {
                Lampa.Controller.set(self.component);
            }
        });
    };

    TmdbPlugin.prototype.destroy = function() {
        if (this.wall) this.wall.destroy();
        this.app.destroy();
    };

    // --- РЕЄСТРАЦІЯ ---
    Lampa.Utils.add({
        name: 'TmdbPlugin',
        component: TmdbPlugin,
        type: 'all'
    });

})();
