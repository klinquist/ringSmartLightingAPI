const api = require('./api');
const fs = require('fs');
const utils = require('./utils');
const log = utils.log;
const async = require('async');


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

const getAllLights = (accessToken, cb) => {
    const locs = [];
    const devices = [];

    async.waterfall([
        (cb) => {
            api.getLocations(accessToken, cb);
        },
        (locations, cb) => {
            async.each(locations, (location, cb) => {
                log('...Getting getting details for location ' + location.name);
                api.getTicketUrl(accessToken, location.location_id, (err, assetData) => {
                    if (err) return cb(err);
                    if (!assetData || assetData.error || !assetData.assets) {
                        log(`...Skipping location ${location.name}: No smart lighting bridges found at this location.`);
                        return cb();
                    }
                    if (assetData.assets.length > 1) {
                        log('Warning: More than one smart bridge discovered at location. This API currently only supports a single bridge per location.');
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
                api.openSocket(location.url, (err) => {
                    if (err) return cb(err);
                    const deviceDiscoverMessage = {
                        'msg': 'DeviceInfoDocGetList',
                        'dst': location.uuid,
                        'seq': 2
                    };
                    log('...Sending "discover devices" message for location ' + location.name);
                    api.send(location.url, deviceDiscoverMessage, (err, res) => {
                        if (err) return cb(err);
                        if (!res || !res.body) {
                            log('No smart lighting products found connected to this bridge.');
                            return cb();
                        }
                        //Filter the list to only return lights
                        res.body = res.body.filter(n => {
                            return n.general['v2'].categoryId == 2;
                        });
                        if (res.body.length == 0) {
                            log('No smart lighting products found connected to this bridge.');
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
    ], (err) => {
        if (err) return cb(err);
        return cb(null, devices);
    });
};

const toggleLight = (light, onOrOff, cb) => {
    async.series([
        (cb) => {
            api.openSocket(light.socket_url, cb);
        },
        (cb) => {
            const payload = getSwitchPayload(light.zid, light.location_uuid, onOrOff);
            log(`...Sending "turn ${onOrOff}" payload to light/group name "${light.name}" id ${light.zid}`);
            api.send(light.socket_url, payload, cb);
        }
    ], (err, res) => {
        if (err) return cb(err);
        return cb(null, res[1][0]);
    });
};

function Ring(refreshToken) {
    log('Ring Smart Lighting API by Kris Linquist');
    let auth, authStr;
    try {
        authStr = fs.readFileSync('./auth.json');
        auth = JSON.parse(authStr);
    } catch (e) {

    }
    if (!auth || !auth.refresh_token) {
        if (refreshToken) {
            log('Using refresh token from init');
            auth = {
                refresh_token: refreshToken
            };
        } else {
            throw new Error('Ring Smart Lighting API must be initialized with a refreshToken');
        }
    } else {
        log('Using refresh token from file');
    }

    this.refreshToken = auth.refresh_token;

    const getAccessToken = (cb) => {
        api.getAccesToken(this.refreshToken, (err, at) => {
            if (err || !at) return cb('error getting access token ' + err);
            writeRefreshToken(at);
            this.accessToken = at.access_token;
            this.refreshToken = at.refresh_token;
            return cb();
        });
    };

    this.getAllLights = (cb) => {
        async.waterfall([
            (cb) => {
                log('...Getting access token');
                getAccessToken((err) => {
                    if (err) return cb('error getting access token ' + err);
                    return cb();
                });
            },
            (cb) => {
                getAllLights(this.accessToken,(err, data) => {
                    api.closeSockets();
                    return cb(err, data);
                });
            }
        ], cb);
    };

    //In order to turn on or off, we need to get all devices. This process opens up the websocket to the bridge required for the websocket asynchronous API.
    this.switchLight = (name, onOrOff, cb) => {
        async.waterfall([
            (cb) => {
                log('...Getting access token');
                getAccessToken((err) => {
                    if (err) return cb('error getting access token ' + err);
                    return cb();
                });
            },
            (cb) => {
                getAllLights(this.accessToken, (err, res) => {
                    if (err) return cb(err);
                    res = res.filter(n => n.name.toUpperCase() == name.toUpperCase());
                    if (res.length == 0) return cb('Light or group with this name not found');
                    //To turn a device on, send the entire device object to the turnOn command.
                    toggleLight(res[0], onOrOff, (err, res) => {
                        api.closeSockets();
                        return cb(err, res);
                    });
                });
            }
        ], cb);
    };
}

module.exports = Ring;








