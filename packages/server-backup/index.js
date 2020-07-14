// ok
const admin = require('firebase-admin');
const pako = require('pako');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const suffixes = 'abcdefg'.split('');

// if the most recent week is different, and more than a week older, then rotate

const backup = async (bucket, prefix, suffix, buffer) => {
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    const digest = hash.digest('base64');
    console.log(digest);

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
    const DAY_IN_MS = 1000 / 3600 / 24;
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
        console.log('no need for weekly');
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
        console.log('no need for daily');
    }
};

const demoBucket = () => {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: 'https://local-first-283212.firebaseio.com',
        storageBucket: 'gs://local-first-283212.appspot.com/',
    });

    return admin.storage().bucket();
};

const JSZip = require('jszip');

const backupFolder = (bucket, prefix, folder) => {
    const file = new JSZip();
    const walk = (dir, rel) => {
        fs.readdirSync(dir).forEach(name => {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) {
                walk(full, path.join(rel, name));
            } else {
                file.file(path.join(rel, name), fs.readFileSync(full));
            }
        });
    };
    walk(folder, '');
    file.generateAsync({ type: 'nodebuffer' }, buffer => {
        backup(bucket, prefix, '.zip', buffer);
    });
};

const [_, __, arg] = process.argv;
backup(demoBucket(), 'tree-notes', '.md', fs.readFileSync(arg));
