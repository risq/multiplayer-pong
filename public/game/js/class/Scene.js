Scene = function(baseWidth, baseHeight) {
    PIXI.DisplayObjectContainer.call( this );
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;
    this.init();
};

Scene.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Scene.prototype.constructor = Scene;

Scene.prototype.init = function() {
	this.drawBounds();
	this.ball = new Ball(8, null, 400, 300);
	this.addChild(this.ball);
	this.ball.setVel(new Vector2(250, 250));
};

Scene.prototype.update = function(delta) {
	if (this.ball) {
		this.ball.update(delta);
	}
};

Scene.prototype.drawBounds = function() {
	var graphics = new PIXI.Graphics();
 	 
	graphics.beginFill(0x000000);
	graphics.lineStyle(5, 0xFF0000);
	graphics.drawRect(0, 0, this.baseWidth, this.baseHeight);

	this.addChild(graphics);

	console.log(this);
};




