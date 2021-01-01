import { schemas as fooodSchemas } from '../foood/collections';

const { runMulti2, run } = require('../../packages/server-bundle/full.js');
const { validateDelta } = require('../../packages/nested-object-crdt/src/schema.js');
require('regenerator-runtime');
const fs = require('fs');
const dataPath = '.data/store';
const port = process.env.PORT != null ? parseInt(process.env.PORT) : 9090;

const treeNotesSchemas = require('../tree-notes/collections.js');
const result = runMulti2(dataPath, { trees: treeNotesSchemas, foood: fooodSchemas }, port);

console.log('listening on ' + port);
result.app.get('/', (req, res) => {
    res.send('ok');
    res.end();
});

if (process.env.BACKUP_SECRET) {
    const backupRoute = require('../../packages/server-backup');
    result.app.get(
        '/backup/' + process.env.BACKUP_SECRET,
        backupRoute('.data/store', process.env.FIREBASE_APP),
    );
}
if (process.env.BACKUP_DOWNLOAD) {
    const { downloadRoute } = require('../../packages/server-backup');
    result.app.get('/backup/' + process.env.BACKUP_DOWNLOAD, downloadRoute('.data/store'));
}

if (process.env.UPLOADS_FIREBASE_APP) {
    console.log('Enabling uploads!');
    const admin = require('firebase-admin');

    const serviceAccount = JSON.parse(fs.readFileSync(process.env.UPLOADS_FIREBASE_CONFIG, 'utf8'));

    const uploadAccount = admin.initializeApp(
        {
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${process.env.UPLOADS_FIREBASE_APP}.firebaseio.com`,
            storageBucket: `gs://${process.env.UPLOADS_FIREBASE_APP}.appspot.com/`,
        },
        'uploads',
    );

    result.app.get('/uploads/*', (req, res) => {
        const requested = req.path.slice('/uploads/'.length);
        const storage = uploadAccount.storage();
        const url = storage
            .bucket()
            .file(requested)
            .getSignedUrl({
                action: 'read',
                expires: Date.now() + 30 * 1000, // 30 seconds, why not
            })
            .then(
                function([url]) {
                    res.status(302);
                    res.header('Location', url);
                    res.end();
                },
                err => {
                    console.log('Failed to get image url');
                    console.error(err);
                    res.status(404);
                    res.send('Not found');
                },
            );
    });
}
