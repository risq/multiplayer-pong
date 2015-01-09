G.appManager = (function() {
    var startTime = new Date();
    
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
        G.ballsManager.createBalls(16, null, 940, 50, 1);
    }

    function onOpponentDisconnect() {
        G.ballsManager.removeAllBalls();
    }

    return {
    	init: init,
        getStartTime: getStartTime,
        onGameReady: onGameReady,
        onOpponentDisconnect: onOpponentDisconnect
    };

})();