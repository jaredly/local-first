"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.applyDeltas = void 0;

var _idb = require("idb");

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var _applyDeltas = function applyDeltas(db, collection, deltas, serverCursor, apply, storeDeltas) {
  // console.log('Apply to collection', collection);
  var stores = storeDeltas ? [collection + ':meta', collection + ':nodes', collection + ':deltas'] : [collection + ':meta', collection + ':nodes']; // console.log('Opening for stores', stores);

  if (storeDeltas) {
    deltas.forEach(function (obj) {
      return db.put(collection + ':deltas', obj);
    });
  }

  var idMap = {};
  deltas.forEach(function (d) {
    return idMap[d.node] = true;
  });
  var ids = Object.keys(idMap);
  var gotten = ids.map(function (id) {
    return db.get(collection + ':nodes', id);
  }); // console.log('loaded up', ids, gotten);

  var map = {};
  gotten.forEach(function (res) {
    if (res) {
      map[res.id] = res.value;
    }
  });
  deltas.forEach(function (_ref) {
    var node = _ref.node,
        delta = _ref.delta;
    map[node] = apply(map[node], delta);
  }); // console.log('idb changeMany processed', ids, map, serverCursor);

  ids.forEach(function (id) {
    return map[id] ? db.put(collection + ':nodes', {
      id: id,
      value: map[id]
    }) : null;
  });

  if (serverCursor != null) {
    db.put(collection + ':meta', serverCursor, 'cursor');
  }

  return map;
};

exports.applyDeltas = _applyDeltas;

var FakeDb = /*#__PURE__*/function () {
  function FakeDb() {
    _classCallCheck(this, FakeDb);

    this.collections = {};
    this.keyPaths = {};
  }

  _createClass(FakeDb, [{
    key: "createObjectStore",
    value: function createObjectStore(name, options) {
      this.collections[name] = {};

      if (options && options.keyPath) {
        this.keyPaths[name] = options.keyPath;
      }
    }
  }, {
    key: "getAll",
    value: function getAll(colid) {
      var _this = this;

      return Object.keys(this.collections[colid]).map(function (key) {
        return _this.collections[colid][key];
      });
    }
  }, {
    key: "put",
    value: function put(colid, object, key) {
      if (key == null) {
        if (object == null || _typeof(object) !== 'object' || typeof object[this.keyPaths[colid]] !== 'string') {
          throw new Error('Must specify a key');
        }

        key = object[this.keyPaths[colid]];
      }

      this.collections[colid][key] = object;
    }
  }, {
    key: "get",
    value: function get(colid, key) {
      return this.collections[colid][key];
    }
  }, {
    key: "deleteUpTo",
    value: function deleteUpTo(colid, upTo) {
      var keys = Object.keys(this.collections[colid]).sort();
      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = keys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var _key = _step.value;
          delete this.collections[colid][_key];

          if (_key === upTo) {
            break;
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
    }
  }]);

  return FakeDb;
}(); // TODO abstract this out so that we can have the same base implementation
// Also be smart so if the idb doesn't have the correct objectStores set up, I throw an error.


var makePersistence = function makePersistence(collections) {
  var db = new FakeDb();
  collections.forEach(function (name) {
    db.createObjectStore(name + ':deltas', {
      keyPath: 'stamp'
    });
    db.createObjectStore(name + ':nodes', {
      keyPath: 'id'
    }); // stores "cursor", and that's it for the moment
    // In a multi-delta-persistence world, it would
    // store a cursor for each server.

    db.createObjectStore(name + ':meta');
  });
  return {
    collections: collections,
    tabIsolated: true,
    deltas: function deltas(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                return _context.abrupt("return", db.getAll(collection + ':deltas'));

              case 1:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }))();
    },
    getServerCursor: function getServerCursor(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                return _context2.abrupt("return", db.get(collection + ':meta', 'cursor'));

              case 1:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }))();
    },
    deleteDeltas: function deleteDeltas(collection, upTo) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                // console.log('delete up to', upTo);
                db.deleteUpTo(collection + ':deltas', upTo);

              case 1:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }))();
    },
    applyDelta: function applyDelta(colid, id, delta, stamp, apply) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var map;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (collections.includes(colid)) {
                  _context4.next = 2;
                  break;
                }

                throw new Error('Unknown collection ' + colid);

              case 2:
                map = _applyDeltas(db, colid, [{
                  node: id,
                  delta: delta,
                  stamp: stamp
                }], null, apply, true);
                return _context4.abrupt("return", map[id]);

              case 4:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }))();
    },
    load: function load(collection, id) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var data;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                data = db.get(collection + ':nodes', id);
                return _context5.abrupt("return", data ? data.value : null);

              case 2:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }))();
    },
    loadAll: function loadAll(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var items, res;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                items = db.getAll(collection + ':nodes');
                res = {};
                items.forEach(function (item) {
                  return res[item.id] = item.value;
                });
                return _context6.abrupt("return", res);

              case 4:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6);
      }))();
    },
    fullExport: function fullExport() {
      var _this2 = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
        var dump;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                dump = {};
                _context8.next = 3;
                return Promise.all(collections.map( /*#__PURE__*/function () {
                  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7(colid) {
                    return regeneratorRuntime.wrap(function _callee7$(_context7) {
                      while (1) {
                        switch (_context7.prev = _context7.next) {
                          case 0:
                            _context7.next = 2;
                            return _this2.loadAll(colid);

                          case 2:
                            dump[colid] = _context7.sent;

                          case 3:
                          case "end":
                            return _context7.stop();
                        }
                      }
                    }, _callee7);
                  }));

                  return function (_x) {
                    return _ref2.apply(this, arguments);
                  };
                }()));

              case 3:
                return _context8.abrupt("return", dump);

              case 4:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8);
      }))();
    },
    applyDeltas: function applyDeltas(collection, deltas, serverCursor, apply) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (collections.includes(collection)) {
                  _context9.next = 2;
                  break;
                }

                throw new Error('Unknown collection ' + collection);

              case 2:
                return _context9.abrupt("return", _applyDeltas(db, collection, deltas, serverCursor, apply, false));

              case 3:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9);
      }))();
    }
  };
};

var _default = makePersistence;
exports["default"] = _default;