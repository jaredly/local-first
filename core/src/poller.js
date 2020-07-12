"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var poller = function poller(time, fn) {
  var tid = null;

  var poll = function poll() {
    // console.log('poll');
    clearTimeout(tid);
    fn()["catch"](function () {}).then(function () {
      tid = setTimeout(poll, time);
    });
  };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearTimeout(tid);
    } else {
      poll();
    }
  }, false);
  window.addEventListener('focus', function () {
    poll();
  }, false);
  return poll;
};

var _default = poller;
exports["default"] = _default;