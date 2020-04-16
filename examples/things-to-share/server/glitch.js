const { run } = require('../../../packages/server-bundle/full.js');
const { addProxy } = require('./');
const dataPath = '.data';
const port = process.env.PORT || 9090;
const result = run(dataPath, port);
addProxy(result.app);
console.log('listening on ' + port);
