"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.checkFormats = exports.checkConsistency = void 0;

var _utils = require("./utils.js");

var _loc = require("./loc.js");

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var checkSize = function checkSize(state, id) {
  var node = state.map[id];
  var size = node.deleted ? 0 : (0, _utils.contentChars)(node.content);
  node.children.forEach(function (child) {
    checkSize(state, child);
    size += state.map[child].size;
  });

  if (size !== node.size) {
    throw new Error("Wrong cached size ".concat(node.size, " - should be ").concat(size, "; for ").concat(id));
  }
};

var checkConsistency = function checkConsistency(state) {
  state.roots.forEach(function (id) {
    return checkSize(state, id);
  });
  checkFormats(state);
};

exports.checkConsistency = checkConsistency;

var checkFormats = function checkFormats(state) {
  var format = {};
  (0, _loc.walk)(state, function (node) {
    if (node.content.type === 'open') {
      var content = node.content;

      if (!format[content.key]) {
        format[content.key] = [(0, _utils.toKey)(node.id)];
      } else {
        var idx = (0, _loc.fmtIdx)(format[content.key].map(function (id) {
          return state.map[id].content;
        }), content); // insert into sorted order.

        format[content.key].splice(idx, 0, (0, _utils.toKey)(node.id));
      }
    } else if (node.content.type === 'close') {
      var _content = node.content;
      var f = format[_content.key];

      if (!f) {
        console.log('nope at the close', _content);
        return;
      }

      var _idx = f.findIndex(function (item) {
        return state.map[item].content.type !== 'text' && state.map[item].content.stamp === _content.stamp;
      });

      if (_idx !== -1) {
        f.splice(_idx, 1);
      }

      if (!f.length) {
        delete format[_content.key];
      }
    }

    if (!(0, _fastDeepEqual["default"])(format, node.formats)) {
      throw new Error("Formats mismatch for ".concat((0, _utils.toKey)(node.id), ": expected: ").concat(JSON.stringify(format), "; actual: ").concat(JSON.stringify(node.formats)));
    }
  });
};

exports.checkFormats = checkFormats;