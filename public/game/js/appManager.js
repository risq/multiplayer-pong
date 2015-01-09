G.appManager = (function() {
    
    var renderer,
    	stage, 
    	scene,
    	stats,
    	lastTime = 0, 
    	delta = 0,
    	dec = new Vector2(),
    	ratio = 1,
    	pixelateFilter,
    	colorStepFilter,
    	checkDeltaInterval,
    	startTime,
    	inactive = false,

    	config = {
	    	baseSceneWidth: 1440,
	    	baseSceneHeight: 900,
	    	checkDeltaIntervalTime: 500
	    };

	function init() {
		// create an new instance of a pixi stage
		stage = new PIXI.Stage(0x000000);
	    
		// create a renderer instance and append the view 
		renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, null, false, true);
	    document.body.appendChild(renderer.view);

	    pixelateFilter = new PIXI.PixelateFilter();
	    pixelateFilter.size.x = 2;
	    pixelateFilter.size.y = 2;
	    stage.filters = [pixelateFilter];

	    stats = new Stats();
	    stats.domElement.style.position = 'absolute';
		stats.domElement.style.left = '0px';
		stats.domElement.style.top = '0px';
		document.body.appendChild( stats.domElement );

	    scene = new Scene(config.baseSceneWidth, config.baseSceneHeight);
	    stage.addChild(scene);
	    updateGameSize();
	    
	    window.onresize = updateGameSize;


	    G.physicsEngine.init();

	    G.ballsManager.createBalls(48, scene.getCenter(), 940, 50, 2);


	    startTime = new Date();
	    checkDeltaInterval = setInterval(checkDelta, config.checkDeltaIntervalTime);
	    update();
	}
    
    function onAssetsLoaded() {
                
    }
    
	function update(time) {
	    requestAnimFrame( update );
	    delta = (time - lastTime) / 1000;
		lastTime = time;
	    G.physicsEngine.update(delta);
	    stats.update();
	    renderer.render(stage);
	}

	// Manually update physics if requestAnimFrame not available (if tab inactive)
	function checkDelta() {
		var tempTime = new Date() - startTime;
		if(tempTime - lastTime >= config.checkDeltaIntervalTime) {
			if (!inactive) {
				inactive = true;
				console.log('player is inactive');
			}
		}
		else if (inactive) {
			inactive = false;
			console.log('player came back');
		}
	}

	function updateGameSize() {
		renderer.resize(window.innerWidth, window.innerHeight);

		var ratioW = window.innerWidth  / config.baseSceneWidth;
		var ratioH = window.innerHeight / config.baseSceneHeight;

		if (ratioW < ratioH) {
			ratio = ratioW;
			dec.x = 0;
			dec.y = (window.innerHeight - config.baseSceneHeight * ratio) / 2;
		}
		else {
			ratio = ratioH;
			dec.x = (window.innerWidth - config.baseSceneWidth * ratio) / 2;
			dec.y = 0;
		}

		scene.scale = new PIXI.Point(ratio, ratio);
		scene.x = dec.x;
		scene.y = dec.y;

		G.physicsEngine.updateSceneResizeValues(dec, ratio);
	}

	function getScene() {
		return scene;
	}

	function getDec() {
		return dec;
	}

	function getConfig() {
		return config;
	}

	return {
		init: init,
		getScene: getScene,
		getDec: getDec,
		getConfig: getConfig
	};
})();