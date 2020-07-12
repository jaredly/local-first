"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.spansToSelections = exports.selectionToSpans = void 0;

var _loc = require("./loc.js");

var _utils = require("./utils.js");

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var selectionToSpans = function selectionToSpans(state, start, end) {
  var _posToPostLoc = (0, _loc.posToPostLoc)(state, start),
      _posToPostLoc2 = _slicedToArray(_posToPostLoc, 2),
      loc = _posToPostLoc2[0],
      offset = _posToPostLoc2[1];

  var spans = [];
  var count = end - start;
  (0, _loc.walkFrom)(state, (0, _utils.toKey)(loc), function (node) {
    if (node.content.type !== 'text' || node.deleted) {
      return;
    }

    var text = node.content.text;

    if (offset >= text.length) {
      offset -= text.length;
      return;
    }

    if (offset + count <= text.length) {
      spans.push({
        id: node.id[0] + offset,
        site: node.id[1],
        length: count
      });
      return false;
    } else {
      spans.push({
        id: node.id[0] + offset,
        site: node.id[1],
        length: text.length - offset
      });
      count = count - (text.length - offset);
      offset = 0;
    }
  });
  return spans;
};

exports.selectionToSpans = selectionToSpans;

var collectSelections = function collectSelections(crdt, span, selections) {
  var node = (0, _loc.nodeForKey)(crdt, [span.id, span.site]);

  if (!node) {
    throw new Error("Cannot find node for span ".concat(JSON.stringify(span)));
  }

  var offset = span.id - node.id[0];
  var start = (0, _loc.charactersBeforeNode)(crdt, node) + offset; // it all fits within this node

  if (node.content.type !== 'text') {
    // throw new Error(`Cannot `)
    console.error('span is not a text node!', node.content, span);
    return;
  }

  var text = node.content.text;

  if (text.length - offset >= span.length) {
    selections.push({
      start: start,
      end: start + span.length
    });
  } else {
    // Go to the end of this node, and then
    // request the node that represents the next part of
    // the span
    var amount = text.length - offset;

    if (amount > 0) {
      selections.push({
        start: start,
        end: start + amount
      });
    }

    collectSelections(crdt, {
      id: span.id + amount,
      site: span.site,
      length: span.length - amount
    }, selections);
  }
};

var mergeSelections = function mergeSelections(selections) {
  if (!selections.length) {
    return [];
  }

  var result = [selections[0]];

  for (var i = 1; i < selections.length; i++) {
    if (result[result.length - 1].end === selections[i].start) {
      result[result.length - 1].end = selections[i].end;
    } else {
      result.push(selections[i]);
    }
  }

  return result;
};

var spansToSelections = function spansToSelections(crdt, spans) {
  var selections = [];
  spans.forEach(function (span) {
    return collectSelections(crdt, span, selections);
  }); // TODO merge selections

  return mergeSelections(selections);
};

exports.spansToSelections = spansToSelections;