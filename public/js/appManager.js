G.config = {
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

G.appManager = (function() {

    var startTime = new Date();
    var state = 'waiting';
    
    function init() {
    	G.socketsManager.init(initStage);
    }

    function initStage() {
    	G.stageManager.init();
    }

    function getStartTime() {
        return startTime;
    }

    function onGameReady() {
        console.log('game ready');
        state = 'ready';
        G.ballsManager.createBalls(76, null, 500, 10, 4);
    }

    function onOpponentDisconnect() {
        state = 'waiting';
        G.ballsManager.removeAllBalls();
    }

    function getState() {
        return state;
    }

    return {
    	init: init,
        getStartTime: getStartTime,
        onGameReady: onGameReady,
        onOpponentDisconnect: onOpponentDisconnect,
        getState: getState
    };

})();