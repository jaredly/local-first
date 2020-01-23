// let sessionId = localStorage.getItem('sessionId');
// if (!sessionId) {
//     sessionId = Math.random()
//         .toString(36)
//         .slice(2);
//     localStorage.setItem('sessionId', sessionId);
// }

// let messageQueue = [];
let connected = false;
let socket = new WebSocket('ws://localhost:9900/sync?sessionId=' + sessionId);

socket.addEventListener('open', function() {
    console.log('connected');
    // if (messageQueue) {
    //     messageQueue.forEach(message => socket.send(JSON.stringify(message)));
    // }
    // messageQueue = null;
    connected = true;
});

// Listen for messages
socket.addEventListener('message', function({ data }: { data: any }) {
    client.onMessage(JSON.parse(data));
});

const send = message => {
    if (!connected) {
        console.log('tried to send, but not connected', message);
        return false;
    }
    console.log('sending', message);
    message.forEach(message => {
        socket.send(JSON.stringify(message));
    });
    return true;
};

const client = makeClient(crdt, sessionId, send);
