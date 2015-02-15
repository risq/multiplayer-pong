var startTime = new Date(),
    gameRoomID,
    playerIsHost,
    controlMode,
    state = 'waiting';

function init() {
	socketsManager.init();
}

function getStartTime() {
    return startTime;
}

function onConnectionReady(mode) {
    controlMode = mode;

	stageManager.init();

    if (controlMode === 'desktopOnly') {
        desktopControlsManager.init();
        touchControlsManager.init();
    }
}

function onGameReady(newGameRoomID, newGameIsHost) {
    gameRoomID = newGameRoomID;
    playerIsHost = newGameIsHost;
    state = 'ready';

    racketsManager.setPlayerSide(playerIsHost);
    racketsManager.resetRacketsPositions();

    physicsEngine.setRacketsSpeed(playerIsHost);

    if (playerIsHost) {
        ballsManager.createBalls(64, null, 650, 2000, 4);
    }
}

function onOpponentDisconnect() {
    state = 'waiting';
    ballsManager.removeAllBalls();
}

function getState() {
    return state;
}

function isHost() {
    return playerIsHost;
}

function getMode() {
    return controlMode;
}

module.exports =  {
	init: init,
    getStartTime: getStartTime,
    onConnectionReady: onConnectionReady,
    onGameReady: onGameReady,
    onOpponentDisconnect: onOpponentDisconnect,
    getState: getState,
    isHost: isHost,
    getMode: getMode
};
