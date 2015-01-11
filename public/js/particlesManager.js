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

    function createBallParticles(ball, angle) {
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
                        "start": 0.9,
                        "end": 0.4,
                        "minimumScaleMultiplier": 1
                    },
                    "color": {
                        "start": ball.colorHex,
                        "end": "#ffffff"
                    },
                    "speed": {
                        "start": 150,
                        "end": 50
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
                        "min": 0.5,
                        "max": 0.7
                    },
                    "blendMode": "normal",
                    "frequency": 0.001,
                    "emitterLifetime": 0.5,
                    "maxParticles": 6,
                    "pos": {
                        "x": ball.x + ball.radius / 2,
                        "y": ball.y + ball.radius / 2
                    },
                    "addAtBack": false,
                    "spawnType": "rect",
                    "spawnRect": {
                        "x": 0,
                        "y": 0,
                        "w": 20,
                        "h": 20
                    }
                });
            emitter.emit = true;
            emitter.ballID = ball.ID;

            emitters.push(emitter);
        }
    }

    function getEmitters() {
        return emitters;
    }

   

    return {
        init: init,
        update: update,
        createBallParticles: createBallParticles,
        getEmitters: getEmitters
    };
})();