Vector2 = require( './class/Vector2' );


var currentDelta = 0,
    currentDec = new Vector2(),
    currentRatio = 1,
    safetyGapSize = 6,
    racketsMargin = 34;


function init() {


}

function update( delta ) {

    currentDelta = delta;

    if ( currentDelta ) {

        updateRackets();
        updateBalls();

    }
}

function setVel( object, vel ) {

    object.vel.copy( vel );

}

function addVel( object, vel ) {

    object.vel.addSelf( vel );

}

function updateRackets() {

    updateRacket( racketsManager.getLeftRacket() );
    updateRacket( racketsManager.getRightRacket() );

}

function updateRacket( racket ) {

    if ( Math.abs( racket.y - racket.movingToY ) > 1 ) {

        racket.y += ( racket.movingToY - racket.y ) * 8 * currentDelta;

    } else {

        racket.y = racket.movingToY;

    }
}

function updateBalls() {

    ballsManager.getBalls().forEach( updateBall );

}

function updateBall( ball, index ) {

    if ( ball && ball.physics ) {

        if ( ball.vel.x >= -50 && ball.vel.x <= 50 ) {

            ball.vel.x = ball.vel.x + ball.vel.x * 0.1;

        }
        checkBallCollision( ball );
        updateObjectPos( ball );
        applyMagnetForce( ball );

    }
}

function updateObjectPos( object ) {

    object.x = object.x + object.vel.x * currentDelta;
    object.y = object.y + object.vel.y * currentDelta;

}

function checkBallCollision( ball ) {
    ball.nextX = ball.x + ball.vel.x * currentDelta;
    ball.nextY = ball.y + ball.vel.y * currentDelta;

    // Test top collision
    if ( ball.nextY <= 0 ) {

        ball.y = 0;

        if ( ball.out ) {

            ballsManager.onBallOutDestroy( ball );

        } else {

            onBallCollideTop( ball );

        }
    }

    // Test bottom collision
    else if ( ball.nextY + ball.size >= gameConfig.baseSceneHeight ) {

        ball.y = gameConfig.baseSceneHeight - ball.size;

        if ( ball.out ) {

            ballsManager.onBallOutDestroy( ball );

        } else {

            onBallCollideBottom( ball );

        }
    }

    // If ball is not out of the game
    if ( !ball.out ) {

        // Test left collision
        if ( ball.nextX <= racketsManager.getLeftRacketBoundsRightX() &&
            ball.x >= racketsManager.getLeftRacketBoundsRightX() ) {

            // If the ball touches left racket
            if ( ball.nextY + ball.size > racketsManager.getLeftRacketBoundsTopY() &&
                ball.nextY < racketsManager.getLeftRacketBoundsBottomY() ) {

                ball.x = racketsManager.getLeftRacketBoundsRightX();
                onBallCollideLeft( ball );

            } else if ( ball.nextX < racketsManager.getLeftRacketBoundsRightX() ) {

                ballsManager.onBallOut( ball );

            }
        }
        // Test right collision
        else if ( ball.nextX + ball.size >= racketsManager.getRightRacketBoundsLeftX() &&
            ball.x + ball.size <= racketsManager.getRightRacketBoundsLeftX() ) {

            // If the ball touches right racket
            if ( ball.nextY + ball.size > racketsManager.getRightRacketBoundsTopY() &&
                ball.nextY < racketsManager.getRightRacketBoundsBottomY() ) {

                ball.x = racketsManager.getRightRacketBoundsLeftX() - ball.size;
                onBallCollideRight( ball );

            } else if ( ball.nextX + ball.size > racketsManager.getRightRacketBoundsLeftX() ) {

                ballsManager.onBallOut( ball );

            }
        }
    }

    // If ball is out, test collision with top & bottom of rackets
    if ( ball.out ) {

        // Ball needs to be destroy
        if ( ball.nextX + ball.width < racketsManager.getLeftRacketBoundsLeftX() - 40 * currentRatio ||
            ball.nextX > racketsManager.getRightRacketBoundsRightX() + 40 * currentRatio ) {

            ballsManager.onBallOutDestroy( ball );

        }

        // Left racket
        else if ( ball.nextX < racketsManager.getLeftRacketBoundsRightX() &&
            ball.nextY + ball.height > racketsManager.getLeftRacketBoundsTopY() &&
            ball.nextY < racketsManager.getLeftRacketBoundsBottomY() ) {

            var leftRacketCenterY = ( racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY() ) * 0.5;

            // collide top of racket
            if ( ball.vel.y > 0 ) {

                onBallCollideTop( ball );

                ball.y = racketsManager.getLeftRacketBoundsTopY() - ball.height - 2 * safetyGapSize;

            }
            // collide bottom of racket
            else if ( ball.vel.y < 0 ) {

                onBallCollideBottom( ball );

                ball.y = racketsManager.getLeftRacketBoundsBottomY() + 2 * safetyGapSize;

            }
        }

        // Right racket
        else if ( ball.nextX + ball.width > racketsManager.getRightRacketBoundsLeftX() &&
            ball.nextY + ball.height > racketsManager.getRightRacketBoundsTopY() &&
            ball.nextY < racketsManager.getRightRacketBoundsBottomY() ) {

            var rightRacketCenterY = ( racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY() ) * 0.5;

            // collide top of racket
            if ( ball.vel.y > 0 ) {

                if ( ball.y < racketsManager.getRightRacket().y ) {

                    onBallCollideTop( ball );

                }

                ball.y = ( racketsManager.getRightRacketBoundsTopY() - ball.height ) - 2 * safetyGapSize;

            }
            // collide bottom of racket
            else if ( ball.vel.y < 0 ) {

                if ( ball.y > racketsManager.getRightRacket().y ) {

                    onBallCollideBottom( ball );

                }

                ball.y = racketsManager.getRightRacketBoundsBottomY() + 2 * safetyGapSize;

            }
        }
    }
}

function onBallCollideTop( ball ) {

    ball.vel.y = -ball.vel.y;
    ball.vel.x += ball.vel.x * 0.02;
    if ( !ball.out ) {

        syncManager.onUpdateBall( ball, 't' );

    }
    particlesManager.createBallCollideParticles( ball, 90 );

}

function onBallCollideBottom( ball ) {

    ball.vel.y = -ball.vel.y;
    ball.vel.x += ball.vel.x * 0.02;
    if ( !ball.out ) {

        syncManager.onUpdateBall( ball, 'b' );

    }
    particlesManager.createBallCollideParticles( ball, 270 );

}

function onBallCollideLeft( ball ) {

    ball.vel.x = -ball.vel.x;
    syncManager.onUpdateBall( ball, 'l' );
    particlesManager.createBallCollideParticles( ball, 0 );

}

function onBallCollideRight( ball ) {

    ball.vel.x = -ball.vel.x;
    syncManager.onUpdateBall( ball, 'r' );
    particlesManager.createBallCollideParticles( ball, 180 );

}

function applyMagnetForce( ball ) {

    if ( ball.vel.x < 0 ) {
        // ball.vel.y = (ball.vel.y - (racketsManager.getLeftRacket().getCenter().y - ball.y) * 0.1);
        // ball.vel.y = ball.vel.y + (1/(ball.y - racketsManager.getLeftRacket().getCenter().y)) * 10
        // console.log(ball.y - racketsManager.getLeftRacket().getCenter().y);
    }

}

function updateSceneResizeValues( dec, ratio ) {

    currentDec = dec;
    currentRatio = ratio;

}

module.exports = {
    init: init,
    update: update,
    setVel: setVel,
    addVel: addVel,
    updateSceneResizeValues: updateSceneResizeValues
};
