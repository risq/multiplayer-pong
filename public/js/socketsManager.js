G.socketsManager = (function() {
    
    var socket,
        connectionID,
	    onReady = function() {};

    function init(onReadyCallback) {
        onReady = onReadyCallback || onReady;

    	$.getJSON("../config.json", function(data) {
            var address = data.url + ":" + data.port;

            $.getScript('http://' + address + '/socket.io/socket.io.js')
                .done(function( ) {
                    initSocket(address);
                });
        });

    }

    function initSocket(address) {

        socket = io.connect(address);

        sendHostRequest();
        bindSocketEvents();
    }

    function sendHostRequest() {
        socket.emit('newHosting');
    }

    function bindSocketEvents() {
        socket.on('newConnectionID', onNewConnectionID);
        socket.on('connectionReady', onConnectionReady);
    }

    function onNewConnectionID(data) {
        socket.removeListener('newConnectionID');

        connectionID = data.connectionID;
        
        //display text + qrcode
        var $container = $('#info-connection').show(),
            $url = $('.mobile-url', $container),
            $qrcode = $('#qr-scan', $container);

        var urlMobile   = window.location.href+"mobile?id="+ data.connectionID;

        $url.text(urlMobile);
        $qrcode.qrcode({width:'200', height:'200', text:urlMobile});

        $('#desktop-only').on('click', onClickDesktopOnly);
    }

    function onClickDesktopOnly() {
        socket.emit('desktopOnly', connectionID);
    }

    function onConnectionReady() {

        $('#info-connection').hide();
        socket.removeListener('connnectionReady');

        initApp();
        onReady();
    }

    function initApp () {

        var $containerInfo = $('#container-info').show();
        var $gameState = $('#game-state');
        var $playerControlData = $('#player-control-data');
        var $opponentControlData = $('#opponent-control-data');

        var isHost;
        var gameRoomID;

        socket.on('mobile top', function() {
            G.hudManager.setDebug1Text('YOU: top');
        });
        socket.on('mobile bottom', function() {
            G.hudManager.setDebug1Text('YOU: bottom');
        });
        socket.on('mobile stop', function() {
            G.hudManager.setDebug1Text('YOU: ');
        });

        socket.on('opponent top', function() {
            G.hudManager.setDebug2Text('HIM: top');
        });

        socket.on('opponent bottom', function() {
            G.hudManager.setDebug2Text('HIM: bottom');
        });

        socket.on('opponent stop', function() {
            G.hudManager.setDebug2Text('HIM: ');
        });

        socket.on('opponent disconnect', function() {
            G.hudManager.setInfosText('Opponent disconnected...');
            G.appManager.onOpponentDisconnect();
        });

        socket.on('game joined', function(data) {
            isHost = data.isHost;
            gameRoomID = data.gameRoomID;
            G.hudManager.setInfosText('Game #' + gameRoomID + ' joined. \nWaiting for another player...');
        });

        socket.on('game ready', function() {
            if (isHost) {
                G.hudManager.setInfosText('Game #' + gameRoomID + ' [HOST]');
            }
            else {
                G.hudManager.setInfosText('Game #' + gameRoomID);
            }
            G.appManager.onGameReady();
        });
    }

	return {
		init: init
	};
})();