"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.initialState = exports.handleMessages = exports.getMessages = void 0;

var _peerTabs = require("../peer-tabs.js");

var hlc = _interopRequireWildcard(require("../../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _undoManager = require("../undo-manager.js");

var _shared = require("../shared.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var genId = function genId() {
  return Math.random().toString(36).slice(2);
};

var getMessages = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(persistence, reconnected) {
    var items;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return Promise.all(persistence.collections.map( /*#__PURE__*/function () {
              var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(collection) {
                var deltas, serverCursor;
                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        _context.next = 2;
                        return persistence.deltas(collection);

                      case 2:
                        deltas = _context.sent;
                        _context.next = 5;
                        return persistence.getServerCursor(collection);

                      case 5:
                        serverCursor = _context.sent;

                        if (!(deltas.length || serverCursor == null || reconnected)) {
                          _context.next = 8;
                          break;
                        }

                        return _context.abrupt("return", {
                          type: 'sync',
                          collection: collection,
                          serverCursor: serverCursor,
                          deltas: deltas.map(function (_ref3) {
                            var node = _ref3.node,
                                delta = _ref3.delta;
                            return {
                              node: node,
                              delta: delta
                            };
                          })
                        });

                      case 8:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              }));

              return function (_x3) {
                return _ref2.apply(this, arguments);
              };
            }()));

          case 2:
            items = _context2.sent;
            return _context2.abrupt("return", items.filter(Boolean));

          case 4:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));

  return function getMessages(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

exports.getMessages = getMessages;

var handleMessages = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(crdt, persistence, messages, state, recvClock, sendCrossTabChanges) {
    var res;
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            console.log('RECV', messages);
            _context4.next = 3;
            return Promise.all(messages.map( /*#__PURE__*/function () {
              var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(msg) {
                var col, changed, deltasWithStamps, changedIds, data, changes, maxStamp;
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                  while (1) {
                    switch (_context3.prev = _context3.next) {
                      case 0:
                        if (!(msg.type === 'sync')) {
                          _context3.next = 18;
                          break;
                        }

                        col = state[msg.collection];
                        changed = {};
                        msg.deltas.forEach(function (delta) {
                          changed[delta.node] = true;
                        });
                        deltasWithStamps = msg.deltas.map(function (delta) {
                          return _objectSpread({}, delta, {
                            stamp: crdt.deltas.stamp(delta.delta)
                          });
                        });
                        changedIds = Object.keys(changed); // console.log('applying deltas', msg.serverCursor);

                        _context3.next = 8;
                        return persistence.applyDeltas(msg.collection, deltasWithStamps, msg.serverCursor, function (data, delta) {
                          return crdt.deltas.apply(data, delta);
                        });

                      case 8:
                        data = _context3.sent;

                        if (col.listeners.length) {
                          changes = changedIds.map(function (id) {
                            return {
                              id: id,
                              value: crdt.value(data[id])
                            };
                          });
                          col.listeners.forEach(function (listener) {
                            listener(changes);
                          });
                        }

                        changedIds.forEach(function (id) {
                          // Only update the cache if the node has already been cached
                          if (state[msg.collection].cache[id] != null) {
                            state[msg.collection].cache[id] = data[id];
                          }

                          if (col.itemListeners[id]) {
                            col.itemListeners[id].forEach(function (fn) {
                              return fn(crdt.value(data[id]));
                            });
                          }
                        });

                        if (changedIds.length) {
                          // console.log(
                          //     'Broadcasting to client-level listeners',
                          //     changedIds,
                          // );
                          sendCrossTabChanges({
                            col: msg.collection,
                            nodes: changedIds
                          });
                        }

                        maxStamp = null;
                        msg.deltas.forEach(function (delta) {
                          var stamp = crdt.deltas.stamp(delta.delta);

                          if (maxStamp == null || stamp > maxStamp) {
                            maxStamp = stamp;
                          }
                        });

                        if (maxStamp) {
                          recvClock(hlc.unpack(maxStamp));
                        }

                        return _context3.abrupt("return", {
                          type: 'ack',
                          collection: msg.collection,
                          serverCursor: msg.serverCursor
                        });

                      case 18:
                        if (!(msg.type === 'ack')) {
                          _context3.next = 21;
                          break;
                        }

                        _context3.next = 21;
                        return persistence.deleteDeltas(msg.collection, msg.deltaStamp);

                      case 21:
                      case "end":
                        return _context3.stop();
                    }
                  }
                }, _callee3);
              }));

              return function (_x10) {
                return _ref5.apply(this, arguments);
              };
            }()));

          case 3:
            res = _context4.sent;
            return _context4.abrupt("return", res.filter(Boolean));

          case 5:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4);
  }));

  return function handleMessages(_x4, _x5, _x6, _x7, _x8, _x9) {
    return _ref4.apply(this, arguments);
  };
}();

exports.handleMessages = handleMessages;

var initialState = function initialState(collections) {
  var state = {};
  collections.forEach(function (id) {
    return state[id] = (0, _shared.newCollection)();
  });
  return state;
};

exports.initialState = initialState;

var tabIsolatedNetwork = function tabIsolatedNetwork(network) {
  var connectionListeners = [];
  var currentSyncStatus = network.initial;
  var sync = network.createSync(function () {}, function (status) {
    currentSyncStatus = status;
    connectionListeners.forEach(function (f) {
      return f(currentSyncStatus);
    });
  }, function () {// do nothing
  });
  var syncTimer = null;
  return {
    setDirty: function setDirty() {
      if (syncTimer) return;
      syncTimer = setTimeout(function () {
        syncTimer = null;
        sync(false);
      }, 0);
    },
    onSyncStatus: function onSyncStatus(fn) {
      connectionListeners.push(fn);
    },
    getSyncStatus: function getSyncStatus() {
      return currentSyncStatus;
    },
    sendCrossTabChanges: function sendCrossTabChanges(peerChange) {}
  };
};

function createClient(name, crdt, schemas, clock, persistence, createNetwork) {
  var state = initialState(persistence.collections);
  var undoManager = (0, _undoManager.create)(); // console.log();

  var innerNetwork = createNetwork(clock.now.node, function (fresh) {
    return getMessages(persistence, fresh);
  }, function (messages, sendCrossTabChanges) {
    return handleMessages(crdt, persistence, messages, state, clock.recv, sendCrossTabChanges);
  });
  var network = persistence.tabIsolated ? tabIsolatedNetwork(innerNetwork) : (0, _peerTabs.peerTabAwareNetwork)(name, function (msg) {
    return (0, _shared.onCrossTabChanges)(crdt, persistence, state[msg.col], msg.col, msg.nodes);
  }, innerNetwork);
  var collections = {};
  return {
    sessionId: clock.now.node,
    getStamp: clock.get,
    setDirty: network.setDirty,
    undo: undoManager.undo,
    // TODO export should include a stamp
    fullExport: function fullExport() {
      console.log('full export');
      return persistence.fullExport();
    },
    importDump: function importDump(dump) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return Promise.all(Object.keys(dump).map( /*#__PURE__*/function () {
                  var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(key) {
                    var deltas;
                    return regeneratorRuntime.wrap(function _callee5$(_context5) {
                      while (1) {
                        switch (_context5.prev = _context5.next) {
                          case 0:
                            deltas = Object.keys(dump[key]).map(function (id) {
                              var node = dump[key][id]; // $FlowFixMe datas arguing

                              var inner = crdt.deltas.replace(node);
                              var delta = {
                                node: id,
                                delta: inner,
                                stamp: crdt.deltas.stamp(inner)
                              };
                              return delta;
                            });
                            _context5.next = 3;
                            return persistence.applyDeltas(key, deltas, null, function (data, delta) {
                              return crdt.deltas.apply(data, delta);
                            });

                          case 3:
                          case "end":
                            return _context5.stop();
                        }
                      }
                    }, _callee5);
                  }));

                  return function (_x11) {
                    return _ref6.apply(this, arguments);
                  };
                }()));

              case 2:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6);
      }))();
    },
    getCollection: function getCollection(colid) {
      if (!collections[colid]) {
        collections[colid] = (0, _shared.getCollection)(colid, crdt, persistence, state[colid], clock.get, network.setDirty, network.sendCrossTabChanges, schemas[colid], undoManager);
      }

      return collections[colid];
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