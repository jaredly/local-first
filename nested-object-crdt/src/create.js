"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createEmpty = exports.create = exports.createDeepMapMeta = exports.createDeepArrayMeta = exports.createDeep = exports.createWithSchema = exports.createDeepMeta = exports.createOther = exports.MIN_STAMP = void 0;

var sortedArray = _interopRequireWildcard(require("./array-utils.js"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var MIN_STAMP = '';
exports.MIN_STAMP = MIN_STAMP;

var createOther = function createOther(value, other, hlcStamp) {
  return {
    value: value,
    meta: {
      type: 'other',
      meta: other,
      hlcStamp: hlcStamp
    }
  };
};

exports.createOther = createOther;

var createDeepMeta = function createDeepMeta(value, hlcStamp, getStamp) {
  if (value == null || _typeof(value) !== 'object') {
    return {
      type: 'plain',
      hlcStamp: hlcStamp
    };
  }

  if (Array.isArray(value)) {
    return createDeepArrayMeta(value, hlcStamp, getStamp, function (item) {
      return createDeepMeta(item, hlcStamp, getStamp);
    });
  }

  return createDeepMapMeta(value, hlcStamp, getStamp, function (item) {
    return createDeepMeta(item, hlcStamp, getStamp);
  });
};

exports.createDeepMeta = createDeepMeta;

var randomStamp = function randomStamp() {
  return Math.random().toString(36).slice(2);
};

var metaForSchema = function metaForSchema(value, hlcStamp, getStamp, schema, createOtherMeta) {
  if (schema === 'rich-text') {
    return {
      type: 'other',
      meta: createOtherMeta(value),
      hlcStamp: hlcStamp
    };
  } // Gotta get us some test coverage of this stuff


  if (schema === 'id-array') {
    if (!Array.isArray(value) || !value.every(function (v) {
      return typeof v === 'string';
    })) {
      throw new Error("Value not an id array");
    } // $FlowFixMe


    return createIdArrayMeta(value, hlcStamp);
  }

  if (typeof schema === 'string') {
    return {
      type: 'plain',
      hlcStamp: hlcStamp
    };
  }

  switch (schema.type) {
    case 'array':
      if (!Array.isArray(value)) {
        throw new Error("Value not an array");
      }

      return createDeepArrayMeta(value, hlcStamp, getStamp, function (item) {
        return metaForSchema(item, hlcStamp, getStamp, schema.item, createOtherMeta);
      });

    case 'optional':
      return value != null ? metaForSchema(value, hlcStamp, getStamp, schema.value, createOtherMeta) : {
        type: 't',
        hlcStamp: hlcStamp
      };

    case 'map':
      if (value == null || _typeof(value) !== 'object') {
        throw new Error("Not an object");
      }

      return createDeepMapMeta(value, hlcStamp, getStamp, function (item, key) {
        return metaForSchema(item, hlcStamp, getStamp, schema.value, createOtherMeta);
      });

    case 'object':
      if (value == null || _typeof(value) !== 'object') {
        throw new Error("Not an object");
      }

      return createDeepMapMeta(value, hlcStamp, getStamp, function (item, key) {
        return metaForSchema(item, hlcStamp, getStamp, schema.attributes[key], createOtherMeta);
      });

    default:
      throw new Error('Unexpected schema type: ' + JSON.stringify(schema));
  }
};

var createWithSchema = function createWithSchema(value, hlcStamp, getStamp, schema, createOtherMeta) {
  // need to assume that 'rich-text' is 'other', right?
  // If there's need for more/other than that, I can update this.
  return {
    value: value,
    meta: metaForSchema(value, hlcStamp, getStamp, schema, createOtherMeta)
  };
};

exports.createWithSchema = createWithSchema;

var createDeep = function createDeep(value, hlcStamp) {
  var getStamp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : randomStamp;
  return {
    value: value,
    meta: createDeepMeta(value, hlcStamp, getStamp)
  };
};

exports.createDeep = createDeep;

var createIdArrayMeta = function createIdArrayMeta(value, hlcStamp) {
  var meta = {
    type: 'array',
    idsInOrder: [],
    items: {},
    hlcStamp: hlcStamp
  };
  var last = null;
  value.forEach(function (id) {
    var sort = sortedArray.between(last, null);
    last = sort;
    meta.items[id] = {
      meta: {
        type: 'plain',
        hlcStamp: hlcStamp
      },
      sort: {
        idx: sort,
        stamp: hlcStamp
      }
    };
    meta.idsInOrder.push(id);
  });
  return meta;
};

var createDeepArrayMeta = function createDeepArrayMeta(value, hlcStamp, getStamp, createInner) {
  var meta = {
    type: 'array',
    idsInOrder: [],
    items: {},
    hlcStamp: hlcStamp
  };
  var last = null;
  value.forEach(function (item) {
    var id = getStamp();
    var innerMeta = createInner(item);
    var sort = sortedArray.between(last, null);
    last = sort;
    meta.items[id] = {
      meta: innerMeta,
      sort: {
        idx: sort,
        stamp: hlcStamp
      }
    };
    meta.idsInOrder.push(id);
  });
  return meta;
};

exports.createDeepArrayMeta = createDeepArrayMeta;

var createDeepMapMeta = function createDeepMapMeta(value, hlcStamp, getStamp, createInner) {
  var meta = {
    type: 'map',
    map: {},
    hlcStamp: hlcStamp
  };
  Object.keys(value).forEach(function (k) {
    meta.map[k] = createInner(value[k], k);
  });
  return meta;
};

exports.createDeepMapMeta = createDeepMapMeta;

var create = function create(value, hlcStamp) {
  return {
    value: value,
    meta: {
      type: 'plain',
      hlcStamp: hlcStamp
    }
  };
};

exports.create = create;

var createEmpty = function createEmpty() {
  var hlcStamp = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : MIN_STAMP;
  return {
    value: null,
    meta: {
      type: 't',
      hlcStamp: hlcStamp
    }
  };
};

exports.createEmpty = createEmpty;