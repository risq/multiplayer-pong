var startTime,
    gestures,
    mouseY = 0,
    lastMouseY = 0,
    mouseStopTime = -1,
    lastSentY = 0;


function init() {

    $( document ).on( 'mousemove', onMouseMove );

}

function update( delta ) {

    // automatically send sync of exact position after mouse stop 0.1s 
    if ( mouseStopTime > 0.1 ) {

        sendSyncPosition( lastMouseY, true );
        mouseStopTime = -1;

    } else if ( lastMouseY === mouseY && mouseStopTime >= 0 ) {

        mouseStopTime += delta;

    } else if ( lastMouseY !== mouseY ) {

        // sync mouse position if moved by more than 24px (local)
        if ( Math.abs( lastSentY - stageManager.globalToSceneLocalY( mouseY ) ) > 24 ) {

            sendSyncPosition( mouseY, false );

        }
    }

    lastMouseY = mouseY;

}

function sendSyncPosition( y, instant ) {

    lastSentY = racketsManager.getPlayerRacketMovingToY();
    syncManager.onRacketSetMovingToY( lastSentY, instant );

}

function onMouseMove( event ) {

    mouseY = event.pageY || event.originalEvent.touches && event.originalEvent.touches[ 0 ].pageY;
    
    if (mouseY !== undefined) {

        racketsManager.movePlayerRacketTo( stageManager.globalToSceneLocalY( mouseY ), false );
        mouseStopTime = 0;
        
    }
}

module.exports = {
    init: init,
    update: update
};
