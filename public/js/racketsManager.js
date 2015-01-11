G.racketsManager = (function() {

    var rackets = {
        player: null,
        opponent: null
    };
    
    function init(scene) {
        rackets.player = new Racket(new Vector2(30, G.stageManager.getScene().getCenter().y));
    	rackets.opponent = new Racket(new Vector2(G.config.baseSceneWidth - 30, G.stageManager.getScene().getCenter().y));

        G.stageManager.getScene().addRacket(rackets.player);
        G.stageManager.getScene().addRacket(rackets.opponent);
    }

    function getLeftRacketBoundsTopY() {
        return rackets.player.getBounds().y;
    }

    function getLeftRacketBoundsBottomY() {
        return rackets.player.getBounds().y + rackets.player.getBounds().height;
    }

    function getLeftRacketBoundsLeftX() {
        return rackets.player.getBounds().x;
    }

    function getLeftRacketBoundsRightX() {
        return rackets.player.getBounds().x + rackets.player.getBounds().width;
    }

    function getRightRacketBoundsTopY() {
        return rackets.opponent.getBounds().y;
    }

    function getRightRacketBoundsBottomY() {
        return rackets.opponent.getBounds().y + rackets.opponent.getBounds().height;
    }

    function getRightRacketBoundsLeftX() {
        return rackets.opponent.getBounds().x;
    }

    function getRightRacketBoundsRightX() {
        return rackets.opponent.getBounds().x + rackets.opponent.getBounds().width;
    }

	return {
		init: init,
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