// @flow
import React from 'react';
import { render } from 'react-dom';

const App = () => 'Hello';

const root = document.getElementById('root');
if (root) {
    render(<App />, root);
}
