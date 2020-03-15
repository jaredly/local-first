// @flow

export type Store<T> = {
    get(string): Promise<?T>,
    getAll(): Promise<Array<{ id: string, value: T }>>,
    put<T>(T, ?string): Promise<void>,
    count(): Promise<number>,
};

export type Transaction<T> = {
    objectStore<T>(string): Store<T>,
    store: Store<T>,
    done: Promise<void>,
};

export type DB = {
    get<T>(string, string): Promise<?T>,
    getAll<T>(string): Promise<Array<{ id: string, value: T }>>,
    count(string): Promise<number>,
    transaction(
        string | Array<string>,
        'readonly' | 'readwrite',
    ): Transaction<any>,
};
