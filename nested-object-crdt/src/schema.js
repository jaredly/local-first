"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validate = exports.validateSet = exports.validatePath = exports.validateDelta = exports.subSchema = void 0;

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _wrapNativeSuper(Class) { var _cache = typeof Map === "function" ? new Map() : undefined; _wrapNativeSuper = function _wrapNativeSuper(Class) { if (Class === null || !_isNativeFunction(Class)) return Class; if (typeof Class !== "function") { throw new TypeError("Super expression must either be null or a function"); } if (typeof _cache !== "undefined") { if (_cache.has(Class)) return _cache.get(Class); _cache.set(Class, Wrapper); } function Wrapper() { return _construct(Class, arguments, _getPrototypeOf(this).constructor); } Wrapper.prototype = Object.create(Class.prototype, { constructor: { value: Wrapper, enumerable: false, writable: true, configurable: true } }); return _setPrototypeOf(Wrapper, Class); }; return _wrapNativeSuper(Class); }

function isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

function _construct(Parent, args, Class) { if (isNativeReflectConstruct()) { _construct = Reflect.construct; } else { _construct = function _construct(Parent, args, Class) { var a = [null]; a.push.apply(a, args); var Constructor = Function.bind.apply(Parent, a); var instance = new Constructor(); if (Class) _setPrototypeOf(instance, Class.prototype); return instance; }; } return _construct.apply(null, arguments); }

function _isNativeFunction(fn) { return Function.toString.call(fn).indexOf("[native code]") !== -1; }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

// import { type CRDT, value as baseValue } from './index';
var ValidationError = /*#__PURE__*/function (_Error) {
  _inherits(ValidationError, _Error);

  function ValidationError(message, value, path) {
    var _this;

    _classCallCheck(this, ValidationError);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(ValidationError).call(this, "".concat(message, " ").concat( // $FlowFixMe
    JSON.stringify(value), " ").concat(path.map(function (m) {
      return m.toString();
    }).join(' - '))));
    _this.value = value;
    _this.path = path;
    return _this;
  }

  return ValidationError;
}( /*#__PURE__*/_wrapNativeSuper(Error));

var expectType = function expectType(v, name, path) {
  if (v == null) {
    throw new ValidationError("Expected type ".concat(name), v, path);
  }

  if (_typeof(v) !== name) {
    throw new ValidationError("Expected type ".concat(name), v, path);
  }
};

var expectObject = function expectObject(v, path) {
  expectType(v, 'object', path);

  if (Array.isArray(v)) {
    throw new ValidationError("Expected object, not array", v, path);
  }
};

var expectRichText = function expectRichText(v, path) {
  expectType(v, 'object', path);

  if (!('map' in v) || !('largestIDs' in v) || !('roots' in v)) {
    throw new Error("Doesn't look like a rich text object");
  }
};

var expectArray = function expectArray(v, path) {
  if (!v || !Array.isArray(v)) {
    throw new ValidationError("Expected array", v, path);
  }
};

var subSchema = function subSchema(t, setPath) {
  var path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  if (setPath.length === 0) {
    return t;
  }

  var attr = setPath[0];

  if (t === 'id-array') {
    return 'string';
  }

  if (_typeof(t) !== 'object') {
    throw new ValidationError("Invalid sub path, not a nested type", t, path);
  }

  switch (t.type) {
    case 'array':
      return subSchema(t.item, setPath.slice(1), path.concat([attr]));

    case 'optional':
      return subSchema(t.value, setPath, path);

    case 'map':
      return subSchema(t.value, setPath.slice(1), path.concat([attr]));

    case 'object':
      if (typeof attr !== 'string') {
        throw new Error("Object attributes must be strings");
      }

      if (!t.attributes[attr]) {
        throw new ValidationError("Invalid sub path", t, path.concat([attr]));
      }

      return subSchema(t.attributes[attr], setPath.slice(1), path.concat([attr]));

    default:
      throw new Error("Invalid type schema ".concat(JSON.stringify(t)));
  }
};

exports.subSchema = subSchema;

var validateDelta = function validateDelta(t, delta) {
  try {
    switch (delta.type) {
      case 'set':
        // we're removing something, just need to validate that the path exists
        if (delta.value.meta.type === 't') {
          validatePath(t, delta.path.map(function (p) {
            return p.key;
          }), // either it must be allowed to be empty (e.g. optional), or the path must be toplevel
          function (inner, parent) {
            if (parent && parent.type === 'map') {
              return; // all good
            }

            if (inner.type !== 'optional' && delta.path.length > 0) {
              throw new ValidationError("Clearing out something that's not optional", null, delta.path.map(function (p) {
                return p.key;
              }));
            }
          });
        } else {
          validateSet(t, delta.path.map(function (p) {
            return p.key;
          }), delta.value.value);
        }

        break;

      case 'insert':
        // TODO this doesn't validate that we're dealing with an array, I don't think? Oh maybe it does
        // console.log('validating insert', delta.path);
        validateSet(t, delta.path.map(function (p) {
          return p.key;
        }), delta.value.value);
        break;

      case 'reorder':
        validateSet(t, delta.path.map(function (p) {
          return p.key;
        }), []);
        break;

      case 'other':
        validatePath(t, delta.path.map(function (p) {
          return p.key;
        }), function (inner) {
          if (inner.type !== 'rich-text') {
            throw new ValidationError("Cannot apply a \"rich text\" delta to path", delta.delta, delta.path.map(function (p) {
              return p.key;
            }));
          }
        });
    }
  } catch (err) {
    console.error(err);
    return err.message;
  }
};

exports.validateDelta = validateDelta;

var validatePath = function validatePath(t, setPath, check) {
  var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var parent = arguments.length > 4 ? arguments[4] : undefined;

  if (setPath.length === 0) {
    return check(t, parent);
  }

  var attr = setPath[0];

  if (t === 'id-array') {
    if (setPath.length > 1) {
      throw new ValidationError("Can't set more than 1 level into an id-array", t, path);
    }

    return;
  }

  if (_typeof(t) !== 'object') {
    console.log(setPath, path, t);
    throw new ValidationError("Invalid sub path, not a nested type", t, path);
  }

  switch (t.type) {
    case 'array':
      return validatePath(t.item, setPath.slice(1), check, path.concat([attr]), t);

    case 'optional':
      return validatePath(t.value, setPath, check, path);

    case 'map':
      return validatePath(t.value, setPath.slice(1), check, path.concat([attr]), t);

    case 'object':
      if (typeof attr !== 'string') {
        throw new Error("Object attributes must be strings");
      }

      if (!t.attributes[attr]) {
        throw new ValidationError("Invalid sub path", t, path.concat([attr]));
      }

      return validatePath(t.attributes[attr], setPath.slice(1), check, path.concat([attr]), t);

    default:
      throw new Error("Invalid type schema ".concat(JSON.stringify(t)));
  }
};

exports.validatePath = validatePath;

var validateSet = function validateSet(t, setPath, value) {
  var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  validatePath(t, setPath, function (t) {
    return validate(value, t);
  }); // if (setPath.length === 0) {
  //     return validate(value, t);
  // }
  // const attr = setPath[0];
  // if (typeof t !== 'object') {
  //     throw new ValidationError(`Invalid sub path, not a nested type`, t, path);
  // }
  // switch (t.type) {
  //     case 'array':
  //         return validateSet(t.item, setPath.slice(1), value, path.concat([attr]));
  //     case 'optional':
  //         return validateSet(t.value, setPath, value, path);
  //     case 'map':
  //         return validateSet(t.value, setPath.slice(1), value, path.concat([attr]));
  //     case 'object':
  //         if (typeof attr !== 'string') {
  //             throw new Error(`Object attributes must be strings`);
  //         }
  //         if (!t.attributes[attr]) {
  //             throw new ValidationError(`Invalid sub path`, t, path.concat([attr]));
  //         }
  //         return validateSet(t.attributes[attr], setPath.slice(1), value, path.concat([attr]));
  //     default:
  //         throw new Error(`Invalid type schema ${JSON.stringify(t)}`);
  // }
};

exports.validateSet = validateSet;

var validate = function validate(value, t) {
  var path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

  if (typeof t === 'string') {
    switch (t) {
      case 'id':
      case 'string':
        return expectType(value, 'string', path);

      case 'boolean':
        return expectType(value, 'boolean', path);

      case 'int':
      case 'number':
      case 'float':
        return expectType(value, 'number', path);

      case 'object':
        return expectObject(value, path);

      case 'array':
        return expectArray(value, path);

      case 'id-array':
        expectArray(value, path);
        return value.forEach(function (v, i) {
          return expectType(v, 'string', path.concat(i));
        });

      case 'rich-text':
        return expectRichText(value, path);

      case 'any':
        return;

      default:
        throw new Error('Invalid schema: ' + t);
    }
  } else if (_typeof(t) === 'object') {
    switch (t.type) {
      case 'array':
        expectArray(value, path);
        return value.forEach(function (v) {
          return validate(v, t.item, path);
        });

      case 'optional':
        if (value != null) {
          validate(value, t.value, path);
        }

        return;

      case 'map':
        expectObject(value, path);
        return Object.keys(value).forEach(function (k) {
          return validate(value[k], t.value, path.concat([k]));
        });

      case 'object':
        expectObject(value, path);
        return Object.keys(t.attributes).forEach(function (k) {
          return validate(value[k], t.attributes[k], path.concat([k]));
        });

      default:
        throw new Error("Invalid schema: ".concat(JSON.stringify(t)));
    }
  }
};

exports.validate = validate;