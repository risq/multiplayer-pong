G.racketsManager = (function() {

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

        G.stageManager.getScene().addRacket(rackets.left);
        G.stageManager.getScene().addRacket(rackets.right);
    }

    function resetRacketsPositions() {

        var centerY = G.stageManager.getScene().getCenter().y;

        rackets.left.x  = margin;
        rackets.left.y  = centerY;
        rackets.right.x = G.config.baseSceneWidth - margin; 
        rackets.right.y = centerY ;

        movePlayerRacketTo(centerY);
        moveOpponentRacketTo(centerY);
    }

    function setPlayerSide(isHost) {
        console.log('setPlayerSide');
        playerSide   = isHost ? 'left'  : 'right';
        opponentSide = isHost ? 'right' : 'left';
    }

    function movePlayerRacketTo(y) {
        if (y !== rackets[playerSide].movingToY) {
            G.syncManager.onRacketSetMovingToY(y);
            rackets[playerSide].setMovingToY(y);
        }
    }

    function moveOpponentRacketTo(y) {
        rackets[opponentSide].setMovingToY(y);
    }

    function movePlayerRacketBy(y) {
        movePlayerRacketTo(rackets[playerSide].y + y);
    }

    function getLeftRacket() {
        return rackets.left;
    }

    function getRightRacket() {
        return rackets.right;
    }

    function getLeftRacketBoundsTopY() {
        return rackets.left.getBounds().y;
    }

    function getLeftRacketBoundsBottomY() {
        return rackets.left.getBounds().y + rackets.left.getBounds().height;
    }

    function getLeftRacketBoundsLeftX() {
        return rackets.left.getBounds().x;
    }

    function getLeftRacketBoundsRightX() {
        return rackets.left.getBounds().x + rackets.left.getBounds().width;
    }

    function getRightRacketBoundsTopY() {
        return rackets.right.getBounds().y;
    }

    function getRightRacketBoundsBottomY() {
        return rackets.right.getBounds().y + rackets.right.getBounds().height;
    }

    function getRightRacketBoundsLeftX() {
        return rackets.right.getBounds().x;
    }

    function getRightRacketBoundsRightX() {
        return rackets.right.getBounds().x + rackets.right.getBounds().width;
    }

	return {
		init: init,
        resetRacketsPositions: resetRacketsPositions,
        setPlayerSide: setPlayerSide,
        movePlayerRacketTo: movePlayerRacketTo,
        moveOpponentRacketTo: moveOpponentRacketTo,
        movePlayerRacketBy: movePlayerRacketBy,
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
})();