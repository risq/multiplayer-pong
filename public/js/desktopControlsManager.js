G.desktopControlsManager  = (function() {

    var startTime;
    
    function init() {
    	console.log('desktopControlsManager init');
    	$(document).on('mousemove touchstart touchmove', onMouseMove);
    }

    function onMouseMove(event) {
    	var y = event.pageY || event.originalEvent.touches[0].pageY;
    	G.racketsManager.movePlayerRacketTo((y - G.stageManager.getDec().y) / G.stageManager.getRatio());
    }

    return {
    	init: init
    };

})();