G.config = {
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

G.appManager = (function() {

    var startTime = new Date(),
        gameRoomID,
        isHost,
        controlMode,
        state = 'waiting';
    
    function init() {
    	G.socketsManager.init();
    }

    function getStartTime() {
        return startTime;
    }
    
    function onConnectionReady(mode) {
        controlMode = mode;

    	G.stageManager.init();

        if (controlMode === 'desktopOnly') {
            G.desktopControlsManager.init();
        }
    }

    function onGameReady(newGameRoomID, newGameIsHost) {
        gameRoomID = newGameRoomID;
        isHost = newGameIsHost;
        state = 'ready';

        G.racketsManager.setPlayerSide(isHost);
        G.racketsManager.resetRacketsPositions();

        if (isHost) {
            G.ballsManager.createBalls(48, null, 650, 500, 4);
            // G.ballsManager.createBall({
            //     pos: new Vector2(60, 10), 
            //     vel: new Vector2(-40, 300)
            // });
        }
    }

    function onOpponentDisconnect() {
        state = 'waiting';
        G.ballsManager.removeAllBalls();
    }

    function getState() {
        return state;
    }

    function getIsHost() {
        return isHost;
    }

    function getMode() {
        return controlMode;
    }

    return {
    	init: init,
        getStartTime: getStartTime,
        onConnectionReady: onConnectionReady,
        onGameReady: onGameReady,
        onOpponentDisconnect: onOpponentDisconnect,
        getState: getState,
        getIsHost: getIsHost,
        getMode: getMode
    };

})();