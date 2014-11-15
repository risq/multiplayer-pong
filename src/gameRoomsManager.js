/*===========================================
=            gameRoomsManager.js            =
===========================================*/


var GameRoom = require('./class/GameRoom'),
    _ = require('lodash');

var io,
    gameRooms = [],
    waitingRooms = [];


// Callbacks
var onPlayerJoin = function() {};

function init(socketio) {

}

function findGameRoom(player) {

    var firstWaitingRoom = null;

    if (waitingRooms.length) {
        firstWaitingRoom = _.find(waitingRooms, function(room) {
            return room.isReady === false;
        });
    }

    console.log('finding a game room for new player..');

    if (firstWaitingRoom) {
        if (firstWaitingRoom.join(player.desktopSocket, player.mobileSocket)) {
            gameRooms[firstWaitingRoom.gameRoomID] = firstWaitingRoom;
            waitingRooms.splice(0, 1);
        } else {
            console.log('error joining the room');
        }
    } else { // no waiting room : create one
        var newGameRoom = createGameRoom();
        if (newGameRoom.join(player.desktopSocket, player.mobileSocket)) {
            waitingRooms.push(newGameRoom);
            console.log('Successfully joined new room #' + newGameRoom.gameRoomID);
        }
    }
}

function createGameRoom() {
    var roomID = (Math.random() * 100000) | 0;
    if (gameRooms[roomID]) {
        return createGameRoom();
    } else {
        return new GameRoom(roomID);
    }
}

module.exports = {
    init: init,
    findGameRoom: findGameRoom
};
