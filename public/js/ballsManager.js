G.ballsManager = (function() {
    
	var balls = [];

    function init(scene) {
    	
    }

    function createBall(ballData) {
        ballData.ID = ballData.ID || getID();
        if (!balls[ballData.ID]) {
        	var newBall = new Ball(ballData.ID, ballData.pos, ballData.color, ballData.radius);
            // console.log('created ball #' + newBall.ID, newBall, balls[ballData.ID])
            G.physicsEngine.setVel(newBall, ballData.vel);
            G.syncManager.onCreateBall(newBall);
            G.stageManager.getScene().addChild(newBall);
            balls[ballData.ID] = newBall;
    		setTimeout(function() {
        		newBall.enablePhysics();
    		}, 50);
        }
    }

    function createBalls(number, pos, vel, interval, turns, angle, remaining) {
    	pos   = pos   || G.stageManager.getScene().getCenter();
        vel   = vel   || 1000;
        turns = turns || 1;
        angle = angle === undefined ? Math.PI/number : angle;
    	remaining = remaining === undefined ? number : remaining;
	    createBall({
            pos: pos, 
            vel: new Vector2(vel * Math.cos(angle), vel * Math.sin(angle))
        });
    	if (remaining > 1 && G.appManager.getState() === 'ready') {
	    	setTimeout(function() {
	    		createBalls(number, pos, vel, interval, turns, angle + 2 * turns * Math.PI/number, remaining - 1);
	    	}, interval);
	    }
    }

    function updateBall(ballData) {
        if (ballData && ballData.ID && balls[ballData.ID]) {
            if (ballData.pos) {
                balls[ballData.ID].x = ballData.pos.x;
                balls[ballData.ID].y = ballData.pos.y;
            }
            if (ballData.vel) {
                balls[ballData.ID].vel.copy(ballData.vel);
            }
        }
        else {
            console.log('error : ball #', ballData.ID, balls[ballData.ID])
        }
    }

    function removeAllBalls() {
        balls.forEach(removeBall);
        G.stageManager.getScene().clearObjectsOfType(Ball);
        balls = [];
    }

    function removeBall(ball) {
        if (ball) {
            G.stageManager.getScene().removeChild(ball);
            delete balls[ball.ID];
        }
    }

    function onBallOut(ball) {
        ball.out = true;
        setTimeout(function() {
            removeBall(ball);
        }, 2000);
    }

    function getID() {
        var ID = Math.round(Math.random() * 10000);
        return balls[ID] ? getID() : ID;
    }

    function getBalls() {
    	return balls;
    }

	return {
		init: init,
		createBall: createBall,
		createBalls: createBalls,
        updateBall: updateBall,
        removeAllBalls: removeAllBalls,
        removeBall: removeBall,
        getID: getID,
		getBalls: getBalls,
        onBallOut: onBallOut
	};
})();