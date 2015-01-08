
$(function(){

	demoInit();

});


function demoInit() {

	$.getJSON("../config.json", function(data) {

		var address = data.url+":"+data.port;

		$.getScript( 'http://'+address+"/socket.io/socket.io.js" )
			.done(function( ) {
				deviceConnection.init(address);
			});

	});

}


/**************************************************
 * App
 ***************************************************/
var App = {

};


/**************************************************
 * Connection
 ***************************************************/
var deviceConnection = {


	init : function (address) {

		this.socket = io.connect(address);

		this.sendHostRequest();
		this.bindSocketEvents();


	},

	sendHostRequest : function () {
		this.socket.emit('newHosting');
	},

	bindSocketEvents : function() {
		this.socket.on('newConnectionID', this.onNewConnectionID.bind(this) );
		this.socket.on('newConnection', this.onNewBridge.bind(this) );
	},


	onNewConnectionID : function(data) {
		this.socket.removeListener('newConnectionID');
		
		//display text + qrcode
		var $container = $('#info-connection').show(),
			$url = $('.mobile-url', $container),
			$qrcode	= $('#qr-scan', $container);

		var urlMobile	= window.location.href+"mobile?id="+ data.connectionID;

		$url.text(urlMobile);
		$qrcode.qrcode({width:'200', height:'200', text:urlMobile});


	},

	onNewBridge : function() {

		$('#info-connection').hide();
		this.socket.removeListener('newConnection');

		this.initApp();
	},

	initApp : function () {

		var $containerInfo = $('#container-info').show();
		var $gameState = $('#game-state');
		var $playerControlData = $('#player-control-data');
		var $opponentControlData = $('#opponent-control-data');

		var isHost;
		var gameRoomID;

		this.socket.on('mobile top', function() {
			$playerControlData.html('top');
		});
		this.socket.on('mobile bottom', function() {
			$playerControlData.html('bottom');
		});
		this.socket.on('mobile stop', function() {
			$playerControlData.html('');
		});

		this.socket.on('opponent top', function() {
			console.log('opponent top');
			$opponentControlData.html('top');
		});

		this.socket.on('opponent bottom', function() {
			$opponentControlData.html('bottom');
		});

		this.socket.on('opponent stop', function() {
			$opponentControlData.html('');
		});

		this.socket.on('opponent disconnect', function() {
			$opponentControlData.html('');
			$gameState.html('Opponent disconnected...');
		});

		this.socket.on('game joined', function(data) {
			console.log(data);
			isHost = data.isHost;
			gameRoomID = data.gameRoomID;
			$gameState.html('Game #' + gameRoomID + ' joined. Waiting for another player...');
		});

		this.socket.on('game ready', function() {
			if (isHost) {
				$gameState.html('Game #' + gameRoomID + ' (host)');
			}
			else {
				$gameState.html('Game #' + gameRoomID);
			}
		});


	}
};


