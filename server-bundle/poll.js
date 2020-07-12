"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.post = void 0;

var _server = require("../core/src/server.js");

var post = function post(server, sessionId, messages) {
  var maxStamp = null;
  console.log("sync:messages", messages);
  var acks = messages.map(function (message) {
    return (0, _server.onMessage)(server, sessionId, message);
  }).filter(Boolean);
  console.log('ack', acks);
  var responses = (0, _server.getMessages)(server, sessionId);
  console.log('messags', responses);
  return acks.concat(responses);
};

exports.post = post;