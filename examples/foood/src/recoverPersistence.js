// @flow

const privateName = (prefix: string) => prefix + '-private';
const recoveryAttemptKey = (prefix: string) => prefix + '/automatic-recovery-attempted';
const emptyReplicaCheckKey = (prefix: string) => prefix + '/checked-empty-replica-v1';

const databaseExistsWithOpen = (name: string): Promise<boolean> =>
    new Promise((resolve, reject) => {
        let databaseWasMissing = false;
        const request = window.indexedDB.open(name);

        request.onupgradeneeded = (event: any) => {
            if (event.oldVersion === 0) {
                databaseWasMissing = true;
                if (request.transaction) {
                    request.transaction.abort();
                }
            }
        };
        request.onsuccess = () => {
            request.result.close();
            resolve(true);
        };
        request.onerror = () => {
            if (databaseWasMissing && request.error && request.error.name === 'AbortError') {
                resolve(false);
            } else {
                reject(request.error || new Error(`Unable to inspect IndexedDB database ${name}`));
            }
        };
        request.onblocked = () => {
            reject(new Error(`Inspection of IndexedDB database ${name} was blocked`));
        };
    });

export const existingDatabaseNames = async (): Promise<?Array<string>> => {
    const indexedDB: any = window.indexedDB;
    if (typeof indexedDB.databases !== 'function') {
        return null;
    }
    const databases = await indexedDB.databases();
    return databases.map((database) => database.name).filter(Boolean);
};

export const databaseExists = async (
    name: string,
    knownNames?: ?Array<string>,
): Promise<boolean> => {
    if (knownNames != null) {
        return knownNames.includes(name);
    }
    return databaseExistsWithOpen(name);
};

export const needsReplicaRecovery = async (prefix: string): Promise<boolean> => {
    const hasPublicClock = window.localStorage.getItem(prefix) != null;
    const hasPrivateClock = window.localStorage.getItem(privateName(prefix)) != null;
    if (!hasPublicClock && !hasPrivateClock) {
        return false;
    }

    const knownNames = await existingDatabaseNames();
    const [hasPublicDatabase, hasPrivateDatabase] = await Promise.all([
        databaseExists(prefix, knownNames),
        databaseExists(privateName(prefix), knownNames),
    ]);
    return !hasPublicDatabase || !hasPrivateDatabase;
};

const countRecords = (databaseName: string, storeName: string): Promise<number> =>
    new Promise((resolve, reject) => {
        const request = window.indexedDB.open(databaseName);
        request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(storeName)) {
                database.close();
                resolve(0);
                return;
            }

            const transaction = database.transaction(storeName, 'readonly');
            const countRequest = transaction.objectStore(storeName).count();
            countRequest.onsuccess = () => {
                database.close();
                resolve(countRequest.result);
            };
            countRequest.onerror = () => {
                database.close();
                reject(
                    countRequest.error ||
                        new Error(`Unable to count records in ${databaseName}/${storeName}`),
                );
            };
            transaction.onabort = () => {
                database.close();
                reject(
                    transaction.error ||
                        new Error(`Counting records in ${databaseName}/${storeName} was aborted`),
                );
            };
        };
        request.onerror = () => {
            reject(
                request.error || new Error(`Unable to inspect IndexedDB database ${databaseName}`),
            );
        };
        request.onblocked = () => {
            reject(new Error(`Inspection of IndexedDB database ${databaseName} was blocked`));
        };
    });

export const needsOneTimeEmptyReplicaRecovery = async (prefix: string): Promise<boolean> => {
    const checkKey = emptyReplicaCheckKey(prefix);
    if (window.localStorage.getItem(checkKey) != null) {
        return false;
    }
    const hasOldClock =
        window.localStorage.getItem(prefix) != null ||
        window.localStorage.getItem(privateName(prefix)) != null;
    if (!hasOldClock) {
        return false;
    }

    const recipeCount = await countRecords(prefix, 'recipes:nodes');
    window.localStorage.setItem(checkKey, 'true');
    return recipeCount === 0;
};

const deleteDatabase = (name: string): Promise<void> =>
    new Promise((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            reject(request.error || new Error(`Unable to delete IndexedDB database ${name}`));
        };
        request.onblocked = () => {
            reject(
                new Error(
                    `Deletion of IndexedDB database ${name} was blocked; close other Foood tabs`,
                ),
            );
        };
    });

export const resetReplica = async (prefix: string): Promise<void> => {
    await Promise.all([deleteDatabase(prefix), deleteDatabase(privateName(prefix))]);
    window.localStorage.removeItem(prefix);
    window.localStorage.removeItem(privateName(prefix));
};

export const recoverMissingReplica = async (prefix: string): Promise<boolean> => {
    const attemptKey = recoveryAttemptKey(prefix);
    if (window.sessionStorage.getItem(attemptKey) != null) {
        return false;
    }
    const databaseIsMissing = await needsReplicaRecovery(prefix);
    const existingDatabaseIsEmpty =
        !databaseIsMissing && (await needsOneTimeEmptyReplicaRecovery(prefix));
    if (!databaseIsMissing && !existingDatabaseIsEmpty) {
        return false;
    }

    console.warn(
        databaseIsMissing
            ? 'Foood replica database is missing; resetting local replica'
            : 'Foood replica database is unexpectedly empty; resetting local replica',
    );
    window.sessionStorage.setItem(attemptKey, 'true');
    await resetReplica(prefix);
    window.location.reload();
    return true;
};
