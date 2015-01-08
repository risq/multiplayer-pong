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

    // find the first waiting room
    if (waitingRooms.length) {
        firstWaitingRoom = _.find(waitingRooms, function(room) {
            return room.isReady === false;
        });
    }

    console.log('Finding a game room for new player..');

    if (firstWaitingRoom) {
        if (firstWaitingRoom.join(player, this)) {

            gameRooms[firstWaitingRoom.ID] = firstWaitingRoom;
            waitingRooms.splice(0, 1);

            console.log('Successfully joined room #' + firstWaitingRoom.ID);
        } else {
            console.log('Error joining the room');
        }
    } else { // no waiting room : create one
        var newGameRoom = createGameRoom();
        if (newGameRoom.join(player)) {

            waitingRooms.push(newGameRoom);
            
            console.log('Successfully joined new room #' + newGameRoom.ID);
        } else {
            console.log('Error joining the room');
        }
    }
}

function onPlayerDisconnect(gameRoomID, hostDisconnected) { // todo: when both players disconnect bug to fix
    console.log('Player disconnected from room #' + gameRoomID); 
    var remainingPlayer;
    
    if (gameRooms[gameRoomID] && gameRooms[gameRoomID].isReady) {
        remainingPlayer = hostDisconnected ? gameRooms[gameRoomID].players.guestPlayer : gameRooms[gameRoomID].players.hostPlayer;
    }
    else {
        _.remove(waitingRooms, function(room) {
            return room.ID === gameRoomID;
        });
    }

    gameRooms[gameRoomID] = null;

    if (remainingPlayer) {
        findGameRoom(remainingPlayer);
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
    findGameRoom: findGameRoom, 
    onPlayerDisconnect: onPlayerDisconnect
};
