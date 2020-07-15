"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.latestStamp = void 0;

var latestMetaStamp = function latestMetaStamp(meta, otherStamp) {
  if (meta.type === 'map') {
    var max = meta.hlcStamp;
    Object.keys(meta.map).forEach(function (id) {
      var stamp = latestMetaStamp(meta.map[id], otherStamp);

      if (stamp != null && (!max || stamp > max)) {
        max = stamp;
      }
    });
    return max;
  } else if (meta.type === 'plain' || meta.type === 't') {
    return meta.hlcStamp;
  } else if (meta.type === 'array') {
    var _max = meta.hlcStamp;
    Object.keys(meta.items).forEach(function (id) {
      var stamp = latestMetaStamp(meta.items[id].meta, otherStamp);

      if (stamp != null && (!_max || stamp > _max)) {
        _max = stamp;
      }
    });
    return _max;
  } else {
    var _max2 = meta.hlcStamp;
    var inner = otherStamp(meta.meta);
    return inner != null && inner > _max2 ? inner : _max2;
  }
};

var latestStamp = function latestStamp(data, otherStamp) {
  var latest = latestMetaStamp(data.meta, otherStamp);
  return latest != null ? latest : '';
};

exports.latestStamp = latestStamp;