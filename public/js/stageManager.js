G.stageManager = (function() {
    
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
        inactive = false;

    function init() {
        // create an new instance of a pixi stage
        stage = new PIXI.Stage(0x222222);
        
        // create a renderer instance and append the view 
        renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, null, false, true);
        document.getElementById('game').appendChild(renderer.view);
        

        pixelateFilter = new PIXI.PixelateFilter();
        pixelateFilter.size.x = 2;
        pixelateFilter.size.y = 2;
        stage.filters = [pixelateFilter];

        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.right = '0px';
        stats.domElement.style.top = '0px';
        document.body.appendChild(stats.domElement);

        scene = new Scene(G.config.baseSceneWidth, G.config.baseSceneHeight);
        stage.addChild(scene);
        updateGameSize();
        
        window.onresize = updateGameSize;


        G.hudManager.init();
        G.racketsManager.init();
        G.physicsEngine.init();

        startTime = G.appManager.getStartTime();
        checkDeltaInterval = setInterval(checkDelta, G.config.checkDeltaIntervalTime);
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
        // console.log('tempTime', tempTime);
        // console.log('lastTime', lastTime);
        if(tempTime - lastTime >= G.config.checkDeltaIntervalTime) {
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

        var ratioW = window.innerWidth  / G.config.baseSceneWidth;
        var ratioH = window.innerHeight / G.config.baseSceneHeight;

        if (ratioW < ratioH) {
            ratio = ratioW;
            dec.x = 0;
            dec.y = (window.innerHeight - G.config.baseSceneHeight * ratio) / 2;
        }
        else {
            ratio = ratioH;
            dec.x = (window.innerWidth - G.config.baseSceneWidth * ratio) / 2;
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

    function getStage() {
        return stage;
    }

    function getDec() {
        return dec;
    }

    return {
        init: init,
        getScene: getScene,
        getStage: getStage,
        getDec: getDec
    };
})();