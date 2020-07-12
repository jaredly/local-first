"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.between = exports.compare = exports.insertionIndex = exports.sortForInsertion = void 0;
var epsilon = Math.pow(2, -10);

var sortForInsertion = function sortForInsertion(ids, sortForId, idx) {
  var pre = idx === 0 ? null : sortForId(ids[idx - 1]);
  var post = idx >= ids.length ? null : sortForId(ids[idx]);
  return between(pre, post);
};

exports.sortForInsertion = sortForInsertion;

var insertionIndex = function insertionIndex(ids, sortForId, newSort, newId) {
  for (var i = 0; i < ids.length; i++) {
    var cmp = compare(sortForId(ids[i]), newSort);

    if (cmp === 0 && ids[i] > newId) {
      return i;
    }

    if (cmp > 0) {
      return i;
    }
  }

  return ids.length;
};

exports.insertionIndex = insertionIndex;

var compare = function compare(one, two) {
  var i = 0;

  for (; i < one.length && i < two.length; i++) {
    if (Math.abs(one[i] - two[i]) > Number.EPSILON) {
      return one[i] - two[i];
    }
  }

  if (one.length !== two.length) {
    return one.length - two.length;
  }

  return 0;
};

exports.compare = compare;

var between = function between(one, two) {
  if (!one || !two) {
    if (one) return [one[0] + 10];
    if (two) return [two[0] - 10];
    return [0];
  }

  var i = 0;
  var parts = []; // console.log('between', one, two);

  for (; i < one.length && i < two.length; i++) {
    if (two[i] - one[i] > epsilon * 2) {
      // does this mean that this is the smallest possible difference between two things?
      // I don't know actually. Probably possible to construct scenarios that... hmm.. maybe not
      // though.
      parts.push(one[i] + (two[i] - one[i]) / 2);
      return parts;
    }

    parts.push(one[i]);
  }

  if (one.length < two.length) {
    parts.push(two[i] - 10);
  } else if (two.length < one.length) {
    parts.push(one[i] + 10);
  } else {
    parts.push(0);
  }

  return parts;
};

exports.between = between;