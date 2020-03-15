// @flow
import type { BlobNetworkCreator, Network, Blob, PeerChange } from '../types';
import { peerTabAwareNetwork } from '../peer-tabs';
import poller from '../poller';
import backOff from '../back-off';
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
    ) => Promise<?{ blob: Blob<Data>, stamp: ?string }>,

    updateMeta: (
        serverEtag: ?string,
        dirtyFlagToClear: ?string,
    ) => Promise<void>,
) {
    const { local, serverEtag } = await getLocal();
    let dirtyStamp = local ? local.stamp : null;
    console.log(
        `[blob]`,
        dirtyStamp ? 'local changes!' + dirtyStamp : 'no local changes',
    );
    const remote = await getRemote(serverEtag);
    if (!local && !remote) {
        console.log('bail');
        return; // no changes
    }
    let toSend = local ? local.blob : null;
    if (remote) {
        const response = await mergeIntoLocal(remote.blob, remote.etag);
        if (response) {
            toSend = response.blob;
            dirtyStamp = response.stamp;
            console.log('[blob] merged with changes');
        } else {
            toSend = null;
            // TODO dirtyStamp should not be truthy in this case I don't think
            // console.log('dirtyStamp', dirtyStamp);
            dirtyStamp = null;
        }
    }
    let newServerEtag = null;
    if (toSend) {
        console.log(
            remote ? '[blob] pushing up merged' : '[blob] pushing up local',
        );
        const t = toSend;
        Object.keys(toSend).forEach(colid => {
            if (Array.isArray(t[colid])) {
                throw new Error('Array in collection!');
            }
        });
        newServerEtag = await putRemote(toSend);
    }
    if (newServerEtag || dirtyStamp) {
        console.log('clearing dirty stamp');
        await updateMeta(newServerEtag, dirtyStamp);
    }
};

const makeSync = <Delta, Data>(
    url: string,
    getLocal: () => Promise<{
        local: ?{ blob: Blob<Data>, stamp: string },
        serverEtag: ?string,
    }>,
    mergeIntoLocal: (
        remote: Blob<Data>,
        etag: string,
        (PeerChange) => mixed,
    ) => Promise<?{ blob: Blob<Data>, stamp: ?string }>,
    updateMeta: (
        newServerEtag: ?string,
        dirtyFlagToClear: ?string,
    ) => Promise<void>,
    sendCrossTabChanges,
    updateSyncStatus,
    softResync,
) => {
    console.log(
        '[blob] Maing sync with',
        url,
        getLocal,
        mergeIntoLocal,
        updateMeta,
    );
    console.log('[blob] Im the leader (basic blob)');
    const poll = poller(
        3 * 1000,
        () =>
            new Promise(res => {
                backOff(() =>
                    syncFetch(
                        async etag => {
                            console.log('[blob] Checking for new data', etag);
                            const res = await fetch(url, {
                                headers: {
                                    'If-None-Match': etag ? etag : '',
                                    'Access-control-request-headers':
                                        'etag,content-type,content-length',
                                },
                            });
                            if (res.status === 304 || res.status === 404) {
                                console.log(
                                    '[blob] No changes from server!',
                                    etag,
                                );
                                return null;
                            }
                            if (res.status !== 200) {
                                throw new Error(
                                    `Unexpected status on get ${res.status}`,
                                );
                            }
                            const blob = await res.json();
                            const newEtag = res.headers.get('etag');
                            console.log('[blob] New etag', newEtag);
                            if (!newEtag) {
                                throw new Error(
                                    `Remote didn't set an etag on get`,
                                );
                            }
                            return { blob, etag: newEtag };
                        },
                        async blob => {
                            console.log('[blob] Pushing new data');
                            const res = await fetch(url, {
                                method: 'PUT',
                                body: JSON.stringify(blob),
                                headers: {
                                    'Content-type': 'application/json',
                                    'Access-control-request-headers':
                                        'etag,content-type,content-length',
                                },
                            });
                            if (res.status !== 204) {
                                throw new Error(
                                    `Unexpected status: ${
                                        res.status
                                    }, ${JSON.stringify(res.headers)}`,
                                );
                            }
                            const etag = res.headers.get('etag');
                            if (!etag) {
                                throw new Error(
                                    `Remote didn't respond to post with an etag`,
                                );
                            }
                            return etag;
                        },
                        getLocal,
                        async (remote, etag) => {
                            const res = await mergeIntoLocal(
                                remote,
                                etag,
                                sendCrossTabChanges,
                            );
                            if (res) {
                                softResync();
                            }
                            return res;
                        },
                        updateMeta,
                    ).then(
                        () => {
                            updateSyncStatus({ status: 'connected' });
                            res();
                            return true;
                        },
                        err => {
                            console.error('Failed to sync blob ' + err.message);
                            console.error(err.message);
                            console.error(err.stack);
                            updateSyncStatus({
                                status: 'disconnected',
                            });
                            return false;
                        },
                    ),
                );
            }),
    );
    poll();
    const syncer = debounce(poll);
    return softResync => {
        // might need changes
        return syncer();
    };
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
    return {
        initial: { status: 'disconnected' },
        createSync: (sendCrossTabChanges, updateSyncStatus, softResync) => {
            return makeSync(
                url,
                getLocal,
                mergeIntoLocal,
                updateMeta,
                sendCrossTabChanges,
                updateSyncStatus,
                softResync,
            );
        },
    };
};

export default createNetwork;
