var events = require('events');
var transactionIdEventEmitterMap = {};
var util = require('util');
var eventEmitter = events.EventEmitter;


const getTransId = (url, msg) => {
    return `${url}-${msg}`;
};

function socketSync(options) {
    function registerListener(tid, cb) {
        if (!transactionIdEventEmitterMap[tid]) {
            //eventEmitter.setMaxListeners(0);
            transactionIdEventEmitterMap[tid] = new events.EventEmitter();
            setTimeout(() => {
                if (transactionIdEventEmitterMap[tid]) {
                    transactionIdEventEmitterMap[tid].emit('response', 'Timeout - No response received within timeout period');
                }
            }, options.timeout || 5000); //5 sec timeout
        }
        transactionIdEventEmitterMap[tid].addListener('response', (err, data, fullpacket) => {
            if (transactionIdEventEmitterMap[tid]) {
                transactionIdEventEmitterMap[tid].removeAllListeners();
                delete transactionIdEventEmitterMap[tid];
            }
            if (cb) {
                return cb(err, data, fullpacket);
            }
        });
    }

    this.emitResponse = function (tid, packet) {
        if (tid && transactionIdEventEmitterMap[tid]) {
            transactionIdEventEmitterMap[tid].emit('response', null, packet);
        }
    };

    this.processIncomingMessage = function (url, incoming) {
        var response;
        if (typeof incoming === 'string') {
            try {
                response = JSON.parse(incoming);
            } catch (e) {
            }
        } else {
            response = incoming;
        }
        const transId = getTransId(url, incoming.msg);
        if (transactionIdEventEmitterMap[transId]) {
            transactionIdEventEmitterMap[transId].emit('response', null, response);
        } else {
            console.log('No transactionId registered for this response');
        }
    };

    this.send = function (socket, url, payload, callback) {
        socket.emit('message', payload);
        registerListener(getTransId(url, payload.msg), (err, result, fullpacket) => {
            callback(err, result, fullpacket);
        });
    };

    eventEmitter.call(this);
}

util.inherits(socketSync, eventEmitter);

module.exports = function (options) {
    return new socketSync(options);
};