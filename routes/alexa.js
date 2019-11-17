
const axios = require('axios');
const qs = require('querystring');

var uuid = require('uuid');

var express = require('express');
var router = express.Router();

module.exports = router;

var Alexa = require('./alexa2')


var alexa = new Alexa(process.env.CLIENT_ID, process.env.CLIENT_SECRET, "homeskill-token");
// alexa.sendDeleteEvent([{ "endpointId": "endpoint-001" }, { "endpointId": "endpoint-002" }, { "endpointId": "endpoint-003" }]);
// alexa.sendDeleteEvent([{ "endpointId": 'homeskill-token-endpoint' }])



var notifications = {
    sendWakeOnLanResponse: undefined
};

var request = (uri, payload) => {
    return new Promise((resolve, reject) => {
        lgtv.request(uri, payload, (err, res) => {
            if (err) reject(err);
            else resolve(res);
        })
    })
}


router.get('/update', (req, res) => {
    alexa.updateDiscoveryUpdate(tvControl.channelList);
    res.send('updating !');
})

router.post('/endpoint', (req, res) => {

    const request = req.body;
    const namespace = request.directive.header.namespace
    console.log('::receiving request::');
    console.log(JSON.stringify(request));
    console.log('::end of request::');
    // methods[namespace](req, res, request);
    alexa.handleRequest(namespace, request, res, tvControl);
})

var tvControl = {
    volume: 0,
    muted: false,
    power: "ON",
    channelList: []
}


// IP DA TV
var lgtv = require("lgtv2")({
    url: 'ws://' + process.env.LGTV_IP
});
lgtv.on('connecting', () => {
    console.log('trying to connect...');
    tvControl.power = 'OFF';
    alexa.tvControl = tvControl;
})
lgtv.on('connect', () => {
    tvControl.power = 'ON';
    alexa.tvControl = tvControl;
    console.log('connected');

    lgtv.request('ssap://system.notifications/createToast', { message: 'Alexa está conectada !' });

    if (notifications.sendWakeOnLanResponse) {
        power_on_handled(notifications.sendWakeOnLanResponse);
    }

    lgtv.subscribe('ssap://audio/getVolume', function (err, res) {
        tvControl.volume = res.volume;
        tvControl.muted = res.muted;
        alexa.emitVolumeEvent(tvControl);
    });

    Promise.all([
        request('ssap://audio/getVolume', {}),
        request('ssap://tv/getChannelList', {})
    ]).then(res => {
        tvControl.volume = res[0].volume;
        tvControl.muted = res[0].mute;
        tvControl.channelList = res[1].channelList.map((obj) => {
            const { channelName, channelNumber } = obj;
            return { channelName: channelName, channelNumber: channelNumber };
        })
    })


    // console.log('changing input')
    // lgtv.subscribe('ssap://tv/switchInput', { inputId: 'HDMI_1' }, (err, res) => {
    //     var a = 0;
    // })

    // console.log('changing input')
    // lgtv.subscribe('ssap://system.launcher/launch', { id: 'com.webos.app.livetv' }, (err, res) => {
    //     var a = 0;
    // })

    // console.log('changing input')
    // lgtv.subscribe('ssap://tv/channelUp', {}, (err, res) => {
    //     var a = 0;
    // })



    // lgtv.subscribe('ssap://com.webos.applicationManager/getForegroundAppInfo', function (err, res) {
    //     console.log(res);
    // });

    // lgtv.subscribe('ssap://com.webos.service.appstatus/getAppStatus', function (err, res) {
    //     console.log(res);
    // });

    // lgtv.subscribe('ssap://system.launcher/launch', function (err, res) {
    //     console.log(res);
    // });

    // lgtv.subscribe('ssap://tv/getChannelList', function (err, res) {
    //     console.log(res);
    // });

    // lgtv.subscribe('ssap://tv/getChannelProgramInfo', (err, res) => {
    //     console.log('info chann')
    //     console.log(res)
    // })

    // lgtv.subscribe('ssap://tv/getCurrentChannel', (err,res)=>{
    //     console.log('current channel')
    //     console.log(res)
    // })
    // lgtv.request('ssap://tv/openChannel', { channelNumber: '16' }, (err, res) => {
    //     console.log('open channel')
    //     console.log(res)
    // })

    // lgtv.request('ssap://tv/getChannelList', (err, res) => {
    //     console.log(res)
    // })

    // lgtv.subscribe('ssap://tv/getExternalInputList', (err, res) => {
    //     console.log(res);
    // })

    // lgtv.subscribe('ssap://com.webos.service.ime/registerRemoteKeyboard', (err, res) => {
    //     // console.log('err', JSON.stringify(err||{}));
    //     // console.log('res', JSON.stringify(res || {}));
    // })

    // lgtv.subscribe('ssap://com.webos.service.ime/insertText', {}, (err, res) => {
    //     console.log('err', JSON.stringify(err||{}));
    //     console.log('res', JSON.stringify(res || {}));
    // });

    // lgtv.request('ssap://api/getServiceList', {}, (err, res) => {
    //     console.log('err', JSON.stringify(err || {}));
    //     console.log('res', JSON.stringify(res || {}))
    // })

    // lgtv.subscribe('ssap://com.webos.service.settings/getCurrentSettings', {}, (err, res) => {
    //     console.log('err', JSON.stringify(err || {}));
    //     console.log('res', JSON.stringify(res || {}));
    // });

    //com.webos.app.accessibility

    // lgtv.request('ssap://system.launcher/launch', {query: "com.webos.app.accessibility"}, (err, res) => {
    //     console.log('err', JSON.stringify(err || {}));
    //     console.log('res', JSON.stringify(res || {}));
    // });

})
lgtv.on('error', () => {
    console.log('error connecting');
})
lgtv.on('closed', () => {
    console.log('closed')
})

alexa.addListener(Alexa.EVENTS.TURNOFF, (data) => {
    lgtv.request('ssap://system/turnOff', () => {
        console.log('payload  received');
    })
})

alexa.addListener(Alexa.EVENTS.MUTE, (payload, cb) => {
    const { mute } = payload;
    lgtv.request('ssap://audio/setMute', { "mute": mute }, (err, res) => {
        cb(tvControl);
    })
});

alexa.addListener(Alexa.EVENTS.PLAYBACK, (payload, cb) => {
    let uri = undefined;
    if (payload == 'Play')
        uri = 'ssap://media.controls/play'
    else if (payload == 'Pause')
        uri = 'ssap://media.controls/pause'
    else if (payload == 'Stop') {
        uri = 'ssap://media.controls/stop'
    } else {
        return cb('some err', null);
    }

    return lgtv.request(uri, {}, (err, res) => {
        cb(null, res);
    })

})

alexa.addListener(Alexa.EVENTS.VOLUME, (payload, cb) => {

    let { volume } = payload;
    if ('volumeDefault' in payload && !payload.volumeDefault)
        volume += tvControl.volume;

    if (volume > 12)
        volume = 12

    lgtv.request('ssap://audio/setVolume', { "volume": volume }, (err, res) => {
        cb(tvControl);
    })
})

alexa.addListener(Alexa.EVENTS.INPUT, (ref, cb) => {
    const payload = ref.payload;

    if (payload.input == 'TV') {
        lgtv.request('ssap://system.launcher/launch', { id: 'com.webos.app.livetv' }, (err, res) => {
            cb(null, res);
        })
    } else if (payload.input.startsWith("HDMI")) {
        let input;
        if (payload.input === 'HDMI 1' || payload.input === 'HDMI UM')
            input = 'HDMI_1';
        if (payload.input === 'HDMI 2' || payload.input === 'HDMI DOIS')
            input = 'HDMI_2';
        if (payload.input === 'HDMI 3' || payload.input === 'HDMI TRÊS')
            input = 'HDMI_3';

        lgtv.subscribe('ssap://tv/switchInput', { inputId: input }, (err, res) => {
            cb(err, res);
        })
    }

})

alexa.addListener(Alexa.EVENTS.CHANNEL, (ref, cb) => {

    var handled = false;

    let payload = {};

    if ('channelCount' in ref.payload) {
        let uri = ref.payload.channelCount > 0 ? 'ssap://tv/channelUp' : 'ssap://tv/channelDown';
        return lgtv.request(uri, {}, (err, res) => { })
    }
    else if ('number' in ref.payload.channel) {
        payload.channelNumber = ref.payload.channel.number;
        handled = true;
    } else if ('name' in ref.payload.channelMetadata) {
        let list = JSON.parse(ref.cookie.channels);
        let name = ref.payload.channelMetadata.name;


        const filtered = list.filter((item) => name.split(' ').some((partName) => item.channelName.toLowerCase().includes(partName)))
        if (filtered && filtered.length > 0) {
            payload = filtered[0];
            handled = true;
        }
    }

    if (handled) {
        return lgtv.request('ssap://tv/openChannel', payload, (err, resp) => {
            cb(err, resp);
        });
    } else {
        return cb(null, "can't handle channel update")
    }

});

// Auth
// directive:Object {header: Object, payload: Object}
// header:Object {namespace: "Alexa.Authorization", name: "AcceptGrant", messageId: "3c6d75cb-ec48-4e77-b472-10d18d55c04d", …}
// messageId:"3c6d75cb-ec48-4e77-b472-10d18d55c04d"
// name:"AcceptGrant"
// namespace:"Alexa.Authorization"
// payloadVersion:"3"