/*========================================
=            DeviceConnection            =
========================================*/

function DeviceConnection(connectionID) {
    this.connectionID = connectionID;
}

DeviceConnection.prototype.setMobile = function(socket) {

    console.log("mobile ok");
    this.mobile = socket;
    this.mobile.emit('newBridge');
    this.desktop.emit('newBridge');

    this.bindEvents();
};

DeviceConnection.prototype.setComputer = function(socket) {
    this.desktop = socket;
};

/*
 * Active events for the two socket
 */
DeviceConnection.prototype.bindEvents = function() {
    this.mobile.on('mobileTop', function() {
        this.desktop.emit('top');
    }.bind(this));
    this.mobile.on('mobileBottom', function() {
        this.desktop.emit('bottom');
    }.bind(this));
    this.mobile.on('mobileStop', function() {
        this.desktop.emit('stop');
    }.bind(this));
};

DeviceConnection.prototype.getPlayerSockets = function() {
    return {
        desktop: this.desktop,
        mobile: this.mobile
    };
};

module.exports = DeviceConnection;
