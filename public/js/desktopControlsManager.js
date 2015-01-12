G.desktopControlsManager  = (function() {

    var startTime,
        gestures;
    
    function init() {
    	$(document).on('mousemove touchstart touchmove', onMouseMove);
        gestures = new Hammer.Manager(document.getElementById('game'));
        gestures.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_VERTICAL }));

        gestures.on('swipe', onSwipe);
    }

    function onMouseMove(event) {
        var y = event.pageY || event.originalEvent.touches && event.originalEvent.touches[0].pageY;
        G.racketsManager.movePlayerRacketTo((y - G.stageManager.getDec().y) / G.stageManager.getRatio());
    }

    function onSwipe(event) {
        console.log(event);
        setTimeout(function() {
            G.racketsManager.movePlayerRacketBy((event.deltaY * Math.abs(event.velocity) * 0.5 - G.stageManager.getDec().y) / G.stageManager.getRatio());
        }, 20);
    }

    return {
    	init: init
    };

})();