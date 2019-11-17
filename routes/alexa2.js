'use strict';
const fs = require('fs');
const uuid = require('uuid');
const axios = require('axios');

// axios.interceptors.request.use(request => {
//     console.log('Starting Request', request)
//     return request
// })

// axios.interceptors.response.use(response => {
//     console.log('Response:', response)
//     return response
// })
// require('axios-debug-log');
const qs = require('querystring');
module.exports = class AlexaTV {

    static EVENTS = {
        TURNOFF: 1,
        VOLUME: 2,
        MUTE: 3,
        INPUT: 4,
        CHANNEL: 5,
        PLAYBACK: 6
    };

    _listeners = {};

    constructor(client_id, client_secret, tokenName) {
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.tokenName = tokenName;
    }

    addListener(event, listener) {
        if (!this._listeners[event])
            this._listeners[event] = [];
        this._listeners[event].push(listener);
    }

    notify(event, payload, cb) {
        if (this._listeners[event]) {
            for (const item of this._listeners[event]) {
                item(payload, cb);
            }
        }
    }

    set namespace(value) {
        console.log(`namespace to [${value}]`);

        this._namespace = value;
    }

    get namespace() {
        return this._namespace;
    }

    set request(value) {
        //console.log('changing request to: ', JSON.stringify(value))

        this._request = value;
    }

    get request() {
        return this._request;
    }

    get tokenPayload() {
        return {
            client_id: this.client_id,
            client_secret: this.client_secret
        }
    }

    get createTokenHeader() {
        return { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    }

    handleRequest(namespace, req, res, tvControl) {
        this.response = res;
        this.request = req;
        this.namespace = namespace;
        this.tvControl = tvControl;

        console.log(JSON.stringify(req));

        const functionName = namespace.replace('.', '');
        const func = (AlexaTV.prototype[functionName] || AlexaTV.prototype['noop'])
        func.call(this);
    }

    noop() {
        console.log("couldn't find a method to handle: ", this.namespace)
    }

    AlexaAuthorization() {
        this.getAuthorizationResponse();
        this.saveAuthToken();
    }

    AlexaDiscovery() {
        this.getDiscoveryResponse();
    }

    AlexaPowerController() {
        const { directive: { header: { name } } } = this.request;
        if (name == 'TurnOn') {
            this.getDefferedResponse();
            this.sendWakeUpEvent();
        } else if (name == 'TurnOff') {

            this.notify(AlexaTV.EVENTS.TURNOFF, {})
            this.getToken()
                .then(token => this.getTurnedOffResponse(token))
                .catch(err => console.log(err));
        }
        return;
    }

    AlexaSpeaker() {
        const { directive: { header: { name }, payload } } = this.request;

        if (name == 'SetMute') {
            this.notify(AlexaTV.EVENTS.MUTE, payload, (data) => {
                const response = this.getVolumeResponse(data);
                return this.response.json(response);
            })
        } else {
            this.notify(AlexaTV.EVENTS.VOLUME, payload, (data) => {
                const response = this.getVolumeResponse(data);
                return this.response.json(response);
            })
        }

        /*
        "scope": {
            "type": "BearerToken",
            "token": token.access_token
        },
        */
    }



    Alexa() {
        const { directive: { header: { name }, payload } } = this.request;
        return this.getToken()
            .then(token => this.getStateReport(token));
    }

    /// mudar para o canal 57 na TV LG
    AlexaChannelController() {
        const { payload, header: { correlationToken }, endpoint: { cookie } } = this.request.directive;
        console.log(JSON.stringify(this.request));
        let response = this.getChannelResponse(payload, correlationToken);
        this.notify(AlexaTV.EVENTS.CHANNEL, { payload, cookie }, (err, resp) => {
            console.log('::CHANNEL::');
            if (err) console.log(err);
            else console.log(resp);
        })
        return this.response.json(response);
    }

    AlexaLauncher() {
    }

    AlexaInputController() {
        const { payload, header: { correlationToken }, endpoint: { cookie } } = this.request.directive;
        this.notify(AlexaTV.EVENTS.INPUT, { payload, cookie }, (err, resp) => {
            if (!!resp && 'returnValue' in resp) {
                this.response.json(this.getInputResponse(correlationToken, payload.input));
            }
        })
    }

    AlexaPlaybackController() {
        const { header: { name, correlationToken } } = this.request.directive;
        const response = this.getPlaybackResponse(correlationToken);
        return this.notify(AlexaTV.EVENTS.PLAYBACK, name, (err, res) => {
            if ('returnValue' in res && res.returnValue)
                this.response.json(response);
        })
    }

    getPlaybackResponse(correlationToken) {
        return {
            "context": {
                "properties": []
            },
            "event": {
                "header": {
                    "messageId": uuid.v4(),
                    "namespace": "Alexa",
                    "name": "Response",
                    "payloadVersion": "3",
                    "correlationToken": correlationToken
                },
                "endpoint": {
                    "endpointId": this.tokenName + "-endpoint",
                },
                "payload": {}
            }
        }
    }

    getInputResponse(correlationToken, inputValue) {
        return {
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.InputController",
                        "name": "input",
                        "value": inputValue,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 100
                    }
                ]
            },
            "event": {
                "header": {
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                    "namespace": "Alexa",
                    "name": "Response",
                    "payloadVersion": "3"
                },
                "endpoint": {
                    "endpointId": this.tokenName + "-endpoint",
                },
                "payload": {}
            }
        }
    }

    getChannelResponse(payload, correlationToken) {
        return {
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.ChannelController",
                        "name": "channel",
                        "value": payload,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 0
                    }
                ]
            },
            "event": {
                "header": {
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                    "namespace": "Alexa",
                    "name": "Response",
                    "payloadVersion": "3"
                },
                "endpoint": {
                    "endpointId": this.tokenName + "-endpoint",
                },
                "payload": {}
            }
        }
    }

    emitVolumeEvent(tvControl) {
        this.tvControl = tvControl;
        this.getToken()
            .then(token => {
                this.getVolumeReport(token, tvControl)
                    .then(response => this.sendEvent(response, token))
            })

    }

    getVolumeReport(token) {
        return Promise.resolve({
            "event": {
                "header": {
                    "messageId": uuid.v4(),
                    "namespace": "Alexa",
                    "name": "ChangeReport",
                    "payloadVersion": "3"
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token.access_token
                    },
                    "endpointId": this.tokenName + "-endpoint",
                },
                "payload": {
                    "change": {
                        "cause": {
                            "type": "PHYSICAL_INTERACTION"
                        },
                        "properties": [
                            {
                                "namespace": "Alexa.Speaker",
                                "name": "volume",
                                "value": this.tvControl.volume,
                                "timeOfSample": new Date().toISOString(),
                                "uncertaintyInMilliseconds": 200
                            },
                            {
                                "namespace": "Alexa.Speaker",
                                "name": "muted",
                                "value": this.tvControl.muted,
                                "timeOfSample": new Date().toISOString(),
                                "uncertaintyInMilliseconds": 200
                            },
                        ]
                    }
                }
            },
            "context": {
                "properties": [{
                    "namespace": "Alexa.EndpointHealth",
                    "name": "connectivity",
                    "value": {
                        "value": "OK"
                    },
                    "timeOfSample": new Date().toISOString(),
                    "uncertaintyInMilliseconds": 200
                }, {
                    "namespace": "Alexa.PowerController",
                    "name": "powerState",
                    "value": this.tvControl.power,
                    "timeOfSample": new Date().toISOString(),
                    "uncertaintyInMilliseconds": 200
                },]
            }
        })
    }

    getStateReport(token) {
        const { directive: { header: { correlationToken } } } = this.request;
        this.response.json({
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.Speaker",
                        "name": "volume",
                        "value": 3,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                    {
                        "namespace": "Alexa.Speaker",
                        "name": "muted",
                        "value": false,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                    {
                        "namespace": "Alexa.EndpointHealth",
                        "name": "connectivity",
                        "value": {
                            "value": "OK"
                        },
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    }, {
                        "namespace": "Alexa.PowerController",
                        "name": "powerState",
                        "value": "ON",
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                ]
            },
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "StateReport",
                    "payloadVersion": "3",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token.access_token,
                    },
                    "endpointId": this.tokenName + "-endpoint"
                },
                "payload": {}
            }
        })
    }

    getVolumeResponse(data) {
        const { directive: { header: { correlationToken } } } = this.request;
        return {
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.Speaker",
                        "name": "volume",
                        "value": data.volume,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                    {
                        "namespace": "Alexa.Speaker",
                        "name": "muted",
                        "value": data.muted,
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                    {
                        "namespace": "Alexa.EndpointHealth",
                        "name": "connectivity",
                        "value": {
                            "value": "OK"
                        },
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    }
                ]
            },
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "Response",
                    "payloadVersion": "3",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken
                },
                "endpoint": {
                    "endpointId": this.tokenName + "-endpoint"
                },
                "payload": {}
            }
        };
    }

    sendWakeUpEvent() {
        return new Promise((resolve, reject) => {
            this.getToken()
                .then(token => {
                    this.getWakeEventResponse(token)
                        .then((response) => this.sendEvent(response, token))
                        .then((_) => this.getTurnedOnResponse(token))
                        .then((response) => this.sendEvent(response, token))
                        .catch((err) => console.log('sendWakeUpEvent()', err))
                        .then(() => resolve())
                })

        })

    }

    sendEvent(response, token) {
        const config = {
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Authorization': 'Bearer ' + token.access_token
            }
        }
        return new Promise((resolve, reject) => {
            axios.post(process.env.EVENT_URL, response, config)
                .then(result => resolve(result))
                .catch(err => console.log('error sending event:: ', err.response.data))
        })
    }

    getTurnedOffResponse(token) {
        const { directive: { header: { correlationToken } } } = this.request;
        this.response.json({
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.PowerController",
                        "name": "powerState",
                        "value": "OFF",
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    },
                    {
                        "namespace": "Alexa.EndpointHealth",
                        "name": "connectivity",
                        "value": {
                            "value": "OK"
                        },
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 200
                    }
                ]
            },
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "Response",
                    "payloadVersion": "3",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token.access_token
                    },
                    "endpointId": this.tokenName + "-endpoint"
                },
                "payload": {}
            }
        })

    }

    getTurnedOnResponse(token) {
        const { directive: { header: { correlationToken } } } = this.request;
        return Promise.resolve({
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "Response",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                    "payloadVersion": "3"
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token.access_token,
                    },
                    "endpointId": this.tokenName + "-endpoint"
                },
                "payload": {}
            },
            "context": {
                "properties": [
                    {
                        "namespace": "Alexa.PowerController",
                        "name": "powerState",
                        "value": "ON",
                        "timeOfSample": new Date().toISOString(),
                        "uncertaintyInMilliseconds": 500
                    }
                ]
            }
        }, token)
    }

    getWakeEventResponse(token) {
        const { directive: { header: { correlationToken } } } = this.request;
        return Promise.resolve({
            "context": {
                "properties": [{
                    "namespace": "Alexa.PowerController",
                    "name": "powerState",
                    "value": "OFF",
                    "timeOfSample": new Date().toISOString(),
                    "uncertaintyInMilliseconds": 5000
                }]
            },
            "event": {
                "header": {
                    "namespace": "Alexa.WakeOnLANController",
                    "name": "WakeUp",
                    "payloadVersion": "3",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                },
                "endpoint": {
                    "scope": {
                        "type": "BearerToken",
                        "token": token.access_token,
                    },
                    "endpointId": this.tokenName + "-endpoint"
                },
                "payload": {}
            }
        }, token)
    }

    getDefferedResponse() {
        const { directive: { header: { correlationToken } } } = this.request;
        this.response.json({
            "event": {
                "header": {
                    "namespace": "Alexa",
                    "name": "DeferredResponse",
                    "messageId": uuid.v4(),
                    "correlationToken": correlationToken,
                    "payloadVersion": "3"
                },
                "payload": { "estimatedDeferralInSeconds": 30 }
            }
        });
    }

    sendDeleteEvent(endpoints) {
        this.getToken().then(token => {

            let response = {
                "event": {
                    "header": {
                        "namespace": "Alexa.Discovery",
                        "name": "DeleteReport",
                        "messageId": uuid.v4(),
                        "payloadVersion": "3"
                    },
                    "payload": {
                        "endpoints": endpoints,
                        "scope": {
                            "type": "BearerToken",
                            "token": token.access_token
                        }
                    }
                }
            }

            console.log('sent delete event');
            this.sendEvent(response, token);

        })

    }

    getDiscoveryResponse() {
        return {
            event: {
                header: {
                    "namespace": "Alexa.Discovery",
                    "name": "Discover.Response",
                    "payloadVersion": "3",
                    "messageId": uuid.v4()
                },
                payload: {
                    endpoints: [{
                        "endpointId": this.tokenName + "-endpoint",
                        "manufacturerName": "LG Eletronics",
                        "friendlyName": "LG" + this.tokenName,
                        "description": "Smart TV",
                        "displayCategories": ["TV"],
                        "connections": [{
                            "type": "TCP_IP",
                            "macAddress": "EC-F4-51-32-18-AC"
                        }],
                        "capabilities": [{
                            "type": "AlexaInterface",
                            "interface": "Alerts",
                            "version": "1.1"
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.PowerController",
                            "version": "3",
                            "properties": {
                                "supported": [{ "name": "powerState" }],
                                "proactivelyReported": true,
                                "retrievable": true
                            }
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.WakeOnLANController",
                            "version": "3",
                            "properties": {},
                            "configuration": {
                                "MACAddresses": ["EC-F4-51-32-18-AC"]
                            }
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.EndpointHealth",
                            "version": "3",
                            "properties": {
                                "supported": [{ "name": "connectivity" }],
                                "proactivelyReported": true,
                                "retrievable": true
                            }
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.Speaker",
                            "version": "3",
                            "properties": {
                                "supported": [{ "name": "volume" }, { "name": "muted" }],
                                "proactivelyReported": true,
                                "retrievable": true
                            }
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.ChannelController",
                            "version": "3",
                            "properties": {
                                "supported": [{ "name": "channel" }, { "name": "channelCount" }, { "name": "channelMetadata" }],
                                "proactivelyReported": true,
                                "retrievable": true
                            }
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.InputController",
                            "version": "3",
                            "inputs": [{ "name": "HDMI 1" }, { "name": "HDMI 2" }, { "name": "TV" }],
                        }, {
                            "type": "AlexaInterface",
                            "interface": "Alexa.PlaybackController",
                            "version": "3",
                            "properties": {
                                "proactivelyReported": true,
                                "retrievable": true
                            },
                            "supportedOperations": ["Play", "Pause", "Stop"]
                        }, {
                            "interface": "Alexa.Launcher",
                            "type": "AlexaInterface",
                            "version": "1.0",
                            "properties": {
                                "supported": [{ "name": "launcher" }],
                                "targets": [
                                    { 'identifier': 'amzn1.alexa-ask-target.app.70045', 'name': 'YouTube' },
                                    { 'identifier': 'amzn1.alexa-ask-target.app.36377', 'name': 'Netflix' },
                                ],
                                "proactivelyReported": true,
                                "retrievable": true
                            },
                            "targets": [
                                { 'identifier': 'amzn1.alexa-ask-target.app.70045', 'name': 'YouTube' },
                                { 'identifier': 'amzn1.alexa-ask-target.app.36377', 'name': 'Netflix' },
                            ]
                        },]
                    }]
                }
            }
        }
    }

    replyDiscoveryResponse(discResponse) {
        this.response.json(discResponse);
    }

    getAddOrUpdateResponse(token, channelList) {
        let response = this.getDiscoveryResponse();
        response.event.header.name = "AddOrUpdateReport";
        // response.event.header.name = "DeleteReport";
        response.event.payload['scope'] = {
            "type": "BearerToken",
            "token": token
        }
        if (channelList) {
            let endpoint = response.event.payload.endpoints[0];
            endpoint['cookie'] = {};
            endpoint['cookie']["channels"] = JSON.stringify(channelList);
        }
        return response;
    }

    updateDiscoveryUpdate(channelList) {
        this.getToken().then(token => {
            const response = this.getAddOrUpdateResponse(token.access_token, channelList);
            return this.sendEvent(response, token)
                .then(result => console.log('result of event', result))
        })
    }

    getAuthorizationResponse() {
        this.response.json({
            event: {
                header: {
                    namespace: "Alexa.Authorization",
                    name: "AcceptGrant.Response",
                    payloadVersion: "3",
                    messageId: uuid.v4()
                },
                payload: {}
            }
        })
    }

    saveAuthToken() {
        this.requestToken()
            .then(token => this.saveTokenAsFile(token))
            .catch((err) => console.log('saveAuthToken()', err))
    }


    requestToken() {
        return new Promise((resolve, reject) => {
            try {
                const { payload: { grant: { code } } } = this.request.directive;
                const new_data = { grant_type: 'authorization_code', code: code };
                const new_payload = Object.assign({}, this.tokenPayload, new_data);
                const params = qs.stringify(new_payload);
                axios.post(process.env.TOKEN_URL, params, this.createTokenHeader)
                    .then(result => resolve(result.data))
                    .catch(err => {
                        console.log(err)
                        reject(err);
                    })
                // .catch(reject);
            } catch (error) {
                reject(error);
            }
        })
    }

    refreshToken(oldToken) {
        return new Promise((resolve, reject) => {
            try {
                const { refresh_token } = oldToken;
                const new_data = { "grant_type": 'refresh_token', "refresh_token": refresh_token };
                const new_payload = Object.assign({}, this.tokenPayload, new_data);
                const params = qs.stringify(new_payload);
                axios.post(process.env.TOKEN_URL, params, this.createTokenHeader)
                    .then(result => {
                        console.log('token refreshed');
                        resolve(result.data);
                    })
                    .catch(reject)
            } catch (error) {
                reject(error)
            }
        })
    }

    saveTokenAsFile(token) {
        return new Promise((resolve, reject) => {
            try {
                token.issue = Date.now();
                fs.writeFile(this.tokenName + ".json", JSON.stringify(token), () => {

                    console.log('token saved');

                    resolve(token);
                });
            } catch (error) {
                reject(error);
            }
        })
    }

    loadTokenFromFile() {
        return new Promise((resolve, reject) => {
            try {
                fs.readFile(this.tokenName + '.json', (err, data) => {
                    if (err) reject(err);
                    resolve(JSON.parse(data))
                })
            } catch (error) {
                reject(error);
            }
        })
    }

    getToken() {
        return new Promise((resolve, reject) => {
            this.loadTokenFromFile()
                .then((token) => {
                    if ((token.issue + 3600 * 1000) > Date.now()) {

                        console.log('token is valid')
                        //console.log(JSON.stringify(token));

                        resolve(token);
                    } else {

                        console.log('token is not valid anymore: ', new Date(token.issue + 3600 * 1000))

                        this.refreshToken(token)
                            .then(token => this.saveTokenAsFile(token))
                            .then(saved => resolve(saved))
                            .catch(err => console.log('[err refreshing]', err.response.data));
                    }
                })
                .catch((err) => console.log('could not read token file'))
        })
    }

}