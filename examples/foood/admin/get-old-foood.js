var admin = require('firebase-admin');

var serviceAccount = require('./foood-admin.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://foood-465a5.firebaseio.com',
});

const getList = (m) => {
    const res = [];
    m.forEach((m) => res.push(m.data()));
    return res;
};

const run = async () => {
    const db = admin.firestore();

    const collections = ['ingredients', 'lists', 'madeIts', 'recipes'];
    for (const collection of collections) {
        console.log(collection);
        const data = await db.collection(collection).get();
        fs.writeFileSync(`./${collection}.json`, JSON.stringify(getList(data), null, 2));
    }

    // await citiesRef.doc('SF').set({
    //     name: 'San Francisco',
    //     state: 'CA',
    //     country: 'USA',
    //     capital: false,
    //     population: 860000,
    // });
    // await citiesRef.doc('LA').set({
    //     name: 'Los Angeles',
    //     state: 'CA',
    //     country: 'USA',
    //     capital: false,
    //     population: 3900000,
    // });
    // await citiesRef.doc('DC').set({
    //     name: 'Washington, D.C.',
    //     state: null,
    //     country: 'USA',
    //     capital: true,
    //     population: 680000,
    // });
    // await citiesRef.doc('TOK').set({
    //     name: 'Tokyo',
    //     state: null,
    //     country: 'Japan',
    //     capital: true,
    //     population: 9000000,
    // });
    // await citiesRef.doc('BJ').set({
    //     name: 'Beijing',
    //     state: null,
    //     country: 'China',
    //     capital: true,
    //     population: 21500000,
    // });
};

run();
