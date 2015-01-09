G.physicsEngine = (function() {
    
	var currentDelta = 0,
		currentDec = new Vector2(),
		currentRatio = 1,
		safetyGapSize = 10,

		wallsBounds;

    function init() {
   		wallsBounds = new PIXI.Rectangle(
			safetyGapSize * 0.5 * currentRatio, 
			safetyGapSize * 0.5 * currentRatio, 
			(G.stageManager.getConfig().baseSceneWidth - safetyGapSize * 0.5) * currentRatio,
			(G.stageManager.getConfig().baseSceneHeight - safetyGapSize * 0.5) * currentRatio);
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
		bounds.y = bounds.y - G.stageManager.getDec().y;
		bounds.x = bounds.x - G.stageManager.getDec().x;
		// bounds.scaledWidth  = bounds.width  * currentRatio;
		// bounds.scaledHeight = bounds.height * currentRatio;

		if (bounds.y + ball.vel.y * currentDelta <= wallsBounds.y || 
			bounds.y <= wallsBounds.y) {

			//DEBUG console.log('onBallCollideTop', ball.x, ball.y);
			ball.y = wallsBounds.y + safetyGapSize;
			//DEBUG console.log('new values:', ball.x, ball.y);
			onBallCollideTop(ball);
		}
		else if (bounds.y + bounds.height + ball.vel.y * currentDelta >= wallsBounds.y + wallsBounds.height || 
				 bounds.y + bounds.height >= wallsBounds.y + wallsBounds.height) {

			//DEBUG console.log('onBallCollideBottom', ball.x, ball.y);
			ball.y = wallsBounds.y + (wallsBounds.height * 1/currentRatio) - ball.radius - safetyGapSize;
			//DEBUG console.log('new values:', ball.x, ball.y);
			onBallCollideBottom(ball);
		}
		if (bounds.x + ball.vel.x * currentDelta <= wallsBounds.x || 
			bounds.x <= wallsBounds.x) {

			//DEBUG console.log('onBallCollideLeft', ball.x, ball.y);
			ball.x = wallsBounds.x + safetyGapSize;
			//DEBUG console.log('new values:', ball.x, ball.y);
			onBallCollideLeft(ball);
		}
		else if (bounds.x + bounds.width + ball.vel.x * currentDelta >= wallsBounds.x + wallsBounds.width ||
				 bounds.x + bounds.width >= wallsBounds.x + wallsBounds.width) {

			//DEBUG console.log('onBallCollideRight', ball.x, ball.y);
			ball.x = wallsBounds.x + (wallsBounds.width * 1/currentRatio) - ball.radius - safetyGapSize;
			//DEBUG console.log('new values:', ball.x, ball.y);
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
			wallsBounds.width  = G.stageManager.getConfig().baseSceneWidth * currentRatio;
			wallsBounds.height = G.stageManager.getConfig().baseSceneHeight * currentRatio;
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