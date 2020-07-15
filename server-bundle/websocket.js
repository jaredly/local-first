"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.onWebsocket = exports.broadcast = exports.handleMessages = void 0;

var _server = _interopRequireWildcard(require("../core/src/server.js"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var handleMessages = function handleMessages(server, sessionId, respond, messages) {
  var acks = messages.map(function (message) {
    return (0, _server.onMessage)(server, sessionId, message);
  }).filter(Boolean);
  var response = acks.concat((0, _server.getMessages)(server, sessionId));

  if (response.length) {
    respond(response);
  }
};

exports.handleMessages = handleMessages;

var broadcast = function broadcast(server, clients, sessionId) {
  Object.keys(clients).forEach(function (id) {
    if (id !== sessionId) {
      var response = (0, _server.getMessages)(server, id);

      if (response.length) {
        clients[id].send(response);
      }
    }
  });
};

exports.broadcast = broadcast;

var onWebsocket = function onWebsocket(server, clients, sessionId, ws) {
  console.log('received connection', sessionId);
  clients[sessionId] = {
    send: function send(messages) {
      return ws.send(JSON.stringify(messages));
    }
  };
  ws.on('message', function (data) {
    handleMessages(server, sessionId, function (data) {
      return ws.send(JSON.stringify(data));
    }, JSON.parse(data));
    broadcast(server, clients, sessionId);
  });
  ws.on('close', function () {
    console.log('Closed connection', sessionId);
    delete clients[sessionId];
  });
};

exports.onWebsocket = onWebsocket;