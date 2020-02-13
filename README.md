### Ring Smart Lighting REST API

#### Description

This is an API server that makes it easy to turn Ring Smart Lighting products on/off via simple REST requests.  This makes it easy to integrate these lights into other home automation platforms such as SmartThings and Hubitat.

#### Pre-requisites

A newish version of nodejs



#### Installation

git clone, enter the folder where it was cloned, then enter following commands:

```bash
npm install
npx -p ring-client-api ring-auth-cli
```

Paste the `refreshToken` returned to you by the second command into the `index.js`



#### Running

```bash
npm start
```

Run under a process manager like `pm2` to keep it running full time!



#### API

This runs on port 3000 by default.  You can change that at the top of the `index.js`.



**Get a list of lights**

`GET http://localhost:3000/devices`

All lights, groups, and bridges will be returned.



**Turn a light or group on**

`GET http://localhost:3000/devices/deviceName/on`

(i.e. `http://localhost:3000/devices/Front Porch/on`)

Lights stay on for the default duration.  I currently do not support other durations due to having mixed success with them.


**Turn a light or group off**

`GET http://localhost:3000/devices/deviceName/off`

(i.e. `http://192.168.1.31:3000/devices/Front Porch/off`)




