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



const generateHtml = (arr) => {
    let html = '<html> <body>';
    for (let i = 0; i < arr.length; i++){
        html += `Light name: <B>${arr[i]}</b>    Turn on via: <a href="/devices/${arr[i]}/on">http://${ip}:${httpPort}/devices/${arr[i]}/on</a>  Turn off via:  <a href="/devices/${arr[i]}/off">http://${ip}:${httpPort}/devices/${arr[i]}/off</a><br>`;
    }
    html += '</body></html>';
    return html;
};


app.get('/devices', (req, res) => {
    logTimeStart('getDevices');
    ringFunctions.getAllLights((err, data) => {
        if (err) return res.status(404).send(err);
        const names = data.map(n => n.name);
        log(`Discovered lights: ${names.join(', ')}`);
        logTimeEnd('getDevices');
        res.send(generateHtml(names));
    });
});




app.get('/devices/:deviceName/on', (req, res) => {
    logTimeStart('TurnOn');
    log('Received command to turn on ' + req.params.deviceName);
    ringFunctions.switchLight(req.params.deviceName, 'on', (err, data) => {
        logTimeEnd('TurnOn');
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




app.get('/devices/:deviceName/off', (req, res) => {
    logTimeStart('TurnOff');
    log('Received comamnd to turn on ' + req.params.deviceName);
    ringFunctions.switchLight(req.params.deviceName, 'off',  (err, data) => {
        logTimeEnd('TurnOff');
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