"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.onMessage = exports.getMessages = void 0;

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var getMessages = function getMessages(state, sessionId) {
  if (!state.clients[sessionId]) {
    // console.log(`No clients registered for ${sessionId}`);
    return [];
  }

  var colids = Object.keys(state.clients[sessionId].collections); // console.log(`Getting messages for ${sessionId}: ${colids.join(',')}`);

  return colids.map(function (cid) {
    var lastSeen = state.clients[sessionId].collections[cid];
    var result = state.persistence.deltasSince(cid, lastSeen, sessionId);

    if ((!result || !result.deltas.length) && lastSeen == null) {
      return {
        type: 'sync',
        collection: cid,
        deltas: [],
        serverCursor: -1
      };
    }

    if (!result) {
      // console.log(
      //     `no new messages since ${
      //         lastSeen != null ? lastSeen : 'no-start'
      //     } for ${cid} (${sessionId})`,
      // );
      return;
    }

    var cursor = result.cursor,
        deltas = result.deltas; // console.log('getting all since', lastSeen, cursor, deltas);

    if (deltas.length) {
      if (cursor == null) {
        throw new Error("Got deltas, but no cursor");
      } // console.log(
      //     `${deltas.length} new deltas for ${cid} since ${
      //         lastSeen != null ? lastSeen : 'no-start'
      //     }, cursor ${cursor}`,
      // );


      return {
        type: 'sync',
        collection: cid,
        deltas: deltas,
        serverCursor: cursor
      };
    } else {// console.log(`Nothing new for ${cid}`);
    }
  }).filter(Boolean);
};

exports.getMessages = getMessages;

var onMessage = function onMessage(state, sessionId, message) {
  if (message.type === 'sync') {
    var schemaChecker = state.getSchemaChecker(message.collection);

    if (!schemaChecker) {
      console.warn("No schema found for ".concat(message.collection)); // TODO should I surface an error here? Break off the connection?

      return;
    }

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = message.deltas[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var delta = _step.value;
        var error = schemaChecker(delta.delta);

        if (error != null) {
          console.error("Delta on ".concat(delta.node, " failed schema check! ").concat(error));
          console.error(delta.delta);
          return;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"] != null) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    if (!state.clients[sessionId]) {
      state.clients[sessionId] = {
        collections: {}
      };
    }

    if (message.serverCursor != null || state.clients[sessionId].collections[message.collection] == null) {
      state.clients[sessionId].collections[message.collection] = message.serverCursor;
    }

    if (message.deltas.length) {
      state.persistence.addDeltas(message.collection, sessionId, message.deltas);
      var maxStamp = null;
      message.deltas.forEach(function (delta) {
        var stamp = state.crdt.deltas.stamp(delta.delta);

        if (maxStamp == null || stamp > maxStamp) {
          maxStamp = stamp;
        }
      }); // console.log('max', maxStamp, message.deltas);

      if (maxStamp) {
        console.log('acking');
        return {
          type: 'ack',
          deltaStamp: maxStamp,
          collection: message.collection
        };
      } else {
        console.log('no max stamp??');
      } // console.log('not acking');

    }
  } else if (message.type === 'ack') {
    console.log('acked');
    state.clients[sessionId].collections[message.collection] = message.serverCursor;
  }
};

exports.onMessage = onMessage;

var make = function make(crdt, persistence, getSchemaChecker) {
  return {
    crdt: crdt,
    persistence: persistence,
    getSchemaChecker: getSchemaChecker,
    clients: {}
  };
};

var _default = make;
exports["default"] = _default;