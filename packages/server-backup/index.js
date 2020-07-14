// ok
const admin = require('firebase-admin');
const pako = require('pako');

const demoBucket = () => {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: 'https://local-first-283212.firebaseio.com',
        storageBucket: 'gs://local-first-283212.appspot.com/',
    });

    return admin.storage().bucket();
};

const suffixes = 'abcdefg'.split('');

// var crypto = require('crypto');
// var hash = crypto
//     .createHash('md5')
//     .update(string)
//     .digest('hex');
// console.log(hash);

// if the most recent week is different, and more than a week older, then rotate

const backup = async (bucket, prefix, buffer) => {
    // const filename = process.argv[2];
    const crypto = require('crypto');
    const fs = require('fs');
    const suffix = '.zip'

    const hash = crypto.createHash('md5');
    hash.update(buffer);
    const digest = hash.digest('base64');
    console.log(digest);

    const now = Date.now();

    const [files] = await bucket.getFiles();
    const daily = await Promise.all(
        files
            .filter(file => file.name.startsWith(prefix + '-daily-'))
            .map(file => file.getMetadata()),
    );
    const weekly = await Promise.all(
        files
            .filter(file => file.name.startsWith(prefix + '-weekly-'))
            .map(file => file.getMetadata()),
    ).sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    if (weekly.some(meta => meta.md5Hash === digest)) {
        // already exists in the weekly backups, can skip
        return;
    }
    const DAY_IN_MS = 1000 / 3600 / 24;
    if (!weekly.length || (new Date(weekly[0]).getTime() - now) / DAY_IN_MS >= 6.5) {
        // const idx = weekly.length ? suffixes.indexOf(weekly[0]) + 1 : 0;
        const idx = weekly.length ? suffixes.indexOf(weekly[0].name.slice(-suffix.length-1)[0] + 1 : 0;
        const letter = suffixes[idx % suffixes.length];
        const stream = bucket.file(prefix + '-weekly-' + letter + suffix).createWriteStream({resumable: false});
        stream.write(buffer);
        stream.end();
    }

    if (daily.some(meta => meta.md5Hash === digest)) {
        // already exists in the days list, all good
        return;
    }

    if (!daily.length || (new Date(daily[0]).getTime() - now) / DAY_IN_MS >= 6.5) {
        const idx = daily.length ? suffixes.indexOf(daily[0].name.slice(-suffix.length-1)[0] + 1 : 0;
        const letter = suffixes[idx % suffixes.length];
        const stream = bucket.file(prefix + '-daily-' + letter + suffix).createWriteStream({resumable: false});
        stream.write(buffer);
        stream.end();
    }

    // console.log(files);
    console.log(files[0].name);
    // console.log(await files[0].getMetadata());
};

backup(demoBucket(), 'something', 'else');
