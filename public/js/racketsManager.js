G.racketsManager = (function() {

    var rackets = {
        player: null,
        opponent: null
    };
    
    function init(scene) {
        rackets.player = new Racket(new Vector2(0, G.stageManager.getScene().getCenter().y));
    	rackets.opponent = new Racket(new Vector2(G.config.baseSceneWidth, G.stageManager.getScene().getCenter().y));

        G.stageManager.getScene().addChild(rackets.player);
        G.stageManager.getScene().addChild(rackets.opponent);
    }

    function getLeftRacketBoundsTopY() {
        console.log(rackets.player.getBounds().y);
        return rackets.player.getBounds().y;
    }

    function getLeftRacketBoundsBottomY() {
        return rackets.player.getBounds().y + rackets.player.getBounds().height;
    }

    function getRightRacketBoundsTopY() {
        return rackets.opponent.getBounds().y;
    }

    function getRightRacketBoundsBottomY() {
        return rackets.opponent.getBounds().y + rackets.opponent.getBounds().height;
    }

	return {
		init: init,
        getLeftRacketBoundsTopY: getLeftRacketBoundsTopY,
        getLeftRacketBoundsBottomY: getLeftRacketBoundsBottomY,
        getRightRacketBoundsTopY: getRightRacketBoundsTopY,
        getRightRacketBoundsBottomY: getRightRacketBoundsBottomY
	};
})();