"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _backOff = _interopRequireDefault(require("../back-off.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var reconnectingSocket = function reconnectingSocket(url, onOpen, onMessage, updateStatus) {
  var state = {
    socket: null
  };

  var reconnect = function reconnect() {
    state.socket = null;
    updateStatus({
      status: 'pending'
    });
    (0, _backOff["default"])(function () {
      return new Promise(function (res, rej) {
        var socket = new WebSocket(url);
        var opened = false;
        var closed = false;
        socket.addEventListener('open', function () {
          state.socket = socket;
          setTimeout(function () {
            if (!closed) {
              opened = true;
              updateStatus({
                status: 'connected'
              });
              res(true);
              onOpen();
            }
          }, 50);
        });
        socket.addEventListener('close', function () {
          updateStatus({
            status: 'disconnected'
          });
          closed = true;

          if (opened) {
            reconnect();
          } else {
            res(false);
          }
        });
        socket.addEventListener('message', function (_ref) {
          var data = _ref.data;
          return onMessage(data, function (response) {
            return socket.send(response);
          });
        });
      });
    }, 500, 1.5);
  };

  reconnect();
  return state;
};

var createWebSocketNetwork = function createWebSocketNetwork(url) {
  return function (sessionId, getMessages, handleMessages) {
    return {
      initial: {
        status: 'pending'
      },
      createSync: function createSync(sendCrossTabChange, updateStatus, softResync) {
        console.log('Im the leader (websocket)');
        var state = reconnectingSocket(url + (url.includes('?') ? '&' : '?') + "siteId=".concat(sessionId), function () {
          return sync(false);
        }, /*#__PURE__*/function () {
          var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(msg, respond) {
            var messages, responseMessages;
            return regeneratorRuntime.wrap(function _callee$(_context) {
              while (1) {
                switch (_context.prev = _context.next) {
                  case 0:
                    messages = JSON.parse(msg);
                    _context.next = 3;
                    return handleMessages(messages, sendCrossTabChange)["catch"](function (err) {
                      console.log('Failed to handle messages!');
                      console.error(err);
                    });

                  case 3:
                    responseMessages = _context.sent;

                    if (responseMessages != null && responseMessages.length > 0) {
                      respond(JSON.stringify(responseMessages));
                    }

                  case 5:
                  case "end":
                    return _context.stop();
                }
              }
            }, _callee);
          }));

          return function (_x, _x2) {
            return _ref2.apply(this, arguments);
          };
        }(), updateStatus);

        var sync = function sync(softSync) {
          if (state.socket) {
            var socket = state.socket;
            getMessages(!softSync).then(function (messages) {
              if (messages.length) {
                socket.send(JSON.stringify(messages));
              } else {
                console.log('nothing to sync here');
              }
            }, function (err) {
              console.error('Failed to sync messages folks');
              console.error(err);
            });
          } else {
            console.log('but no socket');
          }
        };

        return sync;
      }
    };
  };
};

var _default = createWebSocketNetwork;
exports["default"] = _default;