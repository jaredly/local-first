"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.recv = exports.inc = exports.cmp = exports.init = exports.unpack = exports.pack = void 0;

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toArray(arr) { return _arrayWithHoles(arr) || _iterableToArray(arr) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

/**
 * This implementation of the [Hybric Logical Clocks][1] paper was very much based
 * on [this go implementation][2] and [james long's demo][3]
 *
 * [1]: https://muratbuffalo.blogspot.com/2014/07/hybrid-logical-clocks.html
 * [2]: https://github.com/lafikl/hlc/blob/master/hlc.go
 * [3]: https://github.com/jlongster/crdt-example-app/blob/master/shared/timestamp.js
 */
var pack = function pack(_ref) {
  var ts = _ref.ts,
      count = _ref.count,
      node = _ref.node;
  // 13 digits is enough for the next 100 years, so 15 is plenty.
  // And 5 digits base 36 is enough for more than 6 million changes.
  return ts.toString().padStart(15, '0') + ':' + count.toString(36).padStart(5, '0') + ':' + node;
};

exports.pack = pack;

var unpack = function unpack(serialized) {
  var _serialized$split = serialized.split(':'),
      _serialized$split2 = _toArray(_serialized$split),
      ts = _serialized$split2[0],
      count = _serialized$split2[1],
      node = _serialized$split2.slice(2);

  return {
    ts: parseInt(ts),
    count: parseInt(count, 36),
    node: node.join(':')
  };
};

exports.unpack = unpack;

var init = function init(node, now) {
  return {
    ts: now,
    count: 0,
    node: node
  };
};

exports.init = init;

var cmp = function cmp(one, two) {
  if (one.ts == two.ts) {
    if (one.count === two.count) {
      if (one.node === two.node) {
        return 0;
      }

      return one.node < two.node ? -1 : 1;
    }

    return one.count - two.count;
  }

  return one.ts - two.ts;
};

exports.cmp = cmp;

var inc = function inc(local, now) {
  if (now > local.ts) {
    return {
      ts: now,
      count: 0,
      node: local.node
    };
  }

  return _objectSpread({}, local, {
    count: local.count + 1
  });
};

exports.inc = inc;

var recv = function recv(local, remote, now) {
  if (now > local.ts && now > remote.ts) {
    return _objectSpread({}, local, {
      ts: now,
      count: 0
    });
  }

  if (local.ts === remote.ts) {
    return _objectSpread({}, local, {
      count: Math.max(local.count, remote.count) + 1
    });
  } else if (local.ts > remote.ts) {
    return _objectSpread({}, local, {
      count: local.count + 1
    });
  } else {
    return _objectSpread({}, local, {
      ts: remote.ts,
      count: remote.count + 1
    });
  }
}; // This impl is closer to the article's algorithm, but I find it a little trickier to explain.
// export const recv = (time: HLC, remote: HLC, now: number): HLC => {
//     const node = time.node;
//     const ts = Math.max(time.ts, remote.ts, now);
//     if (ts == time.ts && ts == remote.ts) {
//         return { node, ts, count: Math.max(time.count, remote.count) + 1 };
//     }
//     if (ts == time.ts) {
//         return { node, ts, count: time.count + 1 };
//     }
//     if (ts == remote.ts) {
//         return { node, ts, count: remote.count + 1 };
//     }
//     return { node, ts, count: 0 };
// };


exports.recv = recv;
var maxPackableCount = parseInt('zzzzz', 36);

var validate = function validate(time, now) {
  var maxDrift = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 60 * 1000;

  if (time.count > maxPackableCount) {
    return 'counter-overflow';
  } // if a timestamp is more than 1 minute off from our local wall clock, something has gone horribly wrong.


  if (Math.abs(time.ts - now) > maxDrift) {
    return 'clock-off';
  }

  return null;
};