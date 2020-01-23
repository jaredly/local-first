// server.js

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 9104 });

const url = 'http://localhost:9900';

wss.on('connection', (ws, req) => {
    const connection = new WebSocket(url + req.url);
    let pending = [];

    const stats = { toServer: 0, fromServer: 0 };

    connection.onopen = () => {
        console.log('server opened');
        if (pending) {
            pending.forEach(m => connection.send(m));
            pending = null;
        }
        // connection.send('Message From Client');
    };

    connection.onerror = error => {
        console.error('err', error);
        // console.log(`WebSocket error: ${JSON.stringify(error)}`);
    };

    connection.onmessage = e => {
        console.log('here');
        stats.fromServer += e.data.length;
        console.log('from server', e.data.length, stats);
        // console.log(e.data);
        try {
            ws.send(e.data);
        } catch (e) {
            console.log('failed sending message');
            console.error(e);
        }
    };

    connection.onclose = () => {
        console.log('server closed');
    };

    ws.on('close', () => {
        console.log('client close');
        connection.close();
    });

    ws.on('message', message => {
        stats.toServer += message.length;
        console.log('from client', message.length, stats);
        if (pending) {
            pending.push(message);
        } else {
            connection.send(message);
        }
        // console.log(`Received message => ${message}`);
    });
    // ws.send('Hello! Message From Server!!');
});

// // client.js

// const WebSocket = require('ws')
// const url = 'ws://localhost:8080'
