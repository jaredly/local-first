// ok
const admin = require('firebase-admin');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const suffixes = 'abcdefg'.split('');

// if the most recent week is different, and more than a week older, then rotate

const backup = async (bucket, prefix, suffix, buffer) => {
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    const digest = hash.digest('base64');

    const now = Date.now();

    const [files] = await bucket.getFiles();
    const metas = await Promise.all(files.map(file => file.getMetadata().then(x => x[0])));
    const daily = metas
        .filter(file => file.name.startsWith(prefix + '-daily-'))
        .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    const weekly = metas
        .filter(file => file.name.startsWith(prefix + '-weekly-'))
        .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    console.log();
    if (weekly.some(meta => meta.md5Hash === digest)) {
        console.log('alredy in weekly');
        // already exists in the weekly backups, can skip
        return;
    }
    const DAY_IN_MS = 10000; //1000 * 3600 * 24;
    if (!weekly.length || (now - new Date(weekly[0].updated).getTime()) / DAY_IN_MS >= 6.5) {
        const idx = weekly.length
            ? suffixes.indexOf(weekly[0].name.slice(-suffix.length - 1)[0]) + 1
            : 0;
        const letter = suffixes[idx % suffixes.length];
        const stream = bucket
            .file(prefix + '-weekly-' + letter + suffix)
            .createWriteStream({ resumable: false });
        stream.write(buffer);
        stream.end();
        return; // don't need to call it daily too
    } else {
        console.log('not new enough for weekly');
    }

    if (daily.some(meta => meta.md5Hash === digest)) {
        console.log('already in daily');
        // already exists in the days list, all good
        return;
    }

    if (!daily.length || (now - new Date(daily[0].updated).getTime()) / DAY_IN_MS >= 0.8) {
        const idx = daily.length
            ? suffixes.indexOf(daily[0].name.slice(-suffix.length - 1)[0]) + 1
            : 0;
        const letter = suffixes[idx % suffixes.length];
        const stream = bucket
            .file(prefix + '-daily-' + letter + suffix)
            .createWriteStream({ resumable: false });
        stream.write(buffer);
        stream.end();
    } else {
        console.log('not new enough for daily');
    }
};

const tarfs = require('tar-fs');

const tarFolder = folder =>
    new Promise((res, rej) => {
        const stream = tarfs.pack(folder);
        const bufs = [];
        stream.on('data', function(d) {
            bufs.push(d);
        });
        stream.on('error', function(err) {
            rej(err);
        });
        stream.on('end', function() {
            const buf = Buffer.concat(bufs);
            res(buf);
        });
    });

const backupFolder = (bucket, prefix, folder) => {
    return tarFolder(folder).then(buf => {
        return backup(bucket, prefix, '.tar.gz', buf);
    });
};

const backupRoute = (baseDir, appId) => (req, res) => {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: `https://${appId}.firebaseio.com`,
        storageBucket: `gs://${appId}.appspot.com/`,
    });
    const bucket = admin.storage().bucket();
    const fs = require('fs');
    const path = require('path');
    Promise.all(
        fs.readdirSync(baseDir).map(name => {
            console.log('Backing up', name);
            return backupFolder(bucket, name + '/backup', path.join(baseDir, name));
        }),
    ).then(
        () => {
            res.send('Done!');
            res.end();
        },
        err => {
            console.error(err);
            res.status(500);
            res.send('Failed :(');
            res.end();
        },
    );
};

const downloadRoute = folder => (req, res) => {
    tarFolder(folder).then(buffer => {
        const hash = crypto.createHash('md5');
        hash.update(buffer);
        const digest = hash.digest('base64');
        res.setHeader(`Content-disposition', 'attachment; filename=${digest}.json.gz`);
        res.send(buffer);
    });
};

module.exports = backupRoute;
module.exports.backupFolder = backupFolder;
module.exports.backup = backup;
