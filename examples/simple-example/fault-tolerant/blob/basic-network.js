// @flow
import type { BlobNetworkCreator, Network, Blob } from '../delta/types';
import { peerTabAwareSync } from '../delta/peer-tabs';
import poller from '../../client/poller';
import backOff from '../../shared/back-off';
import { debounce } from '../debounce';

type SyncStatus = { status: 'connected' } | { status: 'disconnected' };

// const createNetwork = (
// ): BlobNetworkCreator => {
//     return {
//         setDirty: sync,
//         onSyncStatus: fn => {
//             connectionListeners.push(fn);
//         },
//         getSyncStatus() {
//             return currentSyncStatus;
//         },
//         sendCrossTabChanges(peerChange) {
//             sendCrossTabChange(peerChange);
//         },
//     };
// }

// Cases:
/*
a) synced
b) local ahead -> ok so maybe I need to track local changes, and set a "local dirty" flag when I make changes. Ok.
c) local behind -> and store the server's etag.
d) both new


How to know what state you're in?
- we can track whether we're ahead locally
- and we can determine if we're behind with the 304-get.

So, the procedure is:
- get from persistence: (?data if it's new, and the server's etag)
- get from the network: (?remote data if it's newer than the stored server etag, and the accompanying etag)
then
- if we get "nulls" for both datas, we're synced
- if only our data is new: push it to the network (receiving + storing a new etag)
- if only network data is new: merge it into local
- if both are new, merge remote into local, then push the merged result to remote, then store the resulting etag.



new local, old remote
new local, new remote
old local, new remote
old local, old remote


Q: Can I use, as my "etag", an HLC? e.g. the largest HLC in the blob?
And you can compare, and say "is the <etag> of this blob greater than my clock ... if so I need to merge it ..."
hmm so I think there's a case where it breaks, unfortunately,
because we don't have locking.

Really the only thing I can be sure of is "is the server version the same as the last one I saw".
Yeah, that's what I'll stick with.

On the other hand, for dirty checking, using an HLC is great.

I mean tbh I probably can use the HLC as the etag, I just can't do greater-than comparison on it.

*/

// Ok the part where we get very specific
const syncFetch = async function<Data>(
    getRemote: (etag: ?string) => Promise<?{ blob: Blob<Data>, etag: string }>,
    putRemote: (Blob<Data>) => Promise<string>,

    getLocal: () => Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    /* hrm ok so the case where:

    - getLocal gives a blob and a stamp
    while getting remote, we do a local action, that changes the dirty stamp.
    - remote has changes, so we mergeIntoLocal, yielding a merged data that includes the data of the new stamp.
    ...
    */
    mergeIntoLocal: (
        remote: Blob<Data>,
        etag: string,
    ) => Promise<{ blob: Blob<Data>, stamp: ?string }>,

    updateMeta: (
        serverEtag: ?string,
        dirtyFlagToClear: ?string,
    ) => Promise<void>,
    // getRemote: string => Promise<?Blob<Data>>,
    // putRemote: Blob<Data> => Promise<string>,
    // // url: string,
    // // sessionId: string,
    // getFull,
    // putFull,
    // putEtag,
) {
    const { local, serverEtag } = await getLocal();
    let dirtyStamp = local ? local.stamp : null;
    const remote = await getRemote(serverEtag);
    if (!local && !remote) {
        return; // no changes
    }
    let toSend = local ? local.blob : null;
    if (remote) {
        const response = await mergeIntoLocal(remote.blob, remote.etag);
        toSend = response.blob;
        dirtyStamp = response.stamp;
    }
    let newServerEtag = null;
    if (toSend) {
        newServerEtag = await putRemote(toSend);
    }
    await updateMeta(newServerEtag, dirtyStamp);
};

// TODO dedup with polling network
const createNetwork = <Delta, Data>(
    url: string,
): BlobNetworkCreator<Data, SyncStatus> => (
    getLocal,
    mergeIntoLocal,
    updateMeta,
    handleCrossTabChanges,
): Network<SyncStatus> => {
    const connectionListeners = [];
    let currentSyncStatus = { status: 'disconnected' };

    const { sendConnectionStatus, sendCrossTabChange, sync } = peerTabAwareSync(
        status => {
            currentSyncStatus = status;
            connectionListeners.forEach(f => f(currentSyncStatus));
        },
        peerChange => {
            handleCrossTabChanges(peerChange).catch(err =>
                console.log('failed', err.message, err.stack),
            );
        },
        () => {
            console.log('Im the leader');
            const poll = poller(
                3 * 1000,
                () =>
                    new Promise(res => {
                        backOff(() =>
                            syncFetch(
                                async etag => {
                                    const res = await fetch(url, {
                                        headers: {
                                            'If-None-Match': etag ? etag : '',
                                        },
                                    });
                                    if (res.status === 304) {
                                        return null;
                                    }
                                    const blob = await res.json();
                                    const newEtag = res.headers.get('etag');
                                    if (!newEtag) {
                                        throw new Error(
                                            `Remote didn't set an etag`,
                                        );
                                    }
                                    return { blob, etag: newEtag };
                                },
                                async blob => {
                                    const res = await fetch(url, {
                                        method: 'POST',
                                        body: JSON.stringify(blob),
                                        headers: {
                                            'Content-type': 'application/json',
                                        },
                                    });
                                    console.log(res.headers);
                                    const etag = res.headers.get('etag');
                                    if (!etag) {
                                        throw new Error(
                                            `Remote didn't respond to post with an etag`,
                                        );
                                    }
                                    return etag;
                                },
                                getLocal,
                                mergeIntoLocal,
                                updateMeta,
                            ).then(
                                () => {
                                    currentSyncStatus = { status: 'connected' };
                                    connectionListeners.forEach(f =>
                                        f(currentSyncStatus),
                                    );
                                    res();
                                    return true;
                                },
                                err => {
                                    console.error('Failed to sync');
                                    console.error(err);
                                    currentSyncStatus = {
                                        status: 'disconnected',
                                    };
                                    connectionListeners.forEach(f =>
                                        f(currentSyncStatus),
                                    );
                                    return false;
                                },
                            ),
                        );
                    }),
            );
            poll();
            return debounce(poll);
        },
    );

    return {
        setDirty: sync,
        onSyncStatus: fn => {
            connectionListeners.push(fn);
        },
        getSyncStatus() {
            return currentSyncStatus;
        },
        sendCrossTabChanges(peerChange) {
            sendCrossTabChange(peerChange);
        },
    };
};

export default createNetwork;
