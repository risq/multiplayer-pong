Hud = function() {
    PIXI.DisplayObjectContainer.call( this );
    this.infos = new PIXI.Text('', {font: 'bold 40px Arial'});
    this.infos.x = 10;
    this.infos.y = 10;
    this.addChild(this.infos);

    this.debug1 = new PIXI.Text('');
    this.debug1.x = 100;
    this.debug1.y = 400;
    this.addChild(this.debug1);

    this.debug2 = new PIXI.Text('');
    this.debug2.x = 400;
    this.debug2.y = 400;
    this.addChild(this.debug2);

};

Hud.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Hud.prototype.constructor = Hud;

Hud.prototype.setInfosText = function(text) {
    this.infos.setText(text);
    this.infos.setStyle({
        font: 'bold 40px Arial',
        fill: Please.make_color()});
};

Hud.prototype.setDebug1Text = function(text) {
    this.debug1.setText(text);
    this.debug1.setStyle({fill: Please.make_color()});
};

Hud.prototype.setDebug2Text = function(text) {
    this.debug2.setText(text);
    this.debug2.setStyle({fill: Please.make_color()});
};


module.exports = Hud;