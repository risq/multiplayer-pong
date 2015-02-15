var Scene = require( './class/Scene' );

var renderer,
    stage,
    scene,
    particlesContainer,
    stats,
    lastTime = 0,
    delta = 0,
    dec = new Vector2(),
    ratio = 1,
    background,
    checkDeltaInterval,
    startTime,
    emitter,
    inactive = false,
    isPaused = false;

function init() {

    // create an new instance of a pixi stage
    stage = new PIXI.Stage( 0x222222 );

    // create a renderer instance and append the view 
    renderer = PIXI.autoDetectRenderer( window.innerWidth, window.innerHeight, null, false, true );
    document.getElementById( 'game' ).appendChild( renderer.view );

    

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild( stats.domElement );

    background = new PIXI.Graphics();
    background.beginFill( 0x111111 );
    background.drawRect( 0, 0, window.innerWidth, window.innerHeight );
    stage.addChild( background );

    scene = new Scene( gameConfig.baseSceneWidth, gameConfig.baseSceneHeight );

    stage.addChild( scene );
    updateGameSize();

    window.onresize = updateGameSize;


    hudManager.init();
    racketsManager.init();
    physicsEngine.init();
    particlesManager.init();
    shadersManager.init();



    startTime = appManager.getStartTime();
    checkDeltaInterval = setInterval( checkDelta, gameConfig.checkDeltaIntervalTime );
    update();

}

function update( time ) {

    requestAnimFrame( update );

    if ( time ) {

        delta = ( time - lastTime ) * 0.001;
        lastTime = time;

        desktopControlsManager.update( delta );
        touchControlsManager.update( delta );
        physicsEngine.update( delta );
        particlesManager.update( delta );
        shadersManager.update( delta, time );

        stats.update();

        renderer.render( stage );

    }

}

// Manually update physics if requestAnimFrame not available (if tab inactive)
function checkDelta() {

    var tempTime = new Date() - startTime;
    // console.log('tempTime', tempTime);
    // console.log('lastTime', lastTime);

    if ( tempTime - lastTime >= gameConfig.checkDeltaIntervalTime ) {

        if ( !inactive ) {
            inactive = true;
            console.log( 'player is inactive' );
        }

    } else if ( inactive ) {

        inactive = false;
        console.log( 'player came back' );

    }
}

function updateGameSize() {

    gameConfig.width = window.innerWidth;
    gameConfig.height = window.innerHeight;

    renderer.resize( gameConfig.width, gameConfig.height );

    var ratioW = gameConfig.width / gameConfig.baseSceneWidth;
    var ratioH = gameConfig.height / gameConfig.baseSceneHeight;

    if ( ratioW < ratioH ) {

        ratio = ratioW;
        dec.x = 0;
        dec.y = ( gameConfig.height - gameConfig.baseSceneHeight * ratio ) / 2;

    } else {

        ratio = ratioH;
        dec.x = ( gameConfig.width - gameConfig.baseSceneWidth * ratio ) / 2;
        dec.y = 0;

    }

    scene.scale = new PIXI.Point( ratio, ratio );
    scene.x = dec.x;
    scene.y = dec.y;

    background.width = gameConfig.width;
    background.height = gameConfig.height;

    physicsEngine.updateSceneResizeValues( dec, ratio );

}

function globalToSceneLocalX( x ) {
    return ( x - dec.x ) / ratio;
}

function globalToSceneLocalY( y ) {
    return ( y - dec.y ) / ratio;
}

function sceneLocalToGlobalX( x ) {
    return ( x + dec.x ) * ratio;
}

function sceneLocalToGlobalY( y ) {
    return ( y + dec.y ) * ratio;
}

function getScene() {
    return scene;
}

function getStage() {
    return stage;
}

function getDec() {
    return dec;
}

function getRatio() {
    return ratio;
}

module.exports = {
    init: init,
    getScene: getScene,
    getStage: getStage,
    globalToSceneLocalX: globalToSceneLocalX,
    globalToSceneLocalY: globalToSceneLocalY,
    sceneLocalToGlobalX: sceneLocalToGlobalX,
    sceneLocalToGlobalY: sceneLocalToGlobalY,    
    getDec: getDec,
    getRatio: getRatio
};
