# AlexaHomeSkill-LG



### needs to define a settings.js file with the following content from your skill
you might find this at https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html
you will need to create one LWA (Login With Amazon) profile
### and link with your Smart Home Skill
process.env.CLIENT_ID     = '';

process.env.CLIENT_SECRET = '';

### pretty much standard values
process.env.EVENT_URL     = 'https://api.amazonalexa.com/v3/events';

process.env.TOKEN_URL     = 'https://api.amazon.com/auth/o2/token';

### your remote URL (ngrok or localtunnel) for your local server over internet
process.env.REMOTE_URL    = '';

process.env.LGTV_IP = '192.168.1.105:3000'; (LG TV local IP)
