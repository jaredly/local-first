// @flow

import 'regenerator-runtime';
import { parse } from 'node-html-parser';
const fetch = require('node-fetch');
const { getTwoLevels } = require('./open-graph.js');

export const addProxy = (app: { get: (string, (any, any) => void) => void }) => {
    app.get('/proxy/info', (req, res) => {
        if (!req.query.url) {
            return res.status(400).end();
        }
        getTwoLevels(req.query.url).then(
            ogs => {
                res.json(ogs);
            },
            err => {
                res.status(500).json({ failed: true, error: err.message });
            },
        );
    });
};
