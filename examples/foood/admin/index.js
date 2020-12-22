// @flow
// import { createManualNetwork } from '../../../packages/core/src/delta/polling-network';
// import createDeltaClient from '../../../packages/core/delta/create-client'
import {
    clientCrdtImpl,
    // createDeltaClient,
    // createPollingNetwork,
    createManualDeltaClient,
    // oneTimePollingSync,
    inMemoryClockPersist,
    PersistentClock,
    makeDeltaInMemoryPersistence,
} from '../../../packages/client-bundle';
import fs from 'fs';
import getForsythRecipes from './extract-recipes';

const schemas = require('../collections');

const addParams = (url, params) => url + (url.includes('?') ? '&' : '?') + params;
const sync = async (client, url) => {
    const messages = await client.getMessages();
    const res = await fetch(addParams(url, `sessionId=${client.clock.now.node}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
    });
    if (res.status !== 200) {
        throw new Error(`Unexpected status while syncing: ${res.status}`);
    }
    await client.receive(await res.json());
};

console.log('hi here');

const getInput = (prompt) => {
    return new Promise((res, rej) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        readline.question(prompt, (name) => {
            readline.close();
            res(name);
        });
    });
};

const getUsername = async () => {
    const email = await getInput('email:');
    const res = await fetch(`${baseUrl}/api/check-login?email=${encodeURIComponent(email)}`);
    if (res.status === 204) {
        return email;
    }
    console.log('Unrecognized email address.', res.status);
    console.log(await res.text());
    return getUsername();
};

const login = async () => {
    const email = await getUsername();
    const password = await getInput('password:');
    const res = await fetch(`${baseUrl}/api/login`, {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });
    if (res.status !== 200) {
        console.log(`Unable to login: ${res.status}`);
        return;
    }
    console.log(res.headers);
    const token = res.headers.get('x-session');
    if (token == null || token === '') {
        console.log('No token found');
        return;
    }
    console.log(token);
    fs.writeFileSync(tokenFile, token, 'utf8');
    const data = await res.json();
    console.log(JSON.stringify(data));
    return token;
};

const tokenFile = '.session';
const baseUrl = `http://localhost:9090`;

const genId = () => Math.random().toString(36).slice(2);

const main = async () => {
    const authUrl = `${baseUrl}/auth/login`;
    const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : await login();
    if (token == null || token === '') {
        console.log('Authentication failed.');
        return;
    }
    const url = `${baseUrl}/dbs/sync?db=foood&token=${token}`;

    const persistence = makeDeltaInMemoryPersistence(Object.keys(schemas));
    const clock = new PersistentClock(inMemoryClockPersist());
    const client = createManualDeltaClient(clientCrdtImpl, schemas, clock, persistence);

    const col = client.getCollection('recipes');
    const tagsCol = client.getCollection('tags');

    await sync(client, url);

    const allRecipes = await col.loadAll();
    const allTags = await tagsCol.loadAll();
    fs.writeFileSync('./recipes.json', JSON.stringify(allRecipes, null, 2), 'utf8');
    fs.writeFileSync('./tags.json', JSON.stringify(allTags, null, 2), 'utf8');

    const allTagsByName = {};
    Object.keys(allTags).forEach((id) => (allTagsByName[allTags[id].text] = allTags[id]));
    const allRecipesByTitle = {};
    Object.keys(allRecipes).forEach(
        (id) => (allRecipesByTitle[allRecipes[id].title] = allRecipes[id]),
    );

    const { recipes, tags } = getForsythRecipes();

    const tagsToAdd = {};
    for (const name of Object.keys(tags)) {
        if (!allTagsByName[name]) {
            const id = genId();
            tagsToAdd[name] = id;
            await tagsCol.save(id, {
                id,
                text: name,
                created: tags[name].created,
            });
        }
    }

    await sync(client, url);

    // const recipesToAdd = {}
    let i = 0;
    for (const title of Object.keys(recipes)) {
        if (!allRecipesByTitle[title]) {
            if (i++ % 20 == 0) {
                await sync(client, url);
            }
            // yay inefficient.
            Object.keys(tags).forEach((name) => {
                const tagId = tagsToAdd[name] ?? allTagsByName[name].id;
                if (!tagId) {
                    throw new Error('um no tag: ' + name);
                }
                if (tags[name].recipes.includes(title)) {
                    recipes[title].tags[tagId] = Date.now();
                }
            });
            // if (Object.keys(recipes[title].tags).length) {
            //     console.log(title, recipes[title].tags);
            // }
            const id = genId();
            recipes[title].id = id;
            await col.save(id, recipes[title]);
            // recipesToAdd[title] = id
        }
    }
    await sync(client, url);
    console.log('added', i);

    // Object.keys()

    // console.log(forsythRecipes.length);
};

main().then(
    () => console.log('done'),
    (err) => console.error(err),
);

// do I need a websocket module? Maybe just a node-fetch

// const { runMulti2, run } = require('../../packages/server-bundle/full.js');
// const { validateDelta } = require('../../packages/nested-object-crdt/src/schema.js');
// require('regenerator-runtime');
// const fs = require('fs');
// const dataPath = __dirname + '/.data/store';
// const port = process.env.PORT != null ? parseInt(process.env.PORT) : 9090;

// const treeNotesSchemas = require('../tree-notes/collections.js');
// const fooodSchemas = require('../foood/collections.js');
// const result = runMulti2(dataPath, { trees: treeNotesSchemas, foood: fooodSchemas }, port);

// console.log('listening on ' + port);
// result.app.get('/', (req, res) => {
//     res.send('ok');
//     res.end();
// });
// if (process.env.BACKUP_SECRET) {
//     const backupRoute = require('../../packages/server-backup');
//     result.app.get(
//         '/backup/' + process.env.BACKUP_SECRET,
//         backupRoute('.data/store', process.env.FIREBASE_APP),
//     );
// }
// if (process.env.BACKUP_DOWNLOAD) {
//     result.app.get('/backup/' + process.env.BACKUP_DOWNLOAD, downloadRoute('.data/store'));
// }
