G.particlesManager = (function() {

    var particlesContainer,
        emitters = [];


    function init() {
        particlesContainer = G.stageManager.getScene().getParticlesContainer();
    }

    function update(delta) {
        emitters.forEach(function(emitter, index) {
            if (emitter.emit || emitter._activeParticles.length) {
                emitter.update(delta);
            }
            else {
                if(G.ballsManager.getBall(emitter.ballID)) {
                    G.ballsManager.getBall(emitter.ballID).isEmitting = false;
                }
                _.remove(emitters, emitter);
                emitter.destroy();
            }
        });
    }

    function createBallCollideParticles(ball, angle) {
        if (!ball.isEmitting) { 
            ball.isEmitting = true;
            emitter = new cloudkid.Emitter(
                particlesContainer,

                // The collection of particle images to use
                [PIXI.Texture.fromImage('textures/pixel24.png')],
                {
                    "alpha": {
                        "start": 0.8,
                        "end": 0
                    },
                    "scale": {
                        "start": 1 / 24 * ball.radius,
                        "end":   1 / 54 * ball.radius,
                        "minimumScaleMultiplier": 1
                    },
                    "color": {
                        "start": ball.colorHex,
                        "end": "#333333"
                    },
                    "speed": {
                        "start": 10 * ball.radius,
                        "end": 2 * ball.radius
                    },
                    "acceleration": {
                        "x": 0,
                        "y": 0
                    },
                    "startRotation": {
                        "min": angle - 60,
                        "max": angle + 60
                    },
                    "rotationSpeed": {
                        "min": 0,
                        "max": 0
                    },
                    "lifetime": {
                        "min": 0.2,
                        "max": 0.5
                    },
                    "blendMode": "normal",
                    "frequency": 0.02,
                    "emitterLifetime": 0.2,
                    "maxParticles": 6,
                    "pos": {
                        "x": ball.x + ball.radius / 2,
                        "y": ball.y + ball.radius / 2
                    },
                    "addAtBack": false,
                    "spawnType": "point"
                });
            emitter.emit = true;
            emitter.ballID = ball.ID;

            emitters.push(emitter);
        }
    }

    function createBallExplodeParticles(ball) {
            emitter = new cloudkid.Emitter(
                particlesContainer,

                // The collection of particle images to use
                [PIXI.Texture.fromImage('textures/pixel24.png')],
                {
                    "alpha": {
                        "start": 0.8,
                        "end": 0
                    },
                    "scale": {
                        "start": 1 / 24 * ball.radius,
                        "end":   1 / 48 * ball.radius,
                        "minimumScaleMultiplier": 1
                    },
                    "color": {
                        "start": ball.colorHex,
                        "end": "#333333"
                    },
                    "speed": {
                        "start": 50 * ball.radius,
                        "end": 10 * ball.radius
                    },
                    "acceleration": {
                        "x": 0,
                        "y": 0
                    },
                    "startRotation": {
                        "min": 0,
                        "max": 360
                    },
                    "rotationSpeed": {
                        "min": 0,
                        "max": 0
                    },
                    "lifetime": {
                        "min": 0.1,
                        "max": 0.5
                    },
                    "blendMode": "normal",
                    "frequency": 0.01,
                    "emitterLifetime": 0.15,
                    "maxParticles": 32,
                    "pos": {
                        "x": ball.x + ball.radius / 2,
                        "y": ball.y + ball.radius / 2
                    },
                    "addAtBack": false,
                    "spawnType": "point"
                });
            emitter.emit = true;
            emitter.ballID = ball.ID;

            emitters.push(emitter);
    }

    function getEmitters() {
        return emitters;
    }

   

    return {
        init: init,
        update: update,
        createBallCollideParticles: createBallCollideParticles,
        createBallExplodeParticles: createBallExplodeParticles,
        getEmitters: getEmitters
    };
})();