const axios = require('axios')

exports.handler = function (request, context, cb) {
    console.log('process.env.REMOTE_URL', process.env.REMOTE_URL);

    console.log('::init request::', JSON.stringify(request));
    console.log('::init context::', JSON.stringify(context));

    axios.post(process.env.REMOTE_URL + '/alexa', context, cb);
}


//// define "process.env.REMOTE_URL" env variable on your lambda function
//// matching the settings.js value