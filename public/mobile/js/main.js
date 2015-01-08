$(function() {
	mobileInit();
});


/**************************************************
 * INIT
 ***************************************************/
function mobileInit() {

	$.getJSON("/config.json", function(data) {

		var address = data.url+":"+data.port;

		$.getScript( 'http://'+address+"/socket.io/socket.io.js" )
			.done(function( ) {
				MobileController.init(address);
			});


	});

}


/**************************************************
 * MobileController
 ***************************************************/
var MobileController = {

	init: function(address) {

		this.address = address;

		this.socket = io.connect(this.address);

		var idGame = this.getQueryVariable('id');


		//if id, automatic connection
		var self = this;

		if(idGame !== false) {
			self.sendJoinRequest(idGame);
		}

	},


	sendJoinRequest : function (id) {

		var data = {
			connectionID : id
		};

		var self = this;

		this.socket.emit('joinHosting', data);

		this.socket.on('newConnection', function() {
			self.bindActionController();
			self.socket.off('newConnection');
		});
	},


	bindActionController: function () {

		var self = this;

		$('#button-top').on('touchstart mousedown', function() {
			self.socket.emit('mobileTop');
			console.log('emitting ' + mobileTop);
		})
		.on('touchend mouseup', function(){
			self.socket.emit('mobileStop');
			console.log('emitting ' + mobileStop);
		});


		$('#button-bottom').on('touchstart mousedown', function() {
			self.socket.emit('mobileBottom');
			console.log('emitting ' + mobileBottom);
		})
		.on('touchend mouseup', function(){
			self.socket.emit('mobileStop');
			console.log('emitting ' + mobileStop);
		});
	},



	getQueryVariable : function(variable) {
		var query = window.location.search.substring(1);
		var vars = query.split("&");
		for (var i=0;i<vars.length;i++) {
			var pair = vars[i].split("=");
			if(pair[0] == variable){return pair[1];}
		}
		return(false);
	}


};
