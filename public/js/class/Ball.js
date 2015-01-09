Ball = function(pos, radius, color) {
    PIXI.DisplayObjectContainer.call( this );
    this.radius = radius || 28;
    this.color  = color  || parseInt(Please.make_color().slice(1), 16);
    this.vel = new Vector2(0, 0);

    console.log();

	var graphics = new PIXI.Graphics();
	graphics.beginFill(this.color);
	graphics.drawRect(0, 0, this.radius, this.radius);
	this.addChild(graphics);

    this.x = pos ? pos.x : 0;
    this.y = pos ? pos.y : 0;
};

Ball.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Ball.prototype.constructor = Ball;

Ball.prototype.init = function() {
	
};

