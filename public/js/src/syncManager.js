function init() {

}

function onSync( data ) {

    if ( data.event === 'createBall' ) {

        ballsManager.createBall( data );

    } else if ( data.event === 'updateBall' ) {

        ballsManager.updateBall( data );

        if ( data.collidingDirection === 't' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 90 );

        } else if ( data.collidingDirection === 'b' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 270 );

        } else if ( data.collidingDirection === 'l' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 0 );

        } else if ( data.collidingDirection === 'r' ) {

            particlesManager.createBallCollideParticles( ballsManager.getBall( data.ID ), 180 );

        }

    } else if ( data.event === 'setBallOut' ) {

        var outBall = ballsManager.getBall( data.ID );

        if ( outBall ) {

            ballsManager.setBallOut( outBall );

        }

    } else if ( data.event === 'destroyBall' ) {

        var destroyedBall = ballsManager.getBall( data.ID );

        if ( destroyedBall ) {

            destroyedBall.x = data.pos.x;
            destroyedBall.y = data.pos.y;
            ballsManager.destroyBall( destroyedBall );

        }

    } else if ( data.event === 'racketMove' ) {

        racketsManager.moveOpponentRacketTo( data.y, data.instant );

    }
}

function onCreateBall( ball ) {

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
    socketsManager.emit( 'sync', data );

}

function onUpdateBall( ball, collidingDirection ) {

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
    socketsManager.emit( 'sync', data );

}

function onBallOut( ball ) {

    var data = {
        event: 'setBallOut',
        ID: ball.ID
    };
    socketsManager.emit( 'sync', data );

}

function onBallDestroy( ball ) {

    var data = {
        event: 'destroyBall',
        ID: ball.ID,
        pos: {
            x: ball.x,
            y: ball.y
        }
    };
    socketsManager.emit( 'sync', data );
}

function onRacketSetMovingToY( y, instant ) {

    var data = {
        event: 'racketMove',
        y: y,
        instant: instant
    };
    socketsManager.emit( 'sync', data );
    
}

module.exports = {
    init: init,
    onSync: onSync,
    onCreateBall: onCreateBall,
    onUpdateBall: onUpdateBall,
    onBallOut: onBallOut,
    onBallDestroy: onBallDestroy,
    onRacketSetMovingToY: onRacketSetMovingToY
};
