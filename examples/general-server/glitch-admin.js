// @flow

const { getAuthDb } = require('../../packages/server-bundle/full');
const { setupPersistence } = require('../../packages/server-bundle/sqlite-persistence');
const dataPath = '.data/store';

const {
    createUser,
    fulfillInvite,
    validateSessionToken,
    loginUser,
    createUserSession,
    completeUserSession,
    checkUserExists,
    listUsers,
    listInvites,
    setUserRole,
    createInvite,
} = require('../../packages/auth/db');

const [_, __, cmd, ...args] = process.argv;
if (cmd === 'ls-users') {
    console.log(listUsers(getAuthDb(dataPath)));
} else if (cmd === 'ls-invites') {
    console.log(listInvites(getAuthDb(dataPath)));
} else if (cmd === 'mod-role') {
    const [userEmail, newRole] = args;
    if (isNaN(+newRole)) {
        console.error('Invalid args. Expected a string and a number.');
        process.exit(1);
    }
    if (!setUserRole(getAuthDb(dataPath), userEmail, +newRole)) {
        console.log(`User with email ${userEmail} not found`);
    } else {
        console.log(`User successfully updated.`);
    }
} else if (cmd === 'create-invite') {
    const id = createInvite(getAuthDb(dataPath), Date.now());
    console.log(`New invite created! https://foood2.surge.sh/?invite=${id}`);
} else if (cmd === 'compact') {
    const db = args[0];
    if (!fs.existsSync(db)) {
        console.error(`No database at ${db}`);
        process.exit(1);
    }
    console.warn('This will modify your database! I hope you made a backup.');
    const persistence = setupPersistence(db);
    const collection = args[1];
}
