"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFormatValues = exports.keyEq = exports.keyCmp = exports.contentLength = exports.contentChars = exports.length = exports.fromKey = exports.toKey = exports.toString = exports.nodeToString = void 0;

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var nodeToString = function nodeToString(state, node) {
  return (node.deleted || node.content.type !== 'text' ? '' : node.content.text) + node.children.map(function (child) {
    return nodeToString(state, state.map[child]);
  }).join('');
};

exports.nodeToString = nodeToString;

var toString = function toString(crdt) {
  return crdt.roots.map(function (root) {
    return nodeToString(crdt, crdt.map[root]);
  }).join('');
};

exports.toString = toString;

var toKey = function toKey(_ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      id = _ref2[0],
      site = _ref2[1];

  return "".concat(id, ":").concat(site);
};

exports.toKey = toKey;

var fromKey = function fromKey(id) {
  var _id$split = id.split(':'),
      _id$split2 = _slicedToArray(_id$split, 2),
      a0 = _id$split2[0],
      a1 = _id$split2[1];

  return [+a0, a1];
};

exports.fromKey = fromKey;

var length = function length(state) {
  var res = 0;
  state.roots.forEach(function (r) {
    return res += state.map[r].size;
  });
  return res;
};

exports.length = length;

var contentChars = function contentChars(content) {
  switch (content.type) {
    case 'text':
      return content.text.length;

    default:
      return 0;
  }
};

exports.contentChars = contentChars;

var contentLength = function contentLength(content) {
  switch (content.type) {
    case 'text':
      return content.text.length;

    default:
      return 1;
  }
}; // export const strKeyCmp = (a: string, b: string): number => {
//     const [a0, a1] = a.split(':');
//     const [b0, b1] = b.split(':');
//     return keyCmp([+a0, a1], [+b0, b1]);
// };


exports.contentLength = contentLength;

var keyCmp = function keyCmp(_ref3, _ref4) {
  var _ref5 = _slicedToArray(_ref3, 2),
      a = _ref5[0],
      b = _ref5[1];

  var _ref6 = _slicedToArray(_ref4, 2),
      c = _ref6[0],
      d = _ref6[1];

  return a < c ? -1 : a > c ? 1 : b < d ? -1 : b > d ? 1 : 0;
};

exports.keyCmp = keyCmp;

var keyEq = function keyEq(_ref7, _ref8) {
  var _ref9 = _slicedToArray(_ref7, 2),
      a = _ref9[0],
      b = _ref9[1];

  var _ref10 = _slicedToArray(_ref8, 2),
      c = _ref10[0],
      d = _ref10[1];

  return a === c && b === d;
};

exports.keyEq = keyEq;

var getFormatValues = function getFormatValues(state, formats) {
  var res = {};
  Object.keys(formats).forEach(function (key) {
    if (formats[key].length) {
      var node = state.map[formats[key][0]];

      if (node.content.type !== 'open') {
        throw new Error("A formats list had a non-open node in it ".concat(toKey(node.id)));
      }

      res[key] = node.content.value;
    }
  });
  return res;
};

exports.getFormatValues = getFormatValues;