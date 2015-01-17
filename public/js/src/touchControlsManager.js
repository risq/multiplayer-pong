var touch = -1,
    resetTimeout;


function init() {

    $( document ).on( 'touchstart', onTouchStart );
    $( document ).on( 'touchmove', onTouchMove );
    $( document ).on( 'touchend', onTouchEnd );

}

function update( delta ) {

    
}

function onTouchStart( event ) {

    clearTimeout(resetTimeout);
    touch = event.originalEvent.touches[0].clientY;

    console.log('touchstart');

}

function onTouchMove( event ) {

    var distance = gameConfig.height / (event.originalEvent.changedTouches[ 0 ].clientY - touch);
    console.log('touchmove', distance);

    racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 + gameConfig.baseSceneHeight * 2 / distance);

}

function onTouchEnd( event ) {

    touch = racketsManager.getPlayerRacketMovingToY;

    resetTimeout = setTimeout(function() {
        racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 );
    }, 150);

}


// function update( delta ) {

//     if ( touchStates.left && touchStates.right || !touchStates.left && !touchStates.right ) {

//         racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight * 0.5 );

//     } else if ( touchStates.left ) {

//         racketsManager.movePlayerRacketTo( gameConfig.baseSceneHeight );

//     } else if ( touchStates.right ) {

//         racketsManager.movePlayerRacketTo( 0 );

//     }
// }

// function onTouchStart( event ) {

//     for ( var i = event.originalEvent.touches.length - 1; i >= 0; i-- ) {

//         var side = event.originalEvent.touches[ i ].clientX < gameConfig.width / 2 ? 'left' : 'right';
//         touchStates[ side ] = true;
//         // console.log( side, touchStates[ side ], event.originalEvent.touches[ i ].clientX, gameConfig.width );

//     }

//     update();

// }

// function onTouchEnd( event ) {

//     var side = event.originalEvent.changedTouches[ 0 ].clientX < gameConfig.width / 2 ? 'left' : 'right';
//     touchStates[ side ] = false;
//     update();

// }

module.exports = {
    init: init,
    update: update
};
