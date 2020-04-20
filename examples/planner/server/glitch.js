const { run } = require('../../../packages/server-bundle/full.js');
const dataPath = '.data';
const port = process.env.PORT || 9090;
const { getSchema } = require('./getSchema');
const result = run(dataPath, getSchema, port);
console.log('listening on ' + port);
