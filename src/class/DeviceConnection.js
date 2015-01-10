/*========================================
=            DeviceConnection            =
========================================*/

function DeviceConnection(connectionID, onConnectionReadyCallback) {
    this.connectionID = connectionID;
    this.desktop = null;
    this.mobile  = null;
    this.desktopOny = false;
    this.onConnectionReadyCallback = onConnectionReadyCallback;
}

var p = DeviceConnection.prototype;

p.setMobile = function(socket) {
    if (!this.desktopOny && !this.mobile) {
        this.mobile = socket;
        this.sendConnectionReady();
    }
};

p.setDesktop = function(socket) {
    this.desktop = socket;
};

p.setDesktopOnly = function() {
    this.desktopOny = true;
    if (this.desktop) {
        this.sendConnectionReady();   
    }
}

p.sendConnectionReady = function() {
    console.log('sendConnectionReady')
    this.desktop.emit('connectionReady');
    if (this.mobile) {
        this.mobile.emit('connectionReady');
    }
    this.onConnectionReadyCallback(this)
}

/*
 * Active events for the two socket
 */
p.initEvents = function(player) {
    this.desktop.on('disconnect', player.onDisconnect.bind(player));
    if (this.mobile) {
        this.initMobileEvents();
    }
};

p.initMobileEvents = function() {
    this.mobile.on('mobileTop', player.onMobileTop.bind(player));
    this.mobile.on('mobileBottom', player.onMobileBottom.bind(player));
    this.mobile.on('mobileStop', player.onMobileStop.bind(player));
}

p.getPlayerSockets = function() {
    return {
        desktopSocket: this.desktop,
        mobileSocket: this.mobile
    };
};

module.exports = DeviceConnection;
