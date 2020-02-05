// @flow
import makeClient, {
    getCollection,
    onMessage,
    syncMessages,
    syncFailed,
    syncSucceeded,
    debounce,
    type ClientState,
    type CRDTImpl,
} from '../simple/client';
import backOff from '../shared/back-off';

const sync = async function<Delta, Data>(
    url: string,
    client: ClientState<Delta, Data>,
) {
    const messages = syncMessages(client.collections);
    console.log('messages', messages);
    const res = await fetch(`${url}?sessionId=${client.sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
    if (res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
    }
    syncSucceeded(client.collections);
    const data = await res.json();
    data.forEach(message => onMessage(client, message));
};

const poller = (time, fn) => {
    let tid = null;
    const poll = () => {
        clearTimeout(tid);
        fn()
            .catch(() => {})
            .then(() => {
                // tid = setTimeout(poll, time);
            });
    };
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.hidden) {
                clearTimeout(tid);
            } else {
                poll();
            }
        },
        false,
    );
    window.addEventListener(
        'focus',
        () => {
            poll();
        },
        false,
    );
    return poll;
};

export default function<Delta, Data>(
    url: string,
    sessionId: string,
    crdt: CRDTImpl<Delta, Data>,
): ClientState<Delta, Data> {
    const poll = poller(
        3 * 1000,
        () =>
            new Promise(res => {
                backOff(() =>
                    sync(url, client).then(
                        () => {
                            res();
                            return true;
                        },
                        err => {
                            syncFailed(client.collections);
                            return false;
                        },
                    ),
                );
            }),
    );
    const client = makeClient<Delta, Data>(crdt, sessionId, debounce(poll), [
        'tasks',
    ]);

    poll();
    return client;
}
