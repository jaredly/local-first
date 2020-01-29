#!/usr/bin/env
// @flow
require('@babel/register');
const puppeteer = require('puppeteer');
const Bundler = require('parcel');
const { runServer, makeServer } = require('./server/index.js');
const serverLib = require('./fault-tolerant/server');
const chalk = require('chalk');
const deepEqual = require('fast-deep-equal');
const fs = require('fs');

const parcelPort = 9223;
const serverPort = 9224;

const setupPage = async (browser, target, name) => {
    const pageA = await browser.newPage();
    pageA.on('console', msg => {
        console.log(name, msg.text());
    });
    await pageA.goto(target);
    await pageA.evaluate(async port => {
        // Clear out current databases
        const r = await window.indexedDB.databases();
        for (var i = 0; i < r.length; i++) {
            window.indexedDB.deleteDatabase(r[i].name);
        }
        window.setupWebSockets(port);
        window.collection = window.clientLib.getCollection(
            window.client,
            'tasks',
            window.ItemSchema,
        );
    }, serverPort);
    return pageA;
};

const getData = page => page.evaluate(() => window.collection.loadAll());
const addItem = (page, id, item) => {
    console.log(chalk.bold.magenta('++'), 'adding item', id);
    return page.evaluate(
        (id, item) => window.collection.save(id, item),
        id,
        item,
    );
};

const expect = (a, b, message) => {
    if (!deepEqual(a, b)) {
        console.error(chalk.red.underline('Unequal!'), message);
        console.log(chalk.red('received -'), JSON.stringify(a));
        console.log(chalk.green('expected +'), JSON.stringify(b));
        throw new Error('Not equal: ' + message);
    } else {
        console.log(chalk.green('✅ Checks out'));
    }
};

// Setup bundler
const bundler = new Bundler([__dirname + '/test.html'], {});
bundler.serve(parcelPort);

const dataDir = __dirname + '/.test-data';
const dbPath = dataDir + '/data.db';
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
}
// Start serevr
const server = makeServer(dataDir);
let app = runServer(serverPort, server);
console.log('listening on ' + serverPort);

const wait = (time = 100) => new Promise(res => setTimeout(res, time));

const run = async () => {
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

    const browser = await puppeteer.launch();

    const pageA = await setupPage(
        browser,
        `http://localhost:${parcelPort}/`,
        chalk.red('Page A'),
    );
    expect(await getData(pageA), {}, 'A 0');
    await addItem(pageA, 'a', itemA);
    expect(await getData(pageA), { a: itemA }, 'A 1');

    // Different origin, so they won't share indexeddbs
    const pageB = await setupPage(
        browser,
        `http://127.0.0.1:${parcelPort}/`,
        chalk.green('Page B'),
    );
    await wait();
    expect(await getData(pageB), { a: itemA }, 'B 0');
    await addItem(pageB, 'b', itemB);
    await wait();
    expect(await getData(pageA), { a: itemA, b: itemB }, 'A 2');
    expect(await getData(pageB), { a: itemA, b: itemB }, 'B 2');

    // Disconnect!
    console.log('Disconnect');
    app.http.close();
    app.wsInst.getWss().clients.forEach(client => {
        console.log('closing', Object.keys(client));
        client.close();
    });

    await addItem(pageA, 'c', itemC);
    expect(await getData(pageA), { a: itemA, b: itemB, c: itemC }, 'A 3');
    expect(await getData(pageB), { a: itemA, b: itemB }, 'B 3');

    app = runServer(serverPort, server);
    console.log('please reconnect');
    await wait(500);

    expect(await getData(pageA), { a: itemA, b: itemB, c: itemC }, 'A 4');
    expect(await getData(pageB), { a: itemA, b: itemB, c: itemC }, 'B 4');

    console.log(chalk.bold.green('All clear!'));

    await browser.close();
    process.exit(1);
};

run().catch(err => {
    console.error(err);
    process.exit(1);
});
