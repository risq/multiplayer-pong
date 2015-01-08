/*========================================
=                 Player                 =
========================================*/

function Player(deviceConnection) {
    this.deviceConnection = deviceConnection;
    this.room = null;
    this.opponent = null;
    this.isHost = false;
}

var p = Player.prototype;

p.onRoomJoin = function(room) {
    this.room = room;
    this.deviceConnection.initEvents(this);
};

p.onMobileTop = function() {
    this.emmit('mobile top');
    this.emmitOpponent('opponent top');
};

p.onMobileBottom = function() {
    this.emmit('mobile bottom');
    this.emmitOpponent('opponent bottom');
};

p.onMobileStop = function() {
    this.emmit('mobile stop');
    this.emmitOpponent('opponent stop');
};

p.onDisconnect = function() {
    this.emmitOpponent('opponent disconnect');

    setTimeout(function () {
        gameRoomsManager.onPlayerDisconnect(this.room.ID, this.isHost);
    }.bind(this), 1000);
    
};

p.emmit = function(message, data) {
    this.deviceConnection.desktop.emit(message, data);
};

p.emmitOpponent = function(message, data) {
    if (this.opponent) {
        this.opponent.deviceConnection.desktop.emit(message, data);
    }
};



module.exports = Player;
