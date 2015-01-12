G.physicsEngine = (function() {
    
	var currentDelta = 0,
		currentDec = new Vector2(),
		currentRatio = 1,
		safetyGapSize = 6,
		racketsMargin = 34,

		wallsBounds;

    function init() {
   		wallsBounds = new PIXI.Rectangle(
			0, 
			0, 
			G.config.baseSceneWidth * currentRatio,
			G.config.baseSceneHeight * currentRatio);
    }

    function update(delta) {
    	currentDelta = delta;

    	if (currentDelta) {
    		updateRackets();
    		updateBalls();
	    }
    }

    function setVel(object, vel) {
		object.vel.copy(vel);
	}

	function addVel(object, vel) {
		object.vel.addSelf(vel);
	}

	function updateRackets() {
		updateRacket(G.racketsManager.getLeftRacket());
		updateRacket(G.racketsManager.getRightRacket());
	}

	function updateRacket(racket) {
		if (Math.abs(racket.y - racket.movingToY) > 1) {
			racket.y += (racket.movingToY - racket.y)  * 15 * currentDelta; 
		}
		else {
			racket.y = racket.movingToY;
		}
	}

	function updateBalls() {
		G.ballsManager.getBalls().forEach(updateBall);
	}

	function updateBall(ball, index) {
		if (ball && ball.physics) {
			if (ball.vel.x >= -50 && ball.vel.x <= 50) {
				ball.vel.x = ball.vel.x + ball.vel.x * 0.1;
			}
			checkBallCollision(ball);
			updateObjectPos(ball);
			applyMagnetForce(ball);
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

			ball.y = wallsBounds.y / currentRatio + safetyGapSize;
			if (ball.out) {
				G.ballsManager.onBallOutDestroy(ball);
			}
			else {
				onBallCollideTop(ball);
			}
		}

		// Test bottom collision
		else if (bounds.localY + bounds.height + ball.vel.y * currentDelta >= wallsBounds.y + wallsBounds.height || 
				 bounds.localY + bounds.height >= wallsBounds.y + wallsBounds.height) {

			ball.y = wallsBounds.y / currentRatio - ball.radius - safetyGapSize + wallsBounds.height / currentRatio;
			if (ball.out) {
				G.ballsManager.onBallOutDestroy(ball);
			}
			else {
				onBallCollideBottom(ball);
			}
		}

		// If ball is not out of the game
		if (!ball.out) {

			// Test left collision
			if (bounds.x + (ball.vel.x * currentDelta) * currentRatio < G.racketsManager.getLeftRacketBoundsRightX()) {

				// If the ball touches left racket
				if (bounds.y + bounds.height > G.racketsManager.getLeftRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getLeftRacketBoundsBottomY()) {

					ball.x = (G.racketsManager.getLeftRacketBoundsRightX() - currentDec.x) / currentRatio;
					onBallCollideLeft(ball);				
				}
				else if (bounds.x < G.racketsManager.getLeftRacketBoundsLeftX()) {
					G.ballsManager.onBallOut(ball);
				}
			}
			// Test right collision
			else if (bounds.x + bounds.width + (ball.vel.x * currentDelta) * currentRatio > G.racketsManager.getRightRacketBoundsLeftX()) {

				// If the ball touches right racket
				if (bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() &&
					bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

					ball.x = (G.racketsManager.getRightRacketBoundsLeftX() - currentDec.x - bounds.width) / currentRatio;
					onBallCollideRight(ball);
				}
				else if (bounds.x + bounds.width > G.racketsManager.getRightRacketBoundsLeftX()) {
					G.ballsManager.onBallOut(ball);
				}
			}
		}

		// If ball is out, test collision with top & bottom of rackets
		else {
			// Ball needs to be destroy
			if (bounds.x + bounds.width < G.racketsManager.getLeftRacketBoundsLeftX() - 40 * currentRatio ||
				bounds.x > G.racketsManager.getRightRacketBoundsRightX() + 40 * currentRatio) {

				G.ballsManager.onBallOutDestroy(ball);
			}

			// Left racket
			else if (bounds.x < G.racketsManager.getLeftRacketBoundsRightX() &&
				bounds.y + bounds.height > G.racketsManager.getLeftRacketBoundsTopY() && 
				bounds.y < G.racketsManager.getLeftRacketBoundsBottomY()) {

				var leftRacketCenterY = (G.racketsManager.getLeftRacketBoundsTopY() + G.racketsManager.getLeftRacketBoundsBottomY()) * 0.5;

				// collide top of racket
				if (ball.vel.y > 0) {
					if (ball.y < G.racketsManager.getLeftRacket().y) {
						onBallCollideTop(ball);
					}
					ball.y = (G.racketsManager.getLeftRacketBoundsTopY() - currentDec.y - bounds.height) / currentRatio - 2 * safetyGapSize;
				}
				// collide bottom of racket
				else if (ball.vel.y < 0) {
					if (ball.y > G.racketsManager.getLeftRacket().y) {
						onBallCollideBottom(ball);
					}
					ball.y = (G.racketsManager.getLeftRacketBoundsBottomY() - currentDec.y) / currentRatio + 2 * safetyGapSize;
				}
			}

			// Right racket
			else if (bounds.x + bounds.width > G.racketsManager.getRightRacketBoundsLeftX() &&
				bounds.y + bounds.height > G.racketsManager.getRightRacketBoundsTopY() && 
				bounds.y < G.racketsManager.getRightRacketBoundsBottomY()) {

				var rightRacketCenterY = (G.racketsManager.getLeftRacketBoundsTopY() + G.racketsManager.getLeftRacketBoundsBottomY()) * 0.5;

				// collide top of racket
				if (ball.vel.y > 0) {
					if (ball.y < G.racketsManager.getRightRacket().y) {
					onBallCollideTop(ball);
					}
						ball.y = (G.racketsManager.getRightRacketBoundsTopY() - currentDec.y - bounds.height) / currentRatio - 2 * safetyGapSize;
				}
				// collide bottom of racket
				else if (ball.vel.y < 0) {
					if (ball.y > G.racketsManager.getRightRacket().y) {
					onBallCollideBottom(ball);
					}
						ball.y = (G.racketsManager.getRightRacketBoundsBottomY() - currentDec.y) / currentRatio + 2 * safetyGapSize;
				}
			}
		}
	}

	function onBallCollideTop(ball) {
		ball.vel.y = -ball.vel.y;
		ball.vel.x += ball.vel.x * 0.02; 
		if (!ball.out) {
			G.syncManager.onUpdateBall(ball, 't');
		}
		G.particlesManager.createBallCollideParticles(ball, 90);
	}

	function onBallCollideBottom(ball) {
		ball.vel.y = -ball.vel.y;
		ball.vel.x += ball.vel.x * 0.02; 
		if (!ball.out) {
			G.syncManager.onUpdateBall(ball, 'b');
		}
		G.particlesManager.createBallCollideParticles(ball, 270);
	}

	function onBallCollideLeft(ball) {
		ball.vel.x = -ball.vel.x;
		G.syncManager.onUpdateBall(ball, 'l');
		G.particlesManager.createBallCollideParticles(ball, 0);
	}

	function onBallCollideRight(ball) {
		ball.vel.x = -ball.vel.x;
		G.syncManager.onUpdateBall(ball, 'r');
		G.particlesManager.createBallCollideParticles(ball, 180);
	}

	function applyMagnetForce(ball) {
		if (ball.vel.x < 0) {
			// ball.vel.y = (ball.vel.y - (G.racketsManager.getLeftRacket().getCenter().y - ball.y) * 0.1);
			// ball.vel.y = ball.vel.y + (1/(ball.y - G.racketsManager.getLeftRacket().getCenter().y)) * 10
			// console.log(ball.y - G.racketsManager.getLeftRacket().getCenter().y);
		}
	}

	function updateSceneResizeValues(dec, ratio) {
		currentDec = dec;
		currentRatio = ratio;

		if (wallsBounds) {
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