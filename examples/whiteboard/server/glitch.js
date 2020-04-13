const { run } = require('../../../packages/server-bundle/full.js');
const dataPath = '.data';
const port = process.env.PORT || 9090;
run(dataPath, port);
console.log('listening on ' + port);
