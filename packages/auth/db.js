// @flow

const bcrypt = require('bcryptjs');

export const ADMIN_ROLE = 9;

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
    CREATE TABLE IF NOT EXISTS users (
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
    name: string,
    email: string,
    createdDate: number,
};

export type UserInput = { info: UserInfo, password: string };
export type User = { info: UserInfo, passwordHash: string };

export const createUser = (
    db: DB,
    { info: { name, email, createdDate }, password }: UserInput,
) => {
    const passwordHash = bcrypt.hashSync(password);
    const stmt = db.prepare(`INSERT INTO users
    (name, email, passwordHash, createDate)
    VALUES (@name, @email, @passwordHash, @createdDate)`);
    const info = stmt.run({ name, email, createdDate, passwordHash });
    if (info.changes !== 1) {
        throw new Error(
            `Unexpected sqlite response: ${info.changes} should be '1'`,
        );
    }
    return info.lastInsertRowId;
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
                name: result.name,
                email: result.email,
                createdDate: result.createdDate,
            },
        };
    } else {
        return false;
    }
};

export const createUserSession = (
    db: DB,
    secret: string,
    userId: number,
    ipAddress: string,
) => {
    const stmt = db.prepare(`INSERT INTO sessions
    (userId, createdDate, ipAddress, expirationDate)
    VALUES (@userId, @createdDate, @ipAddress, @expirationDate)`);
    const info = stmt.run({
        userId,
        ipAddress,
        createdDate: Date.now(),
        // valid for a year
        expirationDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    });
    if (info.changes !== 1) {
        throw new Error(
            `Unexpected sqlite response: ${info.changes} should be '1'`,
        );
    }
    const sessionId = info.lastInsertRowId;
    const token = jwt.sign(sessionId, secret, { expiresIn: '30d' });
    return token;
};

export const completeUserSession = (db: DB, sessionId: number) => {
    const stmt = db.prepare(`UPDATE sessions
    SET logoutDate = @logoutDate
    WHERE rowid = @id`);
    const info = stmt.run({ logoutDate: Date.now(), id: sessionId });
    if (info.changes !== 1) {
        throw new Error(
            `Unexpected sqlite response: ${info.changes} should be '1'`,
        );
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
        sessionId = jwt.verify(token, secret);
    } catch (err) {
        return null;
    }
    const stmt = db.prepare(`SELECT * FROM sessions WHERE id = @id`);
    const session = stmt.get(sessionId);
    if (!session) {
        return null;
    }
    if (session.logoutDate != null) {
        return null; // session has been logged-out
    }
    if (session.expirationDate <= Date.now()) {
        return null; // it has expired
    }
    const info = db.prepare('SELECT * from users WHERE id = @id');
    const user = info.get({ id: session.userId });
    if (!user) {
        return null;
    }
    return {
        id: session.userId,
        user: {
            name: user.name,
            email: user.email,
            createdDate: user.createdDate,
        },
        sessionId,
    };
};
