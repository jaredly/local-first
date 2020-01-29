#!/usr/bin/env node
// @flow
require('@babel/register');
const express = require('express');
const ws = require('express-ws');
const { post, onWebsocket, makeServer } = require('./index.js');

const app = express();
ws(app);
app.use(require('cors')());
app.use(require('body-parser').json());

const server = makeServer();

app.post('/sync', (req, res) => {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    res.json(post(server, req.query.sessionId, req.body));
});

const clients = {};

app.ws('/sync', function(ws, req) {
    if (!req.query.sessionId) {
        console.log('no sessionid');
        throw new Error('No sessionId');
    }
    onWebsocket(server, clients, req.query.sessionId, ws);
});

app.listen(9900);
console.log('listening on 9900');
