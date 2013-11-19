var debug_browser;
(function($){
    debug_browser = {};
    debug_browser.max_entries = 5000;
    debug_browser.log = [];
    debug_browser.max_timestamps = 30;
    debug_browser.timestamps = [];
    
    debug_browser.upload = function() {
        var log = debug_browser.log; debug_browser.log = [];
        log.unshift('timestamps: ['+debug_browser.timestamps+']');
        
        var game_id = server.getGameIds() && server.getGameIds()[0];
        if (!game_id) return;
        
        $.post('/site/crashDump/', {
            content: log.join("\n"),
            game_id: game_id,
            hand_id: ~~server.tables[game_id].hand_serial // ~~ is the new +
        });
    };

    debug_browser.add_timestamp = function(send_time) {
        if (debug_browser.timestamps.push(send_time) > debug_browser.max_timestamps){
            debug_browser.timestamps.shift();
        }
    };

    debug_browser.mva = function(){
        if (!debug_browser.timestamps.length) {
            // We send a lot of packages right after we visit the table
            // so this case shouldn't give a false impression.
            return 0;
        }
        var sum = 0, len = 0;
        for (var i=0; i<debug_browser.timestamps.length; i++) {
            faktor = Math.pow(2, i);
            sum = sum + faktor * debug_browser.timestamps[i];
            len = len + faktor;
        }
        return sum / len;
    };

    debug_browser.mva_simple = function(){
    	if (!debug_browser.timestamps.length) {
            // We send a lot of packages right after we visit the table
            // so this case shouldn't give a false impression.
            return 0;
        }
        var sum = 0, len = 0;
        for (var i=0; i<debug_browser.timestamps.length; i++) {
            sum = sum + debug_browser.timestamps[i];
            ++len;
        }
        return sum / len;
    };

    debug_browser.get_connection_bars = function(){
        return ( Math.round((debug_browser.mva() / -400) + 5));
    };
})(jQuery);    
