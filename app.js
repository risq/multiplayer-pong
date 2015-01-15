var config   = require('./public/config.json');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var port = process.env.PORT || 1337;

global.deviceConnectionsManager = require('./src/deviceConnectionsManager');
global.gameRoomsManager = require('./src/gameRoomsManager');
var Player = require('./src/class/Player');

app.use(express.static(__dirname + '/dist'));

server.listen(port);


//for security
try {
    deviceConnectionsManager.init(io);
    deviceConnectionsManager.onPlayerJoin(function (deviceConnection) {
        gameRoomsManager.findGameRoom(new Player(deviceConnection));
    });
    console.log('[server started on port ' + port + ']');
} catch (err) {
    console.log(err);
}
