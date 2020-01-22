"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// POTENTIAL UNEXPECTED BEHAVIOR
// - a client is using a new schema w/ new attributes
// - they set a map
// - they "remove" the map
// - you then set a map without the new attributes
// - on merge, their earlier removal will win, because the merged map's stamp will be based on the added attribute that you don't have.
// This is used as a filler for when we need to create a
// "container" map that should never live on its own.
var MIN_STAMP = '';

var showDelta = function showDelta(delta) {
  switch (delta.type) {
    case 'set':
      return "<set> [".concat(delta.path.join(':'), "] ").concat(show(delta.value));
  }
};

var deltas = {
  set: function set(path, value) {
    return {
      type: 'set',
      path: path,
      value: value
    };
  },
  removeAt: function removeAt(path, hlcStamp) {
    return {
      type: 'set',
      path: path,
      value: create(null, hlcStamp)
    };
  }
};

var applyDelta = function applyDelta(crdt, delta) {
  switch (delta.type) {
    case 'set':
      return set(crdt, delta.path, delta.value);
  }

  throw new Error('unknown delta type' + JSON.stringify(delta));
};

var showMap = function showMap(map) {
  var res = [];
  Object.keys(map).forEach(function (k) {
    res.push("".concat(k, ": ").concat(show(map[k])));
  });
  return res;
};

var show = function show(crdt) {
  if (crdt.type === 'plain') {
    return crdt.hlcStamp + '-' + JSON.stringify(crdt.value) + (crdt.mapValues ? "{{".concat(showMap(crdt.mapValues).join(','), "}}") : '');
  } else {
    return "".concat(crdt.hlcStamp, "-{").concat(showMap(crdt.map).join(', '), "}");
  }
};

var value = function value(crdt) {
  if (crdt.type === 'plain') {
    return crdt.value;
  } else {
    var map = {};
    Object.keys(crdt.map).sort().forEach(function (k) {
      map[k] = value(crdt.map[k]);
    });
    return map;
  }
};

var remove = function remove(crdt, ts) {
  return create(null, ts);
};

var removeAt = function removeAt(map, key, hlcStamp) {
  return set(map, key, create(null, hlcStamp));
};

var maybeMerge = function maybeMerge(v, o) {
  return o ? merge(v, o) : v;
};

var set = function set(crdt, key, value) {
  if (crdt.type === 'map') {
    var k = key[0];
    var v = crdt.map[k];

    if (key.length === 1) {
      var _nv = maybeMerge(value, v);

      return _objectSpread({}, crdt, {
        map: _objectSpread({}, crdt.map, _defineProperty({}, k, _nv)),
        hlcStamp: _nv.hlcStamp < crdt.hlcStamp ? _nv.hlcStamp : crdt.hlcStamp
      });
    }

    if (!v) {
      // maybe here I make a `null` plain & set the attrs accordingly?
      throw new Error('setting a key that doesnt yet exist');
    }

    var nv = set(v, key.slice(1), value);
    return _objectSpread({}, crdt, {
      map: _objectSpread({}, crdt.map, _defineProperty({}, k, nv)),
      hlcStamp: nv.hlcStamp < crdt.hlcStamp ? nv.hlcStamp : crdt.hlcStamp
    });
  } else {
    if (value.type === 'plain') {
      if (value.hlcStamp > crdt.hlcStamp) {
        var mapValues = _objectSpread({}, crdt.mapValues);

        if (key.length === 1) {
          mapValues[key[0]] = maybeMerge(value, mapValues[key[0]]);
        } else {
          mapValues[key[0]] = maybeMerge(set({
            type: 'map',
            map: {},
            hlcStamp: MIN_STAMP
          }, key.slice(1), value), mapValues[key[0]]);
        }

        return _objectSpread({}, crdt, {
          mapValues: mapValues
        });
      }
    } else {
      var map = prune(value.map, crdt.hlcStamp);

      if (map) {
        var _mapValues = _objectSpread({}, crdt.mapValues);

        if (key.length === 1) {
          _mapValues[key[0]] = maybeMerge(_objectSpread({}, value, {
            map: map
          }), _mapValues[key[0]]);
        } else {
          _mapValues[key[0]] = maybeMerge(set({
            type: 'map',
            map: {},
            hlcStamp: MIN_STAMP
          }, key.slice(1), _objectSpread({}, value, {
            map: map
          })), _mapValues[key[0]]);
        }

        return _objectSpread({}, crdt, {
          mapValues: _mapValues
        });
      }
    }

    return crdt;
  }
};

var createDeepMap = function createDeepMap(value, hlcStamp) {
  var map = {};
  Object.keys(value).forEach(function (k) {
    if (value[k] && _typeof(value[k]) === 'object') {
      map[k] = createDeepMap(value[k], hlcStamp);
    } else {
      map[k] = create(value[k], hlcStamp);
    }
  });
  return {
    type: 'map',
    map: map,
    hlcStamp: hlcStamp
  };
};

var createMap = function createMap(value, hlcStamp) {
  var map = {};
  Object.keys(value).forEach(function (k) {
    map[k] = create(value[k], hlcStamp);
  });
  return {
    type: 'map',
    map: map,
    hlcStamp: hlcStamp
  };
};

var create = function create(value, hlcStamp) {
  return {
    type: 'plain',
    value: value,
    hlcStamp: hlcStamp
  };
};

var mergeMaps = function mergeMaps(one, two) {
  var _ref = one.hlcStamp > two.hlcStamp ? [one, two] : [two, one];

  var _ref2 = _slicedToArray(_ref, 2);

  one = _ref2[0];
  two = _ref2[1];
  var minStamp = one.hlcStamp;

  var map = _objectSpread({}, one.map);

  Object.keys(two.map).forEach(function (k) {
    map[k] = maybeMerge(two.map[k], map[k]);

    if (map[k].hlcStamp < minStamp) {
      minStamp = map[k].hlcStamp;
    }
  });
  return {
    type: 'map',
    map: map,
    hlcStamp: minStamp
  };
};

var mergePlainMaps = function mergePlainMaps(one, two) {
  var res = _objectSpread({}, one);

  Object.keys(two).forEach(function (k) {
    res[k] = maybeMerge(two[k], one[k]);
  });
  return res;
};

var prune = function prune(map, stamp) {
  var res = {};
  var present = false;
  Object.keys(map).forEach(function (k) {
    if (map[k].type === 'plain') {
      if (map[k].hlcStamp > stamp) {
        // TODO do we prune the mapValues of this plain?
        // maybe
        res[k] = map[k];
        present = true;
      } else if (map[k].mapValues) {
        var mv = prune(map[k].mapValues, stamp);

        if (mv) {
          res[k] = {
            type: 'map',
            hlcStamp: MIN_STAMP,
            map: mv
          };
          present = true;
        }
      }
    } else {
      var v = prune(map[k].map, stamp);

      if (v) {
        res[k] = _objectSpread({}, map[k], {
          map: v
        });
        present = true;
      }
    }
  });
  return present ? res : undefined;
};

var mergePlainAndMap = function mergePlainAndMap(map, plain) {
  if (map.hlcStamp > plain.hlcStamp) {
    if (plain.mapValues) {
      var res = mergePlainMaps(map.map, plain.mapValues);
      return _objectSpread({}, map, {
        map: res
      });
    } else {
      return map;
    }
  }

  var mapValues = prune(map.map, plain.hlcStamp);

  if (plain.mapValues) {
    mapValues = mapValues ? mergePlainMaps(mapValues, plain.mapValues) : plain.mapValues;
  }

  if (mapValues && Object.keys(mapValues).length === 0) {
    mapValues = undefined;
  }

  return _objectSpread({}, plain, {
    mapValues: mapValues
  });
};

var mergePlain = function mergePlain(one, two) {
  var _ref3 = one.hlcStamp > two.hlcStamp ? [one, two] : [two, one],
      _ref4 = _slicedToArray(_ref3, 2),
      neww = _ref4[0],
      old = _ref4[1];

  var mapValues = neww.mapValues;

  if (neww.mapValues && old.mapValues) {
    mapValues = mergePlainMaps(neww.mapValues, old.mapValues);
  } else if (old.mapValues) {
    mapValues = prune(old.mapValues, neww.hlcStamp);
  }

  return _objectSpread({}, neww, {
    mapValues: mapValues
  });
};

var merge = function merge(one, two) {
  if (one.type === 'map' && two.type === 'map') {
    return mergeMaps(one, two);
  }

  if (one.type === 'map' && two.type === 'plain') {
    return mergePlainAndMap(one, two);
  }

  if (two.type === 'map' && one.type === 'plain') {
    return mergePlainAndMap(two, one);
  } // $FlowFixMe I've exhausted the options folks.


  return mergePlain(one, two);
};

module.exports = {
  merge: merge,
  value: value,
  create: create,
  createDeepMap: createDeepMap,
  set: set,
  remove: remove,
  removeAt: removeAt,
  show: show,
  deltas: deltas,
  showDelta: showDelta,
  applyDelta: applyDelta
};