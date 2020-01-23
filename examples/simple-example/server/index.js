#!/usr/bin/env node -r @babel/register
// @flow

import express from 'express';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import ws from 'express-ws';
import make, { onMessage } from './server';
import type { ClientMessage, ServerMessage } from './server';
const app = express();
ws(app);

app.use(require('cors')());
app.use(require('body-parser').json());

const server = make<Delta, Data>(crdt);

app.post('/sync', (req, res) => {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    const response = req.body
        .map(message => onMessage(server, req.query.sessionId, message))
        .filter(Boolean);

    console.log(response);
    console.log(server.collections.tasks);
    res.json(response);
});

app.ws('/sync', function(ws, req) {
    if (!req.query.sessionId) {
        throw new Error('No sessionId');
    }
    ws.on('message', data => {
        const message = JSON.parse(data);
        const response = req.body
            .map(message => onMessage(server, req.query.sessionId, message))
            .filter(Boolean);

        console.log('ok');
        ws.send(JSON.stringify(response));
    });
    // server.onConnect({
    //     on: (fn: (ClientMessage<Delta, Data>) => void) =>
    //         ws.on('message', data => {
    //             fn(JSON.parse(data));
    //         }),
    //     sessionId: req.query.sessionId,
    //     send: (msg: ServerMessage<Delta, Data>) => ws.send(JSON.stringify(msg)),
    // });
    // ws.on('message', function(msg) {
    //     ws.send(msg);
    // });
});

app.listen(9900);
console.log('listening on 9900');
