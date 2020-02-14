const httpPort = 3000;
const utils = require('./ring/utils');
const ip = utils.myIp;
const log = utils.log;
const logTimeStart = utils.logTimeStart;
const logTimeEnd = utils.logTimeEnd;
const Ring = require('./ring/func');

//This refresh token is only used for the initial request.  Every other request writes a new refresh token to "auth.json"
const refreshToken = 'PUT_YOUR_REFRESH_TOKEN_HERE';

const ringFunctions = new Ring(refreshToken);
const express = require('express');
const app = express();

app.listen(httpPort, () => {
    log(`Server running.  Visit http://${ip}:${httpPort}/devices for a list of your lights`);
});

const generateDiscoverHtml = (arr, end) => {
    let html = '<html> <body>';
    for (let i = 0; i < arr.length; i++){
        html += `Light name: <B>${arr[i]}</b>    Turn on via: <a href="/devices/${arr[i]}/on">http://${ip}:${httpPort}/devices/${arr[i]}/on</a>  Turn off via:  <a href="/devices/${arr[i]}/off">http://${ip}:${httpPort}/devices/${arr[i]}/off</a><br>`;
    }
    html+=`<p><i>DiscoverLights request took ${end} seconds.</i></p>`;
    html += '</body></html>';
    return html;
};

const generateToggleSuccessHtml = (device, onOrOff, end) => {
    let html = '<html> <body>';
    html += `Light name: <B>${device}</b>  Successfully turned ${onOrOff}<br>`;
    html += `<p><i>Light on/off request took ${end} seconds.</i></p>`;
    html += '</body></html>';
    return html;
};

app.get('/devices', (req, res) => {
    logTimeStart('getDevices');
    ringFunctions.getAllLights((err, data) => {
        if (err) return res.status(404).send(err);
        const names = data.map(n => n.name);
        log(`Discovered lights: ${names.join(', ')}`);
        const end = logTimeEnd('getDevices');
        res.send(generateDiscoverHtml(names, end));
    });
});

app.get('/devices/:deviceName/on', (req, res) => {
    logTimeStart('TurnOn');
    log('Received command to turn on ' + req.params.deviceName);
    ringFunctions.switchLight(req.params.deviceName, 'on', (err, data) => {
        const end = logTimeEnd('TurnOn');
        if (err) {
            log('Error turning on "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (data.msg == 'DeviceInfoSet') {
            res.send(generateToggleSuccessHtml(req.params.deviceName, 'on', end));
        } else {
            log('Unrecognized response to turn on command: ' + JSON.stringify(data));
            res.send('Unknown response');
        }
    });
});

app.get('/devices/:deviceName/off', (req, res) => {
    logTimeStart('TurnOff');
    log('Received comamnd to turn on ' + req.params.deviceName);
    ringFunctions.switchLight(req.params.deviceName, 'off',  (err, data) => {
        const end = logTimeEnd('TurnOff');
        if (err) {
            log('Error turning off "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (data.msg == 'DeviceInfoSet') {
            log('Success');
            res.send(generateToggleSuccessHtml(req.params.deviceName, 'off', end));
        } else {
            log('Unrecognized response to turn off command: ' + JSON.stringify(data));
            res.send('Unknown response');
        }
    });
});