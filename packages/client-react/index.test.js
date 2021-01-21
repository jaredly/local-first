// @flow

import 'regenerator-runtime';
import * as React from 'react';
// import { render, act } from '@testing-library/react';
import { create, act } from 'react-test-renderer';
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

function setup(hook) {
    const returnVal = { current: null };

    const TestComponent = () => {
        returnVal.current = hook();
        return null;
    };

    let root;
    act(() => {
        root = create(React.createElement(TestComponent));
    });
    // expect(root.toJSON()).toBe(false);

    // function TestComponent() {
    //     returnVal.current = hook();
    //     return null;
    // }
    // render(React.createElement(TestComponent));
    // return returnVal.current;
    return returnVal;
}

describe('useThing should track changes', () => {
    it('should work you know', () => {
        const client = createInMemoryEphemeralClient(schemas);

        // const TestComponent = () => {
        //     const state = React.useState(false);
        //     return React.createElement('div');
        // };

        // let root;
        // act(() => {
        //     root = create(React.createElement(TestComponent));
        // });
        // expect(root.toJSON()).toBe(false);

        const result = setup(() => useItem(React, client, 'items', 'root'));
        // const { result } = renderHook(() => React.useState(false));
        // const result = setup(() => React.useState(false));
        expect(result.current[1]).toBe(false);
        act(() => {
            setTimeout(() => {}, 100);
        });
        expect(result).toBe(null);
    });
});
