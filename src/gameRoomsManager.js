/*===================================================
=            deviceConnectionsManager.js            =
===================================================*/


GameRoom = require('./class/GameRoom');

var io,
    deviceConnections = [];


// Callbacks
var onPlayerJoin = function() {};

function init(socketio) {

}

module.exports = {
    init: init
};
