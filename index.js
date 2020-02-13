const httpPort = 3000;
const ring = require('./ring/api');
const ip = require('./ring/utils').myIp;
const log = require('./ring/utils').log;

//This refresh token is only used for the initial request.  Every other request writes a new refresh token to "auth.json"
const refreshToken = 'PUT_YOUR_REFRESH_TOKEN_HERE';



const Ring = new ring(refreshToken);


//In order to turn on or off, we need to get all devices. This process opens up the websocket to the bridge required for the websocket asynchronous API.
const turnOn = (name, cb) => {
    Ring.getAllLights((err, res) => {
        if (err) return cb(err);
        res = res.filter(n => n.name.toUpperCase() == name.toUpperCase());
        if (res.length == 0) return cb('Light or group with this name not found');
        //To turn a device on, send the entire device object to the turnOn command.
        Ring.turnOn(res[0], cb);
    });
};

const turnOff = (name, cb) => {
    Ring.getAllLights((err, res) => {
        if (err) return cb(err);
        res = res.filter(n => n.name.toUpperCase() == name.toUpperCase());
        if (res.length == 0) return cb('Light or group with this name not found');
        //To turn a device off, send the entire device object to the turnOff command.
        Ring.turnOff(res[0], cb);
    });
};


const express = require('express');
const app = express();


app.listen(httpPort, () => {
    log(`Server running.  Visit http://${ip}:${httpPort}/devices for a list of your lights`);
});



const generateHtml = (arr) => {
    let html = '<html> <body>';
    for (let i = 0; i < arr.length; i++){
        html += `Light name: <B>${arr[i]}</b>    Turn on via: <a href="/devices/${arr[i]}/on">http://${ip}:${httpPort}/devices/${arr[i]}/on</a>  Turn off via:  <a href="/devices/${arr[i]}/off">http://${ip}:${httpPort}/devices/${arr[i]}/off</a><br>`;
    }
    html += '</body></html>';
    return html;
};


app.get('/devices', (req, res, next) => {
    Ring.getAllLights((err, data) => {
        if (err) return res.status(404).send(err);
        const names = data.map(n => n.name);
        log(`Discovered lights: ${names.join(', ')}`);
        res.send(generateHtml(names));
    });
});


app.get('/devices/:deviceName/on', (req, res, next) => {
    log('Received command to turn on ' + req.params.deviceName);
    turnOn(req.params.deviceName, (err, data) => {
        Ring.closeSockets();
        if (err) {
            log('Error turning on "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (data.msg == 'DeviceInfoSet') {
            res.send('Successfully turned on');
        } else {
            log('Unrecognized response to turn on command: ' + JSON.stringify(data));
            res.send('Unknown response');
        }
    });
});


app.get('/devices/:deviceName/off', (req, res, next) => {
    log('Received comamnd to turn on ' + req.params.deviceName);
    turnOff(req.params.deviceName, (err, data) => {
        Ring.closeSockets();
        if (err) {
            log('Error turning off "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (data.msg == 'DeviceInfoSet') {
            log('Success');
            res.send('Success');
        } else {
            log('Unrecognized response to turn off command: ' + JSON.stringify(data));
            res.send('Unknown response');
        }
    });
});