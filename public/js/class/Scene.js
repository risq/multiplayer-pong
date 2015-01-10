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
	
};

Scene.prototype.drawBounds = function() {
	var graphics = new PIXI.Graphics();
 	 
	graphics.beginFill(0x333333);
	// graphics.lineStyle(5, 0xFFFFFF);
	graphics.drawRect(0, 0, this.baseWidth, this.baseHeight);

	this.addChild(graphics);

	console.log(this);
};

Scene.prototype.getCenter = function() {
	return new Vector2(this.baseWidth / 2, this.baseHeight / 2);
};

Scene.prototype.clearObjectsOfType = function(type) {
	console.log('removing all objects of type ' + type);
	var objects = _.filter(this.children, function(object) { 
		return object instanceof type;
	});

	objects.forEach(function(object) {
		this.removeChild(object);
	}.bind(this));

}



