G.ballsManager = (function() {
    
	var balls = [];

    function init(scene) {
    	
    }

    function createBall(pos, vel) {
    	var newBall = new Ball(pos);
		G.appManager.getScene().addChild(newBall);
		G.physicsEngine.setVel(newBall, vel);
		setTimeout(function() {
    		balls.push(newBall);
		}, 50);
    }

    function createBalls(number, pos, interval, turns, angle, remaining) {
    	turns = turns || 1;
    	angle = angle === undefined ? Math.PI/number : angle;
    	remaining = remaining === undefined ? number : remaining;
	    createBall(pos, new Vector2(1000 * Math.cos(angle), 1000 * Math.sin(angle)));
    	if (remaining > 1) {
	    	setTimeout(function() {
	    		createBalls(number, pos, interval, turns, angle + 2 * turns * Math.PI/number, remaining - 1);
	    	}, interval);
	    }

    }

    function getBalls() {
    	return balls;
    }

	return {
		init: init,
		createBall: createBall,
		createBalls: createBalls,
		getBalls: getBalls
	};
})();