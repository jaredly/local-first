const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

module.exports = (url, cb) => {
    fetch(url)
        .then(res => res.text())
        .then(async text => {
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
            if (ogs['og:video:url']) {
                const url = ogs['og:video:url'][0];
                const res = await fetch(url, { method: 'HEAD' });
                if (res.headers.get('Content-Type').startsWith('text/html')) {
                    console.log('Not a real video');
                    delete ogs['og:video:url'];
                    ogs['og:video:html_url'] = [url];
                }
            }
            cb(ogs);
        })
        .catch(err => {
            cb(null);
        });
};
