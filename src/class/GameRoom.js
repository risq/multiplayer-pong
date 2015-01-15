/*================================
=            GameRoom            =
================================*/

function GameRoom(ID) {
    this.ID = ID;
    this.players = [{
            hostPlayer: null,
            guestPlayer: null
        }];
    this.isReady = false;
}

var p = GameRoom.prototype;

p.join = function(player) { 

    //console.log('a player try to join game room #' + this.ID);

    if (this.isReady) {
        return false;
    } else if (this.players.hostPlayer) {
        //console.log('player joined as guest !');
        player.isHost = false;
        this.players.guestPlayer = player;
        this.players.guestPlayer.deviceConnection.desktop.emit('game joined', {
            gameRoomID: this.ID,
            isHost: false
        });

        this.players.guestPlayer.opponent = this.players.hostPlayer;
        this.players.hostPlayer.opponent  = this.players.guestPlayer;

    } else {
        //console.log('player joined as host !');
        player.isHost = true;
        this.players.hostPlayer = player;
        this.players.hostPlayer.deviceConnection.desktop.emit('game joined', {
            gameRoomID: this.ID,
            isHost: true
        });
    }

    player.onRoomJoin(this);

    if (this.players.guestPlayer) {
        this.isReady = true;
        this.onGameReady();
    }

    return true;
};

p.onGameReady = function() {
    this.players.hostPlayer.deviceConnection.desktop.emit('game ready');
    this.players.guestPlayer.deviceConnection.desktop.emit('game ready');
    this.bindEvents();
    this.startGame();
};

p.startGame = function() {

};

p.bindEvents = function() {
    // var self = this;
    // this.mobile.on('mobileTop', function() {
    //     self.computer.emit('top');
    // });
    // this.mobile.on('mobileBottom', function() {
    //     self.computer.emit('bottom');
    // });
    // this.mobile.on('mobileStop', function() {
    //     self.computer.emit('stop');
    // });
};


module.exports = GameRoom;
