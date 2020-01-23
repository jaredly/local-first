#!/usr/bin/env node -r @babel/register
// @flow

import express from 'express';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import ws from 'express-ws';
import make, { onMessage, getMessages } from './server';
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
    req.body.forEach(message =>
        onMessage(server, req.query.sessionId, message),
    );
    const response = getMessages(server, req.query.sessionId);

    console.log(response);
    console.log(server.collections.tasks);
    res.json(response);
});

const clients = {};

app.ws('/sync', function(ws, req) {
    if (!req.query.sessionId) {
        console.log('no sessionid');
        throw new Error('No sessionId');
    }
    clients[req.query.sessionId] = {
        send: messages => ws.send(JSON.stringify(messages)),
    };
    // server.clients[req.query.sessionId] = {
    //     collections: {},
    //     send: messages => ws.send(JSON.stringify(messages)),
    // };
    ws.on('message', data => {
        const messages = JSON.parse(data);
        messages.forEach(message =>
            onMessage(server, req.query.sessionId, message),
        );
        const response = getMessages(server, req.query.sessionId);

        console.log('ok', data);
        ws.send(JSON.stringify(response));

        Object.keys(clients).forEach(id => {
            if (id !== req.query.sessionId) {
                const response = getMessages(server, id);
                clients[id].send(messages);
            }
        });
    });
    ws.on('close', () => {
        delete clients[req.query.sessionId];
    });
});

app.listen(9900);
console.log('listening on 9900');
