// @flow

import { parse } from 'node-html-parser';
const fetch = require('node-fetch');

export const addProxy = app => {
    app.get('/proxy/info', (req, res) => {
        if (!req.query.url) {
            return res.status(400).end();
        }
        fetch(req.query.url)
            .then(res => res.text())
            .then(text => {
                const parsed = parse(text);
                console.log('parsed', text.length);
                const ogs = {};
                parsed.querySelectorAll('meta').forEach(meta => {
                    const property = meta.getAttribute('property');
                    if (property && property.startsWith('og:')) {
                        const content = meta.getAttribute('content');
                        if (!ogs[property]) {
                            ogs[property] = [content];
                        } else {
                            ogs[property].push(content);
                        }
                    }
                });
                res.json(ogs);
            })
            .catch(err => {
                res.status(500).json({ failed: true, error: err.message });
            });
    });
};
