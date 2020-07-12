"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _poller = _interopRequireDefault(require("../poller.js"));

var _backOff = _interopRequireDefault(require("../back-off.js"));

var _debounce = require("../debounce.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// const createNetwork = (
// ): BlobNetworkCreator => {
//     return {
//         setDirty: sync,
//         onSyncStatus: fn => {
//             connectionListeners.push(fn);
//         },
//         getSyncStatus() {
//             return currentSyncStatus;
//         },
//         sendCrossTabChanges(peerChange) {
//             sendCrossTabChange(peerChange);
//         },
//     };
// }
// Cases:

/*
a) synced
b) local ahead -> ok so maybe I need to track local changes, and set a "local dirty" flag when I make changes. Ok.
c) local behind -> and store the server's etag.
d) both new


How to know what state you're in?
- we can track whether we're ahead locally
- and we can determine if we're behind with the 304-get.

So, the procedure is:
- get from persistence: (?data if it's new, and the server's etag)
- get from the network: (?remote data if it's newer than the stored server etag, and the accompanying etag)
then
- if we get "nulls" for both datas, we're synced
- if only our data is new: push it to the network (receiving + storing a new etag)
- if only network data is new: merge it into local
- if both are new, merge remote into local, then push the merged result to remote, then store the resulting etag.



new local, old remote
new local, new remote
old local, new remote
old local, old remote


Q: Can I use, as my "etag", an HLC? e.g. the largest HLC in the blob?
And you can compare, and say "is the <etag> of this blob greater than my clock ... if so I need to merge it ..."
hmm so I think there's a case where it breaks, unfortunately,
because we don't have locking.

Really the only thing I can be sure of is "is the server version the same as the last one I saw".
Yeah, that's what I'll stick with.

On the other hand, for dirty checking, using an HLC is great.

I mean tbh I probably can use the HLC as the etag, I just can't do greater-than comparison on it.

*/
// Ok the part where we get very specific
var syncFetch = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(getRemote, putRemote, getLocal,
  /* hrm ok so the case where:
   - getLocal gives a blob and a stamp
  while getting remote, we do a local action, that changes the dirty stamp.
  - remote has changes, so we mergeIntoLocal, yielding a merged data that includes the data of the new stamp.
  ...
  */
  mergeIntoLocal, updateMeta) {
    var _ref2, local, serverEtag, dirtyStamp, remote, toSend, response, newServerEtag, t;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return getLocal();

          case 2:
            _ref2 = _context.sent;
            local = _ref2.local;
            serverEtag = _ref2.serverEtag;
            dirtyStamp = local ? local.stamp : null;
            console.log("[blob]", dirtyStamp != null ? 'local changes!' + dirtyStamp : 'no local changes');
            _context.next = 9;
            return getRemote(serverEtag);

          case 9:
            remote = _context.sent;

            if (!(!local && !remote)) {
              _context.next = 13;
              break;
            }

            console.log('bail');
            return _context.abrupt("return");

          case 13:
            toSend = local ? local.blob : null;

            if (!remote) {
              _context.next = 19;
              break;
            }

            _context.next = 17;
            return mergeIntoLocal(remote.blob, remote.etag);

          case 17:
            response = _context.sent;

            if (response) {
              toSend = response.blob;
              dirtyStamp = response.stamp;
              console.log('[blob] merged with changes');
            } else {
              toSend = null; // TODO dirtyStamp should not be truthy in this case I don't think
              // console.log('dirtyStamp', dirtyStamp);

              dirtyStamp = null;
            }

          case 19:
            newServerEtag = null;

            if (!toSend) {
              _context.next = 27;
              break;
            }

            console.log(remote ? '[blob] pushing up merged' : '[blob] pushing up local');
            t = toSend;
            Object.keys(toSend).forEach(function (colid) {
              if (Array.isArray(t[colid])) {
                throw new Error('Array in collection!');
              }
            });
            _context.next = 26;
            return putRemote(toSend);

          case 26:
            newServerEtag = _context.sent;

          case 27:
            if (!(newServerEtag != null || dirtyStamp != null)) {
              _context.next = 31;
              break;
            }

            console.log('clearing dirty stamp');
            _context.next = 31;
            return updateMeta(newServerEtag, dirtyStamp);

          case 31:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function syncFetch(_x, _x2, _x3, _x4, _x5) {
    return _ref.apply(this, arguments);
  };
}();

var makeSync = function makeSync(url, getLocal, mergeIntoLocal, updateMeta, sendCrossTabChanges, updateSyncStatus, softResync) {
  console.log('[blob] Maing sync with', url, getLocal, mergeIntoLocal, updateMeta);
  console.log('[blob] Im the leader (basic blob)');
  var poll = (0, _poller["default"])(3 * 1000, function () {
    return new Promise(function (res) {
      (0, _backOff["default"])(function () {
        return syncFetch( /*#__PURE__*/function () {
          var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(etag) {
            var res, blob, newEtag;
            return regeneratorRuntime.wrap(function _callee2$(_context2) {
              while (1) {
                switch (_context2.prev = _context2.next) {
                  case 0:
                    console.log('[blob] Checking for new data', etag);
                    _context2.next = 3;
                    return fetch(url, {
                      headers: {
                        'If-None-Match': etag != null ? etag : '',
                        'Access-control-request-headers': 'etag,content-type,content-length'
                      }
                    });

                  case 3:
                    res = _context2.sent;

                    if (!(res.status === 304 || res.status === 404)) {
                      _context2.next = 7;
                      break;
                    }

                    console.log('[blob] No changes from server!', etag);
                    return _context2.abrupt("return", null);

                  case 7:
                    if (!(res.status !== 200)) {
                      _context2.next = 9;
                      break;
                    }

                    throw new Error("Unexpected status on get ".concat(res.status));

                  case 9:
                    _context2.next = 11;
                    return res.json();

                  case 11:
                    blob = _context2.sent;
                    newEtag = res.headers.get('etag');
                    console.log('[blob] New etag', newEtag);

                    if (!(newEtag == null)) {
                      _context2.next = 16;
                      break;
                    }

                    throw new Error("Remote didn't set an etag on get");

                  case 16:
                    return _context2.abrupt("return", {
                      blob: blob,
                      etag: newEtag
                    });

                  case 17:
                  case "end":
                    return _context2.stop();
                }
              }
            }, _callee2);
          }));

          return function (_x6) {
            return _ref3.apply(this, arguments);
          };
        }(), /*#__PURE__*/function () {
          var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(blob) {
            var res, etag;
            return regeneratorRuntime.wrap(function _callee3$(_context3) {
              while (1) {
                switch (_context3.prev = _context3.next) {
                  case 0:
                    console.log('[blob] Pushing new data');
                    _context3.next = 3;
                    return fetch(url, {
                      method: 'PUT',
                      body: JSON.stringify(blob),
                      headers: {
                        'Content-type': 'application/json',
                        'Access-control-request-headers': 'etag,content-type,content-length'
                      }
                    });

                  case 3:
                    res = _context3.sent;

                    if (!(res.status !== 204)) {
                      _context3.next = 6;
                      break;
                    }

                    throw new Error("Unexpected status: ".concat(res.status, ", ").concat(JSON.stringify(res.headers)));

                  case 6:
                    etag = res.headers.get('etag');

                    if (!(etag == null)) {
                      _context3.next = 9;
                      break;
                    }

                    throw new Error("Remote didn't respond to post with an etag");

                  case 9:
                    return _context3.abrupt("return", etag);

                  case 10:
                  case "end":
                    return _context3.stop();
                }
              }
            }, _callee3);
          }));

          return function (_x7) {
            return _ref4.apply(this, arguments);
          };
        }(), getLocal, /*#__PURE__*/function () {
          var _ref5 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(remote, etag) {
            var res;
            return regeneratorRuntime.wrap(function _callee4$(_context4) {
              while (1) {
                switch (_context4.prev = _context4.next) {
                  case 0:
                    _context4.next = 2;
                    return mergeIntoLocal(remote, etag, sendCrossTabChanges);

                  case 2:
                    res = _context4.sent;

                    if (res) {
                      softResync();
                    }

                    return _context4.abrupt("return", res);

                  case 5:
                  case "end":
                    return _context4.stop();
                }
              }
            }, _callee4);
          }));

          return function (_x8, _x9) {
            return _ref5.apply(this, arguments);
          };
        }(), updateMeta).then(function () {
          console.log('connected, love it');
          updateSyncStatus({
            status: 'connected'
          });
          res();
          return true;
        }, function (err) {
          console.error('Failed to sync blob ' + err.message);
          console.error(err.message);
          console.error(err.stack);
          console.log('definitely not connected');
          updateSyncStatus({
            status: 'disconnected'
          });
          return false;
        });
      });
    });
  });
  poll();
  var syncer = (0, _debounce.debounce)(poll);
  return function (softResync) {
    // might need changes
    return syncer();
  };
}; // TODO dedup with polling network


var createNetwork = function createNetwork(url) {
  return function (getLocal, mergeIntoLocal, updateMeta, handleCrossTabChanges) {
    return {
      initial: {
        status: 'disconnected'
      },
      createSync: function createSync(sendCrossTabChanges, updateSyncStatus, softResync) {
        return makeSync(url, getLocal, mergeIntoLocal, updateMeta, sendCrossTabChanges, updateSyncStatus, softResync);
      }
    };
  };
};

var _default = createNetwork;
exports["default"] = _default;