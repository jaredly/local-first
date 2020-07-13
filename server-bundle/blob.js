"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.putBlob = exports.getBlob = void 0;

var _express = _interopRequireDefault(require("express"));

var _fs = _interopRequireDefault(require("fs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var genEtag = function genEtag(stat) {
  return "".concat(stat.mtime.getTime(), ":").concat(stat.size);
};

var getBlob = function getBlob(filePath, ifNoneMatch, res) {
  if (!_fs["default"].existsSync(filePath)) {
    res.status(404);
    return res.end();
  }

  var stat = _fs["default"].statSync(filePath);

  var etag = genEtag(stat);

  if (etag == ifNoneMatch) {
    res.set('ETag', etag);
    console.log('GET no change', etag);
    res.status(304);
    res.end();
    return;
  }

  console.log('GET', etag);
  res.set('ETag', etag);
  res.json(JSON.parse(_fs["default"].readFileSync(filePath, 'utf8')));
};

exports.getBlob = getBlob;

var putBlob = function putBlob(filePath, body, res) {
  _fs["default"].writeFileSync(filePath, JSON.stringify(body), 'utf8');

  var stat = _fs["default"].statSync(filePath);

  var etag = genEtag(stat);
  console.log('Updating server state', etag);
  res.set('ETag', etag);
  res.status(204);
  res.end();
};

exports.putBlob = putBlob;