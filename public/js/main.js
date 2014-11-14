
$(function(){

	demoInit();

});


function demoInit() {

	$.getJSON("../config.json", function(data) {

		var address = data.url+":"+data.port;

		$.getScript( 'http://'+address+"/socket.io/socket.io.js" )
			.done(function( ) {
				demoController.init(address);
			});

	});

}





/**************************************************
 * Connection
 ***************************************************/
var demoController = {


	init : function (address) {

		this.socket = io.connect(address);

		this.sendStardHosting();
		this.bindEventStart();


	},

	sendStardHosting : function () {
		this.socket.emit('newHosting');
	},

	bindEventStart : function() {
		this.socket.on('newConnectionID', this.onNewGameID.bind(this) );
		this.socket.on('newBridge', this.onNewBridge.bind(this) );
	},


	onNewGameID : function(data) {

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

		this.bindEventActions();
	},

	bindEventActions : function () {

		var $containerInfo = $('#container-info').show();

		this.socket.on('top', function() {
			$containerInfo.html('top');
		});
		this.socket.on('bottom', function() {
			$containerInfo.html('bottom');
		});
		this.socket.on('stop', function() {
			$containerInfo.html('stop');
		});

	}



}
