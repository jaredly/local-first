#!/usr/bin/env
// @flow
require('@babel/register');
const puppeteer = require('puppeteer');
const Bundler = require('parcel');
const { runServer, makeServer } = require('./server/index.js');
const serverLib = require('./fault-tolerant/server');
const clientLib = require('@local-first/nested-object-crdt');
const chalk = require('chalk');
const deepEqual = require('fast-deep-equal');
const fs = require('fs');
const path = require('path');

const wait = (time = 100) => new Promise(res => setTimeout(res, time));

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

const createItem = () => {
    return {
        title: genId(),
        completed: false,
        createdDate: Date.now(),
        tags: {},
    };
};

const registerConsole = page => {
    page.on('console', async msg => {
        console.log(
            page.name,
            ...(await Promise.all(msg.args().map(h => h.jsonValue()))),
        );
    });
};

const setupPage = async (
    browser,
    target,
    name,
    deltaConfig,
    blobConfig,
    clearOut = true,
) => {
    console.log(chalk.underline.blue.bold('## New Page ##'), name);
    const page = await browser.newPage();
    page.name = name;
    registerConsole(page);
    await page.goto(target);
    await page.evaluate(
        async (deltaConfig, blobConfig, clearOut) => {
            if (clearOut) {
                await window.clearData();
            }
            window.setupMulti(deltaConfig, blobConfig);
            await window.setupLocalCache('tasks');
            // Wait for leader election to play out
            // await new Promise(res => setTimeout(res, 500));
        },
        deltaConfig,
        blobConfig,
        clearOut,
    );
    return page;
};

const getData = page => page.evaluate(() => window.collection.loadAll());
const triggerSync = page => page.evaluate(() => window.client.setDirty());
const getCachedData = page => page.evaluate(() => window.data);
const addItem = (page, id, item) => {
    console.log(chalk.bold.magenta('++'), 'adding item', id, page.name);
    return page.evaluate(
        (id, item) => window.collection.save(id, item),
        id,
        item,
    );
};
const setAttribute = (page, id, key, value) => {
    return page.evaluate(
        (id, key, value) => window.collection.setAttribute(id, [key], value),
        id,
        key,
        value,
    );
};

const expect = (a, b, message) => {
    if (!deepEqual(a, b)) {
        console.error(chalk.red.underline('Unequal!'), message);
        console.log(chalk.red('received -'), JSON.stringify(a));
        console.log(chalk.green('expected +'), JSON.stringify(b));
        throw new Error('Not equal: ' + message);
    } else {
        console.log(chalk.green('✅ Checks out'), message);
    }
};

const parcelPort = 11113;
// const serverPort = 9224;

// Setup bundler
const bundler = new Bundler([__dirname + '/test.html'], {});
bundler.serve(parcelPort);

const rmF = path => {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
};

const setupServer = serverPort => {
    const dataDir = __dirname + '/.test-data';
    rmF(dataDir + '/data.db');
    rmF(dataDir + '/blobs/backup');
    rmF(dataDir + '/blobs/second');
    // Start serevr
    const server = makeServer(dataDir);
    const app = runServer(serverPort, dataDir, server);
    console.log('listening on ' + serverPort);
    return { app, server, dataDir };
};

const itemA = {
    title: 'Item A',
    completed: false,
    createdDate: Date.now(),
    tags: {},
};

const itemB = {
    title: 'Item B',
    completed: true,
    createdDate: Date.now(),
    tags: {},
};

/**
 * This is about adding a delta server after you've already been
 * talking to a blob server.
 *
 * So [A] is connected w/ deltas
 * And then [B] is connected w/ blob
 * both A and B add the same item, and make changes,
 * such that it would merge.
 *
 * Then [B] closes & re-opens with both blob and delta.
 *
 * After syncing, [A] and [B] should both have the merged
 * item.
 */

const lateBind = async () => {
    const serverPort = 11111;
    const { app, server, dataDir } = setupServer(serverPort);

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('A'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        {},
        true,
    );

    let pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('B'),
        null,
        { file: `http://localhost:${serverPort}/blob/backup` },
        true,
    );

    const mergedItem = { ...itemA };

    await addItem(pageA, 'a', itemA);
    await addItem(pageB, 'a', itemA);
    const newTitle = 'A title from page A';
    await setAttribute(pageA, 'a', 'title', newTitle);
    await setAttribute(pageB, 'a', 'completed', true);

    expect(await getData(pageA), { a: { ...itemA, title: newTitle } }, 'A 0');
    expect(await getData(pageB), { a: { ...itemA, completed: true } }, 'B 0');

    mergedItem.title = newTitle;
    mergedItem.completed = true;
    await wait();

    await pageB.close();

    pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('B'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        { file: `http://localhost:${serverPort}/blob/backup` },
        false,
    );
    expect(await getData(pageB), { a: { ...itemA, completed: true } }, 'B 0a');

    await triggerSync(pageB);
    await wait(500);
    expect(await getData(pageA), { a: mergedItem }, 'A 1');
    expect(await getData(pageB), { a: mergedItem }, 'B 1');

    await browser.close();
    app.http.close();
};

const lateBindBlob = async () => {
    const serverPort = 11111;
    const { app, server, dataDir } = setupServer(serverPort);

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('A'),
        null,
        { file: `http://localhost:${serverPort}/blob/backup` },
        true,
    );

    let pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('B'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        {},
        true,
    );

    const mergedItem = { ...itemA };

    await addItem(pageA, 'a', itemA);
    await addItem(pageB, 'a', itemA);
    const newTitle = 'A title from page A';
    await setAttribute(pageA, 'a', 'title', newTitle);
    await setAttribute(pageB, 'a', 'completed', true);

    expect(await getData(pageA), { a: { ...itemA, title: newTitle } }, 'A 0');
    expect(await getData(pageB), { a: { ...itemA, completed: true } }, 'B 0');

    await triggerSync(pageA);
    await wait();
    await triggerSync(pageB);

    mergedItem.title = newTitle;
    mergedItem.completed = true;
    await wait();

    await pageB.close();

    pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('B'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        { file: `http://localhost:${serverPort}/blob/backup` },
        false,
    );
    expect(await getData(pageB), { a: { ...itemA, completed: true } }, 'B 0a');

    await triggerSync(pageB);
    await wait(500);
    await triggerSync(pageA);
    await wait();
    expect(await getData(pageA), { a: mergedItem }, 'A 1');
    expect(await getData(pageB), { a: mergedItem }, 'B 1');

    await browser.close();
    app.http.close();
};

const deltaAndBlob = async () => {
    const serverPort = 11111;
    const { app, server, dataDir } = setupServer(serverPort);

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('A'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        {},
        true,
    );

    const pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.blue('B'),
        { type: 'ws', url: `ws://localhost:${serverPort}/sync` },
        { file: `http://localhost:${serverPort}/blob/backup` },
        true,
    );

    const pageC = await setupPage(
        browser,
        `http://[::1]:${parcelPort}/`,
        chalk.green('C'),
        null,
        { file: `http://localhost:${serverPort}/blob/backup` },
        true,
    );

    expect(await getData(pageA), {}, 'A 0');
    expect(await getData(pageB), {}, 'B 0');
    expect(await getData(pageC), {}, 'C 0');
    await addItem(pageA, 'a', itemA);
    await wait();
    await triggerSync(pageC);
    await wait();
    expect(await getData(pageA), { a: itemA }, 'A 1');
    expect(await getData(pageB), { a: itemA }, 'B 1');
    expect(await getData(pageC), { a: itemA }, 'C 1');

    // Now in the other direction!!
    await addItem(pageC, 'b', itemB);
    await triggerSync(pageC);
    await wait();
    await triggerSync(pageB);
    await wait();

    expect(await getData(pageA), { a: itemA, b: itemB }, 'A 2');
    expect(await getData(pageB), { a: itemA, b: itemB }, 'B 2');
    expect(await getData(pageC), { a: itemA, b: itemB }, 'C 2');

    await browser.close();
    app.http.close();
};

const twoBlobs = async () => {
    const serverPort = 11111;
    const { app, server, dataDir } = setupServer(serverPort);

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('A'),
        null,
        { file: `http://localhost:${serverPort}/blob/backup` },
        true,
    );

    const pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.blue('B'),
        null,
        {
            backup: `http://localhost:${serverPort}/blob/backup`,
            second: `http://localhost:${serverPort}/blob/second`,
        },
        true,
    );

    const pageC = await setupPage(
        browser,
        `http://[::1]:${parcelPort}/`,
        chalk.green('C'),
        null,
        { second: `http://localhost:${serverPort}/blob/second` },
        true,
    );

    expect(await getData(pageA), {}, 'A 0');
    expect(await getData(pageB), {}, 'B 0');
    expect(await getData(pageC), {}, 'C 0');
    await addItem(pageA, 'a', itemA);
    await triggerSync(pageA);
    await wait();
    await triggerSync(pageB);
    await wait();
    await triggerSync(pageC);
    await wait();
    expect(await getData(pageA), { a: itemA }, 'A 1');
    expect(await getData(pageB), { a: itemA }, 'B 1');
    expect(await getData(pageC), { a: itemA }, 'C 1');

    // const context = browser.createIncognitoBrowserContext();

    await browser.close();
    app.http.close();
};

const run = async () => {
    console.log(chalk.red.bold.underline.bgWhite('  Late bind  '));
    // await lateBind();
    await lateBindBlob();
    // console.log(chalk.red.bold.underline.bgWhite('  Delta & Blob  '));
    // await deltaAndBlob();
    // console.log(chalk.red.bold.underline.bgWhite('  Two Blobs  '));
    // await twoBlobs();
};

run()
    .catch(err => {
        console.log('Toplevel error');
        console.error(err);
        process.exit(1);
    })
    .then(() => {
        console.log('Good!');
        process.exit(0);
    });
