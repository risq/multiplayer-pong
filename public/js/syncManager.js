G.syncManager = (function() {

    function init() {
    	
    }

    function onSync(data) {
        console.log('sync', data);
        if (data.event === 'createBall') {
            G.ballsManager.createBall(data);
        }
        else if (data.event === 'updateBall') {
            G.ballsManager.updateBall(data);
        }
        else if (data.event === 'setBallOut') {
            var ball = G.ballsManager.getBall(data.ID);
            if (ball) {
                G.ballsManager.setBallOut(ball);
            }
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
        }
        G.socketsManager.emit('sync', data);
    }

    function onUpdateBall(ball) {
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
            }
        }
        G.socketsManager.emit('sync', data);
    }

    function onBallOut(ball) {
        var data = {
            event: 'setBallOut',
            ID: ball.ID
        }
        G.socketsManager.emit('sync', data);
    }

    return {
    	init: init,
        onSync: onSync,
        onCreateBall: onCreateBall,
        onUpdateBall: onUpdateBall,
        onBallOut: onBallOut
    };

})();