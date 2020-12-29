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
import type { RecipeT, TagT, IngredientT } from '../collections';
import importFooodData from './import-from-foood';

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

const importForsythRecipesData = async (client, userId, sync) => {
    const col = client.getCollection<RecipeT>('recipes');
    const tagsCol = client.getCollection<TagT>('tags');
    const ingredientsCol = client.getCollection<IngredientT>('ingredients');

    const allRecipes: { [key: string]: RecipeT } = await col.loadAll();
    const allTags = await tagsCol.loadAll();

    // fs.writeFileSync('./recipes.json', JSON.stringify(allRecipes, null, 2), 'utf8');
    // fs.writeFileSync('./tags.json', JSON.stringify(allTags, null, 2), 'utf8');

    const allTagsByName = {};
    Object.keys(allTags).forEach((id) => (allTagsByName[allTags[id].text] = allTags[id]));
    const allRecipesByTitle = {};
    Object.keys(allRecipes).forEach(
        (id) => (allRecipesByTitle[allRecipes[id].about.title] = allRecipes[id]),
    );

    const { recipes, tags } = await getForsythRecipes(await ingredientsCol.loadAll());

    const tagsToAdd = {};
    for (const name of Object.keys(tags)) {
        if (!allTagsByName[name]) {
            const id = genId();
            tagsToAdd[name] = id;
            await tagsCol.save(id, {
                id,
                text: name,
                created: tags[name].created,
                color: null,
                authorId: ':forsythrecipes-import',
            });
        }
    }

    await sync();

    // STOPSHIP: switch back to random id
    const deterministicIDs = true;

    let titleIndex = 0;
    let i = 0;
    for (const title of Object.keys(recipes)) {
        titleIndex += 1;
        if (!allRecipesByTitle[title] || deterministicIDs) {
            if (i++ % 20 == 0) {
                await sync();
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
            const id = deterministicIDs ? titleIndex.toString().padStart(10, '0') : genId();
            recipes[title].id = id;
            const current = allRecipes[id];
            if (current != null) {
                // If the recipe already exists, just set the title & source
                await col.setAttribute(id, ['contents'], recipes[title].contents);
                await col.setAttribute(id, ['about', 'source'], recipes[title].about.source);
            } else {
                await col.save(id, recipes[title]);
            }
            // recipesToAdd[title] = id
        }
    }
    await sync();
    console.log('added', i);
};

const main = async () => {
    const authUrl = `${baseUrl}/auth/login`;
    const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : await login();
    if (token == null || token === '') {
        console.log('Authentication failed.');
        return;
    }
    const url = `${baseUrl}/dbs/sync?db=foood/public&token=${token}`;

    const persistence = makeDeltaInMemoryPersistence(Object.keys(schemas));
    const clock = new PersistentClock(inMemoryClockPersist());
    const client = createManualDeltaClient(clientCrdtImpl, schemas, clock, persistence);

    await sync(client, url);

    // NOTE: FOOOD importing is disabled because I've finished it. When I do my fresh start, I'll want to re-enable.
    // Will I do a fresh start? idk. Maybe I'll "export current as json" and then fresh start.
    const userId = '1';
    await importFooodData(client, userId, () => sync(client, url));

    // await importForsythRecipesData(client, userId, () => sync(client, url));

    // const fooodStuffs = getFooodStuffs()
    // lists
    // madeIts (comments)
    // recipes

    // Object.keys()

    // console.log(forsythRecipes.length);
};

main().then(
    () => console.log('done'),
    (err) => console.error(err),
);
