#!/usr/bin/env node
// A simple tool for calculating the "actual size of data stored" in an sqlite database (for benchmarks).
const sqlite = require('better-sqlite3');
if (process.argv.length < 3) {
    console.log('Usage: measure.js input.db');
}
const db = sqlite(process.argv[2]);

function queryAll(db, sql, params = []) {
    let stmt = db.prepare(sql);
    // console.log('query all', sql, params);
    return stmt.all(...params);
}

const tables = queryAll(db, 'select name from sqlite_master');
const data = {};
tables.forEach(name => {
    data[name.name] = queryAll(
        db,
        'select * from ' + JSON.stringify(name.name),
    );
});
console.log(JSON.stringify(data).length / 1000, 'kb');
