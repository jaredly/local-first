"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// import type { Delta, CRDT as Data } from '../../nested-object-crdt/src';
var FakeDb = /*#__PURE__*/function () {
  function FakeDb() {
    _classCallCheck(this, FakeDb);

    this.collections = {};
  }

  _createClass(FakeDb, [{
    key: "createTable",
    value: function createTable(colid) {
      this.collections[colid] = [];
    }
  }, {
    key: "transaction",
    value: function transaction(fn) {
      return function () {
        return fn.apply(void 0, arguments);
      };
    }
  }, {
    key: "getAllSince",
    value: function getAllSince(colid, sessionId, minId) {
      console.log("[db] Getting all ".concat(colid, " for ").concat(sessionId, " since ").concat(minId != null ? minId : 'no-min'));
      console.log("Total: ".concat(this.collections[colid].length));
      var res = this.collections[colid].filter(function (item, i) {
        if (minId != null && minId >= i) {
          return;
        }

        if (item.sessionId === sessionId) {
          return;
        }

        return true;
      });
      console.log("Matched: ".concat(res.length));
      return res;
    }
  }, {
    key: "maxId",
    value: function maxId(colid) {
      return !this.collections[colid].length ? -1 : this.collections[colid].length - 1;
    }
  }, {
    key: "insert",
    value: function insert(colid, data) {
      this.collections[colid].push(data);
    }
  }]);

  return FakeDb;
}();

var setupPersistence = function setupPersistence() {
  var db = new FakeDb();
  var dbs = {};

  var tableName = function tableName(col) {
    return col + ':messages';
  };

  var escapedTableName = function escapedTableName(col) {
    return JSON.stringify(tableName(col));
  };

  var setupDb = function setupDb(col) {
    if (dbs[col]) {
      return;
    }

    db.createTable(col);
    dbs[col] = true;
    return;
  };

  return {
    compact: function compact() {
      throw new Error('NOpe');
    },
    addDeltas: function addDeltas(collection, sessionId, deltas) {
      setupDb(collection);
      db.insert(collection, {
        sessionId: sessionId,
        date: Date.now(),
        changes: JSON.stringify(deltas)
      });
    },
    deltasSince: function deltasSince(collection, lastSeen, sessionId) {
      setupDb(collection);
      var transaction = db.transaction(function (lastSeen, sessionId) {
        var _ref;

        var rows = db.getAllSince(collection, sessionId, lastSeen);

        var deltas = (_ref = []).concat.apply(_ref, _toConsumableArray(rows.map(function (_ref2) {
          var changes = _ref2.changes;
          return JSON.parse(changes);
        })));

        var cursor = db.maxId(collection);

        if (cursor == -1) {
          if (rows.length) {
            throw new Error("No maxId, but deltas returned! ".concat(rows.length));
          }

          return null;
        }

        return {
          deltas: deltas,
          cursor: cursor
        };
      }); // $FlowFixMe

      return transaction(lastSeen, sessionId);
    }
  };
};

var _default = setupPersistence;
exports["default"] = _default;