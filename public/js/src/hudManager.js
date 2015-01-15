var Hud = require('./class/Hud');

var hud;

function init() {
	hud = new Hud();
    stageManager.getStage().addChild(hud);

    setDebug1Text('YOU:');
    setDebug2Text('HIM:');
}

function initStage() {
	console.log('initStage');
	stageManager.init();
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

module.exports = {
	init: init,
    setInfosText: setInfosText,
    setDebug1Text: setDebug1Text,
    setDebug2Text: setDebug2Text
};


