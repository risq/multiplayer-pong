var startTime,
    gestures;

function init() {
	$(document).on('mousemove touchstart touchmove', onMouseMove);
    // gestures = new Hammer.Manager(document.getElementById('game'));
    // gestures.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_VERTICAL }));

    // gestures.on('swipe', onSwipe);
}

function onMouseMove(event) {
    var y = event.pageY || event.originalEvent.touches && event.originalEvent.touches[0].pageY;
    racketsManager.movePlayerRacketTo((y - stageManager.getDec().y) / stageManager.getRatio());
}

function onSwipe(event) {
    console.log(event);
    setTimeout(function() {
        racketsManager.movePlayerRacketBy((event.deltaY * Math.abs(event.velocity) * 0.5 - stageManager.getDec().y) / stageManager.getRatio());
    }, 20);
}

module.exports = {
	init: init
};
