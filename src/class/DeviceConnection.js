/*========================================
=            DeviceConnection            =
========================================*/

function DeviceConnection(connectionID, onConnectionReadyCallback) {
    this.connectionID = connectionID;
    this.desktop = null;
    this.mobile  = null;
    this.desktopOnly = false;
    this.onConnectionReadyCallback = onConnectionReadyCallback;
}

var p = DeviceConnection.prototype;

p.setMobile = function(socket) {
    if (!this.desktopOnly && !this.mobile) {
        this.mobile = socket;
        this.sendConnectionReady();
    }
};

p.setDesktop = function(socket) {
    this.desktop = socket;
};

p.setDesktopOnly = function() {
    this.desktopOnly = true;
    if (this.desktop) {
        this.sendConnectionReady();   
    }
};

p.sendConnectionReady = function() {
    this.desktop.emit('connectionReady', this.desktopOnly ? 'desktopOnly' : 'remote');
    if (!this.desktopOnly && this.mobile) {
        this.mobile.emit('connectionReady');
    }
    this.onConnectionReadyCallback(this);
};

p.initEvents = function(player) {
    this.desktop.on('sync', player.onSync.bind(player));
    this.desktop.on('disconnect', player.onDisconnect.bind(player));

    if (this.mobile) {
        this.initMobileEvents(player);
    }
};

p.initMobileEvents = function(player) {
    this.mobile.on('mobileTop', player.onMobileTop.bind(player));
    this.mobile.on('mobileBottom', player.onMobileBottom.bind(player));
    this.mobile.on('mobileStop', player.onMobileStop.bind(player));
};

p.getPlayerSockets = function() {
    return {
        desktopSocket: this.desktop,
        mobileSocket: this.mobile
    };
};

module.exports = DeviceConnection;
