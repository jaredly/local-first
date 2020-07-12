"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.onCrossTabChanges = exports.getCollection = exports.newCollection = exports.fullExport = void 0;

var _schema = require("../../nested-object-crdt/src/schema.js");

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var fullExport = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(persistence) {
    var dump;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            dump = {};
            _context2.next = 3;
            return Promise.all(persistence.collections.map( /*#__PURE__*/function () {
              var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(colid) {
                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        _context.next = 2;
                        return persistence.loadAll(colid);

                      case 2:
                        dump[colid] = _context.sent;

                      case 3:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              }));

              return function (_x2) {
                return _ref2.apply(this, arguments);
              };
            }()));

          case 3:
            return _context2.abrupt("return", dump);

          case 4:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));

  return function fullExport(_x) {
    return _ref.apply(this, arguments);
  };
}();

exports.fullExport = fullExport;

var newCollection = function newCollection() {
  return {
    cache: {},
    listeners: [],
    itemListeners: {}
  };
};

exports.newCollection = newCollection;

var send = function send(state, id, value) {
  state.listeners.forEach(function (fn) {
    return fn([{
      id: id,
      value: value
    }]);
  });

  if (state.itemListeners[id]) {
    state.itemListeners[id].forEach(function (fn) {
      return fn(value);
    });
  }
}; // This is the full version, non-patch I think?
// Ok I believe this also works with the patch version.


var getCollection = function getCollection(colid, crdt, persistence, state, getStamp, setDirty, sendCrossTabChanges, schema, undoManager) {
  var applyDelta = /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(id, delta, sendNew, skipUndo) {
      var plain, inverted, full, newPlain;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              plain = null;

              if (undoManager && !skipUndo) {
                inverted = state.cache[id] == null ? crdt.deltas.replace(crdt.createEmpty(getStamp())) : crdt.deltas.invert(state.cache[id], delta, getStamp);

                if (inverted != null) {
                  undoManager.add(function () {
                    // console.log('undoing', inverted);
                    applyDelta(id, crdt.deltas.restamp(inverted, getStamp()), false, true);
                  });
                } else {
                  console.log("Unable to invert delta: undo will be skipped");
                }
              }

              if (state.cache[id] != null || sendNew) {
                state.cache[id] = crdt.deltas.apply(state.cache[id], delta);
                plain = crdt.value(state.cache[id]);
                send(state, id, plain);
              }

              _context3.next = 5;
              return persistence.applyDelta(colid, id, delta, crdt.deltas.stamp(delta), crdt.deltas.apply);

            case 5:
              full = _context3.sent;
              state.cache[id] = full;
              newPlain = crdt.value(full);

              if (!(0, _fastDeepEqual["default"])(plain, newPlain)) {
                send(state, id, newPlain);
              }

              sendCrossTabChanges({
                col: colid,
                nodes: [id]
              });
              setDirty();

            case 11:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3);
    }));

    return function applyDelta(_x3, _x4, _x5, _x6) {
      return _ref3.apply(this, arguments);
    };
  }();

  return {
    // Updaters
    save: function save(id, node) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4() {
        var delta;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                (0, _schema.validate)(node, schema); // NOTE this overwrites everything, setAttribute will do much better merges

                delta = crdt.deltas.replace(crdt.createValue(node, getStamp(), getStamp, schema));
                applyDelta(id, delta, true);

              case 3:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }))();
    },
    applyRichTextDelta: function applyRichTextDelta(id, path, delta) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5() {
        var sub, stored, hostDelta;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                sub = (0, _schema.subSchema)(schema, path);

                if (!(sub !== 'rich-text')) {
                  _context5.next = 3;
                  break;
                }

                throw new Error("Schema at path is not a rich-text");

              case 3:
                if (!(state.cache[id] == null)) {
                  _context5.next = 10;
                  break;
                }

                _context5.next = 6;
                return persistence.load(colid, id);

              case 6:
                stored = _context5.sent;

                if (stored) {
                  _context5.next = 9;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 9:
                state.cache[id] = stored;

              case 10:
                hostDelta = crdt.deltas.other(state.cache[id], path, delta, getStamp());
                return _context5.abrupt("return", applyDelta(id, hostDelta));

              case 12:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }))();
    },
    clearAttribute: function clearAttribute(id, path) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6() {
        var sub, stored, delta;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                sub = (0, _schema.subSchema)(schema, path);

                if (!(state.cache[id] == null)) {
                  _context6.next = 8;
                  break;
                }

                _context6.next = 4;
                return persistence.load(colid, id);

              case 4:
                stored = _context6.sent;

                if (stored) {
                  _context6.next = 7;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 7:
                state.cache[id] = stored;

              case 8:
                delta = crdt.deltas.set(state.cache[id], path, crdt.createEmpty(getStamp()));
                return _context6.abrupt("return", applyDelta(id, delta));

              case 10:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6);
      }))();
    },
    removeId: function removeId(id, path, childId) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee7() {
        var sub, stored, stamp, delta;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                sub = (0, _schema.subSchema)(schema, path);

                if (!(state.cache[id] == null)) {
                  _context7.next = 8;
                  break;
                }

                _context7.next = 4;
                return persistence.load(colid, id);

              case 4:
                stored = _context7.sent;

                if (stored) {
                  _context7.next = 7;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 7:
                state.cache[id] = stored;

              case 8:
                stamp = getStamp();
                delta = crdt.deltas.set(state.cache[id], path.concat([childId]), crdt.createEmpty(getStamp()));
                return _context7.abrupt("return", applyDelta(id, delta));

              case 11:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7);
      }))();
    },
    reorderIdRelative: function reorderIdRelative(id, path, childId, relativeTo, before) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee8() {
        var sub, stored, stamp, delta;
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                sub = (0, _schema.subSchema)(schema, path);

                if (!(state.cache[id] == null)) {
                  _context8.next = 8;
                  break;
                }

                _context8.next = 4;
                return persistence.load(colid, id);

              case 4:
                stored = _context8.sent;

                if (stored) {
                  _context8.next = 7;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 7:
                state.cache[id] = stored;

              case 8:
                stamp = getStamp();
                delta = crdt.deltas.reorderRelative(state.cache[id], path, childId, relativeTo, before, stamp);
                return _context8.abrupt("return", applyDelta(id, delta));

              case 11:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8);
      }))();
    },
    insertIdRelative: function insertIdRelative(id, path, childId, relativeTo, before) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee9() {
        var stored, stamp, delta;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (!(state.cache[id] == null)) {
                  _context9.next = 7;
                  break;
                }

                _context9.next = 3;
                return persistence.load(colid, id);

              case 3:
                stored = _context9.sent;

                if (stored) {
                  _context9.next = 6;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 6:
                state.cache[id] = stored;

              case 7:
                stamp = getStamp();
                delta = crdt.deltas.insertRelative(state.cache[id], path, childId, relativeTo, before, crdt.createValue(childId, stamp, getStamp, 'string'), stamp);
                return _context9.abrupt("return", applyDelta(id, delta));

              case 10:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9);
      }))();
    },
    insertId: function insertId(id, path, idx, childId) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee10() {
        var stored, stamp, delta;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                if (!(state.cache[id] == null)) {
                  _context10.next = 7;
                  break;
                }

                _context10.next = 3;
                return persistence.load(colid, id);

              case 3:
                stored = _context10.sent;

                if (stored) {
                  _context10.next = 6;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 6:
                state.cache[id] = stored;

              case 7:
                stamp = getStamp();
                delta = crdt.deltas.insert(state.cache[id], path, idx, childId, crdt.createValue(childId, stamp, getStamp, 'string'), stamp);
                return _context10.abrupt("return", applyDelta(id, delta));

              case 10:
              case "end":
                return _context10.stop();
            }
          }
        }, _callee10);
      }))();
    },
    setAttribute: function setAttribute(id, path, value) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee11() {
        var sub, stored, delta;
        return regeneratorRuntime.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                sub = (0, _schema.subSchema)(schema, path);
                (0, _schema.validate)(value, sub);

                if (!(state.cache[id] == null)) {
                  _context11.next = 9;
                  break;
                }

                _context11.next = 5;
                return persistence.load(colid, id);

              case 5:
                stored = _context11.sent;

                if (stored) {
                  _context11.next = 8;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 8:
                state.cache[id] = stored;

              case 9:
                delta = crdt.deltas.set(state.cache[id], path, crdt.createValue(value, getStamp(), getStamp, sub));
                return _context11.abrupt("return", applyDelta(id, delta));

              case 11:
              case "end":
                return _context11.stop();
            }
          }
        }, _callee11);
      }))();
    },
    "delete": function _delete(id) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee12() {
        var stamp, stored, inverted, delta;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                stamp = getStamp();

                if (!undoManager) {
                  _context12.next = 11;
                  break;
                }

                if (!(state.cache[id] == null)) {
                  _context12.next = 9;
                  break;
                }

                _context12.next = 5;
                return persistence.load(colid, id);

              case 5:
                stored = _context12.sent;

                if (stored) {
                  _context12.next = 8;
                  break;
                }

                throw new Error("Cannot set attribute, node with id ".concat(id, " doesn't exist"));

              case 8:
                state.cache[id] = stored;

              case 9:
                inverted = crdt.deltas.invert(state.cache[id], crdt.deltas.remove(stamp), getStamp);

                if (inverted != null) {
                  undoManager.add(function () {
                    applyDelta(id, crdt.deltas.restamp(inverted, getStamp()), false, true);
                  });
                } else {
                  console.log("Unable to invert delta: undo will be skipped");
                }

              case 11:
                delete state.cache[id];
                send(state, id, null);
                delta = crdt.deltas.remove(stamp);
                _context12.next = 16;
                return persistence.applyDelta(colid, id, delta, stamp, crdt.deltas.apply);

              case 16:
                sendCrossTabChanges({
                  col: colid,
                  nodes: [id]
                });
                setDirty();

              case 18:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12);
      }))();
    },
    // Getters
    genId: getStamp,
    getCached: function getCached(id) {
      return state.cache[id] != null ? crdt.value(state.cache[id]) : null;
    },
    load: function load(id) {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee13() {
        var v;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                _context13.next = 2;
                return persistence.load(colid, id);

              case 2:
                v = _context13.sent;

                if (v) {
                  _context13.next = 5;
                  break;
                }

                return _context13.abrupt("return", null);

              case 5:
                state.cache[id] = v;
                return _context13.abrupt("return", crdt.value(v));

              case 7:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13);
      }))();
    },
    loadAll: function loadAll() {
      return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee14() {
        var all, res;
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return persistence.loadAll(colid);

              case 2:
                all = _context14.sent;
                res = {}; // Why isn't this being loaded correctly?

                Object.keys(all).forEach(function (id) {
                  state.cache[id] = all[id];
                  var v = crdt.value(all[id]); // STOPSHIP there should be a `crdt.isEmpty` or something
                  // to allow true null values if we want them

                  if (v != null) {
                    res[id] = v;
                  }
                });
                return _context14.abrupt("return", res);

              case 6:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14);
      }))();
    },
    onChanges: function onChanges(fn) {
      state.listeners.push(fn);
      return function () {
        state.listeners = state.listeners.filter(function (f) {
          return f !== fn;
        });
      };
    },
    onItemChange: function onItemChange(id, fn) {
      if (!state.itemListeners[id]) {
        state.itemListeners[id] = [fn];
      } else {
        state.itemListeners[id].push(fn);
      }

      return function () {
        if (!state.itemListeners[id]) {
          return;
        }

        state.itemListeners[id] = state.itemListeners[id].filter(function (f) {
          return f !== fn;
        });
      };
    }
  };
};

exports.getCollection = getCollection;

var onCrossTabChanges = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee16(crdt, persistence, state, colid, nodes) {
    var values;
    return regeneratorRuntime.wrap(function _callee16$(_context16) {
      while (1) {
        switch (_context16.prev = _context16.next) {
          case 0:
            values = {};
            _context16.next = 3;
            return Promise.all(nodes.map( /*#__PURE__*/function () {
              var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee15(id) {
                var v;
                return regeneratorRuntime.wrap(function _callee15$(_context15) {
                  while (1) {
                    switch (_context15.prev = _context15.next) {
                      case 0:
                        _context15.next = 2;
                        return persistence.load(colid, id);

                      case 2:
                        v = _context15.sent;

                        if (v) {
                          state.cache[id] = v;
                          values[id] = crdt.value(v);
                        } else {
                          delete state.cache[id];
                        }

                      case 4:
                      case "end":
                        return _context15.stop();
                    }
                  }
                }, _callee15);
              }));

              return function (_x12) {
                return _ref5.apply(this, arguments);
              };
            }()));

          case 3:
            state.listeners.forEach(function (fn) {
              return fn(nodes.map(function (id) {
                return {
                  id: id,
                  value: values[id]
                };
              }));
            });
            nodes.forEach(function (id) {
              if (state.itemListeners[id]) {
                state.itemListeners[id].forEach(function (fn) {
                  return fn(values[id]);
                });
              }
            });

          case 5:
          case "end":
            return _context16.stop();
        }
      }
    }, _callee16);
  }));

  return function onCrossTabChanges(_x7, _x8, _x9, _x10, _x11) {
    return _ref4.apply(this, arguments);
  };
}();

exports.onCrossTabChanges = onCrossTabChanges;