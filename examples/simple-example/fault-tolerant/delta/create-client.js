// @flow

import type { Client } from '../types';
import type { Persistence, Network } from './types';

function createClient<SyncStatus>(
    // Does persistence encapsulate the deltamagiggers?
    // crdt: CRDTImpl<Delta, Data>,
    persistence: Persistence,
    network: Network<SyncStatus>,
): Client<SyncStatus> {}
