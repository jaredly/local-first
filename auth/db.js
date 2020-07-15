"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validateSessionToken = exports.completeAllSessionsForUser = exports.completeUserSession = exports.createUserSession = exports.loginUser = exports.checkUserExists = exports.createUser = exports.createTables = exports.ADMIN_ROLE = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var bcrypt = require('bcryptjs');

var ADMIN_ROLE = 9;
exports.ADMIN_ROLE = ADMIN_ROLE;
var createInvitesTableQuery = "\n    CREATE TABLE IF NOT EXISTS invites (\n        id integer PRIMARY KEY,\n        stringId text UNIQUE NOT NULL,\n        createdDate integer NOT NULL,\n        -- the date it was fulfilled\n        fulfilledDate integer\n    )\n";
var createUsersTableQuery = "\n    CREATE TABLE IF NOT EXISTS users (\n    id integer PRIMARY KEY,\n    name text NOT NULL,\n    email text UNIQUE NOT NULL,\n    createdDate integer NOT NULL,\n    passwordHash text NOT NULL,\n    invitedBy INTEGER,\n    -- 0 or NULL for no privileges, 9 for admin\n    role INTEGER\n    )\n";
var createSessionsTableQuery = "\n    CREATE TABLE IF NOT EXISTS sessions (\n    id integer PRIMARY KEY,\n    userId integer NOT NULL,\n    createdDate integer NOT NULL,\n    ipAddress TEXT NOT NULL,\n    expirationDate integer NOT NULL,\n    -- the date you logged out\n    logoutDate integer\n    )\n";

var run = function run(db, query) {
  var _db$prepare;

  var args = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  (_db$prepare = db.prepare(query)).run.apply(_db$prepare, _toConsumableArray(args));
};

var createTables = function createTables(db) {
  run(db, createUsersTableQuery);
  run(db, createSessionsTableQuery);
  run(db, createInvitesTableQuery);
}; // export const findUserByEmail = (db: DB, email: string) => {
//     const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
//     const result = stmt.get(email);
//     if (!result) return null;
//     const { name, createdDate, passwordHash } = result;
//     return {
//         info: { name, email, createdDate },
//         passwordHash,
//     };
// };


exports.createTables = createTables;

var createUser = function createUser(db, _ref) {
  var _ref$info = _ref.info,
      name = _ref$info.name,
      email = _ref$info.email,
      createdDate = _ref$info.createdDate,
      password = _ref.password;
  var passwordHash = bcrypt.hashSync(password);
  var stmt = db.prepare("INSERT INTO users\n    (name, email, passwordHash, createdDate)\n    VALUES (@name, @email, @passwordHash, @createdDate)");
  var info = stmt.run({
    name: name,
    email: email,
    createdDate: createdDate,
    passwordHash: passwordHash
  });

  if (info.changes !== 1) {
    throw new Error("Unexpected sqlite response: ".concat(info.changes, " should be '1'"));
  }

  return info.lastInsertRowid;
};

exports.createUser = createUser;

var checkUserExists = function checkUserExists(db, email) {
  var stmt = db.prepare("SELECT id FROM users WHERE email = ?");
  var result = stmt.get(email);
  return result ? true : false;
};

exports.checkUserExists = checkUserExists;

var loginUser = function loginUser(db, email, password) {
  var stmt = db.prepare("SELECT * FROM users WHERE email = ?");
  var result = stmt.get(email);
  if (!result) return null;

  if (bcrypt.compareSync(password, result.passwordHash)) {
    return {
      id: result.id,
      info: {
        name: result.name,
        email: result.email,
        createdDate: result.createdDate
      }
    };
  } else {
    return false;
  }
};

exports.loginUser = loginUser;

var createUserSession = function createUserSession(db, secret, userId, ipAddress) {
  var expirationDate = Date.now() + 365 * 24 * 60 * 60 * 1000;
  var stmt = db.prepare("INSERT INTO sessions\n    (userId, createdDate, ipAddress, expirationDate)\n    VALUES (@userId, @createdDate, @ipAddress, @expirationDate)");
  var info = stmt.run({
    userId: userId,
    ipAddress: ipAddress,
    createdDate: Date.now(),
    // valid for a year
    expirationDate: expirationDate
  });

  if (info.changes !== 1) {
    throw new Error("Unexpected sqlite response: ".concat(info.changes, " should be '1'"));
  }

  var sessionId = info.lastInsertRowid;
  console.log('sessionId', sessionId, info);
  var token = jwt.sign({
    data: sessionId + '',
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
  }, secret);
  return token;
};

exports.createUserSession = createUserSession;

var completeUserSession = function completeUserSession(db, sessionId) {
  var stmt = db.prepare("UPDATE sessions\n    SET logoutDate = @logoutDate\n    WHERE rowid = @id");
  var info = stmt.run({
    logoutDate: Date.now(),
    id: sessionId
  });

  if (info.changes !== 1) {
    throw new Error("Unexpected sqlite response: ".concat(info.changes, " should be '1'"));
  }
};

exports.completeUserSession = completeUserSession;

var completeAllSessionsForUser = function completeAllSessionsForUser(db, userId) {
  var stmt = db.prepare("UPDATE sessions\n    SET logoutDate = @logoutDate\n    WHERE userId = @userId AND logoutDate = NULL");
  var info = stmt.run({
    logoutDate: Date.now(),
    userId: userId
  });
  return info.changes;
};

exports.completeAllSessionsForUser = completeAllSessionsForUser;

var jwt = require('jsonwebtoken'); // returns a userId if the token & session are valid


var validateSessionToken = function validateSessionToken(db, secret, token) {
  var sessionId = null;

  try {
    sessionId = jwt.verify(token, secret).data;
  } catch (err) {
    return null;
  }

  var stmt = db.prepare("SELECT * FROM sessions WHERE id = @id");
  var session = stmt.get({
    id: sessionId
  });

  if (!session) {
    return null;
  }

  if (session.logoutDate != null) {
    return null; // session has been logged-out
  }

  if (session.expirationDate <= Date.now()) {
    return null; // it has expired
  }

  var info = db.prepare('SELECT * from users WHERE id = @id');
  var user = info.get({
    id: session.userId
  });

  if (!user) {
    return null;
  }

  return {
    id: session.userId,
    user: {
      name: user.name,
      email: user.email,
      createdDate: user.createdDate
    },
    sessionId: sessionId
  };
};

exports.validateSessionToken = validateSessionToken;