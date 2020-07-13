"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.runMulti = exports.serverForUser = exports.crdtImpl = void 0;

var crdt = _interopRequireWildcard(require("../nested-object-crdt/src/new.js"));

var rich = _interopRequireWildcard(require("../rich-text-crdt/index.js"));

var _server = _interopRequireDefault(require("../core/src/server.js"));

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _sqlitePersistence = _interopRequireDefault(require("./sqlite-persistence.js"));

var _memoryPersistence = _interopRequireDefault(require("../core/src/memory-persistence.js"));

var auth = _interopRequireWildcard(require("../auth/index.js"));

var _index3 = require("./index.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var otherMerge = function otherMerge(v1, m1, v2, m2) {
  return {
    value: rich.merge(v1, v2),
    meta: null
  };
};

var applyOtherDelta = function applyOtherDelta(text, meta, delta) {
  return {
    value: rich.apply(text, delta),
    meta: meta
  };
};

var crdtImpl = {
  createWithSchema: function createWithSchema(data, stamp, getStamp, schema) {
    return crdt.createWithSchema(data, stamp, getStamp, schema, function () {
      return null;
    });
  },
  createEmpty: crdt.createEmpty,
  applyDelta: function applyDelta(base, delta) {
    return crdt.applyDelta(base, delta, applyOtherDelta, otherMerge);
  },
  deltas: {
    stamp: function stamp(delta) {
      return crdt.deltas.stamp(delta, function () {
        return null;
      });
    }
  }
};
exports.crdtImpl = crdtImpl;

var serverForUser = function serverForUser(dataPath, userId, getSchemaChecker) {
  return (0, _server["default"])(crdtImpl, (0, _sqlitePersistence["default"])(_path["default"].join(dataPath, '' + userId)), getSchemaChecker);
}; // is auth shared? yes it's shared.
// but directories aren't shared I don't think.


exports.serverForUser = serverForUser;

var runMulti = function runMulti(dataPath, configs) {
  var port = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 9090;
  var secret = process.env.SECRET;

  if (secret == null) {
    throw new Error('process.env.SECRET is required');
  }

  if (!_fs["default"].existsSync(dataPath)) {
    _fs["default"].mkdirSync(dataPath);
  }

  var sqlite3 = require('better-sqlite3');

  var authDb = sqlite3(_path["default"].join(dataPath, 'users.db'));
  auth.createTables(authDb);
  var state = (0, _index3.setupExpress)();
  configs.forEach(function (config) {
    var userServers = {};
    var currentPath = dataPath + '/' + config.name;

    var getServer = function getServer(req) {
      if (!req.auth) {
        throw new Error("No auth");
      }

      if (!userServers[req.auth.id]) {
        userServers[req.auth.id] = serverForUser(currentPath, req.auth.id, config.getSchemaChecker);
      }

      return userServers[req.auth.id];
    };

    var middleware = [auth.middleware(authDb, secret)];
    (0, _index3.setupBlob)(state.app, function (req) {
      return _path["default"].join(currentPath, req.auth.id, 'blobs');
    }, middleware, "dbs/".concat(config.name, "/blob"));
    (0, _index3.setupPolling)(state.app, getServer, middleware, "dbs/".concat(config.name, "/sync"));
    (0, _index3.setupWebsocket)(state.app, getServer, middleware, "dbs/".concat(config.name, "/sync"));
  });
  auth.setupAuth(authDb, state.app, secret);
  state.app.listen(port);
  return state;
};

exports.runMulti = runMulti;

var run = function run(dataPath, getSchemaChecker) {
  var port = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 9090;

  if (process.env.NO_AUTH == null) {
    var secret = process.env.SECRET;

    if (secret == null) {
      throw new Error("process.env.SECRET is required if you don't pass process.env.NO_AUTH");
    }

    var userServers = {};

    var sqlite3 = require('better-sqlite3');

    var authDb = sqlite3(_path["default"].join(dataPath, 'users.db'));
    auth.createTables(authDb);
    var state = (0, _index3.runServer)(function (req) {
      return _path["default"].join(dataPath, req.auth.id, 'blobs');
    }, function (req) {
      if (!req.auth) {
        throw new Error("No auth");
      }

      if (!userServers[req.auth.id]) {
        userServers[req.auth.id] = serverForUser(dataPath, req.auth.id, getSchemaChecker);
      }

      return userServers[req.auth.id];
    }, [auth.middleware(authDb, secret)]);
    auth.setupAuth(authDb, state.app, secret);
    state.app.listen(port);
    return state;
  } else {
    var server = (0, _server["default"])(crdtImpl, (0, _sqlitePersistence["default"])(dataPath), getSchemaChecker);
    var ephemeralServer = (0, _server["default"])(crdtImpl, (0, _memoryPersistence["default"])(), getSchemaChecker);
    dataPath = _path["default"].join(dataPath, 'anon');

    var _state = (0, _index3.runServer)( // port,
    function () {
      return _path["default"].join(dataPath, 'blobs');
    }, function () {
      return server;
    });

    console.log('setup ephemeral socket');
    (0, _index3.setupWebsocket)(_state.app, function () {
      return ephemeralServer;
    }, [], '/ephemeral/sync');
    (0, _index3.setupPolling)(_state.app, function () {
      return ephemeralServer;
    }, [], '/ephemeral/sync');

    _state.app.listen(port);

    return _state;
  }
};

exports.run = run;