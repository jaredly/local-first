// @flow
import React from 'react';
import { render } from 'react-dom';
import * as crdt from '@local-first/nested-object-crdt';
import type { Delta, CRDT as Data } from '@local-first/nested-object-crdt';
import makeClient from './client';

let sessionId = localStorage.getItem('sessionId');
if (!sessionId) {
    sessionId = Math.random()
        .toString(36)
        .slice(2);
    localStorage.setItem('sessionId', sessionId);
}
const messageQueue = [];
const send = message => {
    messageQueue.push(message);
};
const client = makeClient(crdt, sessionId, send);

const App = () => 'Hello';

const root = document.getElementById('root');
if (root) {
    render(<App />, root);
}
