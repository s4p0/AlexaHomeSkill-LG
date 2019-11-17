/*
/////
/// needs to define a settings.js file with the following content from your skill
////


require('./settings')
const localtunnel = require('localtunnel');
const bodyParser = require("body-parser");
const express = require("express");


const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

var alexa_route = require('./routes/alexa');
app.use('/alexa', alexa_route);

const config = {
    subdomain: process.env.SUBDOMAIN_URL || '(sub domain)',
    port: process.env.REMOTE_PORT || 3000,
};



(async () => {
    const server = await app.listen(config.port)
    console.log("app running on port.", server.address().port);
})();

// using NGROK instead of localtunnel


/// but with lt is like this
// (async () => {
//     const server = await app.listen(config.port);
//     console.log("app running on port.", server.address().port);
//     const tunnel = await localtunnel({
//         port: server.address().port,
//         // subdomain: config.subdomain,
//     })
//     process.env.REMOTE_URL = tunnel.url;
//     console.log("tunnel address.", tunnel.url);
//     tunnel.on('close', () => {
//         console.log("tunnel down");
//     });
// })();

/*
var devices = {};

var lgtv = require("lgtv2")({
    url: 'ws://192.168.1.105:3000',
});


lgtv.on('error', (err) => {
    console.log('lgtv error:', err);
});

lgtv.on('connecting', (err) => {
    console.log(`[${new Date().toLocaleString()}] trying to connect`, err);
})

lgtv.on('close', (err) => {
    console.log('closed', err);
})

lgtv.on('connect', (res) => {
    console.log('connected');
});


*/
