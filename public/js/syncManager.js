G.syncManager = (function() {

    function init() {
    	
    }

    function onSync(data) {
        // console.log('sync', data);
        if (data.event === 'createBall') {
            G.ballsManager.createBall(data);
        }
        else if (data.event === 'updateBall') {
            G.ballsManager.updateBall(data);

            if (data.collidingDirection === 't') {
                G.particlesManager.createBallCollideParticles(G.ballsManager.getBall(data.ID), 90);
            }
            else if (data.collidingDirection === 'b') {
                G.particlesManager.createBallCollideParticles(G.ballsManager.getBall(data.ID), 270);
            }
            else if (data.collidingDirection === 'l') {
                G.particlesManager.createBallCollideParticles(G.ballsManager.getBall(data.ID), 0);
            }
            else if (data.collidingDirection === 'r') {
                G.particlesManager.createBallCollideParticles(G.ballsManager.getBall(data.ID), 180);
            }
        }
        else if (data.event === 'setBallOut') {
            var outBall = G.ballsManager.getBall(data.ID);
            if (outBall) {
                G.ballsManager.setBallOut(outBall);
            }
        }
        else if (data.event === 'destroyBall') {
            var destroyedBall = G.ballsManager.getBall(data.ID);
            if (destroyedBall) {
                G.ballsManager.destroyBall(destroyedBall);
            }
        }
        else if (data.event === 'racketMove') {
            G.racketsManager.moveOpponentRacketTo(data.y);
        }
    }

    function onCreateBall(ball) {
        var data = {
            event: 'createBall',
            ID: ball.ID,
            color: ball.color,
            pos: {
                x: ball.x,
                y: ball.y
            },
            vel: {
                x: ball.vel.x,
                y: ball.vel.y,
            }
        };
        G.socketsManager.emit('sync', data);
    }

    function onUpdateBall(ball, collidingDirection) {
        var data = {
            event: 'updateBall',
            ID: ball.ID,
            pos: {
                x: ball.x,
                y: ball.y
            },
            vel: {
                x: ball.vel.x,
                y: ball.vel.y,
            },
            collidingDirection: collidingDirection
        };
        G.socketsManager.emit('sync', data);
    }

    function onBallOut(ball) {
        var data = {
            event: 'setBallOut',
            ID: ball.ID
        };
        G.socketsManager.emit('sync', data);
    }

    function onBallDestroy(ball) {
        var data = {
            event: 'destroyBall',
            ID: ball.ID
        };
        G.socketsManager.emit('sync', data);
    }

    function onRacketSetMovingToY(y) {
        var data = {
            event: 'racketMove',
            y: y
        };
        G.socketsManager.emit('sync', data);
    }

    return {
    	init: init,
        onSync: onSync,
        onCreateBall: onCreateBall,
        onUpdateBall: onUpdateBall,
        onBallOut: onBallOut,
        onBallDestroy: onBallDestroy,
        onRacketSetMovingToY: onRacketSetMovingToY
    };

})();