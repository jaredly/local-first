"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.updateCacheAndNotify = exports.fullMaxStamp = void 0;

var _peerTabs = require("../peer-tabs.js");

var hlc = _interopRequireWildcard(require("../../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _undoManager = require("../undo-manager.js");

var _shared = require("../shared.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var genId = function genId() {
  return Math.random().toString(36).slice(2);
};

var fullMaxStamp = function fullMaxStamp(crdt, full) {
  var maxStamp = null;
  Object.keys(full).forEach(function (colid) {
    Object.keys(full[colid]).forEach(function (key) {
      var latest = crdt.latestStamp(full[colid][key]);

      if (latest != null && (maxStamp == null || latest > maxStamp)) {
        maxStamp = latest;
      }
    });
  });
  return maxStamp;
};

exports.fullMaxStamp = fullMaxStamp;

var updateCacheAndNotify = function updateCacheAndNotify(state, crdt, changedIds, blob, sendCrossTabChanges) {
  Object.keys(changedIds).forEach(function (colid) {
    var col = state[colid];
    var data = blob[colid];

    if (col.listeners.length) {
      var changes = changedIds[colid].map(function (id) {
        return {
          id: id,
          value: crdt.value(data[id])
        };
      });
      changedIds[colid].forEach(function (id) {
        state[colid].cache[id] = data[id];
      });
      col.listeners.forEach(function (listener) {
        listener(changes);
      });
    }

    changedIds[colid].forEach(function (id) {
      // Only update the cache if the node has already been cached
      // Umm is this necessary though?
      if (state[colid].cache[id] != null || col.itemListeners[id]) {
        state[colid].cache[id] = data[id];
      }

      if (col.itemListeners[id]) {
        col.itemListeners[id].forEach(function (fn) {
          return fn(crdt.value(data[id]));
        });
      }
    });

    if (changedIds[colid].length) {
      console.log('Broadcasting to client-level listeners', changedIds[colid]);
      sendCrossTabChanges({
        col: colid,
        nodes: changedIds[colid]
      });
    }
  });
};

exports.updateCacheAndNotify = updateCacheAndNotify;

function createClient(name, crdt, schemas, clock, persistence, createNetwork) {
  var state = {};
  persistence.collections.forEach(function (id) {
    return state[id] = (0, _shared.newCollection)();
  });
  var network = (0, _peerTabs.peerTabAwareNetwork)(name, function (msg) {
    return (0, _shared.onCrossTabChanges)(crdt, persistence, state[msg.col], msg.col, msg.nodes);
  }, createNetwork(persistence.getFull, /*#__PURE__*/function () {
    var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(full, etag, sendCrossTabChanges) {
      var max, result, merged, changedIds;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              max = fullMaxStamp(crdt, full);

              if (max != null) {
                clock.recv(hlc.unpack(max));
              }

              _context.next = 4;
              return persistence.mergeFull(full, etag, crdt.merge);

            case 4:
              result = _context.sent;

              if (result) {
                _context.next = 7;
                break;
              }

              return _context.abrupt("return", null);

            case 7:
              merged = result.merged, changedIds = result.changedIds;
              updateCacheAndNotify(state, crdt, changedIds, merged.blob, sendCrossTabChanges);
              return _context.abrupt("return", merged);

            case 10:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }));

    return function (_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }(), persistence.updateMeta));
  var undoManager = (0, _undoManager.create)();
  return {
    sessionId: clock.now.node,
    setDirty: network.setDirty,
    getStamp: clock.get,
    undo: undoManager.undo,
    fullExport: function fullExport() {
      return persistence.fullExport();
    },
    importDump: function importDump(dump) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return persistence.mergeFull(dump, null, function (a, b) {
                  return (// $FlowFixMe datas
                    crdt.merge(a, b)
                  );
                });

              case 2:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }))();
    },
    getCollection: function getCollection(colid) {
      return (0, _shared.getCollection)(colid, crdt, persistence, state[colid], clock.get, network.setDirty, network.sendCrossTabChanges, schemas[colid], undoManager);
    },
    onSyncStatus: function onSyncStatus(fn) {
      network.onSyncStatus(fn);
    },
    getSyncStatus: function getSyncStatus() {
      return network.getSyncStatus();
    }
  };
}

var _default = createClient;
exports["default"] = _default;