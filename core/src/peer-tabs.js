"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.peerTabAwareSync = exports.peerTabAwareNetwork = exports.peerTabAwareNetworks = void 0;

var hlc = _interopRequireWildcard(require("../../hybrid-logical-clock/src/index.js"));

var _fastDeepEqual = _interopRequireDefault(require("fast-deep-equal"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var peerTabAwareNetworks = function peerTabAwareNetworks(name, handleCrossTabChanges, networks) {
  var connectionListeners = [];
  var currentSyncStatus = {};
  Object.keys(networks).forEach(function (key) {
    return currentSyncStatus[key] = networks[key].initial;
  });

  var _peerTabAwareSync = peerTabAwareSync(name, function (status) {
    // STOPSHIP: this status tracking is *broken*, we need to track which network it was
    // when we send status across tabs
    Object.keys(networks).forEach(function (key) {
      return currentSyncStatus[key] = status;
    }); // currentSyncStatus[] = status;

    connectionListeners.forEach(function (f) {
      return f(currentSyncStatus);
    });
  }, function (peerChange) {
    // console.log('received peer change');
    handleCrossTabChanges(peerChange);
  }, // Create the thing.
  function (sendCrossTabChange, onStatus) {
    var syncs = {};
    Object.keys(networks).forEach(function (key) {
      syncs[key] = networks[key].createSync(sendCrossTabChange, onStatus, function () {
        Object.keys(syncs).forEach(function (k) {
          if (k !== key) {
            syncs[k](true);
          }
        });
      });
    });
    return function () {
      Object.keys(syncs).forEach(function (k) {
        syncs[k]();
      });
    };
  }),
      sendCrossTabChange = _peerTabAwareSync.sendCrossTabChange,
      sync = _peerTabAwareSync.sync;

  return {
    setDirty: sync,
    onSyncStatus: function onSyncStatus(fn) {
      connectionListeners.push(fn);
    },
    getSyncStatus: function getSyncStatus() {
      return currentSyncStatus;
    },
    sendCrossTabChanges: function sendCrossTabChanges(peerChange) {
      sendCrossTabChange(peerChange);
    }
  };
};

exports.peerTabAwareNetworks = peerTabAwareNetworks;

var peerTabAwareNetwork = function peerTabAwareNetwork(name, handleCrossTabChanges, network) {
  var connectionListeners = [];
  var currentSyncStatus = network.initial;

  var _peerTabAwareSync2 = peerTabAwareSync(name, function (status) {
    currentSyncStatus = status;
    connectionListeners.forEach(function (f) {
      return f(currentSyncStatus);
    });
  }, function (peerChange) {
    // console.log('received peer change');
    handleCrossTabChanges(peerChange);
  }, function (sendCrossTabChange, onStatus) {
    var sync = network.createSync(sendCrossTabChange, onStatus, function () {// do nothing
    });
    return function () {
      return sync(false);
    };
  }),
      sendCrossTabChange = _peerTabAwareSync2.sendCrossTabChange,
      sync = _peerTabAwareSync2.sync;

  return {
    setDirty: sync,
    onSyncStatus: function onSyncStatus(fn) {
      connectionListeners.push(fn);
    },
    getSyncStatus: function getSyncStatus() {
      return currentSyncStatus;
    },
    sendCrossTabChanges: function sendCrossTabChanges(peerChange) {
      sendCrossTabChange(peerChange);
    }
  };
};

exports.peerTabAwareNetwork = peerTabAwareNetwork;

var peerTabAwareSync = function peerTabAwareSync(name, onStatus, handleCrossTabChange, makeLeaderSync) {
  var _require = require('broadcast-channel'),
      BroadcastChannel = _require.BroadcastChannel,
      createLeaderElection = _require.createLeaderElection;

  var channel = new BroadcastChannel(name, {
    webWorkerSupport: false
  });

  var originalSync = function originalSync() {
    channel.postMessage({
      type: 'sync'
    });
  };

  channel.onmessage = function (msg) {
    // console.log('got a peer message', msg.type);
    if (msg.type === 'sync' && _sync !== originalSync) {
      _sync();
    } else if (msg.type === 'change') {
      handleCrossTabChange(msg.peerChange);
    } else if (msg.type === 'status') {
      onStatus(msg.status);
    } // console.log('Processed message', msg);

  };

  var sendCrossTabChange = function sendCrossTabChange(change) {
    // console.log('Sending changes', change);
    channel.postMessage({
      type: 'change',
      peerChange: change
    });
  };

  var sendConnectionStatus = function sendConnectionStatus(status) {
    channel.postMessage({
      type: 'status',
      status: status
    });
  };

  var elector = createLeaderElection(channel);
  var _sync = originalSync;
  elector.awaitLeadership().then(function () {
    _sync = makeLeaderSync(sendCrossTabChange, function (status) {
      onStatus(status);
      sendConnectionStatus(status);
    });
  });
  var syncTimer = null;
  return {
    sendCrossTabChange: sendCrossTabChange,
    // Dedup sync calls within the same tick -- makes a lot of things easier.
    sync: function sync() {
      if (syncTimer) return;
      syncTimer = setTimeout(function () {
        syncTimer = null;

        _sync();
      }, 0);
    }
  };
};

exports.peerTabAwareSync = peerTabAwareSync;