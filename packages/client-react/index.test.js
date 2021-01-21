// @flow

import 'regenerator-runtime';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { createInMemoryEphemeralClient } from '../client-bundle';
import { useItem } from './';

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
