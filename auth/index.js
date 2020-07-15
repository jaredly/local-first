"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "createTables", {
  enumerable: true,
  get: function get() {
    return _db.createTables;
  }
});
exports.middleware = exports.setupAuth = void 0;

var _db = require("./db.js");

var setupAuth = function setupAuth(db, app, secret) {
  var prefix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '/api';
  var paths = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
  app.get(prefix + (paths.checkUsername || '/check-login'), function (req, res) {
    if (!req.query.email) {
      return res.status(400).send('email as url param required');
    }

    if ((0, _db.checkUserExists)(db, req.query.email)) {
      return res.status(204).end();
    } else {
      return res.status(404).end();
    }
  });
  app.post(prefix + (paths.login || '/login'), function (req, res) {
    if (!req.body || !req.body.email || !req.body.password) {
      return res.status(400).send('username + password as JSON body required');
    }

    var user = (0, _db.loginUser)(db, req.body.email, req.body.password);

    if (user == null) {
      res.status(404).send('User not found');
    } else if (user === false) {
      res.status(401).send('Incorrect password');
    } else {
      var token = (0, _db.createUserSession)(db, secret, user.id, req.ip);
      res.cookie('token', token, {
        // secure: true,
        // 30 days
        maxAge: 30 * 24 * 3600 * 1000
      });
      res.set('X-Session', token);
      res.status(200).json(user.info);
    }
  });
  app.post(prefix + (paths.signup || '/signup'), function (req, res) {
    if (!req.body || !req.body.email || !req.body.password || !req.body.name) {
      return res.status(400).send('required fields: email, password, name');
    }

    var _req$body = req.body,
        email = _req$body.email,
        password = _req$body.password,
        name = _req$body.name;
    var createdDate = Date.now();
    var userId = (0, _db.createUser)(db, {
      password: password,
      info: {
        email: email,
        name: name,
        createdDate: createdDate
      }
    });
    var token = (0, _db.createUserSession)(db, secret, userId, req.ip);
    res.cookie('token', token, {
      // httpOnly: true,
      // 30 days
      maxAge: 30 * 24 * 3600 * 1000
    });
    res.set('X-Session', token);
    res.status(200).json({
      id: userId,
      info: {
        email: email,
        name: name,
        createdDate: createdDate
      }
    });
  });
  var mid = middleware(db, secret);
  app.post(prefix + (paths.logout || '/logout'), mid, function (req, res) {
    (0, _db.completeUserSession)(db, req.auth.sessionId);
    res.status(204).end();
  });
  app.post(prefix + (paths.chpwd || '/chpwd'), mid, function (req, res) {//
  });
  app.post(prefix + (paths.forgotpw || '/forgotpw'), mid, function (req, res) {//
  });
  app.post(prefix + (paths.invite || '/invite'), mid, function (req, res) {//
  });
  app.get(prefix + (paths.user || '/user'), mid, function (req, res) {
    res.status(200).json(req.auth.user);
  }); // forgot pwd
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

exports.setupAuth = setupAuth;

var middleware = function middleware(db, secret) {
  return function (req, res, next) {
    if (req.query.token) {
      // TODO validateSessionToken should ... issue a new token?
      // if we're getting close to the end...
      // query param doesn't work super well for that.
      // cookies are simplest, for sure.
      // hm. Or a response header.
      // res.set('X-Session', token) could work.
      var auth = (0, _db.validateSessionToken)(db, secret, req.query.token);

      if (auth == null) {
        res.status(401);
        console.log('invalid query token');
        return res.send('Invalid or expired token (from query)');
      }

      req.auth = auth;
      return next();
    }

    var authHeader = req.get('authorization');

    if (authHeader && authHeader.match(/^Bearer: /i)) {
      var token = authHeader.slice('Bearer: '.length);

      var _auth = (0, _db.validateSessionToken)(db, secret, token);

      if (_auth == null) {
        res.status(401);
        console.log('invalid header token');
        return res.send('Invalid or expired token (from header)');
      }

      req.auth = _auth;
      return next();
    }

    if (req.cookies && req.cookies.session) {
      var _auth2 = (0, _db.validateSessionToken)(db, secret, req.cookies.token);

      if (_auth2 == null) {
        res.status(401);
        console.log('invalid cookie token');
        return res.send('Invalid or expired token (from cookie)');
      }

      req.auth = _auth2;
      return next();
    }

    res.status(401);
    return res.send('No token given (query param or header or cookie)');
  };
};

exports.middleware = middleware;