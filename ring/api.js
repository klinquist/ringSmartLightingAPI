const request = require('request');
const async = require('async');
const fs = require('fs');
const io = require('socket.io-client');
const socketsync = require('./socketSync');
const sync = new socketsync({});


const ua = 'android:com.ringapp:2.0.67(423)';


const writeRefreshToken = (authData) => {
    fs.writeFileSync('./auth.json', JSON.stringify(authData));
};


const getSwitchPayload = (zid, uuid, onOrOff) => {
    onOrOff = (onOrOff == 'on') ? 'on' : 'default';
    return {
        'body': [{
            'zid': zid,
            'command': {
                v1: [{
                    commandType: 'light-mode.set',
                    data: {
                        lightMode: onOrOff,
                        duration: 60
                    }
                }]
            }
        }],
        'datatype': 'DeviceInfoSetType',
        'dst': uuid,
        'msg': 'DeviceInfoSet',
        'seq': 3
    };
};


const getAccesToken = (refreshToken, cb) => {
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
            writeRefreshToken(body);
            return cb(err, body.access_token);
        } else {
            return cb(err);
        }
    });
};



const getLocations = (accessToken, cb) => {
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



const getTicketUrl = (accessToken, locationId, cb) => {
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


function Ring(refreshToken) {

    console.log('Ring Smart Lighting API by Kris Linquist');
    let auth, authStr;
    try {
        authStr = fs.readFileSync('./auth.json');
        auth = JSON.parse(authStr);
    } catch (e) {

    }

    if (!auth || !auth.refresh_token) {
        if (refreshToken) {
            console.log('Using refresh token from init');
            auth = {
                refresh_token: refreshToken
            };
        } else {
            throw new Error('Ring Smart Lighting API must be initialized with a refreshToken');
        }
    } else {
        console.log('Using refresh token from file');
    }

    this.refreshToken = auth.refresh_token;
    const sockets = {};

    const openSocket = (url, cb) => {
        sockets[url] = io(url, {
            transports: ['websocket']
        });
        sockets[url].on('message', (msg) => {
            sync.processIncomingMessage(url, msg);
        });
        sockets[url].on('connect', cb);
    };


    const send = (url, msg, cb) => {
        sync.send(sockets[url], url, msg, cb);
    };


    this.turnOn = (light, cb) => {
        if (!sockets[light.socket_url]) return cb('Error - socket not open');
        const payload = getSwitchPayload(light.zid, light.location_uuid, 'on');
        console.log(`...Sending "turn on" payload to light/group name "${light.name}" id ${light.zid}`);
        send(light.socket_url, payload, cb);
    };

    this.turnOff = (light, cb) => {
        if (!sockets[light.socket_url]) return cb('Error - socket not open');
        const payload = getSwitchPayload(light.zid, light.location_uuid, 'off');
        console.log(`...Sending "turn off" payload to light/group name "${light.name}" id ${light.zid}`);
        send(light.socket_url, payload, cb);
    };

    this.closeSockets = () => {
        for (const k in sockets) {
            sockets[k].close();
        }
    };

    this.getAllLights = (cb) => {
        const locs = [];
        const devices = [];
        let accessToken;
        async.waterfall([
            (cb) => {
                console.log('...Getting access token');
                getAccesToken(this.refreshToken, (err, at) => {
                    if (err || !at) return cb('error getting access token ' + err);
                    accessToken = at;
                    return cb();
                });
            },
            (cb) => {
                getLocations(accessToken, cb);
            },
            (locations, cb) => {
                async.each(locations, (location, cb) => {
                    console.log('...Getting getting details for location ' + location.name);
                    getTicketUrl(accessToken, location.location_id, (err, assetData) => {
                        if (err) return cb(err);
                        if (!assetData || assetData.error || !assetData.assets) return cb();
                        if (assetData.assets.length > 1) {
                            console.log('Warning: More than one smart bridge discovered at location. This API currently only supports a single bridge per location.');
                        }
                        const locationData = {
                            name: location.name,
                            location_id: location.location_id,
                            url: 'wss://' + assetData.host + '/?authcode=' + assetData.ticket + '&ack=false&EIO=3',
                            uuid: assetData.assets[0].uuid
                        };
                        locs.push(locationData);

                        return cb();
                    });
                }, cb);
            },
            (cb) => {
                if (locs.length == 0) return cb('Error, no smart lighting bridges found in any locations');
                async.each(locs, (location, cb) => {
                    openSocket(location.url, (err) => {
                        if (err) return cb(err);
                        const deviceDiscoverMessage = {
                            'msg': 'DeviceInfoDocGetList',
                            'dst': location.uuid,
                            'seq': 2
                        };
                        console.log('...Sending "discover devices" message for location ' + location.name);
                        send(location.url, deviceDiscoverMessage, (err, res) => {
                            if (err) return cb(err);
                            if (!res || !res.body) {
                                console.log('No smart lighting products found connected to this bridge.');
                                return cb();
                            }
                            //Filter the list to only return lights
                            res.body = res.body.filter(n => {
                                return n.general['v2'].categoryId == 2;
                            });
                            if (res.body.length == 0) {
                                console.log('No smart lighting products found connected to this bridge.');
                                return cb();
                            }
                            res.body.forEach(dev => {
                                const deviceObject = dev.general['v2'];
                                deviceObject.location_id = location.location_id;
                                deviceObject.location_uuid = location.uuid;
                                deviceObject.socket_url = location.url;
                                deviceObject.location_name = location.name;
                                devices.push(deviceObject);
                            });
                            cb();
                        });
                    });
                }, cb);
            }
        ], (err, res) => {
            if (err) return cb(err);
            return cb(null, devices);
        });
    };
}

module.exports = Ring;