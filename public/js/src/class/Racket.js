Racket = function(pos, color) {
    PIXI.DisplayObjectContainer.call( this );
    pos = pos || new Vector2();
    this.color = color || 0xFFFFFF;
    this.size = 240;

    this.graphics = new PIXI.Graphics();
    this.graphics.beginFill(this.color);
    this.graphics.drawRect(0, 0, 40, this.size);
    this.addChild(this.graphics);

    this.vel = new Vector2();

    this.updatePivot();
    this.x = pos.x;
    this.y = pos.y;

    this.movingToY = 0;
};

Racket.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Racket.prototype.constructor = Racket;

Racket.prototype.setMovingToY = function(y) {
	this.movingToY = y - this.height * 0.5 < 0 ? this.height * 0.5 :
                     y + this.height * 0.5 > gameConfig.baseSceneHeight ? gameConfig.baseSceneHeight - this.height * 0.5 :
                     y;

};

Racket.prototype.updatePivot = function() {
    this.pivot.x = this.width * 0.5;
    this.pivot.y = this.height * 0.5;
};


module.exports = Racket;