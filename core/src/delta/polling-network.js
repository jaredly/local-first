"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var hlc = _interopRequireWildcard(require("../../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

var _poller = _interopRequireDefault(require("../poller.js"));

var _backOff = _interopRequireDefault(require("../back-off.js"));

var _debounce = require("../debounce.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// Ok the part where we get very specific
var syncFetch = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(url, sessionId, getMessages, onMessages) {
    var messages, res, data;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return getMessages(true);

          case 2:
            messages = _context.sent;
            console.log('sync:messages', messages); // console.log('messages', messages);

            _context.next = 6;
            return fetch("".concat(url, "?sessionId=").concat(sessionId), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(messages)
            });

          case 6:
            res = _context.sent;

            if (!(res.status !== 200)) {
              _context.next = 9;
              break;
            }

            throw new Error("Unexpected status ".concat(res.status));

          case 9:
            _context.next = 11;
            return res.json();

          case 11:
            data = _context.sent;
            console.log('sync:data', data);
            _context.next = 15;
            return onMessages(data);

          case 15:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function syncFetch(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

var createPollingNetwork = function createPollingNetwork(url) {
  return function (sessionId, getMessages, handleMessages) {
    return {
      initial: {
        status: 'disconnected'
      },
      createSync: function createSync(sendCrossTabChange, updateStatus) {
        console.log('Im the leader (polling)');
        var poll = (0, _poller["default"])(3 * 1000, function () {
          return new Promise(function (res) {
            (0, _backOff["default"])(function () {
              return syncFetch(url, sessionId, getMessages, function (messages) {
                return handleMessages(messages, sendCrossTabChange);
              }).then(function () {
                updateStatus({
                  status: 'connected'
                });
                res();
                return true;
              }, function (err) {
                console.error('Failed to sync polling');
                console.error(err.stack);
                updateStatus({
                  status: 'disconnected'
                });
                return false;
              });
            });
          });
        });
        poll();
        return (0, _debounce.debounce)(poll);
      }
    };
  };
};

var _default = createPollingNetwork;
exports["default"] = _default;