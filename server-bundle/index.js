"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "validateDelta", {
  enumerable: true,
  get: function get() {
    return _schema.validateDelta;
  }
});
Object.defineProperty(exports, "validate", {
  enumerable: true,
  get: function get() {
    return _schema.validate;
  }
});
Object.defineProperty(exports, "subSchema", {
  enumerable: true,
  get: function get() {
    return _schema.subSchema;
  }
});
exports.runServer = exports.setupExpress = exports.setupWebsocket = exports.setupPolling = exports.setupBlob = void 0;

var _schema = require("../nested-object-crdt/src/schema.js");

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _blob = require("./blob.js");

var _poll = require("./poll.js");

var _websocket = require("./websocket.js");

var _express = _interopRequireDefault(require("express"));

var _expressWs = _interopRequireDefault(require("express-ws"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var setupBlob = function setupBlob(app, getDataPath) {
  var middleware = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var prefix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '/blob';
  app.get(prefix + '/:name', middleware, function (req, res) {
    var filePath = _path["default"].join(getDataPath(req), req.params['name']);

    (0, _blob.getBlob)(filePath, req.get('if-none-match'), res);
  });
  app.put(prefix + '/:name', middleware, function (req, res) {
    var filePath = _path["default"].join(getDataPath(req), req.params['name']);

    (0, _blob.putBlob)(filePath, req.body, res);
  });
};

exports.setupBlob = setupBlob;

var setupPolling = function setupPolling(app, getServer) {
  var middleware = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '/sync';
  app.post(path, middleware, function (req, res) {
    if (!req.query.sessionId) {
      throw new Error('No sessionId');
    }

    res.json((0, _poll.post)(getServer(req), req.query.sessionId, req.body));
  });
};

exports.setupPolling = setupPolling;

var setupWebsocket = function setupWebsocket(app, getServer) {
  var middleware = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '/sync';
  var clients = {};
  console.log('websocketing on', path);

  if (middleware.length) {
    app.use(path, middleware);
  }

  app.ws(path, function (ws, req) {
    if (!req.query.siteId) {
      ws.close();
      throw new Error('No siteId');
    }

    try {
      var server = getServer(req);
      (0, _websocket.onWebsocket)(server, clients, req.query.siteId, ws);
    } catch (err) {
      console.log('noooo');
      console.error(err);
    }
  });
};

exports.setupWebsocket = setupWebsocket;

var setupExpress = function setupExpress() {
  var app = (0, _express["default"])();
  var wsInst = (0, _expressWs["default"])(app);
  app.use(require('cors')({
    exposedHeaders: ['etag', 'X-Session']
  }));
  app.use(require('body-parser').json());
  return {
    app: app,
    wsInst: wsInst
  };
};

exports.setupExpress = setupExpress;

var runServer = function runServer(getBlobDataPath, getServer) {
  var middleware = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  var _setupExpress = setupExpress(),
      app = _setupExpress.app,
      wsInst = _setupExpress.wsInst;

  setupBlob(app, getBlobDataPath, middleware);
  setupPolling(app, getServer, middleware);
  setupWebsocket(app, getServer, middleware);
  return {
    app: app,
    wsInst: wsInst
  };
};

exports.runServer = runServer;