const { run } = require('../../../packages/server-bundle/full.js');
const { addProxy } = require('./');
const dataPath = '.data';
const port = process.env.PORT || 9090;
const { getSchemaChecker } = require('./getSchema');
const result = run(dataPath, getSchemaChecker, port);
addProxy(result.app);
console.log('listening on ' + port);
