G.config = {
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

G.appManager = (function() {

    var startTime = new Date(),
        gameRoomID,
        isHost,
        state = 'waiting';
    
    function init() {
    	G.socketsManager.init(onConnectionReady);
    }

    function onConnectionReady() {
    	G.stageManager.init();
    }

    function getStartTime() {
        return startTime;
    }

    function onGameReady(newGameRoomID, newGameIsHost) {
        gameRoomID = newGameRoomID;
        isHost = newGameIsHost;
        state = 'ready';

        if (isHost) {
            G.ballsManager.createBalls(16, null, 650, 50, 1);
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

    return {
    	init: init,
        getStartTime: getStartTime,
        onGameReady: onGameReady,
        onOpponentDisconnect: onOpponentDisconnect,
        getState: getState,
        getIsHost: getIsHost
    };

})();