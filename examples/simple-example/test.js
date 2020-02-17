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

const parcelPort = 9223;
const serverPort = 9224;

const setupPage = async (browser, target, name, clearOut = true) => {
    console.log(chalk.underline.blue.bold('## New Page ##'), name);
    const pageA = await browser.newPage();
    pageA.name = name;
    pageA.on('console', async msg => {
        console.log(
            name,
            ...(await Promise.all(msg.args().map(h => h.jsonValue()))),
        );
    });
    await pageA.goto(target);
    await pageA.evaluate(
        async (port, clearOut) => {
            // Clear out current databases
            if (clearOut) {
                const r = await window.indexedDB.databases();
                for (var i = 0; i < r.length; i++) {
                    window.indexedDB.deleteDatabase(r[i].name);
                }
            }
            console.log('PORT', port);
            window.setupMulti(
                {
                    type: 'ws',
                    url: `ws://localhost:${port}/sync`,
                },
                {
                    fileblob: `http://localhost:${port}/blob/stuff`,
                    otherfileblob: `http://localhost:${port}/blob/other`,
                },
            );
            // window.setupBlob(port);
            // window.setupWebSockets(port);
            window.collection = window.client.getCollection('tasks');
            window.data = await window.collection.loadAll();
            console.log('initial cache', window.data);
            window.collection.onChanges(changes => {
                changes.forEach(({ value, id }) => {
                    if (value) {
                        window.data[id] = value;
                    } else {
                        delete window.data[id];
                    }
                });
            });
            // Wait for leader election to play out
            await new Promise(res => setTimeout(res, 500));
        },
        serverPort,
        clearOut,
    );
    return pageA;
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

// Setup bundler
const bundler = new Bundler([__dirname + '/test.html'], {});
bundler.serve(parcelPort);

const rmF = path => {
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
};

const setupServer = () => {
    const dataDir = __dirname + '/.test-data';
    rmF(dataDir + '/data.db');
    rmF(dataDir + '/blobs/stuff');
    rmF(dataDir + '/blobs/other');
    // Start serevr
    const server = makeServer(dataDir);
    const app = runServer(serverPort, dataDir, server);
    console.log('listening on ' + serverPort);
    return { app, server, dataDir };
};

const wait = (time = 100) => new Promise(res => setTimeout(res, time));

const contention = async () => {
    let { app, server } = setupServer();
    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('Page A'),
    );

    const pageB = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.green('Page B'),
        false,
    );

    const pageC = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.magenta('Page C'),
        false,
    );

    const itemA = {
        title: 'Item A',
        completed: false,
        createdDate: Date.now(),
        tags: {},
    };
    expect(await getData(pageA), {}, 'A 0');
    await addItem(pageA, 'a', itemA);
    await wait();
    expect(await getCachedData(pageA), { a: itemA }, 'A 1');
    expect(await getCachedData(pageB), { a: itemA }, 'B 1');
    expect(await getCachedData(pageC), { a: itemA }, 'C 1');

    // await wait(1000);
    await browser.close();
    app.http.close();
};

const full = async () => {
    let { app, server, dataDir } = setupServer();
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

    const itemC = {
        title: 'Item C',
        completed: true,
        createdDate: Date.now(),
        tags: {},
    };

    const itemD = {
        title: 'Item D',
        completed: true,
        createdDate: Date.now(),
        tags: {},
    };

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('Page A'),
    );

    expect(await getData(pageA), {}, 'A 0');
    await addItem(pageA, 'a', itemA);
    expect(await getData(pageA), { a: itemA }, 'A 1');

    // await wait(1500);
    // Different origin, so they won't share indexeddbs
    const pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('Page B'),
    );

    // This is a peer of pageA, and will *not* be the leader.
    const pageC = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.magenta('Page C'),
        false,
    );

    await wait(300);
    console.log('getting pagea data');
    expect(await getData(pageB), { a: itemA }, 'B 0');
    expect(await getCachedData(pageB), { a: itemA }, 'B 0');
    await addItem(pageB, 'b', itemB);
    await triggerSync(pageB);
    await wait();
    await triggerSync(pageA);
    await wait();
    expect(await getData(pageA), { a: itemA, b: itemB }, 'A 2');
    expect(await getData(pageB), { a: itemA, b: itemB }, 'B 2');

    // Disconnect!
    console.log('Disconnect');
    app.http.close();
    app.wsInst.getWss().clients.forEach(client => {
        client.close();
    });

    await addItem(pageA, 'c', itemC);
    expect(await getData(pageA), { a: itemA, b: itemB, c: itemC }, 'A 3');
    expect(await getData(pageB), { a: itemA, b: itemB }, 'B 3');

    app = runServer(serverPort, dataDir, server);
    console.log('please reconnect');
    await wait(1000);

    expect(await getData(pageA), { a: itemA, b: itemB, c: itemC }, 'A 4');
    await triggerSync(pageA);
    await wait();
    expect(
        await getCachedData(pageA),
        { a: itemA, b: itemB, c: itemC },
        'A 4 cached',
    );
    await triggerSync(pageB);
    await wait();
    expect(await getData(pageB), { a: itemA, b: itemB, c: itemC }, 'B 4');
    expect(
        await getCachedData(pageB),
        { a: itemA, b: itemB, c: itemC },
        'B 4 cached',
    );
    await triggerSync(pageC);
    await wait();
    console.log('checking');
    expect(
        await getCachedData(pageC),
        { a: itemA, b: itemB, c: itemC },
        'C 4 cached',
    );

    await addItem(pageC, 'd', itemD);
    await wait();
    await triggerSync(pageB);
    await wait();
    expect(
        await getCachedData(pageA),
        { a: itemA, b: itemB, c: itemC, d: itemD },
        'A 5 cached',
    );
    expect(
        await getCachedData(pageB),
        { a: itemA, b: itemB, c: itemC, d: itemD },
        'B 5 cached',
    );
    expect(
        await getCachedData(pageC),
        { a: itemA, b: itemB, c: itemC, d: itemD },
        'C 5 cached',
    );

    console.log(chalk.bold.green('All clear!'));

    await browser.close();
    app.http.close();
};

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

const compaction = async () => {
    let { app, server } = setupServer();

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('Page A'),
    );

    // Different origin, so they won't share indexeddbs
    let pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('Page B'),
    );

    const data = {};

    const id1 = genId();
    data[id1] = createItem();

    expect(await getData(pageA), {}, 'A 0');
    await addItem(pageA, id1, data[id1]);
    expect(await getData(pageA), data, 'A 1');

    const id2 = genId();
    data[id2] = createItem();

    await pageB.close();

    await addItem(pageA, id2, data[id2]);
    await wait(50);

    for (let i = 0; i < 100; i++) {
        const title = 'Title ' + genId();
        data[id2].title = title;
        await setAttribute(pageA, id2, 'title', title);
        await wait(50);
    }

    console.log('getting pagea data');
    expect(await getData(pageA), data, 'A 2');
    server.persistence.compact('tasks', Date.now(), clientLib.mergeDeltas);

    // Different origin, so they won't share indexeddbs
    pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('Page B'),
        false,
    );

    await wait(500);
    expect(await getData(pageB), data, 'B 2');
};

const run = async () => {
    console.log(chalk.red.bold.underline.bgWhite('  Full  '));
    await full();
    console.log(chalk.red.bold.underline.bgWhite('  Contention  '));
    await contention();
    console.log(chalk.red.bold.underline.bgWhite('  Compaction  '));
    await compaction();
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
