"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var sqlite3 = require('better-sqlite3');

function queryAll(db, sql) {
  var params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var stmt = db.prepare(sql); // console.log('query all', sql, params);

  return stmt.all.apply(stmt, _toConsumableArray(params));
}

function queryGet(db, sql) {
  var params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var stmt = db.prepare(sql);
  return stmt.get.apply(stmt, _toConsumableArray(params));
}

function queryRun(db, sql) {
  var params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var stmt = db.prepare(sql);
  return stmt.run.apply(stmt, _toConsumableArray(params));
}

var setupPersistence = function setupPersistence(baseDir) {
  var db = sqlite3(baseDir + '/data.db');
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

    if (queryAll(db, 'select name from sqlite_master where name = ?', [col + ':messages']).length === 0) {
      queryRun(db, "CREATE TABLE ".concat(escapedTableName(col // sessionId will be *null* is this is an amalgamated changeset and includes changes
      // from multiple sessions.
      ), " (id INTEGER PRIMARY KEY AUTOINCREMENT, changes TEXT NOT NULL, date INTEGER NOT NULL, sessionId TEXT)"), []);
    }

    dbs[col] = true;
    return;
  };

  return {
    compact: function compact(collection, date, merge) {
      setupDb(collection);
      var tx = db.transaction(function (collection, date) {
        var rows = queryAll(db, "SELECT id, sessionId, changes from ".concat(escapedTableName(collection), " where date < ?"), [date]);

        if (rows.length <= 1) {
          return;
        }

        var byNode = {};
        var session = rows[0].sessionId;
        var maxId = rows[0].id;
        rows.forEach(function (_ref) {
          var id = _ref.id,
              sessionId = _ref.sessionId,
              changes = _ref.changes;

          if (id > maxId) {
            maxId = id;
          }

          if (sessionId != session) {
            session = null;
          }

          var deltas = JSON.parse(changes);
          deltas.forEach(function (_ref2) {
            var node = _ref2.node,
                delta = _ref2.delta;

            if (!byNode[node]) {
              byNode[node] = delta;
            } else {
              byNode[node] = merge(byNode[node], delta);
            }
          });
        }); // delete the rows we got

        queryRun(db, "DELETE FROM ".concat(escapedTableName(collection), " where date < ?"), [date]);
        queryRun(db, "INSERT INTO ".concat(escapedTableName(collection), " (id, changes, date, sessionId) VALUES (@id, @changes, @date, @sessionId)"), [{
          id: maxId,
          changes: JSON.stringify(Object.keys(byNode).map(function (node) {
            return {
              node: node,
              delta: byNode[node]
            };
          })),
          date: date,
          sessionId: session
        }]);
      });
      tx(collection, date); // Vacuum just for fun, for benchmarks and stuff ya know.
      // queryRun(db, 'VACUUM into "smaller.db"');
    },
    addDeltas: function addDeltas(collection, sessionId, deltas) {
      setupDb(collection);
      var insert = db.prepare("INSERT INTO ".concat(escapedTableName(collection), " (changes, date, sessionId) VALUES (@changes, @date, @sessionId)"));
      insert.run({
        sessionId: sessionId,
        date: Date.now(),
        changes: JSON.stringify(deltas)
      });
    },
    deltasSince: function deltasSince(collection, lastSeen, sessionId) {
      setupDb(collection);
      var transaction = db.transaction(function (lastSeen, sessionId) {
        var _ref3;

        var rows = lastSeen ? queryAll(db, "SELECT changes from ".concat(escapedTableName(collection), " where id > ? and sessionId != ?"), [lastSeen, sessionId]) : queryAll(db, "SELECT changes from ".concat(escapedTableName(collection), " where sessionId != ?"), [sessionId]); // console.log('db', escapedTableName(collection));
        // console.log('getting deltas', rows, lastSeen, sessionId);

        var deltas = (_ref3 = []).concat.apply(_ref3, _toConsumableArray(rows.map(function (_ref4) {
          var changes = _ref4.changes;
          return JSON.parse(changes);
        })));

        var cursor = queryGet(db, "SELECT max(id) as maxId from ".concat(escapedTableName(collection)), []);

        if (!cursor) {
          return null;
        }

        return {
          deltas: deltas,
          cursor: cursor.maxId
        };
      }); // console.log('transacting');

      return transaction(lastSeen, sessionId);
    }
  };
};

var _default = setupPersistence;
exports["default"] = _default;