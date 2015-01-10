G.physicsEngine = (function() {
    
	var currentDelta = 0,
		currentDec = new Vector2(),
		currentRatio = 1,
		safetyGapSize = 10,
		racketsMargin = 34,

		wallsBounds;

    function init() {
   		wallsBounds = new PIXI.Rectangle(
			racketsMargin * currentRatio, 
			safetyGapSize * 0.5 * currentRatio, 
			(G.config.baseSceneWidth -  2 * racketsMargin) * currentRatio,
			(G.config.baseSceneHeight - safetyGapSize * 0.5) * currentRatio);
    }

    function update(delta) {
    	currentDelta = delta;

    	if (currentDelta) {
	    	G.ballsManager.getBalls().forEach(updateBall);
	    }
    }

    function setVel(object, vel) {
		object.vel.copy(vel);
	}

	function addVel(object, vel) {
		object.vel.addSelf(vel);
	}

	function updateBall(ball, index) {
		if (ball) {
			checkBallCollision(ball)
			updateObjectPos(ball);
		}
	}

	function updateObjectPos(object) {
		object.x = object.x + object.vel.x * currentDelta;
		object.y = object.y + object.vel.y * currentDelta;
	}

	function checkBallCollision(ball) {
		var bounds = ball.getBounds();
		bounds.localX = bounds.x - G.stageManager.getDec().x;
		bounds.localY = bounds.y - G.stageManager.getDec().y;
		// bounds.scaledWidth  = bounds.width  * currentRatio;
		// bounds.scaledHeight = bounds.height * currentRatio;

		if (bounds.localY + ball.vel.y * currentDelta <= wallsBounds.y || 
			bounds.localY <= wallsBounds.y) {

			//DEBUG console.log('onBallCollideTop', ball.x, ball.y);
			ball.y = wallsBounds.y + safetyGapSize / currentRatio;
			//DEBUG console.log('new values:', ball.x, ball.y);
			onBallCollideTop(ball);
		}
		else if (bounds.localY + bounds.height + ball.vel.y * currentDelta >= wallsBounds.y + wallsBounds.height || 
				 bounds.localY + bounds.height >= wallsBounds.y + wallsBounds.height) {

			//DEBUG console.log('onBallCollideBottom', ball.x, ball.y);
			ball.y = wallsBounds.y + (wallsBounds.height * 1/currentRatio) - ball.radius - safetyGapSize / currentRatio;
			//DEBUG console.log('new values:', ball.x, ball.y);
			onBallCollideBottom(ball);
		}
		if (!ball.out) {
			if (bounds.x + ball.vel.x * currentDelta < G.racketsManager.getLeftRacketBoundsRightX() || 
				bounds.x <= G.racketsManager.getLeftRacketBoundsRightX()) {

				if (bounds.y + bounds.height > G.racketsManager.getLeftRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getLeftRacketBoundsBottomY()) {

					ball.x = (G.racketsManager.getLeftRacketBoundsRightX()- currentDec.x)  / currentRatio;
					//DEBUG console.log('new values:', ball.x, ball.y);
					onBallCollideLeft(ball);
				}
				else {
					G.ballsManager.onBallOut(ball);
				}

			}
			else if (bounds.x + bounds.width + ball.vel.x * currentDelta > G.racketsManager.getRightRacketBoundsLeftX() ||
					 bounds.x + bounds.width >= G.racketsManager.getRightRacketBoundsLeftX()) {

				if (bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

					// console.log('onBallCollideRight', ball.x, ball.y);
					ball.x = (G.racketsManager.getRightRacketBoundsLeftX() - currentDec.x - bounds.width) / currentRatio;
					// console.log('new values:', ball.x, ball.y);
					onBallCollideRight(ball);
				}
				else {
					G.ballsManager.onBallOut(ball);
				}
			}
		}
		else {
			if (bounds.x + ball.vel.x * currentDelta <= G.racketsManager.getLeftRacketBoundsRightX() &&
				bounds.x + bounds.width + ball.vel.x * currentDelta >= G.racketsManager.getLeftRacketBoundsLeftX() &&
				bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() && 
				bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

				if (ball.vel.y > 0) {
					onBallCollideTop(ball);
				}
				else {
					onBallCollideBottom(ball);
				}
			}
			else if (bounds.x + ball.vel.x * currentDelta <= G.racketsManager.getRightRacketBoundsRightX() &&
				bounds.x + bounds.width + ball.vel.x * currentDelta >= G.racketsManager.getRightRacketBoundsLeftX() &&
				bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() && 
				bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

				if (ball.vel.y > 0) {
					onBallCollideTop(ball);
				}
				else {
					onBallCollideBottom(ball);
				}
			}
		}
	}

	function checkBallOutCollision(ball) {

	}

	function onBallCollideTop(ball) {
		ball.vel.y = -ball.vel.y;
		G.syncManager.onUpdateBall(ball);
	}

	function onBallCollideBottom(ball) {
		ball.vel.y = -ball.vel.y;
		G.syncManager.onUpdateBall(ball);
	}

	function onBallCollideLeft(ball) {
		ball.vel.x = -ball.vel.x;
		G.syncManager.onUpdateBall(ball);
	}

	function onBallCollideRight(ball) {
		ball.vel.x = -ball.vel.x;
		G.syncManager.onUpdateBall(ball);
	}

	function updateSceneResizeValues(dec, ratio) {
		currentDec = dec;
		currentRatio = ratio;

		if (wallsBounds) {
			wallsBounds.x = racketsMargin * currentRatio;
			wallsBounds.y = safetyGapSize * 0.5 * currentRatio;
			wallsBounds.width  = G.config.baseSceneWidth * currentRatio;
			wallsBounds.height = G.config.baseSceneHeight * currentRatio;
		}
	}

	return {
		init: init,
		update: update,
		setVel: setVel,
		addVel: addVel,
		updateSceneResizeValues: updateSceneResizeValues
	};
})();