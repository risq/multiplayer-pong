var gameManager = (function() {
    
    var renderer, 
    	stage, 
    	scene, 
    	lastTime = 0, 
    	delta = 0;

    var config = {
    	baseSceneWidth: 1440,
    	baseSceneHeight: 900
    };

	function init() {
		// create an new instance of a pixi stage
		stage = new PIXI.Stage(0x000000);
	    
		// create a renderer instance and append the view 
		renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight);
	    document.body.appendChild(renderer.view);

	    scene = new Scene(config.baseSceneWidth, config.baseSceneHeight);
	    stage.addChild(scene);
	    updateGameSize();
	    
	    window.onresize = updateGameSize;

	    update();
	}
    
    function onAssetsLoaded() {
                
    }
    
	function update(time) {
	    requestAnimFrame( update );
	    updateDelta(time);
	    if (delta) {
	    	scene.update(delta);
	    }
	    renderer.render(stage);
	}

	function updateDelta(time) {
		delta = (time - lastTime) / 1000;
		lastTime = time;
	}

	function updateGameSize() {
		renderer.resize(window.innerWidth, window.innerHeight);

		var ratio, 
			decX = 0,
			decY = 0;

		var ratioW = window.innerWidth  / config.baseSceneWidth;
		var ratioH = window.innerHeight / config.baseSceneHeight;

		if (ratioW < ratioH) {
			ratio = ratioW;
			decY = (window.innerHeight - config.baseSceneHeight * ratio) / 2;
		}
		else {
			ratio = ratioH;
			decX = (window.innerWidth - config.baseSceneWidth * ratio) / 2;
		}

		scene.scale = new PIXI.Point(ratio, ratio);
		scene.x = decX;
		scene.y = decY;
	}

	return {
		init: init
	};
})();