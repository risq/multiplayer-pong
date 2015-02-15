$(function() {
	console.log('init');
	mobileInit();
});


/**************************************************
 * INIT
 ***************************************************/
function mobileInit() {

	var self = this;


	$.getJSON("/config.json", function(data) {

		self.address = data.url+":"+data.port;

		MobileController.init(address);

	});

}


/**************************************************
 * MobileController
 ***************************************************/
var MobileController = {

	init: function(address) {

		var self = this;
		this.address = address;

		$.getScript( 'http://'+this.address+"/socket.io/socket.io.js" )
			.done(function( ) {
				self.socket = io.connect(self.address);

				var idGame = self.getQueryVariable('id');

				//if id automatic connection
				if(idGame !== false) {
					self.sendJoinHosting(idGame);
				}

			});

	},


	sendJoinHosting : function (id) {

		var data = {
			connectionID : id
		};

		var self = this;

		this.socket.emit('joinHosting', data);

		this.socket.on('newBridge', function() {
			self.bindActionController();
			self.socket.off('newBridge');
		});
	},


	bindActionController: function () {

		var self = this;

		$('#button-top').on('touchstart', function() {
			self.socket.emit('mobileTop');
			console.log('mobileTop');
		})
		.on('touchend', function(){
			self.socket.emit('mobileStop');
			console.log('mobileStop');
		});


		$('#button-bottom').on('touchstart', function() {
			self.socket.emit('mobileBottom');
			console.log('mobileBottom');
		})
		.on('touchend', function(){
			self.socket.emit('mobileStop');
			console.log('mobileStop');
		});;
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
