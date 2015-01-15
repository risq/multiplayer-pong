(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [],
      objectPool = [];

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
  var keyPrefix = +new Date + '';

  /** Used as the size when optimizations are enabled for large arrays */
  var largeArraySize = 75;

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detect and test whitespace */
  var whitespace = (
    // whitespace
    ' \t\x0B\f\xA0\ufeff' +

    // line terminators
    '\n\r\u2028\u2029' +

    // unicode category "Zs" space separators
    '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
  );

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading whitespace and zeros to be removed */
  var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
    'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
    'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used as an internal `_.debounce` options object */
  var debounceOptions = {
    'leading': false,
    'maxWait': 0,
    'trailing': false
  };

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * An implementation of `_.contains` for cache objects that mimics the return
   * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
   *
   * @private
   * @param {Object} cache The cache object to inspect.
   * @param {*} value The value to search for.
   * @returns {number} Returns `0` if `value` is found, else `-1`.
   */
  function cacheIndexOf(cache, value) {
    var type = typeof value;
    cache = cache.cache;

    if (type == 'boolean' || value == null) {
      return cache[value] ? 0 : -1;
    }
    if (type != 'number' && type != 'string') {
      type = 'object';
    }
    var key = type == 'number' ? value : keyPrefix + value;
    cache = (cache = cache[type]) && cache[key];

    return type == 'object'
      ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1)
      : (cache ? 0 : -1);
  }

  /**
   * Adds a given value to the corresponding cache object.
   *
   * @private
   * @param {*} value The value to add to the cache.
   */
  function cachePush(value) {
    var cache = this.cache,
        type = typeof value;

    if (type == 'boolean' || value == null) {
      cache[value] = true;
    } else {
      if (type != 'number' && type != 'string') {
        type = 'object';
      }
      var key = type == 'number' ? value : keyPrefix + value,
          typeCache = cache[type] || (cache[type] = {});

      if (type == 'object') {
        (typeCache[key] || (typeCache[key] = [])).push(value);
      } else {
        typeCache[key] = true;
      }
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default callback when a given
   * collection is a string value.
   *
   * @private
   * @param {string} value The character to inspect.
   * @returns {number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` elements, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ac = a.criteria,
        bc = b.criteria,
        index = -1,
        length = ac.length;

    while (++index < length) {
      var value = ac[index],
          other = bc[index];

      if (value !== other) {
        if (value > other || typeof value == 'undefined') {
          return 1;
        }
        if (value < other || typeof other == 'undefined') {
          return -1;
        }
      }
    }
    // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
    // that causes it, under certain circumstances, to return the same value for
    // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
    //
    // This also ensures a stable sort in V8 and other engines.
    // See http://code.google.com/p/v8/issues/detail?id=90
    return a.index - b.index;
  }

  /**
   * Creates a cache object to optimize linear searches of large arrays.
   *
   * @private
   * @param {Array} [array=[]] The array to search.
   * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
   */
  function createCache(array) {
    var index = -1,
        length = array.length,
        first = array[0],
        mid = array[(length / 2) | 0],
        last = array[length - 1];

    if (first && typeof first == 'object' &&
        mid && typeof mid == 'object' && last && typeof last == 'object') {
      return false;
    }
    var cache = getObject();
    cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

    var result = getObject();
    result.array = array;
    result.cache = cache;
    result.push = cachePush;

    while (++index < length) {
      result.push(array[index]);
    }
    return result;
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {string} match The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Gets an object from the object pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Object} The object from the pool.
   */
  function getObject() {
    return objectPool.pop() || {
      'array': null,
      'cache': null,
      'criteria': null,
      'false': false,
      'index': 0,
      'null': false,
      'number': null,
      'object': null,
      'push': null,
      'string': null,
      'true': false,
      'undefined': false,
      'value': null
    };
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Releases the given object back to the object pool.
   *
   * @private
   * @param {Object} [object] The object to release.
   */
  function releaseObject(object) {
    var cache = object.cache;
    if (cache) {
      releaseObject(cache);
    }
    object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
    if (objectPool.length < maxPoolSize) {
      objectPool.push(object);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given context object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=root] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.io/#x11.1.5.
    context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /**
     * Used for `Array` method references.
     *
     * Normally `Array.prototype` would suffice, however, using an array literal
     * avoids issues in Narwhal.
     */
    var arrayRef = [];

    /** Used for native method references */
    var objectProto = Object.prototype;

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to resolve the internal [[Class]] of values */
    var toString = objectProto.toString;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        fnToString = Function.prototype.toString,
        getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectProto.hasOwnProperty,
        push = arrayRef.push,
        setTimeout = context.setTimeout,
        splice = arrayRef.splice,
        unshift = arrayRef.unshift;

    /** Used to set meta data on functions */
    var defineProperty = (function() {
      // IE 8 only accepts DOM elements
      try {
        var o = {},
            func = isNative(func = Object.defineProperty) && func,
            result = func(o, o, o) && func;
      } catch(e) { }
      return result;
    }());

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
        nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[funcClass] = Function;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object which wraps the given value to enable intuitive
     * method chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
     * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
     * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
     * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
     * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
     * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
     * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
     * and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
     * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
     * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
     * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
     * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
     * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
     * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
     * `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * provided, otherwise they return unwrapped values.
     *
     * Explicit chaining can be enabled by using the `_.chain` method.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {*} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     * @example
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // returns an unwrapped value
     * wrapped.reduce(function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * // returns a wrapped value
     * var squares = wrapped.map(function(num) {
     *   return num * num;
     * });
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {*} value The value to wrap in a `lodash` instance.
     * @param {boolean} chainAll A flag to enable chaining for all methods
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value, chainAll) {
      this.__chain__ = !!chainAll;
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type string
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `_.bind` that creates the bound function and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new bound function.
     */
    function baseBind(bindData) {
      var func = bindData[0],
          partialArgs = bindData[2],
          thisArg = bindData[4];

      function bound() {
        // `Function#bind` spec
        // http://es5.github.io/#x15.3.4.5
        if (partialArgs) {
          // avoid `arguments` object deoptimizations by using `slice` instead
          // of `Array.prototype.slice.call` and not assigning `arguments` to a
          // variable as a ternary expression
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        // mimic the constructor's `return` behavior
        // http://es5.github.io/#x13.2.2
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          var thisBinding = baseCreate(func.prototype),
              result = func.apply(thisBinding, args || arguments);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisArg, args || arguments);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.clone` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {*} Returns the cloned value.
     */
    function baseClone(value, isDeep, callback, stackA, stackB) {
      if (callback) {
        var result = callback(value);
        if (typeof result != 'undefined') {
          return result;
        }
      }
      // inspect [[Class]]
      var isObj = isObject(value);
      if (isObj) {
        var className = toString.call(value);
        if (!cloneableClasses[className]) {
          return value;
        }
        var ctor = ctorByClass[className];
        switch (className) {
          case boolClass:
          case dateClass:
            return new ctor(+value);

          case numberClass:
          case stringClass:
            return new ctor(value);

          case regexpClass:
            result = ctor(value.source, reFlags.exec(value));
            result.lastIndex = value.lastIndex;
            return result;
        }
      } else {
        return value;
      }
      var isArr = isArray(value);
      if (isDeep) {
        // check for circular references and return corresponding clone
        var initedStack = !stackA;
        stackA || (stackA = getArray());
        stackB || (stackB = getArray());

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        result = isArr ? ctor(value.length) : {};
      }
      else {
        result = isArr ? slice(value) : assign({}, value);
      }
      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // exit for shallow clone
      if (!isDeep) {
        return result;
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
      });

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.create` without support for assigning
     * properties to the created object.
     *
     * @private
     * @param {Object} prototype The object to inherit from.
     * @returns {Object} Returns the new object.
     */
    function baseCreate(prototype, properties) {
      return isObject(prototype) ? nativeCreate(prototype) : {};
    }
    // fallback for browsers without `Object.create`
    if (!nativeCreate) {
      baseCreate = (function() {
        function Object() {}
        return function(prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object;
            Object.prototype = null;
          }
          return result || context.Object();
        };
      }());
    }

    /**
     * The base implementation of `_.createCallback` without support for creating
     * "_.pluck" or "_.where" style callbacks.
     *
     * @private
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     */
    function baseCreateCallback(func, thisArg, argCount) {
      if (typeof func != 'function') {
        return identity;
      }
      // exit early for no `thisArg` or already bound by `Function#bind`
      if (typeof thisArg == 'undefined' || !('prototype' in func)) {
        return func;
      }
      var bindData = func.__bindData__;
      if (typeof bindData == 'undefined') {
        if (support.funcNames) {
          bindData = !func.name;
        }
        bindData = bindData || !support.funcDecomp;
        if (!bindData) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            bindData = !reFuncName.test(source);
          }
          if (!bindData) {
            // checks if `func` references the `this` keyword and stores the result
            bindData = reThis.test(source);
            setBindData(func, bindData);
          }
        }
      }
      // exit early if there are no `this` references or `func` is bound
      if (bindData === false || (bindData !== true && bindData[1] & 1)) {
        return func;
      }
      switch (argCount) {
        case 1: return function(value) {
          return func.call(thisArg, value);
        };
        case 2: return function(a, b) {
          return func.call(thisArg, a, b);
        };
        case 3: return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(thisArg, accumulator, value, index, collection);
        };
      }
      return bind(func, thisArg);
    }

    /**
     * The base implementation of `createWrapper` that creates the wrapper and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new function.
     */
    function baseCreateWrapper(bindData) {
      var func = bindData[0],
          bitmask = bindData[1],
          partialArgs = bindData[2],
          partialRightArgs = bindData[3],
          thisArg = bindData[4],
          arity = bindData[5];

      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          key = func;

      function bound() {
        var thisBinding = isBind ? thisArg : this;
        if (partialArgs) {
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        if (partialRightArgs || isCurry) {
          args || (args = slice(arguments));
          if (partialRightArgs) {
            push.apply(args, partialRightArgs);
          }
          if (isCurry && args.length < arity) {
            bitmask |= 16 & ~32;
            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
          }
        }
        args || (args = arguments);
        if (isBindKey) {
          func = thisBinding[key];
        }
        if (this instanceof bound) {
          thisBinding = baseCreate(func.prototype);
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.difference` that accepts a single array
     * of values to exclude.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {Array} [values] The array of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     */
    function baseDifference(array, values) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          isLarge = length >= largeArraySize && indexOf === baseIndexOf,
          result = [];

      if (isLarge) {
        var cache = createCache(values);
        if (cache) {
          indexOf = cacheIndexOf;
          values = cache;
        } else {
          isLarge = false;
        }
      }
      while (++index < length) {
        var value = array[index];
        if (indexOf(values, value) < 0) {
          result.push(value);
        }
      }
      if (isLarge) {
        releaseObject(values);
      }
      return result;
    }

    /**
     * The base implementation of `_.flatten` without support for callback
     * shorthands or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
     * @param {number} [fromIndex=0] The index to start from.
     * @returns {Array} Returns a new flattened array.
     */
    function baseFlatten(array, isShallow, isStrict, fromIndex) {
      var index = (fromIndex || 0) - 1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];

        if (value && typeof value == 'object' && typeof value.length == 'number'
            && (isArray(value) || isArguments(value))) {
          // recursively flatten arrays (susceptible to call stack limits)
          if (!isShallow) {
            value = baseFlatten(value, isShallow, isStrict);
          }
          var valIndex = -1,
              valLength = value.length,
              resIndex = result.length;

          result.length += valLength;
          while (++valIndex < valLength) {
            result[resIndex++] = value[valIndex];
          }
        } else if (!isStrict) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * The base implementation of `_.isEqual`, without support for `thisArg` binding,
     * that allows partial "_.where" style comparisons.
     *
     * @private
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
     * @param {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     */
    function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      if (callback) {
        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          !(a && objectTypes[type]) &&
          !(b && objectTypes[otherType])) {
        return false;
      }
      // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
      // http://es5.github.io/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
            bWrapped = hasOwnProperty.call(b, '__wrapped__');

        if (aWrapped || bWrapped) {
          return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = a.constructor,
            ctorB = b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB &&
              !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
              ('constructor' in a && 'constructor' in b)
            ) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
      var initedStack = !stackA;
      stackA || (stackA = getArray());
      stackB || (stackB = getArray());

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        // compare lengths to determine if a deep comparison is necessary
        length = a.length;
        size = b.length;
        result = size == length;

        if (result || isWhere) {
          // deep compare the contents, ignoring non-numeric properties
          while (size--) {
            var index = length,
                value = b[size];

            if (isWhere) {
              while (index--) {
                if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                  break;
                }
              }
            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
              break;
            }
          }
        }
      }
      else {
        // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
        // which, in this case, is more costly
        forIn(b, function(value, key, b) {
          if (hasOwnProperty.call(b, key)) {
            // count the number of properties.
            size++;
            // deep compare each property value.
            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
          }
        });

        if (result && !isWhere) {
          // ensure both objects have the same number of properties
          forIn(a, function(value, key, a) {
            if (hasOwnProperty.call(a, key)) {
              // `size` will be `-1` if `a` has more properties than `b`
              return (result = --size > -1);
            }
          });
        }
      }
      stackA.pop();
      stackB.pop();

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.merge` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates values with source counterparts.
     */
    function baseMerge(object, source, callback, stackA, stackB) {
      (isArray(source) ? forEach : forOwn)(source, function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            var isShallow;
            if (callback) {
              result = callback(value, source);
              if ((isShallow = typeof result != 'undefined')) {
                value = result;
              }
            }
            if (!isShallow) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!isShallow) {
              baseMerge(value, source, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }

    /**
     * The base implementation of `_.random` without argument juggling or support
     * for returning floating-point numbers.
     *
     * @private
     * @param {number} min The minimum possible value.
     * @param {number} max The maximum possible value.
     * @returns {number} Returns a random number.
     */
    function baseRandom(min, max) {
      return min + floor(nativeRandom() * (max - min + 1));
    }

    /**
     * The base implementation of `_.uniq` without support for callback shorthands
     * or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function} [callback] The function called per iteration.
     * @returns {Array} Returns a duplicate-value-free array.
     */
    function baseUniq(array, isSorted, callback) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          result = [];

      var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
          seen = (callback || isLarge) ? getArray() : result;

      if (isLarge) {
        var cache = createCache(seen);
        indexOf = cacheIndexOf;
        seen = cache;
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      if (isLarge) {
        releaseArray(seen.array);
        releaseObject(seen);
      } else if (callback) {
        releaseArray(seen);
      }
      return result;
    }

    /**
     * Creates a function that aggregates a collection, creating an object composed
     * of keys generated from the results of running each element of the collection
     * through a callback. The given `setter` function sets the keys and values
     * of the composed object.
     *
     * @private
     * @param {Function} setter The setter function.
     * @returns {Function} Returns the new aggregator function.
     */
    function createAggregator(setter) {
      return function(collection, callback, thisArg) {
        var result = {};
        callback = lodash.createCallback(callback, thisArg, 3);

        var index = -1,
            length = collection ? collection.length : 0;

        if (typeof length == 'number') {
          while (++index < length) {
            var value = collection[index];
            setter(result, value, callback(value, index, collection), collection);
          }
        } else {
          forOwn(collection, function(value, key, collection) {
            setter(result, value, callback(value, key, collection), collection);
          });
        }
        return result;
      };
    }

    /**
     * Creates a function that, when called, either curries or invokes `func`
     * with an optional `this` binding and partially applied arguments.
     *
     * @private
     * @param {Function|string} func The function or method name to reference.
     * @param {number} bitmask The bitmask of method flags to compose.
     *  The bitmask may be composed of the following flags:
     *  1 - `_.bind`
     *  2 - `_.bindKey`
     *  4 - `_.curry`
     *  8 - `_.curry` (bound)
     *  16 - `_.partial`
     *  32 - `_.partialRight`
     * @param {Array} [partialArgs] An array of arguments to prepend to those
     *  provided to the new function.
     * @param {Array} [partialRightArgs] An array of arguments to append to those
     *  provided to the new function.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {number} [arity] The arity of `func`.
     * @returns {Function} Returns the new function.
     */
    function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          isPartial = bitmask & 16,
          isPartialRight = bitmask & 32;

      if (!isBindKey && !isFunction(func)) {
        throw new TypeError;
      }
      if (isPartial && !partialArgs.length) {
        bitmask &= ~16;
        isPartial = partialArgs = false;
      }
      if (isPartialRight && !partialRightArgs.length) {
        bitmask &= ~32;
        isPartialRight = partialRightArgs = false;
      }
      var bindData = func && func.__bindData__;
      if (bindData && bindData !== true) {
        // clone `bindData`
        bindData = slice(bindData);
        if (bindData[2]) {
          bindData[2] = slice(bindData[2]);
        }
        if (bindData[3]) {
          bindData[3] = slice(bindData[3]);
        }
        // set `thisBinding` is not previously bound
        if (isBind && !(bindData[1] & 1)) {
          bindData[4] = thisArg;
        }
        // set if previously bound but not currently (subsequent curried functions)
        if (!isBind && bindData[1] & 1) {
          bitmask |= 8;
        }
        // set curried arity if not yet set
        if (isCurry && !(bindData[1] & 4)) {
          bindData[5] = arity;
        }
        // append partial left arguments
        if (isPartial) {
          push.apply(bindData[2] || (bindData[2] = []), partialArgs);
        }
        // append partial right arguments
        if (isPartialRight) {
          unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
        }
        // merge flags
        bindData[1] |= bitmask;
        return createWrapper.apply(null, bindData);
      }
      // fast path for `_.bind`
      var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
      return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} match The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
     * customized, this method returns the custom method, otherwise it returns
     * the `baseIndexOf` function.
     *
     * @private
     * @returns {Function} Returns the "indexOf" function.
     */
    function getIndexOf() {
      var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
      return result;
    }

    /**
     * Checks if `value` is a native function.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
     */
    function isNative(value) {
      return typeof value == 'function' && reNative.test(value);
    }

    /**
     * Sets `this` binding data on a given function.
     *
     * @private
     * @param {Function} func The function to set data on.
     * @param {Array} value The data array to set.
     */
    var setBindData = !defineProperty ? noop : function(func, value) {
      descriptor.value = value;
      defineProperty(func, '__bindData__', descriptor);
    };

    /**
     * A fallback implementation of `isPlainObject` which checks if a given value
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      var ctor,
          result;

      // avoid non Object objects, `arguments` objects, and DOM elements
      if (!(value && toString.call(value) == objectClass) ||
          (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
        return false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return typeof result == 'undefined' || hasOwnProperty.call(value, result);
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} match The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == argsClass || false;
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == arrayClass || false;
    };

    /**
     * A fallback implementation of `Object.keys` which produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     */
    var shimKeys = function(object) {
      var index, iterable = object, result = [];
      if (!iterable) return result;
      if (!(objectTypes[typeof object])) return result;
        for (index in iterable) {
          if (hasOwnProperty.call(iterable, index)) {
            result.push(index);
          }
        }
      return result
    };

    /**
     * Creates an array composed of the own enumerable property names of an object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      return nativeKeys(object);
    };

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /** Used to match HTML entities and HTML characters */
    var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
        reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a callback is provided it will be executed to produce the
     * assigned values. The callback is bound to `thisArg` and invoked with two
     * arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
     * // => { 'name': 'fred', 'employer': 'slate' }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var object = { 'name': 'barney' };
     * defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var assign = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
        var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
      } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
        callback = args[--argsLength];
      }
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
        }
        }
      }
      return result
    };

    /**
     * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a callback
     * is provided it will be executed to produce the cloned values. If the
     * callback returns `undefined` cloning will be handled by the method instead.
     * The callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var shallow = _.clone(characters);
     * shallow[0] === characters[0];
     * // => true
     *
     * var deep = _.clone(characters, true);
     * deep[0] === characters[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, isDeep, callback, thisArg) {
      // allows working with "Collections" methods without using their `index`
      // and `collection` arguments for `isDeep` and `callback`
      if (typeof isDeep != 'boolean' && isDeep != null) {
        thisArg = callback;
        callback = isDeep;
        isDeep = false;
      }
      return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates a deep clone of `value`. If a callback is provided it will be
     * executed to produce the cloned values. If the callback returns `undefined`
     * cloning will be handled by the method instead. The callback is bound to
     * `thisArg` and invoked with one argument; (value).
     *
     * Note: This method is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the deep cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var deep = _.cloneDeep(characters);
     * deep[0] === characters[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates an object that inherits from the given `prototype` object. If a
     * `properties` object is provided its own enumerable properties are assigned
     * to the created object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} prototype The object to inherit from.
     * @param {Object} [properties] The properties to assign to the object.
     * @returns {Object} Returns the new object.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties ? assign(result, properties) : result;
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var object = { 'name': 'barney' };
     * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var defaults = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (typeof result[index] == 'undefined') result[index] = iterable[index];
        }
        }
      }
      return result
    };

    /**
     * This method is like `_.findIndex` except that it returns the key of the
     * first element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': false },
     *   'fred': {    'age': 40, 'blocked': true },
     *   'pebbles': { 'age': 1,  'blocked': false }
     * };
     *
     * _.findKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => 'barney' (property order is not guaranteed across environments)
     *
     * // using "_.where" callback shorthand
     * _.findKey(characters, { 'age': 1 });
     * // => 'pebbles'
     *
     * // using "_.pluck" callback shorthand
     * _.findKey(characters, 'blocked');
     * // => 'fred'
     */
    function findKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * This method is like `_.findKey` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': true },
     *   'fred': {    'age': 40, 'blocked': false },
     *   'pebbles': { 'age': 1,  'blocked': true }
     * };
     *
     * _.findLastKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => returns `pebbles`, assuming `_.findKey` returns `barney`
     *
     * // using "_.where" callback shorthand
     * _.findLastKey(characters, { 'age': 40 });
     * // => 'fred'
     *
     * // using "_.pluck" callback shorthand
     * _.findLastKey(characters, 'blocked');
     * // => 'pebbles'
     */
    function findLastKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwnRight(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over own and inherited enumerable properties of an object,
     * executing the callback for each property. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, key, object). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forIn(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
     */
    var forIn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        for (index in iterable) {
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forIn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forInRight(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
     */
    function forInRight(object, callback, thisArg) {
      var pairs = [];

      forIn(object, function(value, key) {
        pairs.push(key, value);
      });

      var length = pairs.length;
      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(pairs[length--], pairs[length], object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Iterates over own enumerable properties of an object, executing the callback
     * for each property. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
     */
    var forOwn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forOwn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
     */
    function forOwnRight(object, callback, thisArg) {
      var props = keys(object),
          length = props.length;

      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        var key = props[length];
        if (callback(object[key], key, object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Creates a sorted array of property names of all enumerable properties,
     * own and inherited, of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified property name exists as a direct property of `object`,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to check.
     * @returns {boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, key) {
      return object ? hasOwnProperty.call(object, key) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     * _.invert({ 'first': 'fred', 'second': 'barney' });
     * // => { 'fred': 'first', 'barney': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        value && typeof value == 'object' && toString.call(value) == boolClass || false;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value && typeof value == 'object' && toString.call(value) == dateClass || false;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value && value.nodeType === 1 || false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|string} value The value to inspect.
     * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass || className == argsClass ) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If a callback is provided it will be executed
     * to compare values. If the callback returns `undefined` comparisons will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var copy = { 'name': 'fred' };
     *
     * object == copy;
     * // => false
     *
     * _.isEqual(object, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg) {
      return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite` which will return true for
     * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.io/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return !!(value && objectTypes[typeof value]);
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN` which will return `true` for
     * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value;
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        value && typeof value == 'object' && toString.call(value) == numberClass || false;
    }

    /**
     * Checks if `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * _.isPlainObject(new Shape);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass)) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/fred/);
     * // => true
     */
    function isRegExp(value) {
      return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('fred');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' ||
        value && typeof value == 'object' && toString.call(value) == stringClass || false;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Creates an object with the same keys as `object` and values generated by
     * running each own enumerable property of `object` through the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new object with values of the results of each `callback` execution.
     * @example
     *
     * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     *
     * var characters = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // using "_.pluck" callback shorthand
     * _.mapValues(characters, 'age');
     * // => { 'fred': 40, 'pebbles': 1 }
     */
    function mapValues(object, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg, 3);

      forOwn(object, function(value, key, object) {
        result[key] = callback(value, key, object);
      });
      return result;
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined` into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a callback is
     * provided it will be executed to produce the merged values of the destination
     * and source properties. If the callback returns `undefined` merging will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'characters': [
     *     { 'name': 'barney' },
     *     { 'name': 'fred' }
     *   ]
     * };
     *
     * var ages = {
     *   'characters': [
     *     { 'age': 36 },
     *     { 'age': 40 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object) {
      var args = arguments,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      // allows working with `_.reduce` and `_.reduceRight` without using
      // their `index` and `collection` arguments
      if (typeof args[2] != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
      var sources = slice(arguments, 1, length),
          index = -1,
          stackA = getArray(),
          stackB = getArray();

      while (++index < length) {
        baseMerge(object, sources[index], callback, stackA, stackB);
      }
      releaseArray(stackA);
      releaseArray(stackB);
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` omitting the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The properties to omit or the
     *  function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
     * // => { 'name': 'fred' }
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'fred' }
     */
    function omit(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var props = [];
        forIn(object, function(value, key) {
          props.push(key);
        });
        props = baseDifference(props, baseFlatten(arguments, true, false, 1));

        var index = -1,
            length = props.length;

        while (++index < length) {
          var key = props[index];
          result[key] = object[key];
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (!callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates a two dimensional array of an object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'barney': 36, 'fred': 40 });
     * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` picking the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The function called per
     *  iteration or property names to pick, specified as individual property
     *  names or arrays of property names.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
     * // => { 'name': 'fred' }
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'fred' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = -1,
            props = baseFlatten(arguments, true, false, 1),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * An alternative to `_.reduce` this method transforms `object` to a new
     * `accumulator` object which is the result of running each of its own
     * enumerable properties through a callback, with each callback execution
     * potentially mutating the `accumulator` object. The callback is bound to
     * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
     * Callbacks may exit iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] The custom accumulator value.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
     *   num *= num;
     *   if (num % 2) {
     *     return result.push(num) < 3;
     *   }
     * });
     * // => [1, 9, 25]
     *
     * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     * });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function transform(object, callback, accumulator, thisArg) {
      var isArr = isArray(object);
      if (accumulator == null) {
        if (isArr) {
          accumulator = [];
        } else {
          var ctor = object && object.constructor,
              proto = ctor && ctor.prototype;

          accumulator = baseCreate(proto);
        }
      }
      if (callback) {
        callback = lodash.createCallback(callback, thisArg, 4);
        (isArr ? forEach : forOwn)(object, function(value, index, object) {
          return callback(accumulator, value, index, object);
        });
      }
      return accumulator;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (property order is not guaranteed across environments)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
     *   to retrieve, specified as individual indexes or arrays of indexes.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['fred', 'barney', 'pebbles'], 0, 2);
     * // => ['fred', 'pebbles']
     */
    function at(collection) {
      var args = arguments,
          index = -1,
          props = baseFlatten(args, true, false, 1),
          length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
          result = Array(length);

      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given value is present in a collection using strict equality
     * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
     * offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {*} target The value to check for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
     * // => true
     *
     * _.contains('pebbles', 'eb');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          indexOf = getIndexOf(),
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (isArray(collection)) {
        result = indexOf(collection, target, fromIndex) > -1;
      } else if (typeof length == 'number') {
        result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
      } else {
        forOwn(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of `collection` through the callback. The corresponding value
     * of each key is the number of times the key was returned by the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });

    /**
     * Checks if the given callback returns truey value for **all** elements of
     * a collection. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if all elements passed the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes']);
     * // => false
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(characters, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(characters, { 'age': 36 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning an array of all elements
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(characters, 'blocked');
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     *
     * // using "_.where" callback shorthand
     * _.filter(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning the first element that
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect, findWhere
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.find(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => { 'name': 'barney', 'age': 36, 'blocked': false }
     *
     * // using "_.where" callback shorthand
     * _.find(characters, { 'age': 1 });
     * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
     *
     * // using "_.pluck" callback shorthand
     * _.find(characters, 'blocked');
     * // => { 'name': 'fred', 'age': 40, 'blocked': true }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * This method is like `_.find` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(num) {
     *   return num % 2 == 1;
     * });
     * // => 3
     */
    function findLast(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forEachRight(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result = value;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over elements of a collection, executing the callback for each
     * element. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * Note: As with other "Collections" methods, objects with a `length` property
     * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
     * may be used for object iteration.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
     * // => logs each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
     * // => logs each number and returns the object (property order is not guaranteed across environments)
     */
    function forEach(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        forOwn(collection, callback);
      }
      return collection;
    }

    /**
     * This method is like `_.forEach` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias eachRight
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
     * // => logs each number from right to left and returns '3,2,1'
     */
    function forEachRight(collection, callback, thisArg) {
      var length = collection ? collection.length : 0;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (length--) {
          if (callback(collection[length], length, collection) === false) {
            break;
          }
        }
      } else {
        var props = keys(collection);
        length = props.length;
        forOwn(collection, function(value, key, collection) {
          key = props ? props[--length] : --length;
          return callback(collection[key], key, collection);
        });
      }
      return collection;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of a collection through the callback. The corresponding value
     * of each key is an array of the elements responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of the collection through the given callback. The corresponding
     * value of each key is the last element responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * var keys = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.indexBy(keys, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     */
    var indexBy = createAggregator(function(result, value, key) {
      result[key] = value;
    });

    /**
     * Invokes the method named by `methodName` on each element in the `collection`
     * returning an array of the results of each invoked method. Additional arguments
     * will be provided to each invoked method. If `methodName` is a function it
     * will be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|string} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {...*} [arg] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the collection
     * through the callback. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (property order is not guaranteed across environments)
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(characters, 'name');
     * // => ['barney', 'fred']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        var result = Array(length);
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        result = [];
        forOwn(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of a collection. If the collection is empty or
     * falsey `-Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.max(characters, function(chr) { return chr.age; });
     * // => { 'name': 'fred', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(characters, 'age');
     * // => { 'name': 'fred', 'age': 40 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of a collection. If the collection is empty or
     * falsey `Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.min(characters, function(chr) { return chr.age; });
     * // => { 'name': 'barney', 'age': 36 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(characters, 'age');
     * // => { 'name': 'barney', 'age': 36 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the collection.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {string} property The name of the property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.pluck(characters, 'name');
     * // => ['barney', 'fred']
     */
    var pluck = map;

    /**
     * Reduces a collection to a value which is the accumulated result of running
     * each element in the collection through the callback, where each successive
     * callback execution consumes the return value of the previous execution. If
     * `accumulator` is not provided the first element of the collection will be
     * used as the initial `accumulator` value. The callback is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      if (!collection) return accumulator;
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      var index = -1,
          length = collection.length;

      if (typeof length == 'number') {
        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is like `_.reduce` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);
      forEachRight(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter` this method returns the elements of a
     * collection that the callback does **not** return truey for.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that failed the callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(characters, 'blocked');
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     *
     * // using "_.where" callback shorthand
     * _.reject(characters, { 'age': 36 });
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Retrieves a random element or `n` random elements from a collection.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to sample.
     * @param {number} [n] The number of elements to sample.
     * @param- {Object} [guard] Allows working with functions like `_.map`
     *  without using their `index` arguments as `n`.
     * @returns {Array} Returns the random sample(s) of `collection`.
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     *
     * _.sample([1, 2, 3, 4], 2);
     * // => [3, 1]
     */
    function sample(collection, n, guard) {
      if (collection && typeof collection.length != 'number') {
        collection = values(collection);
      }
      if (n == null || guard) {
        return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
      }
      var result = shuffle(collection);
      result.length = nativeMin(nativeMax(0, n), result.length);
      return result;
    }

    /**
     * Creates an array of shuffled values, using a version of the Fisher-Yates
     * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = baseRandom(0, ++index);
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to inspect.
     * @returns {number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the callback returns a truey value for **any** element of a
     * collection. The function returns as soon as it finds a passing value and
     * does not iterate over the entire collection. The callback is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if any element passed the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(characters, 'blocked');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(characters, { 'age': 1 });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in a collection through the callback. This method
     * performs a stable sort, that is, it will preserve the original sort order
     * of equal elements. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an array of property names is provided for `callback` the collection
     * will be sorted by each property value.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Array|Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'barney',  'age': 26 },
     *   { 'name': 'fred',    'age': 30 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(_.sortBy(characters, 'age'), _.values);
     * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
     *
     * // sorting by multiple properties
     * _.map(_.sortBy(characters, ['name', 'age']), _.values);
     * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          isArr = isArray(callback),
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      if (!isArr) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      forEach(collection, function(value, key, collection) {
        var object = result[++index] = getObject();
        if (isArr) {
          object.criteria = map(callback, function(key) { return value[key]; });
        } else {
          (object.criteria = getArray())[0] = callback(value, key, collection);
        }
        object.index = index;
        object.value = value;
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        var object = result[length];
        result[length] = object.value;
        if (!isArr) {
          releaseArray(object.criteria);
        }
        releaseObject(object);
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return slice(collection);
      }
      return values(collection);
    }

    /**
     * Performs a deep comparison of each element in a `collection` to the given
     * `properties` object, returning an array of all elements that have equivalent
     * property values.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Object} props The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given properties.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * _.where(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
     *
     * _.where(characters, { 'pets': ['dino'] });
     * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values removed. The values `false`, `null`,
     * `0`, `""`, `undefined`, and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array excluding all values of the provided arrays using strict
     * equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {...Array} [values] The arrays of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      return baseDifference(array, baseFlatten(arguments, true, true, 1));
    }

    /**
     * This method is like `_.find` except that it returns the index of the first
     * element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.findIndex(characters, function(chr) {
     *   return chr.age < 20;
     * });
     * // => 2
     *
     * // using "_.where" callback shorthand
     * _.findIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findIndex(characters, 'blocked');
     * // => 1
     */
    function findIndex(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        if (callback(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * This method is like `_.findIndex` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': true },
     *   { 'name': 'fred',    'age': 40, 'blocked': false },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
     * ];
     *
     * _.findLastIndex(characters, function(chr) {
     *   return chr.age > 30;
     * });
     * // => 1
     *
     * // using "_.where" callback shorthand
     * _.findLastIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findLastIndex(characters, 'blocked');
     * // => 2
     */
    function findLastIndex(array, callback, thisArg) {
      var length = array ? array.length : 0;
      callback = lodash.createCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(array[length], length, array)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * Gets the first element or first `n` elements of an array. If a callback
     * is provided elements at the beginning of the array are returned as long
     * as the callback returns truey. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(characters, 'blocked');
     * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
     * // => ['barney', 'fred']
     */
    function first(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[0] : undefined;
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truey, the array will only be flattened a single level. If a callback
     * is provided each element of the array is passed through the callback before
     * flattening. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(characters, 'pets');
     * // => ['hoppy', 'baby puss', 'dino']
     */
    function flatten(array, isShallow, callback, thisArg) {
      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
        isShallow = false;
      }
      if (callback != null) {
        array = map(array, callback, thisArg);
      }
      return baseFlatten(array, isShallow);
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the array is already sorted
     * providing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {boolean|number} [fromIndex=0] The index to search from or `true`
     *  to perform a binary search on a sorted array.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      if (typeof fromIndex == 'number') {
        var length = array ? array.length : 0;
        fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
      } else if (fromIndex) {
        var index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      return baseIndexOf(array, value, fromIndex);
    }

    /**
     * Gets all but the last element or last `n` elements of an array. If a
     * callback is provided elements at the end of the array are excluded from
     * the result as long as the callback returns truey. The callback is bound
     * to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(characters, 'blocked');
     * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
     * // => ['barney', 'fred']
     */
    function initial(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Creates an array of unique values present in all provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of shared values.
     * @example
     *
     * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2]
     */
    function intersection() {
      var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = getArray(),
          indexOf = getIndexOf(),
          trustIndexOf = indexOf === baseIndexOf,
          seen = getArray();

      while (++argsIndex < argsLength) {
        var value = arguments[argsIndex];
        if (isArray(value) || isArguments(value)) {
          args.push(value);
          caches.push(trustIndexOf && value.length >= largeArraySize &&
            createCache(argsIndex ? args[argsIndex] : seen));
        }
      }
      var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [];

      outer:
      while (++index < length) {
        var cache = caches[0];
        value = array[index];

        if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
          argsIndex = argsLength;
          (cache || seen).push(value);
          while (--argsIndex) {
            cache = caches[argsIndex];
            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      while (argsLength--) {
        cache = caches[argsLength];
        if (cache) {
          releaseObject(cache);
        }
      }
      releaseArray(caches);
      releaseArray(seen);
      return result;
    }

    /**
     * Gets the last element or last `n` elements of an array. If a callback is
     * provided elements at the end of the array are returned as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.last(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.last(characters, { 'employer': 'na' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function last(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[length - 1] : undefined;
        }
      }
      return slice(array, nativeMax(0, length - n));
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=array.length-1] The index to search from.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Removes all provided values from the given array using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {...*} [value] The values to remove.
     * @returns {Array} Returns `array`.
     * @example
     *
     * var array = [1, 2, 3, 1, 2, 3];
     * _.pull(array, 2, 3);
     * console.log(array);
     * // => [1, 1]
     */
    function pull(array) {
      var args = arguments,
          argsIndex = 0,
          argsLength = args.length,
          length = array ? array.length : 0;

      while (++argsIndex < argsLength) {
        var index = -1,
            value = args[argsIndex];
        while (++index < length) {
          if (array[index] === value) {
            splice.call(array, index--, 1);
            length--;
          }
        }
      }
      return array;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`. If `start` is less than `stop` a
     * zero-length range is created unless a negative `step` is specified.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {number} [start=0] The start of the range.
     * @param {number} end The end of the range.
     * @param {number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = typeof step == 'number' ? step : (+step || 1);

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so engines like Chakra and V8 avoid slower modes
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / (step || 1))),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * Removes all elements from an array that the callback returns truey for
     * and returns an array of removed elements. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of removed elements.
     * @example
     *
     * var array = [1, 2, 3, 4, 5, 6];
     * var evens = _.remove(array, function(num) { return num % 2 == 0; });
     *
     * console.log(array);
     * // => [1, 3, 5]
     *
     * console.log(evens);
     * // => [2, 4, 6]
     */
    function remove(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        var value = array[index];
        if (callback(value, index, array)) {
          result.push(value);
          splice.call(array, index--, 1);
          length--;
        }
      }
      return result;
    }

    /**
     * The opposite of `_.initial` this method gets all but the first element or
     * first `n` elements of an array. If a callback function is provided elements
     * at the beginning of the array are excluded from the result as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.rest(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.rest(characters, { 'employer': 'slate' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which a value
     * should be inserted into a given sorted array in order to maintain the sort
     * order of the array. If a callback is provided it will be executed for
     * `value` and each element of `array` to compute their sort ranking. The
     * callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to inspect.
     * @param {*} value The value to evaluate.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index at which `value` should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Creates an array of unique values, in order, of the provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of combined values.
     * @example
     *
     * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2, 3, 5, 4]
     */
    function union() {
      return baseUniq(baseFlatten(arguments, true, true));
    }

    /**
     * Creates a duplicate-value-free version of an array using strict equality
     * for comparisons, i.e. `===`. If the array is sorted, providing
     * `true` for `isSorted` will use a faster algorithm. If a callback is provided
     * each element of `array` is passed through the callback before uniqueness
     * is computed. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
     * // => ['A', 'b', 'C']
     *
     * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2.5, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
        isSorted = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      return baseUniq(array, isSorted, callback);
    }

    /**
     * Creates an array excluding all provided values using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {...*} [value] The values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      return baseDifference(array, slice(arguments, 1));
    }

    /**
     * Creates an array that is the symmetric difference of the provided arrays.
     * See http://en.wikipedia.org/wiki/Symmetric_difference.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of values.
     * @example
     *
     * _.xor([1, 2, 3], [5, 2, 1, 4]);
     * // => [3, 5, 4]
     *
     * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
     * // => [1, 4, 5]
     */
    function xor() {
      var index = -1,
          length = arguments.length;

      while (++index < length) {
        var array = arguments[index];
        if (isArray(array) || isArguments(array)) {
          var result = result
            ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result)))
            : array;
        }
      }
      return result || [];
    }

    /**
     * Creates an array of grouped elements, the first of which contains the first
     * elements of the given arrays, the second of which contains the second
     * elements of the given arrays, and so on.
     *
     * @static
     * @memberOf _
     * @alias unzip
     * @category Arrays
     * @param {...Array} [array] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['fred', 'barney'], [30, 40], [true, false]);
     * // => [['fred', 30, true], ['barney', 40, false]]
     */
    function zip() {
      var array = arguments.length > 1 ? arguments : arguments[0],
          index = -1,
          length = array ? max(pluck(array, 'length')) : 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Provide
     * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
     * or two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['fred', 'barney'], [30, 40]);
     * // => { 'fred': 30, 'barney': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      if (!values && length && !isArray(keys[0])) {
        values = [];
      }
      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else if (key) {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that executes `func`, with  the `this` binding and
     * arguments of the created function, only after being called `n` times.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {number} n The number of times the function must be called before
     *  `func` is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('Done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => logs 'Done saving!', after all saves have completed
     */
    function after(n, func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * provided to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'fred' }, 'hi');
     * func();
     * // => 'hi fred'
     */
    function bind(func, thisArg) {
      return arguments.length > 2
        ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
        : createWrapper(func, 1, null, null, thisArg);
    }

    /**
     * Binds methods of an object to the object itself, overwriting the existing
     * method. Method names may be specified as individual arguments or as arrays
     * of method names. If no method names are provided all the function properties
     * of `object` will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {...string} [methodName] The object method names to
     *  bind, specified as individual method names or arrays of method names.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'onClick': function() { console.log('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => logs 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
          index = -1,
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = createWrapper(object[key], 1, null, null, object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those provided to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {string} key The key of the method.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'fred',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi fred'
     *
     * object.greet = function(greeting) {
     *   return greeting + 'ya ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hiya fred!'
     */
    function bindKey(object, key) {
      return arguments.length > 2
        ? createWrapper(key, 19, slice(arguments, 2), null, object)
        : createWrapper(key, 3, null, null, object);
    }

    /**
     * Creates a function that is the composition of the provided functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {...Function} [func] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var realNameMap = {
     *   'pebbles': 'penelope'
     * };
     *
     * var format = function(name) {
     *   name = realNameMap[name.toLowerCase()] || name;
     *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
     * };
     *
     * var greet = function(formatted) {
     *   return 'Hiya ' + formatted + '!';
     * };
     *
     * var welcome = _.compose(greet, format);
     * welcome('pebbles');
     * // => 'Hiya Penelope!'
     */
    function compose() {
      var funcs = arguments,
          length = funcs.length;

      while (length--) {
        if (!isFunction(funcs[length])) {
          throw new TypeError;
        }
      }
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Creates a function which accepts one or more arguments of `func` that when
     * invoked either executes `func` returning its result, if all `func` arguments
     * have been provided, or returns a function that accepts one or more of the
     * remaining `func` arguments, and so on. The arity of `func` can be specified
     * if `func.length` is not sufficient.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to curry.
     * @param {number} [arity=func.length] The arity of `func`.
     * @returns {Function} Returns the new curried function.
     * @example
     *
     * var curried = _.curry(function(a, b, c) {
     *   console.log(a + b + c);
     * });
     *
     * curried(1)(2)(3);
     * // => 6
     *
     * curried(1, 2)(3);
     * // => 6
     *
     * curried(1, 2, 3);
     * // => 6
     */
    function curry(func, arity) {
      arity = typeof arity == 'number' ? arity : (+arity || func.length);
      return createWrapper(func, 4, null, null, null, arity);
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked.
     * Provide an options object to indicate that `func` should be invoked on
     * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
     * to the debounced function will return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the debounced function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {number} wait The number of milliseconds to delay.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
     * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // avoid costly calculations while the window size is in flux
     * var lazyLayout = _.debounce(calculateLayout, 150);
     * jQuery(window).on('resize', lazyLayout);
     *
     * // execute `sendMail` when the click event is fired, debouncing subsequent calls
     * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * });
     *
     * // ensure `batchLog` is executed once after 1 second of debounced calls
     * var source = new EventSource('/stream');
     * source.addEventListener('message', _.debounce(batchLog, 250, {
     *   'maxWait': 1000
     * }, false);
     */
    function debounce(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      wait = nativeMax(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if (isObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - (now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.defer(function(text) { console.log(text); }, 'deferred');
     * // logs 'deferred' after one or more milliseconds
     */
    function defer(func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {number} wait The number of milliseconds to delay execution.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.delay(function(text) { console.log(text); }, 1000, 'later');
     * // => logs 'later' after one second
     */
    function delay(func, wait) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * provided it will be used to determine the cache key for storing the result
     * based on the arguments provided to the memoized function. By default, the
     * first argument provided to the memoized function is used as the cache key.
     * The `func` is executed with the `this` binding of the memoized function.
     * The result cache is exposed as the `cache` property on the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     *
     * fibonacci(9)
     * // => 34
     *
     * var data = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // modifying the result cache
     * var get = _.memoize(function(name) { return data[name]; }, _.identity);
     * get('pebbles');
     * // => { 'name': 'pebbles', 'age': 1 }
     *
     * get.cache.pebbles.name = 'penelope';
     * get('pebbles');
     * // => { 'name': 'penelope', 'age': 1 }
     */
    function memoize(func, resolver) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var memoized = function() {
        var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      }
      memoized.cache = {};
      return memoized;
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those provided to the new function. This
     * method is similar to `_.bind` except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('fred');
     * // => 'hi fred'
     */
    function partial(func) {
      return createWrapper(func, 16, slice(arguments, 1));
    }

    /**
     * This method is like `_.partial` except that `partial` arguments are
     * appended to those provided to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createWrapper(func, 32, null, slice(arguments, 1));
    }

    /**
     * Creates a function that, when executed, will only call the `func` function
     * at most once per every `wait` milliseconds. Provide an options object to
     * indicate that `func` should be invoked on the leading and/or trailing edge
     * of the `wait` timeout. Subsequent calls to the throttled function will
     * return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the throttled function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {number} wait The number of milliseconds to throttle executions to.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // avoid excessively updating the position while scrolling
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     *
     * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
     * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
     *   'trailing': false
     * }));
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      if (options === false) {
        leading = false;
      } else if (isObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      debounceOptions.leading = leading;
      debounceOptions.maxWait = wait;
      debounceOptions.trailing = trailing;

      return debounce(func, wait, debounceOptions);
    }

    /**
     * Creates a function that provides `value` to the wrapper function as its
     * first argument. Additional arguments provided to the function are appended
     * to those provided to the wrapper function. The wrapper is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {*} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('Fred, Wilma, & Pebbles');
     * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
     */
    function wrap(value, wrapper) {
      return createWrapper(wrapper, 16, [value]);
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that returns `value`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value The value to return from the new function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var getter = _.constant(object);
     * getter() === object;
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name the created callback will return the property value for a given element.
     * If `func` is an object the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(characters, 'age__gt38');
     * // => [{ 'name': 'fred', 'age': 40 }]
     */
    function createCallback(func, thisArg, argCount) {
      var type = typeof func;
      if (func == null || type == 'function') {
        return baseCreateCallback(func, thisArg, argCount);
      }
      // handle "_.pluck" style callback shorthands
      if (type != 'object') {
        return property(func);
      }
      var props = keys(func),
          key = props[0],
          a = func[key];

      // handle "_.where" style callback shorthands
      if (props.length == 1 && a === a && !isObject(a)) {
        // fast path the common case of providing an object with a single
        // property containing a primitive value
        return function(object) {
          var b = object[key];
          return a === b && (a !== 0 || (1 / a == 1 / b));
        };
      }
      return function(object) {
        var length = props.length,
            result = false;

        while (length--) {
          if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
            break;
          }
        }
        return result;
      };
    }

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to escape.
     * @returns {string} Returns the escaped string.
     * @example
     *
     * _.escape('Fred, Wilma, & Pebbles');
     * // => 'Fred, Wilma, &amp; Pebbles'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This method returns the first argument provided to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value Any value.
     * @returns {*} Returns `value`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.identity(object) === object;
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds function properties of a source object to the destination object.
     * If `object` is a function methods will be added to its prototype as well.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Function|Object} [object=lodash] object The destination object.
     * @param {Object} source The object of functions to add.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
     * @example
     *
     * function capitalize(string) {
     *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     * }
     *
     * _.mixin({ 'capitalize': capitalize });
     * _.capitalize('fred');
     * // => 'Fred'
     *
     * _('fred').capitalize().value();
     * // => 'Fred'
     *
     * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
     * _('fred').capitalize();
     * // => 'Fred'
     */
    function mixin(object, source, options) {
      var chain = true,
          methodNames = source && functions(source);

      if (!source || (!options && !methodNames.length)) {
        if (options == null) {
          options = source;
        }
        ctor = lodashWrapper;
        source = object;
        object = lodash;
        methodNames = functions(source);
      }
      if (options === false) {
        chain = false;
      } else if (isObject(options) && 'chain' in options) {
        chain = options.chain;
      }
      var ctor = object,
          isFunc = isFunction(ctor);

      forEach(methodNames, function(methodName) {
        var func = object[methodName] = source[methodName];
        if (isFunc) {
          ctor.prototype[methodName] = function() {
            var chainAll = this.__chain__,
                value = this.__wrapped__,
                args = [value];

            push.apply(args, arguments);
            var result = func.apply(object, args);
            if (chain || chainAll) {
              if (value === result && isObject(result)) {
                return this;
              }
              result = new ctor(result);
              result.__chain__ = chainAll;
            }
            return result;
          };
        }
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * A no-operation function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.noop(object) === undefined;
     * // => true
     */
    function noop() {
      // no operation performed
    }

    /**
     * Gets the number of milliseconds that have elapsed since the Unix epoch
     * (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var stamp = _.now();
     * _.defer(function() { console.log(_.now() - stamp); });
     * // => logs the number of milliseconds it took for the deferred function to be called
     */
    var now = isNative(now = Date.now) && now || function() {
      return new Date().getTime();
    };

    /**
     * Converts the given value into an integer of the specified radix.
     * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
     * `value` is a hexadecimal, in which case a `radix` of `16` is used.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.io/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} value The value to parse.
     * @param {number} [radix] The radix used to interpret the value to parse.
     * @returns {number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
    };

    /**
     * Creates a "_.pluck" style function, which returns the `key` value of a
     * given object.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} key The name of the property to retrieve.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var characters = [
     *   { 'name': 'fred',   'age': 40 },
     *   { 'name': 'barney', 'age': 36 }
     * ];
     *
     * var getName = _.property('name');
     *
     * _.map(characters, getName);
     * // => ['barney', 'fred']
     *
     * _.sortBy(characters, getName);
     * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
     */
    function property(key) {
      return function(object) {
        return object[key];
      };
    }

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is provided a number between `0` and the given number will be
     * returned. If `floating` is truey or either `min` or `max` are floats a
     * floating-point number will be returned instead of an integer.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} [min=0] The minimum possible value.
     * @param {number} [max=1] The maximum possible value.
     * @param {boolean} [floating=false] Specify returning a floating-point number.
     * @returns {number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => an integer between 0 and 5
     *
     * _.random(5);
     * // => also an integer between 0 and 5
     *
     * _.random(5, true);
     * // => a floating-point number between 0 and 5
     *
     * _.random(1.2, 5.2);
     * // => a floating-point number between 1.2 and 5.2
     */
    function random(min, max, floating) {
      var noMin = min == null,
          noMax = max == null;

      if (floating == null) {
        if (typeof min == 'boolean' && noMax) {
          floating = min;
          min = 1;
        }
        else if (!noMax && typeof max == 'boolean') {
          floating = max;
          noMax = true;
        }
      }
      if (noMin && noMax) {
        max = 1;
      }
      min = +min || 0;
      if (noMax) {
        max = min;
        min = 0;
      } else {
        max = +max || 0;
      }
      if (floating || min % 1 || max % 1) {
        var rand = nativeRandom();
        return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand +'').length - 1)))), max);
      }
      return baseRandom(min, max);
    }

    /**
     * Resolves the value of property `key` on `object`. If `key` is a function
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to resolve.
     * @returns {*} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, key) {
      if (object) {
        var value = object[key];
        return isFunction(value) ? object[key]() : value;
      }
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * For more information on precompiling templates see:
     * http://lodash.com/custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} text The template text.
     * @param {Object} data The data object used to populate the text.
     * @param {Object} [options] The options object.
     * @param {RegExp} [options.escape] The "escape" delimiter.
     * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
     * @param {Object} [options.imports] An object to import into the template as local variables.
     * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
     * @param {string} [sourceURL] The sourceURL of the template's compiled source.
     * @param {string} [variable] The data object variable name.
     * @returns {Function|string} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using the "interpolate" delimiter to create a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'fred' });
     * // => 'hello fred'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the "evaluate" delimiter to generate HTML
     * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'pebbles' });
     * // => 'hello pebbles'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
     * // => 'hello barney!'
     *
     * // using a custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `imports` option to import jQuery
     * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text = String(text || '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source by its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the callback `n` times, returning an array of the results
     * of each callback execution. The callback is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns an array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = baseCreateCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The inverse of `_.escape` this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to unescape.
     * @returns {string} Returns the unescaped string.
     * @example
     *
     * _.unescape('Fred, Barney &amp; Pebbles');
     * // => 'Fred, Barney & Pebbles'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} [prefix] The value to prefix the ID with.
     * @returns {string} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object that wraps the given value with explicit
     * method chaining enabled.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to wrap.
     * @returns {Object} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _.chain(characters)
     *     .sortBy('age')
     *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
     *     .first()
     *     .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      value = new lodashWrapper(value);
      value.__chain__ = true;
      return value;
    }

    /**
     * Invokes `interceptor` with the `value` as the first argument and then
     * returns `value`. The purpose of this method is to "tap into" a method
     * chain in order to perform operations on intermediate results within
     * the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to provide to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {*} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .tap(function(array) { array.pop(); })
     *  .reverse()
     *  .value();
     * // => [3, 2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Enables explicit method chaining on the wrapper object.
     *
     * @name chain
     * @memberOf _
     * @category Chaining
     * @returns {*} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // without explicit chaining
     * _(characters).first();
     * // => { 'name': 'barney', 'age': 36 }
     *
     * // with explicit chaining
     * _(characters).chain()
     *   .first()
     *   .pick('age')
     *   .value();
     * // => { 'age': 36 }
     */
    function wrapperChain() {
      this.__chain__ = true;
      return this;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {string} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {*} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.chain = chain;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.createCallback = createCallback;
    lodash.curry = curry;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.indexBy = indexBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.mapValues = mapValues;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.property = property;
    lodash.pull = pull;
    lodash.range = range;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.transform = transform;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;
    lodash.unzip = zip;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.findWhere = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    mixin(function() {
      var source = {}
      forOwn(lodash, function(func, methodName) {
        if (!lodash.prototype[methodName]) {
          source[methodName] = func;
        }
      });
      return source;
    }(), false);

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;
    lodash.sample = sample;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      var callbackable = methodName !== 'sample';
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(n, guard) {
          var chainAll = this.__chain__,
              result = func(this.__wrapped__, n, guard);

          return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
            ? result
            : new lodashWrapper(result, chainAll);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type string
     */
    lodash.VERSION = '2.4.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    forEach(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            result = func.apply(this.__wrapped__, arguments);

        return chainAll
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });

    // add `Array` functions that return the existing wrapped value
    forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    forEach(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
      };
    });

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    root._ = _;
  }
}.call(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
var startTime = new Date(),
    gameRoomID,
    isHost,
    controlMode,
    state = 'waiting';

function init() {
	socketsManager.init();
}

function getStartTime() {
    return startTime;
}

function onConnectionReady(mode) {
    controlMode = mode;

	stageManager.init();

    if (controlMode === 'desktopOnly') {
        desktopControlsManager.init();
    }
}

function onGameReady(newGameRoomID, newGameIsHost) {
    gameRoomID = newGameRoomID;
    isHost = newGameIsHost;
    state = 'ready';

    racketsManager.setPlayerSide(isHost);
    racketsManager.resetRacketsPositions();

    if (isHost) {
        ballsManager.createBalls(48, null, 650, 500, 4);
        // ballsManager.createBall({
        //     pos: new Vector2(60, 10), 
        //     vel: new Vector2(-40, 300)
        // });
    }
}

function onOpponentDisconnect() {
    state = 'waiting';
    ballsManager.removeAllBalls();
}

function getState() {
    return state;
}

function getIsHost() {
    return isHost;
}

function getMode() {
    return controlMode;
}

module.exports =  {
	init: init,
    getStartTime: getStartTime,
    onConnectionReady: onConnectionReady,
    onGameReady: onGameReady,
    onOpponentDisconnect: onOpponentDisconnect,
    getState: getState,
    getIsHost: getIsHost,
    getMode: getMode
};

},{}],3:[function(require,module,exports){
var Ball = require('./class/Ball');


var balls = [];

function init(scene) {
	
}

function createBall(ballData) {
    ballData.ID = ballData.ID || getID();
    if (!balls[ballData.ID]) {
    	var newBall = new Ball(ballData.ID, ballData.pos, ballData.color, ballData.radius);
        // console.log('created ball #' + newBall.ID, newBall, balls[ballData.ID])
        physicsEngine.setVel(newBall, ballData.vel);
        syncManager.onCreateBall(newBall);
        stageManager.getScene().addBall(newBall);
        balls[ballData.ID] = newBall;
		setTimeout(function() {
    		newBall.enablePhysics();
		}, 50);
    }
}

function createBalls(number, pos, vel, interval, turns, angle, remaining) {
	pos   = pos   || stageManager.getScene().getCenter();
    vel   = vel   || 1000;
    turns = turns || 1;
    angle = angle === undefined ? Math.PI/number : angle;
	remaining = remaining === undefined ? number : remaining;
    createBall({
        pos: pos, 
        vel: new Vector2(vel * Math.cos(angle + (Math.random() - 0.5) * Math.PI * 0.08) , vel * Math.sin(angle + (Math.random() - 0.5) * Math.PI * 0.08) )
    });
	if (remaining > 1 && appManager.getState() === 'ready') {
    	setTimeout(function() {
    		createBalls(number, pos, vel, interval, turns, angle + 2 * turns * Math.PI / number, remaining - 1);
    	}, interval);
    }
}

function updateBall(ballData) {
    if (ballData && ballData.ID && balls[ballData.ID]) {
        if (ballData.pos) {
            balls[ballData.ID].x = ballData.pos.x;
            balls[ballData.ID].y = ballData.pos.y;
        }
        if (ballData.vel) {
            balls[ballData.ID].vel.copy(ballData.vel);
        }
    }
    else {
        console.log('error : ball #', ballData.ID, balls[ballData.ID]);
    }
}

function removeAllBalls() {
    balls.forEach(removeBall);
    stageManager.getScene().clearBalls();
    balls = [];
}

function removeBall(ball) {
    if (ball) {
        stageManager.getScene().removeBall(ball);
        delete balls[ball.ID];
    }
}

function onBallOut(ball) {
    if (appManager.getIsHost()) {
        syncManager.onBallOut(ball);
        setBallOut(ball);
    }
}

function onBallOutDestroy(ball) {
    if (appManager.getIsHost()) {
        syncManager.onBallDestroy(ball);
        destroyBall(ball);
    }
}

function setBallOut(ball) {
    ball.out = true;
    setTimeout(function() {
        destroyBall(ball);
    }, 750);
}

function destroyBall(ball) {
    particlesManager.createBallExplodeParticles(ball);
    removeBall(ball);
}

function getID() {
    var ID = Math.round(Math.random() * 10000);
    return balls[ID] ? getID() : ID;
}

function getBalls() {
	return balls;
}

function getBall(ID) {
    return balls[ID] || null;
}

module.exports =  {
	init: init,
	createBall: createBall,
	createBalls: createBalls,
    updateBall: updateBall,
    removeAllBalls: removeAllBalls,
    removeBall: removeBall,
    getID: getID,
	getBalls: getBalls,
    getBall: getBall,
    onBallOut: onBallOut,
    onBallOutDestroy: onBallOutDestroy,
    setBallOut: setBallOut,
    destroyBall: destroyBall
};

},{"./class/Ball":4}],4:[function(require,module,exports){
Ball = function(ID, pos, color, radius) {
    PIXI.DisplayObjectContainer.call( this );
    this.ID = ID;
    this.radius = radius || 28;
    this.color  = color  || parseInt(Please.make_color().slice(1), 16);
    this.colorHex = '#' + this.color.toString(16);
    this.vel = new Vector2(0, 0);
    this.out = false;

    this.physics = false;

	var graphics = new PIXI.Graphics();
	graphics.beginFill(this.color);
	graphics.drawRect(0, 0, this.radius, this.radius);
    this.addChild(graphics);

    this.x = pos ? pos.x : 0;
    this.y = pos ? pos.y : 0;
    
};

Ball.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Ball.prototype.constructor = Ball;

Ball.prototype.enablePhysics = function() {
    this.physics = true;
};

Ball.prototype.disablePhysics = function() {
	this.physics = false;
};


module.exports = Ball;
},{}],5:[function(require,module,exports){
Hud = function() {
    PIXI.DisplayObjectContainer.call( this );
    this.infos = new PIXI.Text('', {font: 'bold 40px Arial'});
    this.infos.x = 10;
    this.infos.y = 10;
    this.addChild(this.infos);

    this.debug1 = new PIXI.Text('');
    this.debug1.x = 100;
    this.debug1.y = 400;
    this.addChild(this.debug1);

    this.debug2 = new PIXI.Text('');
    this.debug2.x = 400;
    this.debug2.y = 400;
    this.addChild(this.debug2);

};

Hud.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Hud.prototype.constructor = Hud;

Hud.prototype.setInfosText = function(text) {
    this.infos.setText(text);
    this.infos.setStyle({
        font: 'bold 40px Arial',
        fill: Please.make_color()});
};

Hud.prototype.setDebug1Text = function(text) {
    this.debug1.setText(text);
    this.debug1.setStyle({fill: Please.make_color()});
};

Hud.prototype.setDebug2Text = function(text) {
    this.debug2.setText(text);
    this.debug2.setStyle({fill: Please.make_color()});
};


module.exports = Hud;
},{}],6:[function(require,module,exports){
Racket = function(pos, color) {
    PIXI.DisplayObjectContainer.call( this );
    pos = pos || new Vector2();
    this.color = color || 0xFFFFFF;
    this.size = 240;

    var graphics = new PIXI.Graphics();
    graphics.beginFill(this.color);
    graphics.drawRect(0, 0, 40, this.size);
    this.addChild(graphics);

    this.vel = new Vector2();

    this.updatePivot();
    this.x = pos.x;
    this.y = pos.y;

    this.movingToY = 0;
};

Racket.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Racket.prototype.constructor = Racket;

Racket.prototype.setMovingToY = function(y) {
	// this.movingToY = y - this.height * 0.5 < 0 ? this.height * 0.5 :
 //                     y + this.height * 0.5 > gameConfig.baseSceneHeight ? gameConfig.baseSceneHeight - this.height * 0.5 :
 //                     y;

    this.movingToY = y;
};

Racket.prototype.updatePivot = function() {
    this.pivot.x = this.width * 0.5;
    this.pivot.y = this.height * 0.5;
};


module.exports = Racket;
},{}],7:[function(require,module,exports){
Scene = function(baseWidth, baseHeight) {
    PIXI.DisplayObjectContainer.call( this );
    this.baseWidth = baseWidth;
    this.baseHeight = baseHeight;
    this.width = baseWidth;
    this.height = baseHeight;
    this.init();
};

Scene.prototype = Object.create(PIXI.DisplayObjectContainer.prototype);
Scene.prototype.constructor = Scene;

Scene.prototype.init = function() {
	this.drawBounds();

	this.particlesContainer = new PIXI.DisplayObjectContainer();        
	this.racketsContainer   = new PIXI.DisplayObjectContainer();        
	this.ballsContainer     = new PIXI.DisplayObjectContainer(); 

    this.addChild(this.particlesContainer);
    this.addChild(this.racketsContainer);
    this.addChild(this.ballsContainer);
};

Scene.prototype.drawBounds = function() {
	var graphics = new PIXI.Graphics();
 	 
	graphics.beginFill(0x222222);
	// graphics.lineStyle(5, 0xFFFFFF);
	graphics.drawRect(0, 0, this.baseWidth, this.baseHeight);

	this.addChild(graphics);
};

Scene.prototype.getCenter = function() {
	return new Vector2(this.baseWidth / 2, this.baseHeight / 2);
};

// Scene.prototype.clearObjectsOfType = function(type) {
// 	var objects = _.filter(this.children, function(object) { 
// 		return object instanceof type;
// 	});

// 	objects.forEach(function(object) {
// 		this.removeChild(object);
// 	}.bind(this));
// };

Scene.prototype.clearBalls = function() {
	this.ballsContainer.removeChildren();
};

Scene.prototype.addBall = function(ball) {
	this.ballsContainer.addChild(ball);
};

Scene.prototype.removeBall = function(ball) {
	this.ballsContainer.removeChild(ball);
};

Scene.prototype.addRacket = function(racket) {
	this.racketsContainer.addChild(racket);
};

Scene.prototype.getParticlesContainer = function() {
	return this.particlesContainer;
};

Scene.prototype.getRacketsContainer = function() {
	return this.racketsContainer;
};

Scene.prototype.getBallsContainer = function() {
	return this.ballsContainer;
};

module.exports = Scene;
},{}],8:[function(require,module,exports){
/**
 * @author mr.doob / http://mrdoob.com/
 * @author philogb / http://blog.thejit.org/
 * @author egraether / http://egraether.com/
 * @author zz85 / http://www.lab4games.net/zz85/blog
 */

Vector2 = function ( x, y ) {

	this.x = x || 0;
	this.y = y || 0;

};

Vector2.prototype = {

	constructor: Vector2,

	set: function ( x, y ) {

		this.x = x;
		this.y = y;

		return this;

	},

	copy: function ( v ) {

		this.x = v.x;
		this.y = v.y;

		return this;

	},

	clone: function () {

		return new Vector2( this.x, this.y );

	},


	add: function ( v1, v2 ) {

		this.x = v1.x + v2.x;
		this.y = v1.y + v2.y;

		return this;

	},

	addSelf: function ( v ) {

		this.x += v.x;
		this.y += v.y;

		return this;

	},

	sub: function ( v1, v2 ) {

		this.x = v1.x - v2.x;
		this.y = v1.y - v2.y;

		return this;

	},

	subSelf: function ( v ) {

		this.x -= v.x;
		this.y -= v.y;

		return this;

	},

	multiplyScalar: function ( s ) {

		this.x *= s;
		this.y *= s;

		return this;

	},

	divideScalar: function ( s ) {

		if ( s ) {

			this.x /= s;
			this.y /= s;

		} else {

			this.set( 0, 0 );

		}

		return this;

	},


	negate: function() {

		return this.multiplyScalar( -1 );

	},

	dot: function ( v ) {

		return this.x * v.x + this.y * v.y;

	},

	lengthSq: function () {

		return this.x * this.x + this.y * this.y;

	},

	length: function () {

		return Math.sqrt( this.lengthSq() );

	},

	normalize: function () {

		return this.divideScalar( this.length() );

	},

	distanceTo: function ( v ) {

		return Math.sqrt( this.distanceToSquared( v ) );

	},

	distanceToSquared: function ( v ) {

		var dx = this.x - v.x, dy = this.y - v.y;
		return dx * dx + dy * dy;

	},


	setLength: function ( l ) {

		return this.normalize().multiplyScalar( l );

	},

	equals: function( v ) {

		return ( ( v.x === this.x ) && ( v.y === this.y ) );

	}

};

module.exports = Vector2;
},{}],9:[function(require,module,exports){
var startTime,
    gestures;

function init() {
	$(document).on('mousemove touchstart touchmove', onMouseMove);
    // gestures = new Hammer.Manager(document.getElementById('game'));
    // gestures.add(new Hammer.Swipe({ direction: Hammer.DIRECTION_VERTICAL }));

    // gestures.on('swipe', onSwipe);
}

function onMouseMove(event) {
    var y = event.pageY || event.originalEvent.touches && event.originalEvent.touches[0].pageY;
    racketsManager.movePlayerRacketTo((y - stageManager.getDec().y) / stageManager.getRatio());
}

function onSwipe(event) {
    console.log(event);
    setTimeout(function() {
        racketsManager.movePlayerRacketBy((event.deltaY * Math.abs(event.velocity) * 0.5 - stageManager.getDec().y) / stageManager.getRatio());
    }, 20);
}

module.exports = {
	init: init
};

},{}],10:[function(require,module,exports){
var Hud = require('./class/Hud');

var hud;

function init() {
	hud = new Hud();
    stageManager.getStage().addChild(hud);

    setDebug1Text('YOU:');
    setDebug2Text('HIM:');
}

function initStage() {
	console.log('initStage');
	stageManager.init();
}

function setInfosText(text) {
    hud.setInfosText(text);
}

function setDebug1Text(text) {
    hud.setDebug1Text(text);
}

function setDebug2Text(text) {
    hud.setDebug2Text(text);
}

module.exports = {
	init: init,
    setInfosText: setInfosText,
    setDebug1Text: setDebug1Text,
    setDebug2Text: setDebug2Text
};



},{"./class/Hud":5}],11:[function(require,module,exports){
var _ = require('lodash');

var particlesContainer,
    emitters = [],
    poolSize = 18,
    pool = [];


function init() {
    particlesContainer = stageManager.getScene().getParticlesContainer();
    initPool();
}

function update(delta) {
    pool.forEach(function(emitter, index) {
        if (emitter.emit || emitter._activeParticles.length)
        emitter.update(delta);
    });
}

function initPool() {
    for (var i = 0; i < poolSize; i++) {
        pool[i] = new cloudkid.Emitter(particlesContainer);
    }
}

function initUnusedEmitter(config) {
    var emitter = findUnusedEmitter();
    if (emitter) {
        emitter.init([PIXI.Texture.fromImage('textures/pixel24.png')], config);
        emitter.emit = true;
    }
}

function findUnusedEmitter() {
    return _.find(pool, function(emitter) {
        return !emitter.emit && emitter._activeParticles.length === 0;
    });
}

function createBallCollideParticles(ball, angle) {
    if (ball) { 
        initUnusedEmitter({
            "alpha": {
                "start": 0.8,
                "end": 0
            },
            "scale": {
                "start": 1 / 24 * ball.radius,
                "end":   1 / 54 * ball.radius,
                "minimumScaleMultiplier": 1
            },
            "color": {
                "start": ball.colorHex,
                "end": "#333333"
            },
            "speed": {
                "start": 10 * ball.radius,
                "end": 2 * ball.radius
            },
            "acceleration": {
                "x": 0,
                "y": 0
            },
            "startRotation": {
                "min": angle - 60,
                "max": angle + 60
            },
            "rotationSpeed": {
                "min": 0,
                "max": 0
            },
            "lifetime": {
                "min": 0.2,
                "max": 0.5
            },
            "blendMode": "normal",
            "frequency": 0.02,
            "emitterLifetime": 0.2,
            "maxParticles": 6,
            "pos": {
                "x": ball.x + ball.radius / 2,
                "y": ball.y + ball.radius / 2
            },
            "addAtBack": false,
            "spawnType": "point"
        });
    }
}

function createBallExplodeParticles(ball) {
    if (ball) {
        initUnusedEmitter({
            "alpha": {
                "start": 0.8,
                "end": 0
            },
            "scale": {
                "start": 1 / 24 * ball.radius,
                "end":   1 / 48 * ball.radius,
                "minimumScaleMultiplier": 1
            },
            "color": {
                "start": ball.colorHex,
                "end": "#333333"
            },
            "speed": {
                "start": 50 * ball.radius,
                "end": 10 * ball.radius
            },
            "acceleration": {
                "x": 0,
                "y": 0
            },
            "startRotation": {
                "min": 0,
                "max": 360
            },
            "rotationSpeed": {
                "min": 0,
                "max": 0
            },
            "lifetime": {
                "min": 0.1,
                "max": 0.5
            },
            "blendMode": "normal",
            "frequency": 0.01,
            "emitterLifetime": 0.15,
            "maxParticles": 32,
            "pos": {
                "x": ball.x + ball.radius / 2,
                "y": ball.y + ball.radius / 2
            },
            "addAtBack": false,
            "spawnType": "point"
        });
    }
}

function getEmitters() {
    return emitters;
}



module.exports = {
    init: init,
    update: update,
    createBallCollideParticles: createBallCollideParticles,
    createBallExplodeParticles: createBallExplodeParticles,
    getEmitters: getEmitters
};

},{"lodash":1}],12:[function(require,module,exports){
Vector2 = require('./class/Vector2');


var currentDelta = 0,
	currentDec = new Vector2(),
	currentRatio = 1,
	safetyGapSize = 6,
	racketsMargin = 34,

	wallsBounds;

function init() {
		wallsBounds = new PIXI.Rectangle(
		0, 
		0, 
		gameConfig.baseSceneWidth,
		gameConfig.baseSceneHeight);
}

function update(delta) {
	currentDelta = delta;

	if (currentDelta) {
		updateRackets();
		updateBalls();
    }
}

function setVel(object, vel) {
	object.vel.copy(vel);
}

function addVel(object, vel) {
	object.vel.addSelf(vel);
}

function updateRackets() {
	updateRacket(racketsManager.getLeftRacket());
	updateRacket(racketsManager.getRightRacket());
}

function updateRacket(racket) {
	if (Math.abs(racket.y - racket.movingToY) > 1) {
		racket.y += (racket.movingToY - racket.y)  * 15 * currentDelta; 
	}
	else {
		racket.y = racket.movingToY;
	}
}

function updateBalls() {
	ballsManager.getBalls().forEach(updateBall);
}

function updateBall(ball, index) {
	if (ball && ball.physics) {
		if (ball.vel.x >= -50 && ball.vel.x <= 50) {
			ball.vel.x = ball.vel.x + ball.vel.x * 0.1;
		}
		checkBallCollision(ball);
		updateObjectPos(ball);
		applyMagnetForce(ball);
	}
}

function updateObjectPos(object) {
	object.x = object.x + object.vel.x * currentDelta;
	object.y = object.y + object.vel.y * currentDelta;
}

function checkBallCollision(ball) {
	var bounds = ball.getBounds();
	bounds.localX = bounds.x - stageManager.getDec().x;
	bounds.localY = bounds.y - stageManager.getDec().y;


	// Test top collision
	if (ball.y + ball.vel.y * currentDelta <= wallsBounds.y || 
		ball.y <= wallsBounds.y) {

		ball.y = wallsBounds.y;

		if (ball.out) {
			ballsManager.onBallOutDestroy(ball);
		}
		else {
			onBallCollideTop(ball);
		}
	}

	// Test bottom collision
	else if (ball.y + bounds.height + ball.vel.y * currentDelta >= wallsBounds.y + wallsBounds.height || 
			 ball.y + bounds.height >= wallsBounds.y + wallsBounds.height) {

		ball.y = wallsBounds.y + wallsBounds.height - ball.radius;

		if (ball.out) {
			ballsManager.onBallOutDestroy(ball);
		}
		else {
			onBallCollideBottom(ball);
		}
	}

	// If ball is not out of the game
	if (!ball.out) {

		// Test left collision
		if (bounds.x + (ball.vel.x * currentDelta) * currentRatio < racketsManager.getLeftRacketBoundsRightX()) {

			// If the ball touches left racket
			if (bounds.y + bounds.height > racketsManager.getLeftRacketBoundsTopY() &&
				bounds.y < racketsManager.getLeftRacketBoundsBottomY()) {

				ball.x = (racketsManager.getLeftRacketBoundsRightX() - currentDec.x) / currentRatio;
				onBallCollideLeft(ball);				
			}
			else if (bounds.x < racketsManager.getLeftRacketBoundsLeftX()) {
				ballsManager.onBallOut(ball);
			}
		}
		// Test right collision
		else if (bounds.x + bounds.width + (ball.vel.x * currentDelta) * currentRatio > racketsManager.getRightRacketBoundsLeftX()) {

			// If the ball touches right racket
			if (bounds.y + bounds.height > racketsManager.getRightRacketBoundsTopY() &&
				bounds.y < racketsManager.getRightRacketBoundsBottomY()) {

				ball.x = (racketsManager.getRightRacketBoundsLeftX() - currentDec.x - bounds.width) / currentRatio;
				onBallCollideRight(ball);
			}
			else if (bounds.x + bounds.width > racketsManager.getRightRacketBoundsLeftX()) {
				ballsManager.onBallOut(ball);
			}
		}
	}

	// If ball is out, test collision with top & bottom of rackets
	else {
		// Ball needs to be destroy
		if (bounds.x + bounds.width < racketsManager.getLeftRacketBoundsLeftX() - 40 * currentRatio ||
			bounds.x > racketsManager.getRightRacketBoundsRightX() + 40 * currentRatio) {

			ballsManager.onBallOutDestroy(ball);
		}

		// Left racket
		else if (bounds.x < racketsManager.getLeftRacketBoundsRightX() &&
			bounds.y + bounds.height > racketsManager.getLeftRacketBoundsTopY() && 
			bounds.y < racketsManager.getLeftRacketBoundsBottomY()) {

			var leftRacketCenterY = (racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY()) * 0.5;

			// collide top of racket
			if (ball.vel.y > 0) {
				if (ball.y < racketsManager.getLeftRacket().y) {
					onBallCollideTop(ball);
				}
				ball.y = (racketsManager.getLeftRacketBoundsTopY() - currentDec.y - bounds.height) / currentRatio - 2 * safetyGapSize;
			}
			// collide bottom of racket
			else if (ball.vel.y < 0) {
				if (ball.y > racketsManager.getLeftRacket().y) {
					onBallCollideBottom(ball);
				}
				ball.y = (racketsManager.getLeftRacketBoundsBottomY() - currentDec.y) / currentRatio + 2 * safetyGapSize;
			}
		}

		// Right racket
		else if (bounds.x + bounds.width > racketsManager.getRightRacketBoundsLeftX() &&
			bounds.y + bounds.height > racketsManager.getRightRacketBoundsTopY() && 
			bounds.y < racketsManager.getRightRacketBoundsBottomY()) {

			var rightRacketCenterY = (racketsManager.getLeftRacketBoundsTopY() + racketsManager.getLeftRacketBoundsBottomY()) * 0.5;

			// collide top of racket
			if (ball.vel.y > 0) {
				if (ball.y < racketsManager.getRightRacket().y) {
				onBallCollideTop(ball);
				}
					ball.y = (racketsManager.getRightRacketBoundsTopY() - currentDec.y - bounds.height) / currentRatio - 2 * safetyGapSize;
			}
			// collide bottom of racket
			else if (ball.vel.y < 0) {
				if (ball.y > racketsManager.getRightRacket().y) {
				onBallCollideBottom(ball);
				}
					ball.y = (racketsManager.getRightRacketBoundsBottomY() - currentDec.y) / currentRatio + 2 * safetyGapSize;
			}
		}
	}
}

function onBallCollideTop(ball) {
	ball.vel.y = -ball.vel.y;
	ball.vel.x += ball.vel.x * 0.02; 
	if (!ball.out) {
		syncManager.onUpdateBall(ball, 't');
	}
	particlesManager.createBallCollideParticles(ball, 90);
}

function onBallCollideBottom(ball) {
	ball.vel.y = -ball.vel.y;
	ball.vel.x += ball.vel.x * 0.02; 
	if (!ball.out) {
		syncManager.onUpdateBall(ball, 'b');
	}
	particlesManager.createBallCollideParticles(ball, 270);
}

function onBallCollideLeft(ball) {
	ball.vel.x = -ball.vel.x;
	syncManager.onUpdateBall(ball, 'l');
	particlesManager.createBallCollideParticles(ball, 0);
}

function onBallCollideRight(ball) {
	ball.vel.x = -ball.vel.x;
	syncManager.onUpdateBall(ball, 'r');
	particlesManager.createBallCollideParticles(ball, 180);
}

function applyMagnetForce(ball) {
	if (ball.vel.x < 0) {
		// ball.vel.y = (ball.vel.y - (racketsManager.getLeftRacket().getCenter().y - ball.y) * 0.1);
		// ball.vel.y = ball.vel.y + (1/(ball.y - racketsManager.getLeftRacket().getCenter().y)) * 10
		// console.log(ball.y - racketsManager.getLeftRacket().getCenter().y);
	}
}

function updateSceneResizeValues(dec, ratio) {
	currentDec = dec;
	currentRatio = ratio;
}

module.exports = {
	init: init,
	update: update,
	setVel: setVel,
	addVel: addVel,
	updateSceneResizeValues: updateSceneResizeValues
};

},{"./class/Vector2":8}],13:[function(require,module,exports){
(function (global){
global.gameConfig = {
    baseSceneWidth: 1440,
    baseSceneHeight: 900,
    checkDeltaIntervalTime: 500
};

global.appManager 				= require('./appManager');
global.ballsManager 			= require('./ballsManager');
global.desktopControlsManager 	= require('./desktopControlsManager');
global.hudManager 				= require('./hudManager');
global.particlesManager 		= require('./particlesManager');
global.physicsEngine 			= require('./physicsEngine');
global.racketsManager 			= require('./racketsManager');
global.socketsManager 			= require('./socketsManager');
global.stageManager 			= require('./stageManager');
global.syncManager 				= require('./syncManager');


appManager.init();



}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./appManager":2,"./ballsManager":3,"./desktopControlsManager":9,"./hudManager":10,"./particlesManager":11,"./physicsEngine":12,"./racketsManager":14,"./socketsManager":15,"./stageManager":16,"./syncManager":17}],14:[function(require,module,exports){
var Racket = require('./class/Racket');


var playerSide = 'left',
    opponentSide = 'right',
    rackets = {
        left: null,
        right: null
    },
    margin = 30;

function init(scene) {
    rackets.left = new Racket();
    rackets.right = new Racket(); 

    resetRacketsPositions();

    stageManager.getScene().addRacket(rackets.left);
    stageManager.getScene().addRacket(rackets.right);
}

function resetRacketsPositions() {

    var centerY = stageManager.getScene().getCenter().y;

    rackets.left.x  = margin;
    rackets.left.y  = centerY;
    rackets.right.x = gameConfig.baseSceneWidth - margin; 
    rackets.right.y = centerY ;

    movePlayerRacketTo(centerY);
    moveOpponentRacketTo(centerY);
}

function setPlayerSide(isHost) {
    console.log('setPlayerSide');
    playerSide   = isHost ? 'left'  : 'right';
    opponentSide = isHost ? 'right' : 'left';
}

function movePlayerRacketTo(y) {
    if (y !== rackets[playerSide].movingToY) {
        syncManager.onRacketSetMovingToY(y);
        rackets[playerSide].setMovingToY(y);
    }
}

function moveOpponentRacketTo(y) {
    rackets[opponentSide].setMovingToY(y);
}

function movePlayerRacketBy(y) {
    movePlayerRacketTo(rackets[playerSide].y + y);
}

function getLeftRacket() {
    return rackets.left;
}

function getRightRacket() {
    return rackets.right;
}

function getLeftRacketBoundsTopY() {
    return rackets.left.getBounds().y;
}

function getLeftRacketBoundsBottomY() {
    return rackets.left.getBounds().y + rackets.left.getBounds().height;
}

function getLeftRacketBoundsLeftX() {
    return rackets.left.getBounds().x;
}

function getLeftRacketBoundsRightX() {
    return rackets.left.getBounds().x + rackets.left.getBounds().width;
}

function getRightRacketBoundsTopY() {
    return rackets.right.getBounds().y;
}

function getRightRacketBoundsBottomY() {
    return rackets.right.getBounds().y + rackets.right.getBounds().height;
}

function getRightRacketBoundsLeftX() {
    return rackets.right.getBounds().x;
}

function getRightRacketBoundsRightX() {
    return rackets.right.getBounds().x + rackets.right.getBounds().width;
}

module.exports = {
	init: init,
    resetRacketsPositions: resetRacketsPositions,
    setPlayerSide: setPlayerSide,
    movePlayerRacketTo: movePlayerRacketTo,
    moveOpponentRacketTo: moveOpponentRacketTo,
    movePlayerRacketBy: movePlayerRacketBy,
    getLeftRacket: getLeftRacket,
    getRightRacket: getRightRacket,
    getLeftRacketBoundsTopY: getLeftRacketBoundsTopY,
    getLeftRacketBoundsLeftX: getLeftRacketBoundsLeftX,
    getLeftRacketBoundsBottomY: getLeftRacketBoundsBottomY,
    getLeftRacketBoundsRightX: getLeftRacketBoundsRightX,
    getRightRacketBoundsTopY: getRightRacketBoundsTopY,
    getRightRacketBoundsLeftX: getRightRacketBoundsLeftX,
    getRightRacketBoundsBottomY: getRightRacketBoundsBottomY,
    getRightRacketBoundsRightX: getRightRacketBoundsRightX
};

},{"./class/Racket":6}],15:[function(require,module,exports){
var socket,
    connectionID,
    serverConfig,
    controlMode;

function init() {

	$.getJSON("../config.json", function(data) {
        serverConfig = data;
        var address = serverConfig.url + ":" + serverConfig.port;

        $.getScript('http://' + address + '/socket.io/socket.io.js')
            .done(function( ) {
                initSocket(address);
            });
    });

}

function initSocket(address) {

    socket = io.connect(address);

    sendHostRequest();
    bindSocketEvents();
}

function sendHostRequest() {
    socket.emit('newHosting');
}

function bindSocketEvents() {
    socket.on('newConnectionID', onNewConnectionID);
    socket.on('connectionReady', onConnectionReady);
}

function onNewConnectionID(data) {
    socket.removeListener('newConnectionID');

    connectionID = data.connectionID;
    
    //display text + qrcode
    var $container = $('#info-connection').show(),
        $url = $('.mobile-url', $container),
        $qrcode = $('#qr-scan', $container);

    var urlMobile   = serverConfig.url + ':' + serverConfig.port + '/mobile?id=' + data.connectionID;

    $url.text(urlMobile);
    $qrcode.qrcode({width:'200', height:'200', text:urlMobile});

    $('#desktop-only').on('click', onClickDesktopOnly);
}

function onClickDesktopOnly() {
    socket.emit('desktopOnly', connectionID);
}

function onConnectionReady(mode) {
    $('#info-connection').hide();
    socket.removeListener('connnectionReady');

    initApp();

    appManager.onConnectionReady(mode);
}

function initApp () {

    var $containerInfo = $('#container-info').show();
    var $gameState = $('#game-state');
    var $playerControlData = $('#player-control-data');
    var $opponentControlData = $('#opponent-control-data');

    var isHost;
    var gameRoomID;

    socket.on('mobile top', function() {
        hudManager.setDebug1Text('YOU: top');
    });

    socket.on('mobile bottom', function() {
        hudManager.setDebug1Text('YOU: bottom');
    });

    socket.on('mobile stop', function() {
        hudManager.setDebug1Text('YOU: ');
    });

    socket.on('opponent top', function() {
        hudManager.setDebug2Text('HIM: top');
    });

    socket.on('opponent bottom', function() {
        hudManager.setDebug2Text('HIM: bottom');
    });

    socket.on('opponent stop', function() {
        hudManager.setDebug2Text('HIM: ');
    });

    socket.on('opponent disconnect', function() {
        hudManager.setInfosText('Opponent disconnected...');
        appManager.onOpponentDisconnect();
    });

    socket.on('game joined', function(data) {
        isHost = data.isHost;
        gameRoomID = data.gameRoomID;
        hudManager.setInfosText('Game #' + gameRoomID + ' joined. \nWaiting for another player...');
    });

    socket.on('game ready', function() {
        if (isHost) {
            hudManager.setInfosText('Game #' + gameRoomID + ' [HOST]');
        }
        else {
            hudManager.setInfosText('Game #' + gameRoomID);
        }
        appManager.onGameReady(gameRoomID, isHost);
    });

    socket.on('sync', function(data) {
        syncManager.onSync(data);
    });
}

function emit(message, data) {
    socket.emit(message, data);
}

module.exports = {
	init: init,
    emit: emit
};

},{}],16:[function(require,module,exports){
var Scene = require('./class/Scene');

var renderer,
    stage, 
    scene,
    particlesContainer,
    stats,
    lastTime = 0, 
    delta = 0,
    dec = new Vector2(),
    ratio = 1,
    pixelateFilter,
    background,
    colorStepFilter,
    scanFilter,
    checkDeltaInterval,
    startTime,
    emitter,
    inactive = false,
    isPaused = false;

function init() {
    // create an new instance of a pixi stage
    stage = new PIXI.Stage(0x222222);
    
    // create a renderer instance and append the view 
    renderer = PIXI.autoDetectRenderer(window.innerWidth, window.innerHeight, null, false, true);
    document.getElementById('game').appendChild(renderer.view);
    

    var uniforms = {};
    uniforms.power = { type: '1f', value: 1/1000 };
    uniforms.noise = { type: '1f', value: 0.2 };
    
    //// grain filter..
    
    var fragmentSrc = [

        'precision mediump float;',
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'uniform sampler2D uSampler;',
        'uniform float noise;',
        'uniform float power;',

        'float rand(vec2 co) {',
        '    return fract(sin(dot(co.xy ,vec2(12.9898,78.233 * noise))) * 43758.5453);',
        '}',
        
        'void main(void) {',
        '   vec2 cord = vTextureCoord;',
        '   cord.y += noise * 0.001;',

        '    vec4 color = texture2D(uSampler, vTextureCoord);',
            
        '    float diff = (rand(vTextureCoord) - 0.5) * 0.075;',
        '    color.r += diff;',
        '    color.g += diff;',
        '    color.b += diff;',
            
        '   gl_FragColor = color;',
        '}'
    ];

    scanFilter = new PIXI.AbstractFilter(fragmentSrc, uniforms);

    pixelateFilter = new PIXI.PixelateFilter();
    pixelateFilter.size.x = 3;
    pixelateFilter.size.y = 3;

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.right = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    background = new PIXI.Graphics();
    background.beginFill(0x111111);
    background.drawRect(0, 0, window.innerWidth, window.innerHeight);
    stage.addChild(background);

    scene = new Scene(gameConfig.baseSceneWidth, gameConfig.baseSceneHeight);

    stage.addChild(scene);
    updateGameSize();
    
    window.onresize = updateGameSize;

    stage.filters = [pixelateFilter, scanFilter];
    // stage.filters = [pixelateFilter];

    hudManager.init();
    racketsManager.init();
    physicsEngine.init();
    particlesManager.init();

    

    startTime = appManager.getStartTime();
    checkDeltaInterval = setInterval(checkDelta, gameConfig.checkDeltaIntervalTime);
    update();
}

function update(time) {
    requestAnimFrame( update );
    if (time) {

        // scanFilter.uniforms.power.value += (ease -  scanFilter.uniforms.power.value ) * 0.3;

        scanFilter.uniforms.noise.value += 0.1;
        scanFilter.uniforms.noise.value %= 1;
        scanFilter.syncUniforms();


        delta = (time - lastTime) * 0.001;
        lastTime = time;
        stats.update();
        physicsEngine.update(delta);
        particlesManager.update(delta);

        renderer.render(stage);
    }
}

// Manually update physics if requestAnimFrame not available (if tab inactive)
function checkDelta() {
    var tempTime = new Date() - startTime;
    // console.log('tempTime', tempTime);
    // console.log('lastTime', lastTime);
    if(tempTime - lastTime >= gameConfig.checkDeltaIntervalTime) {
        if (!inactive) {
            inactive = true;
            console.log('player is inactive');
        }
    }
    else if (inactive) {
        inactive = false;
        console.log('player came back');
    }
}

function updateGameSize() {
    renderer.resize(window.innerWidth, window.innerHeight);

    var ratioW = window.innerWidth  / gameConfig.baseSceneWidth;
    var ratioH = window.innerHeight / gameConfig.baseSceneHeight;

    if (ratioW < ratioH) {
        ratio = ratioW;
        dec.x = 0;
        dec.y = (window.innerHeight - gameConfig.baseSceneHeight * ratio) / 2;
    }
    else {
        ratio = ratioH;
        dec.x = (window.innerWidth - gameConfig.baseSceneWidth * ratio) / 2;
        dec.y = 0;
    }

    scene.scale = new PIXI.Point(ratio, ratio);
    scene.x = dec.x;
    scene.y = dec.y;

    background.width = window.innerWidth;
    background.height = window.innerHeight;

    physicsEngine.updateSceneResizeValues(dec, ratio);
}

function setPixelShaderSize(size) {
    pixelateFilter.size.x = size;
    pixelateFilter.size.y = size;
}

function getScene() {
    return scene;
}

function getStage() {
    return stage;
}

function getDec() {
    return dec;
}

function getRatio() {
    return ratio;
}

module.exports = {
    init: init,
    setPixelShaderSize: setPixelShaderSize,
    getScene: getScene,
    getStage: getStage,
    getDec: getDec,
    getRatio: getRatio
};

},{"./class/Scene":7}],17:[function(require,module,exports){
function init() {
	
}

function onSync(data) {
    // console.log('sync', data);
    if (data.event === 'createBall') {
        ballsManager.createBall(data);
    }
    else if (data.event === 'updateBall') {
        ballsManager.updateBall(data);

        if (data.collidingDirection === 't') {
            particlesManager.createBallCollideParticles(ballsManager.getBall(data.ID), 90);
        }
        else if (data.collidingDirection === 'b') {
            particlesManager.createBallCollideParticles(ballsManager.getBall(data.ID), 270);
        }
        else if (data.collidingDirection === 'l') {
            particlesManager.createBallCollideParticles(ballsManager.getBall(data.ID), 0);
        }
        else if (data.collidingDirection === 'r') {
            particlesManager.createBallCollideParticles(ballsManager.getBall(data.ID), 180);
        }
    }
    else if (data.event === 'setBallOut') {
        var outBall = ballsManager.getBall(data.ID);
        if (outBall) {
            ballsManager.setBallOut(outBall);
        }
    }
    else if (data.event === 'destroyBall') {
        var destroyedBall = ballsManager.getBall(data.ID);
        if (destroyedBall) {
            ballsManager.destroyBall(destroyedBall);
        }
    }
    else if (data.event === 'racketMove') {
        racketsManager.moveOpponentRacketTo(data.y);
    }
}

function onCreateBall(ball) {
    var data = {
        event: 'createBall',
        ID: ball.ID,
        color: ball.color,
        pos: {
            x: ball.x,
            y: ball.y
        },
        vel: {
            x: ball.vel.x,
            y: ball.vel.y,
        }
    };
    socketsManager.emit('sync', data);
}

function onUpdateBall(ball, collidingDirection) {
    var data = {
        event: 'updateBall',
        ID: ball.ID,
        pos: {
            x: ball.x,
            y: ball.y
        },
        vel: {
            x: ball.vel.x,
            y: ball.vel.y,
        },
        collidingDirection: collidingDirection
    };
    socketsManager.emit('sync', data);
}

function onBallOut(ball) {
    var data = {
        event: 'setBallOut',
        ID: ball.ID
    };
    socketsManager.emit('sync', data);
}

function onBallDestroy(ball) {
    var data = {
        event: 'destroyBall',
        ID: ball.ID
    };
    socketsManager.emit('sync', data);
}

function onRacketSetMovingToY(y) {
    var data = {
        event: 'racketMove',
        y: y
    };
    socketsManager.emit('sync', data);
}

module.exports = {
	init: init,
    onSync: onSync,
    onCreateBall: onCreateBall,
    onUpdateBall: onUpdateBall,
    onBallOut: onBallOut,
    onBallDestroy: onBallDestroy,
    onRacketSetMovingToY: onRacketSetMovingToY
};

},{}]},{},[13])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uXFwuLlxcLi5cXC4uXFwuLlxcQXBwRGF0YVxcUm9hbWluZ1xcbnBtXFxub2RlX21vZHVsZXNcXGJyb3dzZXJpZnlcXG5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsIi4uXFwuLlxcbm9kZV9tb2R1bGVzXFxsb2Rhc2hcXGRpc3RcXGxvZGFzaC5qcyIsInNyY1xcYXBwTWFuYWdlci5qcyIsInNyY1xcYmFsbHNNYW5hZ2VyLmpzIiwic3JjXFxjbGFzc1xcQmFsbC5qcyIsInNyY1xcY2xhc3NcXEh1ZC5qcyIsInNyY1xcY2xhc3NcXFJhY2tldC5qcyIsInNyY1xcY2xhc3NcXFNjZW5lLmpzIiwic3JjXFxjbGFzc1xcVmVjdG9yMi5qcyIsInNyY1xcZGVza3RvcENvbnRyb2xzTWFuYWdlci5qcyIsInNyY1xcaHVkTWFuYWdlci5qcyIsInNyY1xccGFydGljbGVzTWFuYWdlci5qcyIsInNyY1xccGh5c2ljc0VuZ2luZS5qcyIsInNyY1xccG9uZy5qcyIsInNyY1xccmFja2V0c01hbmFnZXIuanMiLCJzcmNcXHNvY2tldHNNYW5hZ2VyLmpzIiwic3JjXFxzdGFnZU1hbmFnZXIuanMiLCJzcmNcXHN5bmNNYW5hZ2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pvTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKipcclxuICogQGxpY2Vuc2VcclxuICogTG8tRGFzaCAyLjQuMSAoQ3VzdG9tIEJ1aWxkKSA8aHR0cDovL2xvZGFzaC5jb20vPlxyXG4gKiBCdWlsZDogYGxvZGFzaCBtb2Rlcm4gLW8gLi9kaXN0L2xvZGFzaC5qc2BcclxuICogQ29weXJpZ2h0IDIwMTItMjAxMyBUaGUgRG9qbyBGb3VuZGF0aW9uIDxodHRwOi8vZG9qb2ZvdW5kYXRpb24ub3JnLz5cclxuICogQmFzZWQgb24gVW5kZXJzY29yZS5qcyAxLjUuMiA8aHR0cDovL3VuZGVyc2NvcmVqcy5vcmcvTElDRU5TRT5cclxuICogQ29weXJpZ2h0IDIwMDktMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgYW5kIEludmVzdGlnYXRpdmUgUmVwb3J0ZXJzICYgRWRpdG9yc1xyXG4gKiBBdmFpbGFibGUgdW5kZXIgTUlUIGxpY2Vuc2UgPGh0dHA6Ly9sb2Rhc2guY29tL2xpY2Vuc2U+XHJcbiAqL1xyXG47KGZ1bmN0aW9uKCkge1xyXG5cclxuICAvKiogVXNlZCBhcyBhIHNhZmUgcmVmZXJlbmNlIGZvciBgdW5kZWZpbmVkYCBpbiBwcmUgRVM1IGVudmlyb25tZW50cyAqL1xyXG4gIHZhciB1bmRlZmluZWQ7XHJcblxyXG4gIC8qKiBVc2VkIHRvIHBvb2wgYXJyYXlzIGFuZCBvYmplY3RzIHVzZWQgaW50ZXJuYWxseSAqL1xyXG4gIHZhciBhcnJheVBvb2wgPSBbXSxcclxuICAgICAgb2JqZWN0UG9vbCA9IFtdO1xyXG5cclxuICAvKiogVXNlZCB0byBnZW5lcmF0ZSB1bmlxdWUgSURzICovXHJcbiAgdmFyIGlkQ291bnRlciA9IDA7XHJcblxyXG4gIC8qKiBVc2VkIHRvIHByZWZpeCBrZXlzIHRvIGF2b2lkIGlzc3VlcyB3aXRoIGBfX3Byb3RvX19gIGFuZCBwcm9wZXJ0aWVzIG9uIGBPYmplY3QucHJvdG90eXBlYCAqL1xyXG4gIHZhciBrZXlQcmVmaXggPSArbmV3IERhdGUgKyAnJztcclxuXHJcbiAgLyoqIFVzZWQgYXMgdGhlIHNpemUgd2hlbiBvcHRpbWl6YXRpb25zIGFyZSBlbmFibGVkIGZvciBsYXJnZSBhcnJheXMgKi9cclxuICB2YXIgbGFyZ2VBcnJheVNpemUgPSA3NTtcclxuXHJcbiAgLyoqIFVzZWQgYXMgdGhlIG1heCBzaXplIG9mIHRoZSBgYXJyYXlQb29sYCBhbmQgYG9iamVjdFBvb2xgICovXHJcbiAgdmFyIG1heFBvb2xTaXplID0gNDA7XHJcblxyXG4gIC8qKiBVc2VkIHRvIGRldGVjdCBhbmQgdGVzdCB3aGl0ZXNwYWNlICovXHJcbiAgdmFyIHdoaXRlc3BhY2UgPSAoXHJcbiAgICAvLyB3aGl0ZXNwYWNlXHJcbiAgICAnIFxcdFxceDBCXFxmXFx4QTBcXHVmZWZmJyArXHJcblxyXG4gICAgLy8gbGluZSB0ZXJtaW5hdG9yc1xyXG4gICAgJ1xcblxcclxcdTIwMjhcXHUyMDI5JyArXHJcblxyXG4gICAgLy8gdW5pY29kZSBjYXRlZ29yeSBcIlpzXCIgc3BhY2Ugc2VwYXJhdG9yc1xyXG4gICAgJ1xcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDAnXHJcbiAgKTtcclxuXHJcbiAgLyoqIFVzZWQgdG8gbWF0Y2ggZW1wdHkgc3RyaW5nIGxpdGVyYWxzIGluIGNvbXBpbGVkIHRlbXBsYXRlIHNvdXJjZSAqL1xyXG4gIHZhciByZUVtcHR5U3RyaW5nTGVhZGluZyA9IC9cXGJfX3AgXFwrPSAnJzsvZyxcclxuICAgICAgcmVFbXB0eVN0cmluZ01pZGRsZSA9IC9cXGIoX19wIFxcKz0pICcnIFxcKy9nLFxyXG4gICAgICByZUVtcHR5U3RyaW5nVHJhaWxpbmcgPSAvKF9fZVxcKC4qP1xcKXxcXGJfX3RcXCkpIFxcK1xcbicnOy9nO1xyXG5cclxuICAvKipcclxuICAgKiBVc2VkIHRvIG1hdGNoIEVTNiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzXHJcbiAgICogaHR0cDovL3Blb3BsZS5tb3ppbGxhLm9yZy9+am9yZW5kb3JmZi9lczYtZHJhZnQuaHRtbCNzZWMtbGl0ZXJhbHMtc3RyaW5nLWxpdGVyYWxzXHJcbiAgICovXHJcbiAgdmFyIHJlRXNUZW1wbGF0ZSA9IC9cXCRcXHsoW15cXFxcfV0qKD86XFxcXC5bXlxcXFx9XSopKilcXH0vZztcclxuXHJcbiAgLyoqIFVzZWQgdG8gbWF0Y2ggcmVnZXhwIGZsYWdzIGZyb20gdGhlaXIgY29lcmNlZCBzdHJpbmcgdmFsdWVzICovXHJcbiAgdmFyIHJlRmxhZ3MgPSAvXFx3KiQvO1xyXG5cclxuICAvKiogVXNlZCB0byBkZXRlY3RlZCBuYW1lZCBmdW5jdGlvbnMgKi9cclxuICB2YXIgcmVGdW5jTmFtZSA9IC9eXFxzKmZ1bmN0aW9uWyBcXG5cXHJcXHRdK1xcdy87XHJcblxyXG4gIC8qKiBVc2VkIHRvIG1hdGNoIFwiaW50ZXJwb2xhdGVcIiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXHJcbiAgdmFyIHJlSW50ZXJwb2xhdGUgPSAvPCU9KFtcXHNcXFNdKz8pJT4vZztcclxuXHJcbiAgLyoqIFVzZWQgdG8gbWF0Y2ggbGVhZGluZyB3aGl0ZXNwYWNlIGFuZCB6ZXJvcyB0byBiZSByZW1vdmVkICovXHJcbiAgdmFyIHJlTGVhZGluZ1NwYWNlc0FuZFplcm9zID0gUmVnRXhwKCdeWycgKyB3aGl0ZXNwYWNlICsgJ10qMCsoPz0uJCknKTtcclxuXHJcbiAgLyoqIFVzZWQgdG8gZW5zdXJlIGNhcHR1cmluZyBvcmRlciBvZiB0ZW1wbGF0ZSBkZWxpbWl0ZXJzICovXHJcbiAgdmFyIHJlTm9NYXRjaCA9IC8oJF4pLztcclxuXHJcbiAgLyoqIFVzZWQgdG8gZGV0ZWN0IGZ1bmN0aW9ucyBjb250YWluaW5nIGEgYHRoaXNgIHJlZmVyZW5jZSAqL1xyXG4gIHZhciByZVRoaXMgPSAvXFxidGhpc1xcYi87XHJcblxyXG4gIC8qKiBVc2VkIHRvIG1hdGNoIHVuZXNjYXBlZCBjaGFyYWN0ZXJzIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xyXG4gIHZhciByZVVuZXNjYXBlZFN0cmluZyA9IC9bJ1xcblxcclxcdFxcdTIwMjhcXHUyMDI5XFxcXF0vZztcclxuXHJcbiAgLyoqIFVzZWQgdG8gYXNzaWduIGRlZmF1bHQgYGNvbnRleHRgIG9iamVjdCBwcm9wZXJ0aWVzICovXHJcbiAgdmFyIGNvbnRleHRQcm9wcyA9IFtcclxuICAgICdBcnJheScsICdCb29sZWFuJywgJ0RhdGUnLCAnRnVuY3Rpb24nLCAnTWF0aCcsICdOdW1iZXInLCAnT2JqZWN0JyxcclxuICAgICdSZWdFeHAnLCAnU3RyaW5nJywgJ18nLCAnYXR0YWNoRXZlbnQnLCAnY2xlYXJUaW1lb3V0JywgJ2lzRmluaXRlJywgJ2lzTmFOJyxcclxuICAgICdwYXJzZUludCcsICdzZXRUaW1lb3V0J1xyXG4gIF07XHJcblxyXG4gIC8qKiBVc2VkIHRvIG1ha2UgdGVtcGxhdGUgc291cmNlVVJMcyBlYXNpZXIgdG8gaWRlbnRpZnkgKi9cclxuICB2YXIgdGVtcGxhdGVDb3VudGVyID0gMDtcclxuXHJcbiAgLyoqIGBPYmplY3QjdG9TdHJpbmdgIHJlc3VsdCBzaG9ydGN1dHMgKi9cclxuICB2YXIgYXJnc0NsYXNzID0gJ1tvYmplY3QgQXJndW1lbnRzXScsXHJcbiAgICAgIGFycmF5Q2xhc3MgPSAnW29iamVjdCBBcnJheV0nLFxyXG4gICAgICBib29sQ2xhc3MgPSAnW29iamVjdCBCb29sZWFuXScsXHJcbiAgICAgIGRhdGVDbGFzcyA9ICdbb2JqZWN0IERhdGVdJyxcclxuICAgICAgZnVuY0NsYXNzID0gJ1tvYmplY3QgRnVuY3Rpb25dJyxcclxuICAgICAgbnVtYmVyQ2xhc3MgPSAnW29iamVjdCBOdW1iZXJdJyxcclxuICAgICAgb2JqZWN0Q2xhc3MgPSAnW29iamVjdCBPYmplY3RdJyxcclxuICAgICAgcmVnZXhwQ2xhc3MgPSAnW29iamVjdCBSZWdFeHBdJyxcclxuICAgICAgc3RyaW5nQ2xhc3MgPSAnW29iamVjdCBTdHJpbmddJztcclxuXHJcbiAgLyoqIFVzZWQgdG8gaWRlbnRpZnkgb2JqZWN0IGNsYXNzaWZpY2F0aW9ucyB0aGF0IGBfLmNsb25lYCBzdXBwb3J0cyAqL1xyXG4gIHZhciBjbG9uZWFibGVDbGFzc2VzID0ge307XHJcbiAgY2xvbmVhYmxlQ2xhc3Nlc1tmdW5jQ2xhc3NdID0gZmFsc2U7XHJcbiAgY2xvbmVhYmxlQ2xhc3Nlc1thcmdzQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1thcnJheUNsYXNzXSA9XHJcbiAgY2xvbmVhYmxlQ2xhc3Nlc1tib29sQ2xhc3NdID0gY2xvbmVhYmxlQ2xhc3Nlc1tkYXRlQ2xhc3NdID1cclxuICBjbG9uZWFibGVDbGFzc2VzW251bWJlckNsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbb2JqZWN0Q2xhc3NdID1cclxuICBjbG9uZWFibGVDbGFzc2VzW3JlZ2V4cENsYXNzXSA9IGNsb25lYWJsZUNsYXNzZXNbc3RyaW5nQ2xhc3NdID0gdHJ1ZTtcclxuXHJcbiAgLyoqIFVzZWQgYXMgYW4gaW50ZXJuYWwgYF8uZGVib3VuY2VgIG9wdGlvbnMgb2JqZWN0ICovXHJcbiAgdmFyIGRlYm91bmNlT3B0aW9ucyA9IHtcclxuICAgICdsZWFkaW5nJzogZmFsc2UsXHJcbiAgICAnbWF4V2FpdCc6IDAsXHJcbiAgICAndHJhaWxpbmcnOiBmYWxzZVxyXG4gIH07XHJcblxyXG4gIC8qKiBVc2VkIGFzIHRoZSBwcm9wZXJ0eSBkZXNjcmlwdG9yIGZvciBgX19iaW5kRGF0YV9fYCAqL1xyXG4gIHZhciBkZXNjcmlwdG9yID0ge1xyXG4gICAgJ2NvbmZpZ3VyYWJsZSc6IGZhbHNlLFxyXG4gICAgJ2VudW1lcmFibGUnOiBmYWxzZSxcclxuICAgICd2YWx1ZSc6IG51bGwsXHJcbiAgICAnd3JpdGFibGUnOiBmYWxzZVxyXG4gIH07XHJcblxyXG4gIC8qKiBVc2VkIHRvIGRldGVybWluZSBpZiB2YWx1ZXMgYXJlIG9mIHRoZSBsYW5ndWFnZSB0eXBlIE9iamVjdCAqL1xyXG4gIHZhciBvYmplY3RUeXBlcyA9IHtcclxuICAgICdib29sZWFuJzogZmFsc2UsXHJcbiAgICAnZnVuY3Rpb24nOiB0cnVlLFxyXG4gICAgJ29iamVjdCc6IHRydWUsXHJcbiAgICAnbnVtYmVyJzogZmFsc2UsXHJcbiAgICAnc3RyaW5nJzogZmFsc2UsXHJcbiAgICAndW5kZWZpbmVkJzogZmFsc2VcclxuICB9O1xyXG5cclxuICAvKiogVXNlZCB0byBlc2NhcGUgY2hhcmFjdGVycyBmb3IgaW5jbHVzaW9uIGluIGNvbXBpbGVkIHN0cmluZyBsaXRlcmFscyAqL1xyXG4gIHZhciBzdHJpbmdFc2NhcGVzID0ge1xyXG4gICAgJ1xcXFwnOiAnXFxcXCcsXHJcbiAgICBcIidcIjogXCInXCIsXHJcbiAgICAnXFxuJzogJ24nLFxyXG4gICAgJ1xccic6ICdyJyxcclxuICAgICdcXHQnOiAndCcsXHJcbiAgICAnXFx1MjAyOCc6ICd1MjAyOCcsXHJcbiAgICAnXFx1MjAyOSc6ICd1MjAyOSdcclxuICB9O1xyXG5cclxuICAvKiogVXNlZCBhcyBhIHJlZmVyZW5jZSB0byB0aGUgZ2xvYmFsIG9iamVjdCAqL1xyXG4gIHZhciByb290ID0gKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdykgfHwgdGhpcztcclxuXHJcbiAgLyoqIERldGVjdCBmcmVlIHZhcmlhYmxlIGBleHBvcnRzYCAqL1xyXG4gIHZhciBmcmVlRXhwb3J0cyA9IG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XHJcblxyXG4gIC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgbW9kdWxlYCAqL1xyXG4gIHZhciBmcmVlTW9kdWxlID0gb2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xyXG5cclxuICAvKiogRGV0ZWN0IHRoZSBwb3B1bGFyIENvbW1vbkpTIGV4dGVuc2lvbiBgbW9kdWxlLmV4cG9ydHNgICovXHJcbiAgdmFyIG1vZHVsZUV4cG9ydHMgPSBmcmVlTW9kdWxlICYmIGZyZWVNb2R1bGUuZXhwb3J0cyA9PT0gZnJlZUV4cG9ydHMgJiYgZnJlZUV4cG9ydHM7XHJcblxyXG4gIC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZSBgZ2xvYmFsYCBmcm9tIE5vZGUuanMgb3IgQnJvd3NlcmlmaWVkIGNvZGUgYW5kIHVzZSBpdCBhcyBgcm9vdGAgKi9cclxuICB2YXIgZnJlZUdsb2JhbCA9IG9iamVjdFR5cGVzW3R5cGVvZiBnbG9iYWxdICYmIGdsb2JhbDtcclxuICBpZiAoZnJlZUdsb2JhbCAmJiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHwgZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwpKSB7XHJcbiAgICByb290ID0gZnJlZUdsb2JhbDtcclxuICB9XHJcblxyXG4gIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5pbmRleE9mYCB3aXRob3V0IHN1cHBvcnQgZm9yIGJpbmFyeSBzZWFyY2hlc1xyXG4gICAqIG9yIGBmcm9tSW5kZXhgIGNvbnN0cmFpbnRzLlxyXG4gICAqXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxyXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXHJcbiAgICogQHBhcmFtIHtudW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tLlxyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBtYXRjaGVkIHZhbHVlIG9yIGAtMWAuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gYmFzZUluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpIHtcclxuICAgIHZhciBpbmRleCA9IChmcm9tSW5kZXggfHwgMCkgLSAxLFxyXG4gICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcclxuXHJcbiAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICBpZiAoYXJyYXlbaW5kZXhdID09PSB2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiBpbmRleDtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIC0xO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQW4gaW1wbGVtZW50YXRpb24gb2YgYF8uY29udGFpbnNgIGZvciBjYWNoZSBvYmplY3RzIHRoYXQgbWltaWNzIHRoZSByZXR1cm5cclxuICAgKiBzaWduYXR1cmUgb2YgYF8uaW5kZXhPZmAgYnkgcmV0dXJuaW5nIGAwYCBpZiB0aGUgdmFsdWUgaXMgZm91bmQsIGVsc2UgYC0xYC5cclxuICAgKlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGNhY2hlIFRoZSBjYWNoZSBvYmplY3QgdG8gaW5zcGVjdC5cclxuICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBzZWFyY2ggZm9yLlxyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgYDBgIGlmIGB2YWx1ZWAgaXMgZm91bmQsIGVsc2UgYC0xYC5cclxuICAgKi9cclxuICBmdW5jdGlvbiBjYWNoZUluZGV4T2YoY2FjaGUsIHZhbHVlKSB7XHJcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcclxuICAgIGNhY2hlID0gY2FjaGUuY2FjaGU7XHJcblxyXG4gICAgaWYgKHR5cGUgPT0gJ2Jvb2xlYW4nIHx8IHZhbHVlID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIGNhY2hlW3ZhbHVlXSA/IDAgOiAtMTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlICE9ICdudW1iZXInICYmIHR5cGUgIT0gJ3N0cmluZycpIHtcclxuICAgICAgdHlwZSA9ICdvYmplY3QnO1xyXG4gICAgfVxyXG4gICAgdmFyIGtleSA9IHR5cGUgPT0gJ251bWJlcicgPyB2YWx1ZSA6IGtleVByZWZpeCArIHZhbHVlO1xyXG4gICAgY2FjaGUgPSAoY2FjaGUgPSBjYWNoZVt0eXBlXSkgJiYgY2FjaGVba2V5XTtcclxuXHJcbiAgICByZXR1cm4gdHlwZSA9PSAnb2JqZWN0J1xyXG4gICAgICA/IChjYWNoZSAmJiBiYXNlSW5kZXhPZihjYWNoZSwgdmFsdWUpID4gLTEgPyAwIDogLTEpXHJcbiAgICAgIDogKGNhY2hlID8gMCA6IC0xKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYSBnaXZlbiB2YWx1ZSB0byB0aGUgY29ycmVzcG9uZGluZyBjYWNoZSBvYmplY3QuXHJcbiAgICpcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGFkZCB0byB0aGUgY2FjaGUuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gY2FjaGVQdXNoKHZhbHVlKSB7XHJcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlLFxyXG4gICAgICAgIHR5cGUgPSB0eXBlb2YgdmFsdWU7XHJcblxyXG4gICAgaWYgKHR5cGUgPT0gJ2Jvb2xlYW4nIHx8IHZhbHVlID09IG51bGwpIHtcclxuICAgICAgY2FjaGVbdmFsdWVdID0gdHJ1ZTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICh0eXBlICE9ICdudW1iZXInICYmIHR5cGUgIT0gJ3N0cmluZycpIHtcclxuICAgICAgICB0eXBlID0gJ29iamVjdCc7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGtleSA9IHR5cGUgPT0gJ251bWJlcicgPyB2YWx1ZSA6IGtleVByZWZpeCArIHZhbHVlLFxyXG4gICAgICAgICAgdHlwZUNhY2hlID0gY2FjaGVbdHlwZV0gfHwgKGNhY2hlW3R5cGVdID0ge30pO1xyXG5cclxuICAgICAgaWYgKHR5cGUgPT0gJ29iamVjdCcpIHtcclxuICAgICAgICAodHlwZUNhY2hlW2tleV0gfHwgKHR5cGVDYWNoZVtrZXldID0gW10pKS5wdXNoKHZhbHVlKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0eXBlQ2FjaGVba2V5XSA9IHRydWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVzZWQgYnkgYF8ubWF4YCBhbmQgYF8ubWluYCBhcyB0aGUgZGVmYXVsdCBjYWxsYmFjayB3aGVuIGEgZ2l2ZW5cclxuICAgKiBjb2xsZWN0aW9uIGlzIGEgc3RyaW5nIHZhbHVlLlxyXG4gICAqXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWUgVGhlIGNoYXJhY3RlciB0byBpbnNwZWN0LlxyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIGNvZGUgdW5pdCBvZiBnaXZlbiBjaGFyYWN0ZXIuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gY2hhckF0Q2FsbGJhY2sodmFsdWUpIHtcclxuICAgIHJldHVybiB2YWx1ZS5jaGFyQ29kZUF0KDApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXNlZCBieSBgc29ydEJ5YCB0byBjb21wYXJlIHRyYW5zZm9ybWVkIGBjb2xsZWN0aW9uYCBlbGVtZW50cywgc3RhYmxlIHNvcnRpbmdcclxuICAgKiB0aGVtIGluIGFzY2VuZGluZyBvcmRlci5cclxuICAgKlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtPYmplY3R9IGEgVGhlIG9iamVjdCB0byBjb21wYXJlIHRvIGBiYC5cclxuICAgKiBAcGFyYW0ge09iamVjdH0gYiBUaGUgb2JqZWN0IHRvIGNvbXBhcmUgdG8gYGFgLlxyXG4gICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHNvcnQgb3JkZXIgaW5kaWNhdG9yIG9mIGAxYCBvciBgLTFgLlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGNvbXBhcmVBc2NlbmRpbmcoYSwgYikge1xyXG4gICAgdmFyIGFjID0gYS5jcml0ZXJpYSxcclxuICAgICAgICBiYyA9IGIuY3JpdGVyaWEsXHJcbiAgICAgICAgaW5kZXggPSAtMSxcclxuICAgICAgICBsZW5ndGggPSBhYy5sZW5ndGg7XHJcblxyXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgdmFyIHZhbHVlID0gYWNbaW5kZXhdLFxyXG4gICAgICAgICAgb3RoZXIgPSBiY1tpbmRleF07XHJcblxyXG4gICAgICBpZiAodmFsdWUgIT09IG90aGVyKSB7XHJcbiAgICAgICAgaWYgKHZhbHVlID4gb3RoZXIgfHwgdHlwZW9mIHZhbHVlID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHZhbHVlIDwgb3RoZXIgfHwgdHlwZW9mIG90aGVyID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICAvLyBGaXhlcyBhbiBgQXJyYXkjc29ydGAgYnVnIGluIHRoZSBKUyBlbmdpbmUgZW1iZWRkZWQgaW4gQWRvYmUgYXBwbGljYXRpb25zXHJcbiAgICAvLyB0aGF0IGNhdXNlcyBpdCwgdW5kZXIgY2VydGFpbiBjaXJjdW1zdGFuY2VzLCB0byByZXR1cm4gdGhlIHNhbWUgdmFsdWUgZm9yXHJcbiAgICAvLyBgYWAgYW5kIGBiYC4gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qYXNoa2VuYXMvdW5kZXJzY29yZS9wdWxsLzEyNDdcclxuICAgIC8vXHJcbiAgICAvLyBUaGlzIGFsc28gZW5zdXJlcyBhIHN0YWJsZSBzb3J0IGluIFY4IGFuZCBvdGhlciBlbmdpbmVzLlxyXG4gICAgLy8gU2VlIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTkwXHJcbiAgICByZXR1cm4gYS5pbmRleCAtIGIuaW5kZXg7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgY2FjaGUgb2JqZWN0IHRvIG9wdGltaXplIGxpbmVhciBzZWFyY2hlcyBvZiBsYXJnZSBhcnJheXMuXHJcbiAgICpcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7QXJyYXl9IFthcnJheT1bXV0gVGhlIGFycmF5IHRvIHNlYXJjaC5cclxuICAgKiBAcmV0dXJucyB7bnVsbHxPYmplY3R9IFJldHVybnMgdGhlIGNhY2hlIG9iamVjdCBvciBgbnVsbGAgaWYgY2FjaGluZyBzaG91bGQgbm90IGJlIHVzZWQuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gY3JlYXRlQ2FjaGUoYXJyYXkpIHtcclxuICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcclxuICAgICAgICBmaXJzdCA9IGFycmF5WzBdLFxyXG4gICAgICAgIG1pZCA9IGFycmF5WyhsZW5ndGggLyAyKSB8IDBdLFxyXG4gICAgICAgIGxhc3QgPSBhcnJheVtsZW5ndGggLSAxXTtcclxuXHJcbiAgICBpZiAoZmlyc3QgJiYgdHlwZW9mIGZpcnN0ID09ICdvYmplY3QnICYmXHJcbiAgICAgICAgbWlkICYmIHR5cGVvZiBtaWQgPT0gJ29iamVjdCcgJiYgbGFzdCAmJiB0eXBlb2YgbGFzdCA9PSAnb2JqZWN0Jykge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB2YXIgY2FjaGUgPSBnZXRPYmplY3QoKTtcclxuICAgIGNhY2hlWydmYWxzZSddID0gY2FjaGVbJ251bGwnXSA9IGNhY2hlWyd0cnVlJ10gPSBjYWNoZVsndW5kZWZpbmVkJ10gPSBmYWxzZTtcclxuXHJcbiAgICB2YXIgcmVzdWx0ID0gZ2V0T2JqZWN0KCk7XHJcbiAgICByZXN1bHQuYXJyYXkgPSBhcnJheTtcclxuICAgIHJlc3VsdC5jYWNoZSA9IGNhY2hlO1xyXG4gICAgcmVzdWx0LnB1c2ggPSBjYWNoZVB1c2g7XHJcblxyXG4gICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgcmVzdWx0LnB1c2goYXJyYXlbaW5kZXhdKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVc2VkIGJ5IGB0ZW1wbGF0ZWAgdG8gZXNjYXBlIGNoYXJhY3RlcnMgZm9yIGluY2x1c2lvbiBpbiBjb21waWxlZFxyXG4gICAqIHN0cmluZyBsaXRlcmFscy5cclxuICAgKlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtzdHJpbmd9IG1hdGNoIFRoZSBtYXRjaGVkIGNoYXJhY3RlciB0byBlc2NhcGUuXHJcbiAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgZXNjYXBlZCBjaGFyYWN0ZXIuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gZXNjYXBlU3RyaW5nQ2hhcihtYXRjaCkge1xyXG4gICAgcmV0dXJuICdcXFxcJyArIHN0cmluZ0VzY2FwZXNbbWF0Y2hdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0cyBhbiBhcnJheSBmcm9tIHRoZSBhcnJheSBwb29sIG9yIGNyZWF0ZXMgYSBuZXcgb25lIGlmIHRoZSBwb29sIGlzIGVtcHR5LlxyXG4gICAqXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBhcnJheSBmcm9tIHRoZSBwb29sLlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIGdldEFycmF5KCkge1xyXG4gICAgcmV0dXJuIGFycmF5UG9vbC5wb3AoKSB8fCBbXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldHMgYW4gb2JqZWN0IGZyb20gdGhlIG9iamVjdCBwb29sIG9yIGNyZWF0ZXMgYSBuZXcgb25lIGlmIHRoZSBwb29sIGlzIGVtcHR5LlxyXG4gICAqXHJcbiAgICogQHByaXZhdGVcclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBUaGUgb2JqZWN0IGZyb20gdGhlIHBvb2wuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gZ2V0T2JqZWN0KCkge1xyXG4gICAgcmV0dXJuIG9iamVjdFBvb2wucG9wKCkgfHwge1xyXG4gICAgICAnYXJyYXknOiBudWxsLFxyXG4gICAgICAnY2FjaGUnOiBudWxsLFxyXG4gICAgICAnY3JpdGVyaWEnOiBudWxsLFxyXG4gICAgICAnZmFsc2UnOiBmYWxzZSxcclxuICAgICAgJ2luZGV4JzogMCxcclxuICAgICAgJ251bGwnOiBmYWxzZSxcclxuICAgICAgJ251bWJlcic6IG51bGwsXHJcbiAgICAgICdvYmplY3QnOiBudWxsLFxyXG4gICAgICAncHVzaCc6IG51bGwsXHJcbiAgICAgICdzdHJpbmcnOiBudWxsLFxyXG4gICAgICAndHJ1ZSc6IGZhbHNlLFxyXG4gICAgICAndW5kZWZpbmVkJzogZmFsc2UsXHJcbiAgICAgICd2YWx1ZSc6IG51bGxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWxlYXNlcyB0aGUgZ2l2ZW4gYXJyYXkgYmFjayB0byB0aGUgYXJyYXkgcG9vbC5cclxuICAgKlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtBcnJheX0gW2FycmF5XSBUaGUgYXJyYXkgdG8gcmVsZWFzZS5cclxuICAgKi9cclxuICBmdW5jdGlvbiByZWxlYXNlQXJyYXkoYXJyYXkpIHtcclxuICAgIGFycmF5Lmxlbmd0aCA9IDA7XHJcbiAgICBpZiAoYXJyYXlQb29sLmxlbmd0aCA8IG1heFBvb2xTaXplKSB7XHJcbiAgICAgIGFycmF5UG9vbC5wdXNoKGFycmF5KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbGVhc2VzIHRoZSBnaXZlbiBvYmplY3QgYmFjayB0byB0aGUgb2JqZWN0IHBvb2wuXHJcbiAgICpcclxuICAgKiBAcHJpdmF0ZVxyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb2JqZWN0XSBUaGUgb2JqZWN0IHRvIHJlbGVhc2UuXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gcmVsZWFzZU9iamVjdChvYmplY3QpIHtcclxuICAgIHZhciBjYWNoZSA9IG9iamVjdC5jYWNoZTtcclxuICAgIGlmIChjYWNoZSkge1xyXG4gICAgICByZWxlYXNlT2JqZWN0KGNhY2hlKTtcclxuICAgIH1cclxuICAgIG9iamVjdC5hcnJheSA9IG9iamVjdC5jYWNoZSA9IG9iamVjdC5jcml0ZXJpYSA9IG9iamVjdC5vYmplY3QgPSBvYmplY3QubnVtYmVyID0gb2JqZWN0LnN0cmluZyA9IG9iamVjdC52YWx1ZSA9IG51bGw7XHJcbiAgICBpZiAob2JqZWN0UG9vbC5sZW5ndGggPCBtYXhQb29sU2l6ZSkge1xyXG4gICAgICBvYmplY3RQb29sLnB1c2gob2JqZWN0KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNsaWNlcyB0aGUgYGNvbGxlY3Rpb25gIGZyb20gdGhlIGBzdGFydGAgaW5kZXggdXAgdG8sIGJ1dCBub3QgaW5jbHVkaW5nLFxyXG4gICAqIHRoZSBgZW5kYCBpbmRleC5cclxuICAgKlxyXG4gICAqIE5vdGU6IFRoaXMgZnVuY3Rpb24gaXMgdXNlZCBpbnN0ZWFkIG9mIGBBcnJheSNzbGljZWAgdG8gc3VwcG9ydCBub2RlIGxpc3RzXHJcbiAgICogaW4gSUUgPCA5IGFuZCB0byBlbnN1cmUgZGVuc2UgYXJyYXlzIGFyZSByZXR1cm5lZC5cclxuICAgKlxyXG4gICAqIEBwcml2YXRlXHJcbiAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIHNsaWNlLlxyXG4gICAqIEBwYXJhbSB7bnVtYmVyfSBzdGFydCBUaGUgc3RhcnQgaW5kZXguXHJcbiAgICogQHBhcmFtIHtudW1iZXJ9IGVuZCBUaGUgZW5kIGluZGV4LlxyXG4gICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGFycmF5LlxyXG4gICAqL1xyXG4gIGZ1bmN0aW9uIHNsaWNlKGFycmF5LCBzdGFydCwgZW5kKSB7XHJcbiAgICBzdGFydCB8fCAoc3RhcnQgPSAwKTtcclxuICAgIGlmICh0eXBlb2YgZW5kID09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIGVuZCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcclxuICAgIH1cclxuICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgIGxlbmd0aCA9IGVuZCAtIHN0YXJ0IHx8IDAsXHJcbiAgICAgICAgcmVzdWx0ID0gQXJyYXkobGVuZ3RoIDwgMCA/IDAgOiBsZW5ndGgpO1xyXG5cclxuICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgIHJlc3VsdFtpbmRleF0gPSBhcnJheVtzdGFydCArIGluZGV4XTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IGBsb2Rhc2hgIGZ1bmN0aW9uIHVzaW5nIHRoZSBnaXZlbiBjb250ZXh0IG9iamVjdC5cclxuICAgKlxyXG4gICAqIEBzdGF0aWNcclxuICAgKiBAbWVtYmVyT2YgX1xyXG4gICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHQ9cm9vdF0gVGhlIGNvbnRleHQgb2JqZWN0LlxyXG4gICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgYGxvZGFzaGAgZnVuY3Rpb24uXHJcbiAgICovXHJcbiAgZnVuY3Rpb24gcnVuSW5Db250ZXh0KGNvbnRleHQpIHtcclxuICAgIC8vIEF2b2lkIGlzc3VlcyB3aXRoIHNvbWUgRVMzIGVudmlyb25tZW50cyB0aGF0IGF0dGVtcHQgdG8gdXNlIHZhbHVlcywgbmFtZWRcclxuICAgIC8vIGFmdGVyIGJ1aWx0LWluIGNvbnN0cnVjdG9ycyBsaWtlIGBPYmplY3RgLCBmb3IgdGhlIGNyZWF0aW9uIG9mIGxpdGVyYWxzLlxyXG4gICAgLy8gRVM1IGNsZWFycyB0aGlzIHVwIGJ5IHN0YXRpbmcgdGhhdCBsaXRlcmFscyBtdXN0IHVzZSBidWlsdC1pbiBjb25zdHJ1Y3RvcnMuXHJcbiAgICAvLyBTZWUgaHR0cDovL2VzNS5naXRodWIuaW8vI3gxMS4xLjUuXHJcbiAgICBjb250ZXh0ID0gY29udGV4dCA/IF8uZGVmYXVsdHMocm9vdC5PYmplY3QoKSwgY29udGV4dCwgXy5waWNrKHJvb3QsIGNvbnRleHRQcm9wcykpIDogcm9vdDtcclxuXHJcbiAgICAvKiogTmF0aXZlIGNvbnN0cnVjdG9yIHJlZmVyZW5jZXMgKi9cclxuICAgIHZhciBBcnJheSA9IGNvbnRleHQuQXJyYXksXHJcbiAgICAgICAgQm9vbGVhbiA9IGNvbnRleHQuQm9vbGVhbixcclxuICAgICAgICBEYXRlID0gY29udGV4dC5EYXRlLFxyXG4gICAgICAgIEZ1bmN0aW9uID0gY29udGV4dC5GdW5jdGlvbixcclxuICAgICAgICBNYXRoID0gY29udGV4dC5NYXRoLFxyXG4gICAgICAgIE51bWJlciA9IGNvbnRleHQuTnVtYmVyLFxyXG4gICAgICAgIE9iamVjdCA9IGNvbnRleHQuT2JqZWN0LFxyXG4gICAgICAgIFJlZ0V4cCA9IGNvbnRleHQuUmVnRXhwLFxyXG4gICAgICAgIFN0cmluZyA9IGNvbnRleHQuU3RyaW5nLFxyXG4gICAgICAgIFR5cGVFcnJvciA9IGNvbnRleHQuVHlwZUVycm9yO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBmb3IgYEFycmF5YCBtZXRob2QgcmVmZXJlbmNlcy5cclxuICAgICAqXHJcbiAgICAgKiBOb3JtYWxseSBgQXJyYXkucHJvdG90eXBlYCB3b3VsZCBzdWZmaWNlLCBob3dldmVyLCB1c2luZyBhbiBhcnJheSBsaXRlcmFsXHJcbiAgICAgKiBhdm9pZHMgaXNzdWVzIGluIE5hcndoYWwuXHJcbiAgICAgKi9cclxuICAgIHZhciBhcnJheVJlZiA9IFtdO1xyXG5cclxuICAgIC8qKiBVc2VkIGZvciBuYXRpdmUgbWV0aG9kIHJlZmVyZW5jZXMgKi9cclxuICAgIHZhciBvYmplY3RQcm90byA9IE9iamVjdC5wcm90b3R5cGU7XHJcblxyXG4gICAgLyoqIFVzZWQgdG8gcmVzdG9yZSB0aGUgb3JpZ2luYWwgYF9gIHJlZmVyZW5jZSBpbiBgbm9Db25mbGljdGAgKi9cclxuICAgIHZhciBvbGREYXNoID0gY29udGV4dC5fO1xyXG5cclxuICAgIC8qKiBVc2VkIHRvIHJlc29sdmUgdGhlIGludGVybmFsIFtbQ2xhc3NdXSBvZiB2YWx1ZXMgKi9cclxuICAgIHZhciB0b1N0cmluZyA9IG9iamVjdFByb3RvLnRvU3RyaW5nO1xyXG5cclxuICAgIC8qKiBVc2VkIHRvIGRldGVjdCBpZiBhIG1ldGhvZCBpcyBuYXRpdmUgKi9cclxuICAgIHZhciByZU5hdGl2ZSA9IFJlZ0V4cCgnXicgK1xyXG4gICAgICBTdHJpbmcodG9TdHJpbmcpXHJcbiAgICAgICAgLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcclxuICAgICAgICAucmVwbGFjZSgvdG9TdHJpbmd8IGZvciBbXlxcXV0rL2csICcuKj8nKSArICckJ1xyXG4gICAgKTtcclxuXHJcbiAgICAvKiogTmF0aXZlIG1ldGhvZCBzaG9ydGN1dHMgKi9cclxuICAgIHZhciBjZWlsID0gTWF0aC5jZWlsLFxyXG4gICAgICAgIGNsZWFyVGltZW91dCA9IGNvbnRleHQuY2xlYXJUaW1lb3V0LFxyXG4gICAgICAgIGZsb29yID0gTWF0aC5mbG9vcixcclxuICAgICAgICBmblRvU3RyaW5nID0gRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nLFxyXG4gICAgICAgIGdldFByb3RvdHlwZU9mID0gaXNOYXRpdmUoZ2V0UHJvdG90eXBlT2YgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YpICYmIGdldFByb3RvdHlwZU9mLFxyXG4gICAgICAgIGhhc093blByb3BlcnR5ID0gb2JqZWN0UHJvdG8uaGFzT3duUHJvcGVydHksXHJcbiAgICAgICAgcHVzaCA9IGFycmF5UmVmLnB1c2gsXHJcbiAgICAgICAgc2V0VGltZW91dCA9IGNvbnRleHQuc2V0VGltZW91dCxcclxuICAgICAgICBzcGxpY2UgPSBhcnJheVJlZi5zcGxpY2UsXHJcbiAgICAgICAgdW5zaGlmdCA9IGFycmF5UmVmLnVuc2hpZnQ7XHJcblxyXG4gICAgLyoqIFVzZWQgdG8gc2V0IG1ldGEgZGF0YSBvbiBmdW5jdGlvbnMgKi9cclxuICAgIHZhciBkZWZpbmVQcm9wZXJ0eSA9IChmdW5jdGlvbigpIHtcclxuICAgICAgLy8gSUUgOCBvbmx5IGFjY2VwdHMgRE9NIGVsZW1lbnRzXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgdmFyIG8gPSB7fSxcclxuICAgICAgICAgICAgZnVuYyA9IGlzTmF0aXZlKGZ1bmMgPSBPYmplY3QuZGVmaW5lUHJvcGVydHkpICYmIGZ1bmMsXHJcbiAgICAgICAgICAgIHJlc3VsdCA9IGZ1bmMobywgbywgbykgJiYgZnVuYztcclxuICAgICAgfSBjYXRjaChlKSB7IH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0oKSk7XHJcblxyXG4gICAgLyogTmF0aXZlIG1ldGhvZCBzaG9ydGN1dHMgZm9yIG1ldGhvZHMgd2l0aCB0aGUgc2FtZSBuYW1lIGFzIG90aGVyIGBsb2Rhc2hgIG1ldGhvZHMgKi9cclxuICAgIHZhciBuYXRpdmVDcmVhdGUgPSBpc05hdGl2ZShuYXRpdmVDcmVhdGUgPSBPYmplY3QuY3JlYXRlKSAmJiBuYXRpdmVDcmVhdGUsXHJcbiAgICAgICAgbmF0aXZlSXNBcnJheSA9IGlzTmF0aXZlKG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5KSAmJiBuYXRpdmVJc0FycmF5LFxyXG4gICAgICAgIG5hdGl2ZUlzRmluaXRlID0gY29udGV4dC5pc0Zpbml0ZSxcclxuICAgICAgICBuYXRpdmVJc05hTiA9IGNvbnRleHQuaXNOYU4sXHJcbiAgICAgICAgbmF0aXZlS2V5cyA9IGlzTmF0aXZlKG5hdGl2ZUtleXMgPSBPYmplY3Qua2V5cykgJiYgbmF0aXZlS2V5cyxcclxuICAgICAgICBuYXRpdmVNYXggPSBNYXRoLm1heCxcclxuICAgICAgICBuYXRpdmVNaW4gPSBNYXRoLm1pbixcclxuICAgICAgICBuYXRpdmVQYXJzZUludCA9IGNvbnRleHQucGFyc2VJbnQsXHJcbiAgICAgICAgbmF0aXZlUmFuZG9tID0gTWF0aC5yYW5kb207XHJcblxyXG4gICAgLyoqIFVzZWQgdG8gbG9va3VwIGEgYnVpbHQtaW4gY29uc3RydWN0b3IgYnkgW1tDbGFzc11dICovXHJcbiAgICB2YXIgY3RvckJ5Q2xhc3MgPSB7fTtcclxuICAgIGN0b3JCeUNsYXNzW2FycmF5Q2xhc3NdID0gQXJyYXk7XHJcbiAgICBjdG9yQnlDbGFzc1tib29sQ2xhc3NdID0gQm9vbGVhbjtcclxuICAgIGN0b3JCeUNsYXNzW2RhdGVDbGFzc10gPSBEYXRlO1xyXG4gICAgY3RvckJ5Q2xhc3NbZnVuY0NsYXNzXSA9IEZ1bmN0aW9uO1xyXG4gICAgY3RvckJ5Q2xhc3Nbb2JqZWN0Q2xhc3NdID0gT2JqZWN0O1xyXG4gICAgY3RvckJ5Q2xhc3NbbnVtYmVyQ2xhc3NdID0gTnVtYmVyO1xyXG4gICAgY3RvckJ5Q2xhc3NbcmVnZXhwQ2xhc3NdID0gUmVnRXhwO1xyXG4gICAgY3RvckJ5Q2xhc3Nbc3RyaW5nQ2xhc3NdID0gU3RyaW5nO1xyXG5cclxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGBsb2Rhc2hgIG9iamVjdCB3aGljaCB3cmFwcyB0aGUgZ2l2ZW4gdmFsdWUgdG8gZW5hYmxlIGludHVpdGl2ZVxyXG4gICAgICogbWV0aG9kIGNoYWluaW5nLlxyXG4gICAgICpcclxuICAgICAqIEluIGFkZGl0aW9uIHRvIExvLURhc2ggbWV0aG9kcywgd3JhcHBlcnMgYWxzbyBoYXZlIHRoZSBmb2xsb3dpbmcgYEFycmF5YCBtZXRob2RzOlxyXG4gICAgICogYGNvbmNhdGAsIGBqb2luYCwgYHBvcGAsIGBwdXNoYCwgYHJldmVyc2VgLCBgc2hpZnRgLCBgc2xpY2VgLCBgc29ydGAsIGBzcGxpY2VgLFxyXG4gICAgICogYW5kIGB1bnNoaWZ0YFxyXG4gICAgICpcclxuICAgICAqIENoYWluaW5nIGlzIHN1cHBvcnRlZCBpbiBjdXN0b20gYnVpbGRzIGFzIGxvbmcgYXMgdGhlIGB2YWx1ZWAgbWV0aG9kIGlzXHJcbiAgICAgKiBpbXBsaWNpdGx5IG9yIGV4cGxpY2l0bHkgaW5jbHVkZWQgaW4gdGhlIGJ1aWxkLlxyXG4gICAgICpcclxuICAgICAqIFRoZSBjaGFpbmFibGUgd3JhcHBlciBmdW5jdGlvbnMgYXJlOlxyXG4gICAgICogYGFmdGVyYCwgYGFzc2lnbmAsIGBiaW5kYCwgYGJpbmRBbGxgLCBgYmluZEtleWAsIGBjaGFpbmAsIGBjb21wYWN0YCxcclxuICAgICAqIGBjb21wb3NlYCwgYGNvbmNhdGAsIGBjb3VudEJ5YCwgYGNyZWF0ZWAsIGBjcmVhdGVDYWxsYmFja2AsIGBjdXJyeWAsXHJcbiAgICAgKiBgZGVib3VuY2VgLCBgZGVmYXVsdHNgLCBgZGVmZXJgLCBgZGVsYXlgLCBgZGlmZmVyZW5jZWAsIGBmaWx0ZXJgLCBgZmxhdHRlbmAsXHJcbiAgICAgKiBgZm9yRWFjaGAsIGBmb3JFYWNoUmlnaHRgLCBgZm9ySW5gLCBgZm9ySW5SaWdodGAsIGBmb3JPd25gLCBgZm9yT3duUmlnaHRgLFxyXG4gICAgICogYGZ1bmN0aW9uc2AsIGBncm91cEJ5YCwgYGluZGV4QnlgLCBgaW5pdGlhbGAsIGBpbnRlcnNlY3Rpb25gLCBgaW52ZXJ0YCxcclxuICAgICAqIGBpbnZva2VgLCBga2V5c2AsIGBtYXBgLCBgbWF4YCwgYG1lbW9pemVgLCBgbWVyZ2VgLCBgbWluYCwgYG9iamVjdGAsIGBvbWl0YCxcclxuICAgICAqIGBvbmNlYCwgYHBhaXJzYCwgYHBhcnRpYWxgLCBgcGFydGlhbFJpZ2h0YCwgYHBpY2tgLCBgcGx1Y2tgLCBgcHVsbGAsIGBwdXNoYCxcclxuICAgICAqIGByYW5nZWAsIGByZWplY3RgLCBgcmVtb3ZlYCwgYHJlc3RgLCBgcmV2ZXJzZWAsIGBzaHVmZmxlYCwgYHNsaWNlYCwgYHNvcnRgLFxyXG4gICAgICogYHNvcnRCeWAsIGBzcGxpY2VgLCBgdGFwYCwgYHRocm90dGxlYCwgYHRpbWVzYCwgYHRvQXJyYXlgLCBgdHJhbnNmb3JtYCxcclxuICAgICAqIGB1bmlvbmAsIGB1bmlxYCwgYHVuc2hpZnRgLCBgdW56aXBgLCBgdmFsdWVzYCwgYHdoZXJlYCwgYHdpdGhvdXRgLCBgd3JhcGAsXHJcbiAgICAgKiBhbmQgYHppcGBcclxuICAgICAqXHJcbiAgICAgKiBUaGUgbm9uLWNoYWluYWJsZSB3cmFwcGVyIGZ1bmN0aW9ucyBhcmU6XHJcbiAgICAgKiBgY2xvbmVgLCBgY2xvbmVEZWVwYCwgYGNvbnRhaW5zYCwgYGVzY2FwZWAsIGBldmVyeWAsIGBmaW5kYCwgYGZpbmRJbmRleGAsXHJcbiAgICAgKiBgZmluZEtleWAsIGBmaW5kTGFzdGAsIGBmaW5kTGFzdEluZGV4YCwgYGZpbmRMYXN0S2V5YCwgYGhhc2AsIGBpZGVudGl0eWAsXHJcbiAgICAgKiBgaW5kZXhPZmAsIGBpc0FyZ3VtZW50c2AsIGBpc0FycmF5YCwgYGlzQm9vbGVhbmAsIGBpc0RhdGVgLCBgaXNFbGVtZW50YCxcclxuICAgICAqIGBpc0VtcHR5YCwgYGlzRXF1YWxgLCBgaXNGaW5pdGVgLCBgaXNGdW5jdGlvbmAsIGBpc05hTmAsIGBpc051bGxgLCBgaXNOdW1iZXJgLFxyXG4gICAgICogYGlzT2JqZWN0YCwgYGlzUGxhaW5PYmplY3RgLCBgaXNSZWdFeHBgLCBgaXNTdHJpbmdgLCBgaXNVbmRlZmluZWRgLCBgam9pbmAsXHJcbiAgICAgKiBgbGFzdEluZGV4T2ZgLCBgbWl4aW5gLCBgbm9Db25mbGljdGAsIGBwYXJzZUludGAsIGBwb3BgLCBgcmFuZG9tYCwgYHJlZHVjZWAsXHJcbiAgICAgKiBgcmVkdWNlUmlnaHRgLCBgcmVzdWx0YCwgYHNoaWZ0YCwgYHNpemVgLCBgc29tZWAsIGBzb3J0ZWRJbmRleGAsIGBydW5JbkNvbnRleHRgLFxyXG4gICAgICogYHRlbXBsYXRlYCwgYHVuZXNjYXBlYCwgYHVuaXF1ZUlkYCwgYW5kIGB2YWx1ZWBcclxuICAgICAqXHJcbiAgICAgKiBUaGUgd3JhcHBlciBmdW5jdGlvbnMgYGZpcnN0YCBhbmQgYGxhc3RgIHJldHVybiB3cmFwcGVkIHZhbHVlcyB3aGVuIGBuYCBpc1xyXG4gICAgICogcHJvdmlkZWQsIG90aGVyd2lzZSB0aGV5IHJldHVybiB1bndyYXBwZWQgdmFsdWVzLlxyXG4gICAgICpcclxuICAgICAqIEV4cGxpY2l0IGNoYWluaW5nIGNhbiBiZSBlbmFibGVkIGJ5IHVzaW5nIHRoZSBgXy5jaGFpbmAgbWV0aG9kLlxyXG4gICAgICpcclxuICAgICAqIEBuYW1lIF9cclxuICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwIGluIGEgYGxvZGFzaGAgaW5zdGFuY2UuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGEgYGxvZGFzaGAgaW5zdGFuY2UuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciB3cmFwcGVkID0gXyhbMSwgMiwgM10pO1xyXG4gICAgICpcclxuICAgICAqIC8vIHJldHVybnMgYW4gdW53cmFwcGVkIHZhbHVlXHJcbiAgICAgKiB3cmFwcGVkLnJlZHVjZShmdW5jdGlvbihzdW0sIG51bSkge1xyXG4gICAgICogICByZXR1cm4gc3VtICsgbnVtO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiA2XHJcbiAgICAgKlxyXG4gICAgICogLy8gcmV0dXJucyBhIHdyYXBwZWQgdmFsdWVcclxuICAgICAqIHZhciBzcXVhcmVzID0gd3JhcHBlZC5tYXAoZnVuY3Rpb24obnVtKSB7XHJcbiAgICAgKiAgIHJldHVybiBudW0gKiBudW07XHJcbiAgICAgKiB9KTtcclxuICAgICAqXHJcbiAgICAgKiBfLmlzQXJyYXkoc3F1YXJlcyk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNBcnJheShzcXVhcmVzLnZhbHVlKCkpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBsb2Rhc2godmFsdWUpIHtcclxuICAgICAgLy8gZG9uJ3Qgd3JhcCBpZiBhbHJlYWR5IHdyYXBwZWQsIGV2ZW4gaWYgd3JhcHBlZCBieSBhIGRpZmZlcmVudCBgbG9kYXNoYCBjb25zdHJ1Y3RvclxyXG4gICAgICByZXR1cm4gKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiAhaXNBcnJheSh2YWx1ZSkgJiYgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgJ19fd3JhcHBlZF9fJykpXHJcbiAgICAgICA/IHZhbHVlXHJcbiAgICAgICA6IG5ldyBsb2Rhc2hXcmFwcGVyKHZhbHVlKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEEgZmFzdCBwYXRoIGZvciBjcmVhdGluZyBgbG9kYXNoYCB3cmFwcGVyIG9iamVjdHMuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHdyYXAgaW4gYSBgbG9kYXNoYCBpbnN0YW5jZS5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gY2hhaW5BbGwgQSBmbGFnIHRvIGVuYWJsZSBjaGFpbmluZyBmb3IgYWxsIG1ldGhvZHNcclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYSBgbG9kYXNoYCBpbnN0YW5jZS5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbG9kYXNoV3JhcHBlcih2YWx1ZSwgY2hhaW5BbGwpIHtcclxuICAgICAgdGhpcy5fX2NoYWluX18gPSAhIWNoYWluQWxsO1xyXG4gICAgICB0aGlzLl9fd3JhcHBlZF9fID0gdmFsdWU7XHJcbiAgICB9XHJcbiAgICAvLyBlbnN1cmUgYG5ldyBsb2Rhc2hXcmFwcGVyYCBpcyBhbiBpbnN0YW5jZSBvZiBgbG9kYXNoYFxyXG4gICAgbG9kYXNoV3JhcHBlci5wcm90b3R5cGUgPSBsb2Rhc2gucHJvdG90eXBlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQW4gb2JqZWN0IHVzZWQgdG8gZmxhZyBlbnZpcm9ubWVudHMgZmVhdHVyZXMuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEB0eXBlIE9iamVjdFxyXG4gICAgICovXHJcbiAgICB2YXIgc3VwcG9ydCA9IGxvZGFzaC5zdXBwb3J0ID0ge307XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBEZXRlY3QgaWYgZnVuY3Rpb25zIGNhbiBiZSBkZWNvbXBpbGVkIGJ5IGBGdW5jdGlvbiN0b1N0cmluZ2BcclxuICAgICAqIChhbGwgYnV0IFBTMyBhbmQgb2xkZXIgT3BlcmEgbW9iaWxlIGJyb3dzZXJzICYgYXZvaWRlZCBpbiBXaW5kb3dzIDggYXBwcykuXHJcbiAgICAgKlxyXG4gICAgICogQG1lbWJlck9mIF8uc3VwcG9ydFxyXG4gICAgICogQHR5cGUgYm9vbGVhblxyXG4gICAgICovXHJcbiAgICBzdXBwb3J0LmZ1bmNEZWNvbXAgPSAhaXNOYXRpdmUoY29udGV4dC5XaW5SVEVycm9yKSAmJiByZVRoaXMudGVzdChydW5JbkNvbnRleHQpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGV0ZWN0IGlmIGBGdW5jdGlvbiNuYW1lYCBpcyBzdXBwb3J0ZWQgKGFsbCBidXQgSUUpLlxyXG4gICAgICpcclxuICAgICAqIEBtZW1iZXJPZiBfLnN1cHBvcnRcclxuICAgICAqIEB0eXBlIGJvb2xlYW5cclxuICAgICAqL1xyXG4gICAgc3VwcG9ydC5mdW5jTmFtZXMgPSB0eXBlb2YgRnVuY3Rpb24ubmFtZSA9PSAnc3RyaW5nJztcclxuXHJcbiAgICAvKipcclxuICAgICAqIEJ5IGRlZmF1bHQsIHRoZSB0ZW1wbGF0ZSBkZWxpbWl0ZXJzIHVzZWQgYnkgTG8tRGFzaCBhcmUgc2ltaWxhciB0byB0aG9zZSBpblxyXG4gICAgICogZW1iZWRkZWQgUnVieSAoRVJCKS4gQ2hhbmdlIHRoZSBmb2xsb3dpbmcgdGVtcGxhdGUgc2V0dGluZ3MgdG8gdXNlIGFsdGVybmF0aXZlXHJcbiAgICAgKiBkZWxpbWl0ZXJzLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAdHlwZSBPYmplY3RcclxuICAgICAqL1xyXG4gICAgbG9kYXNoLnRlbXBsYXRlU2V0dGluZ3MgPSB7XHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogVXNlZCB0byBkZXRlY3QgYGRhdGFgIHByb3BlcnR5IHZhbHVlcyB0byBiZSBIVE1MLWVzY2FwZWQuXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcclxuICAgICAgICogQHR5cGUgUmVnRXhwXHJcbiAgICAgICAqL1xyXG4gICAgICAnZXNjYXBlJzogLzwlLShbXFxzXFxTXSs/KSU+L2csXHJcblxyXG4gICAgICAvKipcclxuICAgICAgICogVXNlZCB0byBkZXRlY3QgY29kZSB0byBiZSBldmFsdWF0ZWQuXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcclxuICAgICAgICogQHR5cGUgUmVnRXhwXHJcbiAgICAgICAqL1xyXG4gICAgICAnZXZhbHVhdGUnOiAvPCUoW1xcc1xcU10rPyklPi9nLFxyXG5cclxuICAgICAgLyoqXHJcbiAgICAgICAqIFVzZWQgdG8gZGV0ZWN0IGBkYXRhYCBwcm9wZXJ0eSB2YWx1ZXMgdG8gaW5qZWN0LlxyXG4gICAgICAgKlxyXG4gICAgICAgKiBAbWVtYmVyT2YgXy50ZW1wbGF0ZVNldHRpbmdzXHJcbiAgICAgICAqIEB0eXBlIFJlZ0V4cFxyXG4gICAgICAgKi9cclxuICAgICAgJ2ludGVycG9sYXRlJzogcmVJbnRlcnBvbGF0ZSxcclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBVc2VkIHRvIHJlZmVyZW5jZSB0aGUgZGF0YSBvYmplY3QgaW4gdGhlIHRlbXBsYXRlIHRleHQuXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcclxuICAgICAgICogQHR5cGUgc3RyaW5nXHJcbiAgICAgICAqL1xyXG4gICAgICAndmFyaWFibGUnOiAnJyxcclxuXHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBVc2VkIHRvIGltcG9ydCB2YXJpYWJsZXMgaW50byB0aGUgY29tcGlsZWQgdGVtcGxhdGUuXHJcbiAgICAgICAqXHJcbiAgICAgICAqIEBtZW1iZXJPZiBfLnRlbXBsYXRlU2V0dGluZ3NcclxuICAgICAgICogQHR5cGUgT2JqZWN0XHJcbiAgICAgICAqL1xyXG4gICAgICAnaW1wb3J0cyc6IHtcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQSByZWZlcmVuY2UgdG8gdGhlIGBsb2Rhc2hgIGZ1bmN0aW9uLlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQG1lbWJlck9mIF8udGVtcGxhdGVTZXR0aW5ncy5pbXBvcnRzXHJcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cclxuICAgICAgICAgKi9cclxuICAgICAgICAnXyc6IGxvZGFzaFxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uYmluZGAgdGhhdCBjcmVhdGVzIHRoZSBib3VuZCBmdW5jdGlvbiBhbmRcclxuICAgICAqIHNldHMgaXRzIG1ldGEgZGF0YS5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYmluZERhdGEgVGhlIGJpbmQgZGF0YSBhcnJheS5cclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGJvdW5kIGZ1bmN0aW9uLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBiYXNlQmluZChiaW5kRGF0YSkge1xyXG4gICAgICB2YXIgZnVuYyA9IGJpbmREYXRhWzBdLFxyXG4gICAgICAgICAgcGFydGlhbEFyZ3MgPSBiaW5kRGF0YVsyXSxcclxuICAgICAgICAgIHRoaXNBcmcgPSBiaW5kRGF0YVs0XTtcclxuXHJcbiAgICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xyXG4gICAgICAgIC8vIGBGdW5jdGlvbiNiaW5kYCBzcGVjXHJcbiAgICAgICAgLy8gaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS4zLjQuNVxyXG4gICAgICAgIGlmIChwYXJ0aWFsQXJncykge1xyXG4gICAgICAgICAgLy8gYXZvaWQgYGFyZ3VtZW50c2Agb2JqZWN0IGRlb3B0aW1pemF0aW9ucyBieSB1c2luZyBgc2xpY2VgIGluc3RlYWRcclxuICAgICAgICAgIC8vIG9mIGBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbGAgYW5kIG5vdCBhc3NpZ25pbmcgYGFyZ3VtZW50c2AgdG8gYVxyXG4gICAgICAgICAgLy8gdmFyaWFibGUgYXMgYSB0ZXJuYXJ5IGV4cHJlc3Npb25cclxuICAgICAgICAgIHZhciBhcmdzID0gc2xpY2UocGFydGlhbEFyZ3MpO1xyXG4gICAgICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBtaW1pYyB0aGUgY29uc3RydWN0b3IncyBgcmV0dXJuYCBiZWhhdmlvclxyXG4gICAgICAgIC8vIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTMuMi4yXHJcbiAgICAgICAgaWYgKHRoaXMgaW5zdGFuY2VvZiBib3VuZCkge1xyXG4gICAgICAgICAgLy8gZW5zdXJlIGBuZXcgYm91bmRgIGlzIGFuIGluc3RhbmNlIG9mIGBmdW5jYFxyXG4gICAgICAgICAgdmFyIHRoaXNCaW5kaW5nID0gYmFzZUNyZWF0ZShmdW5jLnByb3RvdHlwZSksXHJcbiAgICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQmluZGluZywgYXJncyB8fCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHJlc3VsdCkgPyByZXN1bHQgOiB0aGlzQmluZGluZztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyB8fCBhcmd1bWVudHMpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldEJpbmREYXRhKGJvdW5kLCBiaW5kRGF0YSk7XHJcbiAgICAgIHJldHVybiBib3VuZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmNsb25lYCB3aXRob3V0IGFyZ3VtZW50IGp1Z2dsaW5nIG9yIHN1cHBvcnRcclxuICAgICAqIGZvciBgdGhpc0FyZ2AgYmluZGluZy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2xvbmUuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc0RlZXA9ZmFsc2VdIFNwZWNpZnkgYSBkZWVwIGNsb25lLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGNsb25pbmcgdmFsdWVzLlxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3N0YWNrQT1bXV0gVHJhY2tzIHRyYXZlcnNlZCBzb3VyY2Ugb2JqZWN0cy5cclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtzdGFja0I9W11dIEFzc29jaWF0ZXMgY2xvbmVzIHdpdGggc291cmNlIGNvdW50ZXJwYXJ0cy5cclxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBjbG9uZWQgdmFsdWUuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJhc2VDbG9uZSh2YWx1ZSwgaXNEZWVwLCBjYWxsYmFjaywgc3RhY2tBLCBzdGFja0IpIHtcclxuICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IGNhbGxiYWNrKHZhbHVlKTtcclxuICAgICAgICBpZiAodHlwZW9mIHJlc3VsdCAhPSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gaW5zcGVjdCBbW0NsYXNzXV1cclxuICAgICAgdmFyIGlzT2JqID0gaXNPYmplY3QodmFsdWUpO1xyXG4gICAgICBpZiAoaXNPYmopIHtcclxuICAgICAgICB2YXIgY2xhc3NOYW1lID0gdG9TdHJpbmcuY2FsbCh2YWx1ZSk7XHJcbiAgICAgICAgaWYgKCFjbG9uZWFibGVDbGFzc2VzW2NsYXNzTmFtZV0pIHtcclxuICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIGN0b3IgPSBjdG9yQnlDbGFzc1tjbGFzc05hbWVdO1xyXG4gICAgICAgIHN3aXRjaCAoY2xhc3NOYW1lKSB7XHJcbiAgICAgICAgICBjYXNlIGJvb2xDbGFzczpcclxuICAgICAgICAgIGNhc2UgZGF0ZUNsYXNzOlxyXG4gICAgICAgICAgICByZXR1cm4gbmV3IGN0b3IoK3ZhbHVlKTtcclxuXHJcbiAgICAgICAgICBjYXNlIG51bWJlckNsYXNzOlxyXG4gICAgICAgICAgY2FzZSBzdHJpbmdDbGFzczpcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBjdG9yKHZhbHVlKTtcclxuXHJcbiAgICAgICAgICBjYXNlIHJlZ2V4cENsYXNzOlxyXG4gICAgICAgICAgICByZXN1bHQgPSBjdG9yKHZhbHVlLnNvdXJjZSwgcmVGbGFncy5leGVjKHZhbHVlKSk7XHJcbiAgICAgICAgICAgIHJlc3VsdC5sYXN0SW5kZXggPSB2YWx1ZS5sYXN0SW5kZXg7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgaXNBcnIgPSBpc0FycmF5KHZhbHVlKTtcclxuICAgICAgaWYgKGlzRGVlcCkge1xyXG4gICAgICAgIC8vIGNoZWNrIGZvciBjaXJjdWxhciByZWZlcmVuY2VzIGFuZCByZXR1cm4gY29ycmVzcG9uZGluZyBjbG9uZVxyXG4gICAgICAgIHZhciBpbml0ZWRTdGFjayA9ICFzdGFja0E7XHJcbiAgICAgICAgc3RhY2tBIHx8IChzdGFja0EgPSBnZXRBcnJheSgpKTtcclxuICAgICAgICBzdGFja0IgfHwgKHN0YWNrQiA9IGdldEFycmF5KCkpO1xyXG5cclxuICAgICAgICB2YXIgbGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcclxuICAgICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcclxuICAgICAgICAgIGlmIChzdGFja0FbbGVuZ3RoXSA9PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlc3VsdCA9IGlzQXJyID8gY3Rvcih2YWx1ZS5sZW5ndGgpIDoge307XHJcbiAgICAgIH1cclxuICAgICAgZWxzZSB7XHJcbiAgICAgICAgcmVzdWx0ID0gaXNBcnIgPyBzbGljZSh2YWx1ZSkgOiBhc3NpZ24oe30sIHZhbHVlKTtcclxuICAgICAgfVxyXG4gICAgICAvLyBhZGQgYXJyYXkgcHJvcGVydGllcyBhc3NpZ25lZCBieSBgUmVnRXhwI2V4ZWNgXHJcbiAgICAgIGlmIChpc0Fycikge1xyXG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnaW5kZXgnKSkge1xyXG4gICAgICAgICAgcmVzdWx0LmluZGV4ID0gdmFsdWUuaW5kZXg7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHZhbHVlLCAnaW5wdXQnKSkge1xyXG4gICAgICAgICAgcmVzdWx0LmlucHV0ID0gdmFsdWUuaW5wdXQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8vIGV4aXQgZm9yIHNoYWxsb3cgY2xvbmVcclxuICAgICAgaWYgKCFpc0RlZXApIHtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGFkZCB0aGUgc291cmNlIHZhbHVlIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xyXG4gICAgICAvLyBhbmQgYXNzb2NpYXRlIGl0IHdpdGggaXRzIGNsb25lXHJcbiAgICAgIHN0YWNrQS5wdXNoKHZhbHVlKTtcclxuICAgICAgc3RhY2tCLnB1c2gocmVzdWx0KTtcclxuXHJcbiAgICAgIC8vIHJlY3Vyc2l2ZWx5IHBvcHVsYXRlIGNsb25lIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cylcclxuICAgICAgKGlzQXJyID8gZm9yRWFjaCA6IGZvck93bikodmFsdWUsIGZ1bmN0aW9uKG9ialZhbHVlLCBrZXkpIHtcclxuICAgICAgICByZXN1bHRba2V5XSA9IGJhc2VDbG9uZShvYmpWYWx1ZSwgaXNEZWVwLCBjYWxsYmFjaywgc3RhY2tBLCBzdGFja0IpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChpbml0ZWRTdGFjaykge1xyXG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0EpO1xyXG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0IpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5jcmVhdGVgIHdpdGhvdXQgc3VwcG9ydCBmb3IgYXNzaWduaW5nXHJcbiAgICAgKiBwcm9wZXJ0aWVzIHRvIHRoZSBjcmVhdGVkIG9iamVjdC5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHByb3RvdHlwZSBUaGUgb2JqZWN0IHRvIGluaGVyaXQgZnJvbS5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIG5ldyBvYmplY3QuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJhc2VDcmVhdGUocHJvdG90eXBlLCBwcm9wZXJ0aWVzKSB7XHJcbiAgICAgIHJldHVybiBpc09iamVjdChwcm90b3R5cGUpID8gbmF0aXZlQ3JlYXRlKHByb3RvdHlwZSkgOiB7fTtcclxuICAgIH1cclxuICAgIC8vIGZhbGxiYWNrIGZvciBicm93c2VycyB3aXRob3V0IGBPYmplY3QuY3JlYXRlYFxyXG4gICAgaWYgKCFuYXRpdmVDcmVhdGUpIHtcclxuICAgICAgYmFzZUNyZWF0ZSA9IChmdW5jdGlvbigpIHtcclxuICAgICAgICBmdW5jdGlvbiBPYmplY3QoKSB7fVxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbihwcm90b3R5cGUpIHtcclxuICAgICAgICAgIGlmIChpc09iamVjdChwcm90b3R5cGUpKSB7XHJcbiAgICAgICAgICAgIE9iamVjdC5wcm90b3R5cGUgPSBwcm90b3R5cGU7XHJcbiAgICAgICAgICAgIHZhciByZXN1bHQgPSBuZXcgT2JqZWN0O1xyXG4gICAgICAgICAgICBPYmplY3QucHJvdG90eXBlID0gbnVsbDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZXN1bHQgfHwgY29udGV4dC5PYmplY3QoKTtcclxuICAgICAgICB9O1xyXG4gICAgICB9KCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIGJhc2UgaW1wbGVtZW50YXRpb24gb2YgYF8uY3JlYXRlQ2FsbGJhY2tgIHdpdGhvdXQgc3VwcG9ydCBmb3IgY3JlYXRpbmdcclxuICAgICAqIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrcy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHsqfSBbZnVuYz1pZGVudGl0eV0gVGhlIHZhbHVlIHRvIGNvbnZlcnQgdG8gYSBjYWxsYmFjay5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiB0aGUgY3JlYXRlZCBjYWxsYmFjay5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJnQ291bnRdIFRoZSBudW1iZXIgb2YgYXJndW1lbnRzIHRoZSBjYWxsYmFjayBhY2NlcHRzLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIGEgY2FsbGJhY2sgZnVuY3Rpb24uXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJhc2VDcmVhdGVDYWxsYmFjayhmdW5jLCB0aGlzQXJnLCBhcmdDb3VudCkge1xyXG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHJldHVybiBpZGVudGl0eTtcclxuICAgICAgfVxyXG4gICAgICAvLyBleGl0IGVhcmx5IGZvciBubyBgdGhpc0FyZ2Agb3IgYWxyZWFkeSBib3VuZCBieSBgRnVuY3Rpb24jYmluZGBcclxuICAgICAgaWYgKHR5cGVvZiB0aGlzQXJnID09ICd1bmRlZmluZWQnIHx8ICEoJ3Byb3RvdHlwZScgaW4gZnVuYykpIHtcclxuICAgICAgICByZXR1cm4gZnVuYztcclxuICAgICAgfVxyXG4gICAgICB2YXIgYmluZERhdGEgPSBmdW5jLl9fYmluZERhdGFfXztcclxuICAgICAgaWYgKHR5cGVvZiBiaW5kRGF0YSA9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIGlmIChzdXBwb3J0LmZ1bmNOYW1lcykge1xyXG4gICAgICAgICAgYmluZERhdGEgPSAhZnVuYy5uYW1lO1xyXG4gICAgICAgIH1cclxuICAgICAgICBiaW5kRGF0YSA9IGJpbmREYXRhIHx8ICFzdXBwb3J0LmZ1bmNEZWNvbXA7XHJcbiAgICAgICAgaWYgKCFiaW5kRGF0YSkge1xyXG4gICAgICAgICAgdmFyIHNvdXJjZSA9IGZuVG9TdHJpbmcuY2FsbChmdW5jKTtcclxuICAgICAgICAgIGlmICghc3VwcG9ydC5mdW5jTmFtZXMpIHtcclxuICAgICAgICAgICAgYmluZERhdGEgPSAhcmVGdW5jTmFtZS50ZXN0KHNvdXJjZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZiAoIWJpbmREYXRhKSB7XHJcbiAgICAgICAgICAgIC8vIGNoZWNrcyBpZiBgZnVuY2AgcmVmZXJlbmNlcyB0aGUgYHRoaXNgIGtleXdvcmQgYW5kIHN0b3JlcyB0aGUgcmVzdWx0XHJcbiAgICAgICAgICAgIGJpbmREYXRhID0gcmVUaGlzLnRlc3Qoc291cmNlKTtcclxuICAgICAgICAgICAgc2V0QmluZERhdGEoZnVuYywgYmluZERhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICAvLyBleGl0IGVhcmx5IGlmIHRoZXJlIGFyZSBubyBgdGhpc2AgcmVmZXJlbmNlcyBvciBgZnVuY2AgaXMgYm91bmRcclxuICAgICAgaWYgKGJpbmREYXRhID09PSBmYWxzZSB8fCAoYmluZERhdGEgIT09IHRydWUgJiYgYmluZERhdGFbMV0gJiAxKSkge1xyXG4gICAgICAgIHJldHVybiBmdW5jO1xyXG4gICAgICB9XHJcbiAgICAgIHN3aXRjaCAoYXJnQ291bnQpIHtcclxuICAgICAgICBjYXNlIDE6IHJldHVybiBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgcmV0dXJuIGZ1bmMuY2FsbCh0aGlzQXJnLCB2YWx1ZSk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBjYXNlIDI6IHJldHVybiBmdW5jdGlvbihhLCBiKSB7XHJcbiAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGEsIGIpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgY2FzZSAzOiByZXR1cm4gZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBjYXNlIDQ6IHJldHVybiBmdW5jdGlvbihhY2N1bXVsYXRvciwgdmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICByZXR1cm4gZnVuYy5jYWxsKHRoaXNBcmcsIGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJpbmQoZnVuYywgdGhpc0FyZyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgY3JlYXRlV3JhcHBlcmAgdGhhdCBjcmVhdGVzIHRoZSB3cmFwcGVyIGFuZFxyXG4gICAgICogc2V0cyBpdHMgbWV0YSBkYXRhLlxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBiaW5kRGF0YSBUaGUgYmluZCBkYXRhIGFycmF5LlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJhc2VDcmVhdGVXcmFwcGVyKGJpbmREYXRhKSB7XHJcbiAgICAgIHZhciBmdW5jID0gYmluZERhdGFbMF0sXHJcbiAgICAgICAgICBiaXRtYXNrID0gYmluZERhdGFbMV0sXHJcbiAgICAgICAgICBwYXJ0aWFsQXJncyA9IGJpbmREYXRhWzJdLFxyXG4gICAgICAgICAgcGFydGlhbFJpZ2h0QXJncyA9IGJpbmREYXRhWzNdLFxyXG4gICAgICAgICAgdGhpc0FyZyA9IGJpbmREYXRhWzRdLFxyXG4gICAgICAgICAgYXJpdHkgPSBiaW5kRGF0YVs1XTtcclxuXHJcbiAgICAgIHZhciBpc0JpbmQgPSBiaXRtYXNrICYgMSxcclxuICAgICAgICAgIGlzQmluZEtleSA9IGJpdG1hc2sgJiAyLFxyXG4gICAgICAgICAgaXNDdXJyeSA9IGJpdG1hc2sgJiA0LFxyXG4gICAgICAgICAgaXNDdXJyeUJvdW5kID0gYml0bWFzayAmIDgsXHJcbiAgICAgICAgICBrZXkgPSBmdW5jO1xyXG5cclxuICAgICAgZnVuY3Rpb24gYm91bmQoKSB7XHJcbiAgICAgICAgdmFyIHRoaXNCaW5kaW5nID0gaXNCaW5kID8gdGhpc0FyZyA6IHRoaXM7XHJcbiAgICAgICAgaWYgKHBhcnRpYWxBcmdzKSB7XHJcbiAgICAgICAgICB2YXIgYXJncyA9IHNsaWNlKHBhcnRpYWxBcmdzKTtcclxuICAgICAgICAgIHB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHBhcnRpYWxSaWdodEFyZ3MgfHwgaXNDdXJyeSkge1xyXG4gICAgICAgICAgYXJncyB8fCAoYXJncyA9IHNsaWNlKGFyZ3VtZW50cykpO1xyXG4gICAgICAgICAgaWYgKHBhcnRpYWxSaWdodEFyZ3MpIHtcclxuICAgICAgICAgICAgcHVzaC5hcHBseShhcmdzLCBwYXJ0aWFsUmlnaHRBcmdzKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChpc0N1cnJ5ICYmIGFyZ3MubGVuZ3RoIDwgYXJpdHkpIHtcclxuICAgICAgICAgICAgYml0bWFzayB8PSAxNiAmIH4zMjtcclxuICAgICAgICAgICAgcmV0dXJuIGJhc2VDcmVhdGVXcmFwcGVyKFtmdW5jLCAoaXNDdXJyeUJvdW5kID8gYml0bWFzayA6IGJpdG1hc2sgJiB+MyksIGFyZ3MsIG51bGwsIHRoaXNBcmcsIGFyaXR5XSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFyZ3MgfHwgKGFyZ3MgPSBhcmd1bWVudHMpO1xyXG4gICAgICAgIGlmIChpc0JpbmRLZXkpIHtcclxuICAgICAgICAgIGZ1bmMgPSB0aGlzQmluZGluZ1trZXldO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcyBpbnN0YW5jZW9mIGJvdW5kKSB7XHJcbiAgICAgICAgICB0aGlzQmluZGluZyA9IGJhc2VDcmVhdGUoZnVuYy5wcm90b3R5cGUpO1xyXG4gICAgICAgICAgdmFyIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xyXG4gICAgICAgICAgcmV0dXJuIGlzT2JqZWN0KHJlc3VsdCkgPyByZXN1bHQgOiB0aGlzQmluZGluZztcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZ1bmMuYXBwbHkodGhpc0JpbmRpbmcsIGFyZ3MpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldEJpbmREYXRhKGJvdW5kLCBiaW5kRGF0YSk7XHJcbiAgICAgIHJldHVybiBib3VuZDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmRpZmZlcmVuY2VgIHRoYXQgYWNjZXB0cyBhIHNpbmdsZSBhcnJheVxyXG4gICAgICogb2YgdmFsdWVzIHRvIGV4Y2x1ZGUuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBwcm9jZXNzLlxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3ZhbHVlc10gVGhlIGFycmF5IG9mIHZhbHVlcyB0byBleGNsdWRlLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGZpbHRlcmVkIHZhbHVlcy5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmFzZURpZmZlcmVuY2UoYXJyYXksIHZhbHVlcykge1xyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIGluZGV4T2YgPSBnZXRJbmRleE9mKCksXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICBpc0xhcmdlID0gbGVuZ3RoID49IGxhcmdlQXJyYXlTaXplICYmIGluZGV4T2YgPT09IGJhc2VJbmRleE9mLFxyXG4gICAgICAgICAgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICBpZiAoaXNMYXJnZSkge1xyXG4gICAgICAgIHZhciBjYWNoZSA9IGNyZWF0ZUNhY2hlKHZhbHVlcyk7XHJcbiAgICAgICAgaWYgKGNhY2hlKSB7XHJcbiAgICAgICAgICBpbmRleE9mID0gY2FjaGVJbmRleE9mO1xyXG4gICAgICAgICAgdmFsdWVzID0gY2FjaGU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGlzTGFyZ2UgPSBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XHJcbiAgICAgICAgaWYgKGluZGV4T2YodmFsdWVzLCB2YWx1ZSkgPCAwKSB7XHJcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc0xhcmdlKSB7XHJcbiAgICAgICAgcmVsZWFzZU9iamVjdCh2YWx1ZXMpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5mbGF0dGVuYCB3aXRob3V0IHN1cHBvcnQgZm9yIGNhbGxiYWNrXHJcbiAgICAgKiBzaG9ydGhhbmRzIG9yIGB0aGlzQXJnYCBiaW5kaW5nLlxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gZmxhdHRlbi5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lzU2hhbGxvdz1mYWxzZV0gQSBmbGFnIHRvIHJlc3RyaWN0IGZsYXR0ZW5pbmcgdG8gYSBzaW5nbGUgbGV2ZWwuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtpc1N0cmljdD1mYWxzZV0gQSBmbGFnIHRvIHJlc3RyaWN0IGZsYXR0ZW5pbmcgdG8gYXJyYXlzIGFuZCBgYXJndW1lbnRzYCBvYmplY3RzLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHN0YXJ0IGZyb20uXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgZmxhdHRlbmVkIGFycmF5LlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBiYXNlRmxhdHRlbihhcnJheSwgaXNTaGFsbG93LCBpc1N0cmljdCwgZnJvbUluZGV4KSB7XHJcbiAgICAgIHZhciBpbmRleCA9IChmcm9tSW5kZXggfHwgMCkgLSAxLFxyXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxyXG4gICAgICAgICAgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XTtcclxuXHJcbiAgICAgICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWUubGVuZ3RoID09ICdudW1iZXInXHJcbiAgICAgICAgICAgICYmIChpc0FycmF5KHZhbHVlKSB8fCBpc0FyZ3VtZW50cyh2YWx1ZSkpKSB7XHJcbiAgICAgICAgICAvLyByZWN1cnNpdmVseSBmbGF0dGVuIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXHJcbiAgICAgICAgICBpZiAoIWlzU2hhbGxvdykge1xyXG4gICAgICAgICAgICB2YWx1ZSA9IGJhc2VGbGF0dGVuKHZhbHVlLCBpc1NoYWxsb3csIGlzU3RyaWN0KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHZhciB2YWxJbmRleCA9IC0xLFxyXG4gICAgICAgICAgICAgIHZhbExlbmd0aCA9IHZhbHVlLmxlbmd0aCxcclxuICAgICAgICAgICAgICByZXNJbmRleCA9IHJlc3VsdC5sZW5ndGg7XHJcblxyXG4gICAgICAgICAgcmVzdWx0Lmxlbmd0aCArPSB2YWxMZW5ndGg7XHJcbiAgICAgICAgICB3aGlsZSAoKyt2YWxJbmRleCA8IHZhbExlbmd0aCkge1xyXG4gICAgICAgICAgICByZXN1bHRbcmVzSW5kZXgrK10gPSB2YWx1ZVt2YWxJbmRleF07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICghaXNTdHJpY3QpIHtcclxuICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLmlzRXF1YWxgLCB3aXRob3V0IHN1cHBvcnQgZm9yIGB0aGlzQXJnYCBiaW5kaW5nLFxyXG4gICAgICogdGhhdCBhbGxvd3MgcGFydGlhbCBcIl8ud2hlcmVcIiBzdHlsZSBjb21wYXJpc29ucy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHsqfSBhIFRoZSB2YWx1ZSB0byBjb21wYXJlLlxyXG4gICAgICogQHBhcmFtIHsqfSBiIFRoZSBvdGhlciB2YWx1ZSB0byBjb21wYXJlLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gdG8gY3VzdG9taXplIGNvbXBhcmluZyB2YWx1ZXMuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbaXNXaGVyZT1mYWxzZV0gQSBmbGFnIHRvIGluZGljYXRlIHBlcmZvcm1pbmcgcGFydGlhbCBjb21wYXJpc29ucy5cclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtzdGFja0E9W11dIFRyYWNrcyB0cmF2ZXJzZWQgYGFgIG9iamVjdHMuXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbc3RhY2tCPVtdXSBUcmFja3MgdHJhdmVyc2VkIGBiYCBvYmplY3RzLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmFzZUlzRXF1YWwoYSwgYiwgY2FsbGJhY2ssIGlzV2hlcmUsIHN0YWNrQSwgc3RhY2tCKSB7XHJcbiAgICAgIC8vIHVzZWQgdG8gaW5kaWNhdGUgdGhhdCB3aGVuIGNvbXBhcmluZyBvYmplY3RzLCBgYWAgaGFzIGF0IGxlYXN0IHRoZSBwcm9wZXJ0aWVzIG9mIGBiYFxyXG4gICAgICBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2soYSwgYik7XHJcbiAgICAgICAgaWYgKHR5cGVvZiByZXN1bHQgIT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgIHJldHVybiAhIXJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gZXhpdCBlYXJseSBmb3IgaWRlbnRpY2FsIHZhbHVlc1xyXG4gICAgICBpZiAoYSA9PT0gYikge1xyXG4gICAgICAgIC8vIHRyZWF0IGArMGAgdnMuIGAtMGAgYXMgbm90IGVxdWFsXHJcbiAgICAgICAgcmV0dXJuIGEgIT09IDAgfHwgKDEgLyBhID09IDEgLyBiKTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgdHlwZSA9IHR5cGVvZiBhLFxyXG4gICAgICAgICAgb3RoZXJUeXBlID0gdHlwZW9mIGI7XHJcblxyXG4gICAgICAvLyBleGl0IGVhcmx5IGZvciB1bmxpa2UgcHJpbWl0aXZlIHZhbHVlc1xyXG4gICAgICBpZiAoYSA9PT0gYSAmJlxyXG4gICAgICAgICAgIShhICYmIG9iamVjdFR5cGVzW3R5cGVdKSAmJlxyXG4gICAgICAgICAgIShiICYmIG9iamVjdFR5cGVzW290aGVyVHlwZV0pKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGV4aXQgZWFybHkgZm9yIGBudWxsYCBhbmQgYHVuZGVmaW5lZGAgYXZvaWRpbmcgRVMzJ3MgRnVuY3Rpb24jY2FsbCBiZWhhdmlvclxyXG4gICAgICAvLyBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDE1LjMuNC40XHJcbiAgICAgIGlmIChhID09IG51bGwgfHwgYiA9PSBudWxsKSB7XHJcbiAgICAgICAgcmV0dXJuIGEgPT09IGI7XHJcbiAgICAgIH1cclxuICAgICAgLy8gY29tcGFyZSBbW0NsYXNzXV0gbmFtZXNcclxuICAgICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwoYSksXHJcbiAgICAgICAgICBvdGhlckNsYXNzID0gdG9TdHJpbmcuY2FsbChiKTtcclxuXHJcbiAgICAgIGlmIChjbGFzc05hbWUgPT0gYXJnc0NsYXNzKSB7XHJcbiAgICAgICAgY2xhc3NOYW1lID0gb2JqZWN0Q2xhc3M7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKG90aGVyQ2xhc3MgPT0gYXJnc0NsYXNzKSB7XHJcbiAgICAgICAgb3RoZXJDbGFzcyA9IG9iamVjdENsYXNzO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChjbGFzc05hbWUgIT0gb3RoZXJDbGFzcykge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBzd2l0Y2ggKGNsYXNzTmFtZSkge1xyXG4gICAgICAgIGNhc2UgYm9vbENsYXNzOlxyXG4gICAgICAgIGNhc2UgZGF0ZUNsYXNzOlxyXG4gICAgICAgICAgLy8gY29lcmNlIGRhdGVzIGFuZCBib29sZWFucyB0byBudW1iZXJzLCBkYXRlcyB0byBtaWxsaXNlY29uZHMgYW5kIGJvb2xlYW5zXHJcbiAgICAgICAgICAvLyB0byBgMWAgb3IgYDBgIHRyZWF0aW5nIGludmFsaWQgZGF0ZXMgY29lcmNlZCB0byBgTmFOYCBhcyBub3QgZXF1YWxcclxuICAgICAgICAgIHJldHVybiArYSA9PSArYjtcclxuXHJcbiAgICAgICAgY2FzZSBudW1iZXJDbGFzczpcclxuICAgICAgICAgIC8vIHRyZWF0IGBOYU5gIHZzLiBgTmFOYCBhcyBlcXVhbFxyXG4gICAgICAgICAgcmV0dXJuIChhICE9ICthKVxyXG4gICAgICAgICAgICA/IGIgIT0gK2JcclxuICAgICAgICAgICAgLy8gYnV0IHRyZWF0IGArMGAgdnMuIGAtMGAgYXMgbm90IGVxdWFsXHJcbiAgICAgICAgICAgIDogKGEgPT0gMCA/ICgxIC8gYSA9PSAxIC8gYikgOiBhID09ICtiKTtcclxuXHJcbiAgICAgICAgY2FzZSByZWdleHBDbGFzczpcclxuICAgICAgICBjYXNlIHN0cmluZ0NsYXNzOlxyXG4gICAgICAgICAgLy8gY29lcmNlIHJlZ2V4ZXMgdG8gc3RyaW5ncyAoaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS4xMC42LjQpXHJcbiAgICAgICAgICAvLyB0cmVhdCBzdHJpbmcgcHJpbWl0aXZlcyBhbmQgdGhlaXIgY29ycmVzcG9uZGluZyBvYmplY3QgaW5zdGFuY2VzIGFzIGVxdWFsXHJcbiAgICAgICAgICByZXR1cm4gYSA9PSBTdHJpbmcoYik7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGlzQXJyID0gY2xhc3NOYW1lID09IGFycmF5Q2xhc3M7XHJcbiAgICAgIGlmICghaXNBcnIpIHtcclxuICAgICAgICAvLyB1bndyYXAgYW55IGBsb2Rhc2hgIHdyYXBwZWQgdmFsdWVzXHJcbiAgICAgICAgdmFyIGFXcmFwcGVkID0gaGFzT3duUHJvcGVydHkuY2FsbChhLCAnX193cmFwcGVkX18nKSxcclxuICAgICAgICAgICAgYldyYXBwZWQgPSBoYXNPd25Qcm9wZXJ0eS5jYWxsKGIsICdfX3dyYXBwZWRfXycpO1xyXG5cclxuICAgICAgICBpZiAoYVdyYXBwZWQgfHwgYldyYXBwZWQpIHtcclxuICAgICAgICAgIHJldHVybiBiYXNlSXNFcXVhbChhV3JhcHBlZCA/IGEuX193cmFwcGVkX18gOiBhLCBiV3JhcHBlZCA/IGIuX193cmFwcGVkX18gOiBiLCBjYWxsYmFjaywgaXNXaGVyZSwgc3RhY2tBLCBzdGFja0IpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBleGl0IGZvciBmdW5jdGlvbnMgYW5kIERPTSBub2Rlc1xyXG4gICAgICAgIGlmIChjbGFzc05hbWUgIT0gb2JqZWN0Q2xhc3MpIHtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gaW4gb2xkZXIgdmVyc2lvbnMgb2YgT3BlcmEsIGBhcmd1bWVudHNgIG9iamVjdHMgaGF2ZSBgQXJyYXlgIGNvbnN0cnVjdG9yc1xyXG4gICAgICAgIHZhciBjdG9yQSA9IGEuY29uc3RydWN0b3IsXHJcbiAgICAgICAgICAgIGN0b3JCID0gYi5jb25zdHJ1Y3RvcjtcclxuXHJcbiAgICAgICAgLy8gbm9uIGBPYmplY3RgIG9iamVjdCBpbnN0YW5jZXMgd2l0aCBkaWZmZXJlbnQgY29uc3RydWN0b3JzIGFyZSBub3QgZXF1YWxcclxuICAgICAgICBpZiAoY3RvckEgIT0gY3RvckIgJiZcclxuICAgICAgICAgICAgICAhKGlzRnVuY3Rpb24oY3RvckEpICYmIGN0b3JBIGluc3RhbmNlb2YgY3RvckEgJiYgaXNGdW5jdGlvbihjdG9yQikgJiYgY3RvckIgaW5zdGFuY2VvZiBjdG9yQikgJiZcclxuICAgICAgICAgICAgICAoJ2NvbnN0cnVjdG9yJyBpbiBhICYmICdjb25zdHJ1Y3RvcicgaW4gYilcclxuICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIC8vIGFzc3VtZSBjeWNsaWMgc3RydWN0dXJlcyBhcmUgZXF1YWxcclxuICAgICAgLy8gdGhlIGFsZ29yaXRobSBmb3IgZGV0ZWN0aW5nIGN5Y2xpYyBzdHJ1Y3R1cmVzIGlzIGFkYXB0ZWQgZnJvbSBFUyA1LjFcclxuICAgICAgLy8gc2VjdGlvbiAxNS4xMi4zLCBhYnN0cmFjdCBvcGVyYXRpb24gYEpPYCAoaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS4xMi4zKVxyXG4gICAgICB2YXIgaW5pdGVkU3RhY2sgPSAhc3RhY2tBO1xyXG4gICAgICBzdGFja0EgfHwgKHN0YWNrQSA9IGdldEFycmF5KCkpO1xyXG4gICAgICBzdGFja0IgfHwgKHN0YWNrQiA9IGdldEFycmF5KCkpO1xyXG5cclxuICAgICAgdmFyIGxlbmd0aCA9IHN0YWNrQS5sZW5ndGg7XHJcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgIGlmIChzdGFja0FbbGVuZ3RoXSA9PSBhKSB7XHJcbiAgICAgICAgICByZXR1cm4gc3RhY2tCW2xlbmd0aF0gPT0gYjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgdmFyIHNpemUgPSAwO1xyXG4gICAgICByZXN1bHQgPSB0cnVlO1xyXG5cclxuICAgICAgLy8gYWRkIGBhYCBhbmQgYGJgIHRvIHRoZSBzdGFjayBvZiB0cmF2ZXJzZWQgb2JqZWN0c1xyXG4gICAgICBzdGFja0EucHVzaChhKTtcclxuICAgICAgc3RhY2tCLnB1c2goYik7XHJcblxyXG4gICAgICAvLyByZWN1cnNpdmVseSBjb21wYXJlIG9iamVjdHMgYW5kIGFycmF5cyAoc3VzY2VwdGlibGUgdG8gY2FsbCBzdGFjayBsaW1pdHMpXHJcbiAgICAgIGlmIChpc0Fycikge1xyXG4gICAgICAgIC8vIGNvbXBhcmUgbGVuZ3RocyB0byBkZXRlcm1pbmUgaWYgYSBkZWVwIGNvbXBhcmlzb24gaXMgbmVjZXNzYXJ5XHJcbiAgICAgICAgbGVuZ3RoID0gYS5sZW5ndGg7XHJcbiAgICAgICAgc2l6ZSA9IGIubGVuZ3RoO1xyXG4gICAgICAgIHJlc3VsdCA9IHNpemUgPT0gbGVuZ3RoO1xyXG5cclxuICAgICAgICBpZiAocmVzdWx0IHx8IGlzV2hlcmUpIHtcclxuICAgICAgICAgIC8vIGRlZXAgY29tcGFyZSB0aGUgY29udGVudHMsIGlnbm9yaW5nIG5vbi1udW1lcmljIHByb3BlcnRpZXNcclxuICAgICAgICAgIHdoaWxlIChzaXplLS0pIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gbGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBiW3NpemVdO1xyXG5cclxuICAgICAgICAgICAgaWYgKGlzV2hlcmUpIHtcclxuICAgICAgICAgICAgICB3aGlsZSAoaW5kZXgtLSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKChyZXN1bHQgPSBiYXNlSXNFcXVhbChhW2luZGV4XSwgdmFsdWUsIGNhbGxiYWNrLCBpc1doZXJlLCBzdGFja0EsIHN0YWNrQikpKSB7XHJcbiAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmICghKHJlc3VsdCA9IGJhc2VJc0VxdWFsKGFbc2l6ZV0sIHZhbHVlLCBjYWxsYmFjaywgaXNXaGVyZSwgc3RhY2tBLCBzdGFja0IpKSkge1xyXG4gICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGVsc2Uge1xyXG4gICAgICAgIC8vIGRlZXAgY29tcGFyZSBvYmplY3RzIHVzaW5nIGBmb3JJbmAsIGluc3RlYWQgb2YgYGZvck93bmAsIHRvIGF2b2lkIGBPYmplY3Qua2V5c2BcclxuICAgICAgICAvLyB3aGljaCwgaW4gdGhpcyBjYXNlLCBpcyBtb3JlIGNvc3RseVxyXG4gICAgICAgIGZvckluKGIsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIGIpIHtcclxuICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIGtleSkpIHtcclxuICAgICAgICAgICAgLy8gY291bnQgdGhlIG51bWJlciBvZiBwcm9wZXJ0aWVzLlxyXG4gICAgICAgICAgICBzaXplKys7XHJcbiAgICAgICAgICAgIC8vIGRlZXAgY29tcGFyZSBlYWNoIHByb3BlcnR5IHZhbHVlLlxyXG4gICAgICAgICAgICByZXR1cm4gKHJlc3VsdCA9IGhhc093blByb3BlcnR5LmNhbGwoYSwga2V5KSAmJiBiYXNlSXNFcXVhbChhW2tleV0sIHZhbHVlLCBjYWxsYmFjaywgaXNXaGVyZSwgc3RhY2tBLCBzdGFja0IpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKHJlc3VsdCAmJiAhaXNXaGVyZSkge1xyXG4gICAgICAgICAgLy8gZW5zdXJlIGJvdGggb2JqZWN0cyBoYXZlIHRoZSBzYW1lIG51bWJlciBvZiBwcm9wZXJ0aWVzXHJcbiAgICAgICAgICBmb3JJbihhLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBhKSB7XHJcbiAgICAgICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGEsIGtleSkpIHtcclxuICAgICAgICAgICAgICAvLyBgc2l6ZWAgd2lsbCBiZSBgLTFgIGlmIGBhYCBoYXMgbW9yZSBwcm9wZXJ0aWVzIHRoYW4gYGJgXHJcbiAgICAgICAgICAgICAgcmV0dXJuIChyZXN1bHQgPSAtLXNpemUgPiAtMSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBzdGFja0EucG9wKCk7XHJcbiAgICAgIHN0YWNrQi5wb3AoKTtcclxuXHJcbiAgICAgIGlmIChpbml0ZWRTdGFjaykge1xyXG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0EpO1xyXG4gICAgICAgIHJlbGVhc2VBcnJheShzdGFja0IpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgYmFzZSBpbXBsZW1lbnRhdGlvbiBvZiBgXy5tZXJnZWAgd2l0aG91dCBhcmd1bWVudCBqdWdnbGluZyBvciBzdXBwb3J0XHJcbiAgICAgKiBmb3IgYHRoaXNBcmdgIGJpbmRpbmcuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBzb3VyY2UgVGhlIHNvdXJjZSBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgbWVyZ2luZyBwcm9wZXJ0aWVzLlxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gW3N0YWNrQT1bXV0gVHJhY2tzIHRyYXZlcnNlZCBzb3VyY2Ugb2JqZWN0cy5cclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtzdGFja0I9W11dIEFzc29jaWF0ZXMgdmFsdWVzIHdpdGggc291cmNlIGNvdW50ZXJwYXJ0cy5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmFzZU1lcmdlKG9iamVjdCwgc291cmNlLCBjYWxsYmFjaywgc3RhY2tBLCBzdGFja0IpIHtcclxuICAgICAgKGlzQXJyYXkoc291cmNlKSA/IGZvckVhY2ggOiBmb3JPd24pKHNvdXJjZSwgZnVuY3Rpb24oc291cmNlLCBrZXkpIHtcclxuICAgICAgICB2YXIgZm91bmQsXHJcbiAgICAgICAgICAgIGlzQXJyLFxyXG4gICAgICAgICAgICByZXN1bHQgPSBzb3VyY2UsXHJcbiAgICAgICAgICAgIHZhbHVlID0gb2JqZWN0W2tleV07XHJcblxyXG4gICAgICAgIGlmIChzb3VyY2UgJiYgKChpc0FyciA9IGlzQXJyYXkoc291cmNlKSkgfHwgaXNQbGFpbk9iamVjdChzb3VyY2UpKSkge1xyXG4gICAgICAgICAgLy8gYXZvaWQgbWVyZ2luZyBwcmV2aW91c2x5IG1lcmdlZCBjeWNsaWMgc291cmNlc1xyXG4gICAgICAgICAgdmFyIHN0YWNrTGVuZ3RoID0gc3RhY2tBLmxlbmd0aDtcclxuICAgICAgICAgIHdoaWxlIChzdGFja0xlbmd0aC0tKSB7XHJcbiAgICAgICAgICAgIGlmICgoZm91bmQgPSBzdGFja0Fbc3RhY2tMZW5ndGhdID09IHNvdXJjZSkpIHtcclxuICAgICAgICAgICAgICB2YWx1ZSA9IHN0YWNrQltzdGFja0xlbmd0aF07XHJcbiAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICghZm91bmQpIHtcclxuICAgICAgICAgICAgdmFyIGlzU2hhbGxvdztcclxuICAgICAgICAgICAgaWYgKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgICAgICAgcmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIHNvdXJjZSk7XHJcbiAgICAgICAgICAgICAgaWYgKChpc1NoYWxsb3cgPSB0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghaXNTaGFsbG93KSB7XHJcbiAgICAgICAgICAgICAgdmFsdWUgPSBpc0FyclxyXG4gICAgICAgICAgICAgICAgPyAoaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFtdKVxyXG4gICAgICAgICAgICAgICAgOiAoaXNQbGFpbk9iamVjdCh2YWx1ZSkgPyB2YWx1ZSA6IHt9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvLyBhZGQgYHNvdXJjZWAgYW5kIGFzc29jaWF0ZWQgYHZhbHVlYCB0byB0aGUgc3RhY2sgb2YgdHJhdmVyc2VkIG9iamVjdHNcclxuICAgICAgICAgICAgc3RhY2tBLnB1c2goc291cmNlKTtcclxuICAgICAgICAgICAgc3RhY2tCLnB1c2godmFsdWUpO1xyXG5cclxuICAgICAgICAgICAgLy8gcmVjdXJzaXZlbHkgbWVyZ2Ugb2JqZWN0cyBhbmQgYXJyYXlzIChzdXNjZXB0aWJsZSB0byBjYWxsIHN0YWNrIGxpbWl0cylcclxuICAgICAgICAgICAgaWYgKCFpc1NoYWxsb3cpIHtcclxuICAgICAgICAgICAgICBiYXNlTWVyZ2UodmFsdWUsIHNvdXJjZSwgY2FsbGJhY2ssIHN0YWNrQSwgc3RhY2tCKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIHtcclxuICAgICAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgICAgICByZXN1bHQgPSBjYWxsYmFjayh2YWx1ZSwgc291cmNlKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXN1bHQgPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICByZXN1bHQgPSBzb3VyY2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0ICE9ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgICAgICAgIHZhbHVlID0gcmVzdWx0O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBvYmplY3Rba2V5XSA9IHZhbHVlO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnJhbmRvbWAgd2l0aG91dCBhcmd1bWVudCBqdWdnbGluZyBvciBzdXBwb3J0XHJcbiAgICAgKiBmb3IgcmV0dXJuaW5nIGZsb2F0aW5nLXBvaW50IG51bWJlcnMuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBtaW4gVGhlIG1pbmltdW0gcG9zc2libGUgdmFsdWUuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbWF4IFRoZSBtYXhpbXVtIHBvc3NpYmxlIHZhbHVlLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBhIHJhbmRvbSBudW1iZXIuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJhc2VSYW5kb20obWluLCBtYXgpIHtcclxuICAgICAgcmV0dXJuIG1pbiArIGZsb29yKG5hdGl2ZVJhbmRvbSgpICogKG1heCAtIG1pbiArIDEpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBiYXNlIGltcGxlbWVudGF0aW9uIG9mIGBfLnVuaXFgIHdpdGhvdXQgc3VwcG9ydCBmb3IgY2FsbGJhY2sgc2hvcnRoYW5kc1xyXG4gICAgICogb3IgYHRoaXNBcmdgIGJpbmRpbmcuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBwcm9jZXNzLlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaXNTb3J0ZWQ9ZmFsc2VdIEEgZmxhZyB0byBpbmRpY2F0ZSB0aGF0IGBhcnJheWAgaXMgc29ydGVkLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBkdXBsaWNhdGUtdmFsdWUtZnJlZSBhcnJheS5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmFzZVVuaXEoYXJyYXksIGlzU29ydGVkLCBjYWxsYmFjaykge1xyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIGluZGV4T2YgPSBnZXRJbmRleE9mKCksXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgIHZhciBpc0xhcmdlID0gIWlzU29ydGVkICYmIGxlbmd0aCA+PSBsYXJnZUFycmF5U2l6ZSAmJiBpbmRleE9mID09PSBiYXNlSW5kZXhPZixcclxuICAgICAgICAgIHNlZW4gPSAoY2FsbGJhY2sgfHwgaXNMYXJnZSkgPyBnZXRBcnJheSgpIDogcmVzdWx0O1xyXG5cclxuICAgICAgaWYgKGlzTGFyZ2UpIHtcclxuICAgICAgICB2YXIgY2FjaGUgPSBjcmVhdGVDYWNoZShzZWVuKTtcclxuICAgICAgICBpbmRleE9mID0gY2FjaGVJbmRleE9mO1xyXG4gICAgICAgIHNlZW4gPSBjYWNoZTtcclxuICAgICAgfVxyXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgIHZhciB2YWx1ZSA9IGFycmF5W2luZGV4XSxcclxuICAgICAgICAgICAgY29tcHV0ZWQgPSBjYWxsYmFjayA/IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgYXJyYXkpIDogdmFsdWU7XHJcblxyXG4gICAgICAgIGlmIChpc1NvcnRlZFxyXG4gICAgICAgICAgICAgID8gIWluZGV4IHx8IHNlZW5bc2Vlbi5sZW5ndGggLSAxXSAhPT0gY29tcHV0ZWRcclxuICAgICAgICAgICAgICA6IGluZGV4T2Yoc2VlbiwgY29tcHV0ZWQpIDwgMFxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgIGlmIChjYWxsYmFjayB8fCBpc0xhcmdlKSB7XHJcbiAgICAgICAgICAgIHNlZW4ucHVzaChjb21wdXRlZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc0xhcmdlKSB7XHJcbiAgICAgICAgcmVsZWFzZUFycmF5KHNlZW4uYXJyYXkpO1xyXG4gICAgICAgIHJlbGVhc2VPYmplY3Qoc2Vlbik7XHJcbiAgICAgIH0gZWxzZSBpZiAoY2FsbGJhY2spIHtcclxuICAgICAgICByZWxlYXNlQXJyYXkoc2Vlbik7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGFnZ3JlZ2F0ZXMgYSBjb2xsZWN0aW9uLCBjcmVhdGluZyBhbiBvYmplY3QgY29tcG9zZWRcclxuICAgICAqIG9mIGtleXMgZ2VuZXJhdGVkIGZyb20gdGhlIHJlc3VsdHMgb2YgcnVubmluZyBlYWNoIGVsZW1lbnQgb2YgdGhlIGNvbGxlY3Rpb25cclxuICAgICAqIHRocm91Z2ggYSBjYWxsYmFjay4gVGhlIGdpdmVuIGBzZXR0ZXJgIGZ1bmN0aW9uIHNldHMgdGhlIGtleXMgYW5kIHZhbHVlc1xyXG4gICAgICogb2YgdGhlIGNvbXBvc2VkIG9iamVjdC5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gc2V0dGVyIFRoZSBzZXR0ZXIgZnVuY3Rpb24uXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBhZ2dyZWdhdG9yIGZ1bmN0aW9uLlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBjcmVhdGVBZ2dyZWdhdG9yKHNldHRlcikge1xyXG4gICAgICByZXR1cm4gZnVuY3Rpb24oY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG5cclxuICAgICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGNvbGxlY3Rpb25baW5kZXhdO1xyXG4gICAgICAgICAgICBzZXR0ZXIocmVzdWx0LCB2YWx1ZSwgY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICAgIHNldHRlcihyZXN1bHQsIHZhbHVlLCBjYWxsYmFjayh2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgZWl0aGVyIGN1cnJpZXMgb3IgaW52b2tlcyBgZnVuY2BcclxuICAgICAqIHdpdGggYW4gb3B0aW9uYWwgYHRoaXNgIGJpbmRpbmcgYW5kIHBhcnRpYWxseSBhcHBsaWVkIGFyZ3VtZW50cy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxzdHJpbmd9IGZ1bmMgVGhlIGZ1bmN0aW9uIG9yIG1ldGhvZCBuYW1lIHRvIHJlZmVyZW5jZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBiaXRtYXNrIFRoZSBiaXRtYXNrIG9mIG1ldGhvZCBmbGFncyB0byBjb21wb3NlLlxyXG4gICAgICogIFRoZSBiaXRtYXNrIG1heSBiZSBjb21wb3NlZCBvZiB0aGUgZm9sbG93aW5nIGZsYWdzOlxyXG4gICAgICogIDEgLSBgXy5iaW5kYFxyXG4gICAgICogIDIgLSBgXy5iaW5kS2V5YFxyXG4gICAgICogIDQgLSBgXy5jdXJyeWBcclxuICAgICAqICA4IC0gYF8uY3VycnlgIChib3VuZClcclxuICAgICAqICAxNiAtIGBfLnBhcnRpYWxgXHJcbiAgICAgKiAgMzIgLSBgXy5wYXJ0aWFsUmlnaHRgXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbcGFydGlhbEFyZ3NdIEFuIGFycmF5IG9mIGFyZ3VtZW50cyB0byBwcmVwZW5kIHRvIHRob3NlXHJcbiAgICAgKiAgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IFtwYXJ0aWFsUmlnaHRBcmdzXSBBbiBhcnJheSBvZiBhcmd1bWVudHMgdG8gYXBwZW5kIHRvIHRob3NlXHJcbiAgICAgKiAgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgZnVuY2AuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2FyaXR5XSBUaGUgYXJpdHkgb2YgYGZ1bmNgLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZVdyYXBwZXIoZnVuYywgYml0bWFzaywgcGFydGlhbEFyZ3MsIHBhcnRpYWxSaWdodEFyZ3MsIHRoaXNBcmcsIGFyaXR5KSB7XHJcbiAgICAgIHZhciBpc0JpbmQgPSBiaXRtYXNrICYgMSxcclxuICAgICAgICAgIGlzQmluZEtleSA9IGJpdG1hc2sgJiAyLFxyXG4gICAgICAgICAgaXNDdXJyeSA9IGJpdG1hc2sgJiA0LFxyXG4gICAgICAgICAgaXNDdXJyeUJvdW5kID0gYml0bWFzayAmIDgsXHJcbiAgICAgICAgICBpc1BhcnRpYWwgPSBiaXRtYXNrICYgMTYsXHJcbiAgICAgICAgICBpc1BhcnRpYWxSaWdodCA9IGJpdG1hc2sgJiAzMjtcclxuXHJcbiAgICAgIGlmICghaXNCaW5kS2V5ICYmICFpc0Z1bmN0aW9uKGZ1bmMpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcclxuICAgICAgfVxyXG4gICAgICBpZiAoaXNQYXJ0aWFsICYmICFwYXJ0aWFsQXJncy5sZW5ndGgpIHtcclxuICAgICAgICBiaXRtYXNrICY9IH4xNjtcclxuICAgICAgICBpc1BhcnRpYWwgPSBwYXJ0aWFsQXJncyA9IGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChpc1BhcnRpYWxSaWdodCAmJiAhcGFydGlhbFJpZ2h0QXJncy5sZW5ndGgpIHtcclxuICAgICAgICBiaXRtYXNrICY9IH4zMjtcclxuICAgICAgICBpc1BhcnRpYWxSaWdodCA9IHBhcnRpYWxSaWdodEFyZ3MgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgYmluZERhdGEgPSBmdW5jICYmIGZ1bmMuX19iaW5kRGF0YV9fO1xyXG4gICAgICBpZiAoYmluZERhdGEgJiYgYmluZERhdGEgIT09IHRydWUpIHtcclxuICAgICAgICAvLyBjbG9uZSBgYmluZERhdGFgXHJcbiAgICAgICAgYmluZERhdGEgPSBzbGljZShiaW5kRGF0YSk7XHJcbiAgICAgICAgaWYgKGJpbmREYXRhWzJdKSB7XHJcbiAgICAgICAgICBiaW5kRGF0YVsyXSA9IHNsaWNlKGJpbmREYXRhWzJdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGJpbmREYXRhWzNdKSB7XHJcbiAgICAgICAgICBiaW5kRGF0YVszXSA9IHNsaWNlKGJpbmREYXRhWzNdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gc2V0IGB0aGlzQmluZGluZ2AgaXMgbm90IHByZXZpb3VzbHkgYm91bmRcclxuICAgICAgICBpZiAoaXNCaW5kICYmICEoYmluZERhdGFbMV0gJiAxKSkge1xyXG4gICAgICAgICAgYmluZERhdGFbNF0gPSB0aGlzQXJnO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBzZXQgaWYgcHJldmlvdXNseSBib3VuZCBidXQgbm90IGN1cnJlbnRseSAoc3Vic2VxdWVudCBjdXJyaWVkIGZ1bmN0aW9ucylcclxuICAgICAgICBpZiAoIWlzQmluZCAmJiBiaW5kRGF0YVsxXSAmIDEpIHtcclxuICAgICAgICAgIGJpdG1hc2sgfD0gODtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gc2V0IGN1cnJpZWQgYXJpdHkgaWYgbm90IHlldCBzZXRcclxuICAgICAgICBpZiAoaXNDdXJyeSAmJiAhKGJpbmREYXRhWzFdICYgNCkpIHtcclxuICAgICAgICAgIGJpbmREYXRhWzVdID0gYXJpdHk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGFwcGVuZCBwYXJ0aWFsIGxlZnQgYXJndW1lbnRzXHJcbiAgICAgICAgaWYgKGlzUGFydGlhbCkge1xyXG4gICAgICAgICAgcHVzaC5hcHBseShiaW5kRGF0YVsyXSB8fCAoYmluZERhdGFbMl0gPSBbXSksIHBhcnRpYWxBcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gYXBwZW5kIHBhcnRpYWwgcmlnaHQgYXJndW1lbnRzXHJcbiAgICAgICAgaWYgKGlzUGFydGlhbFJpZ2h0KSB7XHJcbiAgICAgICAgICB1bnNoaWZ0LmFwcGx5KGJpbmREYXRhWzNdIHx8IChiaW5kRGF0YVszXSA9IFtdKSwgcGFydGlhbFJpZ2h0QXJncyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIG1lcmdlIGZsYWdzXHJcbiAgICAgICAgYmluZERhdGFbMV0gfD0gYml0bWFzaztcclxuICAgICAgICByZXR1cm4gY3JlYXRlV3JhcHBlci5hcHBseShudWxsLCBiaW5kRGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gZmFzdCBwYXRoIGZvciBgXy5iaW5kYFxyXG4gICAgICB2YXIgY3JlYXRlciA9IChiaXRtYXNrID09IDEgfHwgYml0bWFzayA9PT0gMTcpID8gYmFzZUJpbmQgOiBiYXNlQ3JlYXRlV3JhcHBlcjtcclxuICAgICAgcmV0dXJuIGNyZWF0ZXIoW2Z1bmMsIGJpdG1hc2ssIHBhcnRpYWxBcmdzLCBwYXJ0aWFsUmlnaHRBcmdzLCB0aGlzQXJnLCBhcml0eV0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVXNlZCBieSBgZXNjYXBlYCB0byBjb252ZXJ0IGNoYXJhY3RlcnMgdG8gSFRNTCBlbnRpdGllcy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1hdGNoIFRoZSBtYXRjaGVkIGNoYXJhY3RlciB0byBlc2NhcGUuXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBlc2NhcGVkIGNoYXJhY3Rlci5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZXNjYXBlSHRtbENoYXIobWF0Y2gpIHtcclxuICAgICAgcmV0dXJuIGh0bWxFc2NhcGVzW21hdGNoXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIGFwcHJvcHJpYXRlIFwiaW5kZXhPZlwiIGZ1bmN0aW9uLiBJZiB0aGUgYF8uaW5kZXhPZmAgbWV0aG9kIGlzXHJcbiAgICAgKiBjdXN0b21pemVkLCB0aGlzIG1ldGhvZCByZXR1cm5zIHRoZSBjdXN0b20gbWV0aG9kLCBvdGhlcndpc2UgaXQgcmV0dXJuc1xyXG4gICAgICogdGhlIGBiYXNlSW5kZXhPZmAgZnVuY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgXCJpbmRleE9mXCIgZnVuY3Rpb24uXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGdldEluZGV4T2YoKSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSAocmVzdWx0ID0gbG9kYXNoLmluZGV4T2YpID09PSBpbmRleE9mID8gYmFzZUluZGV4T2YgOiByZXN1bHQ7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIG5hdGl2ZSBmdW5jdGlvbi5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBuYXRpdmUgZnVuY3Rpb24sIGVsc2UgYGZhbHNlYC5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNOYXRpdmUodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnZnVuY3Rpb24nICYmIHJlTmF0aXZlLnRlc3QodmFsdWUpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0cyBgdGhpc2AgYmluZGluZyBkYXRhIG9uIGEgZ2l2ZW4gZnVuY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHNldCBkYXRhIG9uLlxyXG4gICAgICogQHBhcmFtIHtBcnJheX0gdmFsdWUgVGhlIGRhdGEgYXJyYXkgdG8gc2V0LlxyXG4gICAgICovXHJcbiAgICB2YXIgc2V0QmluZERhdGEgPSAhZGVmaW5lUHJvcGVydHkgPyBub29wIDogZnVuY3Rpb24oZnVuYywgdmFsdWUpIHtcclxuICAgICAgZGVzY3JpcHRvci52YWx1ZSA9IHZhbHVlO1xyXG4gICAgICBkZWZpbmVQcm9wZXJ0eShmdW5jLCAnX19iaW5kRGF0YV9fJywgZGVzY3JpcHRvcik7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQSBmYWxsYmFjayBpbXBsZW1lbnRhdGlvbiBvZiBgaXNQbGFpbk9iamVjdGAgd2hpY2ggY2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWVcclxuICAgICAqIGlzIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3RvciwgYXNzdW1pbmcgb2JqZWN0cyBjcmVhdGVkXHJcbiAgICAgKiBieSB0aGUgYE9iamVjdGAgY29uc3RydWN0b3IgaGF2ZSBubyBpbmhlcml0ZWQgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIGFuZCB0aGF0XHJcbiAgICAgKiB0aGVyZSBhcmUgbm8gYE9iamVjdC5wcm90b3R5cGVgIGV4dGVuc2lvbnMuXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2hpbUlzUGxhaW5PYmplY3QodmFsdWUpIHtcclxuICAgICAgdmFyIGN0b3IsXHJcbiAgICAgICAgICByZXN1bHQ7XHJcblxyXG4gICAgICAvLyBhdm9pZCBub24gT2JqZWN0IG9iamVjdHMsIGBhcmd1bWVudHNgIG9iamVjdHMsIGFuZCBET00gZWxlbWVudHNcclxuICAgICAgaWYgKCEodmFsdWUgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gb2JqZWN0Q2xhc3MpIHx8XHJcbiAgICAgICAgICAoY3RvciA9IHZhbHVlLmNvbnN0cnVjdG9yLCBpc0Z1bmN0aW9uKGN0b3IpICYmICEoY3RvciBpbnN0YW5jZW9mIGN0b3IpKSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBJbiBtb3N0IGVudmlyb25tZW50cyBhbiBvYmplY3QncyBvd24gcHJvcGVydGllcyBhcmUgaXRlcmF0ZWQgYmVmb3JlXHJcbiAgICAgIC8vIGl0cyBpbmhlcml0ZWQgcHJvcGVydGllcy4gSWYgdGhlIGxhc3QgaXRlcmF0ZWQgcHJvcGVydHkgaXMgYW4gb2JqZWN0J3NcclxuICAgICAgLy8gb3duIHByb3BlcnR5IHRoZW4gdGhlcmUgYXJlIG5vIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMuXHJcbiAgICAgIGZvckluKHZhbHVlLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgcmVzdWx0ID0ga2V5O1xyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHR5cGVvZiByZXN1bHQgPT0gJ3VuZGVmaW5lZCcgfHwgaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwgcmVzdWx0KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFVzZWQgYnkgYHVuZXNjYXBlYCB0byBjb252ZXJ0IEhUTUwgZW50aXRpZXMgdG8gY2hhcmFjdGVycy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1hdGNoIFRoZSBtYXRjaGVkIGNoYXJhY3RlciB0byB1bmVzY2FwZS5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHVuZXNjYXBlZCBjaGFyYWN0ZXIuXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHVuZXNjYXBlSHRtbENoYXIobWF0Y2gpIHtcclxuICAgICAgcmV0dXJuIGh0bWxVbmVzY2FwZXNbbWF0Y2hdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYGFyZ3VtZW50c2Agb2JqZWN0LCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIChmdW5jdGlvbigpIHsgcmV0dXJuIF8uaXNBcmd1bWVudHMoYXJndW1lbnRzKTsgfSkoMSwgMiwgMyk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc0FyZ3VtZW50cyhbMSwgMiwgM10pO1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNBcmd1bWVudHModmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWUubGVuZ3RoID09ICdudW1iZXInICYmXHJcbiAgICAgICAgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJnc0NsYXNzIHx8IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYW4gYXJyYXkuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYW4gYXJyYXksIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy5pc0FycmF5KGFyZ3VtZW50cyk7IH0pKCk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNBcnJheShbMSwgMiwgM10pO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICB2YXIgaXNBcnJheSA9IG5hdGl2ZUlzQXJyYXkgfHwgZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0eXBlb2YgdmFsdWUubGVuZ3RoID09ICdudW1iZXInICYmXHJcbiAgICAgICAgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYXJyYXlDbGFzcyB8fCBmYWxzZTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBIGZhbGxiYWNrIGltcGxlbWVudGF0aW9uIG9mIGBPYmplY3Qua2V5c2Agd2hpY2ggcHJvZHVjZXMgYW4gYXJyYXkgb2YgdGhlXHJcbiAgICAgKiBnaXZlbiBvYmplY3QncyBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcy5cclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICogQHR5cGUgRnVuY3Rpb25cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGFuIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzLlxyXG4gICAgICovXHJcbiAgICB2YXIgc2hpbUtleXMgPSBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgdmFyIGluZGV4LCBpdGVyYWJsZSA9IG9iamVjdCwgcmVzdWx0ID0gW107XHJcbiAgICAgIGlmICghaXRlcmFibGUpIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIGlmICghKG9iamVjdFR5cGVzW3R5cGVvZiBvYmplY3RdKSkgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICBmb3IgKGluZGV4IGluIGl0ZXJhYmxlKSB7XHJcbiAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChpdGVyYWJsZSwgaW5kZXgpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGluZGV4KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHRcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSBuYW1lcyBvZiBhbiBvYmplY3QuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcy5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5rZXlzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xyXG4gICAgICogLy8gPT4gWydvbmUnLCAndHdvJywgJ3RocmVlJ10gKHByb3BlcnR5IG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkIGFjcm9zcyBlbnZpcm9ubWVudHMpXHJcbiAgICAgKi9cclxuICAgIHZhciBrZXlzID0gIW5hdGl2ZUtleXMgPyBzaGltS2V5cyA6IGZ1bmN0aW9uKG9iamVjdCkge1xyXG4gICAgICBpZiAoIWlzT2JqZWN0KG9iamVjdCkpIHtcclxuICAgICAgICByZXR1cm4gW107XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG5hdGl2ZUtleXMob2JqZWN0KTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VkIHRvIGNvbnZlcnQgY2hhcmFjdGVycyB0byBIVE1MIGVudGl0aWVzOlxyXG4gICAgICpcclxuICAgICAqIFRob3VnaCB0aGUgYD5gIGNoYXJhY3RlciBpcyBlc2NhcGVkIGZvciBzeW1tZXRyeSwgY2hhcmFjdGVycyBsaWtlIGA+YCBhbmQgYC9gXHJcbiAgICAgKiBkb24ndCByZXF1aXJlIGVzY2FwaW5nIGluIEhUTUwgYW5kIGhhdmUgbm8gc3BlY2lhbCBtZWFuaW5nIHVubGVzcyB0aGV5J3JlIHBhcnRcclxuICAgICAqIG9mIGEgdGFnIG9yIGFuIHVucXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZS5cclxuICAgICAqIGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2FtYmlndW91cy1hbXBlcnNhbmRzICh1bmRlciBcInNlbWktcmVsYXRlZCBmdW4gZmFjdFwiKVxyXG4gICAgICovXHJcbiAgICB2YXIgaHRtbEVzY2FwZXMgPSB7XHJcbiAgICAgICcmJzogJyZhbXA7JyxcclxuICAgICAgJzwnOiAnJmx0OycsXHJcbiAgICAgICc+JzogJyZndDsnLFxyXG4gICAgICAnXCInOiAnJnF1b3Q7JyxcclxuICAgICAgXCInXCI6ICcmIzM5OydcclxuICAgIH07XHJcblxyXG4gICAgLyoqIFVzZWQgdG8gY29udmVydCBIVE1MIGVudGl0aWVzIHRvIGNoYXJhY3RlcnMgKi9cclxuICAgIHZhciBodG1sVW5lc2NhcGVzID0gaW52ZXJ0KGh0bWxFc2NhcGVzKTtcclxuXHJcbiAgICAvKiogVXNlZCB0byBtYXRjaCBIVE1MIGVudGl0aWVzIGFuZCBIVE1MIGNoYXJhY3RlcnMgKi9cclxuICAgIHZhciByZUVzY2FwZWRIdG1sID0gUmVnRXhwKCcoJyArIGtleXMoaHRtbFVuZXNjYXBlcykuam9pbignfCcpICsgJyknLCAnZycpLFxyXG4gICAgICAgIHJlVW5lc2NhcGVkSHRtbCA9IFJlZ0V4cCgnWycgKyBrZXlzKGh0bWxFc2NhcGVzKS5qb2luKCcnKSArICddJywgJ2cnKTtcclxuXHJcbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFzc2lnbnMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiBzb3VyY2Ugb2JqZWN0KHMpIHRvIHRoZSBkZXN0aW5hdGlvblxyXG4gICAgICogb2JqZWN0LiBTdWJzZXF1ZW50IHNvdXJjZXMgd2lsbCBvdmVyd3JpdGUgcHJvcGVydHkgYXNzaWdubWVudHMgb2YgcHJldmlvdXNcclxuICAgICAqIHNvdXJjZXMuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCB0byBwcm9kdWNlIHRoZVxyXG4gICAgICogYXNzaWduZWQgdmFsdWVzLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdHdvXHJcbiAgICAgKiBhcmd1bWVudHM7IChvYmplY3RWYWx1ZSwgc291cmNlVmFsdWUpLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAdHlwZSBGdW5jdGlvblxyXG4gICAgICogQGFsaWFzIGV4dGVuZFxyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7Li4uT2JqZWN0fSBbc291cmNlXSBUaGUgc291cmNlIG9iamVjdHMuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgYXNzaWduaW5nIHZhbHVlcy5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmFzc2lnbih7ICduYW1lJzogJ2ZyZWQnIH0sIHsgJ2VtcGxveWVyJzogJ3NsYXRlJyB9KTtcclxuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnZnJlZCcsICdlbXBsb3llcic6ICdzbGF0ZScgfVxyXG4gICAgICpcclxuICAgICAqIHZhciBkZWZhdWx0cyA9IF8ucGFydGlhbFJpZ2h0KF8uYXNzaWduLCBmdW5jdGlvbihhLCBiKSB7XHJcbiAgICAgKiAgIHJldHVybiB0eXBlb2YgYSA9PSAndW5kZWZpbmVkJyA/IGIgOiBhO1xyXG4gICAgICogfSk7XHJcbiAgICAgKlxyXG4gICAgICogdmFyIG9iamVjdCA9IHsgJ25hbWUnOiAnYmFybmV5JyB9O1xyXG4gICAgICogZGVmYXVsdHMob2JqZWN0LCB7ICduYW1lJzogJ2ZyZWQnLCAnZW1wbG95ZXInOiAnc2xhdGUnIH0pO1xyXG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdiYXJuZXknLCAnZW1wbG95ZXInOiAnc2xhdGUnIH1cclxuICAgICAqL1xyXG4gICAgdmFyIGFzc2lnbiA9IGZ1bmN0aW9uKG9iamVjdCwgc291cmNlLCBndWFyZCkge1xyXG4gICAgICB2YXIgaW5kZXgsIGl0ZXJhYmxlID0gb2JqZWN0LCByZXN1bHQgPSBpdGVyYWJsZTtcclxuICAgICAgaWYgKCFpdGVyYWJsZSkgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXHJcbiAgICAgICAgICBhcmdzSW5kZXggPSAwLFxyXG4gICAgICAgICAgYXJnc0xlbmd0aCA9IHR5cGVvZiBndWFyZCA9PSAnbnVtYmVyJyA/IDIgOiBhcmdzLmxlbmd0aDtcclxuICAgICAgaWYgKGFyZ3NMZW5ndGggPiAzICYmIHR5cGVvZiBhcmdzW2FyZ3NMZW5ndGggLSAyXSA9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gYmFzZUNyZWF0ZUNhbGxiYWNrKGFyZ3NbLS1hcmdzTGVuZ3RoIC0gMV0sIGFyZ3NbYXJnc0xlbmd0aC0tXSwgMik7XHJcbiAgICAgIH0gZWxzZSBpZiAoYXJnc0xlbmd0aCA+IDIgJiYgdHlwZW9mIGFyZ3NbYXJnc0xlbmd0aCAtIDFdID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbLS1hcmdzTGVuZ3RoXTtcclxuICAgICAgfVxyXG4gICAgICB3aGlsZSAoKythcmdzSW5kZXggPCBhcmdzTGVuZ3RoKSB7XHJcbiAgICAgICAgaXRlcmFibGUgPSBhcmdzW2FyZ3NJbmRleF07XHJcbiAgICAgICAgaWYgKGl0ZXJhYmxlICYmIG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHtcclxuICAgICAgICB2YXIgb3duSW5kZXggPSAtMSxcclxuICAgICAgICAgICAgb3duUHJvcHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmFibGVdICYmIGtleXMoaXRlcmFibGUpLFxyXG4gICAgICAgICAgICBsZW5ndGggPSBvd25Qcm9wcyA/IG93blByb3BzLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICAgIHdoaWxlICgrK293bkluZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcclxuICAgICAgICAgIHJlc3VsdFtpbmRleF0gPSBjYWxsYmFjayA/IGNhbGxiYWNrKHJlc3VsdFtpbmRleF0sIGl0ZXJhYmxlW2luZGV4XSkgOiBpdGVyYWJsZVtpbmRleF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGNsb25lIG9mIGB2YWx1ZWAuIElmIGBpc0RlZXBgIGlzIGB0cnVlYCBuZXN0ZWQgb2JqZWN0cyB3aWxsIGFsc29cclxuICAgICAqIGJlIGNsb25lZCwgb3RoZXJ3aXNlIHRoZXkgd2lsbCBiZSBhc3NpZ25lZCBieSByZWZlcmVuY2UuIElmIGEgY2FsbGJhY2tcclxuICAgICAqIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWQgdG8gcHJvZHVjZSB0aGUgY2xvbmVkIHZhbHVlcy4gSWYgdGhlXHJcbiAgICAgKiBjYWxsYmFjayByZXR1cm5zIGB1bmRlZmluZWRgIGNsb25pbmcgd2lsbCBiZSBoYW5kbGVkIGJ5IHRoZSBtZXRob2QgaW5zdGVhZC5cclxuICAgICAqIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCBvbmUgYXJndW1lbnQ7ICh2YWx1ZSkuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjbG9uZS5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lzRGVlcD1mYWxzZV0gU3BlY2lmeSBhIGRlZXAgY2xvbmUuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgY2xvbmluZyB2YWx1ZXMuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIHRoZSBjbG9uZWQgdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIHZhciBzaGFsbG93ID0gXy5jbG9uZShjaGFyYWN0ZXJzKTtcclxuICAgICAqIHNoYWxsb3dbMF0gPT09IGNoYXJhY3RlcnNbMF07XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGRlZXAgPSBfLmNsb25lKGNoYXJhY3RlcnMsIHRydWUpO1xyXG4gICAgICogZGVlcFswXSA9PT0gY2hhcmFjdGVyc1swXTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKlxyXG4gICAgICogXy5taXhpbih7XHJcbiAgICAgKiAgICdjbG9uZSc6IF8ucGFydGlhbFJpZ2h0KF8uY2xvbmUsIGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgKiAgICAgcmV0dXJuIF8uaXNFbGVtZW50KHZhbHVlKSA/IHZhbHVlLmNsb25lTm9kZShmYWxzZSkgOiB1bmRlZmluZWQ7XHJcbiAgICAgKiAgIH0pXHJcbiAgICAgKiB9KTtcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2xvbmUgPSBfLmNsb25lKGRvY3VtZW50LmJvZHkpO1xyXG4gICAgICogY2xvbmUuY2hpbGROb2Rlcy5sZW5ndGg7XHJcbiAgICAgKiAvLyA9PiAwXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNsb25lKHZhbHVlLCBpc0RlZXAsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIC8vIGFsbG93cyB3b3JraW5nIHdpdGggXCJDb2xsZWN0aW9uc1wiIG1ldGhvZHMgd2l0aG91dCB1c2luZyB0aGVpciBgaW5kZXhgXHJcbiAgICAgIC8vIGFuZCBgY29sbGVjdGlvbmAgYXJndW1lbnRzIGZvciBgaXNEZWVwYCBhbmQgYGNhbGxiYWNrYFxyXG4gICAgICBpZiAodHlwZW9mIGlzRGVlcCAhPSAnYm9vbGVhbicgJiYgaXNEZWVwICE9IG51bGwpIHtcclxuICAgICAgICB0aGlzQXJnID0gY2FsbGJhY2s7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBpc0RlZXA7XHJcbiAgICAgICAgaXNEZWVwID0gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJhc2VDbG9uZSh2YWx1ZSwgaXNEZWVwLCB0eXBlb2YgY2FsbGJhY2sgPT0gJ2Z1bmN0aW9uJyAmJiBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDEpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBkZWVwIGNsb25lIG9mIGB2YWx1ZWAuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZVxyXG4gICAgICogZXhlY3V0ZWQgdG8gcHJvZHVjZSB0aGUgY2xvbmVkIHZhbHVlcy4gSWYgdGhlIGNhbGxiYWNrIHJldHVybnMgYHVuZGVmaW5lZGBcclxuICAgICAqIGNsb25pbmcgd2lsbCBiZSBoYW5kbGVkIGJ5IHRoZSBtZXRob2QgaW5zdGVhZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvXHJcbiAgICAgKiBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCBvbmUgYXJndW1lbnQ7ICh2YWx1ZSkuXHJcbiAgICAgKlxyXG4gICAgICogTm90ZTogVGhpcyBtZXRob2QgaXMgbG9vc2VseSBiYXNlZCBvbiB0aGUgc3RydWN0dXJlZCBjbG9uZSBhbGdvcml0aG0uIEZ1bmN0aW9uc1xyXG4gICAgICogYW5kIERPTSBub2RlcyBhcmUgKipub3QqKiBjbG9uZWQuIFRoZSBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgYGFyZ3VtZW50c2Agb2JqZWN0cyBhbmRcclxuICAgICAqIG9iamVjdHMgY3JlYXRlZCBieSBjb25zdHJ1Y3RvcnMgb3RoZXIgdGhhbiBgT2JqZWN0YCBhcmUgY2xvbmVkIHRvIHBsYWluIGBPYmplY3RgIG9iamVjdHMuXHJcbiAgICAgKiBTZWUgaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNpbnRlcm5hbC1zdHJ1Y3R1cmVkLWNsb25pbmctYWxnb3JpdGhtLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gZGVlcCBjbG9uZS5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBjbG9uaW5nIHZhbHVlcy5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGRlZXAgY2xvbmVkIHZhbHVlLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiB2YXIgZGVlcCA9IF8uY2xvbmVEZWVwKGNoYXJhY3RlcnMpO1xyXG4gICAgICogZGVlcFswXSA9PT0gY2hhcmFjdGVyc1swXTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIHZpZXcgPSB7XHJcbiAgICAgKiAgICdsYWJlbCc6ICdkb2NzJyxcclxuICAgICAqICAgJ25vZGUnOiBlbGVtZW50XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIHZhciBjbG9uZSA9IF8uY2xvbmVEZWVwKHZpZXcsIGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgKiAgIHJldHVybiBfLmlzRWxlbWVudCh2YWx1ZSkgPyB2YWx1ZS5jbG9uZU5vZGUodHJ1ZSkgOiB1bmRlZmluZWQ7XHJcbiAgICAgKiB9KTtcclxuICAgICAqXHJcbiAgICAgKiBjbG9uZS5ub2RlID09IHZpZXcubm9kZTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNsb25lRGVlcCh2YWx1ZSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgcmV0dXJuIGJhc2VDbG9uZSh2YWx1ZSwgdHJ1ZSwgdHlwZW9mIGNhbGxiYWNrID09ICdmdW5jdGlvbicgJiYgYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAxKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCB0aGF0IGluaGVyaXRzIGZyb20gdGhlIGdpdmVuIGBwcm90b3R5cGVgIG9iamVjdC4gSWYgYVxyXG4gICAgICogYHByb3BlcnRpZXNgIG9iamVjdCBpcyBwcm92aWRlZCBpdHMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBhcmUgYXNzaWduZWRcclxuICAgICAqIHRvIHRoZSBjcmVhdGVkIG9iamVjdC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm90b3R5cGUgVGhlIG9iamVjdCB0byBpbmhlcml0IGZyb20uXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW3Byb3BlcnRpZXNdIFRoZSBwcm9wZXJ0aWVzIHRvIGFzc2lnbiB0byB0aGUgb2JqZWN0LlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgbmV3IG9iamVjdC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogZnVuY3Rpb24gU2hhcGUoKSB7XHJcbiAgICAgKiAgIHRoaXMueCA9IDA7XHJcbiAgICAgKiAgIHRoaXMueSA9IDA7XHJcbiAgICAgKiB9XHJcbiAgICAgKlxyXG4gICAgICogZnVuY3Rpb24gQ2lyY2xlKCkge1xyXG4gICAgICogICBTaGFwZS5jYWxsKHRoaXMpO1xyXG4gICAgICogfVxyXG4gICAgICpcclxuICAgICAqIENpcmNsZS5wcm90b3R5cGUgPSBfLmNyZWF0ZShTaGFwZS5wcm90b3R5cGUsIHsgJ2NvbnN0cnVjdG9yJzogQ2lyY2xlIH0pO1xyXG4gICAgICpcclxuICAgICAqIHZhciBjaXJjbGUgPSBuZXcgQ2lyY2xlO1xyXG4gICAgICogY2lyY2xlIGluc3RhbmNlb2YgQ2lyY2xlO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICpcclxuICAgICAqIGNpcmNsZSBpbnN0YW5jZW9mIFNoYXBlO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBjcmVhdGUocHJvdG90eXBlLCBwcm9wZXJ0aWVzKSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBiYXNlQ3JlYXRlKHByb3RvdHlwZSk7XHJcbiAgICAgIHJldHVybiBwcm9wZXJ0aWVzID8gYXNzaWduKHJlc3VsdCwgcHJvcGVydGllcykgOiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBc3NpZ25zIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2Ygc291cmNlIG9iamVjdChzKSB0byB0aGUgZGVzdGluYXRpb25cclxuICAgICAqIG9iamVjdCBmb3IgYWxsIGRlc3RpbmF0aW9uIHByb3BlcnRpZXMgdGhhdCByZXNvbHZlIHRvIGB1bmRlZmluZWRgLiBPbmNlIGFcclxuICAgICAqIHByb3BlcnR5IGlzIHNldCwgYWRkaXRpb25hbCBkZWZhdWx0cyBvZiB0aGUgc2FtZSBwcm9wZXJ0eSB3aWxsIGJlIGlnbm9yZWQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxyXG4gICAgICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VdIFRoZSBzb3VyY2Ugb2JqZWN0cy5cclxuICAgICAqIEBwYXJhbS0ge09iamVjdH0gW2d1YXJkXSBBbGxvd3Mgd29ya2luZyB3aXRoIGBfLnJlZHVjZWAgd2l0aG91dCB1c2luZyBpdHNcclxuICAgICAqICBga2V5YCBhbmQgYG9iamVjdGAgYXJndW1lbnRzIGFzIHNvdXJjZXMuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2Jhcm5leScgfTtcclxuICAgICAqIF8uZGVmYXVsdHMob2JqZWN0LCB7ICduYW1lJzogJ2ZyZWQnLCAnZW1wbG95ZXInOiAnc2xhdGUnIH0pO1xyXG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdiYXJuZXknLCAnZW1wbG95ZXInOiAnc2xhdGUnIH1cclxuICAgICAqL1xyXG4gICAgdmFyIGRlZmF1bHRzID0gZnVuY3Rpb24ob2JqZWN0LCBzb3VyY2UsIGd1YXJkKSB7XHJcbiAgICAgIHZhciBpbmRleCwgaXRlcmFibGUgPSBvYmplY3QsIHJlc3VsdCA9IGl0ZXJhYmxlO1xyXG4gICAgICBpZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xyXG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcclxuICAgICAgICAgIGFyZ3NJbmRleCA9IDAsXHJcbiAgICAgICAgICBhcmdzTGVuZ3RoID0gdHlwZW9mIGd1YXJkID09ICdudW1iZXInID8gMiA6IGFyZ3MubGVuZ3RoO1xyXG4gICAgICB3aGlsZSAoKythcmdzSW5kZXggPCBhcmdzTGVuZ3RoKSB7XHJcbiAgICAgICAgaXRlcmFibGUgPSBhcmdzW2FyZ3NJbmRleF07XHJcbiAgICAgICAgaWYgKGl0ZXJhYmxlICYmIG9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHtcclxuICAgICAgICB2YXIgb3duSW5kZXggPSAtMSxcclxuICAgICAgICAgICAgb3duUHJvcHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmFibGVdICYmIGtleXMoaXRlcmFibGUpLFxyXG4gICAgICAgICAgICBsZW5ndGggPSBvd25Qcm9wcyA/IG93blByb3BzLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICAgIHdoaWxlICgrK293bkluZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcclxuICAgICAgICAgIGlmICh0eXBlb2YgcmVzdWx0W2luZGV4XSA9PSAndW5kZWZpbmVkJykgcmVzdWx0W2luZGV4XSA9IGl0ZXJhYmxlW2luZGV4XTtcclxuICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHRcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRJbmRleGAgZXhjZXB0IHRoYXQgaXQgcmV0dXJucyB0aGUga2V5IG9mIHRoZVxyXG4gICAgICogZmlyc3QgZWxlbWVudCB0aGF0IHBhc3NlcyB0aGUgY2FsbGJhY2sgY2hlY2ssIGluc3RlYWQgb2YgdGhlIGVsZW1lbnQgaXRzZWxmLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBzZWFyY2guXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcclxuICAgICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvXHJcbiAgICAgKiAgY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ3x1bmRlZmluZWR9IFJldHVybnMgdGhlIGtleSBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgdW5kZWZpbmVkYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSB7XHJcbiAgICAgKiAgICdiYXJuZXknOiB7ICAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfSxcclxuICAgICAqICAgJ2ZyZWQnOiB7ICAgICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH0sXHJcbiAgICAgKiAgICdwZWJibGVzJzogeyAnYWdlJzogMSwgICdibG9ja2VkJzogZmFsc2UgfVxyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiBfLmZpbmRLZXkoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7XHJcbiAgICAgKiAgIHJldHVybiBjaHIuYWdlIDwgNDA7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+ICdiYXJuZXknIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5maW5kS2V5KGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDEgfSk7XHJcbiAgICAgKiAvLyA9PiAncGViYmxlcydcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uZmluZEtleShjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpO1xyXG4gICAgICogLy8gPT4gJ2ZyZWQnXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGZpbmRLZXkob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIGZvck93bihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xyXG4gICAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwga2V5LCBvYmplY3QpKSB7XHJcbiAgICAgICAgICByZXN1bHQgPSBrZXk7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uZmluZEtleWAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xyXG4gICAgICogb2YgYSBgY29sbGVjdGlvbmAgaW4gdGhlIG9wcG9zaXRlIG9yZGVyLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBzZWFyY2guXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXJcclxuICAgICAqICBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvXHJcbiAgICAgKiAgY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ3x1bmRlZmluZWR9IFJldHVybnMgdGhlIGtleSBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgdW5kZWZpbmVkYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSB7XHJcbiAgICAgKiAgICdiYXJuZXknOiB7ICAnYWdlJzogMzYsICdibG9ja2VkJzogdHJ1ZSB9LFxyXG4gICAgICogICAnZnJlZCc6IHsgICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IGZhbHNlIH0sXHJcbiAgICAgKiAgICdwZWJibGVzJzogeyAnYWdlJzogMSwgICdibG9ja2VkJzogdHJ1ZSB9XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIF8uZmluZExhc3RLZXkoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7XHJcbiAgICAgKiAgIHJldHVybiBjaHIuYWdlIDwgNDA7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IHJldHVybnMgYHBlYmJsZXNgLCBhc3N1bWluZyBgXy5maW5kS2V5YCByZXR1cm5zIGBiYXJuZXlgXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmRMYXN0S2V5KGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDQwIH0pO1xyXG4gICAgICogLy8gPT4gJ2ZyZWQnXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmRMYXN0S2V5KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiAncGViYmxlcydcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZmluZExhc3RLZXkob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIGZvck93blJpZ2h0KG9iamVjdCwgZnVuY3Rpb24odmFsdWUsIGtleSwgb2JqZWN0KSB7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdCkpIHtcclxuICAgICAgICAgIHJlc3VsdCA9IGtleTtcclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogSXRlcmF0ZXMgb3ZlciBvd24gYW5kIGluaGVyaXRlZCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb2YgYW4gb2JqZWN0LFxyXG4gICAgICogZXhlY3V0aW5nIHRoZSBjYWxsYmFjayBmb3IgZWFjaCBwcm9wZXJ0eS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxyXG4gICAgICogYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwga2V5LCBvYmplY3QpLiBDYWxsYmFja3MgbWF5IGV4aXRcclxuICAgICAqIGl0ZXJhdGlvbiBlYXJseSBieSBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAdHlwZSBGdW5jdGlvblxyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogZnVuY3Rpb24gU2hhcGUoKSB7XHJcbiAgICAgKiAgIHRoaXMueCA9IDA7XHJcbiAgICAgKiAgIHRoaXMueSA9IDA7XHJcbiAgICAgKiB9XHJcbiAgICAgKlxyXG4gICAgICogU2hhcGUucHJvdG90eXBlLm1vdmUgPSBmdW5jdGlvbih4LCB5KSB7XHJcbiAgICAgKiAgIHRoaXMueCArPSB4O1xyXG4gICAgICogICB0aGlzLnkgKz0geTtcclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogXy5mb3JJbihuZXcgU2hhcGUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcclxuICAgICAqICAgY29uc29sZS5sb2coa2V5KTtcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gbG9ncyAneCcsICd5JywgYW5kICdtb3ZlJyAocHJvcGVydHkgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQgYWNyb3NzIGVudmlyb25tZW50cylcclxuICAgICAqL1xyXG4gICAgdmFyIGZvckluID0gZnVuY3Rpb24oY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGluZGV4LCBpdGVyYWJsZSA9IGNvbGxlY3Rpb24sIHJlc3VsdCA9IGl0ZXJhYmxlO1xyXG4gICAgICBpZiAoIWl0ZXJhYmxlKSByZXR1cm4gcmVzdWx0O1xyXG4gICAgICBpZiAoIW9iamVjdFR5cGVzW3R5cGVvZiBpdGVyYWJsZV0pIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIGNhbGxiYWNrID0gY2FsbGJhY2sgJiYgdHlwZW9mIHRoaXNBcmcgPT0gJ3VuZGVmaW5lZCcgPyBjYWxsYmFjayA6IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgICAgZm9yIChpbmRleCBpbiBpdGVyYWJsZSkge1xyXG4gICAgICAgICAgaWYgKGNhbGxiYWNrKGl0ZXJhYmxlW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pID09PSBmYWxzZSkgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHRcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZvckluYCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIGVsZW1lbnRzXHJcbiAgICAgKiBvZiBhIGBjb2xsZWN0aW9uYCBpbiB0aGUgb3Bwb3NpdGUgb3JkZXIuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaXRlcmF0ZSBvdmVyLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIGZ1bmN0aW9uIFNoYXBlKCkge1xyXG4gICAgICogICB0aGlzLnggPSAwO1xyXG4gICAgICogICB0aGlzLnkgPSAwO1xyXG4gICAgICogfVxyXG4gICAgICpcclxuICAgICAqIFNoYXBlLnByb3RvdHlwZS5tb3ZlID0gZnVuY3Rpb24oeCwgeSkge1xyXG4gICAgICogICB0aGlzLnggKz0geDtcclxuICAgICAqICAgdGhpcy55ICs9IHk7XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIF8uZm9ySW5SaWdodChuZXcgU2hhcGUsIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcclxuICAgICAqICAgY29uc29sZS5sb2coa2V5KTtcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gbG9ncyAnbW92ZScsICd5JywgYW5kICd4JyBhc3N1bWluZyBgXy5mb3JJbiBgIGxvZ3MgJ3gnLCAneScsIGFuZCAnbW92ZSdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZm9ySW5SaWdodChvYmplY3QsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciBwYWlycyA9IFtdO1xyXG5cclxuICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgcGFpcnMucHVzaChrZXksIHZhbHVlKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICB2YXIgbGVuZ3RoID0gcGFpcnMubGVuZ3RoO1xyXG4gICAgICBjYWxsYmFjayA9IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgIGlmIChjYWxsYmFjayhwYWlyc1tsZW5ndGgtLV0sIHBhaXJzW2xlbmd0aF0sIG9iamVjdCkgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG9iamVjdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEl0ZXJhdGVzIG92ZXIgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiBhbiBvYmplY3QsIGV4ZWN1dGluZyB0aGUgY2FsbGJhY2tcclxuICAgICAqIGZvciBlYWNoIHByb3BlcnR5LiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcclxuICAgICAqIGFyZ3VtZW50czsgKHZhbHVlLCBrZXksIG9iamVjdCkuIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHkgYnlcclxuICAgICAqIGV4cGxpY2l0bHkgcmV0dXJuaW5nIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGBvYmplY3RgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmZvck93bih7ICcwJzogJ3plcm8nLCAnMSc6ICdvbmUnLCAnbGVuZ3RoJzogMiB9LCBmdW5jdGlvbihudW0sIGtleSkge1xyXG4gICAgICogICBjb25zb2xlLmxvZyhrZXkpO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiBsb2dzICcwJywgJzEnLCBhbmQgJ2xlbmd0aCcgKHByb3BlcnR5IG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkIGFjcm9zcyBlbnZpcm9ubWVudHMpXHJcbiAgICAgKi9cclxuICAgIHZhciBmb3JPd24gPSBmdW5jdGlvbihjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgaW5kZXgsIGl0ZXJhYmxlID0gY29sbGVjdGlvbiwgcmVzdWx0ID0gaXRlcmFibGU7XHJcbiAgICAgIGlmICghaXRlcmFibGUpIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIGlmICghb2JqZWN0VHlwZXNbdHlwZW9mIGl0ZXJhYmxlXSkgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayAmJiB0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyA/IGNhbGxiYWNrIDogYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgICB2YXIgb3duSW5kZXggPSAtMSxcclxuICAgICAgICAgICAgb3duUHJvcHMgPSBvYmplY3RUeXBlc1t0eXBlb2YgaXRlcmFibGVdICYmIGtleXMoaXRlcmFibGUpLFxyXG4gICAgICAgICAgICBsZW5ndGggPSBvd25Qcm9wcyA/IG93blByb3BzLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICAgIHdoaWxlICgrK293bkluZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICBpbmRleCA9IG93blByb3BzW293bkluZGV4XTtcclxuICAgICAgICAgIGlmIChjYWxsYmFjayhpdGVyYWJsZVtpbmRleF0sIGluZGV4LCBjb2xsZWN0aW9uKSA9PT0gZmFsc2UpIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5mb3JPd25gIGV4Y2VwdCB0aGF0IGl0IGl0ZXJhdGVzIG92ZXIgZWxlbWVudHNcclxuICAgICAqIG9mIGEgYGNvbGxlY3Rpb25gIGluIHRoZSBvcHBvc2l0ZSBvcmRlci5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBgb2JqZWN0YC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5mb3JPd25SaWdodCh7ICcwJzogJ3plcm8nLCAnMSc6ICdvbmUnLCAnbGVuZ3RoJzogMiB9LCBmdW5jdGlvbihudW0sIGtleSkge1xyXG4gICAgICogICBjb25zb2xlLmxvZyhrZXkpO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiBsb2dzICdsZW5ndGgnLCAnMScsIGFuZCAnMCcgYXNzdW1pbmcgYF8uZm9yT3duYCBsb2dzICcwJywgJzEnLCBhbmQgJ2xlbmd0aCdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZm9yT3duUmlnaHQob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcHJvcHMgPSBrZXlzKG9iamVjdCksXHJcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGg7XHJcblxyXG4gICAgICBjYWxsYmFjayA9IGJhc2VDcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgIHZhciBrZXkgPSBwcm9wc1tsZW5ndGhdO1xyXG4gICAgICAgIGlmIChjYWxsYmFjayhvYmplY3Rba2V5XSwga2V5LCBvYmplY3QpID09PSBmYWxzZSkge1xyXG4gICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc29ydGVkIGFycmF5IG9mIHByb3BlcnR5IG5hbWVzIG9mIGFsbCBlbnVtZXJhYmxlIHByb3BlcnRpZXMsXHJcbiAgICAgKiBvd24gYW5kIGluaGVyaXRlZCwgb2YgYG9iamVjdGAgdGhhdCBoYXZlIGZ1bmN0aW9uIHZhbHVlcy5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIG1ldGhvZHNcclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSBuYW1lcyB0aGF0IGhhdmUgZnVuY3Rpb24gdmFsdWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmZ1bmN0aW9ucyhfKTtcclxuICAgICAqIC8vID0+IFsnYWxsJywgJ2FueScsICdiaW5kJywgJ2JpbmRBbGwnLCAnY2xvbmUnLCAnY29tcGFjdCcsICdjb21wb3NlJywgLi4uXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBmdW5jdGlvbnMob2JqZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XHJcbiAgICAgICAgICByZXN1bHQucHVzaChrZXkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiByZXN1bHQuc29ydCgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIHRoZSBzcGVjaWZpZWQgcHJvcGVydHkgbmFtZSBleGlzdHMgYXMgYSBkaXJlY3QgcHJvcGVydHkgb2YgYG9iamVjdGAsXHJcbiAgICAgKiBpbnN0ZWFkIG9mIGFuIGluaGVyaXRlZCBwcm9wZXJ0eS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpbnNwZWN0LlxyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGtleSBUaGUgbmFtZSBvZiB0aGUgcHJvcGVydHkgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYga2V5IGlzIGEgZGlyZWN0IHByb3BlcnR5LCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaGFzKHsgJ2EnOiAxLCAnYic6IDIsICdjJzogMyB9LCAnYicpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBoYXMob2JqZWN0LCBrZXkpIHtcclxuICAgICAgcmV0dXJuIG9iamVjdCA/IGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpIDogZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiB0aGUgaW52ZXJ0ZWQga2V5cyBhbmQgdmFsdWVzIG9mIHRoZSBnaXZlbiBvYmplY3QuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW52ZXJ0LlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY3JlYXRlZCBpbnZlcnRlZCBvYmplY3QuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaW52ZXJ0KHsgJ2ZpcnN0JzogJ2ZyZWQnLCAnc2Vjb25kJzogJ2Jhcm5leScgfSk7XHJcbiAgICAgKiAvLyA9PiB7ICdmcmVkJzogJ2ZpcnN0JywgJ2Jhcm5leSc6ICdzZWNvbmQnIH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaW52ZXJ0KG9iamVjdCkge1xyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIHByb3BzID0ga2V5cyhvYmplY3QpLFxyXG4gICAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxyXG4gICAgICAgICAgcmVzdWx0ID0ge307XHJcblxyXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgIHZhciBrZXkgPSBwcm9wc1tpbmRleF07XHJcbiAgICAgICAgcmVzdWx0W29iamVjdFtrZXldXSA9IGtleTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBib29sZWFuIHZhbHVlLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBib29sZWFuIHZhbHVlLCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNCb29sZWFuKG51bGwpO1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZSA9PT0gdHJ1ZSB8fCB2YWx1ZSA9PT0gZmFsc2UgfHxcclxuICAgICAgICB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gYm9vbENsYXNzIHx8IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBkYXRlLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBkYXRlLCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNEYXRlKG5ldyBEYXRlKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNEYXRlKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gZGF0ZUNsYXNzIHx8IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBET00gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgRE9NIGVsZW1lbnQsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc0VsZW1lbnQoZG9jdW1lbnQuYm9keSk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGlzRWxlbWVudCh2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gdmFsdWUgJiYgdmFsdWUubm9kZVR5cGUgPT09IDEgfHwgZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBlbXB0eS4gQXJyYXlzLCBzdHJpbmdzLCBvciBgYXJndW1lbnRzYCBvYmplY3RzIHdpdGggYVxyXG4gICAgICogbGVuZ3RoIG9mIGAwYCBhbmQgb2JqZWN0cyB3aXRoIG5vIG93biBlbnVtZXJhYmxlIHByb3BlcnRpZXMgYXJlIGNvbnNpZGVyZWRcclxuICAgICAqIFwiZW1wdHlcIi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gdmFsdWUgVGhlIHZhbHVlIHRvIGluc3BlY3QuXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgZW1wdHksIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc0VtcHR5KFsxLCAyLCAzXSk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNFbXB0eSh7fSk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc0VtcHR5KCcnKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgaWYgKCF2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGNsYXNzTmFtZSA9IHRvU3RyaW5nLmNhbGwodmFsdWUpLFxyXG4gICAgICAgICAgbGVuZ3RoID0gdmFsdWUubGVuZ3RoO1xyXG5cclxuICAgICAgaWYgKChjbGFzc05hbWUgPT0gYXJyYXlDbGFzcyB8fCBjbGFzc05hbWUgPT0gc3RyaW5nQ2xhc3MgfHwgY2xhc3NOYW1lID09IGFyZ3NDbGFzcyApIHx8XHJcbiAgICAgICAgICAoY2xhc3NOYW1lID09IG9iamVjdENsYXNzICYmIHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgJiYgaXNGdW5jdGlvbih2YWx1ZS5zcGxpY2UpKSkge1xyXG4gICAgICAgIHJldHVybiAhbGVuZ3RoO1xyXG4gICAgICB9XHJcbiAgICAgIGZvck93bih2YWx1ZSwgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIChyZXN1bHQgPSBmYWxzZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUGVyZm9ybXMgYSBkZWVwIGNvbXBhcmlzb24gYmV0d2VlbiB0d28gdmFsdWVzIHRvIGRldGVybWluZSBpZiB0aGV5IGFyZVxyXG4gICAgICogZXF1aXZhbGVudCB0byBlYWNoIG90aGVyLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWRcclxuICAgICAqIHRvIGNvbXBhcmUgdmFsdWVzLiBJZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBgdW5kZWZpbmVkYCBjb21wYXJpc29ucyB3aWxsXHJcbiAgICAgKiBiZSBoYW5kbGVkIGJ5IHRoZSBtZXRob2QgaW5zdGVhZC4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmRcclxuICAgICAqIGludm9rZWQgd2l0aCB0d28gYXJndW1lbnRzOyAoYSwgYikuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IGEgVGhlIHZhbHVlIHRvIGNvbXBhcmUuXHJcbiAgICAgKiBAcGFyYW0geyp9IGIgVGhlIG90aGVyIHZhbHVlIHRvIGNvbXBhcmUuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIFRoZSBmdW5jdGlvbiB0byBjdXN0b21pemUgY29tcGFyaW5nIHZhbHVlcy5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZXMgYXJlIGVxdWl2YWxlbnQsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIG9iamVjdCA9IHsgJ25hbWUnOiAnZnJlZCcgfTtcclxuICAgICAqIHZhciBjb3B5ID0geyAnbmFtZSc6ICdmcmVkJyB9O1xyXG4gICAgICpcclxuICAgICAqIG9iamVjdCA9PSBjb3B5O1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqXHJcbiAgICAgKiBfLmlzRXF1YWwob2JqZWN0LCBjb3B5KTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgd29yZHMgPSBbJ2hlbGxvJywgJ2dvb2RieWUnXTtcclxuICAgICAqIHZhciBvdGhlcldvcmRzID0gWydoaScsICdnb29kYnllJ107XHJcbiAgICAgKlxyXG4gICAgICogXy5pc0VxdWFsKHdvcmRzLCBvdGhlcldvcmRzLCBmdW5jdGlvbihhLCBiKSB7XHJcbiAgICAgKiAgIHZhciByZUdyZWV0ID0gL14oPzpoZWxsb3xoaSkkL2ksXHJcbiAgICAgKiAgICAgICBhR3JlZXQgPSBfLmlzU3RyaW5nKGEpICYmIHJlR3JlZXQudGVzdChhKSxcclxuICAgICAqICAgICAgIGJHcmVldCA9IF8uaXNTdHJpbmcoYikgJiYgcmVHcmVldC50ZXN0KGIpO1xyXG4gICAgICpcclxuICAgICAqICAgcmV0dXJuIChhR3JlZXQgfHwgYkdyZWV0KSA/IChhR3JlZXQgPT0gYkdyZWV0KSA6IHVuZGVmaW5lZDtcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBpc0VxdWFsKGEsIGIsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHJldHVybiBiYXNlSXNFcXVhbChhLCBiLCB0eXBlb2YgY2FsbGJhY2sgPT0gJ2Z1bmN0aW9uJyAmJiBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDIpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzLCBvciBjYW4gYmUgY29lcmNlZCB0bywgYSBmaW5pdGUgbnVtYmVyLlxyXG4gICAgICpcclxuICAgICAqIE5vdGU6IFRoaXMgaXMgbm90IHRoZSBzYW1lIGFzIG5hdGl2ZSBgaXNGaW5pdGVgIHdoaWNoIHdpbGwgcmV0dXJuIHRydWUgZm9yXHJcbiAgICAgKiBib29sZWFucyBhbmQgZW1wdHkgc3RyaW5ncy4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMS4yLjUuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBmaW5pdGUsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc0Zpbml0ZSgtMTAxKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiBfLmlzRmluaXRlKCcxMCcpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNGaW5pdGUodHJ1ZSk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNGaW5pdGUoJycpO1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqXHJcbiAgICAgKiBfLmlzRmluaXRlKEluZmluaXR5KTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGlzRmluaXRlKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiBuYXRpdmVJc0Zpbml0ZSh2YWx1ZSkgJiYgIW5hdGl2ZUlzTmFOKHBhcnNlRmxvYXQodmFsdWUpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGEgZnVuY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIGZ1bmN0aW9uLCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNGdW5jdGlvbihfKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNGdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdmdW5jdGlvbic7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyB0aGUgbGFuZ3VhZ2UgdHlwZSBvZiBPYmplY3QuXHJcbiAgICAgKiAoZS5nLiBhcnJheXMsIGZ1bmN0aW9ucywgb2JqZWN0cywgcmVnZXhlcywgYG5ldyBOdW1iZXIoMClgLCBhbmQgYG5ldyBTdHJpbmcoJycpYClcclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGFuIG9iamVjdCwgZWxzZSBgZmFsc2VgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmlzT2JqZWN0KHt9KTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiBfLmlzT2JqZWN0KFsxLCAyLCAzXSk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc09iamVjdCgxKTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XHJcbiAgICAgIC8vIGNoZWNrIGlmIHRoZSB2YWx1ZSBpcyB0aGUgRUNNQVNjcmlwdCBsYW5ndWFnZSB0eXBlIG9mIE9iamVjdFxyXG4gICAgICAvLyBodHRwOi8vZXM1LmdpdGh1Yi5pby8jeDhcclxuICAgICAgLy8gYW5kIGF2b2lkIGEgVjggYnVnXHJcbiAgICAgIC8vIGh0dHA6Ly9jb2RlLmdvb2dsZS5jb20vcC92OC9pc3N1ZXMvZGV0YWlsP2lkPTIyOTFcclxuICAgICAgcmV0dXJuICEhKHZhbHVlICYmIG9iamVjdFR5cGVzW3R5cGVvZiB2YWx1ZV0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYE5hTmAuXHJcbiAgICAgKlxyXG4gICAgICogTm90ZTogVGhpcyBpcyBub3QgdGhlIHNhbWUgYXMgbmF0aXZlIGBpc05hTmAgd2hpY2ggd2lsbCByZXR1cm4gYHRydWVgIGZvclxyXG4gICAgICogYHVuZGVmaW5lZGAgYW5kIG90aGVyIG5vbi1udW1lcmljIHZhbHVlcy4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4MTUuMS4yLjQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBgTmFOYCwgZWxzZSBgZmFsc2VgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmlzTmFOKE5hTik7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc05hTihuZXcgTnVtYmVyKE5hTikpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICpcclxuICAgICAqIGlzTmFOKHVuZGVmaW5lZCk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc05hTih1bmRlZmluZWQpO1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNOYU4odmFsdWUpIHtcclxuICAgICAgLy8gYE5hTmAgYXMgYSBwcmltaXRpdmUgaXMgdGhlIG9ubHkgdmFsdWUgdGhhdCBpcyBub3QgZXF1YWwgdG8gaXRzZWxmXHJcbiAgICAgIC8vIChwZXJmb3JtIHRoZSBbW0NsYXNzXV0gY2hlY2sgZmlyc3QgdG8gYXZvaWQgZXJyb3JzIHdpdGggc29tZSBob3N0IG9iamVjdHMgaW4gSUUpXHJcbiAgICAgIHJldHVybiBpc051bWJlcih2YWx1ZSkgJiYgdmFsdWUgIT0gK3ZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYG51bGxgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYG51bGxgLCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNOdWxsKG51bGwpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNOdWxsKHVuZGVmaW5lZCk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBpc051bGwodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHZhbHVlID09PSBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSBudW1iZXIuXHJcbiAgICAgKlxyXG4gICAgICogTm90ZTogYE5hTmAgaXMgY29uc2lkZXJlZCBhIG51bWJlci4gU2VlIGh0dHA6Ly9lczUuZ2l0aHViLmlvLyN4OC41LlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYSBudW1iZXIsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc051bWJlcig4LjQgKiA1KTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNOdW1iZXIodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnbnVtYmVyJyB8fFxyXG4gICAgICAgIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBudW1iZXJDbGFzcyB8fCBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGFuIG9iamVjdCBjcmVhdGVkIGJ5IHRoZSBgT2JqZWN0YCBjb25zdHJ1Y3Rvci5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGB2YWx1ZWAgaXMgYSBwbGFpbiBvYmplY3QsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogZnVuY3Rpb24gU2hhcGUoKSB7XHJcbiAgICAgKiAgIHRoaXMueCA9IDA7XHJcbiAgICAgKiAgIHRoaXMueSA9IDA7XHJcbiAgICAgKiB9XHJcbiAgICAgKlxyXG4gICAgICogXy5pc1BsYWluT2JqZWN0KG5ldyBTaGFwZSk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNQbGFpbk9iamVjdChbMSwgMiwgM10pO1xyXG4gICAgICogLy8gPT4gZmFsc2VcclxuICAgICAqXHJcbiAgICAgKiBfLmlzUGxhaW5PYmplY3QoeyAneCc6IDAsICd5JzogMCB9KTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgdmFyIGlzUGxhaW5PYmplY3QgPSAhZ2V0UHJvdG90eXBlT2YgPyBzaGltSXNQbGFpbk9iamVjdCA6IGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgIGlmICghKHZhbHVlICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09IG9iamVjdENsYXNzKSkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgdmFsdWVPZiA9IHZhbHVlLnZhbHVlT2YsXHJcbiAgICAgICAgICBvYmpQcm90byA9IGlzTmF0aXZlKHZhbHVlT2YpICYmIChvYmpQcm90byA9IGdldFByb3RvdHlwZU9mKHZhbHVlT2YpKSAmJiBnZXRQcm90b3R5cGVPZihvYmpQcm90byk7XHJcblxyXG4gICAgICByZXR1cm4gb2JqUHJvdG9cclxuICAgICAgICA/ICh2YWx1ZSA9PSBvYmpQcm90byB8fCBnZXRQcm90b3R5cGVPZih2YWx1ZSkgPT0gb2JqUHJvdG8pXHJcbiAgICAgICAgOiBzaGltSXNQbGFpbk9iamVjdCh2YWx1ZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGB2YWx1ZWAgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVjay5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiB0aGUgYHZhbHVlYCBpcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbiwgZWxzZSBgZmFsc2VgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmlzUmVnRXhwKC9mcmVkLyk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGlzUmVnRXhwKHZhbHVlKSB7XHJcbiAgICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT0gJ29iamVjdCcgJiYgdG9TdHJpbmcuY2FsbCh2YWx1ZSkgPT0gcmVnZXhwQ2xhc3MgfHwgZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDaGVja3MgaWYgYHZhbHVlYCBpcyBhIHN0cmluZy5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIGNoZWNrLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIHRoZSBgdmFsdWVgIGlzIGEgc3RyaW5nLCBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uaXNTdHJpbmcoJ2ZyZWQnKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaXNTdHJpbmcodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJyB8fFxyXG4gICAgICAgIHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PSAnb2JqZWN0JyAmJiB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PSBzdHJpbmdDbGFzcyB8fCBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiBgdmFsdWVgIGlzIGB1bmRlZmluZWRgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2suXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB2YWx1ZWAgaXMgYHVuZGVmaW5lZGAsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pc1VuZGVmaW5lZCh2b2lkIDApO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICd1bmRlZmluZWQnO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBvYmplY3Qgd2l0aCB0aGUgc2FtZSBrZXlzIGFzIGBvYmplY3RgIGFuZCB2YWx1ZXMgZ2VuZXJhdGVkIGJ5XHJcbiAgICAgKiBydW5uaW5nIGVhY2ggb3duIGVudW1lcmFibGUgcHJvcGVydHkgb2YgYG9iamVjdGAgdGhyb3VnaCB0aGUgY2FsbGJhY2suXHJcbiAgICAgKiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzO1xyXG4gICAgICogKHZhbHVlLCBrZXksIG9iamVjdCkuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgb2JqZWN0IHdpdGggdmFsdWVzIG9mIHRoZSByZXN1bHRzIG9mIGVhY2ggYGNhbGxiYWNrYCBleGVjdXRpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ubWFwVmFsdWVzKHsgJ2EnOiAxLCAnYic6IDIsICdjJzogM30gLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIDM7IH0pO1xyXG4gICAgICogLy8gPT4geyAnYSc6IDMsICdiJzogNiwgJ2MnOiA5IH1cclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IHtcclxuICAgICAqICAgJ2ZyZWQnOiB7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfSxcclxuICAgICAqICAgJ3BlYmJsZXMnOiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5tYXBWYWx1ZXMoY2hhcmFjdGVycywgJ2FnZScpO1xyXG4gICAgICogLy8gPT4geyAnZnJlZCc6IDQwLCAncGViYmxlcyc6IDEgfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBtYXBWYWx1ZXMob2JqZWN0LCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuXHJcbiAgICAgIGZvck93bihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xyXG4gICAgICAgIHJlc3VsdFtrZXldID0gY2FsbGJhY2sodmFsdWUsIGtleSwgb2JqZWN0KTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWN1cnNpdmVseSBtZXJnZXMgb3duIGVudW1lcmFibGUgcHJvcGVydGllcyBvZiB0aGUgc291cmNlIG9iamVjdChzKSwgdGhhdFxyXG4gICAgICogZG9uJ3QgcmVzb2x2ZSB0byBgdW5kZWZpbmVkYCBpbnRvIHRoZSBkZXN0aW5hdGlvbiBvYmplY3QuIFN1YnNlcXVlbnQgc291cmNlc1xyXG4gICAgICogd2lsbCBvdmVyd3JpdGUgcHJvcGVydHkgYXNzaWdubWVudHMgb2YgcHJldmlvdXMgc291cmNlcy4gSWYgYSBjYWxsYmFjayBpc1xyXG4gICAgICogcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCB0byBwcm9kdWNlIHRoZSBtZXJnZWQgdmFsdWVzIG9mIHRoZSBkZXN0aW5hdGlvblxyXG4gICAgICogYW5kIHNvdXJjZSBwcm9wZXJ0aWVzLiBJZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBgdW5kZWZpbmVkYCBtZXJnaW5nIHdpbGxcclxuICAgICAqIGJlIGhhbmRsZWQgYnkgdGhlIG1ldGhvZCBpbnN0ZWFkLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxyXG4gICAgICogaW52b2tlZCB3aXRoIHR3byBhcmd1bWVudHM7IChvYmplY3RWYWx1ZSwgc291cmNlVmFsdWUpLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxyXG4gICAgICogQHBhcmFtIHsuLi5PYmplY3R9IFtzb3VyY2VdIFRoZSBzb3VyY2Ugb2JqZWN0cy5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIHRvIGN1c3RvbWl6ZSBtZXJnaW5nIHByb3BlcnRpZXMuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGRlc3RpbmF0aW9uIG9iamVjdC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIG5hbWVzID0ge1xyXG4gICAgICogICAnY2hhcmFjdGVycyc6IFtcclxuICAgICAqICAgICB7ICduYW1lJzogJ2Jhcm5leScgfSxcclxuICAgICAqICAgICB7ICduYW1lJzogJ2ZyZWQnIH1cclxuICAgICAqICAgXVxyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiB2YXIgYWdlcyA9IHtcclxuICAgICAqICAgJ2NoYXJhY3RlcnMnOiBbXHJcbiAgICAgKiAgICAgeyAnYWdlJzogMzYgfSxcclxuICAgICAqICAgICB7ICdhZ2UnOiA0MCB9XHJcbiAgICAgKiAgIF1cclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogXy5tZXJnZShuYW1lcywgYWdlcyk7XHJcbiAgICAgKiAvLyA9PiB7ICdjaGFyYWN0ZXJzJzogW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sIHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9XSB9XHJcbiAgICAgKlxyXG4gICAgICogdmFyIGZvb2QgPSB7XHJcbiAgICAgKiAgICdmcnVpdHMnOiBbJ2FwcGxlJ10sXHJcbiAgICAgKiAgICd2ZWdldGFibGVzJzogWydiZWV0J11cclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogdmFyIG90aGVyRm9vZCA9IHtcclxuICAgICAqICAgJ2ZydWl0cyc6IFsnYmFuYW5hJ10sXHJcbiAgICAgKiAgICd2ZWdldGFibGVzJzogWydjYXJyb3QnXVxyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiBfLm1lcmdlKGZvb2QsIG90aGVyRm9vZCwgZnVuY3Rpb24oYSwgYikge1xyXG4gICAgICogICByZXR1cm4gXy5pc0FycmF5KGEpID8gYS5jb25jYXQoYikgOiB1bmRlZmluZWQ7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IHsgJ2ZydWl0cyc6IFsnYXBwbGUnLCAnYmFuYW5hJ10sICd2ZWdldGFibGVzJzogWydiZWV0JywgJ2NhcnJvdF0gfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBtZXJnZShvYmplY3QpIHtcclxuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHMsXHJcbiAgICAgICAgICBsZW5ndGggPSAyO1xyXG5cclxuICAgICAgaWYgKCFpc09iamVjdChvYmplY3QpKSB7XHJcbiAgICAgICAgcmV0dXJuIG9iamVjdDtcclxuICAgICAgfVxyXG4gICAgICAvLyBhbGxvd3Mgd29ya2luZyB3aXRoIGBfLnJlZHVjZWAgYW5kIGBfLnJlZHVjZVJpZ2h0YCB3aXRob3V0IHVzaW5nXHJcbiAgICAgIC8vIHRoZWlyIGBpbmRleGAgYW5kIGBjb2xsZWN0aW9uYCBhcmd1bWVudHNcclxuICAgICAgaWYgKHR5cGVvZiBhcmdzWzJdICE9ICdudW1iZXInKSB7XHJcbiAgICAgICAgbGVuZ3RoID0gYXJncy5sZW5ndGg7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGxlbmd0aCA+IDMgJiYgdHlwZW9mIGFyZ3NbbGVuZ3RoIC0gMl0gPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHZhciBjYWxsYmFjayA9IGJhc2VDcmVhdGVDYWxsYmFjayhhcmdzWy0tbGVuZ3RoIC0gMV0sIGFyZ3NbbGVuZ3RoLS1dLCAyKTtcclxuICAgICAgfSBlbHNlIGlmIChsZW5ndGggPiAyICYmIHR5cGVvZiBhcmdzW2xlbmd0aCAtIDFdID09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBjYWxsYmFjayA9IGFyZ3NbLS1sZW5ndGhdO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBzb3VyY2VzID0gc2xpY2UoYXJndW1lbnRzLCAxLCBsZW5ndGgpLFxyXG4gICAgICAgICAgaW5kZXggPSAtMSxcclxuICAgICAgICAgIHN0YWNrQSA9IGdldEFycmF5KCksXHJcbiAgICAgICAgICBzdGFja0IgPSBnZXRBcnJheSgpO1xyXG5cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICBiYXNlTWVyZ2Uob2JqZWN0LCBzb3VyY2VzW2luZGV4XSwgY2FsbGJhY2ssIHN0YWNrQSwgc3RhY2tCKTtcclxuICAgICAgfVxyXG4gICAgICByZWxlYXNlQXJyYXkoc3RhY2tBKTtcclxuICAgICAgcmVsZWFzZUFycmF5KHN0YWNrQik7XHJcbiAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2hhbGxvdyBjbG9uZSBvZiBgb2JqZWN0YCBleGNsdWRpbmcgdGhlIHNwZWNpZmllZCBwcm9wZXJ0aWVzLlxyXG4gICAgICogUHJvcGVydHkgbmFtZXMgbWF5IGJlIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIGFyZ3VtZW50cyBvciBhcyBhcnJheXMgb2ZcclxuICAgICAqIHByb3BlcnR5IG5hbWVzLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgZXhlY3V0ZWQgZm9yIGVhY2hcclxuICAgICAqIHByb3BlcnR5IG9mIGBvYmplY3RgIG9taXR0aW5nIHRoZSBwcm9wZXJ0aWVzIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5XHJcbiAgICAgKiBmb3IuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7XHJcbiAgICAgKiAodmFsdWUsIGtleSwgb2JqZWN0KS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIHNvdXJjZSBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufC4uLnN0cmluZ3xzdHJpbmdbXX0gW2NhbGxiYWNrXSBUaGUgcHJvcGVydGllcyB0byBvbWl0IG9yIHRoZVxyXG4gICAgICogIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIG9iamVjdCB3aXRob3V0IHRoZSBvbWl0dGVkIHByb3BlcnRpZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ub21pdCh7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfSwgJ2FnZScpO1xyXG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdmcmVkJyB9XHJcbiAgICAgKlxyXG4gICAgICogXy5vbWl0KHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9LCBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICogICByZXR1cm4gdHlwZW9mIHZhbHVlID09ICdudW1iZXInO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnIH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gb21pdChvYmplY3QsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdmFyIHByb3BzID0gW107XHJcbiAgICAgICAgZm9ySW4ob2JqZWN0LCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgICBwcm9wcy5wdXNoKGtleSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcHJvcHMgPSBiYXNlRGlmZmVyZW5jZShwcm9wcywgYmFzZUZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlLCBmYWxzZSwgMSkpO1xyXG5cclxuICAgICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcclxuICAgICAgICAgIHJlc3VsdFtrZXldID0gb2JqZWN0W2tleV07XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xyXG4gICAgICAgICAgaWYgKCFjYWxsYmFjayh2YWx1ZSwga2V5LCBvYmplY3QpKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSB0d28gZGltZW5zaW9uYWwgYXJyYXkgb2YgYW4gb2JqZWN0J3Mga2V5LXZhbHVlIHBhaXJzLFxyXG4gICAgICogaS5lLiBgW1trZXkxLCB2YWx1ZTFdLCBba2V5MiwgdmFsdWUyXV1gLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgT2JqZWN0c1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGluc3BlY3QuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgbmV3IGFycmF5IG9mIGtleS12YWx1ZSBwYWlycy5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5wYWlycyh7ICdiYXJuZXknOiAzNiwgJ2ZyZWQnOiA0MCB9KTtcclxuICAgICAqIC8vID0+IFtbJ2Jhcm5leScsIDM2XSwgWydmcmVkJywgNDBdXSAocHJvcGVydHkgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQgYWNyb3NzIGVudmlyb25tZW50cylcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcGFpcnMob2JqZWN0KSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgcHJvcHMgPSBrZXlzKG9iamVjdCksXHJcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXHJcbiAgICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xyXG5cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIga2V5ID0gcHJvcHNbaW5kZXhdO1xyXG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSBba2V5LCBvYmplY3Rba2V5XV07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzaGFsbG93IGNsb25lIG9mIGBvYmplY3RgIGNvbXBvc2VkIG9mIHRoZSBzcGVjaWZpZWQgcHJvcGVydGllcy5cclxuICAgICAqIFByb3BlcnR5IG5hbWVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzIG9mXHJcbiAgICAgKiBwcm9wZXJ0eSBuYW1lcy4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIGV4ZWN1dGVkIGZvciBlYWNoXHJcbiAgICAgKiBwcm9wZXJ0eSBvZiBgb2JqZWN0YCBwaWNraW5nIHRoZSBwcm9wZXJ0aWVzIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5XHJcbiAgICAgKiBmb3IuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7XHJcbiAgICAgKiAodmFsdWUsIGtleSwgb2JqZWN0KS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvYmplY3QgVGhlIHNvdXJjZSBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufC4uLnN0cmluZ3xzdHJpbmdbXX0gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlclxyXG4gICAgICogIGl0ZXJhdGlvbiBvciBwcm9wZXJ0eSBuYW1lcyB0byBwaWNrLCBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBwcm9wZXJ0eVxyXG4gICAgICogIG5hbWVzIG9yIGFycmF5cyBvZiBwcm9wZXJ0eSBuYW1lcy5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIHBpY2tlZCBwcm9wZXJ0aWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLnBpY2soeyAnbmFtZSc6ICdmcmVkJywgJ191c2VyaWQnOiAnZnJlZDEnIH0sICduYW1lJyk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnIH1cclxuICAgICAqXHJcbiAgICAgKiBfLnBpY2soeyAnbmFtZSc6ICdmcmVkJywgJ191c2VyaWQnOiAnZnJlZDEnIH0sIGZ1bmN0aW9uKHZhbHVlLCBrZXkpIHtcclxuICAgICAqICAgcmV0dXJuIGtleS5jaGFyQXQoMCkgIT0gJ18nO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2ZyZWQnIH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcGljayhvYmplY3QsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICAgIHByb3BzID0gYmFzZUZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlLCBmYWxzZSwgMSksXHJcbiAgICAgICAgICAgIGxlbmd0aCA9IGlzT2JqZWN0KG9iamVjdCkgPyBwcm9wcy5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgdmFyIGtleSA9IHByb3BzW2luZGV4XTtcclxuICAgICAgICAgIGlmIChrZXkgaW4gb2JqZWN0KSB7XHJcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gb2JqZWN0W2tleV07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgICBmb3JJbihvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBrZXksIG9iamVjdCkge1xyXG4gICAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBrZXksIG9iamVjdCkpIHtcclxuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQW4gYWx0ZXJuYXRpdmUgdG8gYF8ucmVkdWNlYCB0aGlzIG1ldGhvZCB0cmFuc2Zvcm1zIGBvYmplY3RgIHRvIGEgbmV3XHJcbiAgICAgKiBgYWNjdW11bGF0b3JgIG9iamVjdCB3aGljaCBpcyB0aGUgcmVzdWx0IG9mIHJ1bm5pbmcgZWFjaCBvZiBpdHMgb3duXHJcbiAgICAgKiBlbnVtZXJhYmxlIHByb3BlcnRpZXMgdGhyb3VnaCBhIGNhbGxiYWNrLCB3aXRoIGVhY2ggY2FsbGJhY2sgZXhlY3V0aW9uXHJcbiAgICAgKiBwb3RlbnRpYWxseSBtdXRhdGluZyB0aGUgYGFjY3VtdWxhdG9yYCBvYmplY3QuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0b1xyXG4gICAgICogYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggZm91ciBhcmd1bWVudHM7IChhY2N1bXVsYXRvciwgdmFsdWUsIGtleSwgb2JqZWN0KS5cclxuICAgICAqIENhbGxiYWNrcyBtYXkgZXhpdCBpdGVyYXRpb24gZWFybHkgYnkgZXhwbGljaXRseSByZXR1cm5pbmcgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IE9iamVjdHNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fSBvYmplY3QgVGhlIG9iamVjdCB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Kn0gW2FjY3VtdWxhdG9yXSBUaGUgY3VzdG9tIGFjY3VtdWxhdG9yIHZhbHVlLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBzcXVhcmVzID0gXy50cmFuc2Zvcm0oWzEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDksIDEwXSwgZnVuY3Rpb24ocmVzdWx0LCBudW0pIHtcclxuICAgICAqICAgbnVtICo9IG51bTtcclxuICAgICAqICAgaWYgKG51bSAlIDIpIHtcclxuICAgICAqICAgICByZXR1cm4gcmVzdWx0LnB1c2gobnVtKSA8IDM7XHJcbiAgICAgKiAgIH1cclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gWzEsIDksIDI1XVxyXG4gICAgICpcclxuICAgICAqIHZhciBtYXBwZWQgPSBfLnRyYW5zZm9ybSh7ICdhJzogMSwgJ2InOiAyLCAnYyc6IDMgfSwgZnVuY3Rpb24ocmVzdWx0LCBudW0sIGtleSkge1xyXG4gICAgICogICByZXN1bHRba2V5XSA9IG51bSAqIDM7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IHsgJ2EnOiAzLCAnYic6IDYsICdjJzogOSB9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHRyYW5zZm9ybShvYmplY3QsIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xyXG4gICAgICB2YXIgaXNBcnIgPSBpc0FycmF5KG9iamVjdCk7XHJcbiAgICAgIGlmIChhY2N1bXVsYXRvciA9PSBudWxsKSB7XHJcbiAgICAgICAgaWYgKGlzQXJyKSB7XHJcbiAgICAgICAgICBhY2N1bXVsYXRvciA9IFtdO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB2YXIgY3RvciA9IG9iamVjdCAmJiBvYmplY3QuY29uc3RydWN0b3IsXHJcbiAgICAgICAgICAgICAgcHJvdG8gPSBjdG9yICYmIGN0b3IucHJvdG90eXBlO1xyXG5cclxuICAgICAgICAgIGFjY3VtdWxhdG9yID0gYmFzZUNyZWF0ZShwcm90byk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChjYWxsYmFjaykge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCA0KTtcclxuICAgICAgICAoaXNBcnIgPyBmb3JFYWNoIDogZm9yT3duKShvYmplY3QsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgb2JqZWN0KSB7XHJcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soYWNjdW11bGF0b3IsIHZhbHVlLCBpbmRleCwgb2JqZWN0KTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gYWNjdW11bGF0b3I7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGNvbXBvc2VkIG9mIHRoZSBvd24gZW51bWVyYWJsZSBwcm9wZXJ0eSB2YWx1ZXMgb2YgYG9iamVjdGAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBPYmplY3RzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBwcm9wZXJ0eSB2YWx1ZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8udmFsdWVzKHsgJ29uZSc6IDEsICd0d28nOiAyLCAndGhyZWUnOiAzIH0pO1xyXG4gICAgICogLy8gPT4gWzEsIDIsIDNdIChwcm9wZXJ0eSBvcmRlciBpcyBub3QgZ3VhcmFudGVlZCBhY3Jvc3MgZW52aXJvbm1lbnRzKVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiB2YWx1ZXMob2JqZWN0KSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgcHJvcHMgPSBrZXlzKG9iamVjdCksXHJcbiAgICAgICAgICBsZW5ndGggPSBwcm9wcy5sZW5ndGgsXHJcbiAgICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xyXG5cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICByZXN1bHRbaW5kZXhdID0gb2JqZWN0W3Byb3BzW2luZGV4XV07XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gYXJyYXkgb2YgZWxlbWVudHMgZnJvbSB0aGUgc3BlY2lmaWVkIGluZGV4ZXMsIG9yIGtleXMsIG9mIHRoZVxyXG4gICAgICogYGNvbGxlY3Rpb25gLiBJbmRleGVzIG1heSBiZSBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBhcmd1bWVudHMgb3IgYXMgYXJyYXlzXHJcbiAgICAgKiBvZiBpbmRleGVzLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0gey4uLihudW1iZXJ8bnVtYmVyW118c3RyaW5nfHN0cmluZ1tdKX0gW2luZGV4XSBUaGUgaW5kZXhlcyBvZiBgY29sbGVjdGlvbmBcclxuICAgICAqICAgdG8gcmV0cmlldmUsIHNwZWNpZmllZCBhcyBpbmRpdmlkdWFsIGluZGV4ZXMgb3IgYXJyYXlzIG9mIGluZGV4ZXMuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgY29ycmVzcG9uZGluZyB0byB0aGVcclxuICAgICAqICBwcm92aWRlZCBpbmRleGVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmF0KFsnYScsICdiJywgJ2MnLCAnZCcsICdlJ10sIFswLCAyLCA0XSk7XHJcbiAgICAgKiAvLyA9PiBbJ2EnLCAnYycsICdlJ11cclxuICAgICAqXHJcbiAgICAgKiBfLmF0KFsnZnJlZCcsICdiYXJuZXknLCAncGViYmxlcyddLCAwLCAyKTtcclxuICAgICAqIC8vID0+IFsnZnJlZCcsICdwZWJibGVzJ11cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYXQoY29sbGVjdGlvbikge1xyXG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcclxuICAgICAgICAgIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBwcm9wcyA9IGJhc2VGbGF0dGVuKGFyZ3MsIHRydWUsIGZhbHNlLCAxKSxcclxuICAgICAgICAgIGxlbmd0aCA9IChhcmdzWzJdICYmIGFyZ3NbMl1bYXJnc1sxXV0gPT09IGNvbGxlY3Rpb24pID8gMSA6IHByb3BzLmxlbmd0aCxcclxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCk7XHJcblxyXG4gICAgICB3aGlsZSgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IGNvbGxlY3Rpb25bcHJvcHNbaW5kZXhdXTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gdmFsdWUgaXMgcHJlc2VudCBpbiBhIGNvbGxlY3Rpb24gdXNpbmcgc3RyaWN0IGVxdWFsaXR5XHJcbiAgICAgKiBmb3IgY29tcGFyaXNvbnMsIGkuZS4gYD09PWAuIElmIGBmcm9tSW5kZXhgIGlzIG5lZ2F0aXZlLCBpdCBpcyB1c2VkIGFzIHRoZVxyXG4gICAgICogb2Zmc2V0IGZyb20gdGhlIGVuZCBvZiB0aGUgY29sbGVjdGlvbi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGluY2x1ZGVcclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7Kn0gdGFyZ2V0IFRoZSB2YWx1ZSB0byBjaGVjayBmb3IuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Zyb21JbmRleD0wXSBUaGUgaW5kZXggdG8gc2VhcmNoIGZyb20uXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyBgdHJ1ZWAgaWYgdGhlIGB0YXJnZXRgIGVsZW1lbnQgaXMgZm91bmQsIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5jb250YWlucyhbMSwgMiwgM10sIDEpO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICpcclxuICAgICAqIF8uY29udGFpbnMoWzEsIDIsIDNdLCAxLCAyKTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKlxyXG4gICAgICogXy5jb250YWlucyh7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfSwgJ2ZyZWQnKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiBfLmNvbnRhaW5zKCdwZWJibGVzJywgJ2ViJyk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNvbnRhaW5zKGNvbGxlY3Rpb24sIHRhcmdldCwgZnJvbUluZGV4KSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgaW5kZXhPZiA9IGdldEluZGV4T2YoKSxcclxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcclxuXHJcbiAgICAgIGZyb21JbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGxlbmd0aCArIGZyb21JbmRleCkgOiBmcm9tSW5kZXgpIHx8IDA7XHJcbiAgICAgIGlmIChpc0FycmF5KGNvbGxlY3Rpb24pKSB7XHJcbiAgICAgICAgcmVzdWx0ID0gaW5kZXhPZihjb2xsZWN0aW9uLCB0YXJnZXQsIGZyb21JbmRleCkgPiAtMTtcclxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XHJcbiAgICAgICAgcmVzdWx0ID0gKGlzU3RyaW5nKGNvbGxlY3Rpb24pID8gY29sbGVjdGlvbi5pbmRleE9mKHRhcmdldCwgZnJvbUluZGV4KSA6IGluZGV4T2YoY29sbGVjdGlvbiwgdGFyZ2V0LCBmcm9tSW5kZXgpKSA+IC0xO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSkge1xyXG4gICAgICAgICAgaWYgKCsraW5kZXggPj0gZnJvbUluZGV4KSB7XHJcbiAgICAgICAgICAgIHJldHVybiAhKHJlc3VsdCA9IHZhbHVlID09PSB0YXJnZXQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIG9iamVjdCBjb21wb3NlZCBvZiBrZXlzIGdlbmVyYXRlZCBmcm9tIHRoZSByZXN1bHRzIG9mIHJ1bm5pbmdcclxuICAgICAqIGVhY2ggZWxlbWVudCBvZiBgY29sbGVjdGlvbmAgdGhyb3VnaCB0aGUgY2FsbGJhY2suIFRoZSBjb3JyZXNwb25kaW5nIHZhbHVlXHJcbiAgICAgKiBvZiBlYWNoIGtleSBpcyB0aGUgbnVtYmVyIG9mIHRpbWVzIHRoZSBrZXkgd2FzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFjay5cclxuICAgICAqIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7XHJcbiAgICAgKiAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgY29tcG9zZWQgYWdncmVnYXRlIG9iamVjdC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5jb3VudEJ5KFs0LjMsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBNYXRoLmZsb29yKG51bSk7IH0pO1xyXG4gICAgICogLy8gPT4geyAnNCc6IDEsICc2JzogMiB9XHJcbiAgICAgKlxyXG4gICAgICogXy5jb3VudEJ5KFs0LjMsIDYuMSwgNi40XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLmZsb29yKG51bSk7IH0sIE1hdGgpO1xyXG4gICAgICogLy8gPT4geyAnNCc6IDEsICc2JzogMiB9XHJcbiAgICAgKlxyXG4gICAgICogXy5jb3VudEJ5KFsnb25lJywgJ3R3bycsICd0aHJlZSddLCAnbGVuZ3RoJyk7XHJcbiAgICAgKiAvLyA9PiB7ICczJzogMiwgJzUnOiAxIH1cclxuICAgICAqL1xyXG4gICAgdmFyIGNvdW50QnkgPSBjcmVhdGVBZ2dyZWdhdG9yKGZ1bmN0aW9uKHJlc3VsdCwgdmFsdWUsIGtleSkge1xyXG4gICAgICAoaGFzT3duUHJvcGVydHkuY2FsbChyZXN1bHQsIGtleSkgPyByZXN1bHRba2V5XSsrIDogcmVzdWx0W2tleV0gPSAxKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBjYWxsYmFjayByZXR1cm5zIHRydWV5IHZhbHVlIGZvciAqKmFsbCoqIGVsZW1lbnRzIG9mXHJcbiAgICAgKiBhIGNvbGxlY3Rpb24uIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxyXG4gICAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAYWxpYXMgYWxsXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgYHRydWVgIGlmIGFsbCBlbGVtZW50cyBwYXNzZWQgdGhlIGNhbGxiYWNrIGNoZWNrLFxyXG4gICAgICogIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5ldmVyeShbdHJ1ZSwgMSwgbnVsbCwgJ3llcyddKTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmV2ZXJ5KGNoYXJhY3RlcnMsICdhZ2UnKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uZXZlcnkoY2hhcmFjdGVycywgeyAnYWdlJzogMzYgfSk7XHJcbiAgICAgKiAvLyA9PiBmYWxzZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBldmVyeShjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gdHJ1ZTtcclxuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG5cclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgaWYgKCEocmVzdWx0ID0gISFjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pKSkge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xyXG4gICAgICAgICAgcmV0dXJuIChyZXN1bHQgPSAhIWNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJdGVyYXRlcyBvdmVyIGVsZW1lbnRzIG9mIGEgY29sbGVjdGlvbiwgcmV0dXJuaW5nIGFuIGFycmF5IG9mIGFsbCBlbGVtZW50c1xyXG4gICAgICogdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkgZm9yLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxyXG4gICAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIHNlbGVjdFxyXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcclxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxyXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBlbGVtZW50cyB0aGF0IHBhc3NlZCB0aGUgY2FsbGJhY2sgY2hlY2suXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBldmVucyA9IF8uZmlsdGVyKFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xyXG4gICAgICogLy8gPT4gWzIsIDQsIDZdXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uZmlsdGVyKGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfV1cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uZmlsdGVyKGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDM2IH0pO1xyXG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH1dXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGZpbHRlcihjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gW107XHJcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuXHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XHJcbiAgICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICAgIHZhciB2YWx1ZSA9IGNvbGxlY3Rpb25baW5kZXhdO1xyXG4gICAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikpIHtcclxuICAgICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmb3JPd24oY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSkge1xyXG4gICAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgYSBjb2xsZWN0aW9uLCByZXR1cm5pbmcgdGhlIGZpcnN0IGVsZW1lbnQgdGhhdFxyXG4gICAgICogdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkgZm9yLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZFxyXG4gICAgICogaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGRldGVjdCwgZmluZFdoZXJlXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZvdW5kIGVsZW1lbnQsIGVsc2UgYHVuZGVmaW5lZGAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdwZWJibGVzJywgJ2FnZSc6IDEsICAnYmxvY2tlZCc6IGZhbHNlIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5maW5kKGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGNocikge1xyXG4gICAgICogICByZXR1cm4gY2hyLmFnZSA8IDQwO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiwgJ2Jsb2NrZWQnOiBmYWxzZSB9XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmQoY2hhcmFjdGVycywgeyAnYWdlJzogMSB9KTtcclxuICAgICAqIC8vID0+ICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSwgJ2Jsb2NrZWQnOiBmYWxzZSB9XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmQoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcclxuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZmluZChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcblxyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xyXG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICB2YXIgdmFsdWUgPSBjb2xsZWN0aW9uW2luZGV4XTtcclxuICAgICAgICAgIGlmIChjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdDtcclxuICAgICAgICBmb3JPd24oY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgbWV0aG9kIGlzIGxpa2UgYF8uZmluZGAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xyXG4gICAgICogb2YgYSBgY29sbGVjdGlvbmAgZnJvbSByaWdodCB0byBsZWZ0LlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGZvdW5kIGVsZW1lbnQsIGVsc2UgYHVuZGVmaW5lZGAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uZmluZExhc3QoWzEsIDIsIDMsIDRdLCBmdW5jdGlvbihudW0pIHtcclxuICAgICAqICAgcmV0dXJuIG51bSAlIDIgPT0gMTtcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gM1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBmaW5kTGFzdChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgcmVzdWx0O1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIGZvckVhY2hSaWdodChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcclxuICAgICAgICBpZiAoY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSkge1xyXG4gICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEl0ZXJhdGVzIG92ZXIgZWxlbWVudHMgb2YgYSBjb2xsZWN0aW9uLCBleGVjdXRpbmcgdGhlIGNhbGxiYWNrIGZvciBlYWNoXHJcbiAgICAgKiBlbGVtZW50LiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzO1xyXG4gICAgICogKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLiBDYWxsYmFja3MgbWF5IGV4aXQgaXRlcmF0aW9uIGVhcmx5IGJ5XHJcbiAgICAgKiBleHBsaWNpdGx5IHJldHVybmluZyBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIE5vdGU6IEFzIHdpdGggb3RoZXIgXCJDb2xsZWN0aW9uc1wiIG1ldGhvZHMsIG9iamVjdHMgd2l0aCBhIGBsZW5ndGhgIHByb3BlcnR5XHJcbiAgICAgKiBhcmUgaXRlcmF0ZWQgbGlrZSBhcnJheXMuIFRvIGF2b2lkIHRoaXMgYmVoYXZpb3IgYF8uZm9ySW5gIG9yIGBfLmZvck93bmBcclxuICAgICAqIG1heSBiZSB1c2VkIGZvciBvYmplY3QgaXRlcmF0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAYWxpYXMgZWFjaFxyXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheXxPYmplY3R8c3RyaW5nfSBSZXR1cm5zIGBjb2xsZWN0aW9uYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXyhbMSwgMiwgM10pLmZvckVhY2goZnVuY3Rpb24obnVtKSB7IGNvbnNvbGUubG9nKG51bSk7IH0pLmpvaW4oJywnKTtcclxuICAgICAqIC8vID0+IGxvZ3MgZWFjaCBudW1iZXIgYW5kIHJldHVybnMgJzEsMiwzJ1xyXG4gICAgICpcclxuICAgICAqIF8uZm9yRWFjaCh7ICdvbmUnOiAxLCAndHdvJzogMiwgJ3RocmVlJzogMyB9LCBmdW5jdGlvbihudW0pIHsgY29uc29sZS5sb2cobnVtKTsgfSk7XHJcbiAgICAgKiAvLyA9PiBsb2dzIGVhY2ggbnVtYmVyIGFuZCByZXR1cm5zIHRoZSBvYmplY3QgKHByb3BlcnR5IG9yZGVyIGlzIG5vdCBndWFyYW50ZWVkIGFjcm9zcyBlbnZpcm9ubWVudHMpXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGZvckVhY2goY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayAmJiB0eXBlb2YgdGhpc0FyZyA9PSAndW5kZWZpbmVkJyA/IGNhbGxiYWNrIDogYmFzZUNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgaWYgKGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbikgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBmb3JPd24oY29sbGVjdGlvbiwgY2FsbGJhY2spO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBjb2xsZWN0aW9uO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5mb3JFYWNoYCBleGNlcHQgdGhhdCBpdCBpdGVyYXRlcyBvdmVyIGVsZW1lbnRzXHJcbiAgICAgKiBvZiBhIGBjb2xsZWN0aW9uYCBmcm9tIHJpZ2h0IHRvIGxlZnQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBhbGlhcyBlYWNoUmlnaHRcclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl8T2JqZWN0fHN0cmluZ30gUmV0dXJucyBgY29sbGVjdGlvbmAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8oWzEsIDIsIDNdKS5mb3JFYWNoUmlnaHQoZnVuY3Rpb24obnVtKSB7IGNvbnNvbGUubG9nKG51bSk7IH0pLmpvaW4oJywnKTtcclxuICAgICAqIC8vID0+IGxvZ3MgZWFjaCBudW1iZXIgZnJvbSByaWdodCB0byBsZWZ0IGFuZCByZXR1cm5zICczLDIsMSdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZm9yRWFjaFJpZ2h0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrICYmIHR5cGVvZiB0aGlzQXJnID09ICd1bmRlZmluZWQnID8gY2FsbGJhY2sgOiBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG4gICAgICBpZiAodHlwZW9mIGxlbmd0aCA9PSAnbnVtYmVyJykge1xyXG4gICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgICAgaWYgKGNhbGxiYWNrKGNvbGxlY3Rpb25bbGVuZ3RoXSwgbGVuZ3RoLCBjb2xsZWN0aW9uKSA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHZhciBwcm9wcyA9IGtleXMoY29sbGVjdGlvbik7XHJcbiAgICAgICAgbGVuZ3RoID0gcHJvcHMubGVuZ3RoO1xyXG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICBrZXkgPSBwcm9wcyA/IHByb3BzWy0tbGVuZ3RoXSA6IC0tbGVuZ3RoO1xyXG4gICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNvbGxlY3Rpb25ba2V5XSwga2V5LCBjb2xsZWN0aW9uKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gY29sbGVjdGlvbjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIGtleXMgZ2VuZXJhdGVkIGZyb20gdGhlIHJlc3VsdHMgb2YgcnVubmluZ1xyXG4gICAgICogZWFjaCBlbGVtZW50IG9mIGEgY29sbGVjdGlvbiB0aHJvdWdoIHRoZSBjYWxsYmFjay4gVGhlIGNvcnJlc3BvbmRpbmcgdmFsdWVcclxuICAgICAqIG9mIGVhY2gga2V5IGlzIGFuIGFycmF5IG9mIHRoZSBlbGVtZW50cyByZXNwb25zaWJsZSBmb3IgZ2VuZXJhdGluZyB0aGUga2V5LlxyXG4gICAgICogVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50cztcclxuICAgICAqICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWBcclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcclxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxyXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGNvbXBvc2VkIGFnZ3JlZ2F0ZSBvYmplY3QuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uZ3JvdXBCeShbNC4yLCA2LjEsIDYuNF0sIGZ1bmN0aW9uKG51bSkgeyByZXR1cm4gTWF0aC5mbG9vcihudW0pOyB9KTtcclxuICAgICAqIC8vID0+IHsgJzQnOiBbNC4yXSwgJzYnOiBbNi4xLCA2LjRdIH1cclxuICAgICAqXHJcbiAgICAgKiBfLmdyb3VwQnkoWzQuMiwgNi4xLCA2LjRdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIHRoaXMuZmxvb3IobnVtKTsgfSwgTWF0aCk7XHJcbiAgICAgKiAvLyA9PiB7ICc0JzogWzQuMl0sICc2JzogWzYuMSwgNi40XSB9XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmdyb3VwQnkoWydvbmUnLCAndHdvJywgJ3RocmVlJ10sICdsZW5ndGgnKTtcclxuICAgICAqIC8vID0+IHsgJzMnOiBbJ29uZScsICd0d28nXSwgJzUnOiBbJ3RocmVlJ10gfVxyXG4gICAgICovXHJcbiAgICB2YXIgZ3JvdXBCeSA9IGNyZWF0ZUFnZ3JlZ2F0b3IoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XHJcbiAgICAgIChoYXNPd25Qcm9wZXJ0eS5jYWxsKHJlc3VsdCwga2V5KSA/IHJlc3VsdFtrZXldIDogcmVzdWx0W2tleV0gPSBbXSkucHVzaCh2YWx1ZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIG9mIGtleXMgZ2VuZXJhdGVkIGZyb20gdGhlIHJlc3VsdHMgb2YgcnVubmluZ1xyXG4gICAgICogZWFjaCBlbGVtZW50IG9mIHRoZSBjb2xsZWN0aW9uIHRocm91Z2ggdGhlIGdpdmVuIGNhbGxiYWNrLiBUaGUgY29ycmVzcG9uZGluZ1xyXG4gICAgICogdmFsdWUgb2YgZWFjaCBrZXkgaXMgdGhlIGxhc3QgZWxlbWVudCByZXNwb25zaWJsZSBmb3IgZ2VuZXJhdGluZyB0aGUga2V5LlxyXG4gICAgICogVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50cztcclxuICAgICAqICh2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIHRoZSBjb21wb3NlZCBhZ2dyZWdhdGUgb2JqZWN0LlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIga2V5cyA9IFtcclxuICAgICAqICAgeyAnZGlyJzogJ2xlZnQnLCAnY29kZSc6IDk3IH0sXHJcbiAgICAgKiAgIHsgJ2Rpcic6ICdyaWdodCcsICdjb2RlJzogMTAwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5pbmRleEJ5KGtleXMsICdkaXInKTtcclxuICAgICAqIC8vID0+IHsgJ2xlZnQnOiB7ICdkaXInOiAnbGVmdCcsICdjb2RlJzogOTcgfSwgJ3JpZ2h0JzogeyAnZGlyJzogJ3JpZ2h0JywgJ2NvZGUnOiAxMDAgfSB9XHJcbiAgICAgKlxyXG4gICAgICogXy5pbmRleEJ5KGtleXMsIGZ1bmN0aW9uKGtleSkgeyByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShrZXkuY29kZSk7IH0pO1xyXG4gICAgICogLy8gPT4geyAnYSc6IHsgJ2Rpcic6ICdsZWZ0JywgJ2NvZGUnOiA5NyB9LCAnZCc6IHsgJ2Rpcic6ICdyaWdodCcsICdjb2RlJzogMTAwIH0gfVxyXG4gICAgICpcclxuICAgICAqIF8uaW5kZXhCeShjaGFyYWN0ZXJzLCBmdW5jdGlvbihrZXkpIHsgdGhpcy5mcm9tQ2hhckNvZGUoa2V5LmNvZGUpOyB9LCBTdHJpbmcpO1xyXG4gICAgICogLy8gPT4geyAnYSc6IHsgJ2Rpcic6ICdsZWZ0JywgJ2NvZGUnOiA5NyB9LCAnZCc6IHsgJ2Rpcic6ICdyaWdodCcsICdjb2RlJzogMTAwIH0gfVxyXG4gICAgICovXHJcbiAgICB2YXIgaW5kZXhCeSA9IGNyZWF0ZUFnZ3JlZ2F0b3IoZnVuY3Rpb24ocmVzdWx0LCB2YWx1ZSwga2V5KSB7XHJcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsdWU7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEludm9rZXMgdGhlIG1ldGhvZCBuYW1lZCBieSBgbWV0aG9kTmFtZWAgb24gZWFjaCBlbGVtZW50IGluIHRoZSBgY29sbGVjdGlvbmBcclxuICAgICAqIHJldHVybmluZyBhbiBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGludm9rZWQgbWV0aG9kLiBBZGRpdGlvbmFsIGFyZ3VtZW50c1xyXG4gICAgICogd2lsbCBiZSBwcm92aWRlZCB0byBlYWNoIGludm9rZWQgbWV0aG9kLiBJZiBgbWV0aG9kTmFtZWAgaXMgYSBmdW5jdGlvbiBpdFxyXG4gICAgICogd2lsbCBiZSBpbnZva2VkIGZvciwgYW5kIGB0aGlzYCBib3VuZCB0bywgZWFjaCBlbGVtZW50IGluIHRoZSBgY29sbGVjdGlvbmAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258c3RyaW5nfSBtZXRob2ROYW1lIFRoZSBuYW1lIG9mIHRoZSBtZXRob2QgdG8gaW52b2tlIG9yXHJcbiAgICAgKiAgdGhlIGZ1bmN0aW9uIGludm9rZWQgcGVyIGl0ZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgbWV0aG9kIHdpdGguXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBpbnZva2VkIG1ldGhvZC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pbnZva2UoW1s1LCAxLCA3XSwgWzMsIDIsIDFdXSwgJ3NvcnQnKTtcclxuICAgICAqIC8vID0+IFtbMSwgNSwgN10sIFsxLCAyLCAzXV1cclxuICAgICAqXHJcbiAgICAgKiBfLmludm9rZShbMTIzLCA0NTZdLCBTdHJpbmcucHJvdG90eXBlLnNwbGl0LCAnJyk7XHJcbiAgICAgKiAvLyA9PiBbWycxJywgJzInLCAnMyddLCBbJzQnLCAnNScsICc2J11dXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGludm9rZShjb2xsZWN0aW9uLCBtZXRob2ROYW1lKSB7XHJcbiAgICAgIHZhciBhcmdzID0gc2xpY2UoYXJndW1lbnRzLCAyKSxcclxuICAgICAgICAgIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBpc0Z1bmMgPSB0eXBlb2YgbWV0aG9kTmFtZSA9PSAnZnVuY3Rpb24nLFxyXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMCxcclxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiAwKTtcclxuXHJcbiAgICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUpIHtcclxuICAgICAgICByZXN1bHRbKytpbmRleF0gPSAoaXNGdW5jID8gbWV0aG9kTmFtZSA6IHZhbHVlW21ldGhvZE5hbWVdKS5hcHBseSh2YWx1ZSwgYXJncyk7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiB2YWx1ZXMgYnkgcnVubmluZyBlYWNoIGVsZW1lbnQgaW4gdGhlIGNvbGxlY3Rpb25cclxuICAgICAqIHRocm91Z2ggdGhlIGNhbGxiYWNrLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGhcclxuICAgICAqIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGNvbGxlY3RcclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgdGhlIHJlc3VsdHMgb2YgZWFjaCBgY2FsbGJhY2tgIGV4ZWN1dGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5tYXAoWzEsIDIsIDNdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAqIDM7IH0pO1xyXG4gICAgICogLy8gPT4gWzMsIDYsIDldXHJcbiAgICAgKlxyXG4gICAgICogXy5tYXAoeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gKiAzOyB9KTtcclxuICAgICAqIC8vID0+IFszLCA2LCA5XSAocHJvcGVydHkgb3JkZXIgaXMgbm90IGd1YXJhbnRlZWQgYWNyb3NzIGVudmlyb25tZW50cylcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ubWFwKGNoYXJhY3RlcnMsICduYW1lJyk7XHJcbiAgICAgKiAvLyA9PiBbJ2Jhcm5leScsICdmcmVkJ11cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbWFwKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgcmVzdWx0W2luZGV4XSA9IGNhbGxiYWNrKGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlc3VsdCA9IFtdO1xyXG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICByZXN1bHRbKytpbmRleF0gPSBjYWxsYmFjayh2YWx1ZSwga2V5LCBjb2xsZWN0aW9uKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0cmlldmVzIHRoZSBtYXhpbXVtIHZhbHVlIG9mIGEgY29sbGVjdGlvbi4gSWYgdGhlIGNvbGxlY3Rpb24gaXMgZW1wdHkgb3JcclxuICAgICAqIGZhbHNleSBgLUluZmluaXR5YCBpcyByZXR1cm5lZC4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIGV4ZWN1dGVkXHJcbiAgICAgKiBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvbiB0byBnZW5lcmF0ZSB0aGUgY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZVxyXG4gICAgICogaXMgcmFua2VkLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcclxuICAgICAqIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIG1heGltdW0gdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ubWF4KFs0LCAyLCA4LCA2XSk7XHJcbiAgICAgKiAvLyA9PiA4XHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5tYXgoY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7IHJldHVybiBjaHIuYWdlOyB9KTtcclxuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCB9O1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5tYXgoY2hhcmFjdGVycywgJ2FnZScpO1xyXG4gICAgICogLy8gPT4geyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwIH07XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIG1heChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgY29tcHV0ZWQgPSAtSW5maW5pdHksXHJcbiAgICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcclxuXHJcbiAgICAgIC8vIGFsbG93cyB3b3JraW5nIHdpdGggZnVuY3Rpb25zIGxpa2UgYF8ubWFwYCB3aXRob3V0IHVzaW5nXHJcbiAgICAgIC8vIHRoZWlyIGBpbmRleGAgYXJndW1lbnQgYXMgYSBjYWxsYmFja1xyXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicgJiYgdGhpc0FyZyAmJiB0aGlzQXJnW2NhbGxiYWNrXSA9PT0gY29sbGVjdGlvbikge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBpZiAoY2FsbGJhY2sgPT0gbnVsbCAmJiBpc0FycmF5KGNvbGxlY3Rpb24pKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XHJcbiAgICAgICAgICBpZiAodmFsdWUgPiByZXN1bHQpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrID0gKGNhbGxiYWNrID09IG51bGwgJiYgaXNTdHJpbmcoY29sbGVjdGlvbikpXHJcbiAgICAgICAgICA/IGNoYXJBdENhbGxiYWNrXHJcbiAgICAgICAgICA6IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcblxyXG4gICAgICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICB2YXIgY3VycmVudCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgICBpZiAoY3VycmVudCA+IGNvbXB1dGVkKSB7XHJcbiAgICAgICAgICAgIGNvbXB1dGVkID0gY3VycmVudDtcclxuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyB0aGUgbWluaW11bSB2YWx1ZSBvZiBhIGNvbGxlY3Rpb24uIElmIHRoZSBjb2xsZWN0aW9uIGlzIGVtcHR5IG9yXHJcbiAgICAgKiBmYWxzZXkgYEluZmluaXR5YCBpcyByZXR1cm5lZC4gSWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIGV4ZWN1dGVkXHJcbiAgICAgKiBmb3IgZWFjaCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvbiB0byBnZW5lcmF0ZSB0aGUgY3JpdGVyaW9uIGJ5IHdoaWNoIHRoZSB2YWx1ZVxyXG4gICAgICogaXMgcmFua2VkLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG8gYHRoaXNBcmdgIGFuZCBpbnZva2VkIHdpdGggdGhyZWVcclxuICAgICAqIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIG1pbmltdW0gdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ubWluKFs0LCAyLCA4LCA2XSk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5taW4oY2hhcmFjdGVycywgZnVuY3Rpb24oY2hyKSB7IHJldHVybiBjaHIuYWdlOyB9KTtcclxuICAgICAqIC8vID0+IHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH07XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLm1pbihjaGFyYWN0ZXJzLCAnYWdlJyk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9O1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBtaW4oY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGNvbXB1dGVkID0gSW5maW5pdHksXHJcbiAgICAgICAgICByZXN1bHQgPSBjb21wdXRlZDtcclxuXHJcbiAgICAgIC8vIGFsbG93cyB3b3JraW5nIHdpdGggZnVuY3Rpb25zIGxpa2UgYF8ubWFwYCB3aXRob3V0IHVzaW5nXHJcbiAgICAgIC8vIHRoZWlyIGBpbmRleGAgYXJndW1lbnQgYXMgYSBjYWxsYmFja1xyXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdmdW5jdGlvbicgJiYgdGhpc0FyZyAmJiB0aGlzQXJnW2NhbGxiYWNrXSA9PT0gY29sbGVjdGlvbikge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBpZiAoY2FsbGJhY2sgPT0gbnVsbCAmJiBpc0FycmF5KGNvbGxlY3Rpb24pKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24ubGVuZ3RoO1xyXG5cclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgdmFyIHZhbHVlID0gY29sbGVjdGlvbltpbmRleF07XHJcbiAgICAgICAgICBpZiAodmFsdWUgPCByZXN1bHQpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNhbGxiYWNrID0gKGNhbGxiYWNrID09IG51bGwgJiYgaXNTdHJpbmcoY29sbGVjdGlvbikpXHJcbiAgICAgICAgICA/IGNoYXJBdENhbGxiYWNrXHJcbiAgICAgICAgICA6IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcblxyXG4gICAgICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgICB2YXIgY3VycmVudCA9IGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgICBpZiAoY3VycmVudCA8IGNvbXB1dGVkKSB7XHJcbiAgICAgICAgICAgIGNvbXB1dGVkID0gY3VycmVudDtcclxuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyB0aGUgdmFsdWUgb2YgYSBzcGVjaWZpZWQgcHJvcGVydHkgZnJvbSBhbGwgZWxlbWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEB0eXBlIEZ1bmN0aW9uXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcGVydHkgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIHBsdWNrLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcy5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5wbHVjayhjaGFyYWN0ZXJzLCAnbmFtZScpO1xyXG4gICAgICogLy8gPT4gWydiYXJuZXknLCAnZnJlZCddXHJcbiAgICAgKi9cclxuICAgIHZhciBwbHVjayA9IG1hcDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZHVjZXMgYSBjb2xsZWN0aW9uIHRvIGEgdmFsdWUgd2hpY2ggaXMgdGhlIGFjY3VtdWxhdGVkIHJlc3VsdCBvZiBydW5uaW5nXHJcbiAgICAgKiBlYWNoIGVsZW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24gdGhyb3VnaCB0aGUgY2FsbGJhY2ssIHdoZXJlIGVhY2ggc3VjY2Vzc2l2ZVxyXG4gICAgICogY2FsbGJhY2sgZXhlY3V0aW9uIGNvbnN1bWVzIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHByZXZpb3VzIGV4ZWN1dGlvbi4gSWZcclxuICAgICAqIGBhY2N1bXVsYXRvcmAgaXMgbm90IHByb3ZpZGVkIHRoZSBmaXJzdCBlbGVtZW50IG9mIHRoZSBjb2xsZWN0aW9uIHdpbGwgYmVcclxuICAgICAqIHVzZWQgYXMgdGhlIGluaXRpYWwgYGFjY3VtdWxhdG9yYCB2YWx1ZS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxyXG4gICAgICogYW5kIGludm9rZWQgd2l0aCBmb3VyIGFyZ3VtZW50czsgKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXh8a2V5LCBjb2xsZWN0aW9uKS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGZvbGRsLCBpbmplY3RcclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZCBwZXIgaXRlcmF0aW9uLlxyXG4gICAgICogQHBhcmFtIHsqfSBbYWNjdW11bGF0b3JdIEluaXRpYWwgdmFsdWUgb2YgdGhlIGFjY3VtdWxhdG9yLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgYWNjdW11bGF0ZWQgdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBzdW0gPSBfLnJlZHVjZShbMSwgMiwgM10sIGZ1bmN0aW9uKHN1bSwgbnVtKSB7XHJcbiAgICAgKiAgIHJldHVybiBzdW0gKyBudW07XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IDZcclxuICAgICAqXHJcbiAgICAgKiB2YXIgbWFwcGVkID0gXy5yZWR1Y2UoeyAnYSc6IDEsICdiJzogMiwgJ2MnOiAzIH0sIGZ1bmN0aW9uKHJlc3VsdCwgbnVtLCBrZXkpIHtcclxuICAgICAqICAgcmVzdWx0W2tleV0gPSBudW0gKiAzO1xyXG4gICAgICogICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICogfSwge30pO1xyXG4gICAgICogLy8gPT4geyAnYSc6IDMsICdiJzogNiwgJ2MnOiA5IH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcmVkdWNlKGNvbGxlY3Rpb24sIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xyXG4gICAgICBpZiAoIWNvbGxlY3Rpb24pIHJldHVybiBhY2N1bXVsYXRvcjtcclxuICAgICAgdmFyIG5vYWNjdW0gPSBhcmd1bWVudHMubGVuZ3RoIDwgMztcclxuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDQpO1xyXG5cclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uLmxlbmd0aDtcclxuXHJcbiAgICAgIGlmICh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInKSB7XHJcbiAgICAgICAgaWYgKG5vYWNjdW0pIHtcclxuICAgICAgICAgIGFjY3VtdWxhdG9yID0gY29sbGVjdGlvblsrK2luZGV4XTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICAgIGFjY3VtdWxhdG9yID0gY2FsbGJhY2soYWNjdW11bGF0b3IsIGNvbGxlY3Rpb25baW5kZXhdLCBpbmRleCwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGZvck93bihjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcclxuICAgICAgICAgIGFjY3VtdWxhdG9yID0gbm9hY2N1bVxyXG4gICAgICAgICAgICA/IChub2FjY3VtID0gZmFsc2UsIHZhbHVlKVxyXG4gICAgICAgICAgICA6IGNhbGxiYWNrKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5yZWR1Y2VgIGV4Y2VwdCB0aGF0IGl0IGl0ZXJhdGVzIG92ZXIgZWxlbWVudHNcclxuICAgICAqIG9mIGEgYGNvbGxlY3Rpb25gIGZyb20gcmlnaHQgdG8gbGVmdC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGZvbGRyXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWQgcGVyIGl0ZXJhdGlvbi5cclxuICAgICAqIEBwYXJhbSB7Kn0gW2FjY3VtdWxhdG9yXSBJbml0aWFsIHZhbHVlIG9mIHRoZSBhY2N1bXVsYXRvci5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGFjY3VtdWxhdGVkIHZhbHVlLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgbGlzdCA9IFtbMCwgMV0sIFsyLCAzXSwgWzQsIDVdXTtcclxuICAgICAqIHZhciBmbGF0ID0gXy5yZWR1Y2VSaWdodChsaXN0LCBmdW5jdGlvbihhLCBiKSB7IHJldHVybiBhLmNvbmNhdChiKTsgfSwgW10pO1xyXG4gICAgICogLy8gPT4gWzQsIDUsIDIsIDMsIDAsIDFdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJlZHVjZVJpZ2h0KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCBhY2N1bXVsYXRvciwgdGhpc0FyZykge1xyXG4gICAgICB2YXIgbm9hY2N1bSA9IGFyZ3VtZW50cy5sZW5ndGggPCAzO1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgNCk7XHJcbiAgICAgIGZvckVhY2hSaWdodChjb2xsZWN0aW9uLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pIHtcclxuICAgICAgICBhY2N1bXVsYXRvciA9IG5vYWNjdW1cclxuICAgICAgICAgID8gKG5vYWNjdW0gPSBmYWxzZSwgdmFsdWUpXHJcbiAgICAgICAgICA6IGNhbGxiYWNrKGFjY3VtdWxhdG9yLCB2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIG9wcG9zaXRlIG9mIGBfLmZpbHRlcmAgdGhpcyBtZXRob2QgcmV0dXJucyB0aGUgZWxlbWVudHMgb2YgYVxyXG4gICAgICogY29sbGVjdGlvbiB0aGF0IHRoZSBjYWxsYmFjayBkb2VzICoqbm90KiogcmV0dXJuIHRydWV5IGZvci5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBmYWlsZWQgdGhlIGNhbGxiYWNrIGNoZWNrLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgb2RkcyA9IF8ucmVqZWN0KFsxLCAyLCAzLCA0LCA1LCA2XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiBudW0gJSAyID09IDA7IH0pO1xyXG4gICAgICogLy8gPT4gWzEsIDMsIDVdXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IHRydWUgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ucmVqZWN0KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfV1cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ucmVqZWN0KGNoYXJhY3RlcnMsIHsgJ2FnZSc6IDM2IH0pO1xyXG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnZnJlZCcsICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH1dXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJlamVjdChjb2xsZWN0aW9uLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIHJldHVybiBmaWx0ZXIoY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSB7XHJcbiAgICAgICAgcmV0dXJuICFjYWxsYmFjayh2YWx1ZSwgaW5kZXgsIGNvbGxlY3Rpb24pO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldHJpZXZlcyBhIHJhbmRvbSBlbGVtZW50IG9yIGBuYCByYW5kb20gZWxlbWVudHMgZnJvbSBhIGNvbGxlY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIHNhbXBsZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbl0gVGhlIG51bWJlciBvZiBlbGVtZW50cyB0byBzYW1wbGUuXHJcbiAgICAgKiBAcGFyYW0tIHtPYmplY3R9IFtndWFyZF0gQWxsb3dzIHdvcmtpbmcgd2l0aCBmdW5jdGlvbnMgbGlrZSBgXy5tYXBgXHJcbiAgICAgKiAgd2l0aG91dCB1c2luZyB0aGVpciBgaW5kZXhgIGFyZ3VtZW50cyBhcyBgbmAuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgdGhlIHJhbmRvbSBzYW1wbGUocykgb2YgYGNvbGxlY3Rpb25gLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLnNhbXBsZShbMSwgMiwgMywgNF0pO1xyXG4gICAgICogLy8gPT4gMlxyXG4gICAgICpcclxuICAgICAqIF8uc2FtcGxlKFsxLCAyLCAzLCA0XSwgMik7XHJcbiAgICAgKiAvLyA9PiBbMywgMV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc2FtcGxlKGNvbGxlY3Rpb24sIG4sIGd1YXJkKSB7XHJcbiAgICAgIGlmIChjb2xsZWN0aW9uICYmIHR5cGVvZiBjb2xsZWN0aW9uLmxlbmd0aCAhPSAnbnVtYmVyJykge1xyXG4gICAgICAgIGNvbGxlY3Rpb24gPSB2YWx1ZXMoY29sbGVjdGlvbik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKG4gPT0gbnVsbCB8fCBndWFyZCkge1xyXG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9uID8gY29sbGVjdGlvbltiYXNlUmFuZG9tKDAsIGNvbGxlY3Rpb24ubGVuZ3RoIC0gMSldIDogdW5kZWZpbmVkO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciByZXN1bHQgPSBzaHVmZmxlKGNvbGxlY3Rpb24pO1xyXG4gICAgICByZXN1bHQubGVuZ3RoID0gbmF0aXZlTWluKG5hdGl2ZU1heCgwLCBuKSwgcmVzdWx0Lmxlbmd0aCk7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIHNodWZmbGVkIHZhbHVlcywgdXNpbmcgYSB2ZXJzaW9uIG9mIHRoZSBGaXNoZXItWWF0ZXNcclxuICAgICAqIHNodWZmbGUuIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Zpc2hlci1ZYXRlc19zaHVmZmxlLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBzaHVmZmxlLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IHNodWZmbGVkIGNvbGxlY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uc2h1ZmZsZShbMSwgMiwgMywgNCwgNSwgNl0pO1xyXG4gICAgICogLy8gPT4gWzQsIDEsIDYsIDMsIDUsIDJdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHNodWZmbGUoY29sbGVjdGlvbikge1xyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBBcnJheSh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDogMCk7XHJcblxyXG4gICAgICBmb3JFYWNoKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyIHJhbmQgPSBiYXNlUmFuZG9tKDAsICsraW5kZXgpO1xyXG4gICAgICAgIHJlc3VsdFtpbmRleF0gPSByZXN1bHRbcmFuZF07XHJcbiAgICAgICAgcmVzdWx0W3JhbmRdID0gdmFsdWU7XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgc2l6ZSBvZiB0aGUgYGNvbGxlY3Rpb25gIGJ5IHJldHVybmluZyBgY29sbGVjdGlvbi5sZW5ndGhgIGZvciBhcnJheXNcclxuICAgICAqIGFuZCBhcnJheS1saWtlIG9iamVjdHMgb3IgdGhlIG51bWJlciBvZiBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzIGZvciBvYmplY3RzLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpbnNwZWN0LlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyBgY29sbGVjdGlvbi5sZW5ndGhgIG9yIG51bWJlciBvZiBvd24gZW51bWVyYWJsZSBwcm9wZXJ0aWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLnNpemUoWzEsIDJdKTtcclxuICAgICAqIC8vID0+IDJcclxuICAgICAqXHJcbiAgICAgKiBfLnNpemUoeyAnb25lJzogMSwgJ3R3byc6IDIsICd0aHJlZSc6IDMgfSk7XHJcbiAgICAgKiAvLyA9PiAzXHJcbiAgICAgKlxyXG4gICAgICogXy5zaXplKCdwZWJibGVzJyk7XHJcbiAgICAgKiAvLyA9PiA3XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHNpemUoY29sbGVjdGlvbikge1xyXG4gICAgICB2YXIgbGVuZ3RoID0gY29sbGVjdGlvbiA/IGNvbGxlY3Rpb24ubGVuZ3RoIDogMDtcclxuICAgICAgcmV0dXJuIHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicgPyBsZW5ndGggOiBrZXlzKGNvbGxlY3Rpb24pLmxlbmd0aDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENoZWNrcyBpZiB0aGUgY2FsbGJhY2sgcmV0dXJucyBhIHRydWV5IHZhbHVlIGZvciAqKmFueSoqIGVsZW1lbnQgb2YgYVxyXG4gICAgICogY29sbGVjdGlvbi4gVGhlIGZ1bmN0aW9uIHJldHVybnMgYXMgc29vbiBhcyBpdCBmaW5kcyBhIHBhc3NpbmcgdmFsdWUgYW5kXHJcbiAgICAgKiBkb2VzIG5vdCBpdGVyYXRlIG92ZXIgdGhlIGVudGlyZSBjb2xsZWN0aW9uLiBUaGUgY2FsbGJhY2sgaXMgYm91bmQgdG9cclxuICAgICAqIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleHxrZXksIGNvbGxlY3Rpb24pLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIGFueVxyXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gaXRlcmF0ZSBvdmVyLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8c3RyaW5nfSBbY2FsbGJhY2s9aWRlbnRpdHldIFRoZSBmdW5jdGlvbiBjYWxsZWRcclxuICAgICAqICBwZXIgaXRlcmF0aW9uLiBJZiBhIHByb3BlcnR5IG5hbWUgb3Igb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZFxyXG4gICAgICogIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIGB0cnVlYCBpZiBhbnkgZWxlbWVudCBwYXNzZWQgdGhlIGNhbGxiYWNrIGNoZWNrLFxyXG4gICAgICogIGVsc2UgYGZhbHNlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5zb21lKFtudWxsLCAwLCAneWVzJywgZmFsc2VdLCBCb29sZWFuKTtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdibG9ja2VkJzogZmFsc2UgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAsICdibG9ja2VkJzogdHJ1ZSB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5zb21lKGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiB0cnVlXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLnNvbWUoY2hhcmFjdGVycywgeyAnYWdlJzogMSB9KTtcclxuICAgICAqIC8vID0+IGZhbHNlXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHNvbWUoY29sbGVjdGlvbiwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIHJlc3VsdDtcclxuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG5cclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBjb2xsZWN0aW9uID8gY29sbGVjdGlvbi5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgaWYgKHR5cGVvZiBsZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgICAgaWYgKChyZXN1bHQgPSBjYWxsYmFjayhjb2xsZWN0aW9uW2luZGV4XSwgaW5kZXgsIGNvbGxlY3Rpb24pKSkge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yT3duKGNvbGxlY3Rpb24sIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgY29sbGVjdGlvbikge1xyXG4gICAgICAgICAgcmV0dXJuICEocmVzdWx0ID0gY2FsbGJhY2sodmFsdWUsIGluZGV4LCBjb2xsZWN0aW9uKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuICEhcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiBlbGVtZW50cywgc29ydGVkIGluIGFzY2VuZGluZyBvcmRlciBieSB0aGUgcmVzdWx0cyBvZlxyXG4gICAgICogcnVubmluZyBlYWNoIGVsZW1lbnQgaW4gYSBjb2xsZWN0aW9uIHRocm91Z2ggdGhlIGNhbGxiYWNrLiBUaGlzIG1ldGhvZFxyXG4gICAgICogcGVyZm9ybXMgYSBzdGFibGUgc29ydCwgdGhhdCBpcywgaXQgd2lsbCBwcmVzZXJ2ZSB0aGUgb3JpZ2luYWwgc29ydCBvcmRlclxyXG4gICAgICogb2YgZXF1YWwgZWxlbWVudHMuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aFxyXG4gICAgICogdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4fGtleSwgY29sbGVjdGlvbikuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gYXJyYXkgb2YgcHJvcGVydHkgbmFtZXMgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNvbGxlY3Rpb25cclxuICAgICAqIHdpbGwgYmUgc29ydGVkIGJ5IGVhY2ggcHJvcGVydHkgdmFsdWUuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQ29sbGVjdGlvbnNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl8T2JqZWN0fHN0cmluZ30gY29sbGVjdGlvbiBUaGUgY29sbGVjdGlvbiB0byBpdGVyYXRlIG92ZXIuXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fEZ1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHNvcnRlZCBlbGVtZW50cy5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5zb3J0QnkoWzEsIDIsIDNdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIE1hdGguc2luKG51bSk7IH0pO1xyXG4gICAgICogLy8gPT4gWzMsIDEsIDJdXHJcbiAgICAgKlxyXG4gICAgICogXy5zb3J0QnkoWzEsIDIsIDNdLCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIHRoaXMuc2luKG51bSk7IH0sIE1hdGgpO1xyXG4gICAgICogLy8gPT4gWzMsIDEsIDJdXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdhZ2UnOiAzNiB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICAnYWdlJzogNDAgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2FnZSc6IDI2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdhZ2UnOiAzMCB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5tYXAoXy5zb3J0QnkoY2hhcmFjdGVycywgJ2FnZScpLCBfLnZhbHVlcyk7XHJcbiAgICAgKiAvLyA9PiBbWydiYXJuZXknLCAyNl0sIFsnZnJlZCcsIDMwXSwgWydiYXJuZXknLCAzNl0sIFsnZnJlZCcsIDQwXV1cclxuICAgICAqXHJcbiAgICAgKiAvLyBzb3J0aW5nIGJ5IG11bHRpcGxlIHByb3BlcnRpZXNcclxuICAgICAqIF8ubWFwKF8uc29ydEJ5KGNoYXJhY3RlcnMsIFsnbmFtZScsICdhZ2UnXSksIF8udmFsdWVzKTtcclxuICAgICAqIC8vID0gPiBbWydiYXJuZXknLCAyNl0sIFsnYmFybmV5JywgMzZdLCBbJ2ZyZWQnLCAzMF0sIFsnZnJlZCcsIDQwXV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gc29ydEJ5KGNvbGxlY3Rpb24sIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgaXNBcnIgPSBpc0FycmF5KGNhbGxiYWNrKSxcclxuICAgICAgICAgIGxlbmd0aCA9IGNvbGxlY3Rpb24gPyBjb2xsZWN0aW9uLmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBBcnJheSh0eXBlb2YgbGVuZ3RoID09ICdudW1iZXInID8gbGVuZ3RoIDogMCk7XHJcblxyXG4gICAgICBpZiAoIWlzQXJyKSB7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG4gICAgICB9XHJcbiAgICAgIGZvckVhY2goY29sbGVjdGlvbiwgZnVuY3Rpb24odmFsdWUsIGtleSwgY29sbGVjdGlvbikge1xyXG4gICAgICAgIHZhciBvYmplY3QgPSByZXN1bHRbKytpbmRleF0gPSBnZXRPYmplY3QoKTtcclxuICAgICAgICBpZiAoaXNBcnIpIHtcclxuICAgICAgICAgIG9iamVjdC5jcml0ZXJpYSA9IG1hcChjYWxsYmFjaywgZnVuY3Rpb24oa2V5KSB7IHJldHVybiB2YWx1ZVtrZXldOyB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgKG9iamVjdC5jcml0ZXJpYSA9IGdldEFycmF5KCkpWzBdID0gY2FsbGJhY2sodmFsdWUsIGtleSwgY29sbGVjdGlvbik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIG9iamVjdC5pbmRleCA9IGluZGV4O1xyXG4gICAgICAgIG9iamVjdC52YWx1ZSA9IHZhbHVlO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGxlbmd0aCA9IHJlc3VsdC5sZW5ndGg7XHJcbiAgICAgIHJlc3VsdC5zb3J0KGNvbXBhcmVBc2NlbmRpbmcpO1xyXG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcclxuICAgICAgICB2YXIgb2JqZWN0ID0gcmVzdWx0W2xlbmd0aF07XHJcbiAgICAgICAgcmVzdWx0W2xlbmd0aF0gPSBvYmplY3QudmFsdWU7XHJcbiAgICAgICAgaWYgKCFpc0Fycikge1xyXG4gICAgICAgICAgcmVsZWFzZUFycmF5KG9iamVjdC5jcml0ZXJpYSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlbGVhc2VPYmplY3Qob2JqZWN0KTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ29udmVydHMgdGhlIGBjb2xsZWN0aW9uYCB0byBhbiBhcnJheS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IENvbGxlY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fE9iamVjdHxzdHJpbmd9IGNvbGxlY3Rpb24gVGhlIGNvbGxlY3Rpb24gdG8gY29udmVydC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyB0aGUgbmV3IGNvbnZlcnRlZCBhcnJheS5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogKGZ1bmN0aW9uKCkgeyByZXR1cm4gXy50b0FycmF5KGFyZ3VtZW50cykuc2xpY2UoMSk7IH0pKDEsIDIsIDMsIDQpO1xyXG4gICAgICogLy8gPT4gWzIsIDMsIDRdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHRvQXJyYXkoY29sbGVjdGlvbikge1xyXG4gICAgICBpZiAoY29sbGVjdGlvbiAmJiB0eXBlb2YgY29sbGVjdGlvbi5sZW5ndGggPT0gJ251bWJlcicpIHtcclxuICAgICAgICByZXR1cm4gc2xpY2UoY29sbGVjdGlvbik7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHZhbHVlcyhjb2xsZWN0aW9uKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFBlcmZvcm1zIGEgZGVlcCBjb21wYXJpc29uIG9mIGVhY2ggZWxlbWVudCBpbiBhIGBjb2xsZWN0aW9uYCB0byB0aGUgZ2l2ZW5cclxuICAgICAqIGBwcm9wZXJ0aWVzYCBvYmplY3QsIHJldHVybmluZyBhbiBhcnJheSBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIGVxdWl2YWxlbnRcclxuICAgICAqIHByb3BlcnR5IHZhbHVlcy5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQHR5cGUgRnVuY3Rpb25cclxuICAgICAqIEBjYXRlZ29yeSBDb2xsZWN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtBcnJheXxPYmplY3R8c3RyaW5nfSBjb2xsZWN0aW9uIFRoZSBjb2xsZWN0aW9uIHRvIGl0ZXJhdGUgb3Zlci5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcyBUaGUgb2JqZWN0IG9mIHByb3BlcnR5IHZhbHVlcyB0byBmaWx0ZXIgYnkuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBnaXZlbiBwcm9wZXJ0aWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdwZXRzJzogWydob3BweSddIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwLCAncGV0cyc6IFsnYmFieSBwdXNzJywgJ2Rpbm8nXSB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIF8ud2hlcmUoY2hhcmFjdGVycywgeyAnYWdlJzogMzYgfSk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYsICdwZXRzJzogWydob3BweSddIH1dXHJcbiAgICAgKlxyXG4gICAgICogXy53aGVyZShjaGFyYWN0ZXJzLCB7ICdwZXRzJzogWydkaW5vJ10gfSk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwLCAncGV0cyc6IFsnYmFieSBwdXNzJywgJ2Rpbm8nXSB9XVxyXG4gICAgICovXHJcbiAgICB2YXIgd2hlcmUgPSBmaWx0ZXI7XHJcblxyXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IHdpdGggYWxsIGZhbHNleSB2YWx1ZXMgcmVtb3ZlZC4gVGhlIHZhbHVlcyBgZmFsc2VgLCBgbnVsbGAsXHJcbiAgICAgKiBgMGAsIGBcIlwiYCwgYHVuZGVmaW5lZGAsIGFuZCBgTmFOYCBhcmUgYWxsIGZhbHNleS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIGNvbXBhY3QuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZmlsdGVyZWQgdmFsdWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmNvbXBhY3QoWzAsIDEsIGZhbHNlLCAyLCAnJywgM10pO1xyXG4gICAgICogLy8gPT4gWzEsIDIsIDNdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNvbXBhY3QoYXJyYXkpIHtcclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gYXJyYXlbaW5kZXhdO1xyXG4gICAgICAgIGlmICh2YWx1ZSkge1xyXG4gICAgICAgICAgcmVzdWx0LnB1c2godmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBleGNsdWRpbmcgYWxsIHZhbHVlcyBvZiB0aGUgcHJvdmlkZWQgYXJyYXlzIHVzaW5nIHN0cmljdFxyXG4gICAgICogZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cclxuICAgICAqIEBwYXJhbSB7Li4uQXJyYXl9IFt2YWx1ZXNdIFRoZSBhcnJheXMgb2YgdmFsdWVzIHRvIGV4Y2x1ZGUuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgYXJyYXkgb2YgZmlsdGVyZWQgdmFsdWVzLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmRpZmZlcmVuY2UoWzEsIDIsIDMsIDQsIDVdLCBbNSwgMiwgMTBdKTtcclxuICAgICAqIC8vID0+IFsxLCAzLCA0XVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBkaWZmZXJlbmNlKGFycmF5KSB7XHJcbiAgICAgIHJldHVybiBiYXNlRGlmZmVyZW5jZShhcnJheSwgYmFzZUZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlLCB0cnVlLCAxKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRgIGV4Y2VwdCB0aGF0IGl0IHJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBmaXJzdFxyXG4gICAgICogZWxlbWVudCB0aGF0IHBhc3NlcyB0aGUgY2FsbGJhY2sgY2hlY2ssIGluc3RlYWQgb2YgdGhlIGVsZW1lbnQgaXRzZWxmLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgLTFgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IGZhbHNlIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdhZ2UnOiA0MCwgJ2Jsb2NrZWQnOiB0cnVlIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxLCAgJ2Jsb2NrZWQnOiBmYWxzZSB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIF8uZmluZEluZGV4KGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGNocikge1xyXG4gICAgICogICByZXR1cm4gY2hyLmFnZSA8IDIwO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmRJbmRleChjaGFyYWN0ZXJzLCB7ICdhZ2UnOiAzNiB9KTtcclxuICAgICAqIC8vID0+IDBcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uZmluZEluZGV4KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiAxXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGZpbmRJbmRleChhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkge1xyXG4gICAgICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIG1ldGhvZCBpcyBsaWtlIGBfLmZpbmRJbmRleGAgZXhjZXB0IHRoYXQgaXQgaXRlcmF0ZXMgb3ZlciBlbGVtZW50c1xyXG4gICAgICogb2YgYSBgY29sbGVjdGlvbmAgZnJvbSByaWdodCB0byBsZWZ0LlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIHRoZSBpbmRleCBvZiB0aGUgZm91bmQgZWxlbWVudCwgZWxzZSBgLTFgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2FnZSc6IDM2LCAnYmxvY2tlZCc6IHRydWUgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2FnZSc6IDQwLCAnYmxvY2tlZCc6IGZhbHNlIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxLCAgJ2Jsb2NrZWQnOiB0cnVlIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogXy5maW5kTGFzdEluZGV4KGNoYXJhY3RlcnMsIGZ1bmN0aW9uKGNocikge1xyXG4gICAgICogICByZXR1cm4gY2hyLmFnZSA+IDMwO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiAxXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLndoZXJlXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmRMYXN0SW5kZXgoY2hhcmFjdGVycywgeyAnYWdlJzogMzYgfSk7XHJcbiAgICAgKiAvLyA9PiAwXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpbmRMYXN0SW5kZXgoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKTtcclxuICAgICAqIC8vID0+IDJcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZmluZExhc3RJbmRleChhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcclxuICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG4gICAgICB3aGlsZSAobGVuZ3RoLS0pIHtcclxuICAgICAgICBpZiAoY2FsbGJhY2soYXJyYXlbbGVuZ3RoXSwgbGVuZ3RoLCBhcnJheSkpIHtcclxuICAgICAgICAgIHJldHVybiBsZW5ndGg7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiAtMTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIGZpcnN0IGVsZW1lbnQgb3IgZmlyc3QgYG5gIGVsZW1lbnRzIG9mIGFuIGFycmF5LiBJZiBhIGNhbGxiYWNrXHJcbiAgICAgKiBpcyBwcm92aWRlZCBlbGVtZW50cyBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBhcnJheSBhcmUgcmV0dXJuZWQgYXMgbG9uZ1xyXG4gICAgICogYXMgdGhlIGNhbGxiYWNrIHJldHVybnMgdHJ1ZXkuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kXHJcbiAgICAgKiBpbnZva2VkIHdpdGggdGhyZWUgYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAYWxpYXMgaGVhZCwgdGFrZVxyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8bnVtYmVyfHN0cmluZ30gW2NhbGxiYWNrXSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGVsZW1lbnQgb3IgdGhlIG51bWJlciBvZiBlbGVtZW50cyB0byByZXR1cm4uIElmIGEgcHJvcGVydHkgbmFtZSBvclxyXG4gICAgICogIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCJcclxuICAgICAqICBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgZmlyc3QgZWxlbWVudChzKSBvZiBgYXJyYXlgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmZpcnN0KFsxLCAyLCAzXSk7XHJcbiAgICAgKiAvLyA9PiAxXHJcbiAgICAgKlxyXG4gICAgICogXy5maXJzdChbMSwgMiwgM10sIDIpO1xyXG4gICAgICogLy8gPT4gWzEsIDJdXHJcbiAgICAgKlxyXG4gICAgICogXy5maXJzdChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkge1xyXG4gICAgICogICByZXR1cm4gbnVtIDwgMztcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gWzEsIDJdXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdibG9ja2VkJzogdHJ1ZSwgICdlbXBsb3llcic6ICdzbGF0ZScgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2Jsb2NrZWQnOiBmYWxzZSwgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYmxvY2tlZCc6IHRydWUsICAnZW1wbG95ZXInOiAnbmEnIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZpcnN0KGNoYXJhY3RlcnMsICdibG9ja2VkJyk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYmxvY2tlZCc6IHRydWUsICdlbXBsb3llcic6ICdzbGF0ZScgfV1cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ucGx1Y2soXy5maXJzdChjaGFyYWN0ZXJzLCB7ICdlbXBsb3llcic6ICdzbGF0ZScgfSksICduYW1lJyk7XHJcbiAgICAgKiAvLyA9PiBbJ2Jhcm5leScsICdmcmVkJ11cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZmlyc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIHZhciBuID0gMCxcclxuICAgICAgICAgIGxlbmd0aCA9IGFycmF5ID8gYXJyYXkubGVuZ3RoIDogMDtcclxuXHJcbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ251bWJlcicgJiYgY2FsbGJhY2sgIT0gbnVsbCkge1xyXG4gICAgICAgIHZhciBpbmRleCA9IC0xO1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCAmJiBjYWxsYmFjayhhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSkpIHtcclxuICAgICAgICAgIG4rKztcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbiA9IGNhbGxiYWNrO1xyXG4gICAgICAgIGlmIChuID09IG51bGwgfHwgdGhpc0FyZykge1xyXG4gICAgICAgICAgcmV0dXJuIGFycmF5ID8gYXJyYXlbMF0gOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBzbGljZShhcnJheSwgMCwgbmF0aXZlTWluKG5hdGl2ZU1heCgwLCBuKSwgbGVuZ3RoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGbGF0dGVucyBhIG5lc3RlZCBhcnJheSAodGhlIG5lc3RpbmcgY2FuIGJlIHRvIGFueSBkZXB0aCkuIElmIGBpc1NoYWxsb3dgXHJcbiAgICAgKiBpcyB0cnVleSwgdGhlIGFycmF5IHdpbGwgb25seSBiZSBmbGF0dGVuZWQgYSBzaW5nbGUgbGV2ZWwuIElmIGEgY2FsbGJhY2tcclxuICAgICAqIGlzIHByb3ZpZGVkIGVhY2ggZWxlbWVudCBvZiB0aGUgYXJyYXkgaXMgcGFzc2VkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGJlZm9yZVxyXG4gICAgICogZmxhdHRlbmluZy4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlXHJcbiAgICAgKiBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBmbGF0dGVuLlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaXNTaGFsbG93PWZhbHNlXSBBIGZsYWcgdG8gcmVzdHJpY3QgZmxhdHRlbmluZyB0byBhIHNpbmdsZSBsZXZlbC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBuZXcgZmxhdHRlbmVkIGFycmF5LlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmZsYXR0ZW4oWzEsIFsyXSwgWzMsIFtbNF1dXV0pO1xyXG4gICAgICogLy8gPT4gWzEsIDIsIDMsIDRdO1xyXG4gICAgICpcclxuICAgICAqIF8uZmxhdHRlbihbMSwgWzJdLCBbMywgW1s0XV1dXSwgdHJ1ZSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMiwgMywgW1s0XV1dO1xyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzMCwgJ3BldHMnOiBbJ2hvcHB5J10gfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAsICdwZXRzJzogWydiYWJ5IHB1c3MnLCAnZGlubyddIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLmZsYXR0ZW4oY2hhcmFjdGVycywgJ3BldHMnKTtcclxuICAgICAqIC8vID0+IFsnaG9wcHknLCAnYmFieSBwdXNzJywgJ2Rpbm8nXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBmbGF0dGVuKGFycmF5LCBpc1NoYWxsb3csIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIC8vIGp1Z2dsZSBhcmd1bWVudHNcclxuICAgICAgaWYgKHR5cGVvZiBpc1NoYWxsb3cgIT0gJ2Jvb2xlYW4nICYmIGlzU2hhbGxvdyAhPSBudWxsKSB7XHJcbiAgICAgICAgdGhpc0FyZyA9IGNhbGxiYWNrO1xyXG4gICAgICAgIGNhbGxiYWNrID0gKHR5cGVvZiBpc1NoYWxsb3cgIT0gJ2Z1bmN0aW9uJyAmJiB0aGlzQXJnICYmIHRoaXNBcmdbaXNTaGFsbG93XSA9PT0gYXJyYXkpID8gbnVsbCA6IGlzU2hhbGxvdztcclxuICAgICAgICBpc1NoYWxsb3cgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoY2FsbGJhY2sgIT0gbnVsbCkge1xyXG4gICAgICAgIGFycmF5ID0gbWFwKGFycmF5LCBjYWxsYmFjaywgdGhpc0FyZyk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJhc2VGbGF0dGVuKGFycmF5LCBpc1NoYWxsb3cpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0cyB0aGUgaW5kZXggYXQgd2hpY2ggdGhlIGZpcnN0IG9jY3VycmVuY2Ugb2YgYHZhbHVlYCBpcyBmb3VuZCB1c2luZ1xyXG4gICAgICogc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgdGhlIGFycmF5IGlzIGFscmVhZHkgc29ydGVkXHJcbiAgICAgKiBwcm92aWRpbmcgYHRydWVgIGZvciBgZnJvbUluZGV4YCB3aWxsIHJ1biBhIGZhc3RlciBiaW5hcnkgc2VhcmNoLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gc2VhcmNoLlxyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gc2VhcmNoIGZvci5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbnxudW1iZXJ9IFtmcm9tSW5kZXg9MF0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tIG9yIGB0cnVlYFxyXG4gICAgICogIHRvIHBlcmZvcm0gYSBiaW5hcnkgc2VhcmNoIG9uIGEgc29ydGVkIGFycmF5LlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIG1hdGNoZWQgdmFsdWUgb3IgYC0xYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pbmRleE9mKFsxLCAyLCAzLCAxLCAyLCAzXSwgMik7XHJcbiAgICAgKiAvLyA9PiAxXHJcbiAgICAgKlxyXG4gICAgICogXy5pbmRleE9mKFsxLCAyLCAzLCAxLCAyLCAzXSwgMiwgMyk7XHJcbiAgICAgKiAvLyA9PiA0XHJcbiAgICAgKlxyXG4gICAgICogXy5pbmRleE9mKFsxLCAxLCAyLCAyLCAzLCAzXSwgMiwgdHJ1ZSk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpIHtcclxuICAgICAgaWYgKHR5cGVvZiBmcm9tSW5kZXggPT0gJ251bWJlcicpIHtcclxuICAgICAgICB2YXIgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xyXG4gICAgICAgIGZyb21JbmRleCA9IChmcm9tSW5kZXggPCAwID8gbmF0aXZlTWF4KDAsIGxlbmd0aCArIGZyb21JbmRleCkgOiBmcm9tSW5kZXggfHwgMCk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZnJvbUluZGV4KSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gc29ydGVkSW5kZXgoYXJyYXksIHZhbHVlKTtcclxuICAgICAgICByZXR1cm4gYXJyYXlbaW5kZXhdID09PSB2YWx1ZSA/IGluZGV4IDogLTE7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJhc2VJbmRleE9mKGFycmF5LCB2YWx1ZSwgZnJvbUluZGV4KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgYWxsIGJ1dCB0aGUgbGFzdCBlbGVtZW50IG9yIGxhc3QgYG5gIGVsZW1lbnRzIG9mIGFuIGFycmF5LiBJZiBhXHJcbiAgICAgKiBjYWxsYmFjayBpcyBwcm92aWRlZCBlbGVtZW50cyBhdCB0aGUgZW5kIG9mIHRoZSBhcnJheSBhcmUgZXhjbHVkZWQgZnJvbVxyXG4gICAgICogdGhlIHJlc3VsdCBhcyBsb25nIGFzIHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5LiBUaGUgY2FsbGJhY2sgaXMgYm91bmRcclxuICAgICAqIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIHRocmVlIGFyZ3VtZW50czsgKHZhbHVlLCBpbmRleCwgYXJyYXkpLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHF1ZXJ5LlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbnxPYmplY3R8bnVtYmVyfHN0cmluZ30gW2NhbGxiYWNrPTFdIFRoZSBmdW5jdGlvbiBjYWxsZWRcclxuICAgICAqICBwZXIgZWxlbWVudCBvciB0aGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIGV4Y2x1ZGUuIElmIGEgcHJvcGVydHkgbmFtZSBvclxyXG4gICAgICogIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWQgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCJcclxuICAgICAqICBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBzbGljZSBvZiBgYXJyYXlgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmluaXRpYWwoWzEsIDIsIDNdKTtcclxuICAgICAqIC8vID0+IFsxLCAyXVxyXG4gICAgICpcclxuICAgICAqIF8uaW5pdGlhbChbMSwgMiwgM10sIDIpO1xyXG4gICAgICogLy8gPT4gWzFdXHJcbiAgICAgKlxyXG4gICAgICogXy5pbml0aWFsKFsxLCAyLCAzXSwgZnVuY3Rpb24obnVtKSB7XHJcbiAgICAgKiAgIHJldHVybiBudW0gPiAxO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiBbMV1cclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAgJ2Jsb2NrZWQnOiBmYWxzZSwgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICAnYmxvY2tlZCc6IHRydWUsICAnZW1wbG95ZXInOiAnc2xhdGUnIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdibG9ja2VkJzogdHJ1ZSwgICdlbXBsb3llcic6ICduYScgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8uaW5pdGlhbChjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpO1xyXG4gICAgICogLy8gPT4gW3sgJ25hbWUnOiAnYmFybmV5JywgICdibG9ja2VkJzogZmFsc2UsICdlbXBsb3llcic6ICdzbGF0ZScgfV1cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ucGx1Y2soXy5pbml0aWFsKGNoYXJhY3RlcnMsIHsgJ2VtcGxveWVyJzogJ25hJyB9KSwgJ25hbWUnKTtcclxuICAgICAqIC8vID0+IFsnYmFybmV5JywgJ2ZyZWQnXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBpbml0aWFsKGFycmF5LCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICB2YXIgbiA9IDAsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICBpZiAodHlwZW9mIGNhbGxiYWNrICE9ICdudW1iZXInICYmIGNhbGxiYWNrICE9IG51bGwpIHtcclxuICAgICAgICB2YXIgaW5kZXggPSBsZW5ndGg7XHJcbiAgICAgICAgY2FsbGJhY2sgPSBsb2Rhc2guY3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDMpO1xyXG4gICAgICAgIHdoaWxlIChpbmRleC0tICYmIGNhbGxiYWNrKGFycmF5W2luZGV4XSwgaW5kZXgsIGFycmF5KSkge1xyXG4gICAgICAgICAgbisrO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBuID0gKGNhbGxiYWNrID09IG51bGwgfHwgdGhpc0FyZykgPyAxIDogY2FsbGJhY2sgfHwgbjtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gc2xpY2UoYXJyYXksIDAsIG5hdGl2ZU1pbihuYXRpdmVNYXgoMCwgbGVuZ3RoIC0gbiksIGxlbmd0aCkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiB1bmlxdWUgdmFsdWVzIHByZXNlbnQgaW4gYWxsIHByb3ZpZGVkIGFycmF5cyB1c2luZ1xyXG4gICAgICogc3RyaWN0IGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHsuLi5BcnJheX0gW2FycmF5XSBUaGUgYXJyYXlzIHRvIGluc3BlY3QuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYW4gYXJyYXkgb2Ygc2hhcmVkIHZhbHVlcy5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5pbnRlcnNlY3Rpb24oWzEsIDIsIDNdLCBbNSwgMiwgMSwgNF0sIFsyLCAxXSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMl1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaW50ZXJzZWN0aW9uKCkge1xyXG4gICAgICB2YXIgYXJncyA9IFtdLFxyXG4gICAgICAgICAgYXJnc0luZGV4ID0gLTEsXHJcbiAgICAgICAgICBhcmdzTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCxcclxuICAgICAgICAgIGNhY2hlcyA9IGdldEFycmF5KCksXHJcbiAgICAgICAgICBpbmRleE9mID0gZ2V0SW5kZXhPZigpLFxyXG4gICAgICAgICAgdHJ1c3RJbmRleE9mID0gaW5kZXhPZiA9PT0gYmFzZUluZGV4T2YsXHJcbiAgICAgICAgICBzZWVuID0gZ2V0QXJyYXkoKTtcclxuXHJcbiAgICAgIHdoaWxlICgrK2FyZ3NJbmRleCA8IGFyZ3NMZW5ndGgpIHtcclxuICAgICAgICB2YXIgdmFsdWUgPSBhcmd1bWVudHNbYXJnc0luZGV4XTtcclxuICAgICAgICBpZiAoaXNBcnJheSh2YWx1ZSkgfHwgaXNBcmd1bWVudHModmFsdWUpKSB7XHJcbiAgICAgICAgICBhcmdzLnB1c2godmFsdWUpO1xyXG4gICAgICAgICAgY2FjaGVzLnB1c2godHJ1c3RJbmRleE9mICYmIHZhbHVlLmxlbmd0aCA+PSBsYXJnZUFycmF5U2l6ZSAmJlxyXG4gICAgICAgICAgICBjcmVhdGVDYWNoZShhcmdzSW5kZXggPyBhcmdzW2FyZ3NJbmRleF0gOiBzZWVuKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHZhciBhcnJheSA9IGFyZ3NbMF0sXHJcbiAgICAgICAgICBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwLFxyXG4gICAgICAgICAgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICBvdXRlcjpcclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIgY2FjaGUgPSBjYWNoZXNbMF07XHJcbiAgICAgICAgdmFsdWUgPSBhcnJheVtpbmRleF07XHJcblxyXG4gICAgICAgIGlmICgoY2FjaGUgPyBjYWNoZUluZGV4T2YoY2FjaGUsIHZhbHVlKSA6IGluZGV4T2Yoc2VlbiwgdmFsdWUpKSA8IDApIHtcclxuICAgICAgICAgIGFyZ3NJbmRleCA9IGFyZ3NMZW5ndGg7XHJcbiAgICAgICAgICAoY2FjaGUgfHwgc2VlbikucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICB3aGlsZSAoLS1hcmdzSW5kZXgpIHtcclxuICAgICAgICAgICAgY2FjaGUgPSBjYWNoZXNbYXJnc0luZGV4XTtcclxuICAgICAgICAgICAgaWYgKChjYWNoZSA/IGNhY2hlSW5kZXhPZihjYWNoZSwgdmFsdWUpIDogaW5kZXhPZihhcmdzW2FyZ3NJbmRleF0sIHZhbHVlKSkgPCAwKSB7XHJcbiAgICAgICAgICAgICAgY29udGludWUgb3V0ZXI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJlc3VsdC5wdXNoKHZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgd2hpbGUgKGFyZ3NMZW5ndGgtLSkge1xyXG4gICAgICAgIGNhY2hlID0gY2FjaGVzW2FyZ3NMZW5ndGhdO1xyXG4gICAgICAgIGlmIChjYWNoZSkge1xyXG4gICAgICAgICAgcmVsZWFzZU9iamVjdChjYWNoZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJlbGVhc2VBcnJheShjYWNoZXMpO1xyXG4gICAgICByZWxlYXNlQXJyYXkoc2Vlbik7XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSBsYXN0IGVsZW1lbnQgb3IgbGFzdCBgbmAgZWxlbWVudHMgb2YgYW4gYXJyYXkuIElmIGEgY2FsbGJhY2sgaXNcclxuICAgICAqIHByb3ZpZGVkIGVsZW1lbnRzIGF0IHRoZSBlbmQgb2YgdGhlIGFycmF5IGFyZSByZXR1cm5lZCBhcyBsb25nIGFzIHRoZVxyXG4gICAgICogY2FsbGJhY2sgcmV0dXJucyB0cnVleS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxyXG4gICAgICogd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBxdWVyeS5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fG51bWJlcnxzdHJpbmd9IFtjYWxsYmFja10gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBlbGVtZW50IG9yIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gcmV0dXJuLiBJZiBhIHByb3BlcnR5IG5hbWUgb3JcclxuICAgICAqICBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvIGNyZWF0ZSBhIFwiXy5wbHVja1wiIG9yIFwiXy53aGVyZVwiXHJcbiAgICAgKiAgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIGxhc3QgZWxlbWVudChzKSBvZiBgYXJyYXlgLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmxhc3QoWzEsIDIsIDNdKTtcclxuICAgICAqIC8vID0+IDNcclxuICAgICAqXHJcbiAgICAgKiBfLmxhc3QoWzEsIDIsIDNdLCAyKTtcclxuICAgICAqIC8vID0+IFsyLCAzXVxyXG4gICAgICpcclxuICAgICAqIF8ubGFzdChbMSwgMiwgM10sIGZ1bmN0aW9uKG51bSkge1xyXG4gICAgICogICByZXR1cm4gbnVtID4gMTtcclxuICAgICAqIH0pO1xyXG4gICAgICogLy8gPT4gWzIsIDNdXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgICdibG9ja2VkJzogZmFsc2UsICdlbXBsb3llcic6ICdzbGF0ZScgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2Jsb2NrZWQnOiB0cnVlLCAgJ2VtcGxveWVyJzogJ3NsYXRlJyB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYmxvY2tlZCc6IHRydWUsICAnZW1wbG95ZXInOiAnbmEnIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLnBsdWNrKF8ubGFzdChjaGFyYWN0ZXJzLCAnYmxvY2tlZCcpLCAnbmFtZScpO1xyXG4gICAgICogLy8gPT4gWydmcmVkJywgJ3BlYmJsZXMnXVxyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy53aGVyZVwiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5sYXN0KGNoYXJhY3RlcnMsIHsgJ2VtcGxveWVyJzogJ25hJyB9KTtcclxuICAgICAqIC8vID0+IFt7ICduYW1lJzogJ3BlYmJsZXMnLCAnYmxvY2tlZCc6IHRydWUsICdlbXBsb3llcic6ICduYScgfV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbGFzdChhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIG4gPSAwLFxyXG4gICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgaWYgKHR5cGVvZiBjYWxsYmFjayAhPSAnbnVtYmVyJyAmJiBjYWxsYmFjayAhPSBudWxsKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gbGVuZ3RoO1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgICB3aGlsZSAoaW5kZXgtLSAmJiBjYWxsYmFjayhhcnJheVtpbmRleF0sIGluZGV4LCBhcnJheSkpIHtcclxuICAgICAgICAgIG4rKztcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgbiA9IGNhbGxiYWNrO1xyXG4gICAgICAgIGlmIChuID09IG51bGwgfHwgdGhpc0FyZykge1xyXG4gICAgICAgICAgcmV0dXJuIGFycmF5ID8gYXJyYXlbbGVuZ3RoIC0gMV0gOiB1bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBzbGljZShhcnJheSwgbmF0aXZlTWF4KDAsIGxlbmd0aCAtIG4pKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldHMgdGhlIGluZGV4IGF0IHdoaWNoIHRoZSBsYXN0IG9jY3VycmVuY2Ugb2YgYHZhbHVlYCBpcyBmb3VuZCB1c2luZyBzdHJpY3RcclxuICAgICAqIGVxdWFsaXR5IGZvciBjb21wYXJpc29ucywgaS5lLiBgPT09YC4gSWYgYGZyb21JbmRleGAgaXMgbmVnYXRpdmUsIGl0IGlzIHVzZWRcclxuICAgICAqIGFzIHRoZSBvZmZzZXQgZnJvbSB0aGUgZW5kIG9mIHRoZSBjb2xsZWN0aW9uLlxyXG4gICAgICpcclxuICAgICAqIElmIGEgcHJvcGVydHkgbmFtZSBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ucGx1Y2tcIiBzdHlsZVxyXG4gICAgICogY2FsbGJhY2sgd2lsbCByZXR1cm4gdGhlIHByb3BlcnR5IHZhbHVlIG9mIHRoZSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICpcclxuICAgICAqIElmIGFuIG9iamVjdCBpcyBwcm92aWRlZCBmb3IgYGNhbGxiYWNrYCB0aGUgY3JlYXRlZCBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFja1xyXG4gICAgICogd2lsbCByZXR1cm4gYHRydWVgIGZvciBlbGVtZW50cyB0aGF0IGhhdmUgdGhlIHByb3BlcnRpZXMgb2YgdGhlIGdpdmVuIG9iamVjdCxcclxuICAgICAqIGVsc2UgYGZhbHNlYC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gYXJyYXkgVGhlIGFycmF5IHRvIHNlYXJjaC5cclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHNlYXJjaCBmb3IuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW2Zyb21JbmRleD1hcnJheS5sZW5ndGgtMV0gVGhlIGluZGV4IHRvIHNlYXJjaCBmcm9tLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIG1hdGNoZWQgdmFsdWUgb3IgYC0xYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5sYXN0SW5kZXhPZihbMSwgMiwgMywgMSwgMiwgM10sIDIpO1xyXG4gICAgICogLy8gPT4gNFxyXG4gICAgICpcclxuICAgICAqIF8ubGFzdEluZGV4T2YoWzEsIDIsIDMsIDEsIDIsIDNdLCAyLCAzKTtcclxuICAgICAqIC8vID0+IDFcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbGFzdEluZGV4T2YoYXJyYXksIHZhbHVlLCBmcm9tSW5kZXgpIHtcclxuICAgICAgdmFyIGluZGV4ID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xyXG4gICAgICBpZiAodHlwZW9mIGZyb21JbmRleCA9PSAnbnVtYmVyJykge1xyXG4gICAgICAgIGluZGV4ID0gKGZyb21JbmRleCA8IDAgPyBuYXRpdmVNYXgoMCwgaW5kZXggKyBmcm9tSW5kZXgpIDogbmF0aXZlTWluKGZyb21JbmRleCwgaW5kZXggLSAxKSkgKyAxO1xyXG4gICAgICB9XHJcbiAgICAgIHdoaWxlIChpbmRleC0tKSB7XHJcbiAgICAgICAgaWYgKGFycmF5W2luZGV4XSA9PT0gdmFsdWUpIHtcclxuICAgICAgICAgIHJldHVybiBpbmRleDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIC0xO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlcyBhbGwgcHJvdmlkZWQgdmFsdWVzIGZyb20gdGhlIGdpdmVuIGFycmF5IHVzaW5nIHN0cmljdCBlcXVhbGl0eSBmb3JcclxuICAgICAqIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gbW9kaWZ5LlxyXG4gICAgICogQHBhcmFtIHsuLi4qfSBbdmFsdWVdIFRoZSB2YWx1ZXMgdG8gcmVtb3ZlLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGBhcnJheWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBhcnJheSA9IFsxLCAyLCAzLCAxLCAyLCAzXTtcclxuICAgICAqIF8ucHVsbChhcnJheSwgMiwgMyk7XHJcbiAgICAgKiBjb25zb2xlLmxvZyhhcnJheSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcHVsbChhcnJheSkge1xyXG4gICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cyxcclxuICAgICAgICAgIGFyZ3NJbmRleCA9IDAsXHJcbiAgICAgICAgICBhcmdzTGVuZ3RoID0gYXJncy5sZW5ndGgsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDA7XHJcblxyXG4gICAgICB3aGlsZSAoKythcmdzSW5kZXggPCBhcmdzTGVuZ3RoKSB7XHJcbiAgICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICAgIHZhbHVlID0gYXJnc1thcmdzSW5kZXhdO1xyXG4gICAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgICBpZiAoYXJyYXlbaW5kZXhdID09PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICBzcGxpY2UuY2FsbChhcnJheSwgaW5kZXgtLSwgMSk7XHJcbiAgICAgICAgICAgIGxlbmd0aC0tO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gYXJyYXk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIG51bWJlcnMgKHBvc2l0aXZlIGFuZC9vciBuZWdhdGl2ZSkgcHJvZ3Jlc3NpbmcgZnJvbVxyXG4gICAgICogYHN0YXJ0YCB1cCB0byBidXQgbm90IGluY2x1ZGluZyBgZW5kYC4gSWYgYHN0YXJ0YCBpcyBsZXNzIHRoYW4gYHN0b3BgIGFcclxuICAgICAqIHplcm8tbGVuZ3RoIHJhbmdlIGlzIGNyZWF0ZWQgdW5sZXNzIGEgbmVnYXRpdmUgYHN0ZXBgIGlzIHNwZWNpZmllZC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEFycmF5c1xyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtzdGFydD0wXSBUaGUgc3RhcnQgb2YgdGhlIHJhbmdlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGVuZCBUaGUgZW5kIG9mIHRoZSByYW5nZS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbc3RlcD0xXSBUaGUgdmFsdWUgdG8gaW5jcmVtZW50IG9yIGRlY3JlbWVudCBieS5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyByYW5nZSBhcnJheS5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5yYW5nZSg0KTtcclxuICAgICAqIC8vID0+IFswLCAxLCAyLCAzXVxyXG4gICAgICpcclxuICAgICAqIF8ucmFuZ2UoMSwgNSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMiwgMywgNF1cclxuICAgICAqXHJcbiAgICAgKiBfLnJhbmdlKDAsIDIwLCA1KTtcclxuICAgICAqIC8vID0+IFswLCA1LCAxMCwgMTVdXHJcbiAgICAgKlxyXG4gICAgICogXy5yYW5nZSgwLCAtNCwgLTEpO1xyXG4gICAgICogLy8gPT4gWzAsIC0xLCAtMiwgLTNdXHJcbiAgICAgKlxyXG4gICAgICogXy5yYW5nZSgxLCA0LCAwKTtcclxuICAgICAqIC8vID0+IFsxLCAxLCAxXVxyXG4gICAgICpcclxuICAgICAqIF8ucmFuZ2UoMCk7XHJcbiAgICAgKiAvLyA9PiBbXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByYW5nZShzdGFydCwgZW5kLCBzdGVwKSB7XHJcbiAgICAgIHN0YXJ0ID0gK3N0YXJ0IHx8IDA7XHJcbiAgICAgIHN0ZXAgPSB0eXBlb2Ygc3RlcCA9PSAnbnVtYmVyJyA/IHN0ZXAgOiAoK3N0ZXAgfHwgMSk7XHJcblxyXG4gICAgICBpZiAoZW5kID09IG51bGwpIHtcclxuICAgICAgICBlbmQgPSBzdGFydDtcclxuICAgICAgICBzdGFydCA9IDA7XHJcbiAgICAgIH1cclxuICAgICAgLy8gdXNlIGBBcnJheShsZW5ndGgpYCBzbyBlbmdpbmVzIGxpa2UgQ2hha3JhIGFuZCBWOCBhdm9pZCBzbG93ZXIgbW9kZXNcclxuICAgICAgLy8gaHR0cDovL3lvdXR1LmJlL1hBcUlwR1U4WlprI3Q9MTdtMjVzXHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgbGVuZ3RoID0gbmF0aXZlTWF4KDAsIGNlaWwoKGVuZCAtIHN0YXJ0KSAvIChzdGVwIHx8IDEpKSksXHJcbiAgICAgICAgICByZXN1bHQgPSBBcnJheShsZW5ndGgpO1xyXG5cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICByZXN1bHRbaW5kZXhdID0gc3RhcnQ7XHJcbiAgICAgICAgc3RhcnQgKz0gc3RlcDtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVtb3ZlcyBhbGwgZWxlbWVudHMgZnJvbSBhbiBhcnJheSB0aGF0IHRoZSBjYWxsYmFjayByZXR1cm5zIHRydWV5IGZvclxyXG4gICAgICogYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgcmVtb3ZlZCBlbGVtZW50cy4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYFxyXG4gICAgICogYW5kIGludm9rZWQgd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBtb2RpZnkuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIHJlbW92ZWQgZWxlbWVudHMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBhcnJheSA9IFsxLCAyLCAzLCA0LCA1LCA2XTtcclxuICAgICAqIHZhciBldmVucyA9IF8ucmVtb3ZlKGFycmF5LCBmdW5jdGlvbihudW0pIHsgcmV0dXJuIG51bSAlIDIgPT0gMDsgfSk7XHJcbiAgICAgKlxyXG4gICAgICogY29uc29sZS5sb2coYXJyYXkpO1xyXG4gICAgICogLy8gPT4gWzEsIDMsIDVdXHJcbiAgICAgKlxyXG4gICAgICogY29uc29sZS5sb2coZXZlbnMpO1xyXG4gICAgICogLy8gPT4gWzIsIDQsIDZdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJlbW92ZShhcnJheSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcnJheSA/IGFycmF5Lmxlbmd0aCA6IDAsXHJcbiAgICAgICAgICByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIgdmFsdWUgPSBhcnJheVtpbmRleF07XHJcbiAgICAgICAgaWYgKGNhbGxiYWNrKHZhbHVlLCBpbmRleCwgYXJyYXkpKSB7XHJcbiAgICAgICAgICByZXN1bHQucHVzaCh2YWx1ZSk7XHJcbiAgICAgICAgICBzcGxpY2UuY2FsbChhcnJheSwgaW5kZXgtLSwgMSk7XHJcbiAgICAgICAgICBsZW5ndGgtLTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBvcHBvc2l0ZSBvZiBgXy5pbml0aWFsYCB0aGlzIG1ldGhvZCBnZXRzIGFsbCBidXQgdGhlIGZpcnN0IGVsZW1lbnQgb3JcclxuICAgICAqIGZpcnN0IGBuYCBlbGVtZW50cyBvZiBhbiBhcnJheS4gSWYgYSBjYWxsYmFjayBmdW5jdGlvbiBpcyBwcm92aWRlZCBlbGVtZW50c1xyXG4gICAgICogYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgYXJyYXkgYXJlIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdCBhcyBsb25nIGFzIHRoZVxyXG4gICAgICogY2FsbGJhY2sgcmV0dXJucyB0cnVleS4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxyXG4gICAgICogd2l0aCB0aHJlZSBhcmd1bWVudHM7ICh2YWx1ZSwgaW5kZXgsIGFycmF5KS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBhbGlhcyBkcm9wLCB0YWlsXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcXVlcnkuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxudW1iZXJ8c3RyaW5nfSBbY2FsbGJhY2s9MV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBlbGVtZW50IG9yIHRoZSBudW1iZXIgb2YgZWxlbWVudHMgdG8gZXhjbHVkZS4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yXHJcbiAgICAgKiAgb2JqZWN0IGlzIHByb3ZpZGVkIGl0IHdpbGwgYmUgdXNlZCB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIlxyXG4gICAgICogIHN0eWxlIGNhbGxiYWNrLCByZXNwZWN0aXZlbHkuXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIHNsaWNlIG9mIGBhcnJheWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ucmVzdChbMSwgMiwgM10pO1xyXG4gICAgICogLy8gPT4gWzIsIDNdXHJcbiAgICAgKlxyXG4gICAgICogXy5yZXN0KFsxLCAyLCAzXSwgMik7XHJcbiAgICAgKiAvLyA9PiBbM11cclxuICAgICAqXHJcbiAgICAgKiBfLnJlc3QoWzEsIDIsIDNdLCBmdW5jdGlvbihudW0pIHtcclxuICAgICAqICAgcmV0dXJuIG51bSA8IDM7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IFszXVxyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICAnYmxvY2tlZCc6IHRydWUsICAnZW1wbG95ZXInOiAnc2xhdGUnIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgICdibG9ja2VkJzogZmFsc2UsICAnZW1wbG95ZXInOiAnc2xhdGUnIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdibG9ja2VkJzogdHJ1ZSwgJ2VtcGxveWVyJzogJ25hJyB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIFwiXy5wbHVja1wiIGNhbGxiYWNrIHNob3J0aGFuZFxyXG4gICAgICogXy5wbHVjayhfLnJlc3QoY2hhcmFjdGVycywgJ2Jsb2NrZWQnKSwgJ25hbWUnKTtcclxuICAgICAqIC8vID0+IFsnZnJlZCcsICdwZWJibGVzJ11cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ud2hlcmVcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8ucmVzdChjaGFyYWN0ZXJzLCB7ICdlbXBsb3llcic6ICdzbGF0ZScgfSk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdwZWJibGVzJywgJ2Jsb2NrZWQnOiB0cnVlLCAnZW1wbG95ZXInOiAnbmEnIH1dXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHJlc3QoYXJyYXksIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIGlmICh0eXBlb2YgY2FsbGJhY2sgIT0gJ251bWJlcicgJiYgY2FsbGJhY2sgIT0gbnVsbCkge1xyXG4gICAgICAgIHZhciBuID0gMCxcclxuICAgICAgICAgICAgaW5kZXggPSAtMSxcclxuICAgICAgICAgICAgbGVuZ3RoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiAwO1xyXG5cclxuICAgICAgICBjYWxsYmFjayA9IGxvZGFzaC5jcmVhdGVDYWxsYmFjayhjYWxsYmFjaywgdGhpc0FyZywgMyk7XHJcbiAgICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGggJiYgY2FsbGJhY2soYXJyYXlbaW5kZXhdLCBpbmRleCwgYXJyYXkpKSB7XHJcbiAgICAgICAgICBuKys7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG4gPSAoY2FsbGJhY2sgPT0gbnVsbCB8fCB0aGlzQXJnKSA/IDEgOiBuYXRpdmVNYXgoMCwgY2FsbGJhY2spO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBzbGljZShhcnJheSwgbik7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBVc2VzIGEgYmluYXJ5IHNlYXJjaCB0byBkZXRlcm1pbmUgdGhlIHNtYWxsZXN0IGluZGV4IGF0IHdoaWNoIGEgdmFsdWVcclxuICAgICAqIHNob3VsZCBiZSBpbnNlcnRlZCBpbnRvIGEgZ2l2ZW4gc29ydGVkIGFycmF5IGluIG9yZGVyIHRvIG1haW50YWluIHRoZSBzb3J0XHJcbiAgICAgKiBvcmRlciBvZiB0aGUgYXJyYXkuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSBleGVjdXRlZCBmb3JcclxuICAgICAqIGB2YWx1ZWAgYW5kIGVhY2ggZWxlbWVudCBvZiBgYXJyYXlgIHRvIGNvbXB1dGUgdGhlaXIgc29ydCByYW5raW5nLiBUaGVcclxuICAgICAqIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZCB3aXRoIG9uZSBhcmd1bWVudDsgKHZhbHVlKS5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhIHByb3BlcnR5IG5hbWUgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLnBsdWNrXCIgc3R5bGVcclxuICAgICAqIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBvZiB0aGUgZ2l2ZW4gZWxlbWVudC5cclxuICAgICAqXHJcbiAgICAgKiBJZiBhbiBvYmplY3QgaXMgcHJvdmlkZWQgZm9yIGBjYWxsYmFja2AgdGhlIGNyZWF0ZWQgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2tcclxuICAgICAqIHdpbGwgcmV0dXJuIGB0cnVlYCBmb3IgZWxlbWVudHMgdGhhdCBoYXZlIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSBnaXZlbiBvYmplY3QsXHJcbiAgICAgKiBlbHNlIGBmYWxzZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGFycmF5IFRoZSBhcnJheSB0byBpbnNwZWN0LlxyXG4gICAgICogQHBhcmFtIHsqfSB2YWx1ZSBUaGUgdmFsdWUgdG8gZXZhbHVhdGUuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdHxzdHJpbmd9IFtjYWxsYmFjaz1pZGVudGl0eV0gVGhlIGZ1bmN0aW9uIGNhbGxlZFxyXG4gICAgICogIHBlciBpdGVyYXRpb24uIElmIGEgcHJvcGVydHkgbmFtZSBvciBvYmplY3QgaXMgcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkXHJcbiAgICAgKiAgdG8gY3JlYXRlIGEgXCJfLnBsdWNrXCIgb3IgXCJfLndoZXJlXCIgc3R5bGUgY2FsbGJhY2ssIHJlc3BlY3RpdmVseS5cclxuICAgICAqIEBwYXJhbSB7Kn0gW3RoaXNBcmddIFRoZSBgdGhpc2AgYmluZGluZyBvZiBgY2FsbGJhY2tgLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgaW5kZXggYXQgd2hpY2ggYHZhbHVlYCBzaG91bGQgYmUgaW5zZXJ0ZWRcclxuICAgICAqICBpbnRvIGBhcnJheWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uc29ydGVkSW5kZXgoWzIwLCAzMCwgNTBdLCA0MCk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgXCJfLnBsdWNrXCIgY2FsbGJhY2sgc2hvcnRoYW5kXHJcbiAgICAgKiBfLnNvcnRlZEluZGV4KFt7ICd4JzogMjAgfSwgeyAneCc6IDMwIH0sIHsgJ3gnOiA1MCB9XSwgeyAneCc6IDQwIH0sICd4Jyk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGRpY3QgPSB7XHJcbiAgICAgKiAgICd3b3JkVG9OdW1iZXInOiB7ICd0d2VudHknOiAyMCwgJ3RoaXJ0eSc6IDMwLCAnZm91cnR5JzogNDAsICdmaWZ0eSc6IDUwIH1cclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogXy5zb3J0ZWRJbmRleChbJ3R3ZW50eScsICd0aGlydHknLCAnZmlmdHknXSwgJ2ZvdXJ0eScsIGZ1bmN0aW9uKHdvcmQpIHtcclxuICAgICAqICAgcmV0dXJuIGRpY3Qud29yZFRvTnVtYmVyW3dvcmRdO1xyXG4gICAgICogfSk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKlxyXG4gICAgICogXy5zb3J0ZWRJbmRleChbJ3R3ZW50eScsICd0aGlydHknLCAnZmlmdHknXSwgJ2ZvdXJ0eScsIGZ1bmN0aW9uKHdvcmQpIHtcclxuICAgICAqICAgcmV0dXJuIHRoaXMud29yZFRvTnVtYmVyW3dvcmRdO1xyXG4gICAgICogfSwgZGljdCk7XHJcbiAgICAgKiAvLyA9PiAyXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHNvcnRlZEluZGV4KGFycmF5LCB2YWx1ZSwgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAgdmFyIGxvdyA9IDAsXHJcbiAgICAgICAgICBoaWdoID0gYXJyYXkgPyBhcnJheS5sZW5ndGggOiBsb3c7XHJcblxyXG4gICAgICAvLyBleHBsaWNpdGx5IHJlZmVyZW5jZSBgaWRlbnRpdHlgIGZvciBiZXR0ZXIgaW5saW5pbmcgaW4gRmlyZWZveFxyXG4gICAgICBjYWxsYmFjayA9IGNhbGxiYWNrID8gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAxKSA6IGlkZW50aXR5O1xyXG4gICAgICB2YWx1ZSA9IGNhbGxiYWNrKHZhbHVlKTtcclxuXHJcbiAgICAgIHdoaWxlIChsb3cgPCBoaWdoKSB7XHJcbiAgICAgICAgdmFyIG1pZCA9IChsb3cgKyBoaWdoKSA+Pj4gMTtcclxuICAgICAgICAoY2FsbGJhY2soYXJyYXlbbWlkXSkgPCB2YWx1ZSlcclxuICAgICAgICAgID8gbG93ID0gbWlkICsgMVxyXG4gICAgICAgICAgOiBoaWdoID0gbWlkO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBsb3c7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IG9mIHVuaXF1ZSB2YWx1ZXMsIGluIG9yZGVyLCBvZiB0aGUgcHJvdmlkZWQgYXJyYXlzIHVzaW5nXHJcbiAgICAgKiBzdHJpY3QgZXF1YWxpdHkgZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0gey4uLkFycmF5fSBbYXJyYXldIFRoZSBhcnJheXMgdG8gaW5zcGVjdC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiBjb21iaW5lZCB2YWx1ZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8udW5pb24oWzEsIDIsIDNdLCBbNSwgMiwgMSwgNF0sIFsyLCAxXSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMiwgMywgNSwgNF1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gdW5pb24oKSB7XHJcbiAgICAgIHJldHVybiBiYXNlVW5pcShiYXNlRmxhdHRlbihhcmd1bWVudHMsIHRydWUsIHRydWUpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBkdXBsaWNhdGUtdmFsdWUtZnJlZSB2ZXJzaW9uIG9mIGFuIGFycmF5IHVzaW5nIHN0cmljdCBlcXVhbGl0eVxyXG4gICAgICogZm9yIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLiBJZiB0aGUgYXJyYXkgaXMgc29ydGVkLCBwcm92aWRpbmdcclxuICAgICAqIGB0cnVlYCBmb3IgYGlzU29ydGVkYCB3aWxsIHVzZSBhIGZhc3RlciBhbGdvcml0aG0uIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWRcclxuICAgICAqIGVhY2ggZWxlbWVudCBvZiBgYXJyYXlgIGlzIHBhc3NlZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBiZWZvcmUgdW5pcXVlbmVzc1xyXG4gICAgICogaXMgY29tcHV0ZWQuIFRoZSBjYWxsYmFjayBpcyBib3VuZCB0byBgdGhpc0FyZ2AgYW5kIGludm9rZWQgd2l0aCB0aHJlZVxyXG4gICAgICogYXJndW1lbnRzOyAodmFsdWUsIGluZGV4LCBhcnJheSkuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYSBwcm9wZXJ0eSBuYW1lIGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy5wbHVja1wiIHN0eWxlXHJcbiAgICAgKiBjYWxsYmFjayB3aWxsIHJldHVybiB0aGUgcHJvcGVydHkgdmFsdWUgb2YgdGhlIGdpdmVuIGVsZW1lbnQuXHJcbiAgICAgKlxyXG4gICAgICogSWYgYW4gb2JqZWN0IGlzIHByb3ZpZGVkIGZvciBgY2FsbGJhY2tgIHRoZSBjcmVhdGVkIFwiXy53aGVyZVwiIHN0eWxlIGNhbGxiYWNrXHJcbiAgICAgKiB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzIHRoYXQgaGF2ZSB0aGUgcHJvcGVydGllcyBvZiB0aGUgZ2l2ZW4gb2JqZWN0LFxyXG4gICAgICogZWxzZSBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAYWxpYXMgdW5pcXVlXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gcHJvY2Vzcy5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW2lzU29ydGVkPWZhbHNlXSBBIGZsYWcgdG8gaW5kaWNhdGUgdGhhdCBgYXJyYXlgIGlzIHNvcnRlZC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fHN0cmluZ30gW2NhbGxiYWNrPWlkZW50aXR5XSBUaGUgZnVuY3Rpb24gY2FsbGVkXHJcbiAgICAgKiAgcGVyIGl0ZXJhdGlvbi4gSWYgYSBwcm9wZXJ0eSBuYW1lIG9yIG9iamVjdCBpcyBwcm92aWRlZCBpdCB3aWxsIGJlIHVzZWRcclxuICAgICAqICB0byBjcmVhdGUgYSBcIl8ucGx1Y2tcIiBvciBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjaywgcmVzcGVjdGl2ZWx5LlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBjYWxsYmFja2AuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXl9IFJldHVybnMgYSBkdXBsaWNhdGUtdmFsdWUtZnJlZSBhcnJheS5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy51bmlxKFsxLCAyLCAxLCAzLCAxXSk7XHJcbiAgICAgKiAvLyA9PiBbMSwgMiwgM11cclxuICAgICAqXHJcbiAgICAgKiBfLnVuaXEoWzEsIDEsIDIsIDIsIDNdLCB0cnVlKTtcclxuICAgICAqIC8vID0+IFsxLCAyLCAzXVxyXG4gICAgICpcclxuICAgICAqIF8udW5pcShbJ0EnLCAnYicsICdDJywgJ2EnLCAnQicsICdjJ10sIGZ1bmN0aW9uKGxldHRlcikgeyByZXR1cm4gbGV0dGVyLnRvTG93ZXJDYXNlKCk7IH0pO1xyXG4gICAgICogLy8gPT4gWydBJywgJ2InLCAnQyddXHJcbiAgICAgKlxyXG4gICAgICogXy51bmlxKFsxLCAyLjUsIDMsIDEuNSwgMiwgMy41XSwgZnVuY3Rpb24obnVtKSB7IHJldHVybiB0aGlzLmZsb29yKG51bSk7IH0sIE1hdGgpO1xyXG4gICAgICogLy8gPT4gWzEsIDIuNSwgM11cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyBcIl8ucGx1Y2tcIiBjYWxsYmFjayBzaG9ydGhhbmRcclxuICAgICAqIF8udW5pcShbeyAneCc6IDEgfSwgeyAneCc6IDIgfSwgeyAneCc6IDEgfV0sICd4Jyk7XHJcbiAgICAgKiAvLyA9PiBbeyAneCc6IDEgfSwgeyAneCc6IDIgfV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gdW5pcShhcnJheSwgaXNTb3J0ZWQsIGNhbGxiYWNrLCB0aGlzQXJnKSB7XHJcbiAgICAgIC8vIGp1Z2dsZSBhcmd1bWVudHNcclxuICAgICAgaWYgKHR5cGVvZiBpc1NvcnRlZCAhPSAnYm9vbGVhbicgJiYgaXNTb3J0ZWQgIT0gbnVsbCkge1xyXG4gICAgICAgIHRoaXNBcmcgPSBjYWxsYmFjaztcclxuICAgICAgICBjYWxsYmFjayA9ICh0eXBlb2YgaXNTb3J0ZWQgIT0gJ2Z1bmN0aW9uJyAmJiB0aGlzQXJnICYmIHRoaXNBcmdbaXNTb3J0ZWRdID09PSBhcnJheSkgPyBudWxsIDogaXNTb3J0ZWQ7XHJcbiAgICAgICAgaXNTb3J0ZWQgPSBmYWxzZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoY2FsbGJhY2sgIT0gbnVsbCkge1xyXG4gICAgICAgIGNhbGxiYWNrID0gbG9kYXNoLmNyZWF0ZUNhbGxiYWNrKGNhbGxiYWNrLCB0aGlzQXJnLCAzKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gYmFzZVVuaXEoYXJyYXksIGlzU29ydGVkLCBjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGFuIGFycmF5IGV4Y2x1ZGluZyBhbGwgcHJvdmlkZWQgdmFsdWVzIHVzaW5nIHN0cmljdCBlcXVhbGl0eSBmb3JcclxuICAgICAqIGNvbXBhcmlzb25zLCBpLmUuIGA9PT1gLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gZmlsdGVyLlxyXG4gICAgICogQHBhcmFtIHsuLi4qfSBbdmFsdWVdIFRoZSB2YWx1ZXMgdG8gZXhjbHVkZS5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhIG5ldyBhcnJheSBvZiBmaWx0ZXJlZCB2YWx1ZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ud2l0aG91dChbMSwgMiwgMSwgMCwgMywgMSwgNF0sIDAsIDEpO1xyXG4gICAgICogLy8gPT4gWzIsIDMsIDRdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHdpdGhvdXQoYXJyYXkpIHtcclxuICAgICAgcmV0dXJuIGJhc2VEaWZmZXJlbmNlKGFycmF5LCBzbGljZShhcmd1bWVudHMsIDEpKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gYXJyYXkgdGhhdCBpcyB0aGUgc3ltbWV0cmljIGRpZmZlcmVuY2Ugb2YgdGhlIHByb3ZpZGVkIGFycmF5cy5cclxuICAgICAqIFNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1N5bW1ldHJpY19kaWZmZXJlbmNlLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0gey4uLkFycmF5fSBbYXJyYXldIFRoZSBhcnJheXMgdG8gaW5zcGVjdC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiB2YWx1ZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ueG9yKFsxLCAyLCAzXSwgWzUsIDIsIDEsIDRdKTtcclxuICAgICAqIC8vID0+IFszLCA1LCA0XVxyXG4gICAgICpcclxuICAgICAqIF8ueG9yKFsxLCAyLCA1XSwgWzIsIDMsIDVdLCBbMywgNCwgNV0pO1xyXG4gICAgICogLy8gPT4gWzEsIDQsIDVdXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHhvcigpIHtcclxuICAgICAgdmFyIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBhcmd1bWVudHMubGVuZ3RoO1xyXG5cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIgYXJyYXkgPSBhcmd1bWVudHNbaW5kZXhdO1xyXG4gICAgICAgIGlmIChpc0FycmF5KGFycmF5KSB8fCBpc0FyZ3VtZW50cyhhcnJheSkpIHtcclxuICAgICAgICAgIHZhciByZXN1bHQgPSByZXN1bHRcclxuICAgICAgICAgICAgPyBiYXNlVW5pcShiYXNlRGlmZmVyZW5jZShyZXN1bHQsIGFycmF5KS5jb25jYXQoYmFzZURpZmZlcmVuY2UoYXJyYXksIHJlc3VsdCkpKVxyXG4gICAgICAgICAgICA6IGFycmF5O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0IHx8IFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBhcnJheSBvZiBncm91cGVkIGVsZW1lbnRzLCB0aGUgZmlyc3Qgb2Ygd2hpY2ggY29udGFpbnMgdGhlIGZpcnN0XHJcbiAgICAgKiBlbGVtZW50cyBvZiB0aGUgZ2l2ZW4gYXJyYXlzLCB0aGUgc2Vjb25kIG9mIHdoaWNoIGNvbnRhaW5zIHRoZSBzZWNvbmRcclxuICAgICAqIGVsZW1lbnRzIG9mIHRoZSBnaXZlbiBhcnJheXMsIGFuZCBzbyBvbi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGFsaWFzIHVuemlwXHJcbiAgICAgKiBAY2F0ZWdvcnkgQXJyYXlzXHJcbiAgICAgKiBAcGFyYW0gey4uLkFycmF5fSBbYXJyYXldIEFycmF5cyB0byBwcm9jZXNzLlxyXG4gICAgICogQHJldHVybnMge0FycmF5fSBSZXR1cm5zIGEgbmV3IGFycmF5IG9mIGdyb3VwZWQgZWxlbWVudHMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uemlwKFsnZnJlZCcsICdiYXJuZXknXSwgWzMwLCA0MF0sIFt0cnVlLCBmYWxzZV0pO1xyXG4gICAgICogLy8gPT4gW1snZnJlZCcsIDMwLCB0cnVlXSwgWydiYXJuZXknLCA0MCwgZmFsc2VdXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiB6aXAoKSB7XHJcbiAgICAgIHZhciBhcnJheSA9IGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzIDogYXJndW1lbnRzWzBdLFxyXG4gICAgICAgICAgaW5kZXggPSAtMSxcclxuICAgICAgICAgIGxlbmd0aCA9IGFycmF5ID8gbWF4KHBsdWNrKGFycmF5LCAnbGVuZ3RoJykpIDogMCxcclxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KGxlbmd0aCA8IDAgPyAwIDogbGVuZ3RoKTtcclxuXHJcbiAgICAgIHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XHJcbiAgICAgICAgcmVzdWx0W2luZGV4XSA9IHBsdWNrKGFycmF5LCBpbmRleCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gb2JqZWN0IGNvbXBvc2VkIGZyb20gYXJyYXlzIG9mIGBrZXlzYCBhbmQgYHZhbHVlc2AuIFByb3ZpZGVcclxuICAgICAqIGVpdGhlciBhIHNpbmdsZSB0d28gZGltZW5zaW9uYWwgYXJyYXksIGkuZS4gYFtba2V5MSwgdmFsdWUxXSwgW2tleTIsIHZhbHVlMl1dYFxyXG4gICAgICogb3IgdHdvIGFycmF5cywgb25lIG9mIGBrZXlzYCBhbmQgb25lIG9mIGNvcnJlc3BvbmRpbmcgYHZhbHVlc2AuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBhbGlhcyBvYmplY3RcclxuICAgICAqIEBjYXRlZ29yeSBBcnJheXNcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGtleXMgVGhlIGFycmF5IG9mIGtleXMuXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBbdmFsdWVzPVtdXSBUaGUgYXJyYXkgb2YgdmFsdWVzLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBvYmplY3QgY29tcG9zZWQgb2YgdGhlIGdpdmVuIGtleXMgYW5kXHJcbiAgICAgKiAgY29ycmVzcG9uZGluZyB2YWx1ZXMuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uemlwT2JqZWN0KFsnZnJlZCcsICdiYXJuZXknXSwgWzMwLCA0MF0pO1xyXG4gICAgICogLy8gPT4geyAnZnJlZCc6IDMwLCAnYmFybmV5JzogNDAgfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiB6aXBPYmplY3Qoa2V5cywgdmFsdWVzKSB7XHJcbiAgICAgIHZhciBpbmRleCA9IC0xLFxyXG4gICAgICAgICAgbGVuZ3RoID0ga2V5cyA/IGtleXMubGVuZ3RoIDogMCxcclxuICAgICAgICAgIHJlc3VsdCA9IHt9O1xyXG5cclxuICAgICAgaWYgKCF2YWx1ZXMgJiYgbGVuZ3RoICYmICFpc0FycmF5KGtleXNbMF0pKSB7XHJcbiAgICAgICAgdmFsdWVzID0gW107XHJcbiAgICAgIH1cclxuICAgICAgd2hpbGUgKCsraW5kZXggPCBsZW5ndGgpIHtcclxuICAgICAgICB2YXIga2V5ID0ga2V5c1tpbmRleF07XHJcbiAgICAgICAgaWYgKHZhbHVlcykge1xyXG4gICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZXNbaW5kZXhdO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoa2V5KSB7XHJcbiAgICAgICAgICByZXN1bHRba2V5WzBdXSA9IGtleVsxXTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0IGV4ZWN1dGVzIGBmdW5jYCwgd2l0aCAgdGhlIGB0aGlzYCBiaW5kaW5nIGFuZFxyXG4gICAgICogYXJndW1lbnRzIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLCBvbmx5IGFmdGVyIGJlaW5nIGNhbGxlZCBgbmAgdGltZXMuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgdGltZXMgdGhlIGZ1bmN0aW9uIG11c3QgYmUgY2FsbGVkIGJlZm9yZVxyXG4gICAgICogIGBmdW5jYCBpcyBleGVjdXRlZC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcmVzdHJpY3RlZCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIHNhdmVzID0gWydwcm9maWxlJywgJ3NldHRpbmdzJ107XHJcbiAgICAgKlxyXG4gICAgICogdmFyIGRvbmUgPSBfLmFmdGVyKHNhdmVzLmxlbmd0aCwgZnVuY3Rpb24oKSB7XHJcbiAgICAgKiAgIGNvbnNvbGUubG9nKCdEb25lIHNhdmluZyEnKTtcclxuICAgICAqIH0pO1xyXG4gICAgICpcclxuICAgICAqIF8uZm9yRWFjaChzYXZlcywgZnVuY3Rpb24odHlwZSkge1xyXG4gICAgICogICBhc3luY1NhdmUoeyAndHlwZSc6IHR5cGUsICdjb21wbGV0ZSc6IGRvbmUgfSk7XHJcbiAgICAgKiB9KTtcclxuICAgICAqIC8vID0+IGxvZ3MgJ0RvbmUgc2F2aW5nIScsIGFmdGVyIGFsbCBzYXZlcyBoYXZlIGNvbXBsZXRlZFxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBhZnRlcihuLCBmdW5jKSB7XHJcbiAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmICgtLW4gPCAxKSB7XHJcbiAgICAgICAgICByZXR1cm4gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBmdW5jdGlvbiB0aGF0LCB3aGVuIGNhbGxlZCwgaW52b2tlcyBgZnVuY2Agd2l0aCB0aGUgYHRoaXNgXHJcbiAgICAgKiBiaW5kaW5nIG9mIGB0aGlzQXJnYCBhbmQgcHJlcGVuZHMgYW55IGFkZGl0aW9uYWwgYGJpbmRgIGFyZ3VtZW50cyB0byB0aG9zZVxyXG4gICAgICogcHJvdmlkZWQgdG8gdGhlIGJvdW5kIGZ1bmN0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBiaW5kLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIGBmdW5jYC5cclxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgYm91bmQgZnVuY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBmdW5jID0gZnVuY3Rpb24oZ3JlZXRpbmcpIHtcclxuICAgICAqICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiBmdW5jID0gXy5iaW5kKGZ1bmMsIHsgJ25hbWUnOiAnZnJlZCcgfSwgJ2hpJyk7XHJcbiAgICAgKiBmdW5jKCk7XHJcbiAgICAgKiAvLyA9PiAnaGkgZnJlZCdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gYmluZChmdW5jLCB0aGlzQXJnKSB7XHJcbiAgICAgIHJldHVybiBhcmd1bWVudHMubGVuZ3RoID4gMlxyXG4gICAgICAgID8gY3JlYXRlV3JhcHBlcihmdW5jLCAxNywgc2xpY2UoYXJndW1lbnRzLCAyKSwgbnVsbCwgdGhpc0FyZylcclxuICAgICAgICA6IGNyZWF0ZVdyYXBwZXIoZnVuYywgMSwgbnVsbCwgbnVsbCwgdGhpc0FyZyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBCaW5kcyBtZXRob2RzIG9mIGFuIG9iamVjdCB0byB0aGUgb2JqZWN0IGl0c2VsZiwgb3ZlcndyaXRpbmcgdGhlIGV4aXN0aW5nXHJcbiAgICAgKiBtZXRob2QuIE1ldGhvZCBuYW1lcyBtYXkgYmUgc3BlY2lmaWVkIGFzIGluZGl2aWR1YWwgYXJndW1lbnRzIG9yIGFzIGFycmF5c1xyXG4gICAgICogb2YgbWV0aG9kIG5hbWVzLiBJZiBubyBtZXRob2QgbmFtZXMgYXJlIHByb3ZpZGVkIGFsbCB0aGUgZnVuY3Rpb24gcHJvcGVydGllc1xyXG4gICAgICogb2YgYG9iamVjdGAgd2lsbCBiZSBib3VuZC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRvIGJpbmQgYW5kIGFzc2lnbiB0aGUgYm91bmQgbWV0aG9kcyB0by5cclxuICAgICAqIEBwYXJhbSB7Li4uc3RyaW5nfSBbbWV0aG9kTmFtZV0gVGhlIG9iamVjdCBtZXRob2QgbmFtZXMgdG9cclxuICAgICAqICBiaW5kLCBzcGVjaWZpZWQgYXMgaW5kaXZpZHVhbCBtZXRob2QgbmFtZXMgb3IgYXJyYXlzIG9mIG1ldGhvZCBuYW1lcy5cclxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYG9iamVjdGAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciB2aWV3ID0ge1xyXG4gICAgICogICAnbGFiZWwnOiAnZG9jcycsXHJcbiAgICAgKiAgICdvbkNsaWNrJzogZnVuY3Rpb24oKSB7IGNvbnNvbGUubG9nKCdjbGlja2VkICcgKyB0aGlzLmxhYmVsKTsgfVxyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiBfLmJpbmRBbGwodmlldyk7XHJcbiAgICAgKiBqUXVlcnkoJyNkb2NzJykub24oJ2NsaWNrJywgdmlldy5vbkNsaWNrKTtcclxuICAgICAqIC8vID0+IGxvZ3MgJ2NsaWNrZWQgZG9jcycsIHdoZW4gdGhlIGJ1dHRvbiBpcyBjbGlja2VkXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJpbmRBbGwob2JqZWN0KSB7XHJcbiAgICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYmFzZUZsYXR0ZW4oYXJndW1lbnRzLCB0cnVlLCBmYWxzZSwgMSkgOiBmdW5jdGlvbnMob2JqZWN0KSxcclxuICAgICAgICAgIGluZGV4ID0gLTEsXHJcbiAgICAgICAgICBsZW5ndGggPSBmdW5jcy5sZW5ndGg7XHJcblxyXG4gICAgICB3aGlsZSAoKytpbmRleCA8IGxlbmd0aCkge1xyXG4gICAgICAgIHZhciBrZXkgPSBmdW5jc1tpbmRleF07XHJcbiAgICAgICAgb2JqZWN0W2tleV0gPSBjcmVhdGVXcmFwcGVyKG9iamVjdFtrZXldLCAxLCBudWxsLCBudWxsLCBvYmplY3QpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBvYmplY3Q7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBjYWxsZWQsIGludm9rZXMgdGhlIG1ldGhvZCBhdCBgb2JqZWN0W2tleV1gXHJcbiAgICAgKiBhbmQgcHJlcGVuZHMgYW55IGFkZGl0aW9uYWwgYGJpbmRLZXlgIGFyZ3VtZW50cyB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgYm91bmRcclxuICAgICAqIGZ1bmN0aW9uLiBUaGlzIG1ldGhvZCBkaWZmZXJzIGZyb20gYF8uYmluZGAgYnkgYWxsb3dpbmcgYm91bmQgZnVuY3Rpb25zIHRvXHJcbiAgICAgKiByZWZlcmVuY2UgbWV0aG9kcyB0aGF0IHdpbGwgYmUgcmVkZWZpbmVkIG9yIGRvbid0IHlldCBleGlzdC5cclxuICAgICAqIFNlZSBodHRwOi8vbWljaGF1eC5jYS9hcnRpY2xlcy9sYXp5LWZ1bmN0aW9uLWRlZmluaXRpb24tcGF0dGVybi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9iamVjdCBUaGUgb2JqZWN0IHRoZSBtZXRob2QgYmVsb25ncyB0by5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIGtleSBvZiB0aGUgbWV0aG9kLlxyXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnXSBBcmd1bWVudHMgdG8gYmUgcGFydGlhbGx5IGFwcGxpZWQuXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBib3VuZCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIG9iamVjdCA9IHtcclxuICAgICAqICAgJ25hbWUnOiAnZnJlZCcsXHJcbiAgICAgKiAgICdncmVldCc6IGZ1bmN0aW9uKGdyZWV0aW5nKSB7XHJcbiAgICAgKiAgICAgcmV0dXJuIGdyZWV0aW5nICsgJyAnICsgdGhpcy5uYW1lO1xyXG4gICAgICogICB9XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIHZhciBmdW5jID0gXy5iaW5kS2V5KG9iamVjdCwgJ2dyZWV0JywgJ2hpJyk7XHJcbiAgICAgKiBmdW5jKCk7XHJcbiAgICAgKiAvLyA9PiAnaGkgZnJlZCdcclxuICAgICAqXHJcbiAgICAgKiBvYmplY3QuZ3JlZXQgPSBmdW5jdGlvbihncmVldGluZykge1xyXG4gICAgICogICByZXR1cm4gZ3JlZXRpbmcgKyAneWEgJyArIHRoaXMubmFtZSArICchJztcclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogZnVuYygpO1xyXG4gICAgICogLy8gPT4gJ2hpeWEgZnJlZCEnXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGJpbmRLZXkob2JqZWN0LCBrZXkpIHtcclxuICAgICAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPiAyXHJcbiAgICAgICAgPyBjcmVhdGVXcmFwcGVyKGtleSwgMTksIHNsaWNlKGFyZ3VtZW50cywgMiksIG51bGwsIG9iamVjdClcclxuICAgICAgICA6IGNyZWF0ZVdyYXBwZXIoa2V5LCAzLCBudWxsLCBudWxsLCBvYmplY3QpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgaXMgdGhlIGNvbXBvc2l0aW9uIG9mIHRoZSBwcm92aWRlZCBmdW5jdGlvbnMsXHJcbiAgICAgKiB3aGVyZSBlYWNoIGZ1bmN0aW9uIGNvbnN1bWVzIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGZ1bmN0aW9uIHRoYXQgZm9sbG93cy5cclxuICAgICAqIEZvciBleGFtcGxlLCBjb21wb3NpbmcgdGhlIGZ1bmN0aW9ucyBgZigpYCwgYGcoKWAsIGFuZCBgaCgpYCBwcm9kdWNlcyBgZihnKGgoKSkpYC5cclxuICAgICAqIEVhY2ggZnVuY3Rpb24gaXMgZXhlY3V0ZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNvbXBvc2VkIGZ1bmN0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0gey4uLkZ1bmN0aW9ufSBbZnVuY10gRnVuY3Rpb25zIHRvIGNvbXBvc2UuXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBjb21wb3NlZCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIHJlYWxOYW1lTWFwID0ge1xyXG4gICAgICogICAncGViYmxlcyc6ICdwZW5lbG9wZSdcclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogdmFyIGZvcm1hdCA9IGZ1bmN0aW9uKG5hbWUpIHtcclxuICAgICAqICAgbmFtZSA9IHJlYWxOYW1lTWFwW25hbWUudG9Mb3dlckNhc2UoKV0gfHwgbmFtZTtcclxuICAgICAqICAgcmV0dXJuIG5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnNsaWNlKDEpLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGZvcm1hdHRlZCkge1xyXG4gICAgICogICByZXR1cm4gJ0hpeWEgJyArIGZvcm1hdHRlZCArICchJztcclxuICAgICAqIH07XHJcbiAgICAgKlxyXG4gICAgICogdmFyIHdlbGNvbWUgPSBfLmNvbXBvc2UoZ3JlZXQsIGZvcm1hdCk7XHJcbiAgICAgKiB3ZWxjb21lKCdwZWJibGVzJyk7XHJcbiAgICAgKiAvLyA9PiAnSGl5YSBQZW5lbG9wZSEnXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNvbXBvc2UoKSB7XHJcbiAgICAgIHZhciBmdW5jcyA9IGFyZ3VtZW50cyxcclxuICAgICAgICAgIGxlbmd0aCA9IGZ1bmNzLmxlbmd0aDtcclxuXHJcbiAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jc1tsZW5ndGhdKSkge1xyXG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLFxyXG4gICAgICAgICAgICBsZW5ndGggPSBmdW5jcy5sZW5ndGg7XHJcblxyXG4gICAgICAgIHdoaWxlIChsZW5ndGgtLSkge1xyXG4gICAgICAgICAgYXJncyA9IFtmdW5jc1tsZW5ndGhdLmFwcGx5KHRoaXMsIGFyZ3MpXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGFyZ3NbMF07XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gd2hpY2ggYWNjZXB0cyBvbmUgb3IgbW9yZSBhcmd1bWVudHMgb2YgYGZ1bmNgIHRoYXQgd2hlblxyXG4gICAgICogaW52b2tlZCBlaXRoZXIgZXhlY3V0ZXMgYGZ1bmNgIHJldHVybmluZyBpdHMgcmVzdWx0LCBpZiBhbGwgYGZ1bmNgIGFyZ3VtZW50c1xyXG4gICAgICogaGF2ZSBiZWVuIHByb3ZpZGVkLCBvciByZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBhY2NlcHRzIG9uZSBvciBtb3JlIG9mIHRoZVxyXG4gICAgICogcmVtYWluaW5nIGBmdW5jYCBhcmd1bWVudHMsIGFuZCBzbyBvbi4gVGhlIGFyaXR5IG9mIGBmdW5jYCBjYW4gYmUgc3BlY2lmaWVkXHJcbiAgICAgKiBpZiBgZnVuYy5sZW5ndGhgIGlzIG5vdCBzdWZmaWNpZW50LlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBjdXJyeS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbYXJpdHk9ZnVuYy5sZW5ndGhdIFRoZSBhcml0eSBvZiBgZnVuY2AuXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBjdXJyaWVkIGZ1bmN0aW9uLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY3VycmllZCA9IF8uY3VycnkoZnVuY3Rpb24oYSwgYiwgYykge1xyXG4gICAgICogICBjb25zb2xlLmxvZyhhICsgYiArIGMpO1xyXG4gICAgICogfSk7XHJcbiAgICAgKlxyXG4gICAgICogY3VycmllZCgxKSgyKSgzKTtcclxuICAgICAqIC8vID0+IDZcclxuICAgICAqXHJcbiAgICAgKiBjdXJyaWVkKDEsIDIpKDMpO1xyXG4gICAgICogLy8gPT4gNlxyXG4gICAgICpcclxuICAgICAqIGN1cnJpZWQoMSwgMiwgMyk7XHJcbiAgICAgKiAvLyA9PiA2XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGN1cnJ5KGZ1bmMsIGFyaXR5KSB7XHJcbiAgICAgIGFyaXR5ID0gdHlwZW9mIGFyaXR5ID09ICdudW1iZXInID8gYXJpdHkgOiAoK2FyaXR5IHx8IGZ1bmMubGVuZ3RoKTtcclxuICAgICAgcmV0dXJuIGNyZWF0ZVdyYXBwZXIoZnVuYywgNCwgbnVsbCwgbnVsbCwgbnVsbCwgYXJpdHkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBkZWxheSB0aGUgZXhlY3V0aW9uIG9mIGBmdW5jYCB1bnRpbCBhZnRlclxyXG4gICAgICogYHdhaXRgIG1pbGxpc2Vjb25kcyBoYXZlIGVsYXBzZWQgc2luY2UgdGhlIGxhc3QgdGltZSBpdCB3YXMgaW52b2tlZC5cclxuICAgICAqIFByb3ZpZGUgYW4gb3B0aW9ucyBvYmplY3QgdG8gaW5kaWNhdGUgdGhhdCBgZnVuY2Agc2hvdWxkIGJlIGludm9rZWQgb25cclxuICAgICAqIHRoZSBsZWFkaW5nIGFuZC9vciB0cmFpbGluZyBlZGdlIG9mIHRoZSBgd2FpdGAgdGltZW91dC4gU3Vic2VxdWVudCBjYWxsc1xyXG4gICAgICogdG8gdGhlIGRlYm91bmNlZCBmdW5jdGlvbiB3aWxsIHJldHVybiB0aGUgcmVzdWx0IG9mIHRoZSBsYXN0IGBmdW5jYCBjYWxsLlxyXG4gICAgICpcclxuICAgICAqIE5vdGU6IElmIGBsZWFkaW5nYCBhbmQgYHRyYWlsaW5nYCBvcHRpb25zIGFyZSBgdHJ1ZWAgYGZ1bmNgIHdpbGwgYmUgY2FsbGVkXHJcbiAgICAgKiBvbiB0aGUgdHJhaWxpbmcgZWRnZSBvZiB0aGUgdGltZW91dCBvbmx5IGlmIHRoZSB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uIGlzXHJcbiAgICAgKiBpbnZva2VkIG1vcmUgdGhhbiBvbmNlIGR1cmluZyB0aGUgYHdhaXRgIHRpbWVvdXQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlYm91bmNlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHdhaXQgVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgdG8gZGVsYXkuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFRoZSBvcHRpb25zIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMubGVhZGluZz1mYWxzZV0gU3BlY2lmeSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbb3B0aW9ucy5tYXhXYWl0XSBUaGUgbWF4aW11bSB0aW1lIGBmdW5jYCBpcyBhbGxvd2VkIHRvIGJlIGRlbGF5ZWQgYmVmb3JlIGl0J3MgY2FsbGVkLlxyXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbb3B0aW9ucy50cmFpbGluZz10cnVlXSBTcGVjaWZ5IGV4ZWN1dGlvbiBvbiB0aGUgdHJhaWxpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGRlYm91bmNlZCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogLy8gYXZvaWQgY29zdGx5IGNhbGN1bGF0aW9ucyB3aGlsZSB0aGUgd2luZG93IHNpemUgaXMgaW4gZmx1eFxyXG4gICAgICogdmFyIGxhenlMYXlvdXQgPSBfLmRlYm91bmNlKGNhbGN1bGF0ZUxheW91dCwgMTUwKTtcclxuICAgICAqIGpRdWVyeSh3aW5kb3cpLm9uKCdyZXNpemUnLCBsYXp5TGF5b3V0KTtcclxuICAgICAqXHJcbiAgICAgKiAvLyBleGVjdXRlIGBzZW5kTWFpbGAgd2hlbiB0aGUgY2xpY2sgZXZlbnQgaXMgZmlyZWQsIGRlYm91bmNpbmcgc3Vic2VxdWVudCBjYWxsc1xyXG4gICAgICogalF1ZXJ5KCcjcG9zdGJveCcpLm9uKCdjbGljaycsIF8uZGVib3VuY2Uoc2VuZE1haWwsIDMwMCwge1xyXG4gICAgICogICAnbGVhZGluZyc6IHRydWUsXHJcbiAgICAgKiAgICd0cmFpbGluZyc6IGZhbHNlXHJcbiAgICAgKiB9KTtcclxuICAgICAqXHJcbiAgICAgKiAvLyBlbnN1cmUgYGJhdGNoTG9nYCBpcyBleGVjdXRlZCBvbmNlIGFmdGVyIDEgc2Vjb25kIG9mIGRlYm91bmNlZCBjYWxsc1xyXG4gICAgICogdmFyIHNvdXJjZSA9IG5ldyBFdmVudFNvdXJjZSgnL3N0cmVhbScpO1xyXG4gICAgICogc291cmNlLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBfLmRlYm91bmNlKGJhdGNoTG9nLCAyNTAsIHtcclxuICAgICAqICAgJ21heFdhaXQnOiAxMDAwXHJcbiAgICAgKiB9LCBmYWxzZSk7XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGRlYm91bmNlKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcclxuICAgICAgdmFyIGFyZ3MsXHJcbiAgICAgICAgICBtYXhUaW1lb3V0SWQsXHJcbiAgICAgICAgICByZXN1bHQsXHJcbiAgICAgICAgICBzdGFtcCxcclxuICAgICAgICAgIHRoaXNBcmcsXHJcbiAgICAgICAgICB0aW1lb3V0SWQsXHJcbiAgICAgICAgICB0cmFpbGluZ0NhbGwsXHJcbiAgICAgICAgICBsYXN0Q2FsbGVkID0gMCxcclxuICAgICAgICAgIG1heFdhaXQgPSBmYWxzZSxcclxuICAgICAgICAgIHRyYWlsaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XHJcbiAgICAgIH1cclxuICAgICAgd2FpdCA9IG5hdGl2ZU1heCgwLCB3YWl0KSB8fCAwO1xyXG4gICAgICBpZiAob3B0aW9ucyA9PT0gdHJ1ZSkge1xyXG4gICAgICAgIHZhciBsZWFkaW5nID0gdHJ1ZTtcclxuICAgICAgICB0cmFpbGluZyA9IGZhbHNlO1xyXG4gICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KG9wdGlvbnMpKSB7XHJcbiAgICAgICAgbGVhZGluZyA9IG9wdGlvbnMubGVhZGluZztcclxuICAgICAgICBtYXhXYWl0ID0gJ21heFdhaXQnIGluIG9wdGlvbnMgJiYgKG5hdGl2ZU1heCh3YWl0LCBvcHRpb25zLm1heFdhaXQpIHx8IDApO1xyXG4gICAgICAgIHRyYWlsaW5nID0gJ3RyYWlsaW5nJyBpbiBvcHRpb25zID8gb3B0aW9ucy50cmFpbGluZyA6IHRyYWlsaW5nO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBkZWxheWVkID0gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgdmFyIHJlbWFpbmluZyA9IHdhaXQgLSAobm93KCkgLSBzdGFtcCk7XHJcbiAgICAgICAgaWYgKHJlbWFpbmluZyA8PSAwKSB7XHJcbiAgICAgICAgICBpZiAobWF4VGltZW91dElkKSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChtYXhUaW1lb3V0SWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdmFyIGlzQ2FsbGVkID0gdHJhaWxpbmdDYWxsO1xyXG4gICAgICAgICAgbWF4VGltZW91dElkID0gdGltZW91dElkID0gdHJhaWxpbmdDYWxsID0gdW5kZWZpbmVkO1xyXG4gICAgICAgICAgaWYgKGlzQ2FsbGVkKSB7XHJcbiAgICAgICAgICAgIGxhc3RDYWxsZWQgPSBub3coKTtcclxuICAgICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcclxuICAgICAgICAgICAgaWYgKCF0aW1lb3V0SWQgJiYgIW1heFRpbWVvdXRJZCkge1xyXG4gICAgICAgICAgICAgIGFyZ3MgPSB0aGlzQXJnID0gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KGRlbGF5ZWQsIHJlbWFpbmluZyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdmFyIG1heERlbGF5ZWQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICBpZiAodGltZW91dElkKSB7XHJcbiAgICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dElkKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbWF4VGltZW91dElkID0gdGltZW91dElkID0gdHJhaWxpbmdDYWxsID0gdW5kZWZpbmVkO1xyXG4gICAgICAgIGlmICh0cmFpbGluZyB8fCAobWF4V2FpdCAhPT0gd2FpdCkpIHtcclxuICAgICAgICAgIGxhc3RDYWxsZWQgPSBub3coKTtcclxuICAgICAgICAgIHJlc3VsdCA9IGZ1bmMuYXBwbHkodGhpc0FyZywgYXJncyk7XHJcbiAgICAgICAgICBpZiAoIXRpbWVvdXRJZCAmJiAhbWF4VGltZW91dElkKSB7XHJcbiAgICAgICAgICAgIGFyZ3MgPSB0aGlzQXJnID0gbnVsbDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcblxyXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgYXJncyA9IGFyZ3VtZW50cztcclxuICAgICAgICBzdGFtcCA9IG5vdygpO1xyXG4gICAgICAgIHRoaXNBcmcgPSB0aGlzO1xyXG4gICAgICAgIHRyYWlsaW5nQ2FsbCA9IHRyYWlsaW5nICYmICh0aW1lb3V0SWQgfHwgIWxlYWRpbmcpO1xyXG5cclxuICAgICAgICBpZiAobWF4V2FpdCA9PT0gZmFsc2UpIHtcclxuICAgICAgICAgIHZhciBsZWFkaW5nQ2FsbCA9IGxlYWRpbmcgJiYgIXRpbWVvdXRJZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgaWYgKCFtYXhUaW1lb3V0SWQgJiYgIWxlYWRpbmcpIHtcclxuICAgICAgICAgICAgbGFzdENhbGxlZCA9IHN0YW1wO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdmFyIHJlbWFpbmluZyA9IG1heFdhaXQgLSAoc3RhbXAgLSBsYXN0Q2FsbGVkKSxcclxuICAgICAgICAgICAgICBpc0NhbGxlZCA9IHJlbWFpbmluZyA8PSAwO1xyXG5cclxuICAgICAgICAgIGlmIChpc0NhbGxlZCkge1xyXG4gICAgICAgICAgICBpZiAobWF4VGltZW91dElkKSB7XHJcbiAgICAgICAgICAgICAgbWF4VGltZW91dElkID0gY2xlYXJUaW1lb3V0KG1heFRpbWVvdXRJZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgbGFzdENhbGxlZCA9IHN0YW1wO1xyXG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXNBcmcsIGFyZ3MpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZWxzZSBpZiAoIW1heFRpbWVvdXRJZCkge1xyXG4gICAgICAgICAgICBtYXhUaW1lb3V0SWQgPSBzZXRUaW1lb3V0KG1heERlbGF5ZWQsIHJlbWFpbmluZyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpc0NhbGxlZCAmJiB0aW1lb3V0SWQpIHtcclxuICAgICAgICAgIHRpbWVvdXRJZCA9IGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmICghdGltZW91dElkICYmIHdhaXQgIT09IG1heFdhaXQpIHtcclxuICAgICAgICAgIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZGVsYXllZCwgd2FpdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChsZWFkaW5nQ2FsbCkge1xyXG4gICAgICAgICAgaXNDYWxsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzQXJnLCBhcmdzKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGlzQ2FsbGVkICYmICF0aW1lb3V0SWQgJiYgIW1heFRpbWVvdXRJZCkge1xyXG4gICAgICAgICAgYXJncyA9IHRoaXNBcmcgPSBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRGVmZXJzIGV4ZWN1dGluZyB0aGUgYGZ1bmNgIGZ1bmN0aW9uIHVudGlsIHRoZSBjdXJyZW50IGNhbGwgc3RhY2sgaGFzIGNsZWFyZWQuXHJcbiAgICAgKiBBZGRpdGlvbmFsIGFyZ3VtZW50cyB3aWxsIGJlIHByb3ZpZGVkIHRvIGBmdW5jYCB3aGVuIGl0IGlzIGludm9rZWQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGRlZmVyLlxyXG4gICAgICogQHBhcmFtIHsuLi4qfSBbYXJnXSBBcmd1bWVudHMgdG8gaW52b2tlIHRoZSBmdW5jdGlvbiB3aXRoLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgdGltZXIgaWQuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8uZGVmZXIoZnVuY3Rpb24odGV4dCkgeyBjb25zb2xlLmxvZyh0ZXh0KTsgfSwgJ2RlZmVycmVkJyk7XHJcbiAgICAgKiAvLyBsb2dzICdkZWZlcnJlZCcgYWZ0ZXIgb25lIG9yIG1vcmUgbWlsbGlzZWNvbmRzXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGRlZmVyKGZ1bmMpIHtcclxuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcclxuICAgICAgfVxyXG4gICAgICB2YXIgYXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XHJcbiAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyBmdW5jLmFwcGx5KHVuZGVmaW5lZCwgYXJncyk7IH0sIDEpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXhlY3V0ZXMgdGhlIGBmdW5jYCBmdW5jdGlvbiBhZnRlciBgd2FpdGAgbWlsbGlzZWNvbmRzLiBBZGRpdGlvbmFsIGFyZ3VtZW50c1xyXG4gICAgICogd2lsbCBiZSBwcm92aWRlZCB0byBgZnVuY2Agd2hlbiBpdCBpcyBpbnZva2VkLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmdW5jIFRoZSBmdW5jdGlvbiB0byBkZWxheS5cclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSB3YWl0IFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRvIGRlbGF5IGV4ZWN1dGlvbi5cclxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGludm9rZSB0aGUgZnVuY3Rpb24gd2l0aC5cclxuICAgICAqIEByZXR1cm5zIHtudW1iZXJ9IFJldHVybnMgdGhlIHRpbWVyIGlkLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmRlbGF5KGZ1bmN0aW9uKHRleHQpIHsgY29uc29sZS5sb2codGV4dCk7IH0sIDEwMDAsICdsYXRlcicpO1xyXG4gICAgICogLy8gPT4gbG9ncyAnbGF0ZXInIGFmdGVyIG9uZSBzZWNvbmRcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gZGVsYXkoZnVuYywgd2FpdCkge1xyXG4gICAgICBpZiAoIWlzRnVuY3Rpb24oZnVuYykpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBhcmdzID0gc2xpY2UoYXJndW1lbnRzLCAyKTtcclxuICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IGZ1bmMuYXBwbHkodW5kZWZpbmVkLCBhcmdzKTsgfSwgd2FpdCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBtZW1vaXplcyB0aGUgcmVzdWx0IG9mIGBmdW5jYC4gSWYgYHJlc29sdmVyYCBpc1xyXG4gICAgICogcHJvdmlkZWQgaXQgd2lsbCBiZSB1c2VkIHRvIGRldGVybWluZSB0aGUgY2FjaGUga2V5IGZvciBzdG9yaW5nIHRoZSByZXN1bHRcclxuICAgICAqIGJhc2VkIG9uIHRoZSBhcmd1bWVudHMgcHJvdmlkZWQgdG8gdGhlIG1lbW9pemVkIGZ1bmN0aW9uLiBCeSBkZWZhdWx0LCB0aGVcclxuICAgICAqIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIHRoZSBtZW1vaXplZCBmdW5jdGlvbiBpcyB1c2VkIGFzIHRoZSBjYWNoZSBrZXkuXHJcbiAgICAgKiBUaGUgYGZ1bmNgIGlzIGV4ZWN1dGVkIHdpdGggdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBtZW1vaXplZCBmdW5jdGlvbi5cclxuICAgICAqIFRoZSByZXN1bHQgY2FjaGUgaXMgZXhwb3NlZCBhcyB0aGUgYGNhY2hlYCBwcm9wZXJ0eSBvbiB0aGUgbWVtb2l6ZWQgZnVuY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIGhhdmUgaXRzIG91dHB1dCBtZW1vaXplZC5cclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IFtyZXNvbHZlcl0gQSBmdW5jdGlvbiB1c2VkIHRvIHJlc29sdmUgdGhlIGNhY2hlIGtleS5cclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IG1lbW9pemluZyBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGZpYm9uYWNjaSA9IF8ubWVtb2l6ZShmdW5jdGlvbihuKSB7XHJcbiAgICAgKiAgIHJldHVybiBuIDwgMiA/IG4gOiBmaWJvbmFjY2kobiAtIDEpICsgZmlib25hY2NpKG4gLSAyKTtcclxuICAgICAqIH0pO1xyXG4gICAgICpcclxuICAgICAqIGZpYm9uYWNjaSg5KVxyXG4gICAgICogLy8gPT4gMzRcclxuICAgICAqXHJcbiAgICAgKiB2YXIgZGF0YSA9IHtcclxuICAgICAqICAgJ2ZyZWQnOiB7ICduYW1lJzogJ2ZyZWQnLCAnYWdlJzogNDAgfSxcclxuICAgICAqICAgJ3BlYmJsZXMnOiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIC8vIG1vZGlmeWluZyB0aGUgcmVzdWx0IGNhY2hlXHJcbiAgICAgKiB2YXIgZ2V0ID0gXy5tZW1vaXplKGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIGRhdGFbbmFtZV07IH0sIF8uaWRlbnRpdHkpO1xyXG4gICAgICogZ2V0KCdwZWJibGVzJyk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ3BlYmJsZXMnLCAnYWdlJzogMSB9XHJcbiAgICAgKlxyXG4gICAgICogZ2V0LmNhY2hlLnBlYmJsZXMubmFtZSA9ICdwZW5lbG9wZSc7XHJcbiAgICAgKiBnZXQoJ3BlYmJsZXMnKTtcclxuICAgICAqIC8vID0+IHsgJ25hbWUnOiAncGVuZWxvcGUnLCAnYWdlJzogMSB9XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIG1lbW9pemUoZnVuYywgcmVzb2x2ZXIpIHtcclxuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcclxuICAgICAgfVxyXG4gICAgICB2YXIgbWVtb2l6ZWQgPSBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgY2FjaGUgPSBtZW1vaXplZC5jYWNoZSxcclxuICAgICAgICAgICAga2V5ID0gcmVzb2x2ZXIgPyByZXNvbHZlci5hcHBseSh0aGlzLCBhcmd1bWVudHMpIDoga2V5UHJlZml4ICsgYXJndW1lbnRzWzBdO1xyXG5cclxuICAgICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChjYWNoZSwga2V5KVxyXG4gICAgICAgICAgPyBjYWNoZVtrZXldXHJcbiAgICAgICAgICA6IChjYWNoZVtrZXldID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpKTtcclxuICAgICAgfVxyXG4gICAgICBtZW1vaXplZC5jYWNoZSA9IHt9O1xyXG4gICAgICByZXR1cm4gbWVtb2l6ZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCBpcyByZXN0cmljdGVkIHRvIGV4ZWN1dGUgYGZ1bmNgIG9uY2UuIFJlcGVhdCBjYWxscyB0b1xyXG4gICAgICogdGhlIGZ1bmN0aW9uIHdpbGwgcmV0dXJuIHRoZSB2YWx1ZSBvZiB0aGUgZmlyc3QgY2FsbC4gVGhlIGBmdW5jYCBpcyBleGVjdXRlZFxyXG4gICAgICogd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgdGhlIGNyZWF0ZWQgZnVuY3Rpb24uXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBGdW5jdGlvbnNcclxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGZ1bmN0aW9uIHRvIHJlc3RyaWN0LlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcmVzdHJpY3RlZCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGluaXRpYWxpemUgPSBfLm9uY2UoY3JlYXRlQXBwbGljYXRpb24pO1xyXG4gICAgICogaW5pdGlhbGl6ZSgpO1xyXG4gICAgICogaW5pdGlhbGl6ZSgpO1xyXG4gICAgICogLy8gYGluaXRpYWxpemVgIGV4ZWN1dGVzIGBjcmVhdGVBcHBsaWNhdGlvbmAgb25jZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBvbmNlKGZ1bmMpIHtcclxuICAgICAgdmFyIHJhbixcclxuICAgICAgICAgIHJlc3VsdDtcclxuXHJcbiAgICAgIGlmICghaXNGdW5jdGlvbihmdW5jKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3I7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmIChyYW4pIHtcclxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJhbiA9IHRydWU7XHJcbiAgICAgICAgcmVzdWx0ID0gZnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG5cclxuICAgICAgICAvLyBjbGVhciB0aGUgYGZ1bmNgIHZhcmlhYmxlIHNvIHRoZSBmdW5jdGlvbiBtYXkgYmUgZ2FyYmFnZSBjb2xsZWN0ZWRcclxuICAgICAgICBmdW5jID0gbnVsbDtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQsIHdoZW4gY2FsbGVkLCBpbnZva2VzIGBmdW5jYCB3aXRoIGFueSBhZGRpdGlvbmFsXHJcbiAgICAgKiBgcGFydGlhbGAgYXJndW1lbnRzIHByZXBlbmRlZCB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgbmV3IGZ1bmN0aW9uLiBUaGlzXHJcbiAgICAgKiBtZXRob2QgaXMgc2ltaWxhciB0byBgXy5iaW5kYCBleGNlcHQgaXQgZG9lcyAqKm5vdCoqIGFsdGVyIHRoZSBgdGhpc2AgYmluZGluZy5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gcGFydGlhbGx5IGFwcGx5IGFyZ3VtZW50cyB0by5cclxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBncmVldCA9IGZ1bmN0aW9uKGdyZWV0aW5nLCBuYW1lKSB7IHJldHVybiBncmVldGluZyArICcgJyArIG5hbWU7IH07XHJcbiAgICAgKiB2YXIgaGkgPSBfLnBhcnRpYWwoZ3JlZXQsICdoaScpO1xyXG4gICAgICogaGkoJ2ZyZWQnKTtcclxuICAgICAqIC8vID0+ICdoaSBmcmVkJ1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBwYXJ0aWFsKGZ1bmMpIHtcclxuICAgICAgcmV0dXJuIGNyZWF0ZVdyYXBwZXIoZnVuYywgMTYsIHNsaWNlKGFyZ3VtZW50cywgMSkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhpcyBtZXRob2QgaXMgbGlrZSBgXy5wYXJ0aWFsYCBleGNlcHQgdGhhdCBgcGFydGlhbGAgYXJndW1lbnRzIGFyZVxyXG4gICAgICogYXBwZW5kZWQgdG8gdGhvc2UgcHJvdmlkZWQgdG8gdGhlIG5ldyBmdW5jdGlvbi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gcGFydGlhbGx5IGFwcGx5IGFyZ3VtZW50cyB0by5cclxuICAgICAqIEBwYXJhbSB7Li4uKn0gW2FyZ10gQXJndW1lbnRzIHRvIGJlIHBhcnRpYWxseSBhcHBsaWVkLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgcGFydGlhbGx5IGFwcGxpZWQgZnVuY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBkZWZhdWx0c0RlZXAgPSBfLnBhcnRpYWxSaWdodChfLm1lcmdlLCBfLmRlZmF1bHRzKTtcclxuICAgICAqXHJcbiAgICAgKiB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAqICAgJ3ZhcmlhYmxlJzogJ2RhdGEnLFxyXG4gICAgICogICAnaW1wb3J0cyc6IHsgJ2pxJzogJCB9XHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIGRlZmF1bHRzRGVlcChvcHRpb25zLCBfLnRlbXBsYXRlU2V0dGluZ3MpO1xyXG4gICAgICpcclxuICAgICAqIG9wdGlvbnMudmFyaWFibGVcclxuICAgICAqIC8vID0+ICdkYXRhJ1xyXG4gICAgICpcclxuICAgICAqIG9wdGlvbnMuaW1wb3J0c1xyXG4gICAgICogLy8gPT4geyAnXyc6IF8sICdqcSc6ICQgfVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBwYXJ0aWFsUmlnaHQoZnVuYykge1xyXG4gICAgICByZXR1cm4gY3JlYXRlV3JhcHBlcihmdW5jLCAzMiwgbnVsbCwgc2xpY2UoYXJndW1lbnRzLCAxKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCwgd2hlbiBleGVjdXRlZCwgd2lsbCBvbmx5IGNhbGwgdGhlIGBmdW5jYCBmdW5jdGlvblxyXG4gICAgICogYXQgbW9zdCBvbmNlIHBlciBldmVyeSBgd2FpdGAgbWlsbGlzZWNvbmRzLiBQcm92aWRlIGFuIG9wdGlvbnMgb2JqZWN0IHRvXHJcbiAgICAgKiBpbmRpY2F0ZSB0aGF0IGBmdW5jYCBzaG91bGQgYmUgaW52b2tlZCBvbiB0aGUgbGVhZGluZyBhbmQvb3IgdHJhaWxpbmcgZWRnZVxyXG4gICAgICogb2YgdGhlIGB3YWl0YCB0aW1lb3V0LiBTdWJzZXF1ZW50IGNhbGxzIHRvIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gd2lsbFxyXG4gICAgICogcmV0dXJuIHRoZSByZXN1bHQgb2YgdGhlIGxhc3QgYGZ1bmNgIGNhbGwuXHJcbiAgICAgKlxyXG4gICAgICogTm90ZTogSWYgYGxlYWRpbmdgIGFuZCBgdHJhaWxpbmdgIG9wdGlvbnMgYXJlIGB0cnVlYCBgZnVuY2Agd2lsbCBiZSBjYWxsZWRcclxuICAgICAqIG9uIHRoZSB0cmFpbGluZyBlZGdlIG9mIHRoZSB0aW1lb3V0IG9ubHkgaWYgdGhlIHRoZSB0aHJvdHRsZWQgZnVuY3Rpb24gaXNcclxuICAgICAqIGludm9rZWQgbW9yZSB0aGFuIG9uY2UgZHVyaW5nIHRoZSBgd2FpdGAgdGltZW91dC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IEZ1bmN0aW9uc1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuYyBUaGUgZnVuY3Rpb24gdG8gdGhyb3R0bGUuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gd2FpdCBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyB0byB0aHJvdHRsZSBleGVjdXRpb25zIHRvLlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBUaGUgb3B0aW9ucyBvYmplY3QuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtvcHRpb25zLmxlYWRpbmc9dHJ1ZV0gU3BlY2lmeSBleGVjdXRpb24gb24gdGhlIGxlYWRpbmcgZWRnZSBvZiB0aGUgdGltZW91dC5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMudHJhaWxpbmc9dHJ1ZV0gU3BlY2lmeSBleGVjdXRpb24gb24gdGhlIHRyYWlsaW5nIGVkZ2Ugb2YgdGhlIHRpbWVvdXQuXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyB0aHJvdHRsZWQgZnVuY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIC8vIGF2b2lkIGV4Y2Vzc2l2ZWx5IHVwZGF0aW5nIHRoZSBwb3NpdGlvbiB3aGlsZSBzY3JvbGxpbmdcclxuICAgICAqIHZhciB0aHJvdHRsZWQgPSBfLnRocm90dGxlKHVwZGF0ZVBvc2l0aW9uLCAxMDApO1xyXG4gICAgICogalF1ZXJ5KHdpbmRvdykub24oJ3Njcm9sbCcsIHRocm90dGxlZCk7XHJcbiAgICAgKlxyXG4gICAgICogLy8gZXhlY3V0ZSBgcmVuZXdUb2tlbmAgd2hlbiB0aGUgY2xpY2sgZXZlbnQgaXMgZmlyZWQsIGJ1dCBub3QgbW9yZSB0aGFuIG9uY2UgZXZlcnkgNSBtaW51dGVzXHJcbiAgICAgKiBqUXVlcnkoJy5pbnRlcmFjdGl2ZScpLm9uKCdjbGljaycsIF8udGhyb3R0bGUocmVuZXdUb2tlbiwgMzAwMDAwLCB7XHJcbiAgICAgKiAgICd0cmFpbGluZyc6IGZhbHNlXHJcbiAgICAgKiB9KSk7XHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHRocm90dGxlKGZ1bmMsIHdhaXQsIG9wdGlvbnMpIHtcclxuICAgICAgdmFyIGxlYWRpbmcgPSB0cnVlLFxyXG4gICAgICAgICAgdHJhaWxpbmcgPSB0cnVlO1xyXG5cclxuICAgICAgaWYgKCFpc0Z1bmN0aW9uKGZ1bmMpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcjtcclxuICAgICAgfVxyXG4gICAgICBpZiAob3B0aW9ucyA9PT0gZmFsc2UpIHtcclxuICAgICAgICBsZWFkaW5nID0gZmFsc2U7XHJcbiAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3Qob3B0aW9ucykpIHtcclxuICAgICAgICBsZWFkaW5nID0gJ2xlYWRpbmcnIGluIG9wdGlvbnMgPyBvcHRpb25zLmxlYWRpbmcgOiBsZWFkaW5nO1xyXG4gICAgICAgIHRyYWlsaW5nID0gJ3RyYWlsaW5nJyBpbiBvcHRpb25zID8gb3B0aW9ucy50cmFpbGluZyA6IHRyYWlsaW5nO1xyXG4gICAgICB9XHJcbiAgICAgIGRlYm91bmNlT3B0aW9ucy5sZWFkaW5nID0gbGVhZGluZztcclxuICAgICAgZGVib3VuY2VPcHRpb25zLm1heFdhaXQgPSB3YWl0O1xyXG4gICAgICBkZWJvdW5jZU9wdGlvbnMudHJhaWxpbmcgPSB0cmFpbGluZztcclxuXHJcbiAgICAgIHJldHVybiBkZWJvdW5jZShmdW5jLCB3YWl0LCBkZWJvdW5jZU9wdGlvbnMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGZ1bmN0aW9uIHRoYXQgcHJvdmlkZXMgYHZhbHVlYCB0byB0aGUgd3JhcHBlciBmdW5jdGlvbiBhcyBpdHNcclxuICAgICAqIGZpcnN0IGFyZ3VtZW50LiBBZGRpdGlvbmFsIGFyZ3VtZW50cyBwcm92aWRlZCB0byB0aGUgZnVuY3Rpb24gYXJlIGFwcGVuZGVkXHJcbiAgICAgKiB0byB0aG9zZSBwcm92aWRlZCB0byB0aGUgd3JhcHBlciBmdW5jdGlvbi4gVGhlIHdyYXBwZXIgaXMgZXhlY3V0ZWQgd2l0aFxyXG4gICAgICogdGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGZ1bmN0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgRnVuY3Rpb25zXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwLlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gd3JhcHBlciBUaGUgd3JhcHBlciBmdW5jdGlvbi5cclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn0gUmV0dXJucyB0aGUgbmV3IGZ1bmN0aW9uLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgcCA9IF8ud3JhcChfLmVzY2FwZSwgZnVuY3Rpb24oZnVuYywgdGV4dCkge1xyXG4gICAgICogICByZXR1cm4gJzxwPicgKyBmdW5jKHRleHQpICsgJzwvcD4nO1xyXG4gICAgICogfSk7XHJcbiAgICAgKlxyXG4gICAgICogcCgnRnJlZCwgV2lsbWEsICYgUGViYmxlcycpO1xyXG4gICAgICogLy8gPT4gJzxwPkZyZWQsIFdpbG1hLCAmYW1wOyBQZWJibGVzPC9wPidcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gd3JhcCh2YWx1ZSwgd3JhcHBlcikge1xyXG4gICAgICByZXR1cm4gY3JlYXRlV3JhcHBlcih3cmFwcGVyLCAxNiwgW3ZhbHVlXSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGB2YWx1ZWAuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7Kn0gdmFsdWUgVGhlIHZhbHVlIHRvIHJldHVybiBmcm9tIHRoZSBuZXcgZnVuY3Rpb24uXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgdGhlIG5ldyBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIG9iamVjdCA9IHsgJ25hbWUnOiAnZnJlZCcgfTtcclxuICAgICAqIHZhciBnZXR0ZXIgPSBfLmNvbnN0YW50KG9iamVjdCk7XHJcbiAgICAgKiBnZXR0ZXIoKSA9PT0gb2JqZWN0O1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBjb25zdGFudCh2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvZHVjZXMgYSBjYWxsYmFjayBib3VuZCB0byBhbiBvcHRpb25hbCBgdGhpc0FyZ2AuIElmIGBmdW5jYCBpcyBhIHByb3BlcnR5XHJcbiAgICAgKiBuYW1lIHRoZSBjcmVhdGVkIGNhbGxiYWNrIHdpbGwgcmV0dXJuIHRoZSBwcm9wZXJ0eSB2YWx1ZSBmb3IgYSBnaXZlbiBlbGVtZW50LlxyXG4gICAgICogSWYgYGZ1bmNgIGlzIGFuIG9iamVjdCB0aGUgY3JlYXRlZCBjYWxsYmFjayB3aWxsIHJldHVybiBgdHJ1ZWAgZm9yIGVsZW1lbnRzXHJcbiAgICAgKiB0aGF0IGNvbnRhaW4gdGhlIGVxdWl2YWxlbnQgb2JqZWN0IHByb3BlcnRpZXMsIG90aGVyd2lzZSBpdCB3aWxsIHJldHVybiBgZmFsc2VgLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXHJcbiAgICAgKiBAcGFyYW0geyp9IFtmdW5jPWlkZW50aXR5XSBUaGUgdmFsdWUgdG8gY29udmVydCB0byBhIGNhbGxiYWNrLlxyXG4gICAgICogQHBhcmFtIHsqfSBbdGhpc0FyZ10gVGhlIGB0aGlzYCBiaW5kaW5nIG9mIHRoZSBjcmVhdGVkIGNhbGxiYWNrLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFthcmdDb3VudF0gVGhlIG51bWJlciBvZiBhcmd1bWVudHMgdGhlIGNhbGxiYWNrIGFjY2VwdHMuXHJcbiAgICAgKiBAcmV0dXJucyB7RnVuY3Rpb259IFJldHVybnMgYSBjYWxsYmFjayBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGNoYXJhY3RlcnMgPSBbXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnYmFybmV5JywgJ2FnZSc6IDM2IH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAnZnJlZCcsICAgJ2FnZSc6IDQwIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogLy8gd3JhcCB0byBjcmVhdGUgY3VzdG9tIGNhbGxiYWNrIHNob3J0aGFuZHNcclxuICAgICAqIF8uY3JlYXRlQ2FsbGJhY2sgPSBfLndyYXAoXy5jcmVhdGVDYWxsYmFjaywgZnVuY3Rpb24oZnVuYywgY2FsbGJhY2ssIHRoaXNBcmcpIHtcclxuICAgICAqICAgdmFyIG1hdGNoID0gL14oLis/KV9fKFtnbF10KSguKykkLy5leGVjKGNhbGxiYWNrKTtcclxuICAgICAqICAgcmV0dXJuICFtYXRjaCA/IGZ1bmMoY2FsbGJhY2ssIHRoaXNBcmcpIDogZnVuY3Rpb24ob2JqZWN0KSB7XHJcbiAgICAgKiAgICAgcmV0dXJuIG1hdGNoWzJdID09ICdndCcgPyBvYmplY3RbbWF0Y2hbMV1dID4gbWF0Y2hbM10gOiBvYmplY3RbbWF0Y2hbMV1dIDwgbWF0Y2hbM107XHJcbiAgICAgKiAgIH07XHJcbiAgICAgKiB9KTtcclxuICAgICAqXHJcbiAgICAgKiBfLmZpbHRlcihjaGFyYWN0ZXJzLCAnYWdlX19ndDM4Jyk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdmcmVkJywgJ2FnZSc6IDQwIH1dXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIGNyZWF0ZUNhbGxiYWNrKGZ1bmMsIHRoaXNBcmcsIGFyZ0NvdW50KSB7XHJcbiAgICAgIHZhciB0eXBlID0gdHlwZW9mIGZ1bmM7XHJcbiAgICAgIGlmIChmdW5jID09IG51bGwgfHwgdHlwZSA9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgcmV0dXJuIGJhc2VDcmVhdGVDYWxsYmFjayhmdW5jLCB0aGlzQXJnLCBhcmdDb3VudCk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gaGFuZGxlIFwiXy5wbHVja1wiIHN0eWxlIGNhbGxiYWNrIHNob3J0aGFuZHNcclxuICAgICAgaWYgKHR5cGUgIT0gJ29iamVjdCcpIHtcclxuICAgICAgICByZXR1cm4gcHJvcGVydHkoZnVuYyk7XHJcbiAgICAgIH1cclxuICAgICAgdmFyIHByb3BzID0ga2V5cyhmdW5jKSxcclxuICAgICAgICAgIGtleSA9IHByb3BzWzBdLFxyXG4gICAgICAgICAgYSA9IGZ1bmNba2V5XTtcclxuXHJcbiAgICAgIC8vIGhhbmRsZSBcIl8ud2hlcmVcIiBzdHlsZSBjYWxsYmFjayBzaG9ydGhhbmRzXHJcbiAgICAgIGlmIChwcm9wcy5sZW5ndGggPT0gMSAmJiBhID09PSBhICYmICFpc09iamVjdChhKSkge1xyXG4gICAgICAgIC8vIGZhc3QgcGF0aCB0aGUgY29tbW9uIGNhc2Ugb2YgcHJvdmlkaW5nIGFuIG9iamVjdCB3aXRoIGEgc2luZ2xlXHJcbiAgICAgICAgLy8gcHJvcGVydHkgY29udGFpbmluZyBhIHByaW1pdGl2ZSB2YWx1ZVxyXG4gICAgICAgIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICAgIHZhciBiID0gb2JqZWN0W2tleV07XHJcbiAgICAgICAgICByZXR1cm4gYSA9PT0gYiAmJiAoYSAhPT0gMCB8fCAoMSAvIGEgPT0gMSAvIGIpKTtcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICB2YXIgbGVuZ3RoID0gcHJvcHMubGVuZ3RoLFxyXG4gICAgICAgICAgICByZXN1bHQgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgd2hpbGUgKGxlbmd0aC0tKSB7XHJcbiAgICAgICAgICBpZiAoIShyZXN1bHQgPSBiYXNlSXNFcXVhbChvYmplY3RbcHJvcHNbbGVuZ3RoXV0sIGZ1bmNbcHJvcHNbbGVuZ3RoXV0sIG51bGwsIHRydWUpKSkge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgfTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENvbnZlcnRzIHRoZSBjaGFyYWN0ZXJzIGAmYCwgYDxgLCBgPmAsIGBcImAsIGFuZCBgJ2AgaW4gYHN0cmluZ2AgdG8gdGhlaXJcclxuICAgICAqIGNvcnJlc3BvbmRpbmcgSFRNTCBlbnRpdGllcy5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0cmluZyBUaGUgc3RyaW5nIHRvIGVzY2FwZS5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIGVzY2FwZWQgc3RyaW5nLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLmVzY2FwZSgnRnJlZCwgV2lsbWEsICYgUGViYmxlcycpO1xyXG4gICAgICogLy8gPT4gJ0ZyZWQsIFdpbG1hLCAmYW1wOyBQZWJibGVzJ1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBlc2NhcGUoc3RyaW5nKSB7XHJcbiAgICAgIHJldHVybiBzdHJpbmcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHN0cmluZykucmVwbGFjZShyZVVuZXNjYXBlZEh0bWwsIGVzY2FwZUh0bWxDaGFyKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgbWV0aG9kIHJldHVybnMgdGhlIGZpcnN0IGFyZ3VtZW50IHByb3ZpZGVkIHRvIGl0LlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIEFueSB2YWx1ZS5cclxuICAgICAqIEByZXR1cm5zIHsqfSBSZXR1cm5zIGB2YWx1ZWAuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2ZyZWQnIH07XHJcbiAgICAgKiBfLmlkZW50aXR5KG9iamVjdCkgPT09IG9iamVjdDtcclxuICAgICAqIC8vID0+IHRydWVcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gaWRlbnRpdHkodmFsdWUpIHtcclxuICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBmdW5jdGlvbiBwcm9wZXJ0aWVzIG9mIGEgc291cmNlIG9iamVjdCB0byB0aGUgZGVzdGluYXRpb24gb2JqZWN0LlxyXG4gICAgICogSWYgYG9iamVjdGAgaXMgYSBmdW5jdGlvbiBtZXRob2RzIHdpbGwgYmUgYWRkZWQgdG8gaXRzIHByb3RvdHlwZSBhcyB3ZWxsLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gW29iamVjdD1sb2Rhc2hdIG9iamVjdCBUaGUgZGVzdGluYXRpb24gb2JqZWN0LlxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNvdXJjZSBUaGUgb2JqZWN0IG9mIGZ1bmN0aW9ucyB0byBhZGQuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIFRoZSBvcHRpb25zIG9iamVjdC5cclxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdGlvbnMuY2hhaW49dHJ1ZV0gU3BlY2lmeSB3aGV0aGVyIHRoZSBmdW5jdGlvbnMgYWRkZWQgYXJlIGNoYWluYWJsZS5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogZnVuY3Rpb24gY2FwaXRhbGl6ZShzdHJpbmcpIHtcclxuICAgICAqICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICogfVxyXG4gICAgICpcclxuICAgICAqIF8ubWl4aW4oeyAnY2FwaXRhbGl6ZSc6IGNhcGl0YWxpemUgfSk7XHJcbiAgICAgKiBfLmNhcGl0YWxpemUoJ2ZyZWQnKTtcclxuICAgICAqIC8vID0+ICdGcmVkJ1xyXG4gICAgICpcclxuICAgICAqIF8oJ2ZyZWQnKS5jYXBpdGFsaXplKCkudmFsdWUoKTtcclxuICAgICAqIC8vID0+ICdGcmVkJ1xyXG4gICAgICpcclxuICAgICAqIF8ubWl4aW4oeyAnY2FwaXRhbGl6ZSc6IGNhcGl0YWxpemUgfSwgeyAnY2hhaW4nOiBmYWxzZSB9KTtcclxuICAgICAqIF8oJ2ZyZWQnKS5jYXBpdGFsaXplKCk7XHJcbiAgICAgKiAvLyA9PiAnRnJlZCdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gbWl4aW4ob2JqZWN0LCBzb3VyY2UsIG9wdGlvbnMpIHtcclxuICAgICAgdmFyIGNoYWluID0gdHJ1ZSxcclxuICAgICAgICAgIG1ldGhvZE5hbWVzID0gc291cmNlICYmIGZ1bmN0aW9ucyhzb3VyY2UpO1xyXG5cclxuICAgICAgaWYgKCFzb3VyY2UgfHwgKCFvcHRpb25zICYmICFtZXRob2ROYW1lcy5sZW5ndGgpKSB7XHJcbiAgICAgICAgaWYgKG9wdGlvbnMgPT0gbnVsbCkge1xyXG4gICAgICAgICAgb3B0aW9ucyA9IHNvdXJjZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY3RvciA9IGxvZGFzaFdyYXBwZXI7XHJcbiAgICAgICAgc291cmNlID0gb2JqZWN0O1xyXG4gICAgICAgIG9iamVjdCA9IGxvZGFzaDtcclxuICAgICAgICBtZXRob2ROYW1lcyA9IGZ1bmN0aW9ucyhzb3VyY2UpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmIChvcHRpb25zID09PSBmYWxzZSkge1xyXG4gICAgICAgIGNoYWluID0gZmFsc2U7XHJcbiAgICAgIH0gZWxzZSBpZiAoaXNPYmplY3Qob3B0aW9ucykgJiYgJ2NoYWluJyBpbiBvcHRpb25zKSB7XHJcbiAgICAgICAgY2hhaW4gPSBvcHRpb25zLmNoYWluO1xyXG4gICAgICB9XHJcbiAgICAgIHZhciBjdG9yID0gb2JqZWN0LFxyXG4gICAgICAgICAgaXNGdW5jID0gaXNGdW5jdGlvbihjdG9yKTtcclxuXHJcbiAgICAgIGZvckVhY2gobWV0aG9kTmFtZXMsIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcclxuICAgICAgICB2YXIgZnVuYyA9IG9iamVjdFttZXRob2ROYW1lXSA9IHNvdXJjZVttZXRob2ROYW1lXTtcclxuICAgICAgICBpZiAoaXNGdW5jKSB7XHJcbiAgICAgICAgICBjdG9yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgY2hhaW5BbGwgPSB0aGlzLl9fY2hhaW5fXyxcclxuICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpcy5fX3dyYXBwZWRfXyxcclxuICAgICAgICAgICAgICAgIGFyZ3MgPSBbdmFsdWVdO1xyXG5cclxuICAgICAgICAgICAgcHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgICAgICB2YXIgcmVzdWx0ID0gZnVuYy5hcHBseShvYmplY3QsIGFyZ3MpO1xyXG4gICAgICAgICAgICBpZiAoY2hhaW4gfHwgY2hhaW5BbGwpIHtcclxuICAgICAgICAgICAgICBpZiAodmFsdWUgPT09IHJlc3VsdCAmJiBpc09iamVjdChyZXN1bHQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgcmVzdWx0ID0gbmV3IGN0b3IocmVzdWx0KTtcclxuICAgICAgICAgICAgICByZXN1bHQuX19jaGFpbl9fID0gY2hhaW5BbGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFJldmVydHMgdGhlICdfJyB2YXJpYWJsZSB0byBpdHMgcHJldmlvdXMgdmFsdWUgYW5kIHJldHVybnMgYSByZWZlcmVuY2UgdG9cclxuICAgICAqIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBgbG9kYXNoYCBmdW5jdGlvbi5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogdmFyIGxvZGFzaCA9IF8ubm9Db25mbGljdCgpO1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBub0NvbmZsaWN0KCkge1xyXG4gICAgICBjb250ZXh0Ll8gPSBvbGREYXNoO1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEEgbm8tb3BlcmF0aW9uIGZ1bmN0aW9uLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBvYmplY3QgPSB7ICduYW1lJzogJ2ZyZWQnIH07XHJcbiAgICAgKiBfLm5vb3Aob2JqZWN0KSA9PT0gdW5kZWZpbmVkO1xyXG4gICAgICogLy8gPT4gdHJ1ZVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiBub29wKCkge1xyXG4gICAgICAvLyBubyBvcGVyYXRpb24gcGVyZm9ybWVkXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXRzIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIHRoYXQgaGF2ZSBlbGFwc2VkIHNpbmNlIHRoZSBVbml4IGVwb2NoXHJcbiAgICAgKiAoMSBKYW51YXJ5IDE5NzAgMDA6MDA6MDAgVVRDKS5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgc3RhbXAgPSBfLm5vdygpO1xyXG4gICAgICogXy5kZWZlcihmdW5jdGlvbigpIHsgY29uc29sZS5sb2coXy5ub3coKSAtIHN0YW1wKTsgfSk7XHJcbiAgICAgKiAvLyA9PiBsb2dzIHRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIGl0IHRvb2sgZm9yIHRoZSBkZWZlcnJlZCBmdW5jdGlvbiB0byBiZSBjYWxsZWRcclxuICAgICAqL1xyXG4gICAgdmFyIG5vdyA9IGlzTmF0aXZlKG5vdyA9IERhdGUubm93KSAmJiBub3cgfHwgZnVuY3Rpb24oKSB7XHJcbiAgICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcclxuICAgIH07XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDb252ZXJ0cyB0aGUgZ2l2ZW4gdmFsdWUgaW50byBhbiBpbnRlZ2VyIG9mIHRoZSBzcGVjaWZpZWQgcmFkaXguXHJcbiAgICAgKiBJZiBgcmFkaXhgIGlzIGB1bmRlZmluZWRgIG9yIGAwYCBhIGByYWRpeGAgb2YgYDEwYCBpcyB1c2VkIHVubGVzcyB0aGVcclxuICAgICAqIGB2YWx1ZWAgaXMgYSBoZXhhZGVjaW1hbCwgaW4gd2hpY2ggY2FzZSBhIGByYWRpeGAgb2YgYDE2YCBpcyB1c2VkLlxyXG4gICAgICpcclxuICAgICAqIE5vdGU6IFRoaXMgbWV0aG9kIGF2b2lkcyBkaWZmZXJlbmNlcyBpbiBuYXRpdmUgRVMzIGFuZCBFUzUgYHBhcnNlSW50YFxyXG4gICAgICogaW1wbGVtZW50YXRpb25zLiBTZWUgaHR0cDovL2VzNS5naXRodWIuaW8vI0UuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSBUaGUgdmFsdWUgdG8gcGFyc2UuXHJcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gW3JhZGl4XSBUaGUgcmFkaXggdXNlZCB0byBpbnRlcnByZXQgdGhlIHZhbHVlIHRvIHBhcnNlLlxyXG4gICAgICogQHJldHVybnMge251bWJlcn0gUmV0dXJucyB0aGUgbmV3IGludGVnZXIgdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8ucGFyc2VJbnQoJzA4Jyk7XHJcbiAgICAgKiAvLyA9PiA4XHJcbiAgICAgKi9cclxuICAgIHZhciBwYXJzZUludCA9IG5hdGl2ZVBhcnNlSW50KHdoaXRlc3BhY2UgKyAnMDgnKSA9PSA4ID8gbmF0aXZlUGFyc2VJbnQgOiBmdW5jdGlvbih2YWx1ZSwgcmFkaXgpIHtcclxuICAgICAgLy8gRmlyZWZveCA8IDIxIGFuZCBPcGVyYSA8IDE1IGZvbGxvdyB0aGUgRVMzIHNwZWNpZmllZCBpbXBsZW1lbnRhdGlvbiBvZiBgcGFyc2VJbnRgXHJcbiAgICAgIHJldHVybiBuYXRpdmVQYXJzZUludChpc1N0cmluZyh2YWx1ZSkgPyB2YWx1ZS5yZXBsYWNlKHJlTGVhZGluZ1NwYWNlc0FuZFplcm9zLCAnJykgOiB2YWx1ZSwgcmFkaXggfHwgMCk7XHJcbiAgICB9O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIFwiXy5wbHVja1wiIHN0eWxlIGZ1bmN0aW9uLCB3aGljaCByZXR1cm5zIHRoZSBga2V5YCB2YWx1ZSBvZiBhXHJcbiAgICAgKiBnaXZlbiBvYmplY3QuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIHJldHJpZXZlLlxyXG4gICAgICogQHJldHVybnMge0Z1bmN0aW9ufSBSZXR1cm5zIHRoZSBuZXcgZnVuY3Rpb24uXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2ZyZWQnLCAgICdhZ2UnOiA0MCB9LFxyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9XHJcbiAgICAgKiBdO1xyXG4gICAgICpcclxuICAgICAqIHZhciBnZXROYW1lID0gXy5wcm9wZXJ0eSgnbmFtZScpO1xyXG4gICAgICpcclxuICAgICAqIF8ubWFwKGNoYXJhY3RlcnMsIGdldE5hbWUpO1xyXG4gICAgICogLy8gPT4gWydiYXJuZXknLCAnZnJlZCddXHJcbiAgICAgKlxyXG4gICAgICogXy5zb3J0QnkoY2hhcmFjdGVycywgZ2V0TmFtZSk7XHJcbiAgICAgKiAvLyA9PiBbeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSwgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gcHJvcGVydHkoa2V5KSB7XHJcbiAgICAgIHJldHVybiBmdW5jdGlvbihvYmplY3QpIHtcclxuICAgICAgICByZXR1cm4gb2JqZWN0W2tleV07XHJcbiAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQcm9kdWNlcyBhIHJhbmRvbSBudW1iZXIgYmV0d2VlbiBgbWluYCBhbmQgYG1heGAgKGluY2x1c2l2ZSkuIElmIG9ubHkgb25lXHJcbiAgICAgKiBhcmd1bWVudCBpcyBwcm92aWRlZCBhIG51bWJlciBiZXR3ZWVuIGAwYCBhbmQgdGhlIGdpdmVuIG51bWJlciB3aWxsIGJlXHJcbiAgICAgKiByZXR1cm5lZC4gSWYgYGZsb2F0aW5nYCBpcyB0cnVleSBvciBlaXRoZXIgYG1pbmAgb3IgYG1heGAgYXJlIGZsb2F0cyBhXHJcbiAgICAgKiBmbG9hdGluZy1wb2ludCBudW1iZXIgd2lsbCBiZSByZXR1cm5lZCBpbnN0ZWFkIG9mIGFuIGludGVnZXIuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBbbWluPTBdIFRoZSBtaW5pbXVtIHBvc3NpYmxlIHZhbHVlLlxyXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFttYXg9MV0gVGhlIG1heGltdW0gcG9zc2libGUgdmFsdWUuXHJcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtmbG9hdGluZz1mYWxzZV0gU3BlY2lmeSByZXR1cm5pbmcgYSBmbG9hdGluZy1wb2ludCBudW1iZXIuXHJcbiAgICAgKiBAcmV0dXJucyB7bnVtYmVyfSBSZXR1cm5zIGEgcmFuZG9tIG51bWJlci5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXy5yYW5kb20oMCwgNSk7XHJcbiAgICAgKiAvLyA9PiBhbiBpbnRlZ2VyIGJldHdlZW4gMCBhbmQgNVxyXG4gICAgICpcclxuICAgICAqIF8ucmFuZG9tKDUpO1xyXG4gICAgICogLy8gPT4gYWxzbyBhbiBpbnRlZ2VyIGJldHdlZW4gMCBhbmQgNVxyXG4gICAgICpcclxuICAgICAqIF8ucmFuZG9tKDUsIHRydWUpO1xyXG4gICAgICogLy8gPT4gYSBmbG9hdGluZy1wb2ludCBudW1iZXIgYmV0d2VlbiAwIGFuZCA1XHJcbiAgICAgKlxyXG4gICAgICogXy5yYW5kb20oMS4yLCA1LjIpO1xyXG4gICAgICogLy8gPT4gYSBmbG9hdGluZy1wb2ludCBudW1iZXIgYmV0d2VlbiAxLjIgYW5kIDUuMlxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByYW5kb20obWluLCBtYXgsIGZsb2F0aW5nKSB7XHJcbiAgICAgIHZhciBub01pbiA9IG1pbiA9PSBudWxsLFxyXG4gICAgICAgICAgbm9NYXggPSBtYXggPT0gbnVsbDtcclxuXHJcbiAgICAgIGlmIChmbG9hdGluZyA9PSBudWxsKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBtaW4gPT0gJ2Jvb2xlYW4nICYmIG5vTWF4KSB7XHJcbiAgICAgICAgICBmbG9hdGluZyA9IG1pbjtcclxuICAgICAgICAgIG1pbiA9IDE7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKCFub01heCAmJiB0eXBlb2YgbWF4ID09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgZmxvYXRpbmcgPSBtYXg7XHJcbiAgICAgICAgICBub01heCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmIChub01pbiAmJiBub01heCkge1xyXG4gICAgICAgIG1heCA9IDE7XHJcbiAgICAgIH1cclxuICAgICAgbWluID0gK21pbiB8fCAwO1xyXG4gICAgICBpZiAobm9NYXgpIHtcclxuICAgICAgICBtYXggPSBtaW47XHJcbiAgICAgICAgbWluID0gMDtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBtYXggPSArbWF4IHx8IDA7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGZsb2F0aW5nIHx8IG1pbiAlIDEgfHwgbWF4ICUgMSkge1xyXG4gICAgICAgIHZhciByYW5kID0gbmF0aXZlUmFuZG9tKCk7XHJcbiAgICAgICAgcmV0dXJuIG5hdGl2ZU1pbihtaW4gKyAocmFuZCAqIChtYXggLSBtaW4gKyBwYXJzZUZsb2F0KCcxZS0nICsgKChyYW5kICsnJykubGVuZ3RoIC0gMSkpKSksIG1heCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJhc2VSYW5kb20obWluLCBtYXgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVzb2x2ZXMgdGhlIHZhbHVlIG9mIHByb3BlcnR5IGBrZXlgIG9uIGBvYmplY3RgLiBJZiBga2V5YCBpcyBhIGZ1bmN0aW9uXHJcbiAgICAgKiBpdCB3aWxsIGJlIGludm9rZWQgd2l0aCB0aGUgYHRoaXNgIGJpbmRpbmcgb2YgYG9iamVjdGAgYW5kIGl0cyByZXN1bHQgcmV0dXJuZWQsXHJcbiAgICAgKiBlbHNlIHRoZSBwcm9wZXJ0eSB2YWx1ZSBpcyByZXR1cm5lZC4gSWYgYG9iamVjdGAgaXMgZmFsc2V5IHRoZW4gYHVuZGVmaW5lZGBcclxuICAgICAqIGlzIHJldHVybmVkLlxyXG4gICAgICpcclxuICAgICAqIEBzdGF0aWNcclxuICAgICAqIEBtZW1iZXJPZiBfXHJcbiAgICAgKiBAY2F0ZWdvcnkgVXRpbGl0aWVzXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb2JqZWN0IFRoZSBvYmplY3QgdG8gaW5zcGVjdC5cclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgVGhlIG5hbWUgb2YgdGhlIHByb3BlcnR5IHRvIHJlc29sdmUuXHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgcmVzb2x2ZWQgdmFsdWUuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBvYmplY3QgPSB7XHJcbiAgICAgKiAgICdjaGVlc2UnOiAnY3J1bXBldHMnLFxyXG4gICAgICogICAnc3R1ZmYnOiBmdW5jdGlvbigpIHtcclxuICAgICAqICAgICByZXR1cm4gJ25vbnNlbnNlJztcclxuICAgICAqICAgfVxyXG4gICAgICogfTtcclxuICAgICAqXHJcbiAgICAgKiBfLnJlc3VsdChvYmplY3QsICdjaGVlc2UnKTtcclxuICAgICAqIC8vID0+ICdjcnVtcGV0cydcclxuICAgICAqXHJcbiAgICAgKiBfLnJlc3VsdChvYmplY3QsICdzdHVmZicpO1xyXG4gICAgICogLy8gPT4gJ25vbnNlbnNlJ1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiByZXN1bHQob2JqZWN0LCBrZXkpIHtcclxuICAgICAgaWYgKG9iamVjdCkge1xyXG4gICAgICAgIHZhciB2YWx1ZSA9IG9iamVjdFtrZXldO1xyXG4gICAgICAgIHJldHVybiBpc0Z1bmN0aW9uKHZhbHVlKSA/IG9iamVjdFtrZXldKCkgOiB2YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQSBtaWNyby10ZW1wbGF0aW5nIG1ldGhvZCB0aGF0IGhhbmRsZXMgYXJiaXRyYXJ5IGRlbGltaXRlcnMsIHByZXNlcnZlc1xyXG4gICAgICogd2hpdGVzcGFjZSwgYW5kIGNvcnJlY3RseSBlc2NhcGVzIHF1b3RlcyB3aXRoaW4gaW50ZXJwb2xhdGVkIGNvZGUuXHJcbiAgICAgKlxyXG4gICAgICogTm90ZTogSW4gdGhlIGRldmVsb3BtZW50IGJ1aWxkLCBgXy50ZW1wbGF0ZWAgdXRpbGl6ZXMgc291cmNlVVJMcyBmb3IgZWFzaWVyXHJcbiAgICAgKiBkZWJ1Z2dpbmcuIFNlZSBodHRwOi8vd3d3Lmh0bWw1cm9ja3MuY29tL2VuL3R1dG9yaWFscy9kZXZlbG9wZXJ0b29scy9zb3VyY2VtYXBzLyN0b2Mtc291cmNldXJsXHJcbiAgICAgKlxyXG4gICAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gcHJlY29tcGlsaW5nIHRlbXBsYXRlcyBzZWU6XHJcbiAgICAgKiBodHRwOi8vbG9kYXNoLmNvbS9jdXN0b20tYnVpbGRzXHJcbiAgICAgKlxyXG4gICAgICogRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gQ2hyb21lIGV4dGVuc2lvbiBzYW5kYm94ZXMgc2VlOlxyXG4gICAgICogaHR0cDovL2RldmVsb3Blci5jaHJvbWUuY29tL3N0YWJsZS9leHRlbnNpb25zL3NhbmRib3hpbmdFdmFsLmh0bWxcclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IFV0aWxpdGllc1xyXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHRleHQgVGhlIHRlbXBsYXRlIHRleHQuXHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSBUaGUgZGF0YSBvYmplY3QgdXNlZCB0byBwb3B1bGF0ZSB0aGUgdGV4dC5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gVGhlIG9wdGlvbnMgb2JqZWN0LlxyXG4gICAgICogQHBhcmFtIHtSZWdFeHB9IFtvcHRpb25zLmVzY2FwZV0gVGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyLlxyXG4gICAgICogQHBhcmFtIHtSZWdFeHB9IFtvcHRpb25zLmV2YWx1YXRlXSBUaGUgXCJldmFsdWF0ZVwiIGRlbGltaXRlci5cclxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucy5pbXBvcnRzXSBBbiBvYmplY3QgdG8gaW1wb3J0IGludG8gdGhlIHRlbXBsYXRlIGFzIGxvY2FsIHZhcmlhYmxlcy5cclxuICAgICAqIEBwYXJhbSB7UmVnRXhwfSBbb3B0aW9ucy5pbnRlcnBvbGF0ZV0gVGhlIFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXIuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3NvdXJjZVVSTF0gVGhlIHNvdXJjZVVSTCBvZiB0aGUgdGVtcGxhdGUncyBjb21waWxlZCBzb3VyY2UuXHJcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3ZhcmlhYmxlXSBUaGUgZGF0YSBvYmplY3QgdmFyaWFibGUgbmFtZS5cclxuICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbnxzdHJpbmd9IFJldHVybnMgYSBjb21waWxlZCBmdW5jdGlvbiB3aGVuIG5vIGBkYXRhYCBvYmplY3RcclxuICAgICAqICBpcyBnaXZlbiwgZWxzZSBpdCByZXR1cm5zIHRoZSBpbnRlcnBvbGF0ZWQgdGV4dC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgdGhlIFwiaW50ZXJwb2xhdGVcIiBkZWxpbWl0ZXIgdG8gY3JlYXRlIGEgY29tcGlsZWQgdGVtcGxhdGVcclxuICAgICAqIHZhciBjb21waWxlZCA9IF8udGVtcGxhdGUoJ2hlbGxvIDwlPSBuYW1lICU+Jyk7XHJcbiAgICAgKiBjb21waWxlZCh7ICduYW1lJzogJ2ZyZWQnIH0pO1xyXG4gICAgICogLy8gPT4gJ2hlbGxvIGZyZWQnXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgdGhlIFwiZXNjYXBlXCIgZGVsaW1pdGVyIHRvIGVzY2FwZSBIVE1MIGluIGRhdGEgcHJvcGVydHkgdmFsdWVzXHJcbiAgICAgKiBfLnRlbXBsYXRlKCc8Yj48JS0gdmFsdWUgJT48L2I+JywgeyAndmFsdWUnOiAnPHNjcmlwdD4nIH0pO1xyXG4gICAgICogLy8gPT4gJzxiPiZsdDtzY3JpcHQmZ3Q7PC9iPidcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyB0aGUgXCJldmFsdWF0ZVwiIGRlbGltaXRlciB0byBnZW5lcmF0ZSBIVE1MXHJcbiAgICAgKiB2YXIgbGlzdCA9ICc8JSBfLmZvckVhY2gocGVvcGxlLCBmdW5jdGlvbihuYW1lKSB7ICU+PGxpPjwlLSBuYW1lICU+PC9saT48JSB9KTsgJT4nO1xyXG4gICAgICogXy50ZW1wbGF0ZShsaXN0LCB7ICdwZW9wbGUnOiBbJ2ZyZWQnLCAnYmFybmV5J10gfSk7XHJcbiAgICAgKiAvLyA9PiAnPGxpPmZyZWQ8L2xpPjxsaT5iYXJuZXk8L2xpPidcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyB0aGUgRVM2IGRlbGltaXRlciBhcyBhbiBhbHRlcm5hdGl2ZSB0byB0aGUgZGVmYXVsdCBcImludGVycG9sYXRlXCIgZGVsaW1pdGVyXHJcbiAgICAgKiBfLnRlbXBsYXRlKCdoZWxsbyAkeyBuYW1lIH0nLCB7ICduYW1lJzogJ3BlYmJsZXMnIH0pO1xyXG4gICAgICogLy8gPT4gJ2hlbGxvIHBlYmJsZXMnXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgdGhlIGludGVybmFsIGBwcmludGAgZnVuY3Rpb24gaW4gXCJldmFsdWF0ZVwiIGRlbGltaXRlcnNcclxuICAgICAqIF8udGVtcGxhdGUoJzwlIHByaW50KFwiaGVsbG8gXCIgKyBuYW1lKTsgJT4hJywgeyAnbmFtZSc6ICdiYXJuZXknIH0pO1xyXG4gICAgICogLy8gPT4gJ2hlbGxvIGJhcm5leSEnXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgYSBjdXN0b20gdGVtcGxhdGUgZGVsaW1pdGVyc1xyXG4gICAgICogXy50ZW1wbGF0ZVNldHRpbmdzID0ge1xyXG4gICAgICogICAnaW50ZXJwb2xhdGUnOiAve3soW1xcc1xcU10rPyl9fS9nXHJcbiAgICAgKiB9O1xyXG4gICAgICpcclxuICAgICAqIF8udGVtcGxhdGUoJ2hlbGxvIHt7IG5hbWUgfX0hJywgeyAnbmFtZSc6ICdtdXN0YWNoZScgfSk7XHJcbiAgICAgKiAvLyA9PiAnaGVsbG8gbXVzdGFjaGUhJ1xyXG4gICAgICpcclxuICAgICAqIC8vIHVzaW5nIHRoZSBgaW1wb3J0c2Agb3B0aW9uIHRvIGltcG9ydCBqUXVlcnlcclxuICAgICAqIHZhciBsaXN0ID0gJzwlIGpxLmVhY2gocGVvcGxlLCBmdW5jdGlvbihuYW1lKSB7ICU+PGxpPjwlLSBuYW1lICU+PC9saT48JSB9KTsgJT4nO1xyXG4gICAgICogXy50ZW1wbGF0ZShsaXN0LCB7ICdwZW9wbGUnOiBbJ2ZyZWQnLCAnYmFybmV5J10gfSwgeyAnaW1wb3J0cyc6IHsgJ2pxJzogalF1ZXJ5IH0gfSk7XHJcbiAgICAgKiAvLyA9PiAnPGxpPmZyZWQ8L2xpPjxsaT5iYXJuZXk8L2xpPidcclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyB0aGUgYHNvdXJjZVVSTGAgb3B0aW9uIHRvIHNwZWNpZnkgYSBjdXN0b20gc291cmNlVVJMIGZvciB0aGUgdGVtcGxhdGVcclxuICAgICAqIHZhciBjb21waWxlZCA9IF8udGVtcGxhdGUoJ2hlbGxvIDwlPSBuYW1lICU+JywgbnVsbCwgeyAnc291cmNlVVJMJzogJy9iYXNpYy9ncmVldGluZy5qc3QnIH0pO1xyXG4gICAgICogY29tcGlsZWQoZGF0YSk7XHJcbiAgICAgKiAvLyA9PiBmaW5kIHRoZSBzb3VyY2Ugb2YgXCJncmVldGluZy5qc3RcIiB1bmRlciB0aGUgU291cmNlcyB0YWIgb3IgUmVzb3VyY2VzIHBhbmVsIG9mIHRoZSB3ZWIgaW5zcGVjdG9yXHJcbiAgICAgKlxyXG4gICAgICogLy8gdXNpbmcgdGhlIGB2YXJpYWJsZWAgb3B0aW9uIHRvIGVuc3VyZSBhIHdpdGgtc3RhdGVtZW50IGlzbid0IHVzZWQgaW4gdGhlIGNvbXBpbGVkIHRlbXBsYXRlXHJcbiAgICAgKiB2YXIgY29tcGlsZWQgPSBfLnRlbXBsYXRlKCdoaSA8JT0gZGF0YS5uYW1lICU+IScsIG51bGwsIHsgJ3ZhcmlhYmxlJzogJ2RhdGEnIH0pO1xyXG4gICAgICogY29tcGlsZWQuc291cmNlO1xyXG4gICAgICogLy8gPT4gZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICogICB2YXIgX190LCBfX3AgPSAnJywgX19lID0gXy5lc2NhcGU7XHJcbiAgICAgKiAgIF9fcCArPSAnaGkgJyArICgoX190ID0gKCBkYXRhLm5hbWUgKSkgPT0gbnVsbCA/ICcnIDogX190KSArICchJztcclxuICAgICAqICAgcmV0dXJuIF9fcDtcclxuICAgICAqIH1cclxuICAgICAqXHJcbiAgICAgKiAvLyB1c2luZyB0aGUgYHNvdXJjZWAgcHJvcGVydHkgdG8gaW5saW5lIGNvbXBpbGVkIHRlbXBsYXRlcyBmb3IgbWVhbmluZ2Z1bFxyXG4gICAgICogLy8gbGluZSBudW1iZXJzIGluIGVycm9yIG1lc3NhZ2VzIGFuZCBhIHN0YWNrIHRyYWNlXHJcbiAgICAgKiBmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihjd2QsICdqc3QuanMnKSwgJ1xcXHJcbiAgICAgKiAgIHZhciBKU1QgPSB7XFxcclxuICAgICAqICAgICBcIm1haW5cIjogJyArIF8udGVtcGxhdGUobWFpblRleHQpLnNvdXJjZSArICdcXFxyXG4gICAgICogICB9O1xcXHJcbiAgICAgKiAnKTtcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gdGVtcGxhdGUodGV4dCwgZGF0YSwgb3B0aW9ucykge1xyXG4gICAgICAvLyBiYXNlZCBvbiBKb2huIFJlc2lnJ3MgYHRtcGxgIGltcGxlbWVudGF0aW9uXHJcbiAgICAgIC8vIGh0dHA6Ly9lam9obi5vcmcvYmxvZy9qYXZhc2NyaXB0LW1pY3JvLXRlbXBsYXRpbmcvXHJcbiAgICAgIC8vIGFuZCBMYXVyYSBEb2t0b3JvdmEncyBkb1QuanNcclxuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL29sYWRvL2RvVFxyXG4gICAgICB2YXIgc2V0dGluZ3MgPSBsb2Rhc2gudGVtcGxhdGVTZXR0aW5ncztcclxuICAgICAgdGV4dCA9IFN0cmluZyh0ZXh0IHx8ICcnKTtcclxuXHJcbiAgICAgIC8vIGF2b2lkIG1pc3NpbmcgZGVwZW5kZW5jaWVzIHdoZW4gYGl0ZXJhdG9yVGVtcGxhdGVgIGlzIG5vdCBkZWZpbmVkXHJcbiAgICAgIG9wdGlvbnMgPSBkZWZhdWx0cyh7fSwgb3B0aW9ucywgc2V0dGluZ3MpO1xyXG5cclxuICAgICAgdmFyIGltcG9ydHMgPSBkZWZhdWx0cyh7fSwgb3B0aW9ucy5pbXBvcnRzLCBzZXR0aW5ncy5pbXBvcnRzKSxcclxuICAgICAgICAgIGltcG9ydHNLZXlzID0ga2V5cyhpbXBvcnRzKSxcclxuICAgICAgICAgIGltcG9ydHNWYWx1ZXMgPSB2YWx1ZXMoaW1wb3J0cyk7XHJcblxyXG4gICAgICB2YXIgaXNFdmFsdWF0aW5nLFxyXG4gICAgICAgICAgaW5kZXggPSAwLFxyXG4gICAgICAgICAgaW50ZXJwb2xhdGUgPSBvcHRpb25zLmludGVycG9sYXRlIHx8IHJlTm9NYXRjaCxcclxuICAgICAgICAgIHNvdXJjZSA9IFwiX19wICs9ICdcIjtcclxuXHJcbiAgICAgIC8vIGNvbXBpbGUgdGhlIHJlZ2V4cCB0byBtYXRjaCBlYWNoIGRlbGltaXRlclxyXG4gICAgICB2YXIgcmVEZWxpbWl0ZXJzID0gUmVnRXhwKFxyXG4gICAgICAgIChvcHRpb25zLmVzY2FwZSB8fCByZU5vTWF0Y2gpLnNvdXJjZSArICd8JyArXHJcbiAgICAgICAgaW50ZXJwb2xhdGUuc291cmNlICsgJ3wnICtcclxuICAgICAgICAoaW50ZXJwb2xhdGUgPT09IHJlSW50ZXJwb2xhdGUgPyByZUVzVGVtcGxhdGUgOiByZU5vTWF0Y2gpLnNvdXJjZSArICd8JyArXHJcbiAgICAgICAgKG9wdGlvbnMuZXZhbHVhdGUgfHwgcmVOb01hdGNoKS5zb3VyY2UgKyAnfCQnXHJcbiAgICAgICwgJ2cnKTtcclxuXHJcbiAgICAgIHRleHQucmVwbGFjZShyZURlbGltaXRlcnMsIGZ1bmN0aW9uKG1hdGNoLCBlc2NhcGVWYWx1ZSwgaW50ZXJwb2xhdGVWYWx1ZSwgZXNUZW1wbGF0ZVZhbHVlLCBldmFsdWF0ZVZhbHVlLCBvZmZzZXQpIHtcclxuICAgICAgICBpbnRlcnBvbGF0ZVZhbHVlIHx8IChpbnRlcnBvbGF0ZVZhbHVlID0gZXNUZW1wbGF0ZVZhbHVlKTtcclxuXHJcbiAgICAgICAgLy8gZXNjYXBlIGNoYXJhY3RlcnMgdGhhdCBjYW5ub3QgYmUgaW5jbHVkZWQgaW4gc3RyaW5nIGxpdGVyYWxzXHJcbiAgICAgICAgc291cmNlICs9IHRleHQuc2xpY2UoaW5kZXgsIG9mZnNldCkucmVwbGFjZShyZVVuZXNjYXBlZFN0cmluZywgZXNjYXBlU3RyaW5nQ2hhcik7XHJcblxyXG4gICAgICAgIC8vIHJlcGxhY2UgZGVsaW1pdGVycyB3aXRoIHNuaXBwZXRzXHJcbiAgICAgICAgaWYgKGVzY2FwZVZhbHVlKSB7XHJcbiAgICAgICAgICBzb3VyY2UgKz0gXCInICtcXG5fX2UoXCIgKyBlc2NhcGVWYWx1ZSArIFwiKSArXFxuJ1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZXZhbHVhdGVWYWx1ZSkge1xyXG4gICAgICAgICAgaXNFdmFsdWF0aW5nID0gdHJ1ZTtcclxuICAgICAgICAgIHNvdXJjZSArPSBcIic7XFxuXCIgKyBldmFsdWF0ZVZhbHVlICsgXCI7XFxuX19wICs9ICdcIjtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGludGVycG9sYXRlVmFsdWUpIHtcclxuICAgICAgICAgIHNvdXJjZSArPSBcIicgK1xcbigoX190ID0gKFwiICsgaW50ZXJwb2xhdGVWYWx1ZSArIFwiKSkgPT0gbnVsbCA/ICcnIDogX190KSArXFxuJ1wiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpbmRleCA9IG9mZnNldCArIG1hdGNoLmxlbmd0aDtcclxuXHJcbiAgICAgICAgLy8gdGhlIEpTIGVuZ2luZSBlbWJlZGRlZCBpbiBBZG9iZSBwcm9kdWN0cyByZXF1aXJlcyByZXR1cm5pbmcgdGhlIGBtYXRjaGBcclxuICAgICAgICAvLyBzdHJpbmcgaW4gb3JkZXIgdG8gcHJvZHVjZSB0aGUgY29ycmVjdCBgb2Zmc2V0YCB2YWx1ZVxyXG4gICAgICAgIHJldHVybiBtYXRjaDtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBzb3VyY2UgKz0gXCInO1xcblwiO1xyXG5cclxuICAgICAgLy8gaWYgYHZhcmlhYmxlYCBpcyBub3Qgc3BlY2lmaWVkLCB3cmFwIGEgd2l0aC1zdGF0ZW1lbnQgYXJvdW5kIHRoZSBnZW5lcmF0ZWRcclxuICAgICAgLy8gY29kZSB0byBhZGQgdGhlIGRhdGEgb2JqZWN0IHRvIHRoZSB0b3Agb2YgdGhlIHNjb3BlIGNoYWluXHJcbiAgICAgIHZhciB2YXJpYWJsZSA9IG9wdGlvbnMudmFyaWFibGUsXHJcbiAgICAgICAgICBoYXNWYXJpYWJsZSA9IHZhcmlhYmxlO1xyXG5cclxuICAgICAgaWYgKCFoYXNWYXJpYWJsZSkge1xyXG4gICAgICAgIHZhcmlhYmxlID0gJ29iaic7XHJcbiAgICAgICAgc291cmNlID0gJ3dpdGggKCcgKyB2YXJpYWJsZSArICcpIHtcXG4nICsgc291cmNlICsgJ1xcbn1cXG4nO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIGNsZWFudXAgY29kZSBieSBzdHJpcHBpbmcgZW1wdHkgc3RyaW5nc1xyXG4gICAgICBzb3VyY2UgPSAoaXNFdmFsdWF0aW5nID8gc291cmNlLnJlcGxhY2UocmVFbXB0eVN0cmluZ0xlYWRpbmcsICcnKSA6IHNvdXJjZSlcclxuICAgICAgICAucmVwbGFjZShyZUVtcHR5U3RyaW5nTWlkZGxlLCAnJDEnKVxyXG4gICAgICAgIC5yZXBsYWNlKHJlRW1wdHlTdHJpbmdUcmFpbGluZywgJyQxOycpO1xyXG5cclxuICAgICAgLy8gZnJhbWUgY29kZSBhcyB0aGUgZnVuY3Rpb24gYm9keVxyXG4gICAgICBzb3VyY2UgPSAnZnVuY3Rpb24oJyArIHZhcmlhYmxlICsgJykge1xcbicgK1xyXG4gICAgICAgIChoYXNWYXJpYWJsZSA/ICcnIDogdmFyaWFibGUgKyAnIHx8ICgnICsgdmFyaWFibGUgKyAnID0ge30pO1xcbicpICtcclxuICAgICAgICBcInZhciBfX3QsIF9fcCA9ICcnLCBfX2UgPSBfLmVzY2FwZVwiICtcclxuICAgICAgICAoaXNFdmFsdWF0aW5nXHJcbiAgICAgICAgICA/ICcsIF9faiA9IEFycmF5LnByb3RvdHlwZS5qb2luO1xcbicgK1xyXG4gICAgICAgICAgICBcImZ1bmN0aW9uIHByaW50KCkgeyBfX3AgKz0gX19qLmNhbGwoYXJndW1lbnRzLCAnJykgfVxcblwiXHJcbiAgICAgICAgICA6ICc7XFxuJ1xyXG4gICAgICAgICkgK1xyXG4gICAgICAgIHNvdXJjZSArXHJcbiAgICAgICAgJ3JldHVybiBfX3BcXG59JztcclxuXHJcbiAgICAgIC8vIFVzZSBhIHNvdXJjZVVSTCBmb3IgZWFzaWVyIGRlYnVnZ2luZy5cclxuICAgICAgLy8gaHR0cDovL3d3dy5odG1sNXJvY2tzLmNvbS9lbi90dXRvcmlhbHMvZGV2ZWxvcGVydG9vbHMvc291cmNlbWFwcy8jdG9jLXNvdXJjZXVybFxyXG4gICAgICB2YXIgc291cmNlVVJMID0gJ1xcbi8qXFxuLy8jIHNvdXJjZVVSTD0nICsgKG9wdGlvbnMuc291cmNlVVJMIHx8ICcvbG9kYXNoL3RlbXBsYXRlL3NvdXJjZVsnICsgKHRlbXBsYXRlQ291bnRlcisrKSArICddJykgKyAnXFxuKi8nO1xyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gRnVuY3Rpb24oaW1wb3J0c0tleXMsICdyZXR1cm4gJyArIHNvdXJjZSArIHNvdXJjZVVSTCkuYXBwbHkodW5kZWZpbmVkLCBpbXBvcnRzVmFsdWVzKTtcclxuICAgICAgfSBjYXRjaChlKSB7XHJcbiAgICAgICAgZS5zb3VyY2UgPSBzb3VyY2U7XHJcbiAgICAgICAgdGhyb3cgZTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoZGF0YSkge1xyXG4gICAgICAgIHJldHVybiByZXN1bHQoZGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgLy8gcHJvdmlkZSB0aGUgY29tcGlsZWQgZnVuY3Rpb24ncyBzb3VyY2UgYnkgaXRzIGB0b1N0cmluZ2AgbWV0aG9kLCBpblxyXG4gICAgICAvLyBzdXBwb3J0ZWQgZW52aXJvbm1lbnRzLCBvciB0aGUgYHNvdXJjZWAgcHJvcGVydHkgYXMgYSBjb252ZW5pZW5jZSBmb3JcclxuICAgICAgLy8gaW5saW5pbmcgY29tcGlsZWQgdGVtcGxhdGVzIGR1cmluZyB0aGUgYnVpbGQgcHJvY2Vzc1xyXG4gICAgICByZXN1bHQuc291cmNlID0gc291cmNlO1xyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXhlY3V0ZXMgdGhlIGNhbGxiYWNrIGBuYCB0aW1lcywgcmV0dXJuaW5nIGFuIGFycmF5IG9mIHRoZSByZXN1bHRzXHJcbiAgICAgKiBvZiBlYWNoIGNhbGxiYWNrIGV4ZWN1dGlvbi4gVGhlIGNhbGxiYWNrIGlzIGJvdW5kIHRvIGB0aGlzQXJnYCBhbmQgaW52b2tlZFxyXG4gICAgICogd2l0aCBvbmUgYXJndW1lbnQ7IChpbmRleCkuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBuIFRoZSBudW1iZXIgb2YgdGltZXMgdG8gZXhlY3V0ZSB0aGUgY2FsbGJhY2suXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gY2FsbGVkIHBlciBpdGVyYXRpb24uXHJcbiAgICAgKiBAcGFyYW0geyp9IFt0aGlzQXJnXSBUaGUgYHRoaXNgIGJpbmRpbmcgb2YgYGNhbGxiYWNrYC5cclxuICAgICAqIEByZXR1cm5zIHtBcnJheX0gUmV0dXJucyBhbiBhcnJheSBvZiB0aGUgcmVzdWx0cyBvZiBlYWNoIGBjYWxsYmFja2AgZXhlY3V0aW9uLlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgZGljZVJvbGxzID0gXy50aW1lcygzLCBfLnBhcnRpYWwoXy5yYW5kb20sIDEsIDYpKTtcclxuICAgICAqIC8vID0+IFszLCA2LCA0XVxyXG4gICAgICpcclxuICAgICAqIF8udGltZXMoMywgZnVuY3Rpb24obikgeyBtYWdlLmNhc3RTcGVsbChuKTsgfSk7XHJcbiAgICAgKiAvLyA9PiBjYWxscyBgbWFnZS5jYXN0U3BlbGwobilgIHRocmVlIHRpbWVzLCBwYXNzaW5nIGBuYCBvZiBgMGAsIGAxYCwgYW5kIGAyYCByZXNwZWN0aXZlbHlcclxuICAgICAqXHJcbiAgICAgKiBfLnRpbWVzKDMsIGZ1bmN0aW9uKG4pIHsgdGhpcy5jYXN0KG4pOyB9LCBtYWdlKTtcclxuICAgICAqIC8vID0+IGFsc28gY2FsbHMgYG1hZ2UuY2FzdFNwZWxsKG4pYCB0aHJlZSB0aW1lc1xyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiB0aW1lcyhuLCBjYWxsYmFjaywgdGhpc0FyZykge1xyXG4gICAgICBuID0gKG4gPSArbikgPiAtMSA/IG4gOiAwO1xyXG4gICAgICB2YXIgaW5kZXggPSAtMSxcclxuICAgICAgICAgIHJlc3VsdCA9IEFycmF5KG4pO1xyXG5cclxuICAgICAgY2FsbGJhY2sgPSBiYXNlQ3JlYXRlQ2FsbGJhY2soY2FsbGJhY2ssIHRoaXNBcmcsIDEpO1xyXG4gICAgICB3aGlsZSAoKytpbmRleCA8IG4pIHtcclxuICAgICAgICByZXN1bHRbaW5kZXhdID0gY2FsbGJhY2soaW5kZXgpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgaW52ZXJzZSBvZiBgXy5lc2NhcGVgIHRoaXMgbWV0aG9kIGNvbnZlcnRzIHRoZSBIVE1MIGVudGl0aWVzXHJcbiAgICAgKiBgJmFtcDtgLCBgJmx0O2AsIGAmZ3Q7YCwgYCZxdW90O2AsIGFuZCBgJiMzOTtgIGluIGBzdHJpbmdgIHRvIHRoZWlyXHJcbiAgICAgKiBjb3JyZXNwb25kaW5nIGNoYXJhY3RlcnMuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdHJpbmcgVGhlIHN0cmluZyB0byB1bmVzY2FwZS5cclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgdGhlIHVuZXNjYXBlZCBzdHJpbmcuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIF8udW5lc2NhcGUoJ0ZyZWQsIEJhcm5leSAmYW1wOyBQZWJibGVzJyk7XHJcbiAgICAgKiAvLyA9PiAnRnJlZCwgQmFybmV5ICYgUGViYmxlcydcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gdW5lc2NhcGUoc3RyaW5nKSB7XHJcbiAgICAgIHJldHVybiBzdHJpbmcgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHN0cmluZykucmVwbGFjZShyZUVzY2FwZWRIdG1sLCB1bmVzY2FwZUh0bWxDaGFyKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdlbmVyYXRlcyBhIHVuaXF1ZSBJRC4gSWYgYHByZWZpeGAgaXMgcHJvdmlkZWQgdGhlIElEIHdpbGwgYmUgYXBwZW5kZWQgdG8gaXQuXHJcbiAgICAgKlxyXG4gICAgICogQHN0YXRpY1xyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBVdGlsaXRpZXNcclxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbcHJlZml4XSBUaGUgdmFsdWUgdG8gcHJlZml4IHRoZSBJRCB3aXRoLlxyXG4gICAgICogQHJldHVybnMge3N0cmluZ30gUmV0dXJucyB0aGUgdW5pcXVlIElELlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfLnVuaXF1ZUlkKCdjb250YWN0XycpO1xyXG4gICAgICogLy8gPT4gJ2NvbnRhY3RfMTA0J1xyXG4gICAgICpcclxuICAgICAqIF8udW5pcXVlSWQoKTtcclxuICAgICAqIC8vID0+ICcxMDUnXHJcbiAgICAgKi9cclxuICAgIGZ1bmN0aW9uIHVuaXF1ZUlkKHByZWZpeCkge1xyXG4gICAgICB2YXIgaWQgPSArK2lkQ291bnRlcjtcclxuICAgICAgcmV0dXJuIFN0cmluZyhwcmVmaXggPT0gbnVsbCA/ICcnIDogcHJlZml4KSArIGlkO1xyXG4gICAgfVxyXG5cclxuICAgIC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIGBsb2Rhc2hgIG9iamVjdCB0aGF0IHdyYXBzIHRoZSBnaXZlbiB2YWx1ZSB3aXRoIGV4cGxpY2l0XHJcbiAgICAgKiBtZXRob2QgY2hhaW5pbmcgZW5hYmxlZC5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byB3cmFwLlxyXG4gICAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyB0aGUgd3JhcHBlciBvYmplY3QuXHJcbiAgICAgKiBAZXhhbXBsZVxyXG4gICAgICpcclxuICAgICAqIHZhciBjaGFyYWN0ZXJzID0gW1xyXG4gICAgICogICB7ICduYW1lJzogJ2Jhcm5leScsICAnYWdlJzogMzYgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAgJ2FnZSc6IDQwIH0sXHJcbiAgICAgKiAgIHsgJ25hbWUnOiAncGViYmxlcycsICdhZ2UnOiAxIH1cclxuICAgICAqIF07XHJcbiAgICAgKlxyXG4gICAgICogdmFyIHlvdW5nZXN0ID0gXy5jaGFpbihjaGFyYWN0ZXJzKVxyXG4gICAgICogICAgIC5zb3J0QnkoJ2FnZScpXHJcbiAgICAgKiAgICAgLm1hcChmdW5jdGlvbihjaHIpIHsgcmV0dXJuIGNoci5uYW1lICsgJyBpcyAnICsgY2hyLmFnZTsgfSlcclxuICAgICAqICAgICAuZmlyc3QoKVxyXG4gICAgICogICAgIC52YWx1ZSgpO1xyXG4gICAgICogLy8gPT4gJ3BlYmJsZXMgaXMgMSdcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gY2hhaW4odmFsdWUpIHtcclxuICAgICAgdmFsdWUgPSBuZXcgbG9kYXNoV3JhcHBlcih2YWx1ZSk7XHJcbiAgICAgIHZhbHVlLl9fY2hhaW5fXyA9IHRydWU7XHJcbiAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEludm9rZXMgYGludGVyY2VwdG9yYCB3aXRoIHRoZSBgdmFsdWVgIGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQgdGhlblxyXG4gICAgICogcmV0dXJucyBgdmFsdWVgLiBUaGUgcHVycG9zZSBvZiB0aGlzIG1ldGhvZCBpcyB0byBcInRhcCBpbnRvXCIgYSBtZXRob2RcclxuICAgICAqIGNoYWluIGluIG9yZGVyIHRvIHBlcmZvcm0gb3BlcmF0aW9ucyBvbiBpbnRlcm1lZGlhdGUgcmVzdWx0cyB3aXRoaW5cclxuICAgICAqIHRoZSBjaGFpbi5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXHJcbiAgICAgKiBAcGFyYW0geyp9IHZhbHVlIFRoZSB2YWx1ZSB0byBwcm92aWRlIHRvIGBpbnRlcmNlcHRvcmAuXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBpbnRlcmNlcHRvciBUaGUgZnVuY3Rpb24gdG8gaW52b2tlLlxyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgYHZhbHVlYC5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXyhbMSwgMiwgMywgNF0pXHJcbiAgICAgKiAgLnRhcChmdW5jdGlvbihhcnJheSkgeyBhcnJheS5wb3AoKTsgfSlcclxuICAgICAqICAucmV2ZXJzZSgpXHJcbiAgICAgKiAgLnZhbHVlKCk7XHJcbiAgICAgKiAvLyA9PiBbMywgMiwgMV1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gdGFwKHZhbHVlLCBpbnRlcmNlcHRvcikge1xyXG4gICAgICBpbnRlcmNlcHRvcih2YWx1ZSk7XHJcbiAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVuYWJsZXMgZXhwbGljaXQgbWV0aG9kIGNoYWluaW5nIG9uIHRoZSB3cmFwcGVyIG9iamVjdC5cclxuICAgICAqXHJcbiAgICAgKiBAbmFtZSBjaGFpblxyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBjYXRlZ29yeSBDaGFpbmluZ1xyXG4gICAgICogQHJldHVybnMgeyp9IFJldHVybnMgdGhlIHdyYXBwZXIgb2JqZWN0LlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiB2YXIgY2hhcmFjdGVycyA9IFtcclxuICAgICAqICAgeyAnbmFtZSc6ICdiYXJuZXknLCAnYWdlJzogMzYgfSxcclxuICAgICAqICAgeyAnbmFtZSc6ICdmcmVkJywgICAnYWdlJzogNDAgfVxyXG4gICAgICogXTtcclxuICAgICAqXHJcbiAgICAgKiAvLyB3aXRob3V0IGV4cGxpY2l0IGNoYWluaW5nXHJcbiAgICAgKiBfKGNoYXJhY3RlcnMpLmZpcnN0KCk7XHJcbiAgICAgKiAvLyA9PiB7ICduYW1lJzogJ2Jhcm5leScsICdhZ2UnOiAzNiB9XHJcbiAgICAgKlxyXG4gICAgICogLy8gd2l0aCBleHBsaWNpdCBjaGFpbmluZ1xyXG4gICAgICogXyhjaGFyYWN0ZXJzKS5jaGFpbigpXHJcbiAgICAgKiAgIC5maXJzdCgpXHJcbiAgICAgKiAgIC5waWNrKCdhZ2UnKVxyXG4gICAgICogICAudmFsdWUoKTtcclxuICAgICAqIC8vID0+IHsgJ2FnZSc6IDM2IH1cclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gd3JhcHBlckNoYWluKCkge1xyXG4gICAgICB0aGlzLl9fY2hhaW5fXyA9IHRydWU7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUHJvZHVjZXMgdGhlIGB0b1N0cmluZ2AgcmVzdWx0IG9mIHRoZSB3cmFwcGVkIHZhbHVlLlxyXG4gICAgICpcclxuICAgICAqIEBuYW1lIHRvU3RyaW5nXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIHRoZSBzdHJpbmcgcmVzdWx0LlxyXG4gICAgICogQGV4YW1wbGVcclxuICAgICAqXHJcbiAgICAgKiBfKFsxLCAyLCAzXSkudG9TdHJpbmcoKTtcclxuICAgICAqIC8vID0+ICcxLDIsMydcclxuICAgICAqL1xyXG4gICAgZnVuY3Rpb24gd3JhcHBlclRvU3RyaW5nKCkge1xyXG4gICAgICByZXR1cm4gU3RyaW5nKHRoaXMuX193cmFwcGVkX18pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRXh0cmFjdHMgdGhlIHdyYXBwZWQgdmFsdWUuXHJcbiAgICAgKlxyXG4gICAgICogQG5hbWUgdmFsdWVPZlxyXG4gICAgICogQG1lbWJlck9mIF9cclxuICAgICAqIEBhbGlhcyB2YWx1ZVxyXG4gICAgICogQGNhdGVnb3J5IENoYWluaW5nXHJcbiAgICAgKiBAcmV0dXJucyB7Kn0gUmV0dXJucyB0aGUgd3JhcHBlZCB2YWx1ZS5cclxuICAgICAqIEBleGFtcGxlXHJcbiAgICAgKlxyXG4gICAgICogXyhbMSwgMiwgM10pLnZhbHVlT2YoKTtcclxuICAgICAqIC8vID0+IFsxLCAyLCAzXVxyXG4gICAgICovXHJcbiAgICBmdW5jdGlvbiB3cmFwcGVyVmFsdWVPZigpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX193cmFwcGVkX187XHJcbiAgICB9XHJcblxyXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgLy8gYWRkIGZ1bmN0aW9ucyB0aGF0IHJldHVybiB3cmFwcGVkIHZhbHVlcyB3aGVuIGNoYWluaW5nXHJcbiAgICBsb2Rhc2guYWZ0ZXIgPSBhZnRlcjtcclxuICAgIGxvZGFzaC5hc3NpZ24gPSBhc3NpZ247XHJcbiAgICBsb2Rhc2guYXQgPSBhdDtcclxuICAgIGxvZGFzaC5iaW5kID0gYmluZDtcclxuICAgIGxvZGFzaC5iaW5kQWxsID0gYmluZEFsbDtcclxuICAgIGxvZGFzaC5iaW5kS2V5ID0gYmluZEtleTtcclxuICAgIGxvZGFzaC5jaGFpbiA9IGNoYWluO1xyXG4gICAgbG9kYXNoLmNvbXBhY3QgPSBjb21wYWN0O1xyXG4gICAgbG9kYXNoLmNvbXBvc2UgPSBjb21wb3NlO1xyXG4gICAgbG9kYXNoLmNvbnN0YW50ID0gY29uc3RhbnQ7XHJcbiAgICBsb2Rhc2guY291bnRCeSA9IGNvdW50Qnk7XHJcbiAgICBsb2Rhc2guY3JlYXRlID0gY3JlYXRlO1xyXG4gICAgbG9kYXNoLmNyZWF0ZUNhbGxiYWNrID0gY3JlYXRlQ2FsbGJhY2s7XHJcbiAgICBsb2Rhc2guY3VycnkgPSBjdXJyeTtcclxuICAgIGxvZGFzaC5kZWJvdW5jZSA9IGRlYm91bmNlO1xyXG4gICAgbG9kYXNoLmRlZmF1bHRzID0gZGVmYXVsdHM7XHJcbiAgICBsb2Rhc2guZGVmZXIgPSBkZWZlcjtcclxuICAgIGxvZGFzaC5kZWxheSA9IGRlbGF5O1xyXG4gICAgbG9kYXNoLmRpZmZlcmVuY2UgPSBkaWZmZXJlbmNlO1xyXG4gICAgbG9kYXNoLmZpbHRlciA9IGZpbHRlcjtcclxuICAgIGxvZGFzaC5mbGF0dGVuID0gZmxhdHRlbjtcclxuICAgIGxvZGFzaC5mb3JFYWNoID0gZm9yRWFjaDtcclxuICAgIGxvZGFzaC5mb3JFYWNoUmlnaHQgPSBmb3JFYWNoUmlnaHQ7XHJcbiAgICBsb2Rhc2guZm9ySW4gPSBmb3JJbjtcclxuICAgIGxvZGFzaC5mb3JJblJpZ2h0ID0gZm9ySW5SaWdodDtcclxuICAgIGxvZGFzaC5mb3JPd24gPSBmb3JPd247XHJcbiAgICBsb2Rhc2guZm9yT3duUmlnaHQgPSBmb3JPd25SaWdodDtcclxuICAgIGxvZGFzaC5mdW5jdGlvbnMgPSBmdW5jdGlvbnM7XHJcbiAgICBsb2Rhc2guZ3JvdXBCeSA9IGdyb3VwQnk7XHJcbiAgICBsb2Rhc2guaW5kZXhCeSA9IGluZGV4Qnk7XHJcbiAgICBsb2Rhc2guaW5pdGlhbCA9IGluaXRpYWw7XHJcbiAgICBsb2Rhc2guaW50ZXJzZWN0aW9uID0gaW50ZXJzZWN0aW9uO1xyXG4gICAgbG9kYXNoLmludmVydCA9IGludmVydDtcclxuICAgIGxvZGFzaC5pbnZva2UgPSBpbnZva2U7XHJcbiAgICBsb2Rhc2gua2V5cyA9IGtleXM7XHJcbiAgICBsb2Rhc2gubWFwID0gbWFwO1xyXG4gICAgbG9kYXNoLm1hcFZhbHVlcyA9IG1hcFZhbHVlcztcclxuICAgIGxvZGFzaC5tYXggPSBtYXg7XHJcbiAgICBsb2Rhc2gubWVtb2l6ZSA9IG1lbW9pemU7XHJcbiAgICBsb2Rhc2gubWVyZ2UgPSBtZXJnZTtcclxuICAgIGxvZGFzaC5taW4gPSBtaW47XHJcbiAgICBsb2Rhc2gub21pdCA9IG9taXQ7XHJcbiAgICBsb2Rhc2gub25jZSA9IG9uY2U7XHJcbiAgICBsb2Rhc2gucGFpcnMgPSBwYWlycztcclxuICAgIGxvZGFzaC5wYXJ0aWFsID0gcGFydGlhbDtcclxuICAgIGxvZGFzaC5wYXJ0aWFsUmlnaHQgPSBwYXJ0aWFsUmlnaHQ7XHJcbiAgICBsb2Rhc2gucGljayA9IHBpY2s7XHJcbiAgICBsb2Rhc2gucGx1Y2sgPSBwbHVjaztcclxuICAgIGxvZGFzaC5wcm9wZXJ0eSA9IHByb3BlcnR5O1xyXG4gICAgbG9kYXNoLnB1bGwgPSBwdWxsO1xyXG4gICAgbG9kYXNoLnJhbmdlID0gcmFuZ2U7XHJcbiAgICBsb2Rhc2gucmVqZWN0ID0gcmVqZWN0O1xyXG4gICAgbG9kYXNoLnJlbW92ZSA9IHJlbW92ZTtcclxuICAgIGxvZGFzaC5yZXN0ID0gcmVzdDtcclxuICAgIGxvZGFzaC5zaHVmZmxlID0gc2h1ZmZsZTtcclxuICAgIGxvZGFzaC5zb3J0QnkgPSBzb3J0Qnk7XHJcbiAgICBsb2Rhc2gudGFwID0gdGFwO1xyXG4gICAgbG9kYXNoLnRocm90dGxlID0gdGhyb3R0bGU7XHJcbiAgICBsb2Rhc2gudGltZXMgPSB0aW1lcztcclxuICAgIGxvZGFzaC50b0FycmF5ID0gdG9BcnJheTtcclxuICAgIGxvZGFzaC50cmFuc2Zvcm0gPSB0cmFuc2Zvcm07XHJcbiAgICBsb2Rhc2gudW5pb24gPSB1bmlvbjtcclxuICAgIGxvZGFzaC51bmlxID0gdW5pcTtcclxuICAgIGxvZGFzaC52YWx1ZXMgPSB2YWx1ZXM7XHJcbiAgICBsb2Rhc2gud2hlcmUgPSB3aGVyZTtcclxuICAgIGxvZGFzaC53aXRob3V0ID0gd2l0aG91dDtcclxuICAgIGxvZGFzaC53cmFwID0gd3JhcDtcclxuICAgIGxvZGFzaC54b3IgPSB4b3I7XHJcbiAgICBsb2Rhc2guemlwID0gemlwO1xyXG4gICAgbG9kYXNoLnppcE9iamVjdCA9IHppcE9iamVjdDtcclxuXHJcbiAgICAvLyBhZGQgYWxpYXNlc1xyXG4gICAgbG9kYXNoLmNvbGxlY3QgPSBtYXA7XHJcbiAgICBsb2Rhc2guZHJvcCA9IHJlc3Q7XHJcbiAgICBsb2Rhc2guZWFjaCA9IGZvckVhY2g7XHJcbiAgICBsb2Rhc2guZWFjaFJpZ2h0ID0gZm9yRWFjaFJpZ2h0O1xyXG4gICAgbG9kYXNoLmV4dGVuZCA9IGFzc2lnbjtcclxuICAgIGxvZGFzaC5tZXRob2RzID0gZnVuY3Rpb25zO1xyXG4gICAgbG9kYXNoLm9iamVjdCA9IHppcE9iamVjdDtcclxuICAgIGxvZGFzaC5zZWxlY3QgPSBmaWx0ZXI7XHJcbiAgICBsb2Rhc2gudGFpbCA9IHJlc3Q7XHJcbiAgICBsb2Rhc2gudW5pcXVlID0gdW5pcTtcclxuICAgIGxvZGFzaC51bnppcCA9IHppcDtcclxuXHJcbiAgICAvLyBhZGQgZnVuY3Rpb25zIHRvIGBsb2Rhc2gucHJvdG90eXBlYFxyXG4gICAgbWl4aW4obG9kYXNoKTtcclxuXHJcbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgICAvLyBhZGQgZnVuY3Rpb25zIHRoYXQgcmV0dXJuIHVud3JhcHBlZCB2YWx1ZXMgd2hlbiBjaGFpbmluZ1xyXG4gICAgbG9kYXNoLmNsb25lID0gY2xvbmU7XHJcbiAgICBsb2Rhc2guY2xvbmVEZWVwID0gY2xvbmVEZWVwO1xyXG4gICAgbG9kYXNoLmNvbnRhaW5zID0gY29udGFpbnM7XHJcbiAgICBsb2Rhc2guZXNjYXBlID0gZXNjYXBlO1xyXG4gICAgbG9kYXNoLmV2ZXJ5ID0gZXZlcnk7XHJcbiAgICBsb2Rhc2guZmluZCA9IGZpbmQ7XHJcbiAgICBsb2Rhc2guZmluZEluZGV4ID0gZmluZEluZGV4O1xyXG4gICAgbG9kYXNoLmZpbmRLZXkgPSBmaW5kS2V5O1xyXG4gICAgbG9kYXNoLmZpbmRMYXN0ID0gZmluZExhc3Q7XHJcbiAgICBsb2Rhc2guZmluZExhc3RJbmRleCA9IGZpbmRMYXN0SW5kZXg7XHJcbiAgICBsb2Rhc2guZmluZExhc3RLZXkgPSBmaW5kTGFzdEtleTtcclxuICAgIGxvZGFzaC5oYXMgPSBoYXM7XHJcbiAgICBsb2Rhc2guaWRlbnRpdHkgPSBpZGVudGl0eTtcclxuICAgIGxvZGFzaC5pbmRleE9mID0gaW5kZXhPZjtcclxuICAgIGxvZGFzaC5pc0FyZ3VtZW50cyA9IGlzQXJndW1lbnRzO1xyXG4gICAgbG9kYXNoLmlzQXJyYXkgPSBpc0FycmF5O1xyXG4gICAgbG9kYXNoLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcclxuICAgIGxvZGFzaC5pc0RhdGUgPSBpc0RhdGU7XHJcbiAgICBsb2Rhc2guaXNFbGVtZW50ID0gaXNFbGVtZW50O1xyXG4gICAgbG9kYXNoLmlzRW1wdHkgPSBpc0VtcHR5O1xyXG4gICAgbG9kYXNoLmlzRXF1YWwgPSBpc0VxdWFsO1xyXG4gICAgbG9kYXNoLmlzRmluaXRlID0gaXNGaW5pdGU7XHJcbiAgICBsb2Rhc2guaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XHJcbiAgICBsb2Rhc2guaXNOYU4gPSBpc05hTjtcclxuICAgIGxvZGFzaC5pc051bGwgPSBpc051bGw7XHJcbiAgICBsb2Rhc2guaXNOdW1iZXIgPSBpc051bWJlcjtcclxuICAgIGxvZGFzaC5pc09iamVjdCA9IGlzT2JqZWN0O1xyXG4gICAgbG9kYXNoLmlzUGxhaW5PYmplY3QgPSBpc1BsYWluT2JqZWN0O1xyXG4gICAgbG9kYXNoLmlzUmVnRXhwID0gaXNSZWdFeHA7XHJcbiAgICBsb2Rhc2guaXNTdHJpbmcgPSBpc1N0cmluZztcclxuICAgIGxvZGFzaC5pc1VuZGVmaW5lZCA9IGlzVW5kZWZpbmVkO1xyXG4gICAgbG9kYXNoLmxhc3RJbmRleE9mID0gbGFzdEluZGV4T2Y7XHJcbiAgICBsb2Rhc2gubWl4aW4gPSBtaXhpbjtcclxuICAgIGxvZGFzaC5ub0NvbmZsaWN0ID0gbm9Db25mbGljdDtcclxuICAgIGxvZGFzaC5ub29wID0gbm9vcDtcclxuICAgIGxvZGFzaC5ub3cgPSBub3c7XHJcbiAgICBsb2Rhc2gucGFyc2VJbnQgPSBwYXJzZUludDtcclxuICAgIGxvZGFzaC5yYW5kb20gPSByYW5kb207XHJcbiAgICBsb2Rhc2gucmVkdWNlID0gcmVkdWNlO1xyXG4gICAgbG9kYXNoLnJlZHVjZVJpZ2h0ID0gcmVkdWNlUmlnaHQ7XHJcbiAgICBsb2Rhc2gucmVzdWx0ID0gcmVzdWx0O1xyXG4gICAgbG9kYXNoLnJ1bkluQ29udGV4dCA9IHJ1bkluQ29udGV4dDtcclxuICAgIGxvZGFzaC5zaXplID0gc2l6ZTtcclxuICAgIGxvZGFzaC5zb21lID0gc29tZTtcclxuICAgIGxvZGFzaC5zb3J0ZWRJbmRleCA9IHNvcnRlZEluZGV4O1xyXG4gICAgbG9kYXNoLnRlbXBsYXRlID0gdGVtcGxhdGU7XHJcbiAgICBsb2Rhc2gudW5lc2NhcGUgPSB1bmVzY2FwZTtcclxuICAgIGxvZGFzaC51bmlxdWVJZCA9IHVuaXF1ZUlkO1xyXG5cclxuICAgIC8vIGFkZCBhbGlhc2VzXHJcbiAgICBsb2Rhc2guYWxsID0gZXZlcnk7XHJcbiAgICBsb2Rhc2guYW55ID0gc29tZTtcclxuICAgIGxvZGFzaC5kZXRlY3QgPSBmaW5kO1xyXG4gICAgbG9kYXNoLmZpbmRXaGVyZSA9IGZpbmQ7XHJcbiAgICBsb2Rhc2guZm9sZGwgPSByZWR1Y2U7XHJcbiAgICBsb2Rhc2guZm9sZHIgPSByZWR1Y2VSaWdodDtcclxuICAgIGxvZGFzaC5pbmNsdWRlID0gY29udGFpbnM7XHJcbiAgICBsb2Rhc2guaW5qZWN0ID0gcmVkdWNlO1xyXG5cclxuICAgIG1peGluKGZ1bmN0aW9uKCkge1xyXG4gICAgICB2YXIgc291cmNlID0ge31cclxuICAgICAgZm9yT3duKGxvZGFzaCwgZnVuY3Rpb24oZnVuYywgbWV0aG9kTmFtZSkge1xyXG4gICAgICAgIGlmICghbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSkge1xyXG4gICAgICAgICAgc291cmNlW21ldGhvZE5hbWVdID0gZnVuYztcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gc291cmNlO1xyXG4gICAgfSgpLCBmYWxzZSk7XHJcblxyXG4gICAgLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXHJcblxyXG4gICAgLy8gYWRkIGZ1bmN0aW9ucyBjYXBhYmxlIG9mIHJldHVybmluZyB3cmFwcGVkIGFuZCB1bndyYXBwZWQgdmFsdWVzIHdoZW4gY2hhaW5pbmdcclxuICAgIGxvZGFzaC5maXJzdCA9IGZpcnN0O1xyXG4gICAgbG9kYXNoLmxhc3QgPSBsYXN0O1xyXG4gICAgbG9kYXNoLnNhbXBsZSA9IHNhbXBsZTtcclxuXHJcbiAgICAvLyBhZGQgYWxpYXNlc1xyXG4gICAgbG9kYXNoLnRha2UgPSBmaXJzdDtcclxuICAgIGxvZGFzaC5oZWFkID0gZmlyc3Q7XHJcblxyXG4gICAgZm9yT3duKGxvZGFzaCwgZnVuY3Rpb24oZnVuYywgbWV0aG9kTmFtZSkge1xyXG4gICAgICB2YXIgY2FsbGJhY2thYmxlID0gbWV0aG9kTmFtZSAhPT0gJ3NhbXBsZSc7XHJcbiAgICAgIGlmICghbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSkge1xyXG4gICAgICAgIGxvZGFzaC5wcm90b3R5cGVbbWV0aG9kTmFtZV09IGZ1bmN0aW9uKG4sIGd1YXJkKSB7XHJcbiAgICAgICAgICB2YXIgY2hhaW5BbGwgPSB0aGlzLl9fY2hhaW5fXyxcclxuICAgICAgICAgICAgICByZXN1bHQgPSBmdW5jKHRoaXMuX193cmFwcGVkX18sIG4sIGd1YXJkKTtcclxuXHJcbiAgICAgICAgICByZXR1cm4gIWNoYWluQWxsICYmIChuID09IG51bGwgfHwgKGd1YXJkICYmICEoY2FsbGJhY2thYmxlICYmIHR5cGVvZiBuID09ICdmdW5jdGlvbicpKSlcclxuICAgICAgICAgICAgPyByZXN1bHRcclxuICAgICAgICAgICAgOiBuZXcgbG9kYXNoV3JhcHBlcihyZXN1bHQsIGNoYWluQWxsKTtcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBzZW1hbnRpYyB2ZXJzaW9uIG51bWJlci5cclxuICAgICAqXHJcbiAgICAgKiBAc3RhdGljXHJcbiAgICAgKiBAbWVtYmVyT2YgX1xyXG4gICAgICogQHR5cGUgc3RyaW5nXHJcbiAgICAgKi9cclxuICAgIGxvZGFzaC5WRVJTSU9OID0gJzIuNC4xJztcclxuXHJcbiAgICAvLyBhZGQgXCJDaGFpbmluZ1wiIGZ1bmN0aW9ucyB0byB0aGUgd3JhcHBlclxyXG4gICAgbG9kYXNoLnByb3RvdHlwZS5jaGFpbiA9IHdyYXBwZXJDaGFpbjtcclxuICAgIGxvZGFzaC5wcm90b3R5cGUudG9TdHJpbmcgPSB3cmFwcGVyVG9TdHJpbmc7XHJcbiAgICBsb2Rhc2gucHJvdG90eXBlLnZhbHVlID0gd3JhcHBlclZhbHVlT2Y7XHJcbiAgICBsb2Rhc2gucHJvdG90eXBlLnZhbHVlT2YgPSB3cmFwcGVyVmFsdWVPZjtcclxuXHJcbiAgICAvLyBhZGQgYEFycmF5YCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gdW53cmFwcGVkIHZhbHVlc1xyXG4gICAgZm9yRWFjaChbJ2pvaW4nLCAncG9wJywgJ3NoaWZ0J10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcclxuICAgICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcclxuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHZhciBjaGFpbkFsbCA9IHRoaXMuX19jaGFpbl9fLFxyXG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KHRoaXMuX193cmFwcGVkX18sIGFyZ3VtZW50cyk7XHJcblxyXG4gICAgICAgIHJldHVybiBjaGFpbkFsbFxyXG4gICAgICAgICAgPyBuZXcgbG9kYXNoV3JhcHBlcihyZXN1bHQsIGNoYWluQWxsKVxyXG4gICAgICAgICAgOiByZXN1bHQ7XHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBhZGQgYEFycmF5YCBmdW5jdGlvbnMgdGhhdCByZXR1cm4gdGhlIGV4aXN0aW5nIHdyYXBwZWQgdmFsdWVcclxuICAgIGZvckVhY2goWydwdXNoJywgJ3JldmVyc2UnLCAnc29ydCcsICd1bnNoaWZ0J10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcclxuICAgICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcclxuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGZ1bmMuYXBwbHkodGhpcy5fX3dyYXBwZWRfXywgYXJndW1lbnRzKTtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGFkZCBgQXJyYXlgIGZ1bmN0aW9ucyB0aGF0IHJldHVybiBuZXcgd3JhcHBlZCB2YWx1ZXNcclxuICAgIGZvckVhY2goWydjb25jYXQnLCAnc2xpY2UnLCAnc3BsaWNlJ10sIGZ1bmN0aW9uKG1ldGhvZE5hbWUpIHtcclxuICAgICAgdmFyIGZ1bmMgPSBhcnJheVJlZlttZXRob2ROYW1lXTtcclxuICAgICAgbG9kYXNoLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgbG9kYXNoV3JhcHBlcihmdW5jLmFwcGx5KHRoaXMuX193cmFwcGVkX18sIGFyZ3VtZW50cyksIHRoaXMuX19jaGFpbl9fKTtcclxuICAgICAgfTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBsb2Rhc2g7XHJcbiAgfVxyXG5cclxuICAvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuXHJcbiAgLy8gZXhwb3NlIExvLURhc2hcclxuICB2YXIgXyA9IHJ1bkluQ29udGV4dCgpO1xyXG5cclxuICAvLyBzb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzIGxpa2Ugci5qcyBjaGVjayBmb3IgY29uZGl0aW9uIHBhdHRlcm5zIGxpa2UgdGhlIGZvbGxvd2luZzpcclxuICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmIGRlZmluZS5hbWQpIHtcclxuICAgIC8vIEV4cG9zZSBMby1EYXNoIHRvIHRoZSBnbG9iYWwgb2JqZWN0IGV2ZW4gd2hlbiBhbiBBTUQgbG9hZGVyIGlzIHByZXNlbnQgaW5cclxuICAgIC8vIGNhc2UgTG8tRGFzaCBpcyBsb2FkZWQgd2l0aCBhIFJlcXVpcmVKUyBzaGltIGNvbmZpZy5cclxuICAgIC8vIFNlZSBodHRwOi8vcmVxdWlyZWpzLm9yZy9kb2NzL2FwaS5odG1sI2NvbmZpZy1zaGltXHJcbiAgICByb290Ll8gPSBfO1xyXG5cclxuICAgIC8vIGRlZmluZSBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlIHNvLCB0aHJvdWdoIHBhdGggbWFwcGluZywgaXQgY2FuIGJlXHJcbiAgICAvLyByZWZlcmVuY2VkIGFzIHRoZSBcInVuZGVyc2NvcmVcIiBtb2R1bGVcclxuICAgIGRlZmluZShmdW5jdGlvbigpIHtcclxuICAgICAgcmV0dXJuIF87XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLy8gY2hlY2sgZm9yIGBleHBvcnRzYCBhZnRlciBgZGVmaW5lYCBpbiBjYXNlIGEgYnVpbGQgb3B0aW1pemVyIGFkZHMgYW4gYGV4cG9ydHNgIG9iamVjdFxyXG4gIGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcclxuICAgIC8vIGluIE5vZGUuanMgb3IgUmluZ29KU1xyXG4gICAgaWYgKG1vZHVsZUV4cG9ydHMpIHtcclxuICAgICAgKGZyZWVNb2R1bGUuZXhwb3J0cyA9IF8pLl8gPSBfO1xyXG4gICAgfVxyXG4gICAgLy8gaW4gTmFyd2hhbCBvciBSaGlubyAtcmVxdWlyZVxyXG4gICAgZWxzZSB7XHJcbiAgICAgIGZyZWVFeHBvcnRzLl8gPSBfO1xyXG4gICAgfVxyXG4gIH1cclxuICBlbHNlIHtcclxuICAgIC8vIGluIGEgYnJvd3NlciBvciBSaGlub1xyXG4gICAgcm9vdC5fID0gXztcclxuICB9XHJcbn0uY2FsbCh0aGlzKSk7XHJcbiIsInZhciBzdGFydFRpbWUgPSBuZXcgRGF0ZSgpLFxyXG4gICAgZ2FtZVJvb21JRCxcclxuICAgIGlzSG9zdCxcclxuICAgIGNvbnRyb2xNb2RlLFxyXG4gICAgc3RhdGUgPSAnd2FpdGluZyc7XHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG5cdHNvY2tldHNNYW5hZ2VyLmluaXQoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0U3RhcnRUaW1lKCkge1xyXG4gICAgcmV0dXJuIHN0YXJ0VGltZTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25Db25uZWN0aW9uUmVhZHkobW9kZSkge1xyXG4gICAgY29udHJvbE1vZGUgPSBtb2RlO1xyXG5cclxuXHRzdGFnZU1hbmFnZXIuaW5pdCgpO1xyXG5cclxuICAgIGlmIChjb250cm9sTW9kZSA9PT0gJ2Rlc2t0b3BPbmx5Jykge1xyXG4gICAgICAgIGRlc2t0b3BDb250cm9sc01hbmFnZXIuaW5pdCgpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBvbkdhbWVSZWFkeShuZXdHYW1lUm9vbUlELCBuZXdHYW1lSXNIb3N0KSB7XHJcbiAgICBnYW1lUm9vbUlEID0gbmV3R2FtZVJvb21JRDtcclxuICAgIGlzSG9zdCA9IG5ld0dhbWVJc0hvc3Q7XHJcbiAgICBzdGF0ZSA9ICdyZWFkeSc7XHJcblxyXG4gICAgcmFja2V0c01hbmFnZXIuc2V0UGxheWVyU2lkZShpc0hvc3QpO1xyXG4gICAgcmFja2V0c01hbmFnZXIucmVzZXRSYWNrZXRzUG9zaXRpb25zKCk7XHJcblxyXG4gICAgaWYgKGlzSG9zdCkge1xyXG4gICAgICAgIGJhbGxzTWFuYWdlci5jcmVhdGVCYWxscyg0OCwgbnVsbCwgNjUwLCA1MDAsIDQpO1xyXG4gICAgICAgIC8vIGJhbGxzTWFuYWdlci5jcmVhdGVCYWxsKHtcclxuICAgICAgICAvLyAgICAgcG9zOiBuZXcgVmVjdG9yMig2MCwgMTApLCBcclxuICAgICAgICAvLyAgICAgdmVsOiBuZXcgVmVjdG9yMigtNDAsIDMwMClcclxuICAgICAgICAvLyB9KTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gb25PcHBvbmVudERpc2Nvbm5lY3QoKSB7XHJcbiAgICBzdGF0ZSA9ICd3YWl0aW5nJztcclxuICAgIGJhbGxzTWFuYWdlci5yZW1vdmVBbGxCYWxscygpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTdGF0ZSgpIHtcclxuICAgIHJldHVybiBzdGF0ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0SXNIb3N0KCkge1xyXG4gICAgcmV0dXJuIGlzSG9zdDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TW9kZSgpIHtcclxuICAgIHJldHVybiBjb250cm9sTW9kZTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSAge1xyXG5cdGluaXQ6IGluaXQsXHJcbiAgICBnZXRTdGFydFRpbWU6IGdldFN0YXJ0VGltZSxcclxuICAgIG9uQ29ubmVjdGlvblJlYWR5OiBvbkNvbm5lY3Rpb25SZWFkeSxcclxuICAgIG9uR2FtZVJlYWR5OiBvbkdhbWVSZWFkeSxcclxuICAgIG9uT3Bwb25lbnREaXNjb25uZWN0OiBvbk9wcG9uZW50RGlzY29ubmVjdCxcclxuICAgIGdldFN0YXRlOiBnZXRTdGF0ZSxcclxuICAgIGdldElzSG9zdDogZ2V0SXNIb3N0LFxyXG4gICAgZ2V0TW9kZTogZ2V0TW9kZVxyXG59O1xyXG4iLCJ2YXIgQmFsbCA9IHJlcXVpcmUoJy4vY2xhc3MvQmFsbCcpO1xyXG5cclxuXHJcbnZhciBiYWxscyA9IFtdO1xyXG5cclxuZnVuY3Rpb24gaW5pdChzY2VuZSkge1xyXG5cdFxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVCYWxsKGJhbGxEYXRhKSB7XHJcbiAgICBiYWxsRGF0YS5JRCA9IGJhbGxEYXRhLklEIHx8IGdldElEKCk7XHJcbiAgICBpZiAoIWJhbGxzW2JhbGxEYXRhLklEXSkge1xyXG4gICAgXHR2YXIgbmV3QmFsbCA9IG5ldyBCYWxsKGJhbGxEYXRhLklELCBiYWxsRGF0YS5wb3MsIGJhbGxEYXRhLmNvbG9yLCBiYWxsRGF0YS5yYWRpdXMpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKCdjcmVhdGVkIGJhbGwgIycgKyBuZXdCYWxsLklELCBuZXdCYWxsLCBiYWxsc1tiYWxsRGF0YS5JRF0pXHJcbiAgICAgICAgcGh5c2ljc0VuZ2luZS5zZXRWZWwobmV3QmFsbCwgYmFsbERhdGEudmVsKTtcclxuICAgICAgICBzeW5jTWFuYWdlci5vbkNyZWF0ZUJhbGwobmV3QmFsbCk7XHJcbiAgICAgICAgc3RhZ2VNYW5hZ2VyLmdldFNjZW5lKCkuYWRkQmFsbChuZXdCYWxsKTtcclxuICAgICAgICBiYWxsc1tiYWxsRGF0YS5JRF0gPSBuZXdCYWxsO1xyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgIFx0XHRuZXdCYWxsLmVuYWJsZVBoeXNpY3MoKTtcclxuXHRcdH0sIDUwKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlQmFsbHMobnVtYmVyLCBwb3MsIHZlbCwgaW50ZXJ2YWwsIHR1cm5zLCBhbmdsZSwgcmVtYWluaW5nKSB7XHJcblx0cG9zICAgPSBwb3MgICB8fCBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5nZXRDZW50ZXIoKTtcclxuICAgIHZlbCAgID0gdmVsICAgfHwgMTAwMDtcclxuICAgIHR1cm5zID0gdHVybnMgfHwgMTtcclxuICAgIGFuZ2xlID0gYW5nbGUgPT09IHVuZGVmaW5lZCA/IE1hdGguUEkvbnVtYmVyIDogYW5nbGU7XHJcblx0cmVtYWluaW5nID0gcmVtYWluaW5nID09PSB1bmRlZmluZWQgPyBudW1iZXIgOiByZW1haW5pbmc7XHJcbiAgICBjcmVhdGVCYWxsKHtcclxuICAgICAgICBwb3M6IHBvcywgXHJcbiAgICAgICAgdmVsOiBuZXcgVmVjdG9yMih2ZWwgKiBNYXRoLmNvcyhhbmdsZSArIChNYXRoLnJhbmRvbSgpIC0gMC41KSAqIE1hdGguUEkgKiAwLjA4KSAsIHZlbCAqIE1hdGguc2luKGFuZ2xlICsgKE1hdGgucmFuZG9tKCkgLSAwLjUpICogTWF0aC5QSSAqIDAuMDgpIClcclxuICAgIH0pO1xyXG5cdGlmIChyZW1haW5pbmcgPiAxICYmIGFwcE1hbmFnZXIuZ2V0U3RhdGUoKSA9PT0gJ3JlYWR5Jykge1xyXG4gICAgXHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgXHRcdGNyZWF0ZUJhbGxzKG51bWJlciwgcG9zLCB2ZWwsIGludGVydmFsLCB0dXJucywgYW5nbGUgKyAyICogdHVybnMgKiBNYXRoLlBJIC8gbnVtYmVyLCByZW1haW5pbmcgLSAxKTtcclxuICAgIFx0fSwgaW50ZXJ2YWwpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVCYWxsKGJhbGxEYXRhKSB7XHJcbiAgICBpZiAoYmFsbERhdGEgJiYgYmFsbERhdGEuSUQgJiYgYmFsbHNbYmFsbERhdGEuSURdKSB7XHJcbiAgICAgICAgaWYgKGJhbGxEYXRhLnBvcykge1xyXG4gICAgICAgICAgICBiYWxsc1tiYWxsRGF0YS5JRF0ueCA9IGJhbGxEYXRhLnBvcy54O1xyXG4gICAgICAgICAgICBiYWxsc1tiYWxsRGF0YS5JRF0ueSA9IGJhbGxEYXRhLnBvcy55O1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoYmFsbERhdGEudmVsKSB7XHJcbiAgICAgICAgICAgIGJhbGxzW2JhbGxEYXRhLklEXS52ZWwuY29weShiYWxsRGF0YS52ZWwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdlcnJvciA6IGJhbGwgIycsIGJhbGxEYXRhLklELCBiYWxsc1tiYWxsRGF0YS5JRF0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiByZW1vdmVBbGxCYWxscygpIHtcclxuICAgIGJhbGxzLmZvckVhY2gocmVtb3ZlQmFsbCk7XHJcbiAgICBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5jbGVhckJhbGxzKCk7XHJcbiAgICBiYWxscyA9IFtdO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZW1vdmVCYWxsKGJhbGwpIHtcclxuICAgIGlmIChiYWxsKSB7XHJcbiAgICAgICAgc3RhZ2VNYW5hZ2VyLmdldFNjZW5lKCkucmVtb3ZlQmFsbChiYWxsKTtcclxuICAgICAgICBkZWxldGUgYmFsbHNbYmFsbC5JRF07XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbE91dChiYWxsKSB7XHJcbiAgICBpZiAoYXBwTWFuYWdlci5nZXRJc0hvc3QoKSkge1xyXG4gICAgICAgIHN5bmNNYW5hZ2VyLm9uQmFsbE91dChiYWxsKTtcclxuICAgICAgICBzZXRCYWxsT3V0KGJhbGwpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBvbkJhbGxPdXREZXN0cm95KGJhbGwpIHtcclxuICAgIGlmIChhcHBNYW5hZ2VyLmdldElzSG9zdCgpKSB7XHJcbiAgICAgICAgc3luY01hbmFnZXIub25CYWxsRGVzdHJveShiYWxsKTtcclxuICAgICAgICBkZXN0cm95QmFsbChiYWxsKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gc2V0QmFsbE91dChiYWxsKSB7XHJcbiAgICBiYWxsLm91dCA9IHRydWU7XHJcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGRlc3Ryb3lCYWxsKGJhbGwpO1xyXG4gICAgfSwgNzUwKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZGVzdHJveUJhbGwoYmFsbCkge1xyXG4gICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsRXhwbG9kZVBhcnRpY2xlcyhiYWxsKTtcclxuICAgIHJlbW92ZUJhbGwoYmFsbCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldElEKCkge1xyXG4gICAgdmFyIElEID0gTWF0aC5yb3VuZChNYXRoLnJhbmRvbSgpICogMTAwMDApO1xyXG4gICAgcmV0dXJuIGJhbGxzW0lEXSA/IGdldElEKCkgOiBJRDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0QmFsbHMoKSB7XHJcblx0cmV0dXJuIGJhbGxzO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRCYWxsKElEKSB7XHJcbiAgICByZXR1cm4gYmFsbHNbSURdIHx8IG51bGw7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gIHtcclxuXHRpbml0OiBpbml0LFxyXG5cdGNyZWF0ZUJhbGw6IGNyZWF0ZUJhbGwsXHJcblx0Y3JlYXRlQmFsbHM6IGNyZWF0ZUJhbGxzLFxyXG4gICAgdXBkYXRlQmFsbDogdXBkYXRlQmFsbCxcclxuICAgIHJlbW92ZUFsbEJhbGxzOiByZW1vdmVBbGxCYWxscyxcclxuICAgIHJlbW92ZUJhbGw6IHJlbW92ZUJhbGwsXHJcbiAgICBnZXRJRDogZ2V0SUQsXHJcblx0Z2V0QmFsbHM6IGdldEJhbGxzLFxyXG4gICAgZ2V0QmFsbDogZ2V0QmFsbCxcclxuICAgIG9uQmFsbE91dDogb25CYWxsT3V0LFxyXG4gICAgb25CYWxsT3V0RGVzdHJveTogb25CYWxsT3V0RGVzdHJveSxcclxuICAgIHNldEJhbGxPdXQ6IHNldEJhbGxPdXQsXHJcbiAgICBkZXN0cm95QmFsbDogZGVzdHJveUJhbGxcclxufTtcclxuIiwiQmFsbCA9IGZ1bmN0aW9uKElELCBwb3MsIGNvbG9yLCByYWRpdXMpIHtcclxuICAgIFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XHJcbiAgICB0aGlzLklEID0gSUQ7XHJcbiAgICB0aGlzLnJhZGl1cyA9IHJhZGl1cyB8fCAyODtcclxuICAgIHRoaXMuY29sb3IgID0gY29sb3IgIHx8IHBhcnNlSW50KFBsZWFzZS5tYWtlX2NvbG9yKCkuc2xpY2UoMSksIDE2KTtcclxuICAgIHRoaXMuY29sb3JIZXggPSAnIycgKyB0aGlzLmNvbG9yLnRvU3RyaW5nKDE2KTtcclxuICAgIHRoaXMudmVsID0gbmV3IFZlY3RvcjIoMCwgMCk7XHJcbiAgICB0aGlzLm91dCA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMucGh5c2ljcyA9IGZhbHNlO1xyXG5cclxuXHR2YXIgZ3JhcGhpY3MgPSBuZXcgUElYSS5HcmFwaGljcygpO1xyXG5cdGdyYXBoaWNzLmJlZ2luRmlsbCh0aGlzLmNvbG9yKTtcclxuXHRncmFwaGljcy5kcmF3UmVjdCgwLCAwLCB0aGlzLnJhZGl1cywgdGhpcy5yYWRpdXMpO1xyXG4gICAgdGhpcy5hZGRDaGlsZChncmFwaGljcyk7XHJcblxyXG4gICAgdGhpcy54ID0gcG9zID8gcG9zLnggOiAwO1xyXG4gICAgdGhpcy55ID0gcG9zID8gcG9zLnkgOiAwO1xyXG4gICAgXHJcbn07XHJcblxyXG5CYWxsLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSk7XHJcbkJhbGwucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQmFsbDtcclxuXHJcbkJhbGwucHJvdG90eXBlLmVuYWJsZVBoeXNpY3MgPSBmdW5jdGlvbigpIHtcclxuICAgIHRoaXMucGh5c2ljcyA9IHRydWU7XHJcbn07XHJcblxyXG5CYWxsLnByb3RvdHlwZS5kaXNhYmxlUGh5c2ljcyA9IGZ1bmN0aW9uKCkge1xyXG5cdHRoaXMucGh5c2ljcyA9IGZhbHNlO1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQmFsbDsiLCJIdWQgPSBmdW5jdGlvbigpIHtcclxuICAgIFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lci5jYWxsKCB0aGlzICk7XHJcbiAgICB0aGlzLmluZm9zID0gbmV3IFBJWEkuVGV4dCgnJywge2ZvbnQ6ICdib2xkIDQwcHggQXJpYWwnfSk7XHJcbiAgICB0aGlzLmluZm9zLnggPSAxMDtcclxuICAgIHRoaXMuaW5mb3MueSA9IDEwO1xyXG4gICAgdGhpcy5hZGRDaGlsZCh0aGlzLmluZm9zKTtcclxuXHJcbiAgICB0aGlzLmRlYnVnMSA9IG5ldyBQSVhJLlRleHQoJycpO1xyXG4gICAgdGhpcy5kZWJ1ZzEueCA9IDEwMDtcclxuICAgIHRoaXMuZGVidWcxLnkgPSA0MDA7XHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMuZGVidWcxKTtcclxuXHJcbiAgICB0aGlzLmRlYnVnMiA9IG5ldyBQSVhJLlRleHQoJycpO1xyXG4gICAgdGhpcy5kZWJ1ZzIueCA9IDQwMDtcclxuICAgIHRoaXMuZGVidWcyLnkgPSA0MDA7XHJcbiAgICB0aGlzLmFkZENoaWxkKHRoaXMuZGVidWcyKTtcclxuXHJcbn07XHJcblxyXG5IdWQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlKTtcclxuSHVkLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEh1ZDtcclxuXHJcbkh1ZC5wcm90b3R5cGUuc2V0SW5mb3NUZXh0ID0gZnVuY3Rpb24odGV4dCkge1xyXG4gICAgdGhpcy5pbmZvcy5zZXRUZXh0KHRleHQpO1xyXG4gICAgdGhpcy5pbmZvcy5zZXRTdHlsZSh7XHJcbiAgICAgICAgZm9udDogJ2JvbGQgNDBweCBBcmlhbCcsXHJcbiAgICAgICAgZmlsbDogUGxlYXNlLm1ha2VfY29sb3IoKX0pO1xyXG59O1xyXG5cclxuSHVkLnByb3RvdHlwZS5zZXREZWJ1ZzFUZXh0ID0gZnVuY3Rpb24odGV4dCkge1xyXG4gICAgdGhpcy5kZWJ1ZzEuc2V0VGV4dCh0ZXh0KTtcclxuICAgIHRoaXMuZGVidWcxLnNldFN0eWxlKHtmaWxsOiBQbGVhc2UubWFrZV9jb2xvcigpfSk7XHJcbn07XHJcblxyXG5IdWQucHJvdG90eXBlLnNldERlYnVnMlRleHQgPSBmdW5jdGlvbih0ZXh0KSB7XHJcbiAgICB0aGlzLmRlYnVnMi5zZXRUZXh0KHRleHQpO1xyXG4gICAgdGhpcy5kZWJ1ZzIuc2V0U3R5bGUoe2ZpbGw6IFBsZWFzZS5tYWtlX2NvbG9yKCl9KTtcclxufTtcclxuXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEh1ZDsiLCJSYWNrZXQgPSBmdW5jdGlvbihwb3MsIGNvbG9yKSB7XHJcbiAgICBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCggdGhpcyApO1xyXG4gICAgcG9zID0gcG9zIHx8IG5ldyBWZWN0b3IyKCk7XHJcbiAgICB0aGlzLmNvbG9yID0gY29sb3IgfHwgMHhGRkZGRkY7XHJcbiAgICB0aGlzLnNpemUgPSAyNDA7XHJcblxyXG4gICAgdmFyIGdyYXBoaWNzID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcclxuICAgIGdyYXBoaWNzLmJlZ2luRmlsbCh0aGlzLmNvbG9yKTtcclxuICAgIGdyYXBoaWNzLmRyYXdSZWN0KDAsIDAsIDQwLCB0aGlzLnNpemUpO1xyXG4gICAgdGhpcy5hZGRDaGlsZChncmFwaGljcyk7XHJcblxyXG4gICAgdGhpcy52ZWwgPSBuZXcgVmVjdG9yMigpO1xyXG5cclxuICAgIHRoaXMudXBkYXRlUGl2b3QoKTtcclxuICAgIHRoaXMueCA9IHBvcy54O1xyXG4gICAgdGhpcy55ID0gcG9zLnk7XHJcblxyXG4gICAgdGhpcy5tb3ZpbmdUb1kgPSAwO1xyXG59O1xyXG5cclxuUmFja2V0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyLnByb3RvdHlwZSk7XHJcblJhY2tldC5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBSYWNrZXQ7XHJcblxyXG5SYWNrZXQucHJvdG90eXBlLnNldE1vdmluZ1RvWSA9IGZ1bmN0aW9uKHkpIHtcclxuXHQvLyB0aGlzLm1vdmluZ1RvWSA9IHkgLSB0aGlzLmhlaWdodCAqIDAuNSA8IDAgPyB0aGlzLmhlaWdodCAqIDAuNSA6XHJcbiAvLyAgICAgICAgICAgICAgICAgICAgIHkgKyB0aGlzLmhlaWdodCAqIDAuNSA+IGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0ID8gZ2FtZUNvbmZpZy5iYXNlU2NlbmVIZWlnaHQgLSB0aGlzLmhlaWdodCAqIDAuNSA6XHJcbiAvLyAgICAgICAgICAgICAgICAgICAgIHk7XHJcblxyXG4gICAgdGhpcy5tb3ZpbmdUb1kgPSB5O1xyXG59O1xyXG5cclxuUmFja2V0LnByb3RvdHlwZS51cGRhdGVQaXZvdCA9IGZ1bmN0aW9uKCkge1xyXG4gICAgdGhpcy5waXZvdC54ID0gdGhpcy53aWR0aCAqIDAuNTtcclxuICAgIHRoaXMucGl2b3QueSA9IHRoaXMuaGVpZ2h0ICogMC41O1xyXG59O1xyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gUmFja2V0OyIsIlNjZW5lID0gZnVuY3Rpb24oYmFzZVdpZHRoLCBiYXNlSGVpZ2h0KSB7XHJcbiAgICBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIuY2FsbCggdGhpcyApO1xyXG4gICAgdGhpcy5iYXNlV2lkdGggPSBiYXNlV2lkdGg7XHJcbiAgICB0aGlzLmJhc2VIZWlnaHQgPSBiYXNlSGVpZ2h0O1xyXG4gICAgdGhpcy53aWR0aCA9IGJhc2VXaWR0aDtcclxuICAgIHRoaXMuaGVpZ2h0ID0gYmFzZUhlaWdodDtcclxuICAgIHRoaXMuaW5pdCgpO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIucHJvdG90eXBlKTtcclxuU2NlbmUucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU2NlbmU7XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKCkge1xyXG5cdHRoaXMuZHJhd0JvdW5kcygpO1xyXG5cclxuXHR0aGlzLnBhcnRpY2xlc0NvbnRhaW5lciA9IG5ldyBQSVhJLkRpc3BsYXlPYmplY3RDb250YWluZXIoKTsgICAgICAgIFxyXG5cdHRoaXMucmFja2V0c0NvbnRhaW5lciAgID0gbmV3IFBJWEkuRGlzcGxheU9iamVjdENvbnRhaW5lcigpOyAgICAgICAgXHJcblx0dGhpcy5iYWxsc0NvbnRhaW5lciAgICAgPSBuZXcgUElYSS5EaXNwbGF5T2JqZWN0Q29udGFpbmVyKCk7IFxyXG5cclxuICAgIHRoaXMuYWRkQ2hpbGQodGhpcy5wYXJ0aWNsZXNDb250YWluZXIpO1xyXG4gICAgdGhpcy5hZGRDaGlsZCh0aGlzLnJhY2tldHNDb250YWluZXIpO1xyXG4gICAgdGhpcy5hZGRDaGlsZCh0aGlzLmJhbGxzQ29udGFpbmVyKTtcclxufTtcclxuXHJcblNjZW5lLnByb3RvdHlwZS5kcmF3Qm91bmRzID0gZnVuY3Rpb24oKSB7XHJcblx0dmFyIGdyYXBoaWNzID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcclxuIFx0IFxyXG5cdGdyYXBoaWNzLmJlZ2luRmlsbCgweDIyMjIyMik7XHJcblx0Ly8gZ3JhcGhpY3MubGluZVN0eWxlKDUsIDB4RkZGRkZGKTtcclxuXHRncmFwaGljcy5kcmF3UmVjdCgwLCAwLCB0aGlzLmJhc2VXaWR0aCwgdGhpcy5iYXNlSGVpZ2h0KTtcclxuXHJcblx0dGhpcy5hZGRDaGlsZChncmFwaGljcyk7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuZ2V0Q2VudGVyID0gZnVuY3Rpb24oKSB7XHJcblx0cmV0dXJuIG5ldyBWZWN0b3IyKHRoaXMuYmFzZVdpZHRoIC8gMiwgdGhpcy5iYXNlSGVpZ2h0IC8gMik7XHJcbn07XHJcblxyXG4vLyBTY2VuZS5wcm90b3R5cGUuY2xlYXJPYmplY3RzT2ZUeXBlID0gZnVuY3Rpb24odHlwZSkge1xyXG4vLyBcdHZhciBvYmplY3RzID0gXy5maWx0ZXIodGhpcy5jaGlsZHJlbiwgZnVuY3Rpb24ob2JqZWN0KSB7IFxyXG4vLyBcdFx0cmV0dXJuIG9iamVjdCBpbnN0YW5jZW9mIHR5cGU7XHJcbi8vIFx0fSk7XHJcblxyXG4vLyBcdG9iamVjdHMuZm9yRWFjaChmdW5jdGlvbihvYmplY3QpIHtcclxuLy8gXHRcdHRoaXMucmVtb3ZlQ2hpbGQob2JqZWN0KTtcclxuLy8gXHR9LmJpbmQodGhpcykpO1xyXG4vLyB9O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLmNsZWFyQmFsbHMgPSBmdW5jdGlvbigpIHtcclxuXHR0aGlzLmJhbGxzQ29udGFpbmVyLnJlbW92ZUNoaWxkcmVuKCk7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuYWRkQmFsbCA9IGZ1bmN0aW9uKGJhbGwpIHtcclxuXHR0aGlzLmJhbGxzQ29udGFpbmVyLmFkZENoaWxkKGJhbGwpO1xyXG59O1xyXG5cclxuU2NlbmUucHJvdG90eXBlLnJlbW92ZUJhbGwgPSBmdW5jdGlvbihiYWxsKSB7XHJcblx0dGhpcy5iYWxsc0NvbnRhaW5lci5yZW1vdmVDaGlsZChiYWxsKTtcclxufTtcclxuXHJcblNjZW5lLnByb3RvdHlwZS5hZGRSYWNrZXQgPSBmdW5jdGlvbihyYWNrZXQpIHtcclxuXHR0aGlzLnJhY2tldHNDb250YWluZXIuYWRkQ2hpbGQocmFja2V0KTtcclxufTtcclxuXHJcblNjZW5lLnByb3RvdHlwZS5nZXRQYXJ0aWNsZXNDb250YWluZXIgPSBmdW5jdGlvbigpIHtcclxuXHRyZXR1cm4gdGhpcy5wYXJ0aWNsZXNDb250YWluZXI7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuZ2V0UmFja2V0c0NvbnRhaW5lciA9IGZ1bmN0aW9uKCkge1xyXG5cdHJldHVybiB0aGlzLnJhY2tldHNDb250YWluZXI7XHJcbn07XHJcblxyXG5TY2VuZS5wcm90b3R5cGUuZ2V0QmFsbHNDb250YWluZXIgPSBmdW5jdGlvbigpIHtcclxuXHRyZXR1cm4gdGhpcy5iYWxsc0NvbnRhaW5lcjtcclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2NlbmU7IiwiLyoqXHJcbiAqIEBhdXRob3IgbXIuZG9vYiAvIGh0dHA6Ly9tcmRvb2IuY29tL1xyXG4gKiBAYXV0aG9yIHBoaWxvZ2IgLyBodHRwOi8vYmxvZy50aGVqaXQub3JnL1xyXG4gKiBAYXV0aG9yIGVncmFldGhlciAvIGh0dHA6Ly9lZ3JhZXRoZXIuY29tL1xyXG4gKiBAYXV0aG9yIHp6ODUgLyBodHRwOi8vd3d3LmxhYjRnYW1lcy5uZXQveno4NS9ibG9nXHJcbiAqL1xyXG5cclxuVmVjdG9yMiA9IGZ1bmN0aW9uICggeCwgeSApIHtcclxuXHJcblx0dGhpcy54ID0geCB8fCAwO1xyXG5cdHRoaXMueSA9IHkgfHwgMDtcclxuXHJcbn07XHJcblxyXG5WZWN0b3IyLnByb3RvdHlwZSA9IHtcclxuXHJcblx0Y29uc3RydWN0b3I6IFZlY3RvcjIsXHJcblxyXG5cdHNldDogZnVuY3Rpb24gKCB4LCB5ICkge1xyXG5cclxuXHRcdHRoaXMueCA9IHg7XHJcblx0XHR0aGlzLnkgPSB5O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRjb3B5OiBmdW5jdGlvbiAoIHYgKSB7XHJcblxyXG5cdFx0dGhpcy54ID0gdi54O1xyXG5cdFx0dGhpcy55ID0gdi55O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRjbG9uZTogZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdHJldHVybiBuZXcgVmVjdG9yMiggdGhpcy54LCB0aGlzLnkgKTtcclxuXHJcblx0fSxcclxuXHJcblxyXG5cdGFkZDogZnVuY3Rpb24gKCB2MSwgdjIgKSB7XHJcblxyXG5cdFx0dGhpcy54ID0gdjEueCArIHYyLng7XHJcblx0XHR0aGlzLnkgPSB2MS55ICsgdjIueTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHJcblx0fSxcclxuXHJcblx0YWRkU2VsZjogZnVuY3Rpb24gKCB2ICkge1xyXG5cclxuXHRcdHRoaXMueCArPSB2Lng7XHJcblx0XHR0aGlzLnkgKz0gdi55O1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRzdWI6IGZ1bmN0aW9uICggdjEsIHYyICkge1xyXG5cclxuXHRcdHRoaXMueCA9IHYxLnggLSB2Mi54O1xyXG5cdFx0dGhpcy55ID0gdjEueSAtIHYyLnk7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXM7XHJcblxyXG5cdH0sXHJcblxyXG5cdHN1YlNlbGY6IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHR0aGlzLnggLT0gdi54O1xyXG5cdFx0dGhpcy55IC09IHYueTtcclxuXHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHJcblx0fSxcclxuXHJcblx0bXVsdGlwbHlTY2FsYXI6IGZ1bmN0aW9uICggcyApIHtcclxuXHJcblx0XHR0aGlzLnggKj0gcztcclxuXHRcdHRoaXMueSAqPSBzO1xyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHRkaXZpZGVTY2FsYXI6IGZ1bmN0aW9uICggcyApIHtcclxuXHJcblx0XHRpZiAoIHMgKSB7XHJcblxyXG5cdFx0XHR0aGlzLnggLz0gcztcclxuXHRcdFx0dGhpcy55IC89IHM7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdHRoaXMuc2V0KCAwLCAwICk7XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aGlzO1xyXG5cclxuXHR9LFxyXG5cclxuXHJcblx0bmVnYXRlOiBmdW5jdGlvbigpIHtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy5tdWx0aXBseVNjYWxhciggLTEgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZG90OiBmdW5jdGlvbiAoIHYgKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMueCAqIHYueCArIHRoaXMueSAqIHYueTtcclxuXHJcblx0fSxcclxuXHJcblx0bGVuZ3RoU3E6IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRyZXR1cm4gdGhpcy54ICogdGhpcy54ICsgdGhpcy55ICogdGhpcy55O1xyXG5cclxuXHR9LFxyXG5cclxuXHRsZW5ndGg6IGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KCB0aGlzLmxlbmd0aFNxKCkgKTtcclxuXHJcblx0fSxcclxuXHJcblx0bm9ybWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMuZGl2aWRlU2NhbGFyKCB0aGlzLmxlbmd0aCgpICk7XHJcblxyXG5cdH0sXHJcblxyXG5cdGRpc3RhbmNlVG86IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHRyZXR1cm4gTWF0aC5zcXJ0KCB0aGlzLmRpc3RhbmNlVG9TcXVhcmVkKCB2ICkgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZGlzdGFuY2VUb1NxdWFyZWQ6IGZ1bmN0aW9uICggdiApIHtcclxuXHJcblx0XHR2YXIgZHggPSB0aGlzLnggLSB2LngsIGR5ID0gdGhpcy55IC0gdi55O1xyXG5cdFx0cmV0dXJuIGR4ICogZHggKyBkeSAqIGR5O1xyXG5cclxuXHR9LFxyXG5cclxuXHJcblx0c2V0TGVuZ3RoOiBmdW5jdGlvbiAoIGwgKSB7XHJcblxyXG5cdFx0cmV0dXJuIHRoaXMubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoIGwgKTtcclxuXHJcblx0fSxcclxuXHJcblx0ZXF1YWxzOiBmdW5jdGlvbiggdiApIHtcclxuXHJcblx0XHRyZXR1cm4gKCAoIHYueCA9PT0gdGhpcy54ICkgJiYgKCB2LnkgPT09IHRoaXMueSApICk7XHJcblxyXG5cdH1cclxuXHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFZlY3RvcjI7IiwidmFyIHN0YXJ0VGltZSxcclxuICAgIGdlc3R1cmVzO1xyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuXHQkKGRvY3VtZW50KS5vbignbW91c2Vtb3ZlIHRvdWNoc3RhcnQgdG91Y2htb3ZlJywgb25Nb3VzZU1vdmUpO1xyXG4gICAgLy8gZ2VzdHVyZXMgPSBuZXcgSGFtbWVyLk1hbmFnZXIoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2dhbWUnKSk7XHJcbiAgICAvLyBnZXN0dXJlcy5hZGQobmV3IEhhbW1lci5Td2lwZSh7IGRpcmVjdGlvbjogSGFtbWVyLkRJUkVDVElPTl9WRVJUSUNBTCB9KSk7XHJcblxyXG4gICAgLy8gZ2VzdHVyZXMub24oJ3N3aXBlJywgb25Td2lwZSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTW91c2VNb3ZlKGV2ZW50KSB7XHJcbiAgICB2YXIgeSA9IGV2ZW50LnBhZ2VZIHx8IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlcyAmJiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXNbMF0ucGFnZVk7XHJcbiAgICByYWNrZXRzTWFuYWdlci5tb3ZlUGxheWVyUmFja2V0VG8oKHkgLSBzdGFnZU1hbmFnZXIuZ2V0RGVjKCkueSkgLyBzdGFnZU1hbmFnZXIuZ2V0UmF0aW8oKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uU3dpcGUoZXZlbnQpIHtcclxuICAgIGNvbnNvbGUubG9nKGV2ZW50KTtcclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmFja2V0c01hbmFnZXIubW92ZVBsYXllclJhY2tldEJ5KChldmVudC5kZWx0YVkgKiBNYXRoLmFicyhldmVudC52ZWxvY2l0eSkgKiAwLjUgLSBzdGFnZU1hbmFnZXIuZ2V0RGVjKCkueSkgLyBzdGFnZU1hbmFnZXIuZ2V0UmF0aW8oKSk7XHJcbiAgICB9LCAyMCk7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdGluaXQ6IGluaXRcclxufTtcclxuIiwidmFyIEh1ZCA9IHJlcXVpcmUoJy4vY2xhc3MvSHVkJyk7XHJcblxyXG52YXIgaHVkO1xyXG5cclxuZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRodWQgPSBuZXcgSHVkKCk7XHJcbiAgICBzdGFnZU1hbmFnZXIuZ2V0U3RhZ2UoKS5hZGRDaGlsZChodWQpO1xyXG5cclxuICAgIHNldERlYnVnMVRleHQoJ1lPVTonKTtcclxuICAgIHNldERlYnVnMlRleHQoJ0hJTTonKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFN0YWdlKCkge1xyXG5cdGNvbnNvbGUubG9nKCdpbml0U3RhZ2UnKTtcclxuXHRzdGFnZU1hbmFnZXIuaW5pdCgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRJbmZvc1RleHQodGV4dCkge1xyXG4gICAgaHVkLnNldEluZm9zVGV4dCh0ZXh0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RGVidWcxVGV4dCh0ZXh0KSB7XHJcbiAgICBodWQuc2V0RGVidWcxVGV4dCh0ZXh0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2V0RGVidWcyVGV4dCh0ZXh0KSB7XHJcbiAgICBodWQuc2V0RGVidWcyVGV4dCh0ZXh0KTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0aW5pdDogaW5pdCxcclxuICAgIHNldEluZm9zVGV4dDogc2V0SW5mb3NUZXh0LFxyXG4gICAgc2V0RGVidWcxVGV4dDogc2V0RGVidWcxVGV4dCxcclxuICAgIHNldERlYnVnMlRleHQ6IHNldERlYnVnMlRleHRcclxufTtcclxuXHJcblxyXG4iLCJ2YXIgXyA9IHJlcXVpcmUoJ2xvZGFzaCcpO1xyXG5cclxudmFyIHBhcnRpY2xlc0NvbnRhaW5lcixcclxuICAgIGVtaXR0ZXJzID0gW10sXHJcbiAgICBwb29sU2l6ZSA9IDE4LFxyXG4gICAgcG9vbCA9IFtdO1xyXG5cclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICBwYXJ0aWNsZXNDb250YWluZXIgPSBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5nZXRQYXJ0aWNsZXNDb250YWluZXIoKTtcclxuICAgIGluaXRQb29sKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZShkZWx0YSkge1xyXG4gICAgcG9vbC5mb3JFYWNoKGZ1bmN0aW9uKGVtaXR0ZXIsIGluZGV4KSB7XHJcbiAgICAgICAgaWYgKGVtaXR0ZXIuZW1pdCB8fCBlbWl0dGVyLl9hY3RpdmVQYXJ0aWNsZXMubGVuZ3RoKVxyXG4gICAgICAgIGVtaXR0ZXIudXBkYXRlKGRlbHRhKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0UG9vbCgpIHtcclxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcG9vbFNpemU7IGkrKykge1xyXG4gICAgICAgIHBvb2xbaV0gPSBuZXcgY2xvdWRraWQuRW1pdHRlcihwYXJ0aWNsZXNDb250YWluZXIpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBpbml0VW51c2VkRW1pdHRlcihjb25maWcpIHtcclxuICAgIHZhciBlbWl0dGVyID0gZmluZFVudXNlZEVtaXR0ZXIoKTtcclxuICAgIGlmIChlbWl0dGVyKSB7XHJcbiAgICAgICAgZW1pdHRlci5pbml0KFtQSVhJLlRleHR1cmUuZnJvbUltYWdlKCd0ZXh0dXJlcy9waXhlbDI0LnBuZycpXSwgY29uZmlnKTtcclxuICAgICAgICBlbWl0dGVyLmVtaXQgPSB0cnVlO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kVW51c2VkRW1pdHRlcigpIHtcclxuICAgIHJldHVybiBfLmZpbmQocG9vbCwgZnVuY3Rpb24oZW1pdHRlcikge1xyXG4gICAgICAgIHJldHVybiAhZW1pdHRlci5lbWl0ICYmIGVtaXR0ZXIuX2FjdGl2ZVBhcnRpY2xlcy5sZW5ndGggPT09IDA7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoYmFsbCwgYW5nbGUpIHtcclxuICAgIGlmIChiYWxsKSB7IFxyXG4gICAgICAgIGluaXRVbnVzZWRFbWl0dGVyKHtcclxuICAgICAgICAgICAgXCJhbHBoYVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDAuOCxcclxuICAgICAgICAgICAgICAgIFwiZW5kXCI6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzY2FsZVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDEgLyAyNCAqIGJhbGwucmFkaXVzLFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogICAxIC8gNTQgKiBiYWxsLnJhZGl1cyxcclxuICAgICAgICAgICAgICAgIFwibWluaW11bVNjYWxlTXVsdGlwbGllclwiOiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiY29sb3JcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiBiYWxsLmNvbG9ySGV4LFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogXCIjMzMzMzMzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzcGVlZFwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDEwICogYmFsbC5yYWRpdXMsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAyICogYmFsbC5yYWRpdXNcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJhY2NlbGVyYXRpb25cIjoge1xyXG4gICAgICAgICAgICAgICAgXCJ4XCI6IDAsXHJcbiAgICAgICAgICAgICAgICBcInlcIjogMFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcInN0YXJ0Um90YXRpb25cIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogYW5nbGUgLSA2MCxcclxuICAgICAgICAgICAgICAgIFwibWF4XCI6IGFuZ2xlICsgNjBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJyb3RhdGlvblNwZWVkXCI6IHtcclxuICAgICAgICAgICAgICAgIFwibWluXCI6IDAsXHJcbiAgICAgICAgICAgICAgICBcIm1heFwiOiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwibGlmZXRpbWVcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogMC4yLFxyXG4gICAgICAgICAgICAgICAgXCJtYXhcIjogMC41XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiYmxlbmRNb2RlXCI6IFwibm9ybWFsXCIsXHJcbiAgICAgICAgICAgIFwiZnJlcXVlbmN5XCI6IDAuMDIsXHJcbiAgICAgICAgICAgIFwiZW1pdHRlckxpZmV0aW1lXCI6IDAuMixcclxuICAgICAgICAgICAgXCJtYXhQYXJ0aWNsZXNcIjogNixcclxuICAgICAgICAgICAgXCJwb3NcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJ4XCI6IGJhbGwueCArIGJhbGwucmFkaXVzIC8gMixcclxuICAgICAgICAgICAgICAgIFwieVwiOiBiYWxsLnkgKyBiYWxsLnJhZGl1cyAvIDJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJhZGRBdEJhY2tcIjogZmFsc2UsXHJcbiAgICAgICAgICAgIFwic3Bhd25UeXBlXCI6IFwicG9pbnRcIlxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBjcmVhdGVCYWxsRXhwbG9kZVBhcnRpY2xlcyhiYWxsKSB7XHJcbiAgICBpZiAoYmFsbCkge1xyXG4gICAgICAgIGluaXRVbnVzZWRFbWl0dGVyKHtcclxuICAgICAgICAgICAgXCJhbHBoYVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDAuOCxcclxuICAgICAgICAgICAgICAgIFwiZW5kXCI6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzY2FsZVwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDEgLyAyNCAqIGJhbGwucmFkaXVzLFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogICAxIC8gNDggKiBiYWxsLnJhZGl1cyxcclxuICAgICAgICAgICAgICAgIFwibWluaW11bVNjYWxlTXVsdGlwbGllclwiOiAxXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiY29sb3JcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJzdGFydFwiOiBiYWxsLmNvbG9ySGV4LFxyXG4gICAgICAgICAgICAgICAgXCJlbmRcIjogXCIjMzMzMzMzXCJcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzcGVlZFwiOiB7XHJcbiAgICAgICAgICAgICAgICBcInN0YXJ0XCI6IDUwICogYmFsbC5yYWRpdXMsXHJcbiAgICAgICAgICAgICAgICBcImVuZFwiOiAxMCAqIGJhbGwucmFkaXVzXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiYWNjZWxlcmF0aW9uXCI6IHtcclxuICAgICAgICAgICAgICAgIFwieFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgXCJ5XCI6IDBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJzdGFydFJvdGF0aW9uXCI6IHtcclxuICAgICAgICAgICAgICAgIFwibWluXCI6IDAsXHJcbiAgICAgICAgICAgICAgICBcIm1heFwiOiAzNjBcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJyb3RhdGlvblNwZWVkXCI6IHtcclxuICAgICAgICAgICAgICAgIFwibWluXCI6IDAsXHJcbiAgICAgICAgICAgICAgICBcIm1heFwiOiAwXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwibGlmZXRpbWVcIjoge1xyXG4gICAgICAgICAgICAgICAgXCJtaW5cIjogMC4xLFxyXG4gICAgICAgICAgICAgICAgXCJtYXhcIjogMC41XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFwiYmxlbmRNb2RlXCI6IFwibm9ybWFsXCIsXHJcbiAgICAgICAgICAgIFwiZnJlcXVlbmN5XCI6IDAuMDEsXHJcbiAgICAgICAgICAgIFwiZW1pdHRlckxpZmV0aW1lXCI6IDAuMTUsXHJcbiAgICAgICAgICAgIFwibWF4UGFydGljbGVzXCI6IDMyLFxyXG4gICAgICAgICAgICBcInBvc1wiOiB7XHJcbiAgICAgICAgICAgICAgICBcInhcIjogYmFsbC54ICsgYmFsbC5yYWRpdXMgLyAyLFxyXG4gICAgICAgICAgICAgICAgXCJ5XCI6IGJhbGwueSArIGJhbGwucmFkaXVzIC8gMlxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBcImFkZEF0QmFja1wiOiBmYWxzZSxcclxuICAgICAgICAgICAgXCJzcGF3blR5cGVcIjogXCJwb2ludFwiXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEVtaXR0ZXJzKCkge1xyXG4gICAgcmV0dXJuIGVtaXR0ZXJzO1xyXG59XHJcblxyXG5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdDogaW5pdCxcclxuICAgIHVwZGF0ZTogdXBkYXRlLFxyXG4gICAgY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXM6IGNyZWF0ZUJhbGxDb2xsaWRlUGFydGljbGVzLFxyXG4gICAgY3JlYXRlQmFsbEV4cGxvZGVQYXJ0aWNsZXM6IGNyZWF0ZUJhbGxFeHBsb2RlUGFydGljbGVzLFxyXG4gICAgZ2V0RW1pdHRlcnM6IGdldEVtaXR0ZXJzXHJcbn07XHJcbiIsIlZlY3RvcjIgPSByZXF1aXJlKCcuL2NsYXNzL1ZlY3RvcjInKTtcclxuXHJcblxyXG52YXIgY3VycmVudERlbHRhID0gMCxcclxuXHRjdXJyZW50RGVjID0gbmV3IFZlY3RvcjIoKSxcclxuXHRjdXJyZW50UmF0aW8gPSAxLFxyXG5cdHNhZmV0eUdhcFNpemUgPSA2LFxyXG5cdHJhY2tldHNNYXJnaW4gPSAzNCxcclxuXHJcblx0d2FsbHNCb3VuZHM7XHJcblxyXG5mdW5jdGlvbiBpbml0KCkge1xyXG5cdFx0d2FsbHNCb3VuZHMgPSBuZXcgUElYSS5SZWN0YW5nbGUoXHJcblx0XHQwLCBcclxuXHRcdDAsIFxyXG5cdFx0Z2FtZUNvbmZpZy5iYXNlU2NlbmVXaWR0aCxcclxuXHRcdGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0KTtcclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlKGRlbHRhKSB7XHJcblx0Y3VycmVudERlbHRhID0gZGVsdGE7XHJcblxyXG5cdGlmIChjdXJyZW50RGVsdGEpIHtcclxuXHRcdHVwZGF0ZVJhY2tldHMoKTtcclxuXHRcdHVwZGF0ZUJhbGxzKCk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFZlbChvYmplY3QsIHZlbCkge1xyXG5cdG9iamVjdC52ZWwuY29weSh2ZWwpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhZGRWZWwob2JqZWN0LCB2ZWwpIHtcclxuXHRvYmplY3QudmVsLmFkZFNlbGYodmVsKTtcclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlUmFja2V0cygpIHtcclxuXHR1cGRhdGVSYWNrZXQocmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpKTtcclxuXHR1cGRhdGVSYWNrZXQocmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXQoKSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZVJhY2tldChyYWNrZXQpIHtcclxuXHRpZiAoTWF0aC5hYnMocmFja2V0LnkgLSByYWNrZXQubW92aW5nVG9ZKSA+IDEpIHtcclxuXHRcdHJhY2tldC55ICs9IChyYWNrZXQubW92aW5nVG9ZIC0gcmFja2V0LnkpICAqIDE1ICogY3VycmVudERlbHRhOyBcclxuXHR9XHJcblx0ZWxzZSB7XHJcblx0XHRyYWNrZXQueSA9IHJhY2tldC5tb3ZpbmdUb1k7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVCYWxscygpIHtcclxuXHRiYWxsc01hbmFnZXIuZ2V0QmFsbHMoKS5mb3JFYWNoKHVwZGF0ZUJhbGwpO1xyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVCYWxsKGJhbGwsIGluZGV4KSB7XHJcblx0aWYgKGJhbGwgJiYgYmFsbC5waHlzaWNzKSB7XHJcblx0XHRpZiAoYmFsbC52ZWwueCA+PSAtNTAgJiYgYmFsbC52ZWwueCA8PSA1MCkge1xyXG5cdFx0XHRiYWxsLnZlbC54ID0gYmFsbC52ZWwueCArIGJhbGwudmVsLnggKiAwLjE7XHJcblx0XHR9XHJcblx0XHRjaGVja0JhbGxDb2xsaXNpb24oYmFsbCk7XHJcblx0XHR1cGRhdGVPYmplY3RQb3MoYmFsbCk7XHJcblx0XHRhcHBseU1hZ25ldEZvcmNlKGJhbGwpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlT2JqZWN0UG9zKG9iamVjdCkge1xyXG5cdG9iamVjdC54ID0gb2JqZWN0LnggKyBvYmplY3QudmVsLnggKiBjdXJyZW50RGVsdGE7XHJcblx0b2JqZWN0LnkgPSBvYmplY3QueSArIG9iamVjdC52ZWwueSAqIGN1cnJlbnREZWx0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gY2hlY2tCYWxsQ29sbGlzaW9uKGJhbGwpIHtcclxuXHR2YXIgYm91bmRzID0gYmFsbC5nZXRCb3VuZHMoKTtcclxuXHRib3VuZHMubG9jYWxYID0gYm91bmRzLnggLSBzdGFnZU1hbmFnZXIuZ2V0RGVjKCkueDtcclxuXHRib3VuZHMubG9jYWxZID0gYm91bmRzLnkgLSBzdGFnZU1hbmFnZXIuZ2V0RGVjKCkueTtcclxuXHJcblxyXG5cdC8vIFRlc3QgdG9wIGNvbGxpc2lvblxyXG5cdGlmIChiYWxsLnkgKyBiYWxsLnZlbC55ICogY3VycmVudERlbHRhIDw9IHdhbGxzQm91bmRzLnkgfHwgXHJcblx0XHRiYWxsLnkgPD0gd2FsbHNCb3VuZHMueSkge1xyXG5cclxuXHRcdGJhbGwueSA9IHdhbGxzQm91bmRzLnk7XHJcblxyXG5cdFx0aWYgKGJhbGwub3V0KSB7XHJcblx0XHRcdGJhbGxzTWFuYWdlci5vbkJhbGxPdXREZXN0cm95KGJhbGwpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdG9uQmFsbENvbGxpZGVUb3AoYmFsbCk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBUZXN0IGJvdHRvbSBjb2xsaXNpb25cclxuXHRlbHNlIGlmIChiYWxsLnkgKyBib3VuZHMuaGVpZ2h0ICsgYmFsbC52ZWwueSAqIGN1cnJlbnREZWx0YSA+PSB3YWxsc0JvdW5kcy55ICsgd2FsbHNCb3VuZHMuaGVpZ2h0IHx8IFxyXG5cdFx0XHQgYmFsbC55ICsgYm91bmRzLmhlaWdodCA+PSB3YWxsc0JvdW5kcy55ICsgd2FsbHNCb3VuZHMuaGVpZ2h0KSB7XHJcblxyXG5cdFx0YmFsbC55ID0gd2FsbHNCb3VuZHMueSArIHdhbGxzQm91bmRzLmhlaWdodCAtIGJhbGwucmFkaXVzO1xyXG5cclxuXHRcdGlmIChiYWxsLm91dCkge1xyXG5cdFx0XHRiYWxsc01hbmFnZXIub25CYWxsT3V0RGVzdHJveShiYWxsKTtcclxuXHRcdH1cclxuXHRcdGVsc2Uge1xyXG5cdFx0XHRvbkJhbGxDb2xsaWRlQm90dG9tKGJhbGwpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gSWYgYmFsbCBpcyBub3Qgb3V0IG9mIHRoZSBnYW1lXHJcblx0aWYgKCFiYWxsLm91dCkge1xyXG5cclxuXHRcdC8vIFRlc3QgbGVmdCBjb2xsaXNpb25cclxuXHRcdGlmIChib3VuZHMueCArIChiYWxsLnZlbC54ICogY3VycmVudERlbHRhKSAqIGN1cnJlbnRSYXRpbyA8IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNSaWdodFgoKSkge1xyXG5cclxuXHRcdFx0Ly8gSWYgdGhlIGJhbGwgdG91Y2hlcyBsZWZ0IHJhY2tldFxyXG5cdFx0XHRpZiAoYm91bmRzLnkgKyBib3VuZHMuaGVpZ2h0ID4gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1RvcFkoKSAmJlxyXG5cdFx0XHRcdGJvdW5kcy55IDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSkge1xyXG5cclxuXHRcdFx0XHRiYWxsLnggPSAocmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCgpIC0gY3VycmVudERlYy54KSAvIGN1cnJlbnRSYXRpbztcclxuXHRcdFx0XHRvbkJhbGxDb2xsaWRlTGVmdChiYWxsKTtcdFx0XHRcdFxyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKGJvdW5kcy54IDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0xlZnRYKCkpIHtcclxuXHRcdFx0XHRiYWxsc01hbmFnZXIub25CYWxsT3V0KGJhbGwpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHQvLyBUZXN0IHJpZ2h0IGNvbGxpc2lvblxyXG5cdFx0ZWxzZSBpZiAoYm91bmRzLnggKyBib3VuZHMud2lkdGggKyAoYmFsbC52ZWwueCAqIGN1cnJlbnREZWx0YSkgKiBjdXJyZW50UmF0aW8gPiByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc0xlZnRYKCkpIHtcclxuXHJcblx0XHRcdC8vIElmIHRoZSBiYWxsIHRvdWNoZXMgcmlnaHQgcmFja2V0XHJcblx0XHRcdGlmIChib3VuZHMueSArIGJvdW5kcy5oZWlnaHQgPiByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc1RvcFkoKSAmJlxyXG5cdFx0XHRcdGJvdW5kcy55IDwgcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNCb3R0b21ZKCkpIHtcclxuXHJcblx0XHRcdFx0YmFsbC54ID0gKHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSAtIGN1cnJlbnREZWMueCAtIGJvdW5kcy53aWR0aCkgLyBjdXJyZW50UmF0aW87XHJcblx0XHRcdFx0b25CYWxsQ29sbGlkZVJpZ2h0KGJhbGwpO1xyXG5cdFx0XHR9XHJcblx0XHRcdGVsc2UgaWYgKGJvdW5kcy54ICsgYm91bmRzLndpZHRoID4gcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WCgpKSB7XHJcblx0XHRcdFx0YmFsbHNNYW5hZ2VyLm9uQmFsbE91dChiYWxsKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gSWYgYmFsbCBpcyBvdXQsIHRlc3QgY29sbGlzaW9uIHdpdGggdG9wICYgYm90dG9tIG9mIHJhY2tldHNcclxuXHRlbHNlIHtcclxuXHRcdC8vIEJhbGwgbmVlZHMgdG8gYmUgZGVzdHJveVxyXG5cdFx0aWYgKGJvdW5kcy54ICsgYm91bmRzLndpZHRoIDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0xlZnRYKCkgLSA0MCAqIGN1cnJlbnRSYXRpbyB8fFxyXG5cdFx0XHRib3VuZHMueCA+IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzUmlnaHRYKCkgKyA0MCAqIGN1cnJlbnRSYXRpbykge1xyXG5cclxuXHRcdFx0YmFsbHNNYW5hZ2VyLm9uQmFsbE91dERlc3Ryb3koYmFsbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTGVmdCByYWNrZXRcclxuXHRcdGVsc2UgaWYgKGJvdW5kcy54IDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCgpICYmXHJcblx0XHRcdGJvdW5kcy55ICsgYm91bmRzLmhlaWdodCA+IHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNUb3BZKCkgJiYgXHJcblx0XHRcdGJvdW5kcy55IDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSkge1xyXG5cclxuXHRcdFx0dmFyIGxlZnRSYWNrZXRDZW50ZXJZID0gKHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXRCb3VuZHNUb3BZKCkgKyByYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzQm90dG9tWSgpKSAqIDAuNTtcclxuXHJcblx0XHRcdC8vIGNvbGxpZGUgdG9wIG9mIHJhY2tldFxyXG5cdFx0XHRpZiAoYmFsbC52ZWwueSA+IDApIHtcclxuXHRcdFx0XHRpZiAoYmFsbC55IDwgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLnkpIHtcclxuXHRcdFx0XHRcdG9uQmFsbENvbGxpZGVUb3AoYmFsbCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJhbGwueSA9IChyYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSgpIC0gY3VycmVudERlYy55IC0gYm91bmRzLmhlaWdodCkgLyBjdXJyZW50UmF0aW8gLSAyICogc2FmZXR5R2FwU2l6ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBjb2xsaWRlIGJvdHRvbSBvZiByYWNrZXRcclxuXHRcdFx0ZWxzZSBpZiAoYmFsbC52ZWwueSA8IDApIHtcclxuXHRcdFx0XHRpZiAoYmFsbC55ID4gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLnkpIHtcclxuXHRcdFx0XHRcdG9uQmFsbENvbGxpZGVCb3R0b20oYmFsbCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJhbGwueSA9IChyYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzQm90dG9tWSgpIC0gY3VycmVudERlYy55KSAvIGN1cnJlbnRSYXRpbyArIDIgKiBzYWZldHlHYXBTaXplO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmlnaHQgcmFja2V0XHJcblx0XHRlbHNlIGlmIChib3VuZHMueCArIGJvdW5kcy53aWR0aCA+IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzTGVmdFgoKSAmJlxyXG5cdFx0XHRib3VuZHMueSArIGJvdW5kcy5oZWlnaHQgPiByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc1RvcFkoKSAmJiBcclxuXHRcdFx0Ym91bmRzLnkgPCByYWNrZXRzTWFuYWdlci5nZXRSaWdodFJhY2tldEJvdW5kc0JvdHRvbVkoKSkge1xyXG5cclxuXHRcdFx0dmFyIHJpZ2h0UmFja2V0Q2VudGVyWSA9IChyYWNrZXRzTWFuYWdlci5nZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSgpICsgcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSkgKiAwLjU7XHJcblxyXG5cdFx0XHQvLyBjb2xsaWRlIHRvcCBvZiByYWNrZXRcclxuXHRcdFx0aWYgKGJhbGwudmVsLnkgPiAwKSB7XHJcblx0XHRcdFx0aWYgKGJhbGwueSA8IHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0KCkueSkge1xyXG5cdFx0XHRcdG9uQmFsbENvbGxpZGVUb3AoYmFsbCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0YmFsbC55ID0gKHJhY2tldHNNYW5hZ2VyLmdldFJpZ2h0UmFja2V0Qm91bmRzVG9wWSgpIC0gY3VycmVudERlYy55IC0gYm91bmRzLmhlaWdodCkgLyBjdXJyZW50UmF0aW8gLSAyICogc2FmZXR5R2FwU2l6ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBjb2xsaWRlIGJvdHRvbSBvZiByYWNrZXRcclxuXHRcdFx0ZWxzZSBpZiAoYmFsbC52ZWwueSA8IDApIHtcclxuXHRcdFx0XHRpZiAoYmFsbC55ID4gcmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXQoKS55KSB7XHJcblx0XHRcdFx0b25CYWxsQ29sbGlkZUJvdHRvbShiYWxsKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0XHRiYWxsLnkgPSAocmFja2V0c01hbmFnZXIuZ2V0UmlnaHRSYWNrZXRCb3VuZHNCb3R0b21ZKCkgLSBjdXJyZW50RGVjLnkpIC8gY3VycmVudFJhdGlvICsgMiAqIHNhZmV0eUdhcFNpemU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbENvbGxpZGVUb3AoYmFsbCkge1xyXG5cdGJhbGwudmVsLnkgPSAtYmFsbC52ZWwueTtcclxuXHRiYWxsLnZlbC54ICs9IGJhbGwudmVsLnggKiAwLjAyOyBcclxuXHRpZiAoIWJhbGwub3V0KSB7XHJcblx0XHRzeW5jTWFuYWdlci5vblVwZGF0ZUJhbGwoYmFsbCwgJ3QnKTtcclxuXHR9XHJcblx0cGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyhiYWxsLCA5MCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbENvbGxpZGVCb3R0b20oYmFsbCkge1xyXG5cdGJhbGwudmVsLnkgPSAtYmFsbC52ZWwueTtcclxuXHRiYWxsLnZlbC54ICs9IGJhbGwudmVsLnggKiAwLjAyOyBcclxuXHRpZiAoIWJhbGwub3V0KSB7XHJcblx0XHRzeW5jTWFuYWdlci5vblVwZGF0ZUJhbGwoYmFsbCwgJ2InKTtcclxuXHR9XHJcblx0cGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyhiYWxsLCAyNzApO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkJhbGxDb2xsaWRlTGVmdChiYWxsKSB7XHJcblx0YmFsbC52ZWwueCA9IC1iYWxsLnZlbC54O1xyXG5cdHN5bmNNYW5hZ2VyLm9uVXBkYXRlQmFsbChiYWxsLCAnbCcpO1xyXG5cdHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoYmFsbCwgMCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQmFsbENvbGxpZGVSaWdodChiYWxsKSB7XHJcblx0YmFsbC52ZWwueCA9IC1iYWxsLnZlbC54O1xyXG5cdHN5bmNNYW5hZ2VyLm9uVXBkYXRlQmFsbChiYWxsLCAncicpO1xyXG5cdHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoYmFsbCwgMTgwKTtcclxufVxyXG5cclxuZnVuY3Rpb24gYXBwbHlNYWduZXRGb3JjZShiYWxsKSB7XHJcblx0aWYgKGJhbGwudmVsLnggPCAwKSB7XHJcblx0XHQvLyBiYWxsLnZlbC55ID0gKGJhbGwudmVsLnkgLSAocmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLmdldENlbnRlcigpLnkgLSBiYWxsLnkpICogMC4xKTtcclxuXHRcdC8vIGJhbGwudmVsLnkgPSBiYWxsLnZlbC55ICsgKDEvKGJhbGwueSAtIHJhY2tldHNNYW5hZ2VyLmdldExlZnRSYWNrZXQoKS5nZXRDZW50ZXIoKS55KSkgKiAxMFxyXG5cdFx0Ly8gY29uc29sZS5sb2coYmFsbC55IC0gcmFja2V0c01hbmFnZXIuZ2V0TGVmdFJhY2tldCgpLmdldENlbnRlcigpLnkpO1xyXG5cdH1cclxufVxyXG5cclxuZnVuY3Rpb24gdXBkYXRlU2NlbmVSZXNpemVWYWx1ZXMoZGVjLCByYXRpbykge1xyXG5cdGN1cnJlbnREZWMgPSBkZWM7XHJcblx0Y3VycmVudFJhdGlvID0gcmF0aW87XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdGluaXQ6IGluaXQsXHJcblx0dXBkYXRlOiB1cGRhdGUsXHJcblx0c2V0VmVsOiBzZXRWZWwsXHJcblx0YWRkVmVsOiBhZGRWZWwsXHJcblx0dXBkYXRlU2NlbmVSZXNpemVWYWx1ZXM6IHVwZGF0ZVNjZW5lUmVzaXplVmFsdWVzXHJcbn07XHJcbiIsImdsb2JhbC5nYW1lQ29uZmlnID0ge1xyXG4gICAgYmFzZVNjZW5lV2lkdGg6IDE0NDAsXHJcbiAgICBiYXNlU2NlbmVIZWlnaHQ6IDkwMCxcclxuICAgIGNoZWNrRGVsdGFJbnRlcnZhbFRpbWU6IDUwMFxyXG59O1xyXG5cclxuZ2xvYmFsLmFwcE1hbmFnZXIgXHRcdFx0XHQ9IHJlcXVpcmUoJy4vYXBwTWFuYWdlcicpO1xyXG5nbG9iYWwuYmFsbHNNYW5hZ2VyIFx0XHRcdD0gcmVxdWlyZSgnLi9iYWxsc01hbmFnZXInKTtcclxuZ2xvYmFsLmRlc2t0b3BDb250cm9sc01hbmFnZXIgXHQ9IHJlcXVpcmUoJy4vZGVza3RvcENvbnRyb2xzTWFuYWdlcicpO1xyXG5nbG9iYWwuaHVkTWFuYWdlciBcdFx0XHRcdD0gcmVxdWlyZSgnLi9odWRNYW5hZ2VyJyk7XHJcbmdsb2JhbC5wYXJ0aWNsZXNNYW5hZ2VyIFx0XHQ9IHJlcXVpcmUoJy4vcGFydGljbGVzTWFuYWdlcicpO1xyXG5nbG9iYWwucGh5c2ljc0VuZ2luZSBcdFx0XHQ9IHJlcXVpcmUoJy4vcGh5c2ljc0VuZ2luZScpO1xyXG5nbG9iYWwucmFja2V0c01hbmFnZXIgXHRcdFx0PSByZXF1aXJlKCcuL3JhY2tldHNNYW5hZ2VyJyk7XHJcbmdsb2JhbC5zb2NrZXRzTWFuYWdlciBcdFx0XHQ9IHJlcXVpcmUoJy4vc29ja2V0c01hbmFnZXInKTtcclxuZ2xvYmFsLnN0YWdlTWFuYWdlciBcdFx0XHQ9IHJlcXVpcmUoJy4vc3RhZ2VNYW5hZ2VyJyk7XHJcbmdsb2JhbC5zeW5jTWFuYWdlciBcdFx0XHRcdD0gcmVxdWlyZSgnLi9zeW5jTWFuYWdlcicpO1xyXG5cclxuXHJcbmFwcE1hbmFnZXIuaW5pdCgpO1xyXG5cclxuXHJcbiIsInZhciBSYWNrZXQgPSByZXF1aXJlKCcuL2NsYXNzL1JhY2tldCcpO1xyXG5cclxuXHJcbnZhciBwbGF5ZXJTaWRlID0gJ2xlZnQnLFxyXG4gICAgb3Bwb25lbnRTaWRlID0gJ3JpZ2h0JyxcclxuICAgIHJhY2tldHMgPSB7XHJcbiAgICAgICAgbGVmdDogbnVsbCxcclxuICAgICAgICByaWdodDogbnVsbFxyXG4gICAgfSxcclxuICAgIG1hcmdpbiA9IDMwO1xyXG5cclxuZnVuY3Rpb24gaW5pdChzY2VuZSkge1xyXG4gICAgcmFja2V0cy5sZWZ0ID0gbmV3IFJhY2tldCgpO1xyXG4gICAgcmFja2V0cy5yaWdodCA9IG5ldyBSYWNrZXQoKTsgXHJcblxyXG4gICAgcmVzZXRSYWNrZXRzUG9zaXRpb25zKCk7XHJcblxyXG4gICAgc3RhZ2VNYW5hZ2VyLmdldFNjZW5lKCkuYWRkUmFja2V0KHJhY2tldHMubGVmdCk7XHJcbiAgICBzdGFnZU1hbmFnZXIuZ2V0U2NlbmUoKS5hZGRSYWNrZXQocmFja2V0cy5yaWdodCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlc2V0UmFja2V0c1Bvc2l0aW9ucygpIHtcclxuXHJcbiAgICB2YXIgY2VudGVyWSA9IHN0YWdlTWFuYWdlci5nZXRTY2VuZSgpLmdldENlbnRlcigpLnk7XHJcblxyXG4gICAgcmFja2V0cy5sZWZ0LnggID0gbWFyZ2luO1xyXG4gICAgcmFja2V0cy5sZWZ0LnkgID0gY2VudGVyWTtcclxuICAgIHJhY2tldHMucmlnaHQueCA9IGdhbWVDb25maWcuYmFzZVNjZW5lV2lkdGggLSBtYXJnaW47IFxyXG4gICAgcmFja2V0cy5yaWdodC55ID0gY2VudGVyWSA7XHJcblxyXG4gICAgbW92ZVBsYXllclJhY2tldFRvKGNlbnRlclkpO1xyXG4gICAgbW92ZU9wcG9uZW50UmFja2V0VG8oY2VudGVyWSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHNldFBsYXllclNpZGUoaXNIb3N0KSB7XHJcbiAgICBjb25zb2xlLmxvZygnc2V0UGxheWVyU2lkZScpO1xyXG4gICAgcGxheWVyU2lkZSAgID0gaXNIb3N0ID8gJ2xlZnQnICA6ICdyaWdodCc7XHJcbiAgICBvcHBvbmVudFNpZGUgPSBpc0hvc3QgPyAncmlnaHQnIDogJ2xlZnQnO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb3ZlUGxheWVyUmFja2V0VG8oeSkge1xyXG4gICAgaWYgKHkgIT09IHJhY2tldHNbcGxheWVyU2lkZV0ubW92aW5nVG9ZKSB7XHJcbiAgICAgICAgc3luY01hbmFnZXIub25SYWNrZXRTZXRNb3ZpbmdUb1koeSk7XHJcbiAgICAgICAgcmFja2V0c1twbGF5ZXJTaWRlXS5zZXRNb3ZpbmdUb1koeSk7XHJcbiAgICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vdmVPcHBvbmVudFJhY2tldFRvKHkpIHtcclxuICAgIHJhY2tldHNbb3Bwb25lbnRTaWRlXS5zZXRNb3ZpbmdUb1koeSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG1vdmVQbGF5ZXJSYWNrZXRCeSh5KSB7XHJcbiAgICBtb3ZlUGxheWVyUmFja2V0VG8ocmFja2V0c1twbGF5ZXJTaWRlXS55ICsgeSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExlZnRSYWNrZXQoKSB7XHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSaWdodFJhY2tldCgpIHtcclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSgpIHtcclxuICAgIHJldHVybiByYWNrZXRzLmxlZnQuZ2V0Qm91bmRzKCkueTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVkoKSB7XHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LmdldEJvdW5kcygpLnkgKyByYWNrZXRzLmxlZnQuZ2V0Qm91bmRzKCkuaGVpZ2h0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRMZWZ0UmFja2V0Qm91bmRzTGVmdFgoKSB7XHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LmdldEJvdW5kcygpLng7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldExlZnRSYWNrZXRCb3VuZHNSaWdodFgoKSB7XHJcbiAgICByZXR1cm4gcmFja2V0cy5sZWZ0LmdldEJvdW5kcygpLnggKyByYWNrZXRzLmxlZnQuZ2V0Qm91bmRzKCkud2lkdGg7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJpZ2h0UmFja2V0Qm91bmRzVG9wWSgpIHtcclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0LmdldEJvdW5kcygpLnk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJpZ2h0UmFja2V0Qm91bmRzQm90dG9tWSgpIHtcclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0LmdldEJvdW5kcygpLnkgKyByYWNrZXRzLnJpZ2h0LmdldEJvdW5kcygpLmhlaWdodDtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WCgpIHtcclxuICAgIHJldHVybiByYWNrZXRzLnJpZ2h0LmdldEJvdW5kcygpLng7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJpZ2h0UmFja2V0Qm91bmRzUmlnaHRYKCkge1xyXG4gICAgcmV0dXJuIHJhY2tldHMucmlnaHQuZ2V0Qm91bmRzKCkueCArIHJhY2tldHMucmlnaHQuZ2V0Qm91bmRzKCkud2lkdGg7XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdGluaXQ6IGluaXQsXHJcbiAgICByZXNldFJhY2tldHNQb3NpdGlvbnM6IHJlc2V0UmFja2V0c1Bvc2l0aW9ucyxcclxuICAgIHNldFBsYXllclNpZGU6IHNldFBsYXllclNpZGUsXHJcbiAgICBtb3ZlUGxheWVyUmFja2V0VG86IG1vdmVQbGF5ZXJSYWNrZXRUbyxcclxuICAgIG1vdmVPcHBvbmVudFJhY2tldFRvOiBtb3ZlT3Bwb25lbnRSYWNrZXRUbyxcclxuICAgIG1vdmVQbGF5ZXJSYWNrZXRCeTogbW92ZVBsYXllclJhY2tldEJ5LFxyXG4gICAgZ2V0TGVmdFJhY2tldDogZ2V0TGVmdFJhY2tldCxcclxuICAgIGdldFJpZ2h0UmFja2V0OiBnZXRSaWdodFJhY2tldCxcclxuICAgIGdldExlZnRSYWNrZXRCb3VuZHNUb3BZOiBnZXRMZWZ0UmFja2V0Qm91bmRzVG9wWSxcclxuICAgIGdldExlZnRSYWNrZXRCb3VuZHNMZWZ0WDogZ2V0TGVmdFJhY2tldEJvdW5kc0xlZnRYLFxyXG4gICAgZ2V0TGVmdFJhY2tldEJvdW5kc0JvdHRvbVk6IGdldExlZnRSYWNrZXRCb3VuZHNCb3R0b21ZLFxyXG4gICAgZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WDogZ2V0TGVmdFJhY2tldEJvdW5kc1JpZ2h0WCxcclxuICAgIGdldFJpZ2h0UmFja2V0Qm91bmRzVG9wWTogZ2V0UmlnaHRSYWNrZXRCb3VuZHNUb3BZLFxyXG4gICAgZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WDogZ2V0UmlnaHRSYWNrZXRCb3VuZHNMZWZ0WCxcclxuICAgIGdldFJpZ2h0UmFja2V0Qm91bmRzQm90dG9tWTogZ2V0UmlnaHRSYWNrZXRCb3VuZHNCb3R0b21ZLFxyXG4gICAgZ2V0UmlnaHRSYWNrZXRCb3VuZHNSaWdodFg6IGdldFJpZ2h0UmFja2V0Qm91bmRzUmlnaHRYXHJcbn07XHJcbiIsInZhciBzb2NrZXQsXHJcbiAgICBjb25uZWN0aW9uSUQsXHJcbiAgICBzZXJ2ZXJDb25maWcsXHJcbiAgICBjb250cm9sTW9kZTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcblxyXG5cdCQuZ2V0SlNPTihcIi4uL2NvbmZpZy5qc29uXCIsIGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgICBzZXJ2ZXJDb25maWcgPSBkYXRhO1xyXG4gICAgICAgIHZhciBhZGRyZXNzID0gc2VydmVyQ29uZmlnLnVybCArIFwiOlwiICsgc2VydmVyQ29uZmlnLnBvcnQ7XHJcblxyXG4gICAgICAgICQuZ2V0U2NyaXB0KCdodHRwOi8vJyArIGFkZHJlc3MgKyAnL3NvY2tldC5pby9zb2NrZXQuaW8uanMnKVxyXG4gICAgICAgICAgICAuZG9uZShmdW5jdGlvbiggKSB7XHJcbiAgICAgICAgICAgICAgICBpbml0U29ja2V0KGFkZHJlc3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdFNvY2tldChhZGRyZXNzKSB7XHJcblxyXG4gICAgc29ja2V0ID0gaW8uY29ubmVjdChhZGRyZXNzKTtcclxuXHJcbiAgICBzZW5kSG9zdFJlcXVlc3QoKTtcclxuICAgIGJpbmRTb2NrZXRFdmVudHMoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gc2VuZEhvc3RSZXF1ZXN0KCkge1xyXG4gICAgc29ja2V0LmVtaXQoJ25ld0hvc3RpbmcnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gYmluZFNvY2tldEV2ZW50cygpIHtcclxuICAgIHNvY2tldC5vbignbmV3Q29ubmVjdGlvbklEJywgb25OZXdDb25uZWN0aW9uSUQpO1xyXG4gICAgc29ja2V0Lm9uKCdjb25uZWN0aW9uUmVhZHknLCBvbkNvbm5lY3Rpb25SZWFkeSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uTmV3Q29ubmVjdGlvbklEKGRhdGEpIHtcclxuICAgIHNvY2tldC5yZW1vdmVMaXN0ZW5lcignbmV3Q29ubmVjdGlvbklEJyk7XHJcblxyXG4gICAgY29ubmVjdGlvbklEID0gZGF0YS5jb25uZWN0aW9uSUQ7XHJcbiAgICBcclxuICAgIC8vZGlzcGxheSB0ZXh0ICsgcXJjb2RlXHJcbiAgICB2YXIgJGNvbnRhaW5lciA9ICQoJyNpbmZvLWNvbm5lY3Rpb24nKS5zaG93KCksXHJcbiAgICAgICAgJHVybCA9ICQoJy5tb2JpbGUtdXJsJywgJGNvbnRhaW5lciksXHJcbiAgICAgICAgJHFyY29kZSA9ICQoJyNxci1zY2FuJywgJGNvbnRhaW5lcik7XHJcblxyXG4gICAgdmFyIHVybE1vYmlsZSAgID0gc2VydmVyQ29uZmlnLnVybCArICc6JyArIHNlcnZlckNvbmZpZy5wb3J0ICsgJy9tb2JpbGU/aWQ9JyArIGRhdGEuY29ubmVjdGlvbklEO1xyXG5cclxuICAgICR1cmwudGV4dCh1cmxNb2JpbGUpO1xyXG4gICAgJHFyY29kZS5xcmNvZGUoe3dpZHRoOicyMDAnLCBoZWlnaHQ6JzIwMCcsIHRleHQ6dXJsTW9iaWxlfSk7XHJcblxyXG4gICAgJCgnI2Rlc2t0b3Atb25seScpLm9uKCdjbGljaycsIG9uQ2xpY2tEZXNrdG9wT25seSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQ2xpY2tEZXNrdG9wT25seSgpIHtcclxuICAgIHNvY2tldC5lbWl0KCdkZXNrdG9wT25seScsIGNvbm5lY3Rpb25JRCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uQ29ubmVjdGlvblJlYWR5KG1vZGUpIHtcclxuICAgICQoJyNpbmZvLWNvbm5lY3Rpb24nKS5oaWRlKCk7XHJcbiAgICBzb2NrZXQucmVtb3ZlTGlzdGVuZXIoJ2Nvbm5uZWN0aW9uUmVhZHknKTtcclxuXHJcbiAgICBpbml0QXBwKCk7XHJcblxyXG4gICAgYXBwTWFuYWdlci5vbkNvbm5lY3Rpb25SZWFkeShtb2RlKTtcclxufVxyXG5cclxuZnVuY3Rpb24gaW5pdEFwcCAoKSB7XHJcblxyXG4gICAgdmFyICRjb250YWluZXJJbmZvID0gJCgnI2NvbnRhaW5lci1pbmZvJykuc2hvdygpO1xyXG4gICAgdmFyICRnYW1lU3RhdGUgPSAkKCcjZ2FtZS1zdGF0ZScpO1xyXG4gICAgdmFyICRwbGF5ZXJDb250cm9sRGF0YSA9ICQoJyNwbGF5ZXItY29udHJvbC1kYXRhJyk7XHJcbiAgICB2YXIgJG9wcG9uZW50Q29udHJvbERhdGEgPSAkKCcjb3Bwb25lbnQtY29udHJvbC1kYXRhJyk7XHJcblxyXG4gICAgdmFyIGlzSG9zdDtcclxuICAgIHZhciBnYW1lUm9vbUlEO1xyXG5cclxuICAgIHNvY2tldC5vbignbW9iaWxlIHRvcCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGh1ZE1hbmFnZXIuc2V0RGVidWcxVGV4dCgnWU9VOiB0b3AnKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignbW9iaWxlIGJvdHRvbScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGh1ZE1hbmFnZXIuc2V0RGVidWcxVGV4dCgnWU9VOiBib3R0b20nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignbW9iaWxlIHN0b3AnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICBodWRNYW5hZ2VyLnNldERlYnVnMVRleHQoJ1lPVTogJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzb2NrZXQub24oJ29wcG9uZW50IHRvcCcsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGh1ZE1hbmFnZXIuc2V0RGVidWcyVGV4dCgnSElNOiB0b3AnKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignb3Bwb25lbnQgYm90dG9tJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaHVkTWFuYWdlci5zZXREZWJ1ZzJUZXh0KCdISU06IGJvdHRvbScpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc29ja2V0Lm9uKCdvcHBvbmVudCBzdG9wJywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaHVkTWFuYWdlci5zZXREZWJ1ZzJUZXh0KCdISU06ICcpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc29ja2V0Lm9uKCdvcHBvbmVudCBkaXNjb25uZWN0JywgZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgaHVkTWFuYWdlci5zZXRJbmZvc1RleHQoJ09wcG9uZW50IGRpc2Nvbm5lY3RlZC4uLicpO1xyXG4gICAgICAgIGFwcE1hbmFnZXIub25PcHBvbmVudERpc2Nvbm5lY3QoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignZ2FtZSBqb2luZWQnLCBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICAgICAgaXNIb3N0ID0gZGF0YS5pc0hvc3Q7XHJcbiAgICAgICAgZ2FtZVJvb21JRCA9IGRhdGEuZ2FtZVJvb21JRDtcclxuICAgICAgICBodWRNYW5hZ2VyLnNldEluZm9zVGV4dCgnR2FtZSAjJyArIGdhbWVSb29tSUQgKyAnIGpvaW5lZC4gXFxuV2FpdGluZyBmb3IgYW5vdGhlciBwbGF5ZXIuLi4nKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignZ2FtZSByZWFkeScsIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIGlmIChpc0hvc3QpIHtcclxuICAgICAgICAgICAgaHVkTWFuYWdlci5zZXRJbmZvc1RleHQoJ0dhbWUgIycgKyBnYW1lUm9vbUlEICsgJyBbSE9TVF0nKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZWxzZSB7XHJcbiAgICAgICAgICAgIGh1ZE1hbmFnZXIuc2V0SW5mb3NUZXh0KCdHYW1lICMnICsgZ2FtZVJvb21JRCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGFwcE1hbmFnZXIub25HYW1lUmVhZHkoZ2FtZVJvb21JRCwgaXNIb3N0KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHNvY2tldC5vbignc3luYycsIGZ1bmN0aW9uKGRhdGEpIHtcclxuICAgICAgICBzeW5jTWFuYWdlci5vblN5bmMoZGF0YSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZW1pdChtZXNzYWdlLCBkYXRhKSB7XHJcbiAgICBzb2NrZXQuZW1pdChtZXNzYWdlLCBkYXRhKTtcclxufVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcblx0aW5pdDogaW5pdCxcclxuICAgIGVtaXQ6IGVtaXRcclxufTtcclxuIiwidmFyIFNjZW5lID0gcmVxdWlyZSgnLi9jbGFzcy9TY2VuZScpO1xyXG5cclxudmFyIHJlbmRlcmVyLFxyXG4gICAgc3RhZ2UsIFxyXG4gICAgc2NlbmUsXHJcbiAgICBwYXJ0aWNsZXNDb250YWluZXIsXHJcbiAgICBzdGF0cyxcclxuICAgIGxhc3RUaW1lID0gMCwgXHJcbiAgICBkZWx0YSA9IDAsXHJcbiAgICBkZWMgPSBuZXcgVmVjdG9yMigpLFxyXG4gICAgcmF0aW8gPSAxLFxyXG4gICAgcGl4ZWxhdGVGaWx0ZXIsXHJcbiAgICBiYWNrZ3JvdW5kLFxyXG4gICAgY29sb3JTdGVwRmlsdGVyLFxyXG4gICAgc2NhbkZpbHRlcixcclxuICAgIGNoZWNrRGVsdGFJbnRlcnZhbCxcclxuICAgIHN0YXJ0VGltZSxcclxuICAgIGVtaXR0ZXIsXHJcbiAgICBpbmFjdGl2ZSA9IGZhbHNlLFxyXG4gICAgaXNQYXVzZWQgPSBmYWxzZTtcclxuXHJcbmZ1bmN0aW9uIGluaXQoKSB7XHJcbiAgICAvLyBjcmVhdGUgYW4gbmV3IGluc3RhbmNlIG9mIGEgcGl4aSBzdGFnZVxyXG4gICAgc3RhZ2UgPSBuZXcgUElYSS5TdGFnZSgweDIyMjIyMik7XHJcbiAgICBcclxuICAgIC8vIGNyZWF0ZSBhIHJlbmRlcmVyIGluc3RhbmNlIGFuZCBhcHBlbmQgdGhlIHZpZXcgXHJcbiAgICByZW5kZXJlciA9IFBJWEkuYXV0b0RldGVjdFJlbmRlcmVyKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQsIG51bGwsIGZhbHNlLCB0cnVlKTtcclxuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdnYW1lJykuYXBwZW5kQ2hpbGQocmVuZGVyZXIudmlldyk7XHJcbiAgICBcclxuXHJcbiAgICB2YXIgdW5pZm9ybXMgPSB7fTtcclxuICAgIHVuaWZvcm1zLnBvd2VyID0geyB0eXBlOiAnMWYnLCB2YWx1ZTogMS8xMDAwIH07XHJcbiAgICB1bmlmb3Jtcy5ub2lzZSA9IHsgdHlwZTogJzFmJywgdmFsdWU6IDAuMiB9O1xyXG4gICAgXHJcbiAgICAvLy8vIGdyYWluIGZpbHRlci4uXHJcbiAgICBcclxuICAgIHZhciBmcmFnbWVudFNyYyA9IFtcclxuXHJcbiAgICAgICAgJ3ByZWNpc2lvbiBtZWRpdW1wIGZsb2F0OycsXHJcbiAgICAgICAgJ3ZhcnlpbmcgdmVjMiB2VGV4dHVyZUNvb3JkOycsXHJcbiAgICAgICAgJ3ZhcnlpbmcgdmVjNCB2Q29sb3I7JyxcclxuICAgICAgICAndW5pZm9ybSBzYW1wbGVyMkQgdVNhbXBsZXI7JyxcclxuICAgICAgICAndW5pZm9ybSBmbG9hdCBub2lzZTsnLFxyXG4gICAgICAgICd1bmlmb3JtIGZsb2F0IHBvd2VyOycsXHJcblxyXG4gICAgICAgICdmbG9hdCByYW5kKHZlYzIgY28pIHsnLFxyXG4gICAgICAgICcgICAgcmV0dXJuIGZyYWN0KHNpbihkb3QoY28ueHkgLHZlYzIoMTIuOTg5OCw3OC4yMzMgKiBub2lzZSkpKSAqIDQzNzU4LjU0NTMpOycsXHJcbiAgICAgICAgJ30nLFxyXG4gICAgICAgIFxyXG4gICAgICAgICd2b2lkIG1haW4odm9pZCkgeycsXHJcbiAgICAgICAgJyAgIHZlYzIgY29yZCA9IHZUZXh0dXJlQ29vcmQ7JyxcclxuICAgICAgICAnICAgY29yZC55ICs9IG5vaXNlICogMC4wMDE7JyxcclxuXHJcbiAgICAgICAgJyAgICB2ZWM0IGNvbG9yID0gdGV4dHVyZTJEKHVTYW1wbGVyLCB2VGV4dHVyZUNvb3JkKTsnLFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAnICAgIGZsb2F0IGRpZmYgPSAocmFuZCh2VGV4dHVyZUNvb3JkKSAtIDAuNSkgKiAwLjA3NTsnLFxyXG4gICAgICAgICcgICAgY29sb3IuciArPSBkaWZmOycsXHJcbiAgICAgICAgJyAgICBjb2xvci5nICs9IGRpZmY7JyxcclxuICAgICAgICAnICAgIGNvbG9yLmIgKz0gZGlmZjsnLFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAnICAgZ2xfRnJhZ0NvbG9yID0gY29sb3I7JyxcclxuICAgICAgICAnfSdcclxuICAgIF07XHJcblxyXG4gICAgc2NhbkZpbHRlciA9IG5ldyBQSVhJLkFic3RyYWN0RmlsdGVyKGZyYWdtZW50U3JjLCB1bmlmb3Jtcyk7XHJcblxyXG4gICAgcGl4ZWxhdGVGaWx0ZXIgPSBuZXcgUElYSS5QaXhlbGF0ZUZpbHRlcigpO1xyXG4gICAgcGl4ZWxhdGVGaWx0ZXIuc2l6ZS54ID0gMztcclxuICAgIHBpeGVsYXRlRmlsdGVyLnNpemUueSA9IDM7XHJcblxyXG4gICAgc3RhdHMgPSBuZXcgU3RhdHMoKTtcclxuICAgIHN0YXRzLmRvbUVsZW1lbnQuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xyXG4gICAgc3RhdHMuZG9tRWxlbWVudC5zdHlsZS5yaWdodCA9ICcwcHgnO1xyXG4gICAgc3RhdHMuZG9tRWxlbWVudC5zdHlsZS50b3AgPSAnMHB4JztcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoc3RhdHMuZG9tRWxlbWVudCk7XHJcblxyXG4gICAgYmFja2dyb3VuZCA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XHJcbiAgICBiYWNrZ3JvdW5kLmJlZ2luRmlsbCgweDExMTExMSk7XHJcbiAgICBiYWNrZ3JvdW5kLmRyYXdSZWN0KDAsIDAsIHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xyXG4gICAgc3RhZ2UuYWRkQ2hpbGQoYmFja2dyb3VuZCk7XHJcblxyXG4gICAgc2NlbmUgPSBuZXcgU2NlbmUoZ2FtZUNvbmZpZy5iYXNlU2NlbmVXaWR0aCwgZ2FtZUNvbmZpZy5iYXNlU2NlbmVIZWlnaHQpO1xyXG5cclxuICAgIHN0YWdlLmFkZENoaWxkKHNjZW5lKTtcclxuICAgIHVwZGF0ZUdhbWVTaXplKCk7XHJcbiAgICBcclxuICAgIHdpbmRvdy5vbnJlc2l6ZSA9IHVwZGF0ZUdhbWVTaXplO1xyXG5cclxuICAgIHN0YWdlLmZpbHRlcnMgPSBbcGl4ZWxhdGVGaWx0ZXIsIHNjYW5GaWx0ZXJdO1xyXG4gICAgLy8gc3RhZ2UuZmlsdGVycyA9IFtwaXhlbGF0ZUZpbHRlcl07XHJcblxyXG4gICAgaHVkTWFuYWdlci5pbml0KCk7XHJcbiAgICByYWNrZXRzTWFuYWdlci5pbml0KCk7XHJcbiAgICBwaHlzaWNzRW5naW5lLmluaXQoKTtcclxuICAgIHBhcnRpY2xlc01hbmFnZXIuaW5pdCgpO1xyXG5cclxuICAgIFxyXG5cclxuICAgIHN0YXJ0VGltZSA9IGFwcE1hbmFnZXIuZ2V0U3RhcnRUaW1lKCk7XHJcbiAgICBjaGVja0RlbHRhSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjaGVja0RlbHRhLCBnYW1lQ29uZmlnLmNoZWNrRGVsdGFJbnRlcnZhbFRpbWUpO1xyXG4gICAgdXBkYXRlKCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHVwZGF0ZSh0aW1lKSB7XHJcbiAgICByZXF1ZXN0QW5pbUZyYW1lKCB1cGRhdGUgKTtcclxuICAgIGlmICh0aW1lKSB7XHJcblxyXG4gICAgICAgIC8vIHNjYW5GaWx0ZXIudW5pZm9ybXMucG93ZXIudmFsdWUgKz0gKGVhc2UgLSAgc2NhbkZpbHRlci51bmlmb3Jtcy5wb3dlci52YWx1ZSApICogMC4zO1xyXG5cclxuICAgICAgICBzY2FuRmlsdGVyLnVuaWZvcm1zLm5vaXNlLnZhbHVlICs9IDAuMTtcclxuICAgICAgICBzY2FuRmlsdGVyLnVuaWZvcm1zLm5vaXNlLnZhbHVlICU9IDE7XHJcbiAgICAgICAgc2NhbkZpbHRlci5zeW5jVW5pZm9ybXMoKTtcclxuXHJcblxyXG4gICAgICAgIGRlbHRhID0gKHRpbWUgLSBsYXN0VGltZSkgKiAwLjAwMTtcclxuICAgICAgICBsYXN0VGltZSA9IHRpbWU7XHJcbiAgICAgICAgc3RhdHMudXBkYXRlKCk7XHJcbiAgICAgICAgcGh5c2ljc0VuZ2luZS51cGRhdGUoZGVsdGEpO1xyXG4gICAgICAgIHBhcnRpY2xlc01hbmFnZXIudXBkYXRlKGRlbHRhKTtcclxuXHJcbiAgICAgICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcclxuICAgIH1cclxufVxyXG5cclxuLy8gTWFudWFsbHkgdXBkYXRlIHBoeXNpY3MgaWYgcmVxdWVzdEFuaW1GcmFtZSBub3QgYXZhaWxhYmxlIChpZiB0YWIgaW5hY3RpdmUpXHJcbmZ1bmN0aW9uIGNoZWNrRGVsdGEoKSB7XHJcbiAgICB2YXIgdGVtcFRpbWUgPSBuZXcgRGF0ZSgpIC0gc3RhcnRUaW1lO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ3RlbXBUaW1lJywgdGVtcFRpbWUpO1xyXG4gICAgLy8gY29uc29sZS5sb2coJ2xhc3RUaW1lJywgbGFzdFRpbWUpO1xyXG4gICAgaWYodGVtcFRpbWUgLSBsYXN0VGltZSA+PSBnYW1lQ29uZmlnLmNoZWNrRGVsdGFJbnRlcnZhbFRpbWUpIHtcclxuICAgICAgICBpZiAoIWluYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIGluYWN0aXZlID0gdHJ1ZTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ3BsYXllciBpcyBpbmFjdGl2ZScpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGluYWN0aXZlKSB7XHJcbiAgICAgICAgaW5hY3RpdmUgPSBmYWxzZTtcclxuICAgICAgICBjb25zb2xlLmxvZygncGxheWVyIGNhbWUgYmFjaycpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVHYW1lU2l6ZSgpIHtcclxuICAgIHJlbmRlcmVyLnJlc2l6ZSh3aW5kb3cuaW5uZXJXaWR0aCwgd2luZG93LmlubmVySGVpZ2h0KTtcclxuXHJcbiAgICB2YXIgcmF0aW9XID0gd2luZG93LmlubmVyV2lkdGggIC8gZ2FtZUNvbmZpZy5iYXNlU2NlbmVXaWR0aDtcclxuICAgIHZhciByYXRpb0ggPSB3aW5kb3cuaW5uZXJIZWlnaHQgLyBnYW1lQ29uZmlnLmJhc2VTY2VuZUhlaWdodDtcclxuXHJcbiAgICBpZiAocmF0aW9XIDwgcmF0aW9IKSB7XHJcbiAgICAgICAgcmF0aW8gPSByYXRpb1c7XHJcbiAgICAgICAgZGVjLnggPSAwO1xyXG4gICAgICAgIGRlYy55ID0gKHdpbmRvdy5pbm5lckhlaWdodCAtIGdhbWVDb25maWcuYmFzZVNjZW5lSGVpZ2h0ICogcmF0aW8pIC8gMjtcclxuICAgIH1cclxuICAgIGVsc2Uge1xyXG4gICAgICAgIHJhdGlvID0gcmF0aW9IO1xyXG4gICAgICAgIGRlYy54ID0gKHdpbmRvdy5pbm5lcldpZHRoIC0gZ2FtZUNvbmZpZy5iYXNlU2NlbmVXaWR0aCAqIHJhdGlvKSAvIDI7XHJcbiAgICAgICAgZGVjLnkgPSAwO1xyXG4gICAgfVxyXG5cclxuICAgIHNjZW5lLnNjYWxlID0gbmV3IFBJWEkuUG9pbnQocmF0aW8sIHJhdGlvKTtcclxuICAgIHNjZW5lLnggPSBkZWMueDtcclxuICAgIHNjZW5lLnkgPSBkZWMueTtcclxuXHJcbiAgICBiYWNrZ3JvdW5kLndpZHRoID0gd2luZG93LmlubmVyV2lkdGg7XHJcbiAgICBiYWNrZ3JvdW5kLmhlaWdodCA9IHdpbmRvdy5pbm5lckhlaWdodDtcclxuXHJcbiAgICBwaHlzaWNzRW5naW5lLnVwZGF0ZVNjZW5lUmVzaXplVmFsdWVzKGRlYywgcmF0aW8pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBzZXRQaXhlbFNoYWRlclNpemUoc2l6ZSkge1xyXG4gICAgcGl4ZWxhdGVGaWx0ZXIuc2l6ZS54ID0gc2l6ZTtcclxuICAgIHBpeGVsYXRlRmlsdGVyLnNpemUueSA9IHNpemU7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFNjZW5lKCkge1xyXG4gICAgcmV0dXJuIHNjZW5lO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRTdGFnZSgpIHtcclxuICAgIHJldHVybiBzdGFnZTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0RGVjKCkge1xyXG4gICAgcmV0dXJuIGRlYztcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmF0aW8oKSB7XHJcbiAgICByZXR1cm4gcmF0aW87XHJcbn1cclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgaW5pdDogaW5pdCxcclxuICAgIHNldFBpeGVsU2hhZGVyU2l6ZTogc2V0UGl4ZWxTaGFkZXJTaXplLFxyXG4gICAgZ2V0U2NlbmU6IGdldFNjZW5lLFxyXG4gICAgZ2V0U3RhZ2U6IGdldFN0YWdlLFxyXG4gICAgZ2V0RGVjOiBnZXREZWMsXHJcbiAgICBnZXRSYXRpbzogZ2V0UmF0aW9cclxufTtcclxuIiwiZnVuY3Rpb24gaW5pdCgpIHtcclxuXHRcclxufVxyXG5cclxuZnVuY3Rpb24gb25TeW5jKGRhdGEpIHtcclxuICAgIC8vIGNvbnNvbGUubG9nKCdzeW5jJywgZGF0YSk7XHJcbiAgICBpZiAoZGF0YS5ldmVudCA9PT0gJ2NyZWF0ZUJhbGwnKSB7XHJcbiAgICAgICAgYmFsbHNNYW5hZ2VyLmNyZWF0ZUJhbGwoZGF0YSk7XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChkYXRhLmV2ZW50ID09PSAndXBkYXRlQmFsbCcpIHtcclxuICAgICAgICBiYWxsc01hbmFnZXIudXBkYXRlQmFsbChkYXRhKTtcclxuXHJcbiAgICAgICAgaWYgKGRhdGEuY29sbGlkaW5nRGlyZWN0aW9uID09PSAndCcpIHtcclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyhiYWxsc01hbmFnZXIuZ2V0QmFsbChkYXRhLklEKSwgOTApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBlbHNlIGlmIChkYXRhLmNvbGxpZGluZ0RpcmVjdGlvbiA9PT0gJ2InKSB7XHJcbiAgICAgICAgICAgIHBhcnRpY2xlc01hbmFnZXIuY3JlYXRlQmFsbENvbGxpZGVQYXJ0aWNsZXMoYmFsbHNNYW5hZ2VyLmdldEJhbGwoZGF0YS5JRCksIDI3MCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGRhdGEuY29sbGlkaW5nRGlyZWN0aW9uID09PSAnbCcpIHtcclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyhiYWxsc01hbmFnZXIuZ2V0QmFsbChkYXRhLklEKSwgMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKGRhdGEuY29sbGlkaW5nRGlyZWN0aW9uID09PSAncicpIHtcclxuICAgICAgICAgICAgcGFydGljbGVzTWFuYWdlci5jcmVhdGVCYWxsQ29sbGlkZVBhcnRpY2xlcyhiYWxsc01hbmFnZXIuZ2V0QmFsbChkYXRhLklEKSwgMTgwKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChkYXRhLmV2ZW50ID09PSAnc2V0QmFsbE91dCcpIHtcclxuICAgICAgICB2YXIgb3V0QmFsbCA9IGJhbGxzTWFuYWdlci5nZXRCYWxsKGRhdGEuSUQpO1xyXG4gICAgICAgIGlmIChvdXRCYWxsKSB7XHJcbiAgICAgICAgICAgIGJhbGxzTWFuYWdlci5zZXRCYWxsT3V0KG91dEJhbGwpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGVsc2UgaWYgKGRhdGEuZXZlbnQgPT09ICdkZXN0cm95QmFsbCcpIHtcclxuICAgICAgICB2YXIgZGVzdHJveWVkQmFsbCA9IGJhbGxzTWFuYWdlci5nZXRCYWxsKGRhdGEuSUQpO1xyXG4gICAgICAgIGlmIChkZXN0cm95ZWRCYWxsKSB7XHJcbiAgICAgICAgICAgIGJhbGxzTWFuYWdlci5kZXN0cm95QmFsbChkZXN0cm95ZWRCYWxsKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBlbHNlIGlmIChkYXRhLmV2ZW50ID09PSAncmFja2V0TW92ZScpIHtcclxuICAgICAgICByYWNrZXRzTWFuYWdlci5tb3ZlT3Bwb25lbnRSYWNrZXRUbyhkYXRhLnkpO1xyXG4gICAgfVxyXG59XHJcblxyXG5mdW5jdGlvbiBvbkNyZWF0ZUJhbGwoYmFsbCkge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgZXZlbnQ6ICdjcmVhdGVCYWxsJyxcclxuICAgICAgICBJRDogYmFsbC5JRCxcclxuICAgICAgICBjb2xvcjogYmFsbC5jb2xvcixcclxuICAgICAgICBwb3M6IHtcclxuICAgICAgICAgICAgeDogYmFsbC54LFxyXG4gICAgICAgICAgICB5OiBiYWxsLnlcclxuICAgICAgICB9LFxyXG4gICAgICAgIHZlbDoge1xyXG4gICAgICAgICAgICB4OiBiYWxsLnZlbC54LFxyXG4gICAgICAgICAgICB5OiBiYWxsLnZlbC55LFxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBzb2NrZXRzTWFuYWdlci5lbWl0KCdzeW5jJywgZGF0YSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIG9uVXBkYXRlQmFsbChiYWxsLCBjb2xsaWRpbmdEaXJlY3Rpb24pIHtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgIGV2ZW50OiAndXBkYXRlQmFsbCcsXHJcbiAgICAgICAgSUQ6IGJhbGwuSUQsXHJcbiAgICAgICAgcG9zOiB7XHJcbiAgICAgICAgICAgIHg6IGJhbGwueCxcclxuICAgICAgICAgICAgeTogYmFsbC55XHJcbiAgICAgICAgfSxcclxuICAgICAgICB2ZWw6IHtcclxuICAgICAgICAgICAgeDogYmFsbC52ZWwueCxcclxuICAgICAgICAgICAgeTogYmFsbC52ZWwueSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNvbGxpZGluZ0RpcmVjdGlvbjogY29sbGlkaW5nRGlyZWN0aW9uXHJcbiAgICB9O1xyXG4gICAgc29ja2V0c01hbmFnZXIuZW1pdCgnc3luYycsIGRhdGEpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBvbkJhbGxPdXQoYmFsbCkge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgZXZlbnQ6ICdzZXRCYWxsT3V0JyxcclxuICAgICAgICBJRDogYmFsbC5JRFxyXG4gICAgfTtcclxuICAgIHNvY2tldHNNYW5hZ2VyLmVtaXQoJ3N5bmMnLCBkYXRhKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25CYWxsRGVzdHJveShiYWxsKSB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICBldmVudDogJ2Rlc3Ryb3lCYWxsJyxcclxuICAgICAgICBJRDogYmFsbC5JRFxyXG4gICAgfTtcclxuICAgIHNvY2tldHNNYW5hZ2VyLmVtaXQoJ3N5bmMnLCBkYXRhKTtcclxufVxyXG5cclxuZnVuY3Rpb24gb25SYWNrZXRTZXRNb3ZpbmdUb1koeSkge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgZXZlbnQ6ICdyYWNrZXRNb3ZlJyxcclxuICAgICAgICB5OiB5XHJcbiAgICB9O1xyXG4gICAgc29ja2V0c01hbmFnZXIuZW1pdCgnc3luYycsIGRhdGEpO1xyXG59XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuXHRpbml0OiBpbml0LFxyXG4gICAgb25TeW5jOiBvblN5bmMsXHJcbiAgICBvbkNyZWF0ZUJhbGw6IG9uQ3JlYXRlQmFsbCxcclxuICAgIG9uVXBkYXRlQmFsbDogb25VcGRhdGVCYWxsLFxyXG4gICAgb25CYWxsT3V0OiBvbkJhbGxPdXQsXHJcbiAgICBvbkJhbGxEZXN0cm95OiBvbkJhbGxEZXN0cm95LFxyXG4gICAgb25SYWNrZXRTZXRNb3ZpbmdUb1k6IG9uUmFja2V0U2V0TW92aW5nVG9ZXHJcbn07XHJcbiJdfQ==
