"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.create = void 0;

// TODO this should probably be a little more intellident, so that we could potentially persist the undo history.
var create = function create() {
  var history = [];
  var pending = [];
  var timer = null;
  return {
    add: function add(fn) {
      // console.log('add undo');
      pending.push(fn);

      if (!timer) {
        timer = setTimeout(function () {
          timer = null;

          if (pending.length) {
            // console.log('new history', pending.length);
            history.push(pending);
          }

          pending = [];
        }, 0);
      }
    },
    undo: function undo() {
      if (pending.length) {
        // console.log('undo pending', pending.length);
        pending.forEach(function (fn) {
          return fn();
        });
        pending = [];
      }

      if (history.length) {
        var last = history.pop(); // console.log('undo', last.length);

        last.forEach(function (fn) {
          return fn();
        });
      }
    }
  };
};

exports.create = create;