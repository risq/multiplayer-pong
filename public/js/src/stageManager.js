var Scene = require('./class/Scene');

var renderer,
    stage, 
    scene,
    particlesContainer,
    stats,
    lastTime = 0, 
    delta = 0,
    dec = new Vector2(),
    ratio = 1,
    pixelateFilter,
    background,
    colorStepFilter,
    scanFilter,
    rgbSplitFilter,
    checkDeltaInterval,
    startTime,
    emitter,
    inactive = false,
    isPaused = false;

function init() {
    // create an new instance of a pixi stage
    stage = new PIXI.Stage(0x222222);
    
    // create a renderer instance and append the view 
    renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, null, false, true);
    document.getElementById('game').appendChild(renderer.view);
    

    var uniforms = {};
    uniforms.power = { type: '1f', value: 1/1000 };
    uniforms.noise = { type: '1f', value: 0.2 };
    
    //// grain filter..
    
    var fragmentSrc = [

        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'uniform sampler2D uSampler;',
        'uniform float noise;',
        'uniform float power;',

        'float rand(vec2 co) {',
        '    return fract(sin(dot(co.xy ,vec2(12.9898,78.233 * noise))) * 43758.5453);',
        '}',
        
        'void main(void) {',
        '   vec2 cord = vTextureCoord;',
        '   cord.y += noise * 0.001;',

        '    vec4 color = texture2D(uSampler, vTextureCoord);',
            
        '    float diff = (rand(vTextureCoord) - 0.5) * 0.075;',
        '    color.r += diff;',
        '    color.g += diff;',
        '    color.b += diff;',
            
        '   gl_FragColor = color;',
        '}'
    ];

    scanFilter = new PIXI.AbstractFilter(fragmentSrc, uniforms);

    rgbSplitFilter = new PIXI.RGBSplitFilter();
    setRGBSplitFilterSize(3);
    

    pixelateFilter = new PIXI.PixelateFilter();
    pixelateFilter.size.x = 3;
    pixelateFilter.size.y = 3;

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    background = new PIXI.Graphics();
    background.beginFill(0x111111);
    background.drawRect(0, 0, window.innerWidth, window.innerHeight);
    stage.addChild(background);

    scene = new Scene(gameConfig.baseSceneWidth, gameConfig.baseSceneHeight);

    stage.addChild(scene);
    updateGameSize();
    
    window.onresize = updateGameSize;

    stage.filters = [pixelateFilter, rgbSplitFilter];
    // stage.filters = [pixelateFilter];

    hudManager.init();
    racketsManager.init();
    physicsEngine.init();
    particlesManager.init();

    

    startTime = appManager.getStartTime();
    checkDeltaInterval = setInterval(checkDelta, gameConfig.checkDeltaIntervalTime);
    update();
}

function update(time) {
    requestAnimFrame( update );
    if (time) {

        // scanFilter.uniforms.power.value += (ease -  scanFilter.uniforms.power.value ) * 0.3;

        scanFilter.uniforms.noise.value += 0.1;
        scanFilter.uniforms.noise.value %= 1;
        scanFilter.syncUniforms();

        setRGBSplitFilterSize(time);

        delta = (time - lastTime) * 0.001;
        lastTime = time;
        stats.update();
        physicsEngine.update(delta);
        particlesManager.update(delta);

        renderer.render(stage);
    }
}

// Manually update physics if requestAnimFrame not available (if tab inactive)
function checkDelta() {
    var tempTime = new Date() - startTime;
    // console.log('tempTime', tempTime);
    // console.log('lastTime', lastTime);
    if(tempTime - lastTime >= gameConfig.checkDeltaIntervalTime) {
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

    var ratioW = window.innerWidth  / gameConfig.baseSceneWidth;
    var ratioH = window.innerHeight / gameConfig.baseSceneHeight;

    if (ratioW < ratioH) {
        ratio = ratioW;
        dec.x = 0;
        dec.y = (window.innerHeight - gameConfig.baseSceneHeight * ratio) / 2;
    }
    else {
        ratio = ratioH;
        dec.x = (window.innerWidth - gameConfig.baseSceneWidth * ratio) / 2;
        dec.y = 0;
    }

    scene.scale = new PIXI.Point(ratio, ratio);
    scene.x = dec.x;
    scene.y = dec.y;

    background.width = window.innerWidth;
    background.height = window.innerHeight;

    physicsEngine.updateSceneResizeValues(dec, ratio);
}

function setPixelShaderSize(size) {
    pixelateFilter.size.x = size;
    pixelateFilter.size.y = size;
}

function setRGBSplitFilterSize(time, size) {
    size = size || 2;
    var value = time/160;
    rgbSplitFilter.red = {
        x: Math.cos(value) * size,
        y: Math.sin(value) * size
    };
    rgbSplitFilter.green = {
        x: Math.cos(value + Math.PI * 2 / 3) * size,
        y: Math.sin(value + Math.PI * 2 / 3) * size
    };  
    rgbSplitFilter.blue = {
        x: Math.cos(value + Math.PI * 4 / 3) * size,
        y: Math.sin(value + Math.PI * 4 / 3) * size
    };
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

function getRatio() {
    return ratio;
}

module.exports = {
    init: init,
    setPixelShaderSize: setPixelShaderSize,
    getScene: getScene,
    getStage: getStage,
    getDec: getDec,
    getRatio: getRatio
};
