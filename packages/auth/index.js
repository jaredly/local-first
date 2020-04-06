// @flow

import {
    createUser,
    validateSessionToken,
    loginUser,
    createUserSession,
    completeUserSession,
} from './db';

export { createTables } from './db';

type express = any;
type DB = any;

export const setupAuth = (
    db: DB,
    app: express,
    secret: string,
    prefix: string = '/api',
    paths: { [key: string]: string } = {},
) => {
    app.post(prefix + (paths.login || '/login'), (req, res) => {
        if (!req.body || !req.body.email || !req.body.password) {
            return res.status(400).send('username + password as JSON body required');
        }
        const user = loginUser(db, req.body.email, req.body.password);
        if (user == null) {
            res.status(404).send('User not found');
        } else if (user === false) {
            res.status(401).send('Incorrect password');
        } else {
            const token = createUserSession(db, secret, user.id, req.ip);
            res.cookie('token', token, {
                // secure: true,
                // 30 days
                maxAge: 30 * 24 * 3600 * 1000,
            });
            res.status(200).json(user);
        }
    });
    app.post(prefix + (paths.signup || '/signup'), (req, res) => {
        if (!req.body || !req.body.email || !req.body.password || !req.body.name) {
            return res.status(400).send('required fields: email, password, name');
        }
        const { email, password, name } = req.body;
        const userId = createUser(db, {
            password,
            info: { email, name, createdDate: Date.now() },
        });
        const token = createUserSession(db, secret, userId, req.ip);
        res.cookie('token', token, {
            // httpOnly: true,
            // 30 days
            maxAge: 30 * 24 * 3600 * 1000,
        });
        res.status(204);
    });
    const mid = middleware(db, secret);
    app.post(prefix + (paths.logout || '/logout'), mid, (req, res) => {
        completeUserSession(db, req.auth.sessionId);
        res.status(204);
    });
    app.post(prefix + (paths.chpwd || '/chpwd'), mid, (req, res) => {
        //
    });
    app.post(prefix + (paths.forgotpw || '/forgotpw'), mid, (req, res) => {
        //
    });
    app.post(prefix + (paths.invite || '/invite'), mid, (req, res) => {
        //
    });
    app.get(prefix + (paths.user || '/user'), mid, (req, res) => {
        res.status(200).json(req.auth.user);
    });
    // forgot pwd
    // will require a separate table. 'forgot-pw-tokens'
    // should I require email verification?
    // another table i'll want: 'invites'.
    // and allow you to require that someone have an invite key
    // in order to sign up.
    // hmm yeah I guess that does have bearing on this stuff.
    // And we'll want to be able to send "You've been invited" emails.
    // Ok, the gmail api looks like a reasonable way to do it?
    // Although I probably want to abstract it out, so you just
    // pass in a 'email this' function or something.
    // Like "sendEmail(address, data)" where data is
    // {type: 'verify'}
    // {type: 'invite', code: string}
    // {type: 'recover', code: string}
    // etc.
    // https://www.npmjs.com/package/juice might be useful
};

export const middleware = (db: DB, secret: string) => (req: *, res: *, next: *) => {
    if (req.query.token) {
        // TODO validateSessionToken should ... issue a new token?
        // if we're getting close to the end...
        // query param doesn't work super well for that.
        // cookies are simplest, for sure.
        // hm. Or a response header.
        // res.set('X-Session', token) could work.
        const auth = validateSessionToken(db, secret, req.query.token);
        if (auth == null) {
            res.status(401);
            return res.send('Invalid or expired token');
        }
        req.auth = auth;
        return next();
    }
    const authHeader = req.get('authorization');
    if (authHeader && authHeader.match(/^Bearer: /i)) {
        const token = authHeader.slice('Bearer: '.length);
        const auth = validateSessionToken(db, secret, token);
        if (auth == null) {
            res.status(401);
            return res.send('Invalid or expired token');
        }
        req.auth = auth;
        return next();
    }
    if (req.cookies && req.cookies.session) {
        const auth = validateSessionToken(db, secret, req.cookies.token);
        if (auth == null) {
            res.status(401);
            return res.send('Invalid or expired token');
        }
        req.auth = auth;
        return next();
    }
    res.status(401);
    return res.send('No token given (query param or header or cookie)');
};
