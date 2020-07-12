"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.debounce = void 0;

var debounce = function debounce(fn) {
  var waiting = false;
  return function (items) {
    if (!waiting) {
      waiting = true;
      setTimeout(function () {
        fn();
        waiting = false;
      }, 0);
    } else {
      console.log('bouncing');
    }
  };
};

exports.debounce = debounce;