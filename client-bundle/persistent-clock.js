"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PersistentClock = exports.localStorageClockPersist = exports.inMemoryClockPersist = void 0;

var hlc = _interopRequireWildcard(require("../hybrid-logical-clock/src/index.js"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var inMemoryClockPersist = function inMemoryClockPersist() {
  var saved = null;
  return {
    get: function get(init) {
      if (!saved) {
        saved = init();
      }

      return saved;
    },
    set: function set(clock) {
      saved = clock;
    }
  };
};

exports.inMemoryClockPersist = inMemoryClockPersist;

var localStorageClockPersist = function localStorageClockPersist(key) {
  return {
    get: function get(init) {
      var raw = localStorage.getItem(key);

      if (!raw) {
        var res = init();
        localStorage.setItem(key, hlc.pack(res));
        return res;
      }

      return hlc.unpack(raw);
    },
    set: function set(clock) {
      localStorage.setItem(key, hlc.pack(clock));
    }
  };
};

exports.localStorageClockPersist = localStorageClockPersist;

var genId = function genId() {
  return Math.random().toString(36).slice(2);
};

var PersistentClock = /*#__PURE__*/function () {
  function PersistentClock(persist) {
    _classCallCheck(this, PersistentClock);

    this.persist = persist;
    this.now = persist.get(function () {
      return hlc.init(genId(), Date.now());
    }); // $FlowFixMe

    this.get = this.get.bind(this); // $FlowFixMe

    this.set = this.set.bind(this); // $FlowFixMe

    this.recv = this.recv.bind(this);
  }

  _createClass(PersistentClock, [{
    key: "get",
    value: function get() {
      this.now = hlc.inc(this.now, Date.now());
      this.persist.set(this.now);
      return hlc.pack(this.now);
    }
  }, {
    key: "set",
    value: function set(newClock) {
      this.now = newClock;
      this.persist.set(this.now);
    }
  }, {
    key: "recv",
    value: function recv(newClock) {
      this.now = hlc.recv(this.now, newClock, Date.now());
      this.persist.set(this.now);
    }
  }]);

  return PersistentClock;
}();

exports.PersistentClock = PersistentClock;