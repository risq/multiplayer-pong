G.hudManager = (function() {

    var hud;
    
    function init() {
    	hud = new Hud();
        G.stageManager.getStage().addChild(hud);

        setDebug1Text('YOU:');
        setDebug2Text('HIM:');
    }

    function initStage() {
    	console.log('initStage');
    	G.stageManager.init();
    }

    function setInfosText(text) {
        hud.setInfosText(text);
    }

    function setDebug1Text(text) {
        hud.setDebug1Text(text);
    }

    function setDebug2Text(text) {
        hud.setDebug2Text(text);
    }

    return {
    	init: init,
        setInfosText: setInfosText,
        setDebug1Text: setDebug1Text,
        setDebug2Text: setDebug2Text
    };

})();
