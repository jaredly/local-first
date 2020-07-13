// @flow
import express from 'express';
import fs from 'fs';

const genEtag = stat => `${stat.mtime.getTime()}:${stat.size}`;

export const getBlob = (
    filePath: string,
    ifNoneMatch: ?string,
    res: express.Response,
) => {
    if (!fs.existsSync(filePath)) {
        res.status(404);
        return res.end();
    }
    const stat = fs.statSync(filePath);
    const etag = genEtag(stat);
    if (etag == ifNoneMatch) {
        res.set('ETag', etag);
        console.log('GET no change', etag);
        res.status(304);
        res.end();
        return;
    }
    console.log('GET', etag);
    res.set('ETag', etag);
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
};

export const putBlob = function<T: {}>(
    filePath: string,
    body: T,
    res: express.Response,
) {
    fs.writeFileSync(filePath, JSON.stringify(body), 'utf8');
    const stat = fs.statSync(filePath);
    const etag = genEtag(stat);
    console.log('Updating server state', etag);
    res.set('ETag', etag);
    res.status(204);
    res.end();
};
