//uncomment these lines if you want to use mqtt!
//const mqttHost = '127.0.0.1';
//const mqttBaseTopic = 'home/ringlighting';

const httpPort = 3000;
const utils = require('./ring/utils');
const ip = utils.myIp;
const log = utils.log;
const logTimeStart = utils.logTimeStart;
const logTimeEnd = utils.logTimeEnd;
const Ring = require('./ring/func');
const async = require('async');

//This refresh token is only used for the initial request.  Every other request writes a new refresh token to "auth.json"
const refreshToken = 'PUT_YOUR_REFRESH_TOKEN_HERE';

const ringFunctions = new Ring(refreshToken);
const express = require('express');
const app = express();

const q = async.queue((task, callback) => {
    if (q.length() > 1) log('Action will be delayed: ' + q.length() +' items in queue.');
    if (task.func == 'switchLight') ringFunctions.switchLight(task.name, task.param, callback);
    if (task.func == 'discover') ringFunctions.getAllLights(callback);
}, 1);

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
    html += `Light name(s): <B>${device}</b>  Successfully turned ${onOrOff}<br>`;
    html += `<p><i>Light on/off request took ${end} seconds.</i></p>`;
    html += '</body></html>';
    return html;
};


if (typeof mqttHost !== 'undefined') {
    const mqttSubTopic = `${mqttBaseTopic}/command/#`;
    log(`Subscribing to ${mqttSubTopic}`);
    log(`To turn on a light via MQTT, publish \'on\' or \'off\' to ${mqttBaseTopic}/command/LIGHTNAME`);
    const mqtt = require('mqtt');
    const client = mqtt.connect(`mqtt://${mqttHost}`);
    client.on('connect', () => {
        client.subscribe(mqttSubTopic, (err) => {
            if (err) log ('Error subscribing to MQTT topic');
        });
    });
    client.on('message', (topic, message) => {
        const lightName = topic.substr(topic.lastIndexOf('/') + 1);
        if (lightName == 'discover') {
            q.push({
                func: 'discover'
            }, (err, data) => {
                if (err) {
                    client.publish(`${mqttBaseTopic}/result/${lightName}`, err);
                } else {
                    const names = data.map(n => n.name);
                    log(`Discovered lights: ${names.join(', ')}`);
                    client.publish(`${mqttBaseTopic}/result/${lightName}`, names.join(','));
                }
            });
        } else {
            message = message.toString().toLowerCase();
            if (message !== 'on' && message !== 'off') {
                log('Invalid command');
                return;
            }
            q.push({
                func: 'switchLight',
                name: lightName,
                param: message
            }, (err, data) => {
                if (err) {
                    log('Error turning on "' + lightName + '" : ' + err);
                    return;
                }
                if (lightName.split(',').length == data.length && data[0].msg == 'DeviceInfoSet') {
                    //success
                    client.publish(`${mqttBaseTopic}/result/${lightName}/${message}`, 'success');
                } else {
                    client.publish(`${mqttBaseTopic}/result/${lightName}/${message}`, 'failure');
                    log('Unrecognized response to turn on command: ' + JSON.stringify(data));
                }
            });
        }
    });
}


app.get('/devices', (req, res) => {
    logTimeStart('getDevices');
    q.push({func: 'discover'}, (err, data)=> {
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
    q.push({
        func: 'switchLight',
        name: req.params.deviceName,
        param: 'on'
    }, (err, data) => {
        const end = logTimeEnd('TurnOn');
        if (err) {
            log('Error turning on "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (req.params.deviceName.split(',').length == data.length && data[0].msg == 'DeviceInfoSet') {
            res.send(generateToggleSuccessHtml(req.params.deviceName, 'on', end));
        } else {
            log('Unrecognized response to turn on command: ' + JSON.stringify(data));
            res.send('Could not turn on one or more lights (or a light was not found)');
        }
    });
});

app.get('/devices/:deviceName/off', (req, res) => {
    logTimeStart('TurnOff');
    log('Received comamnd to turn on ' + req.params.deviceName);
    q.push({ func: 'switchLight', name: req.params.deviceName, param: 'off'}, (err, data) => {
        const end = logTimeEnd('TurnOff');
        if (err) {
            log('Error turning off "' + req.params.deviceName + '" : ' + err);
            return res.status(404).send(err);
        }
        if (req.params.deviceName.split(',').length == data.length && data[0].msg == 'DeviceInfoSet') {
            log('Success');
            res.send(generateToggleSuccessHtml(req.params.deviceName, 'off', end));
        } else {
            log('Unrecognized response to turn off command: ' + JSON.stringify(data));
            res.send('Could not turn off one or more lights (or a light with a provided name was not found)');
        }
    });
});


