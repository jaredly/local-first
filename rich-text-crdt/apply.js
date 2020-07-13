"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.apply = void 0;

var _utils = require("./utils.js");

var _loc = require("./loc.js");

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _check = require("./check.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var insertionPos = function insertionPos(ids, id) {
  for (var i = 0; i < ids.length; i++) {
    if ((0, _utils.keyCmp)((0, _utils.fromKey)(ids[i]), id) < 1) {
      return i;
    }
  }

  return ids.length;
};

var mkNode = function mkNode(id, parent, content) {
  var formats = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  return {
    id: id,
    parent: parent,
    size: (0, _utils.contentChars)(content),
    content: content,
    formats: formats,
    children: []
  };
}; // mutates the toplevel map, but not the nodes


var split = function split(state, key, splitPoint) {
  var node = state.map[key];

  if (node.content.type !== 'text') {
    throw new Error("Cannot split a ".concat(node.content.type, " node"));
  }

  var text = node.content.text;
  var newNode = {
    id: [node.id[0] + splitPoint, node.id[1]],
    parent: (0, _utils.toKey)(node.id),
    size: node.deleted ? node.size : node.size - splitPoint,
    content: {
      type: 'text',
      text: text.slice(splitPoint)
    },
    formats: node.formats,
    children: node.children
  };

  if (node.deleted) {
    newNode.deleted = true;
  }

  var newKey = (0, _utils.toKey)(newNode.id);
  state.map[newKey] = newNode;
  state.map[key] = _objectSpread({}, node, {
    content: {
      type: 'text',
      text: text.slice(0, splitPoint)
    },
    children: [newKey]
  });
  newNode.children.forEach(function (child) {
    state.map[child] = _objectSpread({}, state.map[child], {
      parent: newKey
    });
  });
};

var splitAtKey = function splitAtKey(state, key) {
  for (var i = key[0]; i >= 0; i--) {
    var pkey = (0, _utils.toKey)([i, key[1]]);

    if (state.map[pkey]) {
      var delta = key[0] - i;

      if (state.map[pkey].content.type !== 'text' || state.map[pkey].content.text.length < delta) {
        return false;
      }

      split(state, pkey, delta);
      return true;
    }
  }

  return false;
};

var ensureNodeAt = function ensureNodeAt(state, id) {
  var key = (0, _utils.toKey)(id);

  if (!state.map[key]) {
    return splitAtKey(state, id);
  }

  return true;
};

var parentForAfter = function parentForAfter(state, after) {
  for (var i = after[0]; i >= 0; i--) {
    var key = (0, _utils.toKey)([i, after[1]]);

    if (!state.map[key]) {
      continue;
    }

    var node = state.map[key];

    if (node.content.type === 'text' && node.content.text.length - 1 !== after[0] - node.id[0]) {
      // node needs to be split
      // node's ID will still be the right one, though.
      split(state, key, after[0] - node.id[0] + 1);
    }

    return (0, _utils.toKey)(node.id);
  }
};

var insertId = function insertId(ids, id, idx) {
  return [].concat(_toConsumableArray(ids.slice(0, idx)), [id], _toConsumableArray(ids.slice(idx)));
};

var insertNode = function insertNode(state, id, after, content) {
  var afterKey = (0, _utils.toKey)(after);

  if (state.largestIDs[id[1]] != null && id[0] <= state.largestIDs[id[1]]) {
    // const key = toKey(id);
    // if (state.map[key]) {
    //     const node = state.map[key];
    //     const currentAfter =
    //         node.parent === rootParent
    //             ? [0, rootSite]
    //             : lastId(state.map[node.parent]);
    //     if (!keyEq(currentAfter, after)) {
    //         throw new Error(
    //             `Inserting a node that was already inserted, with a different 'after'`,
    //         );
    //     }
    //     if (node.content.type !== content.type) {
    //         throw new Error(
    //             `Inserting a node that was already inserted, with a different content type`,
    //         );
    //     }
    //     if (node.content.type === 'text' && content.type === 'text') {
    //         const currentText = node.content.text;
    //         const newText = content.text;
    //         if (newText.length < currentText.length) {
    //             if (!currentText.startsWith(newText)) {
    //                 throw new Error(`Text mismatch of re-inserted node`);
    //             }
    //         } else if (!newText.startsWith(currentText)) {
    //             throw new Error(`Text mismatch of re-inserted node`);
    //         }
    //     } else if (!deepEqual(node.content, content)) {
    //         throw new Error(
    //             `Reinserting a format node, and the content differs`,
    //         );
    //     }
    // }
    // STOPSHIP TODO establish consistency here
    // console.log('skipping dup');
    return;
  } // console.warn('Setting new largestID for', id[1]);


  state.largestIDs = _objectSpread({}, state.largestIDs, _defineProperty({}, id[1], Math.max(state.largestIDs[id[1]] || 0, content.type === 'text' ? id[0] + content.text.length - 1 : id[0])));

  if (afterKey === _loc.rootParent) {
    var _idx = insertionPos(state.roots, id);

    var _currentFormats = _idx === 0 ? {} : state.map[(0, _loc.lastChild)(state, state.roots[_idx - 1])].formats;

    var _key = (0, _utils.toKey)(id);

    state.roots = insertId(state.roots, _key, _idx);

    var _node = mkNode(id, afterKey, content, _currentFormats);

    state.map[_key] = _node;
    return;
  }

  var parentKey = parentForAfter(state, after);

  if (parentKey == null) {
    throw new Error("Cannot find parent for ".concat((0, _utils.toKey)(after)));
  }

  var parent = state.map[parentKey];

  if (parent.content.type === 'text' && content.type === 'text' && parent.id[1] === id[1] && parent.id[0] + parent.content.text.length === id[0] && !parent.deleted && (parent.children.length === 0 || state.map[parent.children[0]].id[0] < id[0])) {
    var _size = content.text.length;
    state.map[parentKey] = _objectSpread({}, parent, {
      content: {
        type: 'text',
        text: parent.content.text + content.text
      },
      size: parent.size + _size
    });
    var cp = parent.parent;

    while (cp !== _loc.rootParent) {
      var _node2 = state.map[cp];
      state.map[cp] = _objectSpread({}, _node2, {
        size: _node2.size + _size
      });
      cp = _node2.parent;
    }

    return;
  }

  var idx = insertionPos(parent.children, id);
  var currentFormats = idx === 0 ? parent.formats : state.map[(0, _loc.lastChild)(state, parent.children[idx - 1])].formats;
  var node = mkNode(id, parentKey, content, currentFormats);
  var size = (0, _utils.contentChars)(content);
  var key = (0, _utils.toKey)(id);
  state.map[parentKey] = _objectSpread({}, parent, {
    children: insertId(parent.children, key, idx),
    size: parent.size + size
  });
  state.map[key] = node;

  if (size) {
    var _cp = parent.parent;

    while (_cp !== _loc.rootParent) {
      var _node3 = state.map[_cp];
      state.map[_cp] = _objectSpread({}, _node3, {
        size: _node3.size + size
      });
      _cp = _node3.parent;
    }
  }
};

var insertIdx = function insertIdx(state, formats, stamp) {
  for (var i = 0; i < formats.length; i++) {
    var node = state.map[formats[i]];

    if (node.content.type === 'open' && node.content.stamp < stamp) {
      return i;
    }
  }

  return formats.length;
};

var addFormat = function addFormat(state, formats, stamp, id) {
  if (!formats) {
    return [id];
  }

  var idx = insertIdx(state, formats, stamp);
  return insertId(formats, id, idx);
};

var isSpanAllDeleted = function isSpanAllDeleted(state, span) {
  var parentNode = (0, _loc.nodeForKey)(state, [span.id, span.site]);
  if (!parentNode || !parentNode.deleted) return false;
  var length = (0, _utils.contentLength)(parentNode.content);

  if (span.length <= length) {
    return true;
  }

  return isSpanAllDeleted(state, {
    id: span.id + length,
    site: span.site,
    length: span.length - length
  });
};

var deleteSpan = function deleteSpan(state, span) {
  if (isSpanAllDeleted(state, span)) {
    return;
  }

  if (!ensureNodeAt(state, [span.id, span.site])) {
    throw new Error("Failed to ensure node at ".concat(span.id, ":").concat(span.site));
  }

  var key = (0, _utils.toKey)([span.id, span.site]);
  var node = state.map[key];

  if (node.content.type !== 'text') {
    throw new Error("Not a text node, cannot delete a non-text node");
  }

  var text = node.content.text;

  if (text.length < span.length) {
    deleteSpan(state, {
      id: span.id + text.length,
      site: span.site,
      length: span.length - text.length
    });
  } else if (text.length > span.length) {
    // This splits it
    ensureNodeAt(state, [span.id + span.length, span.site]);
  }

  if (!state.map[key].deleted) {
    var content = state.map[key].content;

    if (content.type !== 'text') {
      throw new Error('Somehow types got changed just now');
    }

    var deletedLength = content.text.length; // text.length > span.length ? span.length : text.length;

    state.map[key] = _objectSpread({}, state.map[key], {
      size: state.map[key].size - deletedLength,
      deleted: true
    }); // Remove the length of this text from all parent's sizes.

    var cp = node.parent;

    while (cp !== _loc.rootParent) {
      var _node4 = state.map[cp];
      state.map[cp] = _objectSpread({}, _node4, {
        size: _node4.size - deletedLength
      });
      cp = _node4.parent;
    }

    if (state.map[key].children.length === 1) {
      maybeMergeUp(state, state.map[key].children[0]);
    }

    maybeMergeUp(state, key);
  }
};

var maybeMergeUp = function maybeMergeUp(state, key) {
  var node = state.map[key];

  if (node.content.type !== 'text') {
    return;
  }

  var text = node.content.text;

  if (node.parent === _loc.rootParent) {
    return;
  }

  var parent = state.map[node.parent];

  if (parent.children.length !== 1 || parent.content.type !== 'text' || parent.deleted !== node.deleted) {
    return;
  }

  var parentText = parent.content.text;

  if (parent.id[1] !== node.id[1] || node.id[0] !== parent.id[0] + parentText.length) {
    return;
  } // Ok we're merging


  state.map[node.parent] = _objectSpread({}, parent, {
    content: {
      type: 'text',
      text: parentText + text
    },
    children: node.children
  });
  node.children.forEach(function (child) {
    state.map[child] = _objectSpread({}, state.map[child], {
      parent: node.parent
    });
  });
  delete state.map[key];
};

var deleteFormat = function deleteFormat(state, stamp, open, close) {
  // Ok
  var openKey = (0, _utils.toKey)(open);
  var closeKey = (0, _utils.toKey)(close);
  var openNode = state.map[openKey];
  var closeNode = state.map[closeKey];

  if (openNode.content.type !== 'open' || closeNode.content.type !== 'close' || openNode.content.stamp !== stamp || closeNode.content.stamp !== stamp) {
    throw new Error("Invalid \"delete-format\" delta");
  }

  if (openNode.deleted && closeNode.deleted) {
    return;
  }

  var key = openNode.content.key;
  state.map[openKey] = _objectSpread({}, openNode, {
    deleted: true
  });
  state.map[closeKey] = _objectSpread({}, closeNode, {
    deleted: true
  });
  (0, _loc.walkFrom)(state, openKey, function (node) {
    var nkey = (0, _utils.toKey)(node.id);

    if (nkey === closeKey) {
      return false; // we're done
    }

    if (node.formats[key] && node.formats[key].includes(openKey)) {
      var changed = node.formats[key].filter(function (k) {
        return k !== openKey;
      });

      var formats = _objectSpread({}, node.formats);

      if (changed.length) {
        formats[key] = changed;
      } else {
        delete formats[key];
      }

      state.map[(0, _utils.toKey)(node.id)] = _objectSpread({}, node, {
        formats: formats
      });
    }
  }, true);
};

var apply = function apply(current, delta) {
  if (Array.isArray(delta)) {
    var _state = current;
    delta.forEach(function (delta) {
      return _state = apply(_state, delta);
    });
    return _state;
  }

  var state = _objectSpread({}, current, {
    map: _objectSpread({}, current.map)
  });

  if (delta.type === 'insert') {
    insertNode(state, delta.id, delta.after, {
      type: 'text',
      text: delta.text
    });
  } else if (delta.type === 'delete') {
    delta.spans.forEach(function (span) {
      deleteSpan(state, span);
    });
  } else if (delta.type === 'delete-format') {
    deleteFormat(state, delta.stamp, delta.open, delta.close);
  } else if (delta.type === 'format') {
    var openKey = (0, _utils.toKey)(delta.open.id); // Format already exists. TODO check consistency

    if (state.map[openKey] && state.map[(0, _utils.toKey)(delta.close.id)]) {
      return state;
    }

    insertNode(state, delta.open.id, delta.open.after, {
      type: 'open',
      key: delta.key,
      value: delta.value,
      stamp: delta.stamp
    });
    insertNode(state, delta.close.id, delta.close.after, {
      type: 'close',
      key: delta.key,
      stamp: delta.stamp
    }); // now we go through each node between the start and end
    // and update the formattings

    (0, _loc.walkFrom)(state, (0, _utils.toKey)(delta.open.id), function (node) {
      if ((0, _utils.keyEq)(node.id, delta.close.id)) {
        return false;
      } // yeah, adding in the formats


      var key = (0, _utils.toKey)(node.id);
      state.map[key] = _objectSpread({}, node, {
        formats: _objectSpread({}, node.formats, _defineProperty({}, delta.key, addFormat(state, node.formats[delta.key], delta.stamp, openKey)))
      });
    }, true);
  }

  try {
    (0, _check.checkConsistency)(state);
  } catch (err) {
    debugger;
  }

  return state;
};

exports.apply = apply;