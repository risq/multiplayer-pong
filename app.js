var config   = require('./public/config.json');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var deviceConnectionsManager = require('./src/deviceConnectionsManager');
global.gameRoomsManager = require('./src/gameRoomsManager');
var Player = require('./src/class/Player');

app.use(express.static(__dirname + '/public'));

server.listen(config.port, config.url);

//for security
try {
    deviceConnectionsManager.init(io);
    deviceConnectionsManager.onPlayerJoin(function (deviceConnection) {
        gameRoomsManager.findGameRoom(new Player(deviceConnection));
    });
    console.log('[server started on port ' + config.port + ']');
} catch (err) {
    console.log(err);
}
