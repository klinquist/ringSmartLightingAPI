const request = require('request');
const io = require('socket.io-client');
const socketsync = require('./socketSync');
const sync = new socketsync({});

const ua = 'android:com.ringapp:2.0.67(423)';

exports.getAccesToken = (refreshToken, cb) => {
    const requestObj = {
        method: 'POST',
        uri: 'https://oauth.ring.com/oauth/token',
        json: true,
        body: {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: 'ring_official_android',
            scope: 'client'
        }
    };
    request(requestObj, (err, res, body) => {
        if (body && body.access_token) {
            body.created = Date.now();
            return cb(err, body);
        } else {
            return cb(err);
        }
    });
};

exports.getLocations = (accessToken, cb) => {
    const requestObj = {
        method: 'GET',
        uri: 'https://app.ring.com/rhq/v1/devices/v1/locations',
        json: true,
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'User-Agent': ua,
        }
    };
    request(requestObj, (err, res, locations) => {
        if (locations && locations.user_locations) {
            return cb(null, locations.user_locations);
        } else {
            return cb('Could not get locations');
        }

    });
};

exports.getTicketUrl = (accessToken, locationId, cb) => {
    const requestObj = {
        method: 'GET',
        uri: 'https://app.ring.com/api/v1/clap/tickets?locationID=' + locationId,
        json: true,
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'User-Agent': ua,
            'Content-type': 'application/x-www-form-urlencoded'
        }
    };
    request(requestObj, (err, res, tickets) => {
        if (tickets) {
            return cb(null, tickets);
        } else {
            return cb('Could not get devices');
        }

    });
};

const sockets = {};

exports.openSocket = (url, cb) => {
    if (sockets[url]) return cb();
    sockets[url] = io(url, {
        transports: ['websocket']
    });
    sockets[url].on('message', (msg) => {
        sync.processIncomingMessage(url, msg);
    });
    sockets[url].on('connect', cb);
};

exports.send = (url, msg, cb) => {
    sync.send(sockets[url], url, msg, cb);
};

exports.closeSockets = () => {
    for (const k in sockets) {
        sockets[k].close();
        delete sockets[k];
    }
};