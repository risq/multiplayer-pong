Racket = function(side, color) {
    PIXI.DisplayObjectContainer.call( this );
    this.color = color || 0xFFFFFF;
    this.side = side;

    var graphics = new PIXI.Graphics();
    graphics.beginFill(this.color);
    graphics.drawRect(0, 0, 80, 20);
    this.addChild(graphics);

    this.vel = new Vector2();
};

Racket.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Racket.prototype.constructor = Racket;

Racket.prototype.init = function() {
	
};


