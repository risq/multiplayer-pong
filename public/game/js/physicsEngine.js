G.physicsEngine = (function() {
    
	var currentDelta = 0,
		currentDec = new Vector2(),
		currentRatio = 1,
		safetyGapSize = 10,

		wallsBounds;

    function init() {
   		wallsBounds = new PIXI.Rectangle(
			0, 
			0, 
			G.appManager.getConfig().baseSceneWidth * currentRatio,
			G.appManager.getConfig().baseSceneHeight * currentRatio);
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
		checkBallCollision(ball);
		updateObjectPos(ball);
	}

	function updateObjectPos(object) {
		object.x = object.x + object.vel.x * currentDelta;
		object.y = object.y + object.vel.y * currentDelta;
	}

	function checkBallCollision(ball) {
		var bounds = ball.getBounds();
		bounds.y = bounds.y - G.appManager.getDec().y;
		bounds.x = bounds.x - G.appManager.getDec().x;
		bounds.width = bounds.width * currentRatio;
		bounds.height = bounds.height * currentRatio;

		if (bounds.y <= wallsBounds.y + safetyGapSize) {
			ball.y = bounds.y + safetyGapSize;
			onBallCollideTop(ball);
		}
		else if (bounds.y + bounds.height >= wallsBounds.y + wallsBounds.height - safetyGapSize) {
			ball.y = wallsBounds.y + (wallsBounds.height * 1/currentRatio) - 3 * safetyGapSize;
			onBallCollideBottom(ball);
		}
		else if (bounds.x <= wallsBounds.x + safetyGapSize) {
			ball.x = bounds.x + safetyGapSize;
			onBallCollideLeft(ball);
		}
		else if (bounds.x + bounds.width >= wallsBounds.x + wallsBounds.width - safetyGapSize) {
			ball.x = wallsBounds.x + (wallsBounds.width * 1/currentRatio) - 3 * safetyGapSize;
			onBallCollideRight(ball);
		}
	}

	function onBallCollideTop(ball) {
		ball.vel.y = -ball.vel.y;
	}

	function onBallCollideBottom(ball) {
		ball.vel.y = -ball.vel.y;
	}

	function onBallCollideLeft(ball) {
		ball.vel.x = -ball.vel.x;
	}

	function onBallCollideRight(ball) {
		ball.vel.x = -ball.vel.x;
	}

	function updateSceneResizeValues(dec, ratio) {
		currentDec = dec;
		currentRatio = ratio;

		if (wallsBounds) {
			wallsBounds.width  = G.appManager.getConfig().baseSceneWidth * currentRatio;
			wallsBounds.height = G.appManager.getConfig().baseSceneHeight * currentRatio;
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