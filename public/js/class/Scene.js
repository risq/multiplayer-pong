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

	this.particlesContainer = new PIXI.DisplayObjectContainer();        
	this.racketsContainer   = new PIXI.DisplayObjectContainer();        
	this.ballsContainer     = new PIXI.DisplayObjectContainer(); 

    this.addChild(this.particlesContainer);
    this.addChild(this.racketsContainer);
    this.addChild(this.ballsContainer);
};

Scene.prototype.drawBounds = function() {
	var graphics = new PIXI.Graphics();
 	 
	graphics.beginFill(0x222222);
	// graphics.lineStyle(5, 0xFFFFFF);
	graphics.drawRect(0, 0, this.baseWidth, this.baseHeight);

	this.addChild(graphics);
};

Scene.prototype.getCenter = function() {
	return new Vector2(this.baseWidth / 2, this.baseHeight / 2);
};

Scene.prototype.clearObjectsOfType = function(type) {
	var objects = _.filter(this.children, function(object) { 
		return object instanceof type;
	});

	objects.forEach(function(object) {
		this.removeChild(object);
	}.bind(this));
}

Scene.prototype.clearBalls = function() {
	this.ballsContainer.removeChildren();
}

Scene.prototype.addBall = function(ball) {
	this.ballsContainer.addChild(ball);
}

Scene.prototype.removeBall = function(ball) {
	this.ballsContainer.removeChild(ball);
}

Scene.prototype.addRacket = function(racket) {
	this.racketsContainer.addChild(racket);
}

Scene.prototype.getParticlesContainer = function() {
	return this.particlesContainer;
}

Scene.prototype.getRacketsContainer = function() {
	return this.racketsContainer;
}

Scene.prototype.getBallsContainer = function() {
	return this.ballsContainer;
}




