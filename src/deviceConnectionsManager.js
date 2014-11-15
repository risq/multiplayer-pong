/*===================================================
=            deviceConnectionsManager.js            =
===================================================*/


var DeviceConnection = require('./class/DeviceConnection');

var io,
    deviceConnections = [];


// Callbacks
var onPlayerJoinCallback = function() {};

function init(socketio) {
    io = socketio;

    //Evenement connection
    io.sockets.on('connection', function(socket) {

        socket.on('newHosting', function() {
            newHost(socket);
        });

        socket.on('joinHosting', function(data) {
            newJoin(socket, data);
        });
    });
}


function newHost(socket) {
    // Create a unique Socket.IO Room
    var connectionID = (Math.random() * 100000) | 0;

    var room = io.sockets.adapter.rooms[connectionID];

    // if room don't exist
    if (room === undefined) {
        // Return the id
        socket.emit('newConnectionID', {
            connectionID: connectionID,
            mySocketId: socket.id
        });
        //join the Room
        socket.join(connectionID);

        //we create new DeviceConnection
        deviceConnections[connectionID] = new DeviceConnection(connectionID);
        deviceConnections[connectionID].setComputer(socket);
    } else {
        this.newHost(socket);
    }
}


function newJoin(socket, data) {

    var connectionID = data.connectionID;
    var room = io.sockets.adapter.rooms[connectionID];

    // if room exist
    if (room !== undefined) {
        socket.join(connectionID);
        deviceConnections[connectionID].setMobile(socket);
        onPlayerJoinCallback(deviceConnections[connectionID].getPlayerSockets());
    } else {
        //socket.emit('error', {errorType: -1, message: "Aucune room correspondante"});
    }
}

function onPlayerJoin(callback) {
    onPlayerJoinCallback = callback;
}

module.exports = {
    init: init,
    newHost: newHost,
    newJoin: newJoin,
    onPlayerJoin: onPlayerJoin
};
