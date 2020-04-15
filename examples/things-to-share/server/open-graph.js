const fetch = require('node-fetch');
const { parse } = require('node-html-parser');

const rx = /https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;

const getTwoLevels = async url => {
    const data = await getGraphData(url);
    if (data && data['og:description']) {
        let mainDesc = data['og:description'][0].trim();
        if (mainDesc.startsWith('“') && mainDesc.endsWith('”')) {
            mainDesc = mainDesc.replace(/”\s*$/, '').replace(/^\s*“/, '');
            data['og:description'][0] = mainDesc;
        }
        const innerUrl = mainDesc.match(rx);
        if (innerUrl) {
            const url = innerUrl[0];
            const innerData = await getGraphData(url);
            if (innerData) {
                if (!innerData['og:url'] || innerData['og:url'][0] !== data['og:url'][0]) {
                    data['embedded'] = innerData;
                    const without = mainDesc.replace(url, '').trim();
                    // if it was at the end, we can take it off
                    if (mainDesc.startsWith(without)) {
                        data['og:description'][0] = without;
                    }
                }
            }
        }
    }
    return data;
};

const getGraphData = async (url, cb) => {
    try {
        const res = await fetch(url);
        if (!res.headers.get('Content-type').startsWith('text/html')) {
            return null;
        }
        const text = await res.text();
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
        return ogs;
    } catch (_err) {
        return null;
    }
};

module.exports = { getGraphData, getTwoLevels };
