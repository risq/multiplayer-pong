/*========================================
=            DeviceConnection            =
========================================*/

function DeviceConnection(connectionID) {
    this.connectionID = connectionID;
}

var p = DeviceConnection.prototype;

p.setMobile = function(socket) {

    this.mobile = socket;
    this.mobile.emit('newConnection');
    this.desktop.emit('newConnection');
};

p.setDesktop = function(socket) {
    this.desktop = socket;
};

/*
 * Active events for the two socket
 */
p.initEvents = function(player) {
    this.mobile.on('mobileTop', player.onMobileTop.bind(player));
    this.mobile.on('mobileBottom', player.onMobileBottom.bind(player));
    this.mobile.on('mobileStop', player.onMobileStop.bind(player));
    this.desktop.on('disconnect', player.onDisconnect.bind(player));
};

p.getPlayerSockets = function() {
    return {
        desktopSocket: this.desktop,
        mobileSocket: this.mobile
    };
};

module.exports = DeviceConnection;
