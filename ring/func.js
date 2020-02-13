const api = require('./api');
const fs = require('fs');
const utils = require('./utils');
const log = utils.log;
const async = require('async');


const writeRefreshToken = (authData) => {
    fs.writeFileSync('./auth.json', JSON.stringify(authData));
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
                api.getAllLights(this.accessToken,(err, data) => {
                    api.closeSockets();
                    return cb(err, data);
                });
            }
        ], cb);
    };


    //In order to turn on or off, we need to get all devices. This process opens up the websocket to the bridge required for the websocket asynchronous API.
    this.turnOn = (name, cb) => {
        async.waterfall([
            (cb) => {
                log('...Getting access token');
                getAccessToken((err) => {
                    if (err) return cb('error getting access token ' + err);
                    return cb();
                });
            },
            (cb) => {
                api.getAllLights(this.accessToken, (err, res) => {
                    if (err) return cb(err);
                    res = res.filter(n => n.name.toUpperCase() == name.toUpperCase());
                    if (res.length == 0) return cb('Light or group with this name not found');
                    //To turn a device on, send the entire device object to the turnOn command.
                    api.turnOn(res[0], (err, res) => {
                        api.closeSockets();
                        return cb(err, res);
                    });
                });
            }
        ], cb);
    };


    this.turnOff = (name, cb) => {
        async.waterfall([
            (cb) => {
                log('...Getting access token');
                getAccessToken((err) => {
                    if (err) return cb('error getting access token ' + err);
                    return cb();
                });
            },
            (cb) => {
                api.getAllLights(this.accessToken, (err, res) => {
                    if (err) return cb(err);
                    res = res.filter(n => n.name.toUpperCase() == name.toUpperCase());
                    if (res.length == 0) return cb('Light or group with this name not found');
                    //To turn a device off, send the entire device object to the turnOn command.
                    api.turnOff(res[0], (err, res) => {
                        api.closeSockets();
                        return cb(err, res);
                    });
                });
            }
        ], cb);
    };
}

module.exports = Ring;








