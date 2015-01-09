Racket = function(pos, color) {
    PIXI.DisplayObjectContainer.call( this );
    pos = pos || new Vector2();
    this.color = color || 0xFFFFFF;
    this.size = 240;

    var graphics = new PIXI.Graphics();
    graphics.beginFill(this.color);
    graphics.drawRect(0, 0, 40, this.size);
    this.addChild(graphics);

    this.vel = new Vector2();

    this.updatePivot();
    this.x = pos.x;
    this.y = pos.y;
};

Racket.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Racket.prototype.constructor = Racket;

Racket.prototype.init = function() {
	
};

Racket.prototype.updatePivot = function() {
    this.pivot.x = this.width / 2;
    this.pivot.y = this.height / 2;
};
