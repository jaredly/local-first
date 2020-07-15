"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.merge = exports.mergeTwo = exports.mergeArrays = exports.mergeMaps = exports.set = exports.otherDelta = exports.reorder = exports.insert = exports.removeAt = exports.remove = exports.applyDelta = void 0;

var sortedArray = _interopRequireWildcard(require("./array-utils.js"));

var _deltas = require("./deltas.js");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var applyDelta = function applyDelta(crdt, delta, applyOtherDelta, mergeOther) {
  if (!crdt) {
    if (delta.type !== 'set' || delta.path.length) {
      throw new Error("Only a 'replace' delta can be applied to an empty base");
    } // $FlowFixMe


    return delta.value;
  }

  switch (delta.type) {
    case 'set':
      return set(crdt, delta.path, delta.value, mergeOther);

    case 'insert':
      return insert(crdt, delta.path, delta.sort, delta.value, mergeOther);

    case 'reorder':
      return reorder(crdt, delta.path, delta.sort);

    case 'other':
      return otherDelta(crdt, delta.path, delta.delta, applyOtherDelta);
  }

  throw new Error('unknown delta type' + JSON.stringify(delta));
};

exports.applyDelta = applyDelta;

var remove = function remove(crdt, ts) {
  return {
    value: null,
    meta: {
      type: 't',
      hlcStamp: ts
    }
  };
};

exports.remove = remove;

var removeAt = function removeAt(map, path, hlcStamp, mergeOther) {
  return set(map, path, {
    value: null,
    meta: {
      type: 't',
      hlcStamp: hlcStamp
    }
  }, mergeOther);
};

exports.removeAt = removeAt;

var insertIntoArray = function insertIntoArray(array, meta, id, sort, value, mergeOther) {
  if (value.meta.type === 't') {
    throw new Error("Cannot insert a tombstone into an array");
  }

  if (meta.items[id] != null && meta.items[id].meta.type !== 't') {
    var prev = meta.items[id];
    var merged = merge( // $FlowFixMe
    prev.meta.type !== 't' ? array[meta.idsInOrder.indexOf(id)] : null, prev.meta, value.value, value.meta, mergeOther); // ok change the value

    var _idx = meta.idsInOrder.indexOf(id);

    var _newValue = array.slice();

    _newValue[_idx] = merged.value;
    var mergedSort = prev.sort.stamp > sort.stamp ? prev.sort : sort;
    var cmp = sortedArray.compare(prev.sort.idx, sort.idx);

    if (cmp === 0) {
      return {
        meta: _objectSpread({}, meta, {
          items: _objectSpread({}, meta.items, _defineProperty({}, id, {
            meta: merged.meta,
            sort: mergedSort
          }))
        }),
        value: _newValue
      };
    } // but what if we change the position?


    _newValue.splice(_idx, 1);

    var idsInOrder = meta.idsInOrder.slice();
    idsInOrder.splice(_idx, 1);
    var newIdx = sortedArray.insertionIndex(idsInOrder, function (id) {
      return meta.items[id].sort.idx;
    }, mergedSort.idx, id);

    var _ids = meta.idsInOrder.slice();

    _newValue.splice(newIdx, 0, value.value);

    _ids.splice(newIdx, 0, id);

    var _newMeta = _objectSpread({}, meta, {
      items: _objectSpread({}, meta.items, _defineProperty({}, id, {
        meta: value.meta,
        sort: sort
      })),
      idsInOrder: _ids
    });

    return {
      meta: _newMeta,
      value: _newValue
    };
  }

  var newValue = array.slice();
  var idx = sortedArray.insertionIndex(meta.idsInOrder, function (id) {
    return meta.items[id].sort.idx;
  }, sort.idx, id);
  var ids = meta.idsInOrder.slice();
  newValue.splice(idx, 0, value.value);
  ids.splice(idx, 0, id);

  var newMeta = _objectSpread({}, meta, {
    items: _objectSpread({}, meta.items, _defineProperty({}, id, {
      meta: value.meta,
      sort: sort
    })),
    idsInOrder: ids
  });

  return {
    meta: newMeta,
    value: newValue
  };
};

var reorderArray = function reorderArray(array, meta, id, sort) {
  var newValue = array.slice();
  var idx = meta.idsInOrder.indexOf(id);

  if (sort.stamp <= meta.items[id].sort.stamp) {
    return {
      value: array,
      meta: meta
    };
  }

  var idsInOrder = meta.idsInOrder.slice(); // if not there, it's a tombstoned item, don't need to modify stuff

  if (idx !== -1) {
    var _newValue$splice = newValue.splice(idx, 1),
        _newValue$splice2 = _slicedToArray(_newValue$splice, 1),
        curValue = _newValue$splice2[0];

    idsInOrder.splice(idx, 1);
    var newIdx = sortedArray.insertionIndex(idsInOrder, function (id) {
      return meta.items[id].sort.idx;
    }, sort.idx, id);
    newValue.splice(newIdx, 0, curValue);
    idsInOrder.splice(newIdx, 0, id);
  }

  var items = _objectSpread({}, meta.items, _defineProperty({}, id, _objectSpread({}, meta.items[id], {
    sort: sort
  })));

  var newMeta = _objectSpread({}, meta, {
    items: items,
    idsInOrder: idsInOrder
  });

  return {
    meta: newMeta,
    value: newValue
  };
};

var insert = function insert(crdt, key, sort, value, otherMerge) {
  return applyInner(crdt, key, function (inner, id) {
    if (!inner) {
      throw new Error("No array at path");
    }

    if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
      console.log(inner);
      throw new Error("Cannot insert into a ".concat(inner.meta.type));
    }

    return insertIntoArray(inner.value, inner.meta, id, sort, value, otherMerge);
  });
};

exports.insert = insert;

var reorder = function reorder(crdt, path, sort) {
  return applyInner(crdt, path, function (inner, id) {
    if (!inner) {
      throw new Error("No array at path");
    }

    if (inner.meta.type !== 'array' || !Array.isArray(inner.value)) {
      throw new Error("Cannot insert ".concat(id, " into a ").concat(inner.meta.type));
    }

    return reorderArray(inner.value, inner.meta, id, sort);
  });
};

exports.reorder = reorder;

var otherDelta = function otherDelta(crdt, path, delta, applyOtherDelta) {
  return applyInner(crdt, path, function (inner, id) {
    if (inner.meta.type === 'map') {
      var meta = inner.meta,
          value = inner.value;

      if (meta.map[id].type !== 'other') {
        throw new Error("Expected 'other', found ".concat(meta.map[id].type));
      }

      var merged = applyOtherDelta( // $FlowFixMe
      inner.value[id], meta.map[id].meta, delta);
      return {
        value: _objectSpread({}, value, _defineProperty({}, id, merged.value)),
        meta: _objectSpread({}, meta, {
          map: _objectSpread({}, meta.map, _defineProperty({}, id, _objectSpread({}, meta.map[id], {
            meta: merged.meta
          })))
        })
      };
    } else if (inner.meta.type === 'array') {
      var _meta = inner.meta;

      var idx = _meta.idsInOrder.indexOf(id);

      var _merged = applyOtherDelta(inner.value[idx], // $FlowFixMe
      _meta.items[id].meta, delta);

      var _value = inner.value.slice();

      _value[idx] = _merged.value;
      return {
        value: _value,
        meta: _objectSpread({}, _meta, {
          items: _objectSpread({}, _meta.items, _defineProperty({}, id, _objectSpread({}, _meta.items[id], {
            meta: _merged.meta
          })))
        })
      };
    } // const value = get(inner, [id]);


    throw new Error("Cannot set inside of a ".concat(inner.meta.type));
  });
};

exports.otherDelta = otherDelta;

var mapSet = function mapSet(inner, meta, key, value, mergeOther) {
  var res = meta.map[key] ? merge(inner[key], meta.map[key], value.value, value.meta, mergeOther) : value;

  var newv = _objectSpread({}, inner);

  if (res.meta.type === 't') {
    delete newv[key];
  } else {
    newv[key] = res.value;
  }

  return {
    value: newv,
    meta: _objectSpread({}, meta, {
      map: _objectSpread({}, meta.map, _defineProperty({}, key, res.meta))
    })
  };
};

var arraySet = function arraySet(array, meta, key, value, mergeOther) {
  var idx = meta.idsInOrder.indexOf(key);
  var merged = merge( // if it's not in there, we're dealing with a tombstone
  idx === -1 ? null : array[idx], meta.items[key].meta, value.value, value.meta, mergeOther);
  var res = array.slice();
  var idsInOrder = meta.idsInOrder;

  if (merged.meta.type === 't' && meta.items[key].meta.type !== 't') {
    // console.log('removing', merged);
    res.splice(idx, 1);
    idsInOrder = idsInOrder.slice();
    idsInOrder.splice(idx, 1);
  } else if (meta.items[key].meta.type === 't' && merged.meta.type !== 't') {
    console.log('adding back in');

    var _idx2 = sortedArray.insertionIndex(idsInOrder, function (id) {
      return meta.items[id].sort.idx;
    }, meta.items[key].sort.idx, key);

    res.splice(_idx2, 0, merged.value);
    idsInOrder = idsInOrder.slice();
    idsInOrder.splice(_idx2, 0, key);
  } else {
    console.log('updating');
    res[idx] = merged.value;
  }

  return {
    value: res,
    meta: _objectSpread({}, meta, {
      idsInOrder: idsInOrder,
      items: _objectSpread({}, meta.items, _defineProperty({}, key, {
        meta: merged.meta,
        sort: meta.items[key].sort
      }))
    })
  };
};

var set = function set(crdt, path, value, mergeOther) {
  if (!path.length) {
    // $FlowFixMe
    return merge(crdt.value, crdt.meta, // $FlowFixMe
    value.value, value.meta, mergeOther);
  }

  return applyInner(crdt, path, function (inner, key) {
    if (!inner) {
      // $FlowFixMe
      return value;
    }

    if (inner.meta.type === 'map') {
      if (!inner.value || _typeof(inner.value) !== 'object' || Array.isArray(inner.value)) {
        throw new Error("Invalid value, doesn't match meta type 'map'");
      }

      return mapSet(inner.value, inner.meta, key, value, mergeOther);
    } else if (inner.meta.type === 'array') {
      if (!Array.isArray(inner.value)) {
        throw new Error("Not an array");
      } // $FlowFixMe


      return arraySet(inner.value, inner.meta, key, value, mergeOther);
    } else {
      throw new Error("Cannot 'set' into a ".concat(inner.meta.type));
    }
  });
};

exports.set = set;

var applyInner = function applyInner(crdt, key, fn) {
  if (!crdt) {
    throw new Error('No crdt ' + JSON.stringify(key));
  } // console.log('inner', crdt.meta.hlcStamp, key);


  if (crdt.meta.hlcStamp > key[0].stamp) {
    return crdt;
  } // This delta is too old; the map was created more recently and so this change doesn't apply


  if (crdt.meta.hlcStamp < key[0].stamp) {
    throw new Error("Invalid delta, cannot apply - ".concat(crdt.meta.type, " stamp (").concat(crdt.meta.hlcStamp, ") is older than key path stamp (").concat(key[0].stamp, ")"));
  }

  if (key.length === 1) {
    // $FlowFixMe
    return fn(crdt, key[0].key);
  }

  if (crdt.meta.type === 'map') {
    var cmeta = crdt.meta;
    var k = key[0].key;

    if (crdt.value == null || _typeof(crdt.value) !== 'object' || Array.isArray(crdt.value)) {
      throw new Error("Invalid CRDT! Meta is misaligned with the value");
    }

    var v = crdt.value[k];
    var meta = crdt.meta.map[k];
    var res = applyInner({
      meta: meta,
      value: v
    }, key.slice(1), fn);
    return {
      value: _objectSpread({}, crdt.value, _defineProperty({}, k, res.value)),
      meta: _objectSpread({}, cmeta, {
        map: _objectSpread({}, cmeta.map, _defineProperty({}, k, res.meta))
      })
    };
  } else if (crdt.meta.type === 'array') {
    var _cmeta = crdt.meta;
    var _k = key[0].key;
    var _meta2 = crdt.meta.items[_k].meta;
    var idx = crdt.meta.idsInOrder.indexOf(_k);

    if (crdt.value == null || !Array.isArray(crdt.value)) {
      throw new Error("Invalid CRDT! Meta is misaligned with the value");
    }

    var arr = crdt.value.slice();
    var _v = arr[idx];

    var _res = applyInner({
      meta: _meta2,
      value: _v
    }, key.slice(1), fn);

    arr[idx] = _res.value;
    return {
      value: arr,
      meta: _objectSpread({}, _cmeta, {
        items: _objectSpread({}, _cmeta.items, _defineProperty({}, _k, _objectSpread({}, _cmeta.items[_k], {
          meta: _res.meta
        })))
      })
    };
  }

  throw new Error("Cannot set inside of a ".concat(crdt.meta.type));
};

var mergeMaps = function mergeMaps(v1, m1, v2, m2, mergeOther) {
  var value = _objectSpread({}, v1);

  var meta = _objectSpread({}, m1, {
    map: _objectSpread({}, m1.map)
  });

  Object.keys(v2).forEach(function (k) {
    if (meta.map[k]) {
      var res = merge(value[k], meta.map[k], v2[k], m2.map[k], mergeOther);
      value[k] = res.value;
      meta.map[k] = res.meta;
    } else {
      value[k] = v2[k];
      meta.map[k] = m2.map[k];
    }
  });
  return {
    value: value,
    meta: meta
  };
};

exports.mergeMaps = mergeMaps;

var mergeArrays = function mergeArrays(v1, m1, v2, m2, mergeOther) {
  var fullMap = {};
  m1.idsInOrder.forEach(function (id, i) {
    fullMap[id] = {
      value: v1[i],
      meta: m1.items[id]
    };
  }); // STOPSHIP account for tombstones!!!

  m2.idsInOrder.forEach(function (id, i) {
    if (fullMap[id]) {
      var res = merge(fullMap[id].value, fullMap[id].meta.meta, v2[i], m2.items[id].meta, mergeOther);
      var sort = fullMap[id].meta.sort.stamp > m2.items[id].sort.stamp ? fullMap[id].meta.sort : m2.items[id].sort;
      fullMap[id] = {
        value: res.value,
        meta: {
          meta: res.meta,
          sort: sort
        }
      };
    } else {
      fullMap[id] = {
        value: v2[i],
        meta: m2.items[id]
      };
    }
  });
  var allIds = Object.keys(fullMap); // console.log(
  //     allIds,
  //     v1,
  //     v2,
  //     m1.idsInOrder,
  //     m2.idsInOrder,
  //     m2.idsInOrder === m1.idsInOrder,
  // );

  allIds.sort(function (a, b) {
    return sortedArray.compare(fullMap[a].meta.sort.idx, fullMap[b].meta.sort.idx);
  });
  var items = {};
  allIds.forEach(function (id) {
    items[id] = fullMap[id].meta;
  });
  return {
    value: allIds.map(function (id) {
      return fullMap[id].value;
    }),
    meta: _objectSpread({}, m1, {
      idsInOrder: allIds,
      items: items
    })
  };
};

exports.mergeArrays = mergeArrays;

var mergeTwo = function mergeTwo(one, two, mergeOther) {
  return merge(one.value, one.meta, two.value, two.meta, mergeOther);
};

exports.mergeTwo = mergeTwo;

var merge = function merge(v1, m1, v2, m2, mergeOther) {
  if (m1.hlcStamp > m2.hlcStamp) {
    return {
      value: v1,
      meta: m1
    };
  }

  if (m1.hlcStamp < m2.hlcStamp) {
    return {
      value: v2,
      meta: m2
    };
  }

  if (m1.type !== m2.type) {
    if (m1.hlcStamp === m2.hlcStamp) {
      throw new Error("Stamps are the same, but types are different ".concat(m1.hlcStamp, " : ").concat(m1.type, " vs ").concat(m2.hlcStamp, " : ").concat(m2.type));
    }
  }

  if (m1.type === 'map' && m2.type === 'map') {
    // $FlowFixMe
    var _mergeMaps = mergeMaps(v1, m1, v2, m2, mergeOther),
        value = _mergeMaps.value,
        meta = _mergeMaps.meta;

    return {
      value: value,
      meta: meta
    };
  }

  if (m1.type === 'array' && m2.type === 'array') {
    if (!Array.isArray(v1) || !Array.isArray(v2)) {
      throw new Error("Meta type is array, but values are not");
    } // $FlowFixMe


    var _mergeArrays = mergeArrays(v1, m1, v2, m2, mergeOther),
        _value2 = _mergeArrays.value,
        _meta3 = _mergeArrays.meta;

    return {
      value: _value2,
      meta: _meta3
    };
  }

  if (m1.type === 'plain' && m2.type === 'plain') {
    // TODO maybe inlude a debug assert that v1 and v2 are equal?
    return {
      value: v1,
      meta: m1
    };
  }

  if (m1.type === 'other' && m2.type === 'other') {
    var _mergeOther = mergeOther(v1, m1.meta, v2, m2.meta),
        _value3 = _mergeOther.value,
        _meta4 = _mergeOther.meta;

    return {
      value: _value3,
      meta: _objectSpread({}, m1, {
        meta: _meta4
      })
    };
  }

  if (m1.type === 't' && m2.type === 't') {
    return {
      value: v1,
      meta: m1
    };
  }

  throw new Error("Unexpected types ".concat(m1.type, " : ").concat(m2.type));
};

exports.merge = merge;