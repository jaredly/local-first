"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.deltas = exports.get = exports.invert = exports.restamp = exports.restampMeta = void 0;

var _utils = require("./utils.js");

var sortedArray = _interopRequireWildcard(require("./array-utils.js"));

var _create = require("./create.js");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var restampMeta = function restampMeta(meta, hlcStamp) {
  switch (meta.type) {
    case 'plain':
      return _objectSpread({}, meta, {
        hlcStamp: hlcStamp
      });

    case 'other':
      return _objectSpread({}, meta, {
        hlcStamp: hlcStamp
      });

    case 'map':
      return _objectSpread({}, meta, {
        hlcStamp: hlcStamp
      });

    case 't':
      return _objectSpread({}, meta, {
        hlcStamp: hlcStamp
      });

    case 'array':
      return _objectSpread({}, meta, {
        hlcStamp: hlcStamp
      });
  }

  return meta;
};

exports.restampMeta = restampMeta;

var restamp = function restamp(delta, newStamp) {
  if (delta.type === 'set') {
    return _objectSpread({}, delta, {
      value: _objectSpread({}, delta.value, {
        meta: restampMeta(delta.value.meta, newStamp)
      })
    });
  }

  return delta;
}; // Return something undoable!


exports.restamp = restamp;

var invert = function invert(crdt, delta, getStamp, invertOtherDelta) {
  // umm not sure how to get the stamp right
  // oh maybe I'll use a special sigil stamp "<latest>" or something
  // and then go through and replace
  if (delta.type === 'set') {
    var current = get(crdt, delta.path.map(function (k) {
      return k.key;
    }));

    if (current == null) {
      current = (0, _create.createEmpty)();
    } // $FlowFixMe


    return {
      type: 'set',
      path: delta.path,
      value: current
    };
  } else if (delta.type === 'insert') {
    var parentPath = delta.path.slice(0, -1);
    var id = delta.path[delta.path.length - 1].key;
    var parent = get(crdt, parentPath.map(function (k) {
      return k.key;
    }));

    if (!parent || parent.meta.type !== 'array') {
      throw new Error("Invalid insert operation");
    }

    if (parent.meta.items[id]) {
      // STOPSHIP the stamps might be wrong in the keypath!
      return {
        type: 'reorder',
        path: delta.path,
        sort: parent.meta.items[id].sort
      };
    } else {
      return {
        type: 'set',
        path: delta.path,
        value: (0, _create.createEmpty)()
      };
    }
  } else if (delta.type === 'reorder') {
    var _parentPath = delta.path.slice(0, -1);

    var _id = delta.path[delta.path.length - 1].key;

    var _parent = get(crdt, _parentPath.map(function (k) {
      return k.key;
    }));

    if (!_parent || _parent.meta.type !== 'array') {
      throw new Error("Invalid insert operation");
    }

    if (_parent.meta.items[_id]) {
      // STOPSHIP the stamps might be wrong in the keypath!
      return {
        type: 'reorder',
        path: delta.path,
        sort: _parent.meta.items[_id].sort
      };
    } else {
      throw new Error("Can't reorder something that's not there ".concat(_id));
    }
  } else if (delta.type === 'other') {
    var inverted = invertOtherDelta(delta.delta);

    if (inverted == null) {
      return null;
    }

    return {
      type: 'other',
      path: delta.path,
      delta: inverted,
      stamp: delta.stamp
    };
  }
};

exports.invert = invert;

var get = function get(crdt, path) {
  if (path.length === 0) {
    return crdt;
  }

  var key = path[0];

  if (crdt.meta.type === 'map') {
    return get( // $FlowFixMe
    {
      value: crdt.value[key],
      meta: crdt.meta.map[key]
    }, path.slice(1));
  }

  if (crdt.meta.type === 'array') {
    if (typeof key === 'string') {
      if (crdt.meta.items[key]) {
        return get({
          meta: crdt.meta.items[key].meta,
          // $FlowFixMe
          value: crdt.value[crdt.meta.idsInOrder.indexOf(key)]
        }, path.slice(1));
      }

      return null;
    }

    if (typeof key !== 'number') {
      throw new Error("Must use a numeric index");
    }

    return get({
      // $FlowFixMe
      value: crdt.value[key],
      meta: crdt.meta.items[crdt.meta.idsInOrder[key]].meta
    }, path.slice(1));
  }

  throw new Error("Can't get a sub item of a ".concat(crdt.meta.type));
};

exports.get = get;

var makeKeyPath = function makeKeyPath(current, path) {
  return path.map(function (item, i) {
    if (!current) {
      throw new Error("Invalid key path - doesn't represent the current state of things.");
    }

    var stamp = current.hlcStamp;

    if (current.type === 'array') {
      if (typeof item === 'number') {
        if (current.type !== 'array') {
          throw new Error("Cannot get a number ".concat(item, " of a ").concat(current.type));
        }

        var key = current.idsInOrder[item];

        if (!key) {
          throw new Error("Invalid index ".concat(item));
        }

        current = current.items[key].meta;
        return {
          stamp: stamp,
          key: key
        };
      } else {
        if (current.items[item]) {
          // throw new Error(`Invalid array id ${item}`);
          current = current.items[item].meta;
        } else {
          // $FlowFixMe
          current = null;
        }

        return {
          stamp: stamp,
          key: item
        };
      }
    } else if (current.type === 'map') {
      if (typeof item === 'number') {
        throw new Error("Cannot get a numeric index ".concat(item, " of a map"));
      }

      current = current.map[item];
      return {
        stamp: stamp,
        key: item
      };
    } else {
      throw new Error("Can't get a sub-item ".concat(item, " of a ").concat(current.type));
    }
  });
};

var deltas = {
  diff: function diff(one, two) {
    if (!one) {
      return {
        type: 'set',
        path: [],
        value: two
      };
    } // TODO something a little more intelligent probably?


    return {
      type: 'set',
      path: [],
      value: one
    };
  },
  stamp: function stamp(delta, otherStamp) {
    return delta.type === 'set' ? (0, _utils.latestStamp)(delta.value, otherStamp) : delta.type === 'other' ? delta.stamp : delta.sort.stamp;
  },
  other: function other(current, path, delta, stamp) {
    return {
      type: 'other',
      path: makeKeyPath(current.meta, path),
      delta: delta,
      stamp: stamp
    };
  },
  replace: function replace(value) {
    return {
      type: 'set',
      path: [],
      value: value
    };
  },
  set: function set(current, path, value) {
    return {
      type: 'set',
      path: makeKeyPath(current.meta, path),
      value: value
    };
  },
  insert: function insert(current, path, idx, id, value, stamp) {
    var array = get(current, path);

    if (!array || array.meta.type !== 'array') {
      throw new Error("Can only insert into an array, not a ".concat(array ? array.meta.type : 'null'));
    }

    var meta = array.meta;
    var sort = {
      stamp: stamp,
      idx: sortedArray.sortForInsertion(meta.idsInOrder, function (id) {
        return meta.items[id].sort.idx;
      }, idx)
    };
    return {
      type: 'insert',
      path: makeKeyPath(current.meta, path.concat([id])),
      sort: sort,
      value: value
    };
  },
  insertRelative: function insertRelative(current, path, id, relativeTo, before, value, stamp) {
    var array = get(current, path);

    if (!array || array.meta.type !== 'array') {
      throw new Error("Can only insert into an array, not a ".concat(array ? array.meta.type : 'null'));
    }

    var meta = array.meta;
    var relIdx = meta.idsInOrder.indexOf(relativeTo);

    if (relIdx === -1) {
      throw new Error("Relative ".concat(relativeTo, " not in children ").concat(meta.idsInOrder.join(', '), "}"));
    }

    var _ref = before ? [meta.idsInOrder[relIdx - 1], relativeTo] : [relativeTo, meta.idsInOrder[relIdx + 1]],
        _ref2 = _slicedToArray(_ref, 2),
        prev = _ref2[0],
        after = _ref2[1];

    var newSort = sortedArray.between(prev ? meta.items[prev].sort.idx : null, after ? meta.items[after].sort.idx : null);
    var sort = {
      stamp: stamp,
      idx: newSort
    };
    return {
      type: 'insert',
      path: makeKeyPath(current.meta, path.concat([id])),
      sort: sort,
      value: value
    };
  },
  reorderRelative: function reorderRelative(current, path, id, relativeTo, before, stamp) {
    var array = get(current, path);

    if (!array || array.meta.type !== 'array') {
      throw new Error("Can only insert into an array, not a ".concat(array ? array.meta.type : 'null'));
    }

    var meta = array.meta;
    var idx = meta.idsInOrder.indexOf(id);
    var without = meta.idsInOrder.slice();

    var _without$splice = without.splice(idx, 1),
        _without$splice2 = _slicedToArray(_without$splice, 1),
        _ = _without$splice2[0];

    var relIdx = without.indexOf(relativeTo);

    var _ref3 = before ? [without[relIdx - 1], relativeTo] : [relativeTo, without[relIdx + 1]],
        _ref4 = _slicedToArray(_ref3, 2),
        prev = _ref4[0],
        after = _ref4[1];

    var newSort = sortedArray.between(prev ? meta.items[prev].sort.idx : null, after ? meta.items[after].sort.idx : null);
    var sort = {
      stamp: stamp,
      idx: newSort
    }; // console.log('sorting to', idx, relIdx, sort, prev, after);
    // console.log(meta.idsInOrder);
    // console.log(id, relativeTo);
    // ooh ok so idx can be -1? That's not great.

    return {
      type: 'reorder',
      path: makeKeyPath(current.meta, path.concat([id])),
      sort: sort
    };
  },
  reorder: function reorder(current, path, idx, // newIdx is *after* the item has been removed.
  newIdx, stamp) {
    var array = get(current, path);

    if (!array || array.meta.type !== 'array') {
      throw new Error("Can only insert into an array, not a ".concat(array ? array.meta.type : 'null'));
    }

    var meta = array.meta;
    var without = meta.idsInOrder.slice();

    var _without$splice3 = without.splice(idx, 1),
        _without$splice4 = _slicedToArray(_without$splice3, 1),
        id = _without$splice4[0];

    var sort = {
      stamp: stamp,
      idx: sortedArray.sortForInsertion(without, function (id) {
        return meta.items[id].sort.idx;
      }, newIdx)
    }; // console.log(without, )

    return {
      type: 'reorder',
      path: makeKeyPath(current.meta, path.concat([id])),
      sort: sort
    };
  },
  remove: function remove(hlcStamp) {
    return {
      type: 'set',
      path: [],
      value: {
        value: null,
        meta: {
          type: 't',
          hlcStamp: hlcStamp
        }
      }
    };
  },
  removeAt: function removeAt(current, path, hlcStamp) {
    var value = {
      value: null,
      meta: {
        type: 't',
        hlcStamp: hlcStamp
      }
    };
    var keyPath = makeKeyPath(current.meta, path);
    return {
      type: 'set',
      path: keyPath,
      value: value
    };
  }
};
exports.deltas = deltas;