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

p.onSync = function(data) {
    if (this.isHost || data.event === 'racketMove') {
        this.emitOpponent('sync', data);
    }
};

p.onTop = function() {
    this.emitOpponent('opponent top');
};

p.onBottom = function() {
    this.emitOpponent('opponent bottom');
};

p.onStop = function() {
    this.emitOpponent('opponent stop');
};

p.onMobileTop = function() {
    this.emit('mobile top');
    this.emitOpponent('opponent top');
};

p.onMobileBottom = function() {
    this.emit('mobile bottom');
    this.emitOpponent('opponent bottom');
};

p.onMobileStop = function() {
    this.emit('mobile stop');
    this.emitOpponent('opponent stop');
};

p.onDisconnect = function() {
    this.emitOpponent('opponent disconnect');

    setTimeout(function () {
        gameRoomsManager.onPlayerDisconnect(this.room.ID, this.isHost);
    }.bind(this), 1000);
    
};

p.emit = function(message, data) {
    this.deviceConnection.desktop.emit(message, data);
};

p.emitOpponent = function(message, data) {
    if (this.opponent) {
        this.opponent.deviceConnection.desktop.emit(message, data);
    }
};



module.exports = Player;
