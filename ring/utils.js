var os = require('os');
var networkInterfaces = Object.values(os.networkInterfaces())
    .reduce((r, a) => {
        r = r.concat(a);
        return r;
    }, [])
    .filter(({
        family,
        address
    }) => {
        return family.toLowerCase().indexOf('v4') >= 0 &&
            address !== '127.0.0.1';
    })
    .map(({
        address
    }) => address);


const log = (msg) => {
    const date_ob = new Date();
    const date = ('0' + date_ob.getDate()).slice(-2);
    const month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
    const year = date_ob.getFullYear();
    const hours = date_ob.getHours();
    let minutes = date_ob.getMinutes();
    if (minutes < 10) minutes = `0${minutes}`;
    let seconds = date_ob.getSeconds();
    if (seconds < 10) seconds = `0${seconds}`;
    const now = year + '-' + month + '-' + date + ' ' + hours + ':' + minutes + ':' + seconds;
    console.log(`${now} - ${msg}`);
};
exports.log = log;
exports.myIp = networkInterfaces[0];


const logtimer = {};
const logTimeStart = (key) => {
    logtimer[key] = Date.now();
};
const logTimeEnd = (key) => {
    if (!logtimer[key]) return log(`Timer for ${key} not found`);
    const now = Date.now();
    const length = parseFloat((now - logtimer[key]) / 1000).toFixed(2);
    log(`Request "${key}" took ${length} seconds.`);
    delete logtimer[key];
    return length;
};
exports.logTimeStart = logTimeStart;
exports.logTimeEnd = logTimeEnd;