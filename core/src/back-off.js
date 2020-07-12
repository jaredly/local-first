"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var backOff = function backOff(fn) {
  var wait = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 200;
  var rate = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1.5;
  var initialWait = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : wait;
  fn()["catch"](function (err) {
    return false;
  }).then(function (succeeded) {
    if (succeeded) {
      return;
    } else {
      var tid = setTimeout(function () {
        document.removeEventListener('visibilitychange', listener, false);
        backOff(fn, wait * rate, rate, initialWait);
      }, wait);

      var listener = function listener() {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', listener, false);
          clearTimeout(tid);
          backOff(fn, initialWait, rate, initialWait);
        }
      };

      if (wait > 1000) {
        document.addEventListener('visibilitychange', listener, false);
      }
    }
  });
}; // function handleVisibilityChange() {
//   if (document.hidden) {
//     pauseSimulation();
//   } else  {
//     startSimulation();
//   }
// }
// document.addEventListener("visibilitychange", handleVisibilityChange, false);


var _default = backOff;
exports["default"] = _default;