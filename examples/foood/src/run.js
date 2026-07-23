// @flow
import 'regenerator-runtime/runtime';
import run from './';

run().catch((err) => {
    console.error('Unable to start Foood', err);
});
