global.gameConfig = {
    width: window.innerWidth,
    height: window.innerHeight,
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

global.appManager             = require('./appManager');
global.ballsManager           = require('./ballsManager');
global.desktopControlsManager = require('./desktopControlsManager');
global.touchControlsManager   = require('./touchControlsManager');
global.hudManager             = require('./hudManager');
global.particlesManager       = require('./particlesManager');
global.physicsEngine          = require('./physicsEngine');
global.racketsManager         = require('./racketsManager');
global.socketsManager         = require('./socketsManager');
global.stageManager           = require('./stageManager');
global.syncManager            = require('./syncManager');


if ( window.location.protocol === "file:" ) {
	document.addEventListener("deviceready", onDeviceReady, false);
} else {
	appManager.init();
}

function onDeviceReady() {
	appManager.init();
}
