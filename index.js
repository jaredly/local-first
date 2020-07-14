"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

// ok
var admin = require('firebase-admin');

var crypto = require('crypto');

var fs = require('fs');

var path = require('path');

var suffixes = 'abcdefg'.split(''); // if the most recent week is different, and more than a week older, then rotate

var backup = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(bucket, prefix, suffix, buffer) {
    var hash, digest, now, _ref2, _ref3, files, metas, daily, weekly, DAY_IN_MS, idx, letter, stream, _idx, _letter, _stream;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            hash = crypto.createHash('md5');
            hash.update(buffer);
            digest = hash.digest('base64');
            now = Date.now();
            _context.next = 6;
            return bucket.getFiles();

          case 6:
            _ref2 = _context.sent;
            _ref3 = _slicedToArray(_ref2, 1);
            files = _ref3[0];
            _context.next = 11;
            return Promise.all(files.map(function (file) {
              return file.getMetadata().then(function (x) {
                return x[0];
              });
            }));

          case 11:
            metas = _context.sent;
            daily = metas.filter(function (file) {
              return file.name.startsWith(prefix + '-daily-');
            }).sort(function (a, b) {
              return new Date(b.updated).getTime() - new Date(a.updated).getTime();
            });
            weekly = metas.filter(function (file) {
              return file.name.startsWith(prefix + '-weekly-');
            }).sort(function (a, b) {
              return new Date(b.updated).getTime() - new Date(a.updated).getTime();
            });
            console.log();

            if (!weekly.some(function (meta) {
              return meta.md5Hash === digest;
            })) {
              _context.next = 18;
              break;
            }

            console.log('alredy in weekly'); // already exists in the weekly backups, can skip

            return _context.abrupt("return");

          case 18:
            DAY_IN_MS = 10000; //1000 * 3600 * 24;

            if (!(!weekly.length || (now - new Date(weekly[0].updated).getTime()) / DAY_IN_MS >= 6.5)) {
              _context.next = 28;
              break;
            }

            idx = weekly.length ? suffixes.indexOf(weekly[0].name.slice(-suffix.length - 1)[0]) + 1 : 0;
            letter = suffixes[idx % suffixes.length];
            stream = bucket.file(prefix + '-weekly-' + letter + suffix).createWriteStream({
              resumable: false
            });
            stream.write(buffer);
            stream.end();
            return _context.abrupt("return");

          case 28:
            console.log('not new enough for weekly');

          case 29:
            if (!daily.some(function (meta) {
              return meta.md5Hash === digest;
            })) {
              _context.next = 32;
              break;
            }

            console.log('already in daily'); // already exists in the days list, all good

            return _context.abrupt("return");

          case 32:
            if (!daily.length || (now - new Date(daily[0].updated).getTime()) / DAY_IN_MS >= 0.8) {
              _idx = daily.length ? suffixes.indexOf(daily[0].name.slice(-suffix.length - 1)[0]) + 1 : 0;
              _letter = suffixes[_idx % suffixes.length];
              _stream = bucket.file(prefix + '-daily-' + _letter + suffix).createWriteStream({
                resumable: false
              });

              _stream.write(buffer);

              _stream.end();
            } else {
              console.log('not new enough for daily');
            }

          case 33:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function backup(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  };
}();

var tarfs = require('tar-fs');

var backupFolder = function backupFolder(bucket, prefix, folder) {
  return new Promise(function (res, rej) {
    var stream = tarfs.pack(folder);
    var bufs = [];
    stream.on('data', function (d) {
      bufs.push(d);
    });
    stream.on('error', function (err) {
      rej(err);
    });
    stream.on('end', function () {
      var buf = Buffer.concat(bufs);
      res(backup(bucket, prefix, '.tar.gz', buf));
    });
  });
};

var backupRoute = function backupRoute(baseDir, appId) {
  return function (req, res) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: "https://".concat(appId, ".firebaseio.com"),
      storageBucket: "gs://".concat(appId, ".appspot.com/")
    });
    var bucket = admin.storage().bucket();

    var fs = require('fs');

    var path = require('path');

    Promise.all(fs.readdirSync(baseDir).map(function (name) {
      console.log('Backing up', name);
      return backupFolder(bucket, name + '/backup', path.join(baseDir, name));
    })).then(function () {
      res.send('Done!');
      res.end();
    }, function (err) {
      console.error(err);
      res.status(500);
      res.send('Failed :(');
      res.end();
    });
  };
};

module.exports = backupRoute;
module.exports.backupFolder = backupFolder;
module.exports.backup = backup;