// @flow

import 'regenerator-runtime';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { createInMemoryEphemeralClient } from '../client-bundle';
import { useSyncStatus, useItem, useItems, useCollection, useQuery } from './';

/*::
declare var describe: (string, () => mixed) => void;
declare var it: (string, () => mixed) => void;
declare var expect: any;
*/

const schemas = {
    items: {
        type: 'object',
        attributes: {
            id: 'string',
            title: 'string',
            count: 'number',
        },
    },
};

describe('useQuery', () => {
    it('should work', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').save('other', obj2);

        const { result, waitForNextUpdate } = renderHook(() =>
            useQuery(React, client, 'items', 'id', '>', 'p'),
        );
        expect(result.current[1]).toEqual([]);
        await waitForNextUpdate();
        expect(result.current[1]).toEqual([{ key: 'root', value: obj }]);

        // Not added here
        act(() => {
            client.getCollection('items').save('omni', { ...obj2, id: 'omni' });
        });
        expect(result.current[1]).toEqual([{ key: 'root', value: obj }]);

        // But added here
        const pomni = { ...obj2, id: 'pomni' };
        act(() => {
            client.getCollection('items').save('pomni', pomni);
        });
        expect(result.current[1]).toEqual([
            { key: 'root', value: obj },
            { key: 'pomni', value: pomni },
        ]);
    });
});

describe('useCollection', () => {
    it('should work', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').save('other', obj2);

        const { result, waitForNextUpdate } = renderHook(() =>
            useCollection(React, client, 'items'),
        );
        // expect(result.current[1]).toEqual({});
        // await waitForNextUpdate();
        expect(result.current[1]).toEqual({ root: obj, other: obj2 });
        await waitForNextUpdate();

        // Updates when an item updates
        act(() => {
            client.getCollection('items').setAttribute('other', ['title'], 'New Title');
        });
        // await waitForNextUpdate();
        expect(result.current[1].other.title).toBe('New Title');

        // Adds an item
        const obj3 = { id: 'more', title: 'More', count: 100 };
        act(() => {
            client.getCollection('items').save(obj3.id, obj3);
        });
        expect(result.current[1][obj3.id]).toBe(obj3);

        // Removes an item
        act(() => {
            client.getCollection('items').delete(obj3.id);
        });
        expect(result.current[1][obj3.id]).toBe(undefined);
    });

    it('should return null if nothing is cached', async () => {});
});

describe('useSyncStatus', () => {
    it('should work & update', () => {
        let updateStatus;
        const nullNetwork = (_, __, ___) => ({
            initial: { status: 'disconnected' },
            createSync: (_, _updateStatus, __) => {
                updateStatus = _updateStatus;
                return () => {};
            },
            close() {},
        });
        const client = createInMemoryEphemeralClient(schemas, nullNetwork);

        const { result, waitForNextUpdate } = renderHook(() => useSyncStatus(React, client));
        expect(result.current).toEqual({ status: 'disconnected' });
        act(() => updateStatus({ status: 'connected' }));
        expect(result.current).toEqual({ status: 'connected' });
    });
});

describe('useItems', () => {
    it('should work', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').save('other', obj2);

        const { result, waitForNextUpdate } = renderHook(() =>
            useItems(React, client, 'items', ['root', 'other']),
        );
        expect(result.current[1]).toEqual({ root: obj, other: obj2 });

        act(() => {
            client.getCollection('items').setAttribute('other', ['title'], 'New Title');
        });
        expect(result.current[1].other.title).toBe('New Title');
    });

    it('should return null if none are cached', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').clearCached('root');
        client.getCollection('items').save('other', obj2);
        client.getCollection('items').clearCached('other');

        const { result, waitForNextUpdate } = renderHook(() =>
            useItems(React, client, 'items', ['root', 'other']),
        );
        expect(result.current[1]).toEqual(null);
        await waitForNextUpdate();
        expect(result.current[1]).toEqual({ root: obj, other: obj2 });
    });

    it('should return what we have if some are cached', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').clearCached('root');
        client.getCollection('items').save('other', obj2);

        const { result, waitForNextUpdate } = renderHook(() =>
            useItems(React, client, 'items', ['root', 'other']),
        );
        expect(result.current[1]).toEqual({ other: obj2, root: false });
        await waitForNextUpdate();
        expect(result.current[1]).toEqual({ root: obj, other: obj2 });
    });
});

describe('useItem', () => {
    it('should report false then null for missing value', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const { result, waitForNextUpdate } = renderHook(() =>
            useItem(React, client, 'items', 'root'),
        );
        expect(result.current[1]).toBe(false);
        await waitForNextUpdate();
        expect(result.current[1]).toBe(null);
    });

    it('should report false then populated for uncached value', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').clearCached('root');
        const { result, waitForNextUpdate } = renderHook(() =>
            useItem(React, client, 'items', 'root'),
        );
        expect(result.current[1]).toBe(false);
        await waitForNextUpdate();
        expect(result.current[1]).toBe(obj);
    });

    it('should report populated for cached value', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        client.getCollection('items').save('root', obj);
        const { result, waitForNextUpdate } = renderHook(() =>
            useItem(React, client, 'items', 'root'),
        );
        expect(result.current[1]).toBe(obj);
    });

    it('should update when the item is created', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const { result, waitForNextUpdate } = renderHook(() =>
            useItem(React, client, 'items', 'root'),
        );
        expect(result.current[1]).toBe(false);
        await waitForNextUpdate();
        expect(result.current[1]).toBe(null);
        const obj = { id: 'root', title: 'Title', count: 0 };
        act(() => {
            client.getCollection('items').save('root', obj);
        });
        expect(result.current[1]).toBe(obj);
    });

    it('should update when the item is updated', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        client.getCollection('items').save('root', obj);
        const { result, waitForNextUpdate } = renderHook(() =>
            useItem(React, client, 'items', 'root'),
        );
        expect(result.current[1]).toBe(obj);
        act(() => {
            client.getCollection('items').setAttribute('root', ['title'], 'New Title');
        });
        expect(result.current[1].title).toBe('New Title');
        expect(result.current[1]).not.toBe(obj);
    });

    it('should update when the ID changes', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').save('other', obj2);

        const { result, waitForNextUpdate, rerender } = renderHook(
            ({ id }) => useItem(React, client, 'items', id),
            { initialProps: { id: 'root' } },
        );
        expect(result.current[1]).toBe(obj);

        rerender({ id: 'other' });

        expect(result.current[1]).toBe(obj2);

        act(() => {
            client.getCollection('items').setAttribute('other', ['title'], 'New Title');
        });
        expect(result.current[1].title).toBe('New Title');
    });

    it('should clear when the ID changes to uncached item', async () => {
        const client = createInMemoryEphemeralClient(schemas);
        const obj = { id: 'root', title: 'Title', count: 0 };
        const obj2 = { id: 'other', title: 'Other', count: 5 };
        client.getCollection('items').save('root', obj);
        client.getCollection('items').save('other', obj2);
        client.getCollection('items').clearCached('other');

        const { result, waitForNextUpdate, rerender } = renderHook(
            ({ id }) => useItem(React, client, 'items', id),
            { initialProps: { id: 'root' } },
        );
        expect(result.current[1]).toBe(obj);

        rerender({ id: 'other' });

        expect(result.current[1]).toBe(false);
        await waitForNextUpdate();
        expect(result.current[1]).toBe(obj2);

        act(() => {
            client.getCollection('items').setAttribute('other', ['title'], 'New Title');
        });
        expect(result.current[1].title).toBe('New Title');
    });
});
