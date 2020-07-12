"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "validateDelta", {
  enumerable: true,
  get: function get() {
    return _schema.validateDelta;
  }
});
Object.defineProperty(exports, "validate", {
  enumerable: true,
  get: function get() {
    return _schema.validate;
  }
});
Object.defineProperty(exports, "subSchema", {
  enumerable: true,
  get: function get() {
    return _schema.subSchema;
  }
});
Object.defineProperty(exports, "createBlobClient", {
  enumerable: true,
  get: function get() {
    return _createClient["default"];
  }
});
Object.defineProperty(exports, "makeBlobPersistence", {
  enumerable: true,
  get: function get() {
    return _blob["default"];
  }
});
Object.defineProperty(exports, "createBasicBlobNetwork", {
  enumerable: true,
  get: function get() {
    return _basicNetwork["default"];
  }
});
Object.defineProperty(exports, "createDeltaClient", {
  enumerable: true,
  get: function get() {
    return _createClient2["default"];
  }
});
Object.defineProperty(exports, "makeDeltaPersistence", {
  enumerable: true,
  get: function get() {
    return _delta["default"];
  }
});
Object.defineProperty(exports, "createPollingNetwork", {
  enumerable: true,
  get: function get() {
    return _pollingNetwork["default"];
  }
});
Object.defineProperty(exports, "createWebSocketNetwork", {
  enumerable: true,
  get: function get() {
    return _websocketNetwork["default"];
  }
});
Object.defineProperty(exports, "SyncStatus", {
  enumerable: true,
  get: function get() {
    return _websocketNetwork.SyncStatus;
  }
});
Object.defineProperty(exports, "makeDeltaInMemoryPersistence", {
  enumerable: true,
  get: function get() {
    return _deltaMem["default"];
  }
});
Object.defineProperty(exports, "PersistentClock", {
  enumerable: true,
  get: function get() {
    return _persistentClock.PersistentClock;
  }
});
Object.defineProperty(exports, "localStorageClockPersist", {
  enumerable: true,
  get: function get() {
    return _persistentClock.localStorageClockPersist;
  }
});
Object.defineProperty(exports, "inMemoryClockPersist", {
  enumerable: true,
  get: function get() {
    return _persistentClock.inMemoryClockPersist;
  }
});
exports.rich = exports.crdt = exports.hlc = exports.createInMemoryDeltaClient = exports.createPersistedDeltaClient = exports.createPersistedBlobClient = exports.clientCrdtImpl = void 0;

var hlc = _interopRequireWildcard(require("../hybrid-logical-clock/src/index.js"));

exports.hlc = hlc;

var crdt = _interopRequireWildcard(require("../nested-object-crdt/src/new.js"));

exports.crdt = crdt;

var rich = _interopRequireWildcard(require("../rich-text-crdt/index.js"));

exports.rich = rich;

var _schema = require("../nested-object-crdt/src/schema.js");

var _createClient = _interopRequireDefault(require("../core/src/blob/create-client.js"));

var _blob = _interopRequireDefault(require("../idb/src/blob.js"));

var _basicNetwork = _interopRequireDefault(require("../core/src/blob/basic-network.js"));

var _createClient2 = _interopRequireDefault(require("../core/src/delta/create-client.js"));

var _delta = _interopRequireDefault(require("../idb/src/delta.js"));

var _pollingNetwork = _interopRequireDefault(require("../core/src/delta/polling-network.js"));

var _websocketNetwork = _interopRequireWildcard(require("../core/src/delta/websocket-network.js"));

var _deltaMem = _interopRequireDefault(require("../idb/src/delta-mem.js"));

var _persistentClock = require("../core/src/persistent-clock.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var otherMerge = function otherMerge(v1, m1, v2, m2) {
  return {
    value: rich.merge(v1, v2),
    meta: null
  };
};

var applyOtherDelta = function applyOtherDelta(text, meta, delta) {
  return {
    value: rich.apply(text, delta),
    meta: meta
  };
};

var invertOtherDelta = function invertOtherDelta(otherDelta) {
  console.log('cant invert rich text deltas yet');
  return null;
};

var clientCrdtImpl = {
  merge: function merge(one, two) {
    if (!one) return two;
    return crdt.mergeTwo(one, two, function (v1, _, v2, __) {
      return {
        value: rich.merge(v1, v2),
        meta: null
      };
    });
  },
  latestStamp: function latestStamp(data) {
    return crdt.latestStamp(data, function () {
      return null;
    });
  },
  value: function value(d) {
    return d.value;
  },
  get: crdt.get,
  createEmpty: function createEmpty(stamp) {
    return crdt.createEmpty(stamp);
  },
  deltas: _objectSpread({}, crdt.deltas, {
    invert: function invert(base, delta, getStamp) {
      return crdt.invert(base, delta, getStamp, invertOtherDelta);
    },
    stamp: function stamp(data) {
      return crdt.deltas.stamp(data, function () {
        return null;
      });
    },
    restamp: function restamp(delta, stamp) {
      return crdt.restamp(delta, stamp);
    },
    apply: function apply(base, delta) {
      return crdt.applyDelta(base, delta, applyOtherDelta, otherMerge);
    }
  }),
  createValue: function createValue(value, stamp, getStamp, schema) {
    return crdt.createWithSchema(value, stamp, getStamp, schema, function (value) {
      return null;
    });
  }
};
exports.clientCrdtImpl = clientCrdtImpl;

var nullNetwork = function nullNetwork(_, __, ___) {
  return {
    initial: {
      status: 'disconnected'
    },
    createSync: function createSync(_, __, ___) {
      return function () {};
    }
  };
};

var createPersistedBlobClient = function createPersistedBlobClient(name, schemas, url, version) {
  return (0, _createClient["default"])(name, clientCrdtImpl, schemas, new _persistentClock.PersistentClock((0, _persistentClock.localStorageClockPersist)(name)), (0, _blob["default"])(name, Object.keys(schemas), version), url != null ? (0, _basicNetwork["default"])(url) : nullNetwork);
};

exports.createPersistedBlobClient = createPersistedBlobClient;

var createPersistedDeltaClient = function createPersistedDeltaClient(name, schemas, url, version, indexes) {
  return (0, _createClient2["default"])(name, clientCrdtImpl, schemas, new _persistentClock.PersistentClock((0, _persistentClock.localStorageClockPersist)(name)), (0, _delta["default"])(name, Object.keys(schemas), version, indexes), url != null ? (0, _websocketNetwork["default"])(url) : nullNetwork);
};

exports.createPersistedDeltaClient = createPersistedDeltaClient;

var createInMemoryDeltaClient = function createInMemoryDeltaClient(schemas, url) {
  return (0, _createClient2["default"])('in-memory', clientCrdtImpl, schemas, new _persistentClock.PersistentClock((0, _persistentClock.inMemoryClockPersist)()), (0, _deltaMem["default"])(Object.keys(schemas)), (0, _websocketNetwork["default"])(url));
};

exports.createInMemoryDeltaClient = createInMemoryDeltaClient;