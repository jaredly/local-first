"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.applyDeltas = void 0;

var _idb = require("idb");

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var _applyDeltas = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(db, collection, deltas, serverCursor, apply, storeDeltas) {
    var stores, tx, deltaStore, nodes, idMap, ids, gotten, map;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // console.log('Apply to collection', collection);
            stores = storeDeltas ? [collection + ':meta', collection + ':nodes', collection + ':deltas'] : [collection + ':meta', collection + ':nodes']; // console.log('Opening for stores', stores);

            _context.next = 3;
            return db;

          case 3:
            tx = _context.sent.transaction(stores, 'readwrite');

            if (storeDeltas) {
              deltaStore = tx.objectStore(collection + ':deltas');
              deltas.forEach(function (obj) {
                return deltaStore.put(obj);
              });
            }

            nodes = tx.objectStore(collection + ':nodes');
            idMap = {};
            deltas.forEach(function (d) {
              return idMap[d.node] = true;
            });
            ids = Object.keys(idMap);
            _context.next = 11;
            return Promise.all(ids.map(function (id) {
              return nodes.get(id);
            }));

          case 11:
            gotten = _context.sent;
            // console.log('loaded up', ids, gotten);
            map = {};
            gotten.forEach(function (res) {
              if (res) {
                map[res.id] = res.value;
              }
            });
            deltas.forEach(function (_ref2) {
              var node = _ref2.node,
                  delta = _ref2.delta;
              map[node] = apply(map[node], delta);
            }); // console.log('idb changeMany processed', ids, map, serverCursor);

            ids.forEach(function (id) {
              return map[id] ? nodes.put({
                id: id,
                value: map[id]
              }) : null;
            });

            if (serverCursor != null) {
              tx.objectStore(collection + ':meta').put(serverCursor, 'cursor');
            }

            _context.next = 19;
            return tx.done;

          case 19:
            return _context.abrupt("return", map);

          case 20:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function applyDeltas(_x, _x2, _x3, _x4, _x5, _x6) {
    return _ref.apply(this, arguments);
  };
}();

exports.applyDeltas = _applyDeltas;

var hasStore = function hasStore(db, storeName) {};

var makePersistence = function makePersistence(name, collections, version, indexes) {
  // console.log('Persistence with name', name);
  var db = (0, _idb.openDB)(name, version, {
    upgrade: function upgrade(db, oldVersion, newVersion, transaction) {
      var currentStores = db.objectStoreNames;
      collections.forEach(function (name) {
        if (!currentStores.contains(name + ':deltas')) {
          console.log('deltas');
          db.createObjectStore(name + ':deltas', {
            keyPath: 'stamp'
          });
        }

        var nodeStore;

        if (!currentStores.contains(name + ':nodes')) {
          nodeStore = db.createObjectStore(name + ':nodes', {
            keyPath: 'id'
          });
        } else {
          nodeStore = transaction.objectStore(name + ':nodes');
        }

        if (indexes[name]) {
          Object.keys(indexes[name]).forEach(function (indexName) {
            var config = indexes[name][indexName];

            if (!nodeStore.indexNames.contains(indexName)) {
              nodeStore.createIndex(indexName, config.keyPath, {
                unique: false
              });
            }
          });
        } // stores "cursor", and that's it for the moment
        // In a multi-delta-persistence world, it would
        // store a cursor for each server.


        if (!currentStores.contains(name + ':meta')) {
          db.createObjectStore(name + ':meta');
        }
      });
      console.log('made object stores');
    }
  });
  return {
    collections: collections,
    tabIsolated: false,
    deltas: function deltas(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return db;

              case 2:
                _context2.next = 4;
                return _context2.sent.getAll(collection + ':deltas');

              case 4:
                return _context2.abrupt("return", _context2.sent);

              case 5:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }))();
    },
    getServerCursor: function getServerCursor(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return db;

              case 2:
                _context3.next = 4;
                return _context3.sent.get(collection + ':meta', 'cursor');

              case 4:
                return _context3.abrupt("return", _context3.sent);

              case 5:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }))();
    },
    deleteDeltas: function deleteDeltas(collection, upTo) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var cursor;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _context4.next = 2;
                return db;

              case 2:
                _context4.next = 4;
                return _context4.sent.transaction(collection + ':deltas', 'readwrite'). // $FlowFixMe why doesn't flow like this
                store.openCursor(IDBKeyRange.upperBound(upTo));

              case 4:
                cursor = _context4.sent;

              case 5:
                if (!cursor) {
                  _context4.next = 12;
                  break;
                }

                cursor["delete"]();
                _context4.next = 9;
                return cursor["continue"]();

              case 9:
                cursor = _context4.sent;
                _context4.next = 5;
                break;

              case 12:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }))();
    },
    applyDelta: function applyDelta(colid, id, delta, stamp, apply) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var map;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                if (collections.includes(colid)) {
                  _context5.next = 2;
                  break;
                }

                throw new Error('Unknown collection ' + colid);

              case 2:
                _context5.next = 4;
                return _applyDeltas(db, colid, [{
                  node: id,
                  delta: delta,
                  stamp: stamp
                }], null, apply, true);

              case 4:
                map = _context5.sent;
                return _context5.abrupt("return", map[id]);

              case 6:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }))();
    },
    load: function load(collection, id) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var data;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return db;

              case 2:
                _context6.next = 4;
                return _context6.sent.get(collection + ':nodes', id);

              case 4:
                data = _context6.sent;
                return _context6.abrupt("return", data ? data.value : null);

              case 6:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6);
      }))();
    },
    loadAll: function loadAll(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        var items, res;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return db;

              case 2:
                _context7.next = 4;
                return _context7.sent.getAll(collection + ':nodes');

              case 4:
                items = _context7.sent;
                res = {};
                items.forEach(function (item) {
                  return res[item.id] = item.value;
                });
                return _context7.abrupt("return", res);

              case 8:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7);
      }))();
    },
    fullExport: function fullExport() {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        var dump;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                console.log('dumping all');
                dump = {};
                _context9.next = 4;
                return Promise.all(collections.map( /*#__PURE__*/function () {
                  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8(colid) {
                    return regeneratorRuntime.wrap(function _callee8$(_context8) {
                      while (1) {
                        switch (_context8.prev = _context8.next) {
                          case 0:
                            console.log('exporting', colid); // const items = await (await db).getAll(colid + ':nodes');

                            _context8.next = 3;
                            return _this.loadAll(colid);

                          case 3:
                            dump[colid] = _context8.sent;
                            console.log('done');

                          case 5:
                          case "end":
                            return _context8.stop();
                        }
                      }
                    }, _callee8);
                  }));

                  return function (_x7) {
                    return _ref3.apply(this, arguments);
                  };
                }()));

              case 4:
                return _context9.abrupt("return", dump);

              case 5:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9);
      }))();
    },
    applyDeltas: function applyDeltas(collection, deltas, serverCursor, apply) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                if (collections.includes(collection)) {
                  _context10.next = 2;
                  break;
                }

                throw new Error('Unknown collection ' + collection);

              case 2:
                return _context10.abrupt("return", _applyDeltas(db, collection, deltas, serverCursor, apply, serverCursor == null));

              case 3:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10);
      }))();
    }
  };
};

var _default = makePersistence;
exports["default"] = _default;