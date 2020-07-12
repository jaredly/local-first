"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.merge = void 0;

var _utils = require("./utils.js");

var _loc = require("./loc.js");

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _construct(Parent, args, Class) { if (isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

var Inconsistent = /*#__PURE__*/function (_Error) {
  _inherits(Inconsistent, _Error);

  function Inconsistent() {
    _classCallCheck(this, Inconsistent);

    return _possibleConstructorReturn(this, _getPrototypeOf(Inconsistent).apply(this, arguments));
  }

  return Inconsistent;
}( /*#__PURE__*/_wrapNativeSuper(Error));

var mergeTrees = function mergeTrees(one, two, key) {
  var oneNode = one[key];
  var twoNode = two[key];

  if (oneNode.content.type !== twoNode.content.type) {
    throw new Inconsistent("Content type for node ".concat(key));
  } // one: hellofol[m;ks]
  // two: hello[ ;folks]
  // so take the shorter of the two
  // then go to the .. children?
  // buuuut ok so the deal is:
  // go one by one ... by 'after'?
  // Ok so go through all nodes, make an 'after' map
  // then just start going through IDs
  // so we get to 'o', and we see the space
  // so we totally switch gears, right? except we need to
  // end up going back to the 'f' in case the other node doesn't
  // know about it yet.
  // Ok so the 'expensive' way is to split literally everything
  // up into characters {id, after, deleted, content}
  // and then make an after-map
  // and then go through building nodes up as we go through

};

var mergeNodes = function mergeNodes(one, two) {// ummmmmmm ok seems like this might be
  // dangerous right here. Like if nodes are split different,
  // it's possible I'd end up in a weird state??
  // id will be the same
  // parent - could be different due to merges
  // deleted - could be different
  // size - could be different due to new nodes
  // children - different due to new nodes, also maybe merges?
  // content - could be different due to splits / merges
  // formats - could also be different probably?
  // ummmmmm should I just go with 'make this expensive, I'll fix it later'?
  // ok how about a new plan, what if I do an O(1) walk ...
  // through both ... merging as I go along?
};

var addAtoms = function addAtoms(atoms, afters, node, after) {
  var _node$id = _slicedToArray(node.id, 2),
      id = _node$id[0],
      site = _node$id[1];

  if (node.content.type === 'text') {
    var text = node.content.text;

    for (var i = 0; i < text.length; i++) {
      var thisAfter = i === 0 ? after : [id + i - 1, site];

      var _key = (0, _utils.toKey)(thisAfter);

      var atomKey = (0, _utils.toKey)([id + i, site]);

      if (atoms[atomKey]) {
        if (node.deleted && !atoms[atomKey].deleted) {
          atoms[atomKey].deleted = true;
        }

        continue;
      }

      var atom = {
        id: [id + i, site],
        deleted: node.deleted,
        content: {
          type: 'text',
          text: text.charAt(i)
        }
      };
      atoms[atomKey] = atom;

      if (!afters[_key]) {
        afters[_key] = [atom];
      } else {
        afters[_key].push(atom);
      }
    }
  } else {
    var _key2 = (0, _utils.toKey)(after);

    var _atomKey = (0, _utils.toKey)(node.id);

    if (atoms[_atomKey]) {
      if (node.deleted && !atoms[_atomKey].deleted) {
        atoms[_atomKey].deleted = true;
      }

      return;
    }

    var _atom = {
      id: node.id,
      deleted: node.deleted,
      content: node.content
    };
    atoms[_atomKey] = _atom;

    if (!afters[_key2]) {
      afters[_key2] = [_atom];
    } else {
      afters[_key2].push(_atom);
    }
  }
};

var getAfter = function getAfter(node) {
  return (0, _loc.lastId)(node);
};

var collectNode = function collectNode(map, afters, atom, parent) {
  var node = {
    id: atom.id,
    parent: parent,
    size: atom.deleted ? 0 : (0, _utils.contentChars)(atom.content),
    children: [],
    content: atom.content,
    formats: {}
  };

  if (atom.deleted) {
    node.deleted = true;
  }

  if (atom.content.type === 'text') {
    var content = atom.content;

    for (var i = 0;; i++) {
      var _key3 = (0, _utils.toKey)([node.id[0] + i, node.id[1]]);

      if (afters[_key3] && afters[_key3].length === 1) {
        var child = afters[_key3][0];

        if (child.id[1] === node.id[1] && child.id[0] === node.id[0] + i + 1 && child.content.type === 'text' && child.deleted === node.deleted) {
          // mutation!! this is ok b/c atoms are single-use
          content.text += child.content.text;

          if (!node.deleted) {
            node.size += 1;
          }

          continue;
        }
      }

      break;
    }
  }

  node.children = collectNodes(map, afters, (0, _utils.toKey)(getAfter(node)), (0, _utils.toKey)(node.id));
  node.children.forEach(function (child) {
    node.size += map[child].size;
  });
  map[(0, _utils.toKey)(node.id)] = node;
};

var collectNodes = function collectNodes(map, afters, key, parent) {
  if (!afters[key]) {
    return [];
  }

  var atoms = afters[key].sort(function (a, b) {
    return -(0, _utils.keyCmp)(a.id, b.id);
  });
  var children = atoms.map(function (atom) {
    collectNode(map, afters, atom, parent);
    return (0, _utils.toKey)(atom.id);
  });
  return children;
};

var addFormats = function addFormats(state) {
  var format = {};
  (0, _loc.walk)(state, function (node) {
    if (node.content.type === 'open') {
      var content = node.content;
      var current = format[content.key] ? format[content.key].slice() : [];
      var idx = (0, _loc.fmtIdx)(current.map(function (id) {
        return state.map[id].content;
      }), content);
      current.splice(idx, 0, (0, _utils.toKey)(node.id));
      format = _objectSpread({}, format, _defineProperty({}, content.key, current));
    }

    if (node.content.type === 'close' && format[node.content.key]) {
      var _content = node.content;

      var _current = format[_content.key].filter(function (id) {
        return state.map[id].content.type !== 'text' && state.map[id].content.stamp !== _content.stamp;
      });

      if (!_current.length) {
        format = _objectSpread({}, format);
        delete format[_content.key];
      } else {
        format = _objectSpread({}, format, _defineProperty({}, _content.key, _current));
      }
    }

    node.formats = format;
  });
};

var merge = function merge(one, two) {
  var rootMap = {};
  one.roots.forEach(function (id) {
    return rootMap[id] = true;
  });
  two.roots.forEach(function (id) {
    return rootMap[id] = true;
  });

  var largestIDs = _objectSpread({}, one.largestIDs); // console.warn('Merge largestIDs', one.largestIDs, two.largestIDs);


  Object.keys(two.largestIDs).forEach(function (site) {
    largestIDs[site] = Math.max(largestIDs[site] || 0, two.largestIDs[site]);
  });
  var atoms = {};
  var afters = {};
  Object.keys(one.map).forEach(function (key) {
    var node = one.map[key];
    var after = node.parent === _loc.rootParent ? [0, _loc.rootSite] : getAfter(one.map[node.parent]);
    addAtoms(atoms, afters, node, after); // if (node.id[1] === site) {
    //     largestLocalId = Math.max(largestLocalId, lastId(node)[0]);
    // }
  });
  Object.keys(two.map).forEach(function (key) {
    var node = two.map[key];
    var after = node.parent === _loc.rootParent ? [0, _loc.rootSite] : getAfter(two.map[node.parent]);
    addAtoms(atoms, afters, node, after); // if (node.id[1] === site) {
    //     largestLocalId = Math.max(largestLocalId, lastId(node)[0]);
    // }
  });
  var map = {};
  var roots = collectNodes(map, afters, _loc.rootParent, _loc.rootParent); // console.log(map);

  var res = {
    largestIDs: largestIDs,
    roots: roots,
    map: map
  };
  addFormats(res);
  return res;
};

exports.merge = merge;