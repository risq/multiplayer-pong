G.ballsManager = (function() {
    
	var balls = [];

    function init(scene) {
    	
    }

    function createBall(pos, vel) {
    	var newBall = new Ball(pos);
		G.stageManager.getScene().addChild(newBall);
		G.physicsEngine.setVel(newBall, vel);
		setTimeout(function() {
    		balls.push(newBall);
		}, 50);
    }

    function createBalls(number, pos, vel, interval, turns, angle, remaining) {
    	pos   = pos   || G.stageManager.getScene().getCenter();
        vel   = vel   || 1000;
        turns = turns || 1;
        angle = angle === undefined ? Math.PI/number : angle;
    	remaining = remaining === undefined ? number : remaining;
	    createBall(pos, new Vector2(vel * Math.cos(angle), vel * Math.sin(angle)));
    	if (remaining > 1 && G.appManager.getState() === 'ready') {
	    	setTimeout(function() {
	    		createBalls(number, pos, vel, interval, turns, angle + 2 * turns * Math.PI/number, remaining - 1);
	    	}, interval);
	    }
    }

    function removeAllBalls() {
        balls.forEach(removeBall);
        balls = [];
        G.stageManager.getScene().clearObjectsOfType(Ball);
    }

    function removeBall(ball) {
        G.stageManager.getScene().removeChild(ball);
        _.remove(balls, function (ballElem) {
            return _.isEqual(ballElem, ball);
        })
    }

    function onBallOut(ball) {
        ball.out = true;
        setTimeout(function() {
            removeBall(ball);
        }, 2000);
    }

    function getBalls() {
    	return balls;
    }

	return {
		init: init,
		createBall: createBall,
		createBalls: createBalls,
        removeAllBalls: removeAllBalls,
        removeBall: removeBall,
		getBalls: getBalls,
        onBallOut: onBallOut
	};
})();