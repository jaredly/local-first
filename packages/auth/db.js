// @flow

const bcrypt = require('bcryptjs');

export const ADMIN_ROLE = 9;

const createInvitesTableQuery = `
    CREATE TABLE IF NOT EXISTS invites (
        id integer PRIMARY KEY,
        stringId text UNIQUE NOT NULL,
        createdDate integer NOT NULL,
        creatorId integer NOT NULL,
        -- the date it was fulfilled
        fulfilledDate integer
    )
`;

const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
    id integer PRIMARY KEY,
    name text NOT NULL,
    email text UNIQUE NOT NULL,
    createdDate integer NOT NULL,
    passwordHash text NOT NULL,
    invitedBy INTEGER,
    -- 0 or NULL for no privileges, 9 for admin
    role INTEGER
    )
`;

const createSessionsTableQuery = `
    CREATE TABLE IF NOT EXISTS sessions (
    id integer PRIMARY KEY,
    userId integer NOT NULL,
    createdDate integer NOT NULL,
    ipAddress TEXT NOT NULL,
    expirationDate integer NOT NULL,
    -- the date you logged out
    logoutDate integer
    )
`;

const run = (db, query, args = []) => {
    db.prepare(query).run(...args);
};

type DB = any;

export const createTables = (db: DB) => {
    run(db, createUsersTableQuery);
    run(db, createSessionsTableQuery);
    run(db, createInvitesTableQuery);
    try {
        run(db, `ALTER TABLE invites ADD COLUMN creatorId integer NOT NULL DEFAULT 1`);
    } catch {
        // ignore
    }
};

// export const findUserByEmail = (db: DB, email: string) => {
//     const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
//     const result = stmt.get(email);
//     if (!result) return null;
//     const { name, createdDate, passwordHash } = result;
//     return {
//         info: { name, email, createdDate },
//         passwordHash,
//     };
// };

export type UserInfo = {
    id: string,
    name: string,
    email: string,
    createdDate: number,
};

export type UserInput = {
    info: {
        name: string,
        email: string,
        createdDate: number,
    },
    password: string,
};
export type User = { info: UserInfo, passwordHash: string };

export const listUsers = (db: DB) => {
    const results = db.prepare(`SELECT * from users`);
    return results.all();
};

export const listInvites = (db: DB) => {
    const results = db.prepare(`SELECT * from invites`);
    return results.all();
};

export const setUserRole = (db: DB, email: string, role: number) => {
    const stmt = db.prepare(`UPDATE users
    SET role = @role
    WHERE email = @email`);
    const info = stmt.run({ email, role });
    if (info.changes !== 1) {
        return false;
    }
    return true;
};

export const createUser = (db: DB, { info: { name, email, createdDate }, password }: UserInput) => {
    const passwordHash = bcrypt.hashSync(password);
    const stmt = db.prepare(`INSERT INTO users
    (name, email, passwordHash, createdDate)
    VALUES (@name, @email, @passwordHash, @createdDate)`);
    const info = stmt.run({ name, email, createdDate, passwordHash });
    if (info.changes !== 1) {
        throw new Error(`Unexpected sqlite response: ${info.changes} should be '1'`);
    }
    return info.lastInsertRowid;
};

const genId = () =>
    Math.random()
        .toString(36)
        .slice(2);

export const createInvite = (db: DB, createdDate: number) => {
    const stringId = genId() + genId();
    const stmt = db.prepare(`INSERT INTO invites
    (stringId, createdDate)
    VALUES (@stringId, @createdDate)`);
    const info = stmt.run({ stringId, createdDate });
    if (info.changes !== 1) {
        throw new Error(`Unexpected sqlite response: ${info.changes} should be '1'`);
    }
    return stringId;
};

export const fulfillInvite = (db: DB, stringId: string) => {
    const stmt = db.prepare(`UPDATE invites
    SET fulfilledDate = @fulfilledDate
    WHERE stringId = @stringId and fulfilledDate is null`);
    const info = stmt.run({ fulfilledDate: Date.now(), stringId });
    if (info.changes !== 1) {
        const stmt = db.prepare(`SELECT * FROM invites WHERE stringId = @stringId`);
        const info = stmt.get({ fulfilledDate: Date.now(), stringId });
        if (info) {
            return false;
        }

        return null;
    }
    return true;
};

export const checkUserExists = (db: DB, email: string) => {
    const stmt = db.prepare(`SELECT id FROM users WHERE email = ?`);
    const result = stmt.get(email);
    return result ? true : false;
};

export const loginUser = (
    db: DB,
    email: string,
    password: string,
): ?{ id: number, info: UserInfo } | false => {
    const stmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
    const result = stmt.get(email);
    if (!result) return null;
    if (bcrypt.compareSync(password, result.passwordHash)) {
        return {
            id: result.id,
            info: {
                id: result.id,
                name: result.name,
                email: result.email,
                createdDate: result.createdDate,
                role: result.role,
            },
        };
    } else {
        return false;
    }
};

export const createUserSession = (db: DB, secret: string, userId: number, ipAddress: string) => {
    const expirationDate = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const stmt = db.prepare(`INSERT INTO sessions
    (userId, createdDate, ipAddress, expirationDate)
    VALUES (@userId, @createdDate, @ipAddress, @expirationDate)`);
    const info = stmt.run({
        userId,
        ipAddress,
        createdDate: Date.now(),
        // valid for a year
        expirationDate,
    });
    if (info.changes !== 1) {
        throw new Error(`Unexpected sqlite response: ${info.changes} should be '1'`);
    }
    const sessionId = info.lastInsertRowid;
    console.log('sessionId', sessionId, info);
    const token = jwt.sign(
        {
            data: sessionId + '',
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        },
        secret,
    );
    return token;
};

export const completeUserSession = (db: DB, sessionId: number) => {
    const stmt = db.prepare(`UPDATE sessions
    SET logoutDate = @logoutDate
    WHERE rowid = @id`);
    const info = stmt.run({ logoutDate: Date.now(), id: sessionId });
    if (info.changes !== 1) {
        throw new Error(`Unexpected sqlite response: ${info.changes} should be '1'`);
    }
};

export const completeAllSessionsForUser = (db: DB, userId: number) => {
    const stmt = db.prepare(`UPDATE sessions
    SET logoutDate = @logoutDate
    WHERE userId = @userId AND logoutDate = NULL`);
    const info = stmt.run({ logoutDate: Date.now(), userId });
    return info.changes;
};

const jwt = require('jsonwebtoken');

// returns a userId if the token & session are valid
export const validateSessionToken = (
    db: DB,
    secret: string,
    token: string,
): ?{ user: UserInfo, sessionId: number } => {
    let sessionId = null;
    try {
        sessionId = jwt.verify(token, secret).data;
    } catch (err) {
        console.log('Failed to verify jwt:', err);
        return null;
    }
    const stmt = db.prepare(`SELECT * FROM sessions WHERE id = @id`);
    const session = stmt.get({ id: sessionId });
    if (!session) {
        console.log('no matching session for', sessionId);
        return null;
    }
    if (session.logoutDate != null) {
        console.log('session has been logged-out');
        return null; // session has been logged-out
    }
    if (session.expirationDate <= Date.now()) {
        console.log('session has expired');
        return null; // it has expired
    }
    const info = db.prepare('SELECT * from users WHERE id = @id');
    const user = info.get({ id: session.userId });
    if (!user) {
        console.log('associated user does not exist');
        return null;
    }
    return {
        id: session.userId,
        user: {
            id: session.userId,
            name: user.name,
            email: user.email,
            createdDate: user.createdDate,
        },
        sessionId,
    };
};
