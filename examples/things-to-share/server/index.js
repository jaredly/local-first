// @flow

import 'regenerator-runtime';
import { parse } from 'node-html-parser';
const fetch = require('node-fetch');
const { getTwoLevels } = require('./open-graph.js');

export const addProxy = app => {
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
            }
        );

        // fetch(req.query.url)
        //     .then(res => res.text())
        //     .then(async text => {
        //         const parsed = parse(text);
        //         console.log('parsed', text.length);
        //         const ogs = {};
        //         parsed.querySelectorAll('meta').forEach(meta => {
        //             const property = meta.getAttribute('property');
        //             if (property && property.startsWith('og:')) {
        //                 const content = meta.getAttribute('content');
        //                 if (!ogs[property]) {
        //                     ogs[property] = [content];
        //                 } else {
        //                     ogs[property].push(content);
        //                 }
        //             }
        //         });
        //         if (ogs['og:video:url']) {
        //             const url = ogs['og:video:url'][0];
        //             const res = await fetch(url, { method: 'HEAD' });
        //             if (res.headers.get('Content-Type').startsWith('text/html')) {
        //                 console.log('Not a real video');
        //                 delete ogs['og:video:url'];
        //                 ogs['og:video:html_url'] = [url];
        //             }
        //         }
        //         res.json(ogs);
        //     })
        //     .catch(err => {
        //         res.status(500).json({ failed: true, error: err.message });
        //     });
    });
};
