const everyauth = require('everyauth');
const express = require('express');

const app = express();
app.use(express.bodyParser())
    .use()

everyauth.facebook
    .appId('362708134215838')
    .appSecret('79536bb773981746b95d9dba5afa6cef')
    .findOrCreateUser(function (session, accessToken, accessTokExtra, fbUserMetadata) {
        console.log(accessToken)
    })
    .redirectPath('/');