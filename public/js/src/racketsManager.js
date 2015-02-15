var Racket = require('./class/Racket');


var playerSide = 'left',
    opponentSide = 'right',
    rackets = {
        left: null,
        right: null
    },
    margin = 30;

function init(scene) {

    rackets.left = new Racket();

    rackets.right = new Racket();

    resetRacketsPositions();

    stageManager.getScene().addRacket(rackets.left);
    stageManager.getScene().addRacket(rackets.right);
}

function resetRacketsPositions() {

    var centerY = stageManager.getScene().getCenter().y;

    rackets.left.x = margin;
    rackets.left.y = centerY;
    rackets.right.x = gameConfig.baseSceneWidth - margin;
    rackets.right.y = centerY;

    movePlayerRacketTo(centerY);
    moveOpponentRacketTo(centerY);

}

function setPlayerSide(isHost) {

    playerSide = isHost ? 'left' : 'right';
    opponentSide = isHost ? 'right' : 'left';

}

function movePlayerRacketTo(y, instant) {

    rackets[playerSide].setMovingToY(y);

    if (instant) {

        rackets[playerSide].y = (rackets[playerSide].y + y) * 0.5;

    }
}

function moveOpponentRacketTo(y, instant) {

    rackets[opponentSide].setMovingToY(y);

    if (instant) {

        rackets[opponentSide].y = (rackets[opponentSide].y + y) * 0.5;

    }
}

function movePlayerRacketBy(y) {

    movePlayerRacketTo(rackets[playerSide].y + y);

}

function getPlayerRacketY() {

    return rackets[playerSide].y;

}

function getOpponentRacketY() {

    return rackets[opponentSide].y;

}

function getPlayerRacketMovingToY() {

    return rackets[playerSide].movingToY;

}

function getLeftRacket() {

    return rackets.left;

}

function getRightRacket() {

    return rackets.right;

}

function getLeftRacketBoundsTopY() {

    return rackets.left.y - rackets.left.height / 2;

}

function getLeftRacketBoundsBottomY() {

    return rackets.left.y + rackets.left.height / 2;

}

function getLeftRacketBoundsLeftX() {

    return rackets.left.x - rackets.left.width / 2;

}

function getLeftRacketBoundsRightX() {

    return rackets.left.x + rackets.left.width / 2;

}

function getRightRacketBoundsTopY() {

    return rackets.right.y - rackets.right.height / 2;

}

function getRightRacketBoundsBottomY() {

    return rackets.right.y + rackets.right.height / 2;

}

function getRightRacketBoundsLeftX() {

    return rackets.right.x - rackets.right.width / 2;

}

function getRightRacketBoundsRightX() {

    return rackets.right.x + rackets.right.width / 2;

}

module.exports = {
    init: init,
    resetRacketsPositions: resetRacketsPositions,
    setPlayerSide: setPlayerSide,
    movePlayerRacketTo: movePlayerRacketTo,
    moveOpponentRacketTo: moveOpponentRacketTo,
    movePlayerRacketBy: movePlayerRacketBy,
    getPlayerRacketY: getPlayerRacketY,
    getOpponentRacketY: getOpponentRacketY,
    getPlayerRacketMovingToY: getPlayerRacketMovingToY,
    getLeftRacket: getLeftRacket,
    getRightRacket: getRightRacket,
    getLeftRacketBoundsTopY: getLeftRacketBoundsTopY,
    getLeftRacketBoundsLeftX: getLeftRacketBoundsLeftX,
    getLeftRacketBoundsBottomY: getLeftRacketBoundsBottomY,
    getLeftRacketBoundsRightX: getLeftRacketBoundsRightX,
    getRightRacketBoundsTopY: getRightRacketBoundsTopY,
    getRightRacketBoundsLeftX: getRightRacketBoundsLeftX,
    getRightRacketBoundsBottomY: getRightRacketBoundsBottomY,
    getRightRacketBoundsRightX: getRightRacketBoundsRightX
};
