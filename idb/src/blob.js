"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = exports.makePersistence = void 0;

var _idb = require("idb");

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

var _jsonEqualish = _interopRequireDefault(require("@birchill/json-equalish"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// export const
var itemMap = function itemMap(items) {
  var res = {};
  items.forEach(function (item) {
    return res[item.id] = item.value;
  });
  return res;
};

var makePersistence = function makePersistence(name, collections, version) {
  var colName = function colName(name) {
    return name + ':nodes';
  };

  var db = (0, _idb.openDB)(name, version, {
    upgrade: function upgrade(db, oldVersion, newVersion, transaction) {
      var currentStores = _toConsumableArray(db.objectStoreNames);

      collections.forEach(function (name) {
        var storeName = colName(name);

        if (!currentStores.includes(storeName)) {
          db.createObjectStore(storeName, {
            keyPath: 'id'
          });
        }
      });

      if (!currentStores.includes('meta')) {
        db.createObjectStore('meta');
      }
    }
  });
  var allStores = collections.map(function (name) {
    return colName(name);
  }).concat(['meta']);
  return {
    collections: collections,
    tabIsolated: false,
    load: function load(collection, id) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
        var data;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return db;

              case 2:
                _context.next = 4;
                return _context.sent.get(colName(collection), id);

              case 4:
                data = _context.sent;
                return _context.abrupt("return", data ? data.value : null);

              case 6:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }))();
    },
    loadAll: function loadAll(collection) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.t0 = itemMap;
                _context2.next = 3;
                return db;

              case 3:
                _context2.next = 5;
                return _context2.sent.getAll(colName(collection));

              case 5:
                _context2.t1 = _context2.sent;
                return _context2.abrupt("return", (0, _context2.t0)(_context2.t1));

              case 7:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }))();
    },
    updateMeta: function updateMeta(serverEtag, dirtyStampToClear) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
        var tx, current;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return db;

              case 2:
                tx = _context3.sent.transaction('meta', 'readwrite');

                if (serverEtag != null) {
                  tx.store.put(serverEtag, 'serverEtag');
                }

                if (!(dirtyStampToClear != null)) {
                  _context3.next = 9;
                  break;
                }

                _context3.next = 7;
                return tx.store.get('dirty');

              case 7:
                current = _context3.sent;

                if (current === dirtyStampToClear) {
                  tx.store.put(null, 'dirty');
                } else {
                  console.log('not clearing dirty', current, dirtyStampToClear);
                }

              case 9:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }))();
    },
    getFull: function getFull() {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var tx, dirty, serverEtag, blob;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return db;

              case 2:
                tx = _context5.sent.transaction(allStores, 'readonly');
                _context5.next = 5;
                return tx.objectStore('meta').get('dirty');

              case 5:
                dirty = _context5.sent;
                _context5.next = 8;
                return tx.objectStore('meta').get('serverEtag');

              case 8:
                serverEtag = _context5.sent;

                if (dirty) {
                  _context5.next = 11;
                  break;
                }

                return _context5.abrupt("return", {
                  local: null,
                  serverEtag: serverEtag
                });

              case 11:
                blob = {};
                _context5.next = 14;
                return Promise.all(collections.map( /*#__PURE__*/function () {
                  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(colid) {
                    return regeneratorRuntime.wrap(function _callee4$(_context4) {
                      while (1) {
                        switch (_context4.prev = _context4.next) {
                          case 0:
                            _context4.t0 = itemMap;
                            _context4.next = 3;
                            return tx.objectStore(colName(colid)).getAll();

                          case 3:
                            _context4.t1 = _context4.sent;
                            blob[colid] = (0, _context4.t0)(_context4.t1);

                          case 5:
                          case "end":
                            return _context4.stop();
                        }
                      }
                    }, _callee4);
                  }));

                  return function (_x) {
                    return _ref.apply(this, arguments);
                  };
                }()));

              case 14:
                return _context5.abrupt("return", {
                  local: {
                    blob: blob,
                    stamp: dirty
                  },
                  serverEtag: serverEtag
                });

              case 15:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }))();
    },
    mergeFull: function mergeFull(datas, etag, merge) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        var tx, blob, changedIds, anyChanged, dirty;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return db;

              case 2:
                tx = _context7.sent.transaction(Object.keys(datas).map(function (name) {
                  return colName(name);
                }).concat(['meta']), 'readwrite');
                blob = {};
                changedIds = {};
                anyChanged = false;
                _context7.next = 8;
                return Promise.all(Object.keys(datas).map( /*#__PURE__*/function () {
                  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(col) {
                    var store;
                    return regeneratorRuntime.wrap(function _callee6$(_context6) {
                      while (1) {
                        switch (_context6.prev = _context6.next) {
                          case 0:
                            store = tx.objectStore(colName(col));
                            _context6.t0 = itemMap;
                            _context6.next = 4;
                            return store.getAll();

                          case 4:
                            _context6.t1 = _context6.sent;
                            blob[col] = (0, _context6.t0)(_context6.t1);
                            Object.keys(datas[col]).forEach(function (key) {
                              var prev = blob[col][key];

                              if (prev) {
                                blob[col][key] = merge(prev, datas[col][key]);
                              } else {
                                blob[col][key] = datas[col][key];
                              }

                              if (!(0, _jsonEqualish["default"])(prev, blob[col][key])) {
                                anyChanged = true;

                                if (!changedIds[col]) {
                                  changedIds[col] = [key];
                                } else {
                                  changedIds[col].push(key);
                                }

                                store.put({
                                  id: key,
                                  value: blob[col][key]
                                });
                              }
                            });

                          case 7:
                          case "end":
                            return _context6.stop();
                        }
                      }
                    }, _callee6);
                  }));

                  return function (_x2) {
                    return _ref2.apply(this, arguments);
                  };
                }()));

              case 8:
                console.log('After merge, any changed?', anyChanged);

                if (!(etag != null)) {
                  _context7.next = 12;
                  break;
                }

                _context7.next = 12;
                return tx.objectStore('meta').put(etag, 'serverEtag');

              case 12:
                _context7.next = 14;
                return tx.objectStore('meta').get('dirty');

              case 14:
                dirty = _context7.sent;
                _context7.next = 17;
                return tx.done;

              case 17:
                if (anyChanged) {
                  _context7.next = 19;
                  break;
                }

                return _context7.abrupt("return", null);

              case 19:
                return _context7.abrupt("return", {
                  merged: {
                    blob: blob,
                    stamp: dirty
                  },
                  changedIds: changedIds
                });

              case 20:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7);
      }))();
    },
    applyDelta: function applyDelta(collection, id, delta, stamp, apply) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
        var tx, data, value, dirty;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return db;

              case 2:
                tx = _context8.sent.transaction([colName(collection), 'meta'], 'readwrite');
                _context8.next = 5;
                return tx.objectStore(colName(collection)).get(id);

              case 5:
                data = _context8.sent;
                value = apply(data ? data.value : null, delta);
                _context8.next = 9;
                return tx.objectStore('meta').get('dirty');

              case 9:
                dirty = _context8.sent;

                if (!(!dirty || dirty < stamp)) {
                  _context8.next = 13;
                  break;
                }

                _context8.next = 13;
                return tx.objectStore('meta').put(stamp, 'dirty');

              case 13:
                _context8.next = 15;
                return tx.objectStore(colName(collection)).put({
                  id: id,
                  value: value
                });

              case 15:
                return _context8.abrupt("return", value);

              case 16:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8);
      }))();
    },
    fullExport: function fullExport() {
      var _this = this;

      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
        var dump;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                dump = {};
                _context10.next = 3;
                return Promise.all(collections.map( /*#__PURE__*/function () {
                  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9(colid) {
                    return regeneratorRuntime.wrap(function _callee9$(_context9) {
                      while (1) {
                        switch (_context9.prev = _context9.next) {
                          case 0:
                            _context9.next = 2;
                            return _this.loadAll(colid);

                          case 2:
                            dump[colid] = _context9.sent;

                          case 3:
                          case "end":
                            return _context9.stop();
                        }
                      }
                    }, _callee9);
                  }));

                  return function (_x3) {
                    return _ref3.apply(this, arguments);
                  };
                }()));

              case 3:
                return _context10.abrupt("return", dump);

              case 4:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10);
      }))();
    }
  };
};

exports.makePersistence = makePersistence;
var _default = makePersistence;
exports["default"] = _default;