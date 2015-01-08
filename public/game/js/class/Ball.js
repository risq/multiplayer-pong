Ball = function(radius, color, posX, posY) {
    PIXI.DisplayObjectContainer.call( this );
    this.radius = radius || 10;
    this.color  = color  || 0xFFFFFF;
    this.vel = new Vector2(0, 0);

    this.x = posX;
    this.y = posY;

    this.init();
};

Ball.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Ball.prototype.constructor = Ball;

Ball.prototype.init = function() {
	var graphics = new PIXI.Graphics();
	graphics.beginFill(this.color);
 	 
	// draw a rectangle
	graphics.drawCircle(0, 0, this.radius);

	this.addChild(graphics);

	console.log(this);
};

Ball.prototype.update = function(delta) {
	this.x = this.x + this.vel.x * delta;
	this.y = this.y + this.vel.y * delta;
};

Ball.prototype.setVel = function(vel) {
	this.vel.copy(vel);
};

Ball.prototype.addVel = function(vel) {
	this.vel.addSelf(vel);
};