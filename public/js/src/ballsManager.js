var Ball = require('./class/Ball');


var balls = [];

function init(scene) {
	
}

function createBall(ballData) {
    ballData.ID = ballData.ID || getID();
    if (!balls[ballData.ID]) {
    	var newBall = new Ball(ballData.ID, ballData.pos, ballData.color, ballData.radius);
        // console.log('created ball #' + newBall.ID, newBall, balls[ballData.ID])
        physicsEngine.setVel(newBall, ballData.vel);
        syncManager.onCreateBall(newBall);
        stageManager.getScene().addBall(newBall);
        balls[ballData.ID] = newBall;
		setTimeout(function() {
    		newBall.enablePhysics();
		}, 50);
    }
}

function createBalls(number, pos, vel, interval, turns, angle, remaining) {
	pos   = pos   || stageManager.getScene().getCenter();
    vel   = vel   || 1000;
    turns = turns || 1;
    angle = angle === undefined ? Math.PI/number : angle;
	remaining = remaining === undefined ? number : remaining;
    createBall({
        pos: pos, 
        vel: new Vector2(vel * Math.cos(angle + (Math.random() - 0.5) * Math.PI * 0.08) , vel * Math.sin(angle + (Math.random() - 0.5) * Math.PI * 0.08) )
    });
	if (remaining > 1 && appManager.getState() === 'ready') {
    	setTimeout(function() {
    		createBalls(number, pos, vel, interval, turns, angle + 2 * turns * Math.PI / number, remaining - 1);
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
        console.log('error : ball #', ballData.ID, balls[ballData.ID]);
    }
}

function removeAllBalls() {
    balls.forEach(removeBall);
    stageManager.getScene().clearBalls();
    balls = [];
}

function removeBall(ball) {
    if (ball) {
        stageManager.getScene().removeBall(ball);
        delete balls[ball.ID];
    }
}

function onBallOut(ball) {
    if (appManager.isHost()) {
        syncManager.onBallOut(ball);
        setBallOut(ball);
    }
}

function onBallOutDestroy(ball) {
    if (appManager.isHost()) {
        syncManager.onBallDestroy(ball);
        destroyBall(ball);
    }
}

function setBallOut(ball) {
    ball.out = true;
    setTimeout(function() {
        destroyBall(ball);
    }, 750);
}

function destroyBall(ball) {
    particlesManager.createBallExplodeParticles(ball);
    shadersManager.glitch(10);
    removeBall(ball);
}

function getID() {
    var ID = Math.round(Math.random() * 10000);
    return balls[ID] ? getID() : ID;
}

function getBalls() {
	return balls;
}

function getBall(ID) {
    return balls[ID] || null;
}

module.exports =  {
	init: init,
	createBall: createBall,
	createBalls: createBalls,
    updateBall: updateBall,
    removeAllBalls: removeAllBalls,
    removeBall: removeBall,
    getID: getID,
	getBalls: getBalls,
    getBall: getBall,
    onBallOut: onBallOut,
    onBallOutDestroy: onBallOutDestroy,
    setBallOut: setBallOut,
    destroyBall: destroyBall
};
