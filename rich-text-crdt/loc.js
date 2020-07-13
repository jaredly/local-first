"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.adjustSelection = exports.locToInsertionPos = exports.locToPos = exports.charactersBeforeNode = exports.nodeForKey = exports.posToLoc = exports.idAfter = exports.formatAt = exports.adjustForFormat = exports.posToPostLoc = exports.posToPreLoc = exports.nextSibling = exports.nextNode = exports.prevSibling = exports.lastChild = exports.fmtIdx = exports.walk = exports.walkFrom = exports.lastId = exports.rootParent = exports.rootSite = void 0;

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _utils = require("./utils.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var rootSite = '-root-';
exports.rootSite = rootSite;
var rootParent = '0:-root-';
exports.rootParent = rootParent;

var lastId = function lastId(node) {
  if (node.content.type === 'text') {
    return [node.id[0] + node.content.text.length - 1, node.id[1]];
  }

  return node.id;
}; // Ok I actually need a better plan
// char-space -> crdt-space
// and back.
// 'abc'
// we need to select an "anchoring"
// certainly the 'start' of a selection anchors right
// and the 'end' anchors left.
// dunno what a good default is for the cursor when
// not selecting, but that can be decided.

/*

| a | b | c | d | e |
0   1   2   3   4   5

yeah just 1 or 0 for the side, true or false.

0(left) is [0:root,1]
0(right) is [1:a, 0]
1(left) is [1:a, 1]
1(right) is [2:a, 0]

*/


exports.lastId = lastId;

var walkLoop = function walkLoop(state, id, fn) {
  var all = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var node = state.map[id];
  if (!node) return console.error("Missing node! ".concat(id));

  if (!node.deleted || all) {
    if (fn(node) === false) {
      return false;
    }
  }

  if (state.map[id].children.some(function (child) {
    return walkLoop(state, child, fn, all) === false;
  })) {
    return false;
  }
};

var walkFrom = function walkFrom(state, key, fn) {
  var all = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

  if (walkLoop(state, key, fn, all) === false) {
    return;
  }

  var walkUp = function walkUp(key) {
    if (key === rootParent) {
      return;
    }

    var node = state.map[key];
    var siblings = node.parent === rootParent ? state.roots : state.map[node.parent].children;
    var idx = siblings.indexOf(key);

    if (idx === -1) {
      throw new Error("".concat(key, " not found in children of ").concat(node.parent, " : ").concat(siblings.join(', ')));
    }

    for (var i = idx + 1; i < siblings.length; i++) {
      if (walkLoop(state, siblings[i], fn, all) === false) {
        return;
      }
    }

    return walkUp(node.parent);
  };

  walkUp(key);
};

exports.walkFrom = walkFrom;

var walk = function walk(state, fn) {
  var all = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  state.roots.some(function (id) {
    return walkLoop(state, id, fn, all) === false;
  });
};

exports.walk = walk;

var fmtIdx = function fmtIdx(fmt, content) {
  for (var i = 0; i < fmt.length; i++) {
    if (fmt[i].stamp < content.stamp) {
      return i;
    }
  }

  return fmt.length;
};

exports.fmtIdx = fmtIdx;

var lastChild = function lastChild(crdt, id) {
  var node = crdt.map[id];

  if (node.children.length) {
    return lastChild(crdt, node.children[node.children.length - 1]);
  } else {
    return id;
  }
};

exports.lastChild = lastChild;

var prevSibling = function prevSibling(crdt, node) {
  if (node.parent === rootParent) {
    var idx = crdt.roots.indexOf(node);

    if (idx === -1 || idx === 0) {
      return; // selection went too far
    }

    return lastChild(crdt, crdt.roots[idx - 1]);
  } else {
    var parent = crdt.map[node.parent];

    var _idx = parent.children.indexOf(node);

    if (_idx === -1) {
      throw new Error("Can't find node in parents");
    }

    if (_idx === 0) {
      return prevSibling(crdt, parent);
    }

    return parent.children[_idx + 1];
  }
};

exports.prevSibling = prevSibling;

var nextNode = function nextNode(crdt, node) {
  if (node.children.length) {
    return node.children[0];
  }

  return nextSibling(crdt, node);
}; // Get the next sibling or parent's next sibling


exports.nextNode = nextNode;

var nextSibling = function nextSibling(crdt, node) {
  // console.log('sib', node);
  if (node.parent === rootParent) {
    var idx = crdt.roots.indexOf(node);

    if (idx === -1 || idx + 1 >= crdt.roots.length) {
      // console.log('root out');
      return; // selection went too far
    }

    return crdt.roots[idx + 1];
  } else {
    var parent = crdt.map[node.parent];

    var _key = (0, _utils.toKey)(node.id);

    var _idx2 = parent.children.indexOf(_key);

    if (_idx2 === -1) {
      throw new Error("Can't find node ".concat(_key, " in parents ").concat(parent.children.join(';')));
    }

    if (_idx2 + 1 >= parent.children.length) {
      return nextSibling(crdt, parent);
    }

    return parent.children[_idx2 + 1];
  }
};

exports.nextSibling = nextSibling;

var posToPreLocForNode = function posToPreLocForNode(state, node, pos) {
  // Only text nodes should be pre-locs
  if (pos === 1 && !node.deleted && node.content.type === 'text') {
    return [node.id, 0];
  }

  if (pos > node.size) {
    throw new Error("pos ".concat(pos, " not in node ").concat((0, _utils.toKey)(node.id)));
  }

  if (!node.deleted && node.content.type === 'text') {
    if (pos <= node.content.text.length) {
      return [node.id, pos - 1];
    }

    pos -= node.content.text.length;
  }

  for (var i = 0; i < node.children.length; i++) {
    var child = state.map[node.children[i]];

    if (pos <= child.size) {
      return posToPreLocForNode(state, child, pos);
    }

    pos -= child.size;
  }

  throw new Error("Node size caches must have been miscalculated! Pos ".concat(pos, " not found in node ").concat((0, _utils.toKey)(node.id), ", even though node's size is ").concat(node.size));
}; // This represents the loc that is before the pos...


var posToPreLoc = function posToPreLoc(crdt, pos) {
  if (pos === 0) {
    return [[0, rootSite], 0];
  }

  for (var i = 0; i < crdt.roots.length; i++) {
    var root = crdt.map[crdt.roots[i]];

    if (pos <= root.size) {
      return posToPreLocForNode(crdt, root, pos);
    }

    pos -= root.size;
  }

  throw new Error("Pos ".concat(pos, " is outside the bounds"));
};

exports.posToPreLoc = posToPreLoc;

var posToPostLocForNode = function posToPostLocForNode(state, node, pos) {
  if (pos === 0 && !node.deleted) {
    return [node.id, 0];
  }

  if (pos >= node.size) {
    throw new Error("post pos ".concat(pos, " not in node ").concat((0, _utils.toKey)(node.id)));
  }

  if (!node.deleted && node.content.type === 'text') {
    if (pos < node.content.text.length) {
      return [node.id, pos]; // return [node.id[0] + pos, node.id[1]];
    }

    pos -= node.content.text.length;
  }

  for (var i = 0; i < node.children.length; i++) {
    var child = state.map[node.children[i]];

    if (pos < child.size) {
      return posToPostLocForNode(state, child, pos);
    }

    pos -= child.size;
  }

  throw new Error("Node size caches must have been miscalculated! Post pos ".concat(pos, " not found in node ").concat((0, _utils.toKey)(node.id), ", even though node's size is ").concat(node.size));
}; // this represents the loc that is after the pos


var posToPostLoc = function posToPostLoc(crdt, pos) {
  for (var i = 0; i < crdt.roots.length; i++) {
    var root = crdt.map[crdt.roots[i]];

    if (pos < root.size) {
      return posToPostLocForNode(crdt, root, pos);
    }

    pos -= root.size;
  }

  if (pos === 0) {
    return [[1, rootSite], 0];
  }

  throw new Error("Pos ".concat(pos, " is outside the bounds"));
};

exports.posToPostLoc = posToPostLoc;

var countDifferences = function countDifferences(one, two) {
  var differences = 0;
  Object.keys(one).forEach(function (key) {
    if (!(0, _fastDeepEqual["default"])(one[key], two[key])) {
      differences += 1;
    }
  });
  Object.keys(two).forEach(function (key) {
    if (!(key in one)) {
      differences += 1;
    }
  });
  return differences;
};

var adjustForFormat = function adjustForFormat(state, loc, format) {
  // if we're right next to some opens or closes, see
  // if any of the adjacent spots already have the desired
  // formatting.
  var node = nodeForKey(state, [loc.id, loc.site]);

  if (!node) {
    return loc;
  }

  if (node.content.type === 'text' && loc.id < node.id[0] + node.content.text.length - 1) {
    // we're in the middle of a text node
    return loc;
  } // console.log('adjusting, at the end I guess', loc, node.id);


  var nodeFormat = (0, _utils.getFormatValues)(state, node.formats);

  if ((0, _fastDeepEqual["default"])(format, nodeFormat)) {
    return loc;
  }

  if (loc.pre) {
    var options = [[countDifferences(format, nodeFormat), 0, loc, nodeFormat]];
    var orig = node;
    walkFrom(state, (0, _utils.toKey)(node.id), function (node) {
      if (node.id === orig.id) {
        return;
      }

      if (node.content.type === 'text') {
        return false;
      }

      var fmt = (0, _utils.getFormatValues)(state, node.formats);
      options.push([countDifferences(format, fmt), options.length, {
        id: node.id[0],
        site: node.id[1],
        pre: true
      }, fmt]);
    });
    options.sort(function (a, b) {
      return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
    }); // maybe I want a generator, so I can step through
    // the formatting nodes that face me?

    return options[0][2];
  } else {
    return loc; // TODO fix this
  } // do the nodes have formattings

};

exports.adjustForFormat = adjustForFormat;

var formatAt = function formatAt(crdt, pos) {
  try {
    var node = nodeForKey(crdt, pos); // console.log('format at', pos, node.formats)
    // const [id, offset] = posToPostLoc(crdt, pos);
    // const node = nodeForKey(crdt, id);

    var format = {};

    if (!node) {
      return format;
    }

    Object.keys(node.formats).forEach(function (key) {
      // hmm whats the point of doing it by ID? yeah there is one, its ok
      if (node.formats[key].length) {
        var fmtNode = crdt.map[node.formats[key][0]];

        if (fmtNode.content.type !== 'open') {
          throw new Error("non-open node (".concat(node.formats[key][0], ") found in a formats cache for ").concat((0, _utils.toKey)(node.id)));
        }

        format[key] = fmtNode.content.value;
      }
    });
    return format;
  } catch (_unused) {
    return {};
  }
};

exports.formatAt = formatAt;

var idAfter = function idAfter(crdt, loc) {
  if (!loc.pre) {
    return loc.id;
  }

  if ((0, _utils.keyEq)([loc.id, loc.site], [0, rootSite])) {
    var _key2 = crdt.roots[0];

    if (_key2) {
      return crdt.map[_key2].id[0];
    }

    return 0;
  }

  var node = nodeForKey(crdt, [loc.id, loc.site]);

  if (node && node.id[0] + (0, _utils.contentLength)(node.content) - 1 == loc.id) {
    if (node.children.length) {
      return crdt.map[node.children[0]].id[0];
    }

    var next = nextSibling(crdt, node);

    if (next != null) {
      return crdt.map[next].id[0];
    }
  }

  return 0;
};

exports.idAfter = idAfter;

var posToLoc = function posToLoc(crdt, pos, // if true, loc is the char to the left of the pos (the "pre-loc")
// if false, loc is the char to the right of the pos (the "post-loc")
anchorToLocAtLeft) {
  var total = (0, _utils.length)(crdt);

  if (pos > total) {
    debugger;
    throw new Error("Loc ".concat(pos, " is outside of the bounds ").concat(total));
  }

  var _ref = anchorToLocAtLeft ? posToPreLoc(crdt, pos) : posToPostLoc(crdt, pos),
      _ref2 = _slicedToArray(_ref, 2),
      _ref2$ = _slicedToArray(_ref2[0], 2),
      id = _ref2$[0],
      site = _ref2$[1],
      offset = _ref2[1];

  return {
    id: id + offset,
    site: site,
    pre: anchorToLocAtLeft
  };
};

exports.posToLoc = posToLoc;

var nodeForKey = function nodeForKey(crdt, key) {
  for (var i = key[0]; i >= 0; i--) {
    var k = (0, _utils.toKey)([i, key[1]]);

    if (crdt.map[k]) {
      return crdt.map[k];
    }
  }
};

exports.nodeForKey = nodeForKey;

var charactersBeforeNode = function charactersBeforeNode(crdt, node) {
  var total = 0;

  while (node) {
    var siblings = node.parent === rootParent ? crdt.roots : crdt.map[node.parent].children;
    var idx = siblings.indexOf((0, _utils.toKey)(node.id));

    if (idx === -1) {
      throw new Error("node not found in parents children ".concat((0, _utils.toKey)(node.id), " ").concat(node.parent, " - ").concat(siblings.join(';')));
    }

    for (var i = 0; i < idx; i++) {
      total += crdt.map[siblings[i]].size;
    }

    if (node.parent === rootParent) {
      break;
    } else {
      node = crdt.map[node.parent];

      if (!node.deleted && node.content.type === 'text') {
        total += node.content.text.length;
      }
    }
  }

  return total;
};

exports.charactersBeforeNode = charactersBeforeNode;

var locToPos = function locToPos(crdt, loc) {
  if (loc.site === rootSite) {
    return loc.id === 0 ? 0 : (0, _utils.length)(crdt);
  } // step 1: find the node this loc is within


  var node = nodeForKey(crdt, [loc.id, loc.site]);

  if (!node) {
    throw new Error("Loc does not exist in tree ".concat(JSON.stringify(loc)));
  } // step 2: find the position-in-text for this node


  var nodePos = charactersBeforeNode(crdt, node);

  if (node.deleted) {
    return nodePos;
  } // step 3: adjust for an internal ID


  var offset = loc.id - node.id[0]; // step 4: if it's pre (and we're a text node) add 1

  return nodePos + offset + (loc.pre && node.content.type === 'text' ? 1 : 0);
};

exports.locToPos = locToPos;

var locToInsertionPos = function locToInsertionPos(crdt, after, id) {
  if (after[1] === rootSite) {
    var idx = crdt.roots.length;
    var pos = 0;

    for (var i = 0; i < crdt.roots.length; i++) {
      if ((0, _utils.keyCmp)((0, _utils.fromKey)(crdt.roots[i]), id) < 1) {
        idx = i;
        break;
      }

      pos += crdt.map[crdt.roots[i]].size;
    }

    return pos;
  } // step 1: find the parent node


  var node = nodeForKey(crdt, after);

  if (!node) {
    throw new Error("Loc does not exist in tree ".concat(JSON.stringify(after)));
  } // step 2: find the position-in-text for this node


  var nodePos = charactersBeforeNode(crdt, node); // We're at the end, in competition with other children

  if (node.id[0] + (0, _utils.contentLength)(node.content) === after[0] + 1) {
    nodePos += (0, _utils.contentChars)(node.content);
    var _idx3 = node.children.length;

    for (var _i2 = 0; _i2 < node.children.length; _i2++) {
      if ((0, _utils.keyCmp)((0, _utils.fromKey)(node.children[_i2]), id) < 1) {
        _idx3 = _i2;
        break;
      }

      nodePos += crdt.map[node.children[_i2]].size;
    } // console.log('at the end', node.content, node.id, after);


    return nodePos; // - 1;
  } else {
    // console.log('ok', after, node.id, node.content.type, nodePos);
    // no one here but us
    var offset = after[0] - node.id[0];
    return nodePos + offset + 1; // TODO??? (node.content.type === 'text' ? 1 : 0);
  }
};

exports.locToInsertionPos = locToInsertionPos;

var adjustSelection = function adjustSelection(prev, current, start, end) {
  var startLoc = posToLoc(prev, start, false);
  var endLoc = posToLoc(prev, end, true); // console.log('locs', startLoc, endLoc);

  var newStart = locToPos(current, startLoc);
  var newEnd = locToPos(current, endLoc);
  return {
    start: newStart,
    end: newEnd
  };
};

exports.adjustSelection = adjustSelection;