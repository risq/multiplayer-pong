G.syncManager = (function() {

    function init() {
    	
    }

    function onSync(data) {
        if (data.event === 'createBall') {
            console.log('createBall', data);
            G.ballsManager.createBall(data);
        }
        else if (data.event === 'updateBall') {
            console.log('updateBall', data);
            G.ballsManager.updateBall(data);
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

    return {
    	init: init,
        onSync: onSync,
        onCreateBall: onCreateBall,
        onUpdateBall: onUpdateBall
    };

})();