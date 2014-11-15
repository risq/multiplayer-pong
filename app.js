var config   = require('./public/config.json');
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var deviceConnectionsManager = require('./src/deviceConnectionsManager');
var gameRoomsManager = require('./src/gameRoomsManager');

app.use(express.static(__dirname + '/public'));

server.listen(config.port, config.url);

//for security
try {
    deviceConnectionsManager.init(io);
    deviceConnectionsManager.onPlayerJoin(function (player) {
        gameRoomsManager.findGameRoom(player);
    });
} catch (err) {
    console.log(err);
}
