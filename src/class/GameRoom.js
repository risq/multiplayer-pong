/*================================
=            GameRoom            =
================================*/

function GameRoom(gameRoomID) {
    this.gameRoomID = gameRoomID;
    this.players = {
        hostPlayer: null,
        guestPlayer: null
    };
    this.isReady = false;
}

GameRoom.prototype.join = function(desktopSocket, mobileSocket) {

    console.log('a player try to join game room #' + this.gameRoomID);

    if (this.players.guestPlayer) {
        return false;
    } else if (this.players.hostPlayer) {
        console.log('player joined as guest !');
        this.players.guestPlayer = {
            desktop: desktopSocket,
            mobile: mobileSocket || null
        };
        this.players.hostPlayer.desktop.emit('game joined', {
            gameRoomID: this.gameRoomID,
            isHost: false
        });

    } else {
        console.log('player joined as host !');
        this.players.hostPlayer = {
            desktop: desktopSocket,
            mobile: mobileSocket || null
        };
        this.players.hostPlayer.desktop.emit('game joined', {
            gameRoomID: this.gameRoomID,
            isHost: true
        });
    }

    if (this.players.guestPlayer) {
        this.isReady = true;
        this.players.hostPlayer.desktop.emit('game ready');
        this.players.guestPlayer.desktop.emit('game ready');
        this.bindEvents();
        this.startGame();
    }


    return true;
};

GameRoom.prototype.startGame = function() {

};

GameRoom.prototype.bindEvents = function() {
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
