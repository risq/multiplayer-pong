var scanFilter,
    rgbSplitFilter,
    pixelateFilter,
    power = 3;


function init() {

    var uniforms = {};

    uniforms.power = {
        type: '1f',
        value: 1 / 1000
    };
    uniforms.noise = {
        type: '1f',
        value: 0.2
    };

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

    scanFilter = new PIXI.AbstractFilter( fragmentSrc, uniforms );

    rgbSplitFilter = new PIXI.RGBSplitFilter();
    setRGBSplitFilterSize( 3 );


    pixelateFilter = new PIXI.PixelateFilter();

    setPixelShaderSize( 3 );

    stageManager.getStage().filters = [ pixelateFilter, rgbSplitFilter ];

}

function update( delta, time ) {
    
    // scanFilter.uniforms.power.value += (ease -  scanFilter.uniforms.power.value ) * 0.3;

    // scanFilter.uniforms.noise.value += 0.1;
    // scanFilter.uniforms.noise.value %= 1;
    // scanFilter.syncUniforms();


    // random auto glitch
    power = power > 3 ? power * 0.9 : (Math.random() > 0.995 ? Math.random() * 30 : 3);

    setRGBSplitFilterSize( time, power * 2 / 3 );
    setPixelShaderSize( power );

}

function glitch( size ) {

    size = size || 20;
    power = Math.random() * size;

}

function setPixelShaderSize( size ) {

    pixelateFilter.size.x = size;
    pixelateFilter.size.y = size;

}

function setRGBSplitFilterSize( time, size ) {

    var value = time / 160;

    rgbSplitFilter.red = {
        x: Math.cos( value ) * size,
        y: Math.sin( value ) * size
    };

    rgbSplitFilter.green = {
        x: Math.cos( value + Math.PI * 2 / 3 ) * size,
        y: Math.sin( value + Math.PI * 2 / 3 ) * size
    };

    rgbSplitFilter.blue = {
        x: Math.cos( value + Math.PI * 4 / 3 ) * size,
        y: Math.sin( value + Math.PI * 4 / 3 ) * size
    };

}

module.exports = {
    init: init,
    update: update,
    glitch: glitch
};
