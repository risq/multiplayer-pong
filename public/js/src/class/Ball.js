Ball = function(ID, pos, color, size) {
    PIXI.DisplayObjectContainer.call( this );
    this.ID = ID;
    this.size = size || 28;
    this.color  = color  || parseInt(Please.make_color().slice(1), 16);
    this.colorHex = '#' + this.color.toString(16);
    this.vel = new Vector2(0, 0);
    this.out = false;

    this.physics = false;

	var graphics = new PIXI.Graphics();
	graphics.beginFill(this.color);
	graphics.drawRect(0, 0, this.size, this.size);
    this.addChild(graphics);

    this.x = pos ? pos.x : 0;
    this.y = pos ? pos.y : 0;
    
};

Ball.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Ball.prototype.constructor = Ball;

Ball.prototype.enablePhysics = function() {
    this.physics = true;
};

Ball.prototype.disablePhysics = function() {
	this.physics = false;
};


module.exports = Ball;