G.physicsEngine = (function() {
    
	var currentDelta = 0,
		currentDec = new Vector2(),
		currentRatio = 1,
		safetyGapSize = 10,
		racketsMargin = 34,

		wallsBounds;

    function init() {
   		wallsBounds = new PIXI.Rectangle(
			0, 
			safetyGapSize * 0.5 * currentRatio, 
			(G.config.baseSceneWidth) * currentRatio,
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
		if (ball && ball.physics) {
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


		// Test top collision
		if (bounds.localY + ball.vel.y * currentDelta <= wallsBounds.y || 
			bounds.localY <= wallsBounds.y) {

			ball.y = wallsBounds.y + safetyGapSize / currentRatio;
			onBallCollideTop(ball);
		}

		// Test bottom collision
		else if (bounds.localY + bounds.height + ball.vel.y * currentDelta >= wallsBounds.y + wallsBounds.height || 
				 bounds.localY + bounds.height >= wallsBounds.y + wallsBounds.height) {

			ball.y = wallsBounds.y + (wallsBounds.height - ball.radius - safetyGapSize) / currentRatio;
			onBallCollideBottom(ball);
		}

		// If ball is not out of the game
		if (!ball.out) {

			// Test left collision
			if (bounds.x + ball.vel.x * currentDelta < G.racketsManager.getLeftRacketBoundsRightX() || 
				bounds.x <= G.racketsManager.getLeftRacketBoundsRightX()) {

				// If the ball touches left racket
				if (bounds.y + bounds.height > G.racketsManager.getLeftRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getLeftRacketBoundsBottomY()) {

					ball.x = (G.racketsManager.getLeftRacketBoundsRightX()- currentDec.x)  / currentRatio;
					onBallCollideLeft(ball);
				}
				else {
					G.ballsManager.onBallOut(ball);
				}
			}
			// Test right collision
			else if (bounds.x + bounds.width + ball.vel.x * currentDelta > G.racketsManager.getRightRacketBoundsLeftX() ||
					 bounds.x + bounds.width >= G.racketsManager.getRightRacketBoundsLeftX()) {

				// If the ball touches right racket
				if (bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

					ball.x = (G.racketsManager.getRightRacketBoundsLeftX() - currentDec.x - bounds.width) / currentRatio;
					onBallCollideRight(ball);
				}
				else {
					G.ballsManager.onBallOut(ball);
				}
			}
		}

		// If ball is out, test collision with top & bottom of rackets
		else {

			// Left racket
			if (bounds.x + ball.vel.x * currentDelta <= G.racketsManager.getLeftRacketBoundsRightX() &&
				bounds.x + bounds.width + ball.vel.x * currentDelta >= G.racketsManager.getLeftRacketBoundsLeftX() &&
				bounds.y + bounds.height > G.racketsManager.getLeftRacketBoundsTopY() && 
				bounds.y < G.racketsManager.getLeftRacketBoundsBottomY()) {

				if (ball.vel.y > 0) {
					onBallCollideTop(ball);
				}
				else {
					onBallCollideBottom(ball);
				}
			}

			// Right racket
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
			wallsBounds.y = safetyGapSize * 0.5 * currentRatio;
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