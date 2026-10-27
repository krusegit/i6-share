var __defProp = Object.defineProperty;
var __export = (target, all4) => {
  for (var name in all4)
    __defProp(target, name, { get: all4[name], enumerable: true });
};

// node_modules/effect/dist/Pipeable.js
var pipeArguments = (self, args2) => {
  switch (args2.length) {
    case 0:
      return self;
    case 1:
      return args2[0](self);
    case 2:
      return args2[1](args2[0](self));
    case 3:
      return args2[2](args2[1](args2[0](self)));
    case 4:
      return args2[3](args2[2](args2[1](args2[0](self))));
    case 5:
      return args2[4](args2[3](args2[2](args2[1](args2[0](self)))));
    case 6:
      return args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))));
    case 7:
      return args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))));
    case 8:
      return args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self))))))));
    case 9:
      return args2[8](args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self)))))))));
    default: {
      let ret = self;
      for (let i = 0, len = args2.length; i < len; i++) {
        ret = args2[i](ret);
      }
      return ret;
    }
  }
};
var Prototype = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var Class = /* @__PURE__ */ (function() {
  function PipeableBase() {
  }
  PipeableBase.prototype = Prototype;
  return PipeableBase;
})();

// node_modules/effect/dist/Function.js
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : (self) => body(self, ...arguments);
    };
  }
  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`);
    case 2:
      return function(a, b) {
        if (arguments.length >= 2) {
          return body(a, b);
        }
        return function(self) {
          return body(self, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self) {
          return body(self, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args2 = arguments;
        return function(self) {
          return body(self, ...args2);
        };
      };
  }
};
var identity = (a) => a;
var constant = (value3) => () => value3;
var constTrue = /* @__PURE__ */ constant(true);
var constFalse = /* @__PURE__ */ constant(false);
var constNull = /* @__PURE__ */ constant(null);
var constUndefined = /* @__PURE__ */ constant(void 0);
var constVoid = constUndefined;
function pipe(a, ...args2) {
  return pipeArguments(a, args2);
}
function memoize(f) {
  const cache2 = /* @__PURE__ */ new WeakMap();
  return (a) => {
    const cached3 = cache2.get(a);
    if (cached3 !== void 0) return cached3;
    const result3 = f(a);
    cache2.set(a, result3);
    return result3;
  };
}
function memoizeIdempotent(f) {
  const cache2 = /* @__PURE__ */ new WeakMap();
  return (a) => {
    const cached3 = cache2.get(a);
    if (cached3 !== void 0) return cached3;
    const result3 = f(a);
    cache2.set(a, result3);
    if (result3 !== a) {
      cache2.set(result3, result3);
    }
    return result3;
  };
}

// node_modules/effect/dist/internal/equal.js
var getAllObjectKeys = (obj) => {
  const keys3 = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object) return keys3;
  if (obj instanceof Error) {
    keys3.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0; i < ownKeys.length; i++) {
      keys3.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys3.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys3.delete("constructor");
  }
  return keys3;
};
var byReferenceInstances = /* @__PURE__ */ new WeakSet();
var viewBytes = (view) => new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

// node_modules/effect/dist/internal/hash.js
var backEdges = 0;
var addBackEdge = () => {
  backEdges++;
};

// node_modules/effect/dist/Predicate.js
function isString(input) {
  return typeof input === "string";
}
function isNumber(input) {
  return typeof input === "number";
}
function isBoolean(input) {
  return typeof input === "boolean";
}
function isBigInt(input) {
  return typeof input === "bigint";
}
function isSymbol(input) {
  return typeof input === "symbol";
}
function isPropertyKey(u) {
  return isString(u) || isNumber(u) || isSymbol(u);
}
function isFunction(input) {
  return typeof input === "function";
}
function isUndefined(input) {
  return input === void 0;
}
function isNotUndefined(input) {
  return input !== void 0;
}
function isNotNullish(input) {
  return input != null;
}
function isNever(_) {
  return false;
}
function isUnknown(_) {
  return true;
}
function isObject(input) {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
var hasProperty = /* @__PURE__ */ dual(2, (self, property) => isObjectKeyword(self) && property in self);
var isTagged = /* @__PURE__ */ dual(2, (self, tag2) => hasProperty(self, "_tag") && self["_tag"] === tag2);
function isError(input) {
  return input instanceof Error;
}
function isIterable(input) {
  return hasProperty(input, Symbol.iterator) || isString(input);
}

// node_modules/effect/dist/Hash.js
var symbol = "~effect/Hash";
var hash = (self) => {
  switch (typeof self) {
    case "number":
      return number(self);
    case "bigint":
      return string(self.toString(10));
    case "string":
      return string(self);
    case "function":
    case "object": {
      if (self === null) {
        break;
      } else if (self instanceof Date) {
        if (Number.isNaN(self.getTime())) {
          return string("Invalid Date");
        }
        return string(self.toISOString());
      } else if (self instanceof RegExp) {
        return string(self.toString());
      } else {
        if (byReferenceInstances.has(self)) {
          return random(self);
        }
        const cached3 = hashCache.get(self);
        if (cached3 !== void 0) {
          return cached3;
        }
        if (visitedObjects.has(self)) {
          addBackEdge();
          return string("[Circular]");
        }
        visitedObjects.add(self);
        const seen = backEdges;
        let h;
        try {
          if (symbol in self) {
            h = self[symbol]();
          } else if (typeof self === "function") {
            h = random(self);
          } else if (self instanceof DataView) {
            h = array(viewBytes(self));
          } else if (Array.isArray(self) || ArrayBuffer.isView(self)) {
            h = array(self);
          } else if (self instanceof Map) {
            h = hashMap(self);
          } else if (self instanceof Set) {
            h = hashSet(self);
          } else {
            h = structure(self);
          }
        } finally {
          visitedObjects.delete(self);
        }
        if (seen === backEdges) {
          hashCache.set(self, h);
        }
        return h;
      }
    }
  }
  return optimize(mix(string(String(self))));
};
var random = (self) => {
  if (!randomHashCache.has(self)) {
    randomHashCache.set(self, optimize(Math.random() * 4294967296 | 0));
  }
  return randomHashCache.get(self);
};
var mix = (h) => {
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  return h ^ h >>> 16;
};
var combine = /* @__PURE__ */ dual(2, (self, b) => mix(Math.imul(self, 2654435761) + Math.imul(b, 2246822507)));
var optimize = (n) => n & 3221225471 | n >>> 1 & 1073741824;
var float64 = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(8));
var number = (n) => {
  const h = n | 0;
  if (h === n) {
    return optimize(h);
  }
  float64.setFloat64(0, n !== n ? NaN : n);
  return optimize(combine(float64.getInt32(0), float64.getInt32(4)));
};
var string = (str) => {
  let h = 5381, i = str.length;
  while (i) {
    h = h * 33 ^ str.charCodeAt(--i);
  }
  return optimize(h);
};
var structureKeys = (o, keys3) => {
  let h = 12289;
  for (const key of keys3) {
    h ^= combine(hash(key), hash(o[key]));
  }
  return optimize(h);
};
var structure = (o) => structureKeys(o, getAllObjectKeys(o));
var unordered = (seed, f) => (iter) => {
  let h = seed;
  for (const element of iter) {
    h ^= f(element);
  }
  return optimize(h);
};
var array = (arr) => {
  let h = 6151;
  for (const element of arr) {
    h = combine(h, hash(element));
  }
  return optimize(h);
};
var hashMap = /* @__PURE__ */ unordered(/* @__PURE__ */ string("Map"), ([k, v]) => combine(hash(k), hash(v)));
var setSeed = /* @__PURE__ */ string("Set");
var hashSet = /* @__PURE__ */ unordered(setSeed, (element) => combine(setSeed, hash(element)));
var randomHashCache = /* @__PURE__ */ new WeakMap();
var hashCache = /* @__PURE__ */ new WeakMap();
var visitedObjects = /* @__PURE__ */ new WeakSet();

// node_modules/effect/dist/Equal.js
var symbol2 = "~effect/Equal";
function equals() {
  if (arguments.length === 1) {
    return (self) => compareBoth(self, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self, that) {
  if (self === that) return true;
  if (self == null || that == null) return false;
  const selfType = typeof self;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self !== self && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self) || byReferenceInstances.has(that)) {
    return false;
  }
  return compareObjects(self, that);
}
function compareObjects(self, that) {
  const depth = pathLeft.length;
  for (let i = depth; i-- > 0; ) {
    if (pathLeft[i] === self && pathRight[i] === that) return true;
  }
  if (depth) return compareOnPath(self, that);
  let known = results.get(self);
  if (!known) results.set(self, known = /* @__PURE__ */ new WeakMap());
  let result3 = known.get(that);
  if (result3 === void 0) known.set(that, result3 = compareOnPath(self, that));
  return result3;
}
function compareOnPath(self, that) {
  pathLeft.push(self);
  pathRight.push(that);
  try {
    return compareStructure(self, that);
  } finally {
    pathLeft.pop();
    pathRight.pop();
  }
}
var pathLeft = [];
var pathRight = [];
var results = /* @__PURE__ */ new WeakMap();
function compareStructure(self, that) {
  if (hash(self) !== hash(that)) {
    return false;
  } else if (self instanceof Date) {
    if (!(that instanceof Date)) return false;
    const selfTime = self.getTime();
    const thatTime = that.getTime();
    return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
  } else if (self instanceof RegExp) {
    return that instanceof RegExp && self.toString() === that.toString();
  }
  const bothEquals = isEqual(self);
  if (bothEquals !== isEqual(that) || typeof self === "function" && !bothEquals) {
    return false;
  } else if (bothEquals) {
    return self[symbol2](that);
  } else if (Array.isArray(self)) {
    if (!Array.isArray(that) || self.length !== that.length) {
      return false;
    }
    return compareArrays(self, that);
  } else if (ArrayBuffer.isView(self)) {
    const selfIsDataView = self instanceof DataView;
    if (!ArrayBuffer.isView(that) || self.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) {
      return false;
    }
    if (selfIsDataView) {
      return compareTypedArrays(viewBytes(self), viewBytes(that));
    }
    return compareTypedArrays(self, that);
  } else if (self instanceof Map) {
    if (!(that instanceof Map) || self.size !== that.size) {
      return false;
    }
    return compareHashed(self, that, entryHash, equalEntries);
  } else if (self instanceof Set) {
    if (!(that instanceof Set) || self.size !== that.size) {
      return false;
    }
    return compareHashed(self, that, hash, compareBoth);
  }
  return compareRecords(self, that);
}
function compareArrays(self, that) {
  for (let i = 0; i < self.length; i++) {
    if (!compareBoth(self[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self, that) {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0; i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self, that) {
  const selfKeys = getAllObjectKeys(self);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self[key], that[key])) {
      return false;
    }
  }
  return true;
}
function compareHashed(self, that, hashOf, equivalent) {
  const groups = /* @__PURE__ */ new Map();
  let remaining = 0;
  for (const item of that) {
    const h = hashOf(item);
    const group = groups.get(h);
    if (group) group.push(item);
    else groups.set(h, [item]);
    remaining++;
  }
  outer: for (const item of self) {
    const group = groups.get(hashOf(item));
    if (group) {
      for (let i = 0; i < group.length; i++) {
        if (equivalent(item, group[i])) {
          group[i] = group[group.length - 1];
          group.pop();
          remaining--;
          continue outer;
        }
      }
    }
    return false;
  }
  return remaining === 0;
}
var entryHash = (entry) => hash(entry[0]);
var equalEntries = (self, that) => compareBoth(self[0], that[0]) && compareBoth(self[1], that[1]);
var sameGroup = () => 0;
function makeCompareMap(keyEquivalence, valueEquivalence) {
  return makeCompareSet((self, that) => keyEquivalence(self[0], that[0]) && valueEquivalence(self[1], that[1]));
}
function makeCompareSet(equivalence) {
  return function compareSets(self, that) {
    return compareHashed(self, that, sameGroup, equivalence);
  };
}
var isEqual = (u) => hasProperty(u, symbol2);
var asEquivalence = () => equals;
var byReferenceUnsafe = (obj) => {
  byReferenceInstances.add(obj);
  return obj;
};

// node_modules/effect/dist/Redactable.js
var symbolRedactable = /* @__PURE__ */ Symbol.for("~effect/Redactable");
var isRedactable = (u) => hasProperty(u, symbolRedactable);
function redact(u) {
  if (isRedactable(u)) return getRedacted(u);
  return u;
}
function getRedacted(redactable) {
  return redactable[symbolRedactable](globalThis[currentFiberTypeId]?.context ?? emptyContext);
}
var currentFiberTypeId = "~effect/Fiber/currentFiber";
var emptyMap = /* @__PURE__ */ new Map();
var emptyContext = {
  "~effect/Context": {},
  base: emptyMap,
  depth: 0,
  mapUnsafe: emptyMap,
  pipe() {
    return pipeArguments(this, arguments);
  }
};

// node_modules/effect/dist/Formatter.js
function format(input, options) {
  const space = options?.space ?? 0;
  const ancestors = /* @__PURE__ */ new WeakSet();
  const gap = !space ? "" : typeof space === "number" ? " ".repeat(space) : space;
  const ind = (d) => gap.repeat(d);
  const wrap = (v, body) => {
    const ctor = v?.constructor;
    return ctor && ctor !== Object.prototype.constructor && ctor.name ? `${ctor.name}(${body})` : body;
  };
  const ownKeys = (o) => {
    try {
      return Reflect.ownKeys(o);
    } catch {
      return ["[ownKeys threw]"];
    }
  };
  function recur2(v, d = 0) {
    try {
      return recurUnsafe(v, d);
    } catch {
      if (typeof v === "object" && v !== null || typeof v === "function") ancestors.delete(v);
      return "[inspection threw]";
    }
  }
  function recurUnsafe(v, d = 0) {
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "number" || v == null || typeof v === "boolean" || typeof v === "symbol") return String(v);
    if (typeof v === "bigint") return String(v) + "n";
    if (typeof v === "object" || typeof v === "function") {
      if (ancestors.has(v)) return CIRCULAR;
      ancestors.add(v);
      let output;
      if (symbolRedactable in v) {
        output = recur2(getRedacted(v), d);
      } else if (Array.isArray(v)) {
        output = !gap || v.length <= 1 ? `[${v.map((x) => recur2(x, d)).join(",")}]` : `[
${ind(d + 1)}${v.map((x) => recur2(x, d + 1)).join(",\n" + ind(d + 1))}
${ind(d)}]`;
      } else if (v instanceof Date) {
        output = formatDate(v);
      } else if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
        const s = safeToString(v);
        output = v instanceof Error && v.cause !== void 0 ? `${s} (cause: ${recur2(v.cause, d)})` : s;
      } else if (Symbol.iterator in v) {
        output = `${v.constructor.name}(${recur2(Array.from(v), d)})`;
      } else {
        const keys3 = ownKeys(v);
        if (!gap || keys3.length <= 1) {
          const body = `{${keys3.map((k) => `${formatPropertyKey(k)}:${recur2(safeGet(v, k), d)}`).join(",")}}`;
          output = wrap(v, body);
        } else {
          const body = `{
${keys3.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur2(safeGet(v, k), d + 1)}`).join(",\n")}
${ind(d)}}`;
          output = wrap(v, body);
        }
      }
      ancestors.delete(v);
      return output;
    }
    return String(v);
  }
  return recur2(input, 0);
}
var CIRCULAR = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
}
function formatPath(path) {
  return path.map((key) => `[${formatPropertyKey(key)}]`).join("");
}
function formatDate(date) {
  try {
    return date.toISOString();
  } catch {
    return "Invalid Date";
  }
}
function safeToString(input) {
  try {
    const s = input.toString();
    return typeof s === "string" ? s : String(s);
  } catch {
    return "[toString threw]";
  }
}
function safeGet(input, key) {
  try {
    return input[key];
  } catch {
    return "[property access threw]";
  }
}
function formatJson(input, options) {
  const ancestors = [];
  return JSON.stringify(input, function(key, value3) {
    const original = Object.getOwnPropertyDescriptor(this, key)?.value;
    const redacted = hasProperty(original, symbolRedactable) ? redact(original) : redact(value3);
    if (typeof redacted === "bigint") {
      return format(redacted);
    }
    if (typeof redacted !== "object" || redacted === null) {
      return redacted;
    }
    const current = redacted instanceof Error && !hasProperty(redacted, "toJSON") ? {
      ...redacted,
      name: redacted.name,
      message: redacted.message
    } : redacted;
    while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(redacted)) {
      return void 0;
    }
    ancestors.push(redacted);
    if (current !== redacted) {
      ancestors.push(current);
    }
    if (!hasGetter(current) || isJsonPrimitiveWrapper(current)) {
      return current;
    }
    const serialized = new Proxy(current, {
      get(target, key2) {
        const value4 = Reflect.get(target, key2, target);
        return Object.getOwnPropertyDescriptor(target, key2)?.get !== void 0 ? redact(value4) : value4;
      }
    });
    ancestors.push(serialized);
    return serialized;
  }, options?.space) ?? "null";
}
function hasGetter(object) {
  for (const key of Object.getOwnPropertyNames(object)) {
    if (Object.getOwnPropertyDescriptor(object, key)?.get !== void 0) {
      return true;
    }
  }
  return false;
}
function isJsonPrimitiveWrapper(object) {
  for (const valueOf of [Number.prototype.valueOf, Boolean.prototype.valueOf, String.prototype.valueOf]) {
    try {
      Reflect.apply(valueOf, object, []);
      return true;
    } catch {
    }
  }
  return false;
}

// node_modules/effect/dist/Inspectable.js
var NodeInspectSymbol = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
var toJson = (input) => {
  try {
    input = redact(input);
    if (hasProperty(input, "toJSON") && isFunction(input["toJSON"]) && input["toJSON"].length === 0) {
      return input.toJSON();
    } else if (Array.isArray(input)) {
      return input.map(toJson);
    }
    return input;
  } catch {
    return "[toJSON threw]";
  }
};
var toStringUnknown = (u, whitespace = 2) => {
  if (typeof u === "string") {
    return u;
  }
  try {
    return typeof u === "object" ? formatJson(u, {
      space: whitespace
    }) : format(u, {
      space: whitespace
    });
  } catch {
    return String(u);
  }
};
var BaseProto = {
  toJSON() {
    return toJson(this);
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  toString() {
    return format(this.toJSON());
  }
};
var Class2 = class {
  /**
   * Node.js custom inspection method.
   *
   * **When to use**
   *
   * Use to expose the class JSON representation to Node.js inspection.
   *
   * @since 2.0.0
   */
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  /**
   * Returns a formatted string representation of this object.
   *
   * **When to use**
   *
   * Use to format the class JSON representation as a string.
   *
   * @since 2.0.0
   */
  toString() {
    return format(this.toJSON());
  }
};

// node_modules/effect/dist/internal/stackTraceLimit.js
var isStackTraceLimitWritable = () => {
  const desc = Object.getOwnPropertyDescriptor(Error, "stackTraceLimit");
  if (desc === void 0) {
    return Object.isExtensible(Error);
  }
  return Object.hasOwn(desc, "writable") ? desc.writable === true : desc.set !== void 0;
};
var canWriteStackTraceLimit = /* @__PURE__ */ isStackTraceLimitWritable();
var getStackTraceLimit = () => Error.stackTraceLimit;
var setStackTraceLimit = (value3) => {
  if (canWriteStackTraceLimit) {
    ;
    Error.stackTraceLimit = value3;
  }
};

// node_modules/effect/dist/Utils.js
var SingleShotGen = class {
  constructor(self) {
    this.value = self;
    this.done = false;
  }
  /**
   * Yields the stored value once, then completes with the value sent back in.
   *
   * **When to use**
   *
   * Use to advance a `SingleShotGen` through its single yield and completion
   * step.
   *
   * @since 2.0.0
   */
  next(a) {
    if (this.done) {
      this.value = a;
      return this;
    }
    this.done = true;
    return {
      value: this.value,
      done: false
    };
  }
};
var pickInternalCall = () => {
  const InternalTypeId = "~effect/Utils/internal";
  const standard = {
    [InternalTypeId]: (body) => {
      return body();
    }
  };
  const forced = {
    [InternalTypeId]: (body) => {
      try {
        return body();
      } finally {
      }
    }
  };
  const limit = getStackTraceLimit();
  if (limit === 0) return forced[InternalTypeId];
  setStackTraceLimit(2);
  const error = standard[InternalTypeId](() => new Error());
  setStackTraceLimit(limit);
  return error.stack?.includes(InternalTypeId) === true ? standard[InternalTypeId] : forced[InternalTypeId];
};
var internalCall = /* @__PURE__ */ pickInternalCall();

// node_modules/effect/dist/internal/record.js
function assignProperty(self, key, value3) {
  if (key === "__proto__") {
    Object.defineProperty(self, key, {
      value: value3,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    ;
    self[key] = value3;
  }
}
function assignProperties(self, source) {
  if (!Object.hasOwn(source, "__proto__")) {
    Object.assign(self, source);
    return;
  }
  for (const key of Reflect.ownKeys(source)) {
    if (Object.prototype.propertyIsEnumerable.call(source, key)) {
      assignProperty(self, key, source[key]);
    }
  }
}

// node_modules/effect/dist/internal/core.js
var EffectTypeId = `~effect/Effect`;
var ExitTypeId = `~effect/Exit`;
var effectVariance = {
  _A: identity,
  _E: identity,
  _R: identity
};
var identifier = `${EffectTypeId}/identifier`;
var args = `${EffectTypeId}/args`;
var evaluate = `${EffectTypeId}/evaluate`;
var contA = `${EffectTypeId}/successCont`;
var contE = `${EffectTypeId}/failureCont`;
var contAll = `${EffectTypeId}/ensureCont`;
var Yield = /* @__PURE__ */ Symbol.for("effect/Effect/Yield");
var PipeInspectableProto = {
  pipe() {
    return pipeArguments(this, arguments);
  },
  toJSON() {
    return {
      ...this
    };
  },
  toString() {
    return format(this.toJSON(), {
      ignoreToString: true,
      space: 2
    });
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
};
var StructuralProto = {
  [symbol]() {
    return structureKeys(this, Object.keys(this));
  },
  [symbol2](that) {
    const selfKeys = Object.keys(this);
    const thatKeys = Object.keys(that);
    if (selfKeys.length !== thatKeys.length) return false;
    for (let i = 0; i < selfKeys.length; i++) {
      if (selfKeys[i] !== thatKeys[i] || !equals(this[selfKeys[i]], that[selfKeys[i]])) {
        return false;
      }
    }
    return true;
  }
};
var EffectProto = {
  [EffectTypeId]: effectVariance,
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  },
  toJSON() {
    return {
      _id: "Effect",
      op: this[identifier],
      ...args in this ? {
        args: this[args]
      } : void 0
    };
  }
};
var isEffect = (u) => hasProperty(u, EffectTypeId);
var isExit = (u) => hasProperty(u, ExitTypeId);
var CauseTypeId = "~effect/Cause";
var CauseReasonTypeId = "~effect/Cause/Reason";
var isCause = (self) => hasProperty(self, CauseTypeId);
var isCauseReason = (self) => hasProperty(self, CauseReasonTypeId);
var CauseImpl = class {
  constructor(failures) {
    this[CauseTypeId] = CauseTypeId;
    this.reasons = failures;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toJSON() {
    return {
      _id: "Cause",
      reasons: this.reasons.map((f) => f.toJSON())
    };
  }
  toString() {
    return `Cause(${format(this.reasons)})`;
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  [symbol2](that) {
    return isCause(that) && this.reasons.length === that.reasons.length && this.reasons.every((e, i) => equals(e, that.reasons[i]));
  }
  [symbol]() {
    return array(this.reasons);
  }
};
var annotationsMap = /* @__PURE__ */ new WeakMap();
var ReasonBase = class {
  [CauseReasonTypeId];
  annotations;
  _tag;
  constructor(_tag, annotations, originalError) {
    this[CauseReasonTypeId] = CauseReasonTypeId;
    this._tag = _tag;
    if (annotations !== constEmptyAnnotations && typeof originalError === "object" && originalError !== null && annotations.size > 0) {
      const prevAnnotations = annotationsMap.get(originalError);
      if (prevAnnotations) {
        annotations = new Map([...prevAnnotations, ...annotations]);
      }
      annotationsMap.set(originalError, annotations);
    }
    this.annotations = annotations;
  }
  annotate(annotations, options) {
    if (annotations.mapUnsafe.size === 0) return this;
    const newAnnotations = new Map(this.annotations);
    annotations.mapUnsafe.forEach((value3, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key)) return;
      newAnnotations.set(key, value3);
    });
    const self = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self.annotations = newAnnotations;
    return self;
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  toString() {
    return format(this);
  }
  [NodeInspectSymbol]() {
    return this.toString();
  }
};
var constEmptyAnnotations = /* @__PURE__ */ new Map();
var Fail = class extends ReasonBase {
  constructor(error, annotations = constEmptyAnnotations) {
    super("Fail", annotations, error);
    this.error = error;
  }
  toString() {
    return `Fail(${format(this.error)})`;
  }
  toJSON() {
    return {
      _tag: "Fail",
      error: this.error
    };
  }
  [symbol2](that) {
    return isFailReason(that) && equals(this.error, that.error) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.error))(hash(this.annotations)));
  }
};
var causeFromReasons = (reasons) => new CauseImpl(reasons);
var dedupeReasons = (self, that) => {
  const buckets = /* @__PURE__ */ new Map();
  const out = [];
  for (const reason of self.concat(that)) {
    const hash2 = hash(reason);
    const bucket = buckets.get(hash2);
    if (bucket === void 0) {
      buckets.set(hash2, [reason]);
    } else if (bucket.some((previous) => equals(previous, reason))) {
      continue;
    } else {
      bucket.push(reason);
    }
    out.push(reason);
  }
  return out;
};
var causeCombine = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self;
  }
  const newCause = new CauseImpl(dedupeReasons(self.reasons, that.reasons));
  return equals(self, newCause) ? self : newCause;
});
var causeAddInterrupts = (self, interrupts) => {
  const reasons = self.reasons.slice();
  for (const reason of interrupts.reasons) {
    if (isInterruptReason(reason) && !reasons.some((r) => isInterruptReason(r) && r.fiberId === reason.fiberId && r.annotations === reason.annotations)) {
      reasons.push(reason);
    }
  }
  return reasons.length === self.reasons.length ? self : new CauseImpl(reasons);
};
var causeEmpty = /* @__PURE__ */ new CauseImpl([]);
var causeFail = (error) => new CauseImpl([new Fail(error)]);
var Die = class extends ReasonBase {
  constructor(defect, annotations = constEmptyAnnotations) {
    super("Die", annotations, defect);
    this.defect = defect;
  }
  toString() {
    return `Die(${format(this.defect)})`;
  }
  toJSON() {
    return {
      _tag: "Die",
      defect: this.defect
    };
  }
  [symbol2](that) {
    return isDieReason(that) && equals(this.defect, that.defect) && equals(this.annotations, that.annotations);
  }
  [symbol]() {
    return combine(string(this._tag))(combine(hash(this.defect))(hash(this.annotations)));
  }
};
var causeDie = (defect) => new CauseImpl([new Die(defect)]);
var causeAnnotate = /* @__PURE__ */ dual((args2) => isCause(args2[0]), (self, annotations, options) => {
  if (annotations.mapUnsafe.size === 0) return self;
  return new CauseImpl(self.reasons.map((f) => f.annotate(annotations, options)));
});
var isFailReason = (self) => self._tag === "Fail";
var isDieReason = (self) => self._tag === "Die";
var isInterruptReason = (self) => self._tag === "Interrupt";
function defaultEvaluate(_fiber) {
  return exitDie(`Effect.evaluate: Not implemented`);
}
var makePrimitiveProto = (options) => ({
  ...EffectProto,
  [identifier]: options.op,
  [evaluate]: options[evaluate] ?? defaultEvaluate,
  [contA]: options[contA],
  [contE]: options[contE],
  [contAll]: options[contAll]
});
var makePrimitive = (options) => {
  const Proto8 = makePrimitiveProto(options);
  const PrimitiveImpl = function(value3) {
    this[args] = value3;
  };
  PrimitiveImpl.prototype = Proto8;
  return function(value3) {
    return new PrimitiveImpl(value3);
  };
};
var makeExit = (options) => {
  const Proto8 = {
    [ExitTypeId]: ExitTypeId,
    _tag: options.op,
    get [options.prop]() {
      return this[args];
    },
    ...makePrimitiveProto(options),
    toString() {
      return `${options.op}(${format(this[args])})`;
    },
    toJSON() {
      return {
        _id: "Exit",
        _tag: options.op,
        [options.prop]: this[args]
      };
    },
    [symbol2](that) {
      return isExit(that) && that._tag === this._tag && equals(this[args], that[args]);
    },
    [symbol]() {
      return combine(string(options.op), hash(this[args]));
    }
  };
  const ExitPrimitive = function(value3) {
    this[args] = value3;
  };
  ExitPrimitive.prototype = Proto8;
  return function(value3) {
    return new ExitPrimitive(value3);
  };
};
var exitSucceed = /* @__PURE__ */ makeExit({
  op: "Success",
  prop: "value",
  [evaluate](fiber3) {
    const cont = fiber3.getCont(contA);
    return cont ? cont[contA](this[args], fiber3, this) : fiber3.yieldWith(this);
  }
});
var StackTraceKey = {
  key: "effect/Cause/StackTrace"
};
var InterruptorStackTrace = {
  key: "effect/Cause/InterruptorStackTrace"
};
var exitFailCause = /* @__PURE__ */ makeExit({
  op: "Failure",
  prop: "cause",
  [evaluate](fiber3) {
    let cause = this[args];
    let annotated = false;
    if (fiber3.cache.stackFrame) {
      cause = causeAnnotate(cause, {
        mapUnsafe: /* @__PURE__ */ new Map([[StackTraceKey.key, fiber3.cache.stackFrame]])
      });
      annotated = true;
    }
    let cont = fiber3.getCont(contE);
    const interruptedCause = fiber3._interruptedCause;
    if (interruptedCause && fiber3.interruptible) {
      let skippedHandler = false;
      while (cont && fiber3.interruptible) {
        skippedHandler ||= identifier in cont;
        cont = fiber3.getCont(contE);
      }
      if (skippedHandler) {
        cause = causeFromReasons(cause.reasons.filter((reason) => reason._tag !== "Fail"));
      }
      cause = causeAddInterrupts(cause, interruptedCause);
      annotated = true;
    }
    return cont ? cont[contE](cause, fiber3, annotated ? void 0 : this) : fiber3.yieldWith(annotated ? exitFailCause(cause) : this);
  }
});
var exitFail = (e) => exitFailCause(causeFail(e));
var exitDie = (defect) => exitFailCause(causeDie(defect));
var withFiber = /* @__PURE__ */ makePrimitive({
  op: "WithFiber",
  [evaluate](fiber3) {
    return this[args](fiber3);
  }
});
var withFiberSucceed = /* @__PURE__ */ makePrimitive({
  op: "WithFiberSucceed",
  [evaluate](fiber3) {
    const value3 = this[args](fiber3);
    const cont = fiber3.getCont(contA);
    return cont ? cont[contA](value3, fiber3) : fiber3.yieldWith(exitSucceed(value3));
  }
});
var YieldableError = /* @__PURE__ */ (function() {
  class YieldableError2 extends globalThis.Error {
  }
  const proto = /* @__PURE__ */ makePrimitiveProto({
    op: "YieldableError",
    [evaluate]() {
      return exitFail(this);
    }
  });
  delete proto.toString;
  Object.assign(YieldableError2.prototype, proto);
  return YieldableError2;
})();
var Error2 = /* @__PURE__ */ (function() {
  const plainArgsSymbol = /* @__PURE__ */ Symbol.for("effect/Data/Error/plainArgs");
  return class Base extends YieldableError {
    constructor(args2) {
      super(args2?.message, args2?.cause ? {
        cause: args2.cause
      } : void 0);
      if (args2) {
        assignProperties(this, args2);
        Object.defineProperty(this, plainArgsSymbol, {
          value: args2,
          enumerable: false
        });
      }
    }
    toJSON() {
      return {
        ...this[plainArgsSymbol],
        ...this
      };
    }
  };
})();
var TaggedError = (tag2) => {
  class Base extends Error2 {
    _tag = tag2;
  }
  ;
  Base.prototype.name = tag2;
  return Base;
};
var NoSuchElementErrorTypeId = "~effect/Cause/NoSuchElementError";
var isNoSuchElementError = (u) => hasProperty(u, NoSuchElementErrorTypeId);
var NoSuchElementError = class extends (/* @__PURE__ */ TaggedError("NoSuchElementError")) {
  [NoSuchElementErrorTypeId] = NoSuchElementErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
};
var DoneTypeId = "~effect/Cause/Done";
var isDone = (u) => hasProperty(u, DoneTypeId);
var DoneVoid = {
  [DoneTypeId]: DoneTypeId,
  _tag: "Done",
  value: void 0
};
var Done = (value3) => {
  if (value3 === void 0) return DoneVoid;
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value: value3
  };
};
var doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
var done = (value3) => {
  if (value3 === void 0) return doneVoid;
  return exitFail(Done(value3));
};

// node_modules/effect/dist/Effectable.js
var Prototype2 = (options) => makePrimitiveProto({
  op: options.label,
  [evaluate]: options.evaluate
});

// node_modules/effect/dist/Equivalence.js
var make = (isEquivalent) => (self, that) => self === that || isEquivalent(self, that);
var isStrictEquivalent = (x, y) => x === y;
var strictEqual = () => isStrictEquivalent;
function Tuple(elements) {
  return make((self, that) => {
    if (self.length !== that.length) {
      return false;
    }
    for (let i = 0; i < self.length; i++) {
      if (!elements[i](self[i], that[i])) {
        return false;
      }
    }
    return true;
  });
}
function Array_(item) {
  return make((self, that) => {
    if (self.length !== that.length) return false;
    for (let i = 0; i < self.length; i++) {
      if (!item(self[i], that[i])) return false;
    }
    return true;
  });
}

// node_modules/effect/dist/internal/doNotation.js
var let_ = (map10) => dual(3, (self, name, f) => map10(self, (a) => ({
  ...a,
  [name]: f(a)
})));
var bindTo = (map10) => dual(2, (self, name) => map10(self, (a) => ({
  [name]: a
})));
var bind = (map10, flatMap6) => dual(3, (self, name, f) => flatMap6(self, (a) => map10(f(a), (b) => ({
  ...a,
  [name]: b
}))));

// node_modules/effect/dist/internal/option.js
var TypeId = "~effect/Option";
var CommonProto = {
  [TypeId]: {
    _A: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SomeProto = /* @__PURE__ */ Object.defineProperty(/* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "Some",
  _op: "Some",
  [symbol2](that) {
    return isOption(that) && isSome(that) && equals(this.value, that.value);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.value));
  },
  toString() {
    return `some(${format(this.value)})`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag,
      value: toJson(this.value)
    };
  }
}), "valueOrUndefined", {
  get() {
    return this.value;
  }
});
var NoneHash = /* @__PURE__ */ hash("None");
var NoneProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto), {
  _tag: "None",
  _op: "None",
  valueOrUndefined: void 0,
  [symbol2](that) {
    return isOption(that) && isNone(that);
  },
  [symbol]() {
    return NoneHash;
  },
  toString() {
    return `none()`;
  },
  toJSON() {
    return {
      _id: "Option",
      _tag: this._tag
    };
  }
});
var isOption = (input) => hasProperty(input, TypeId);
var isNone = (fa) => fa._tag === "None";
var isSome = (fa) => fa._tag === "Some";
var none = /* @__PURE__ */ Object.create(NoneProto);
var SomeImpl = function(value3) {
  this.value = value3;
};
SomeImpl.prototype = SomeProto;
var some = (value3) => new SomeImpl(value3);

// node_modules/effect/dist/internal/result.js
var TypeId2 = "~effect/Result";
var CommonProto2 = {
  [TypeId2]: {
    /* v8 ignore next 2 */
    _A: (_) => _,
    _E: (_) => _
  },
  ...PipeInspectableProto,
  [Symbol.iterator]() {
    return new SingleShotGen(this);
  }
};
var SuccessProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Success",
  _op: "Success",
  [symbol2](that) {
    return isResult(that) && isSuccess(that) && equals(this.success, that.success);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.success));
  },
  toString() {
    return `success(${format(this.success)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      value: toJson(this.success)
    };
  }
});
var FailureProto = /* @__PURE__ */ Object.assign(/* @__PURE__ */ Object.create(CommonProto2), {
  _tag: "Failure",
  _op: "Failure",
  [symbol2](that) {
    return isResult(that) && isFailure(that) && equals(this.failure, that.failure);
  },
  [symbol]() {
    return combine(hash(this._tag))(hash(this.failure));
  },
  toString() {
    return `failure(${format(this.failure)})`;
  },
  toJSON() {
    return {
      _id: "Result",
      _tag: this._tag,
      failure: toJson(this.failure)
    };
  }
});
var isResult = (input) => hasProperty(input, TypeId2);
var isFailure = (result3) => result3._tag === "Failure";
var isSuccess = (result3) => result3._tag === "Success";
var FailureImpl = function(failure) {
  this.failure = failure;
};
FailureImpl.prototype = FailureProto;
var fail = (failure) => new FailureImpl(failure);
var SuccessImpl = function(success) {
  this.success = success;
};
SuccessImpl.prototype = SuccessProto;
var succeed = (success) => new SuccessImpl(success);
var getFailure = (self) => isSuccess(self) ? none : some(self.failure);
var getSuccess = (self) => isFailure(self) ? none : some(self.success);
var fromOption = /* @__PURE__ */ dual(2, (self, onNone) => isNone(self) ? fail(onNone()) : succeed(self.value));

// node_modules/effect/dist/Order.js
function make2(compare2) {
  return (self, that) => self === that ? 0 : compare2(self, that);
}
var String2 = /* @__PURE__ */ make2((self, that) => self < that ? -1 : 1);
var Number2 = /* @__PURE__ */ make2((self, that) => {
  if (globalThis.Number.isNaN(self) && globalThis.Number.isNaN(that)) return 0;
  if (globalThis.Number.isNaN(self)) return -1;
  if (globalThis.Number.isNaN(that)) return 1;
  return self < that ? -1 : 1;
});
var BigInt2 = /* @__PURE__ */ make2((self, that) => self < that ? -1 : 1);
var mapInput = /* @__PURE__ */ dual(2, (self, f) => make2((b1, b2) => self(f(b1), f(b2))));
var Date2 = /* @__PURE__ */ mapInput(Number2, (date) => date.getTime());
var isLessThan = (O) => dual(2, (self, that) => O(self, that) === -1);
var isGreaterThan = (O) => dual(2, (self, that) => O(self, that) === 1);
var isLessThanOrEqualTo = (O) => dual(2, (self, that) => O(self, that) !== 1);
var isGreaterThanOrEqualTo = (O) => dual(2, (self, that) => O(self, that) !== -1);

// node_modules/effect/dist/Option.js
var none2 = () => none;
var some2 = some;
var isOption2 = isOption;
var isNone2 = isNone;
var isSome2 = isSome;
var match = /* @__PURE__ */ dual(2, (self, {
  onNone,
  onSome
}) => isNone2(self) ? onNone() : onSome(self.value));
var getOrElse = /* @__PURE__ */ dual(2, (self, onNone) => isNone2(self) ? onNone() : self.value);
var fromNullishOr = (a) => a == null ? none2() : some2(a);
var fromUndefinedOr = (a) => a === void 0 ? none2() : some2(a);
var fromNullOr = (a) => a === null ? none2() : some2(a);
var getOrNull = /* @__PURE__ */ getOrElse(constNull);
var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);
var liftThrowable = (f) => (...a) => {
  try {
    return some2(f(...a));
  } catch {
    return none2();
  }
};
var map = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : some2(f(self.value)));
var flatMap = /* @__PURE__ */ dual(2, (self, f) => isNone2(self) ? none2() : f(self.value));
var flatten = /* @__PURE__ */ flatMap(identity);
var filter = /* @__PURE__ */ dual(2, (self, predicate) => isNone2(self) ? none2() : predicate(self.value) ? some2(self.value) : none2());

// node_modules/effect/dist/Context.js
var ServiceTypeId = "~effect/Context/Service";
var Service = function() {
  function KeyClass() {
  }
  const self = KeyClass;
  Object.setPrototypeOf(self, ServiceProto);
  const init = (key, options) => {
    self.key = key;
    if (options?.defaultValue) {
      self[ReferenceTypeId] = ReferenceTypeId;
      self.defaultValue = options.defaultValue;
    }
    if (options?.make) {
      ;
      self.make = options.make;
    }
    if (options?.fiberCached) {
      cacheKeys.add(key);
    }
    return self;
  };
  return arguments.length > 0 ? init(arguments[0], arguments[1]) : init;
};
var ServiceProto = {
  [ServiceTypeId]: ServiceTypeId,
  .../* @__PURE__ */ Prototype2({
    label: "Service",
    evaluate(fiber3) {
      return exitSucceed(get(fiber3.context, this));
    }
  }),
  toJSON() {
    return {
      _id: "Service",
      key: this.key
    };
  },
  of(self) {
    return self;
  },
  context(self) {
    return make3(this, self);
  },
  use(f) {
    return withFiber((fiber3) => f(get(fiber3.context, this)));
  },
  useSync(f) {
    return withFiber((fiber3) => exitSucceed(f(get(fiber3.context, this))));
  }
};
var cacheKeys = /* @__PURE__ */ new Set();
var ReferenceTypeId = "~effect/Context/Reference";
var TypeId3 = "~effect/Context";
var MaxDepth = 8;
var FlattenAfterBaseHits = 8;
var makeImpl = (cacheRoot, base, overlay, depth) => {
  const self = Object.create(Proto);
  self.cacheRoot = cacheRoot ?? self;
  self.base = base;
  self.overlay = overlay;
  self.depth = depth;
  self._flat = void 0;
  self.baseHits = 0;
  return self;
};
var applyOverlays = (map10, overlay) => {
  if (!overlay) return;
  applyOverlays(map10, overlay.parent);
  map10.set(overlay.key, overlay.value);
};
var flatten2 = (self) => {
  if (self._flat) return self._flat;
  if (!self.overlay) return self._flat = self.base;
  const map10 = new Map(self.base);
  applyOverlays(map10, self.overlay);
  return self._flat = map10;
};
var withFlat = (self, f) => {
  const map10 = new Map(self.mapUnsafe);
  f(map10);
  return makeUnsafe(map10);
};
var notFound = /* @__PURE__ */ Symbol();
var lookup = (self, key) => {
  const impl = self;
  for (let overlay = impl.overlay; overlay; overlay = overlay.parent) {
    if (overlay.key === key) return overlay.value;
  }
  const value3 = impl.base.get(key);
  if (value3 === void 0 && !impl.base.has(key)) return notFound;
  if (impl.overlay && ++impl.baseHits >= impl.base.size && impl.baseHits >= FlattenAfterBaseHits) {
    impl.base = flatten2(impl);
    impl.overlay = void 0;
    impl.depth = 0;
  }
  return value3;
};
var makeUnsafe = (mapUnsafe) => makeImpl(void 0, mapUnsafe, void 0, 0);
var Proto = {
  get mapUnsafe() {
    return flatten2(this);
  },
  ...PipeInspectableProto,
  [TypeId3]: {
    _Services: (_) => _
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.mapUnsafe).map(([key, value3]) => ({
        key,
        value: value3
      }))
    };
  },
  [symbol2](that) {
    if (!isContext(that)) return false;
    const self = this.mapUnsafe;
    const other = that.mapUnsafe;
    if (self.size !== other.size) return false;
    for (const [key, value3] of self) {
      if (!other.has(key) || !equals(value3, other.get(key))) return false;
    }
    return true;
  },
  [symbol]() {
    return number(this.mapUnsafe.size);
  }
};
var hasSameCache = (self, that) => self.cacheRoot === that.cacheRoot;
var isContext = (u) => hasProperty(u, TypeId3);
var isReference = (u) => !!u[ReferenceTypeId];
var empty = () => emptyContext2;
var emptyContext2 = /* @__PURE__ */ makeUnsafe(/* @__PURE__ */ new Map());
var make3 = (key, service3) => makeUnsafe(/* @__PURE__ */ new Map([[key.key, service3]]));
var add = /* @__PURE__ */ dual(3, (self, key, service3) => addUnsafe(self, key.key, service3));
var addUnsafe = (self, key, service3) => {
  const impl = self;
  const cacheRoot = cacheKeys.has(key) ? void 0 : impl.cacheRoot;
  if (impl.depth >= MaxDepth) {
    const map10 = new Map(impl._flat ?? impl.base);
    if (!impl._flat) applyOverlays(map10, impl.overlay);
    map10.set(key, service3);
    return makeImpl(cacheRoot, map10, void 0, 0);
  }
  return makeImpl(cacheRoot, impl.base, {
    key,
    value: service3,
    parent: impl.overlay
  }, impl.depth + 1);
};
var getOrUndefined2 = /* @__PURE__ */ dual(2, (self, key) => getOrUndefinedUnsafe(self, key.key));
var getOrUndefinedUnsafe = (self, key) => {
  const value3 = lookup(self, key);
  return value3 === notFound ? void 0 : value3;
};
var getUnsafe = /* @__PURE__ */ dual(2, (self, service3) => {
  const value3 = lookup(self, service3.key);
  if (value3 === notFound) {
    if (isReference(service3)) return getDefaultValue(service3);
    throw serviceNotFoundError(service3);
  }
  return value3;
});
var get = getUnsafe;
var defaultValueCacheKey = "~effect/Context/defaultValue";
var getDefaultValue = (ref) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey];
  }
  return ref[defaultValueCacheKey] = ref.defaultValue();
};
var serviceNotFoundError = (service3) => {
  const error = new Error(`Service not found${service3.key ? `: ${String(service3.key)}` : ""}`);
  if (error.stack) {
    const lines = error.stack.split("\n");
    lines.splice(1, 3);
    error.stack = lines.join("\n");
  }
  return error;
};
var getOption = /* @__PURE__ */ dual(2, (self, service3) => {
  const value3 = lookup(self, service3.key);
  if (value3 !== notFound) return some2(value3);
  return isReference(service3) ? some2(getDefaultValue(service3)) : none2();
});
var merge = /* @__PURE__ */ dual(2, (self, that) => {
  if (self.mapUnsafe.size === 0) return that;
  if (that.mapUnsafe.size === 0) return self;
  return withFlat(self, (map10) => that.mapUnsafe.forEach((value3, key) => map10.set(key, value3)));
});
var mergeAll = (...ctxs) => {
  const map10 = /* @__PURE__ */ new Map();
  for (let i = 0; i < ctxs.length; i++) {
    ctxs[i].mapUnsafe.forEach((value3, key) => {
      map10.set(key, value3);
    });
  }
  return makeUnsafe(map10);
};
var Reference = Service;

// node_modules/effect/dist/internal/array.js
var isArrayNonEmpty = (self) => self.length > 0;

// node_modules/effect/dist/Result.js
var Result_exports = {};
__export(Result_exports, {
  Do: () => Do,
  all: () => all,
  andThen: () => andThen,
  bind: () => bind2,
  bindTo: () => bindTo2,
  fail: () => fail2,
  failVoid: () => failVoid,
  filterOrFail: () => filterOrFail,
  flatMap: () => flatMap2,
  flip: () => flip,
  fromNullishOr: () => fromNullishOr2,
  fromOption: () => fromOption2,
  gen: () => gen,
  getFailure: () => getFailure2,
  getOrElse: () => getOrElse2,
  getOrNull: () => getOrNull2,
  getOrThrow: () => getOrThrow,
  getOrThrowWith: () => getOrThrowWith,
  getOrUndefined: () => getOrUndefined3,
  getSuccess: () => getSuccess2,
  isFailure: () => isFailure2,
  isResult: () => isResult2,
  isSuccess: () => isSuccess2,
  let: () => let_2,
  liftPredicate: () => liftPredicate,
  makeEquivalence: () => makeEquivalence,
  map: () => map2,
  mapBoth: () => mapBoth,
  mapError: () => mapError,
  match: () => match2,
  merge: () => merge2,
  orElse: () => orElse,
  succeed: () => succeed2,
  succeedNone: () => succeedNone,
  succeedSome: () => succeedSome,
  tap: () => tap,
  transposeMapOption: () => transposeMapOption,
  transposeOption: () => transposeOption,
  try: () => try_,
  void: () => void_
});
var succeed2 = succeed;
var fail2 = fail;
var void_ = /* @__PURE__ */ succeed2(void 0);
var failVoid = /* @__PURE__ */ fail2(void 0);
var fromNullishOr2 = /* @__PURE__ */ dual(2, (self, onNullish) => self == null ? fail2(onNullish(self)) : succeed2(self));
var fromOption2 = fromOption;
var try_ = (evaluate2) => {
  if (isFunction(evaluate2)) {
    try {
      return succeed2(evaluate2());
    } catch (e) {
      return fail2(e);
    }
  } else {
    try {
      return succeed2(evaluate2.try());
    } catch (e) {
      return fail2(evaluate2.catch(e));
    }
  }
};
var isResult2 = isResult;
var isFailure2 = isFailure;
var isSuccess2 = isSuccess;
var getSuccess2 = getSuccess;
var getFailure2 = getFailure;
var makeEquivalence = (success, failure) => make((x, y) => isFailure2(x) ? isFailure2(y) && failure(x.failure, y.failure) : isSuccess2(y) && success(x.success, y.success));
var mapBoth = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => isFailure2(self) ? fail2(onFailure(self.failure)) : succeed2(onSuccess(self.success)));
var mapError = /* @__PURE__ */ dual(2, (self, f) => isFailure2(self) ? fail2(f(self.failure)) : self);
var map2 = /* @__PURE__ */ dual(2, (self, f) => isSuccess2(self) ? succeed2(f(self.success)) : self);
var match2 = /* @__PURE__ */ dual(2, (self, {
  onFailure,
  onSuccess
}) => isFailure2(self) ? onFailure(self.failure) : onSuccess(self.success));
var liftPredicate = /* @__PURE__ */ dual(3, (a, predicate, orFailWith) => predicate(a) ? succeed2(a) : fail2(orFailWith(a)));
var filterOrFail = /* @__PURE__ */ dual(3, (self, predicate, orFailWith) => flatMap2(self, (a) => predicate(a) ? succeed2(a) : fail2(orFailWith(a))));
var merge2 = /* @__PURE__ */ match2({
  onFailure: identity,
  onSuccess: identity
});
var getOrElse2 = /* @__PURE__ */ dual(2, (self, onFailure) => isFailure2(self) ? onFailure(self.failure) : self.success);
var getOrNull2 = /* @__PURE__ */ getOrElse2(constNull);
var getOrUndefined3 = /* @__PURE__ */ getOrElse2(constUndefined);
var getOrThrowWith = /* @__PURE__ */ dual(2, (self, onFailure) => {
  if (isSuccess2(self)) {
    return self.success;
  }
  throw onFailure(self.failure);
});
var getOrThrow = /* @__PURE__ */ getOrThrowWith(identity);
var orElse = /* @__PURE__ */ dual(2, (self, that) => isFailure2(self) ? that(self.failure) : succeed2(self.success));
var flatMap2 = /* @__PURE__ */ dual(2, (self, f) => isFailure2(self) ? fail2(self.failure) : f(self.success));
var andThen = /* @__PURE__ */ dual(2, (self, f) => flatMap2(self, (a) => {
  const out = isFunction(f) ? f(a) : f;
  return isResult2(out) ? out : succeed2(out);
}));
var all = (input) => {
  if (Symbol.iterator in input) {
    const out2 = [];
    for (const e of input) {
      if (isFailure2(e)) {
        return e;
      }
      out2.push(e.success);
    }
    return succeed2(out2);
  }
  const out = {};
  for (const key of Object.keys(input)) {
    const e = input[key];
    if (isFailure2(e)) {
      return e;
    }
    assignProperty(out, key, e.success);
  }
  return succeed2(out);
};
var flip = (self) => isFailure2(self) ? succeed2(self.failure) : fail2(self.success);
var gen = (...args2) => {
  const f = args2.length === 1 ? args2[0] : args2[1].bind(args2[0]);
  const iterator = f();
  let state = iterator.next();
  while (!state.done) {
    const current = state.value;
    if (isFailure2(current)) {
      return current;
    }
    state = iterator.next(current.success);
  }
  return succeed2(state.value);
};
var Do = /* @__PURE__ */ succeed2({});
var bind2 = /* @__PURE__ */ bind(map2, flatMap2);
var bindTo2 = /* @__PURE__ */ bindTo(map2);
var let_2 = /* @__PURE__ */ let_(map2);
var transposeOption = (self) => {
  return isNone(self) ? succeedNone : map2(self.value, some);
};
var transposeMapOption = /* @__PURE__ */ dual(2, (self, f) => isNone(self) ? succeedNone : map2(f(self.value), some));
var succeedNone = /* @__PURE__ */ succeed2(none);
var succeedSome = (a) => succeed2(some(a));
var tap = /* @__PURE__ */ dual(2, (self, f) => {
  if (isSuccess2(self)) {
    f(self.success);
  }
  return self;
});

// node_modules/effect/dist/Tuple.js
var makeEquivalence2 = Tuple;

// node_modules/effect/dist/Iterable.js
var findFirst = /* @__PURE__ */ dual(2, (self, f) => {
  let i = 0;
  for (const a of self) {
    const o = f(a, i);
    if (isBoolean(o)) {
      if (o) {
        return some2(a);
      }
    } else {
      if (isSome2(o)) {
        return o;
      }
    }
    i++;
  }
  return none2();
});
var filter2 = /* @__PURE__ */ dual(2, (self, predicate) => ({
  [Symbol.iterator]() {
    const iterator = self[Symbol.iterator]();
    let i = 0;
    return {
      next() {
        let result3 = iterator.next();
        while (!result3.done) {
          if (predicate(result3.value, i++)) {
            return {
              done: false,
              value: result3.value
            };
          }
          result3 = iterator.next();
        }
        return {
          done: true,
          value: void 0
        };
      }
    };
  }
}));

// node_modules/effect/dist/Record.js
var has = /* @__PURE__ */ dual(2, (self, key) => Object.hasOwn(self, key));
var map3 = /* @__PURE__ */ dual(2, (self, f) => {
  const out = {
    ...self
  };
  for (const key of keys(self)) {
    assignProperty(out, key, f(self[key], key));
  }
  return out;
});
var keys = (self) => Object.keys(self);
var isSubrecordBy = (equivalence) => dual(2, (self, that) => {
  for (const key of keys(self)) {
    if (!has(that, key) || !equivalence(self[key], that[key])) {
      return false;
    }
  }
  return true;
});
var makeEquivalence3 = (equivalence) => {
  const is3 = isSubrecordBy(equivalence);
  return (self, that) => is3(self, that) && is3(that, self);
};

// node_modules/effect/dist/Array.js
var Array2 = globalThis.Array;
var fromIterable = (collection) => Array2.isArray(collection) ? collection : Array2.from(collection);
var append = /* @__PURE__ */ dual(2, (self, last) => [...self, last]);
var isArray = Array2.isArray;
var isArrayNonEmpty2 = isArrayNonEmpty;
var isReadonlyArrayNonEmpty = isArrayNonEmpty;
function isCanonicalArrayIndex(key) {
  const index2 = Number(key);
  return String(index2) === key && Number.isInteger(index2) && index2 >= 0 && index2 < 2 ** 32 - 1;
}
var findFirst2 = findFirst;
var hashBucketsAdd = (buckets, value3) => {
  const hash2 = hash(value3);
  const bucket = buckets.get(hash2);
  if (bucket === void 0) {
    buckets.set(hash2, [value3]);
    return true;
  }
  for (const previous of bucket) {
    if (equals(previous, value3)) {
      return false;
    }
  }
  bucket.push(value3);
  return true;
};
var empty2 = () => [];
var map4 = /* @__PURE__ */ dual(2, (self, f) => self.map(f));
var getSomes = (self) => {
  const out = [];
  for (const a of self) {
    if (isSome2(a)) {
      out.push(a.value);
    }
  }
  return out;
};
var partition = /* @__PURE__ */ dual(2, (self, f) => {
  const passes = [];
  const fails = [];
  let i = 0;
  for (const a of self) {
    const result3 = f(a, i++);
    if (isSuccess2(result3)) {
      passes.push(result3.success);
    } else {
      fails.push(result3.failure);
    }
  }
  return [passes, fails];
});
var makeEquivalence4 = Array_;
var dedupe = (self) => {
  const input = fromIterable(self);
  if (input.length < 2) {
    return [...input];
  }
  const buckets = /* @__PURE__ */ new Map();
  const out = [];
  for (const value3 of input) {
    if (hashBucketsAdd(buckets, value3)) {
      out.push(value3);
    }
  }
  return out;
};

// node_modules/effect/dist/Duration.js
var TypeId4 = "~effect/Duration";
var bigint0 = /* @__PURE__ */ BigInt(0);
var bigint1 = /* @__PURE__ */ BigInt(1);
var bigint2 = /* @__PURE__ */ BigInt(2);
var bigint10 = /* @__PURE__ */ BigInt(10);
var bigint24 = /* @__PURE__ */ BigInt(24);
var bigint60 = /* @__PURE__ */ BigInt(60);
var bigint1e3 = /* @__PURE__ */ BigInt(1e3);
var bigint1e6 = /* @__PURE__ */ BigInt(1e6);
var bigint1e9 = /* @__PURE__ */ BigInt(1e9);
var bigintNanosPerMinute = /* @__PURE__ */ BigInt(6e10);
var bigintNanosPerHour = /* @__PURE__ */ BigInt(36e11);
var bigintNanosPerDay = /* @__PURE__ */ BigInt(864e11);
var bigintNanosPerWeek = /* @__PURE__ */ BigInt(6048e11);
var roundTiesAwayFromZero = (input) => BigInt(Math.sign(input) * Math.round(Math.abs(input)));
var roundMillisToNanos = (millis2) => Number.isInteger(millis2) ? BigInt(millis2) * bigint1e6 : roundTiesAwayFromZero(millis2 * 1e6);
var fromNanosNumber = (nanos2) => make4(Number.isFinite(nanos2) ? roundTiesAwayFromZero(nanos2) : nanos2);
var nanosToUnit = (nanos2, divisor) => {
  const value3 = Number(nanos2);
  if (Number.isFinite(value3)) return value3 / divisor;
  const scale = BigInt(divisor);
  return Number(nanos2 / scale) + Number(nanos2 % scale) / divisor;
};
var parseNanos = (input, scale) => {
  const decimalIndex = input.indexOf(".");
  if (decimalIndex === -1) return BigInt(input) * scale;
  const isNegative2 = input[0] === "-";
  const fractional = input.slice(decimalIndex + 1);
  const fractionalScale = bigint10 ** BigInt(fractional.length);
  const scaled = (BigInt(input.slice(isNegative2 ? 1 : 0, decimalIndex)) * fractionalScale + BigInt(fractional)) * scale;
  return divideTiesAwayFromZero(isNegative2 ? -scaled : scaled, fractionalScale);
};
var divideTiesAwayFromZero = (numerator, denominator) => {
  const absolute = numerator < bigint0 ? -numerator : numerator;
  const rounded = absolute / denominator + (absolute % denominator * bigint2 >= denominator ? bigint1 : bigint0);
  return numerator < bigint0 ? -rounded : rounded;
};
var fromMillisString = (input, scale) => {
  const millis2 = Number(input) * scale;
  if (!Number.isFinite(millis2)) return make4(millis2);
  const nanos2 = parseNanos(input, BigInt(scale) * bigint1e6);
  return make4(Number.isInteger(millis2) && BigInt(millis2) * bigint1e6 === nanos2 ? millis2 : nanos2);
};
var DURATION_REGEXP = /^(-?\d+(?:\.\d+)?)\s+(nanos?|micros?|millis?|seconds?|minutes?|hours?|days?|weeks?)$/;
var fromInputUnsafe = (input) => {
  switch (typeof input) {
    case "number":
      return millis(input);
    case "bigint":
      return nanos(input);
    case "string": {
      if (input === "Infinity") {
        return infinity;
      }
      if (input === "-Infinity") {
        return negativeInfinity;
      }
      const match7 = DURATION_REGEXP.exec(input);
      if (!match7) break;
      const [_, valueStr, unit] = match7;
      if (unit === "nano" || unit === "nanos") {
        return nanos(parseNanos(valueStr, bigint1));
      }
      if (unit === "micro" || unit === "micros") {
        return nanos(parseNanos(valueStr, bigint1e3));
      }
      switch (unit) {
        case "milli":
        case "millis":
          return fromMillisString(valueStr, 1);
        case "second":
        case "seconds":
          return fromMillisString(valueStr, 1e3);
        case "minute":
        case "minutes":
          return fromMillisString(valueStr, 6e4);
        case "hour":
        case "hours":
          return fromMillisString(valueStr, 36e5);
        case "day":
        case "days":
          return fromMillisString(valueStr, 864e5);
        case "week":
        case "weeks":
          return fromMillisString(valueStr, 6048e5);
      }
      break;
    }
    case "object": {
      if (input === null) break;
      if (TypeId4 in input) return input;
      if (Array.isArray(input)) {
        if (input.length !== 2 || !input.every(isNumber)) {
          return invalid(input);
        }
        if (Number.isNaN(input[0]) || Number.isNaN(input[1])) {
          return zero;
        }
        if (input[0] === -Infinity || input[1] === -Infinity) {
          return negativeInfinity;
        }
        if (input[0] === Infinity || input[1] === Infinity) {
          return infinity;
        }
        const nanos3 = input[0] * 1e9 + input[1];
        return Number.isFinite(nanos3) && Number.isInteger(input[0]) && Number.isInteger(input[1]) ? make4(BigInt(input[0]) * bigint1e9 + BigInt(input[1])) : fromNanosNumber(nanos3);
      }
      const obj = input;
      let millis2 = 0;
      if (obj.weeks) millis2 += obj.weeks * 6048e5;
      if (obj.days) millis2 += obj.days * 864e5;
      if (obj.hours) millis2 += obj.hours * 36e5;
      if (obj.minutes) millis2 += obj.minutes * 6e4;
      if (obj.seconds) millis2 += obj.seconds * 1e3;
      if (obj.milliseconds) millis2 += obj.milliseconds;
      if (!obj.microseconds && !obj.nanoseconds) {
        if (!Number.isFinite(millis2)) return make4(millis2);
        const exact2 = sumObjectNanos(obj);
        return exact2 === void 0 || BigInt(millis2) * bigint1e6 === exact2 ? make4(millis2) : make4(exact2);
      }
      const nanos2 = millis2 * 1e6 + (obj.microseconds ?? 0) * 1e3 + (obj.nanoseconds ?? 0);
      const exact = Number.isFinite(nanos2) ? sumObjectNanos(obj) : void 0;
      return exact === void 0 ? fromNanosNumber(nanos2) : make4(exact);
    }
  }
  return invalid(input);
};
var isIntegerOrUnset = (n) => !n || Number.isInteger(n);
var sumObjectNanos = (obj) => {
  if (!isIntegerOrUnset(obj.weeks) || !isIntegerOrUnset(obj.days) || !isIntegerOrUnset(obj.hours) || !isIntegerOrUnset(obj.minutes) || !isIntegerOrUnset(obj.seconds) || !isIntegerOrUnset(obj.milliseconds) || !isIntegerOrUnset(obj.microseconds) || !isIntegerOrUnset(obj.nanoseconds)) return void 0;
  let nanos2 = bigint0;
  if (obj.weeks) nanos2 += BigInt(obj.weeks) * bigintNanosPerWeek;
  if (obj.days) nanos2 += BigInt(obj.days) * bigintNanosPerDay;
  if (obj.hours) nanos2 += BigInt(obj.hours) * bigintNanosPerHour;
  if (obj.minutes) nanos2 += BigInt(obj.minutes) * bigintNanosPerMinute;
  if (obj.seconds) nanos2 += BigInt(obj.seconds) * bigint1e9;
  if (obj.milliseconds) nanos2 += BigInt(obj.milliseconds) * bigint1e6;
  if (obj.microseconds) nanos2 += BigInt(obj.microseconds) * bigint1e3;
  if (obj.nanoseconds) nanos2 += BigInt(obj.nanoseconds);
  return nanos2;
};
var invalid = (input) => {
  throw new Error(`Invalid Input: ${input}`);
};
var fromInput = /* @__PURE__ */ liftThrowable(fromInputUnsafe);
var zeroDurationValue = {
  _tag: "Millis",
  millis: 0
};
var infinityDurationValue = {
  _tag: "Infinity"
};
var negativeInfinityDurationValue = {
  _tag: "NegativeInfinity"
};
var DurationProto = {
  [TypeId4]: TypeId4,
  [symbol]() {
    switch (this.value._tag) {
      case "Millis":
        return hash(roundMillisToNanos(this.value.millis));
      case "Nanos":
        return hash(this.value.nanos);
      default:
        return structure(this.value);
    }
  },
  [symbol2](that) {
    return isDuration(that) && equals2(this, that);
  },
  toString() {
    switch (this.value._tag) {
      case "Infinity":
        return "Infinity";
      case "NegativeInfinity":
        return "-Infinity";
      case "Nanos":
        return `${this.value.nanos} nanos`;
      case "Millis":
        return `${this.value.millis} millis`;
    }
  },
  toJSON() {
    switch (this.value._tag) {
      case "Millis":
        return {
          _id: "Duration",
          _tag: "Millis",
          millis: this.value.millis
        };
      case "Nanos":
        return {
          _id: "Duration",
          _tag: "Nanos",
          nanos: String(this.value.nanos)
        };
      case "Infinity":
        return {
          _id: "Duration",
          _tag: "Infinity"
        };
      case "NegativeInfinity":
        return {
          _id: "Duration",
          _tag: "NegativeInfinity"
        };
    }
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make4 = (input) => {
  const duration = Object.create(DurationProto);
  if (typeof input === "number") {
    if (isNaN(input) || input === 0 || Object.is(input, -0)) {
      duration.value = zeroDurationValue;
    } else if (!Number.isFinite(input)) {
      duration.value = input > 0 ? infinityDurationValue : negativeInfinityDurationValue;
    } else if (!Number.isInteger(input)) {
      duration.value = {
        _tag: "Nanos",
        nanos: roundMillisToNanos(input)
      };
    } else {
      duration.value = {
        _tag: "Millis",
        millis: input
      };
    }
  } else if (input === bigint0) {
    duration.value = zeroDurationValue;
  } else {
    duration.value = {
      _tag: "Nanos",
      nanos: input
    };
  }
  return duration;
};
var isDuration = (u) => hasProperty(u, TypeId4);
var isFinite = (self) => self.value._tag !== "Infinity" && self.value._tag !== "NegativeInfinity";
var isZero = (self) => {
  switch (self.value._tag) {
    case "Millis":
      return self.value.millis === 0;
    case "Nanos":
      return self.value.nanos === bigint0;
    case "Infinity":
    case "NegativeInfinity":
      return false;
  }
};
var isNegative = (self) => {
  switch (self.value._tag) {
    case "Millis":
      return self.value.millis < 0;
    case "Nanos":
      return self.value.nanos < bigint0;
    case "NegativeInfinity":
      return true;
    case "Infinity":
      return false;
  }
};
var abs = (self) => {
  switch (self.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      return infinity;
    case "Millis":
      return self.value.millis < 0 ? make4(-self.value.millis) : self;
    case "Nanos":
      return self.value.nanos < bigint0 ? make4(-self.value.nanos) : self;
  }
};
var zero = /* @__PURE__ */ make4(0);
var infinity = /* @__PURE__ */ make4(Infinity);
var negativeInfinity = /* @__PURE__ */ make4(-Infinity);
var nanos = (nanos2) => make4(nanos2);
var millis = (millis2) => make4(millis2);
var seconds = (seconds2) => make4(seconds2 * 1e3);
var toMillis = (self) => match3(fromInputUnsafe(self), {
  onMillis: identity,
  onNanos: (nanos2) => nanosToUnit(nanos2, 1e6),
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
var toSeconds = (self) => match3(fromInputUnsafe(self), {
  onMillis: (millis2) => millis2 / 1e3,
  onNanos: (nanos2) => nanosToUnit(nanos2, 1e9),
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
var toNanosUnsafe = (input) => {
  const self = fromInputUnsafe(input);
  switch (self.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return self.value.nanos;
    case "Millis":
      return roundMillisToNanos(self.value.millis);
  }
};
var toNanos = /* @__PURE__ */ liftThrowable(toNanosUnsafe);
var match3 = /* @__PURE__ */ dual(2, (self, options) => {
  switch (self.value._tag) {
    case "Millis":
      return options.onMillis(self.value.millis);
    case "Nanos":
      return options.onNanos(self.value.nanos);
    case "Infinity":
      return options.onInfinity();
    case "NegativeInfinity":
      return (options.onNegativeInfinity ?? options.onInfinity)();
  }
});
var matchPair = /* @__PURE__ */ dual(3, (self, that, options) => {
  if (self.value._tag === "Infinity" || self.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity") return options.onInfinity(self, that);
  if (self.value._tag === "Millis") {
    return that.value._tag === "Millis" ? options.onMillis(self.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self), that.value.nanos);
  } else {
    return options.onNanos(self.value.nanos, toNanosUnsafe(that));
  }
});
var Equivalence = (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => self2 === that2,
  onNanos: (self2, that2) => self2 === that2,
  onInfinity: (self2, that2) => self2.value._tag === that2.value._tag
});
var subtract = /* @__PURE__ */ dual(2, (self, that) => matchPair(self, that, {
  onMillis: (self2, that2) => make4(self2 - that2),
  onNanos: (self2, that2) => make4(self2 - that2),
  onInfinity: (self2, that2) => {
    const s = self2.value._tag;
    const t = that2.value._tag;
    if (s === "Infinity") return t === "Infinity" ? zero : infinity;
    if (s === "NegativeInfinity") return t === "NegativeInfinity" ? zero : negativeInfinity;
    return t === "Infinity" ? negativeInfinity : infinity;
  }
}));
var equals2 = /* @__PURE__ */ dual(2, (self, that) => Equivalence(self, that));
var parts = (self) => {
  if (self.value._tag === "Infinity") {
    return {
      days: Infinity,
      hours: Infinity,
      minutes: Infinity,
      seconds: Infinity,
      millis: Infinity,
      nanos: Infinity
    };
  }
  if (self.value._tag === "NegativeInfinity") {
    return {
      days: -Infinity,
      hours: -Infinity,
      minutes: -Infinity,
      seconds: -Infinity,
      millis: -Infinity,
      nanos: -Infinity
    };
  }
  const n = toNanosUnsafe(self);
  const neg = n < bigint0;
  const a = neg ? -n : n;
  const ms = a / bigint1e6;
  const sec = ms / bigint1e3;
  const min5 = sec / bigint60;
  const hr = min5 / bigint60;
  const d = hr / bigint24;
  const sign2 = neg ? -1 : 1;
  return {
    days: sign2 * Number(d),
    hours: sign2 * Number(hr % bigint24),
    minutes: sign2 * Number(min5 % bigint60),
    seconds: sign2 * Number(sec % bigint60),
    millis: sign2 * Number(ms % bigint1e3),
    nanos: sign2 * Number(a % bigint1e6)
  };
};
var format2 = (self) => {
  if (self.value._tag === "Infinity") {
    return "Infinity";
  }
  if (self.value._tag === "NegativeInfinity") {
    return "-Infinity";
  }
  if (isZero(self)) {
    return "0";
  }
  if (isNegative(self)) {
    return "-" + format2(abs(self));
  }
  const fragments = parts(self);
  const pieces = [];
  if (fragments.days !== 0) {
    pieces.push(`${fragments.days}d`);
  }
  if (fragments.hours !== 0) {
    pieces.push(`${fragments.hours}h`);
  }
  if (fragments.minutes !== 0) {
    pieces.push(`${fragments.minutes}m`);
  }
  if (fragments.seconds !== 0) {
    pieces.push(`${fragments.seconds}s`);
  }
  if (fragments.millis !== 0) {
    pieces.push(`${fragments.millis}ms`);
  }
  if (fragments.nanos !== 0) {
    pieces.push(`${fragments.nanos}ns`);
  }
  return pieces.join(" ");
};

// node_modules/effect/dist/Scheduler.js
var Scheduler = /* @__PURE__ */ Reference("effect/Scheduler", {
  fiberCached: true,
  defaultValue: () => new MixedScheduler()
});
var setMicrotask = (f) => {
  let cancelled = false;
  Promise.resolve().then(() => {
    if (!cancelled) f();
  });
  return () => {
    cancelled = true;
  };
};
var setTimer = "setImmediate" in globalThis ? (f) => {
  const timer = globalThis.setImmediate(f);
  return () => globalThis.clearImmediate(timer);
} : (f) => {
  const timer = setTimeout(f, 0);
  return () => clearTimeout(timer);
};
var setImmediate = (f) => {
  try {
    return setTimer(f);
  } catch {
    return setMicrotask(f);
  }
};
var PriorityBuckets = class {
  buckets = [];
  scheduleTask(task, priority) {
    const buckets = this.buckets;
    const len = buckets.length;
    let bucket;
    let index2 = 0;
    for (; index2 < len; index2++) {
      if (buckets[index2][0] > priority) break;
      bucket = buckets[index2];
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task);
    } else if (index2 === len) {
      buckets.push([priority, [task]]);
    } else {
      buckets.splice(index2, 0, [priority, [task]]);
    }
  }
  drain() {
    const buckets = this.buckets;
    this.buckets = [];
    return buckets;
  }
};
var MixedScheduler = class {
  executionMode;
  setImmediate;
  constructor(executionMode = "async", setImmediateFn) {
    this.executionMode = executionMode;
    this.setImmediate = setImmediateFn ?? (executionMode === "sync" ? setMicrotask : setImmediate);
  }
  /**
   * Returns whether the fiber has reached its operation budget and should yield.
   *
   * **When to use**
   *
   * Use to decide whether a fiber should yield after consuming its current
   * operation budget.
   *
   * @since 2.0.0
   */
  shouldYield(fiber3) {
    return fiber3.currentOpCount >= fiber3.cache.maxOpsBeforeYield;
  }
  /**
   * Creates a dispatcher that schedules work through this scheduler.
   *
   * **When to use**
   *
   * Use when you need a standalone dispatcher from a scheduler instance, for
   * example in tests that enqueue tasks and then flush them deterministically.
   *
   * @since 4.0.0
   */
  makeDispatcher() {
    return new MixedSchedulerDispatcher(this.setImmediate);
  }
};
var MixedSchedulerDispatcher = class {
  tasks = /* @__PURE__ */ new PriorityBuckets();
  running = void 0;
  setImmediate;
  constructor(setImmediateFn = setImmediate) {
    this.setImmediate = setImmediateFn;
  }
  /**
   * @since 2.0.0
   */
  scheduleTask(task, priority) {
    this.tasks.scheduleTask(task, priority);
    if (this.running === void 0) {
      this.running = this.setImmediate(this.afterScheduled);
    }
  }
  /**
   * @since 2.0.0
   */
  afterScheduled = () => {
    this.running = void 0;
    this.runTasks();
  };
  /**
   * @since 2.0.0
   */
  runTasks() {
    const buckets = this.tasks.drain();
    for (let i = 0; i < buckets.length; i++) {
      const toRun = buckets[i][1];
      for (let j = 0; j < toRun.length; j++) {
        toRun[j]();
      }
    }
  }
  /**
   * @since 2.0.0
   */
  flush() {
    while (this.tasks.buckets.length > 0) {
      if (this.running !== void 0) {
        this.running();
        this.running = void 0;
      }
      this.runTasks();
    }
  }
};
var MaxOpsBeforeYield = /* @__PURE__ */ Reference("effect/Scheduler/MaxOpsBeforeYield", {
  fiberCached: true,
  defaultValue: () => 2048
});
var PreventSchedulerYield = /* @__PURE__ */ Reference("effect/Scheduler/PreventSchedulerYield", {
  fiberCached: true,
  defaultValue: () => false
});

// node_modules/effect/dist/Data.js
var Class3 = class extends Class {
  constructor(props) {
    super();
    if (props) {
      assignProperties(this, props);
    }
  }
};
var Error3 = Error2;
var TaggedError2 = TaggedError;

// node_modules/effect/dist/encoding/EncodingError.js
var EncodingErrorTypeId = "~effect/encoding/EncodingError";
var EncodingError = class extends (/* @__PURE__ */ TaggedError2("EncodingError")) {
  /**
   * Marks this value as an encoding or decoding error for runtime guards.
   *
   * **When to use**
   *
   * Use to identify `EncodingError` instances through `isEncodingError`.
   *
   * @since 4.0.0
   */
  [EncodingErrorTypeId] = EncodingErrorTypeId;
};

// node_modules/effect/dist/encoding/Hex.js
var encode = (input) => typeof input === "string" ? hexEncodeUint8Array(encoder.encode(input)) : hexEncodeUint8Array(input);
var random2 = (length) => {
  switch (length) {
    case 16:
      return random16();
    case 32:
      return random32();
    default: {
      let result3 = "";
      for (let i = length >>> 3; i > 0; i--) {
        result3 += random8();
      }
      return result3;
    }
  }
};
var hexCharCodes = /* @__PURE__ */ Uint8Array.from("0123456789abcdef", (c) => c.charCodeAt(0));
var randomWord = () => Math.random() * 4294967296 >>> 0;
var random8 = () => {
  const a = randomWord();
  return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15]);
};
var random16 = () => {
  const a = randomWord();
  const b = randomWord();
  return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15], hexCharCodes[b >>> 28], hexCharCodes[b >>> 24 & 15], hexCharCodes[b >>> 20 & 15], hexCharCodes[b >>> 16 & 15], hexCharCodes[b >>> 12 & 15], hexCharCodes[b >>> 8 & 15], hexCharCodes[b >>> 4 & 15], hexCharCodes[b & 15]);
};
var random32 = () => {
  const a = randomWord();
  const b = randomWord();
  const c = randomWord();
  const d = randomWord();
  return String.fromCharCode(hexCharCodes[a >>> 28], hexCharCodes[a >>> 24 & 15], hexCharCodes[a >>> 20 & 15], hexCharCodes[a >>> 16 & 15], hexCharCodes[a >>> 12 & 15], hexCharCodes[a >>> 8 & 15], hexCharCodes[a >>> 4 & 15], hexCharCodes[a & 15], hexCharCodes[b >>> 28], hexCharCodes[b >>> 24 & 15], hexCharCodes[b >>> 20 & 15], hexCharCodes[b >>> 16 & 15], hexCharCodes[b >>> 12 & 15], hexCharCodes[b >>> 8 & 15], hexCharCodes[b >>> 4 & 15], hexCharCodes[b & 15], hexCharCodes[c >>> 28], hexCharCodes[c >>> 24 & 15], hexCharCodes[c >>> 20 & 15], hexCharCodes[c >>> 16 & 15], hexCharCodes[c >>> 12 & 15], hexCharCodes[c >>> 8 & 15], hexCharCodes[c >>> 4 & 15], hexCharCodes[c & 15], hexCharCodes[d >>> 28], hexCharCodes[d >>> 24 & 15], hexCharCodes[d >>> 20 & 15], hexCharCodes[d >>> 16 & 15], hexCharCodes[d >>> 12 & 15], hexCharCodes[d >>> 8 & 15], hexCharCodes[d >>> 4 & 15], hexCharCodes[d & 15]);
};
var decode = (str) => {
  const bytes2 = new TextEncoder().encode(str);
  if (bytes2.length % 2 !== 0) {
    return fail2(new EncodingError({
      module: "Hex",
      kind: "Decode",
      input: str,
      message: `Length must be a multiple of 2, but is ${bytes2.length}`
    }));
  }
  try {
    const length = bytes2.length / 2;
    const result3 = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      const a = fromHexChar(bytes2[i * 2]);
      const b = fromHexChar(bytes2[i * 2 + 1]);
      result3[i] = a << 4 | b;
    }
    return succeed2(result3);
  } catch (e) {
    return fail2(new EncodingError({
      module: "Hex",
      kind: "Decode",
      input: str,
      message: e instanceof Error ? e.message : "Invalid input"
    }));
  }
};
var decodeString = (str) => map2(decode(str), (_) => decoder.decode(_));
var encoder = /* @__PURE__ */ new TextEncoder();
var decoder = /* @__PURE__ */ new TextDecoder();
var byteToHex = /* @__PURE__ */ Array.from({
  length: 256
}, (_, i) => i.toString(16).padStart(2, "0"));
var hexEncodeUint8Array = (bytes2) => {
  let result3 = "";
  for (let i = 0; i < bytes2.length; i++) {
    result3 += byteToHex[bytes2[i]];
  }
  return result3;
};
var fromHexChar = (byte) => {
  if (48 <= byte && byte <= 57) {
    return byte - 48;
  }
  if (97 <= byte && byte <= 102) {
    return byte - 97 + 10;
  }
  if (65 <= byte && byte <= 70) {
    return byte - 65 + 10;
  }
  throw new TypeError("Invalid input");
};

// node_modules/effect/dist/Tracer.js
var ParentSpanKey = "effect/Tracer/ParentSpan";
var ParentSpan = class extends (/* @__PURE__ */ Service()(ParentSpanKey, {
  fiberCached: true
})) {
};
var make5 = (options) => options;
var DisablePropagation = /* @__PURE__ */ Reference("effect/Tracer/DisablePropagation", {
  defaultValue: constFalse
});
var CurrentTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/CurrentTraceLevel", {
  defaultValue: () => "Info"
});
var MinimumTraceLevel = /* @__PURE__ */ Reference("effect/Tracer/MinimumTraceLevel", {
  defaultValue: () => "All"
});
var TracerKey = "effect/Tracer";
var Tracer = /* @__PURE__ */ Reference(TracerKey, {
  fiberCached: true,
  defaultValue: () => nativeTracer
});
var nativeTracer = /* @__PURE__ */ make5({
  span: (options) => new NativeSpan(options)
});
var NativeSpan = class {
  _tag = "Span";
  sampled;
  name;
  parent;
  annotations;
  links;
  startTime;
  kind;
  status;
  _traceId = void 0;
  _spanId = void 0;
  _attributes = void 0;
  _events = void 0;
  constructor(options) {
    this.name = options.name;
    this.parent = options.parent;
    this.annotations = options.annotations;
    this.links = options.links;
    this.startTime = options.startTime;
    this.kind = options.kind;
    this.sampled = options.sampled;
    this.status = {
      _tag: "Started",
      startTime: options.startTime
    };
  }
  get traceId() {
    return this._traceId ??= getOrUndefined(this.parent)?.traceId ?? random2(32);
  }
  get spanId() {
    return this._spanId ??= random2(16);
  }
  get attributes() {
    return this._attributes ??= /* @__PURE__ */ new Map();
  }
  get events() {
    return this._events ??= [];
  }
  end(endTime, exit3) {
    this.status = {
      _tag: "Ended",
      endTime,
      exit: exit3,
      startTime: this.status.startTime
    };
  }
  attribute(key, value3) {
    this.attributes.set(key, value3);
  }
  event(name, startTime, attributes) {
    this.events.push([name, startTime, attributes ?? {}]);
  }
  addLinks(links) {
    this.links.push(...links);
  }
};

// node_modules/effect/dist/internal/metric.js
var FiberRuntimeMetricsKey = "effect/Metric/FiberRuntimeMetrics";

// node_modules/effect/dist/internal/references.js
var CurrentErrorReporters = /* @__PURE__ */ Reference("effect/ErrorReporter/CurrentErrorReporters", {
  defaultValue: () => /* @__PURE__ */ new Set()
});
var CurrentStackFrame = /* @__PURE__ */ Reference("effect/References/CurrentStackFrame", {
  fiberCached: true,
  defaultValue: constUndefined
});
var TracerEnabled = /* @__PURE__ */ Reference("effect/References/TracerEnabled", {
  fiberCached: true,
  defaultValue: constTrue
});
var TracerTimingEnabled = /* @__PURE__ */ Reference("effect/References/TracerTimingEnabled", {
  defaultValue: constTrue
});
var TracerSpanAnnotations = /* @__PURE__ */ Reference("effect/References/TracerSpanAnnotations", {
  defaultValue: () => ({})
});
var TracerSpanLinks = /* @__PURE__ */ Reference("effect/References/TracerSpanLinks", {
  defaultValue: () => []
});
var CurrentLogAnnotations = /* @__PURE__ */ Reference("effect/References/CurrentLogAnnotations", {
  defaultValue: () => ({})
});
var CurrentLogLevel = /* @__PURE__ */ Reference("effect/References/CurrentLogLevel", {
  fiberCached: true,
  defaultValue: () => "Info"
});
var MinimumLogLevel = /* @__PURE__ */ Reference("effect/References/MinimumLogLevel", {
  fiberCached: true,
  defaultValue: () => "Info"
});
var CurrentLogSpans = /* @__PURE__ */ Reference("effect/References/CurrentLogSpans", {
  defaultValue: () => []
});

// node_modules/effect/dist/internal/tracer.js
var addSpanStackTrace = (options) => {
  if (options?.captureStackTrace === false) {
    return options;
  } else if (options?.captureStackTrace !== void 0 && typeof options.captureStackTrace !== "boolean") {
    return options;
  }
  const limit = getStackTraceLimit();
  if (limit === 0 && options?.captureStackTrace !== true) {
    return {
      ...options,
      captureStackTrace: false
    };
  }
  setStackTraceLimit(3);
  const traceError = new Error();
  setStackTraceLimit(limit);
  return {
    ...options,
    captureStackTrace: spanCleaner(() => traceError.stack)
  };
};
var makeStackCleaner = (line) => (stack) => {
  let cache2;
  return () => {
    if (cache2 !== void 0) return cache2;
    const trace = stack();
    if (!trace) return void 0;
    const lines = trace.split("\n");
    if (lines[line] !== void 0) {
      cache2 = lines[line].trim();
      return cache2;
    }
  };
};
var spanCleaner = /* @__PURE__ */ makeStackCleaner(3);

// node_modules/effect/dist/internal/effect.js
var Interrupt = class extends ReasonBase {
  constructor(fiberId3, annotations = constEmptyAnnotations) {
    super("Interrupt", annotations, "Interrupted");
    this.fiberId = fiberId3;
  }
  toString() {
    return `Interrupt(${this.fiberId})`;
  }
  toJSON() {
    return {
      _tag: "Interrupt",
      fiberId: this.fiberId
    };
  }
  [symbol2](that) {
    return isInterruptReason(that) && this.fiberId === that.fiberId && this.annotations === that.annotations;
  }
  [symbol]() {
    return string(`${this._tag}:${this.fiberId}`);
  }
};
var makeInterruptReason = (fiberId3) => new Interrupt(fiberId3);
var causeInterrupt = (fiberId3) => new CauseImpl([new Interrupt(fiberId3)]);
var hasFails = (self) => self.reasons.some(isFailReason);
var findError = (self) => {
  for (let i = 0; i < self.reasons.length; i++) {
    const reason = self.reasons[i];
    if (reason._tag === "Fail") {
      return succeed2(reason.error);
    }
  }
  return fail2(self);
};
var hasDies = (self) => self.reasons.some(isDieReason);
var causeElectDefects = (self) => hasDies(self) && hasFails(self) ? causeFromReasons(self.reasons.map((reason) => reason._tag === "Fail" && !isDone(reason.error) ? new Die(reason.error, reason.annotations) : reason)) : self;
var findRecoverableError = (self) => hasDies(self) ? fail2(causeElectDefects(self)) : findError(self);
var findDefect = (self) => {
  const reason = self.reasons.find(isDieReason);
  return reason ? succeed2(reason.defect) : fail2(self);
};
var hasInterrupts = (self) => self.reasons.some(isInterruptReason);
var causeFilterInterruptors = (self) => {
  let interruptors;
  for (let i = 0; i < self.reasons.length; i++) {
    const f = self.reasons[i];
    if (f._tag !== "Interrupt") continue;
    interruptors ??= /* @__PURE__ */ new Set();
    if (f.fiberId !== void 0) {
      interruptors.add(f.fiberId);
    }
  }
  return interruptors ? succeed2(interruptors) : fail2(self);
};
var hasInterruptsOnly = (self) => self.reasons.length > 0 && self.reasons.every(isInterruptReason);
var causeMap = /* @__PURE__ */ dual(2, (self, f) => {
  let hasFail = false;
  const failures = self.reasons.map((failure) => {
    if (isFailReason(failure)) {
      hasFail = true;
      return new Fail(f(failure.error), failure.annotations);
    }
    return failure;
  });
  return hasFail ? causeFromReasons(failures) : self;
});
var causeSquash = (self) => {
  let die4;
  for (const reason of self.reasons) {
    if (reason._tag === "Fail") return reason.error;
    if (reason._tag === "Die") die4 ??= reason;
  }
  if (die4 !== void 0) return die4.defect;
  if (self.reasons.length > 0) return new globalThis.Error("All fibers interrupted without error");
  return new globalThis.Error("Empty cause");
};
var causePrettyErrors = (self, options) => {
  const errors = [];
  const interrupts = [];
  if (self.reasons.length === 0) return errors;
  const prevStackLimit = getStackTraceLimit();
  if (prevStackLimit !== 0) setStackTraceLimit(1);
  try {
    for (const failure of self.reasons) {
      if (failure._tag === "Interrupt") {
        interrupts.push(failure);
        continue;
      }
      errors.push(causePrettyError(failure._tag === "Die" ? failure.defect : failure.error, failure.annotations, options));
    }
    if (errors.length === 0) {
      const cause = new Error("The fiber was interrupted by:");
      cause.name = "InterruptCause";
      cause.stack = interruptCauseStack(cause, interrupts);
      const error = new globalThis.Error("All fibers interrupted without error", {
        cause
      });
      error.name = "InterruptError";
      error.stack = `${error.name}: ${error.message}`;
      errors.push(causePrettyError(error, interrupts[0].annotations, options));
    }
  } finally {
    if (prevStackLimit !== 0) setStackTraceLimit(prevStackLimit);
  }
  return errors;
};
var causePrettyError = (original, annotations, options, seen = /* @__PURE__ */ new Set()) => {
  const kind = typeof original;
  let error;
  if (original && kind === "object") {
    seen.add(original);
    const cause = original.cause;
    error = new globalThis.Error(causePrettyMessage(original), {
      cause: cause !== void 0 && !seen.has(cause) ? causePrettyError(cause, void 0, void 0, seen) : void 0
    });
    if (typeof original.name === "string") {
      error.name = original.name;
    }
    if (typeof original.stack === "string") {
      error.stack = cleanErrorStack(original.stack, error, annotations);
    } else {
      const stack = `${error.name}: ${error.message}`;
      error.stack = annotations ? addStackAnnotations(stack, annotations) : stack;
    }
    if (options?.includeCauseInStack) {
      error.stack = renderPrettyError(error);
    }
    for (const key of Object.keys(original)) {
      if (!(key in error)) {
        ;
        error[key] = original[key];
      }
    }
  } else {
    error = new globalThis.Error(!original ? `Unknown error: ${original}` : kind === "string" ? original : formatJson(original));
    const stack = `${error.name}: ${error.message}`;
    error.stack = annotations ? addStackAnnotations(stack, annotations) : stack;
  }
  return error;
};
var causePrettyMessage = (u) => {
  if (typeof u.message === "string") {
    return u.message;
  } else if (typeof u.toString === "function" && u.toString !== Object.prototype.toString && u.toString !== Array.prototype.toString) {
    try {
      return u.toString();
    } catch {
    }
  }
  return formatJson(u);
};
var locationRegExp = /\((.*)\)/g;
var cleanErrorStack = (stack, error, annotations) => {
  const message = `${error.name}: ${error.message}`;
  const lines = (stack.startsWith(message) ? stack.slice(message.length) : stack).split("\n");
  const out = [message];
  for (let i = 1; i < lines.length; i++) {
    if (/Generator\.next|~effect\/(?:Effect|Utils)/.test(lines[i])) {
      break;
    }
    out.push(lines[i]);
  }
  return annotations ? addStackAnnotations(out.join("\n"), annotations) : out.join("\n");
};
var addStackAnnotations = (stack, annotations) => {
  const frame2 = annotations?.get(StackTraceKey.key);
  if (frame2) {
    stack = `${stack}
${currentStackTrace(frame2)}`;
  }
  return stack;
};
var interruptCauseStack = (error, interrupts) => {
  const out = [`${error.name}: ${error.message}`];
  for (const current of interrupts) {
    const fiberId3 = current.fiberId !== void 0 ? `#${current.fiberId}` : "unknown";
    const frame2 = current.annotations.get(InterruptorStackTrace.key);
    out.push(`    at fiber (${fiberId3})`);
    if (frame2) out.push(currentStackTrace(frame2));
  }
  return out.join("\n");
};
var currentStackTrace = (frame2) => {
  const out = [];
  let current = frame2;
  let i = 0;
  while (current && i < 10) {
    const stack = current.stack();
    if (stack) {
      const locationMatchAll = stack.matchAll(locationRegExp);
      let match7 = false;
      for (const [, location] of locationMatchAll) {
        match7 = true;
        out.push(`    at ${current.name} (${location})`);
      }
      if (!match7) {
        out.push(`    at ${current.name} (${stack.replace(/^at /, "")})`);
      }
    } else {
      out.push(`    at ${current.name}`);
    }
    current = current.parent;
    i++;
  }
  return out.join("\n");
};
var causePretty = (cause) => causePrettyErrors(cause).map(renderPrettyError).join("\n");
var renderPrettyError = (e) => e.cause ? `${e.stack} {
${renderErrorCause(e.cause, "  ")}
}` : e.stack;
var renderErrorCause = (cause, prefix) => {
  const lines = cause.stack.split("\n");
  let stack = `${prefix}[cause]: ${lines[0]}`;
  for (let i = 1, len = lines.length; i < len; i++) {
    stack += `
${prefix}${lines[i]}`;
  }
  if (cause.cause) {
    stack += ` {
${renderErrorCause(cause.cause, `${prefix}  `)}
${prefix}}`;
  }
  return stack;
};
var FiberTypeId = "~effect/Fiber";
var fiberVariance = {
  _A: identity,
  _E: identity
};
var fiberIdStore = {
  id: 0
};
var AsyncResource = /* @__PURE__ */ (() => {
  try {
    return globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncResource;
  } catch {
    return void 0;
  }
})();
var captureAsyncContext = () => AsyncResource === void 0 ? void 0 : new AsyncResource("effect/Fiber");
var getCurrentFiber = () => globalThis[currentFiberTypeId];
var FiberImpl = class {
  constructor(context3, interruptible3 = true) {
    this.setContext(context3);
    this.id = ++fiberIdStore.id;
    this.currentOpCount = 0;
    this.interruptible = interruptible3;
    this._stack = [];
    this._observers = void 0;
    this._exit = void 0;
    this._children = void 0;
    this._interruptedCause = void 0;
    this._yielded = void 0;
    this._running = false;
    this._deferredInterrupt = false;
    this._parent = void 0;
    this._asyncContext = void 0;
    this.cache.runtimeMetrics?.recordFiberStart(this.context);
  }
  get [FiberTypeId]() {
    return fiberVariance;
  }
  get currentDispatcher() {
    return this._dispatcher ??= this.cache.scheduler.makeDispatcher();
  }
  getRef(ref) {
    return get(this.context, ref);
  }
  addObserver(cb) {
    if (this._exit) {
      cb(this._exit);
      return constVoid;
    }
    if (this._observers === void 0) {
      this._observers = [cb];
    } else {
      this._observers.push(cb);
    }
    return () => this.removeObserver(cb);
  }
  removeObserver(cb) {
    if (this._exit || this._observers === void 0) return;
    const index2 = this._observers.indexOf(cb);
    if (index2 >= 0) {
      this._observers.splice(index2, 1);
    }
  }
  interruptUnsafe(fiberId3, annotations) {
    if (this._exit) {
      return;
    }
    let cause = causeInterrupt(fiberId3);
    if (this.cache.stackFrame) {
      cause = causeAnnotate(cause, make3(StackTraceKey, this.cache.stackFrame));
    }
    if (annotations) {
      cause = causeAnnotate(cause, annotations);
    }
    this._interruptedCause = this._interruptedCause ? causeAddInterrupts(this._interruptedCause, cause) : cause;
    if (this.interruptible) {
      if (this._running) {
        this._deferredInterrupt = true;
      } else {
        this.evaluate(failCause(this._interruptedCause));
      }
    }
  }
  pollUnsafe() {
    return this._exit;
  }
  evaluate(effect) {
    if (this._exit) {
      return;
    } else if (this._asyncContext !== void 0) {
      const asyncContext = this._asyncContext;
      this._asyncContext = void 0;
      try {
        return asyncContext.runInAsyncScope(this.evaluate, this, effect);
      } finally {
        asyncContext.emitDestroy();
      }
    } else if (this._yielded !== void 0) {
      const yielded = this._yielded;
      this._yielded = void 0;
      yielded();
    }
    const exit3 = this.runLoop(effect);
    if (exit3 === Yield) {
      this._asyncContext = captureAsyncContext();
      return;
    }
    const interruptChildren = fiberMiddleware.interruptChildren && fiberMiddleware.interruptChildren(this);
    if (interruptChildren !== void 0) {
      return this.evaluate(flatMap3(interruptChildren, () => exit3));
    }
    this._exit = exit3;
    this.cache.runtimeMetrics?.recordFiberEnd(this.context, this._exit);
    if (this._parent) {
      this._parent._children?.delete(this);
      this._parent = void 0;
    }
    if (this._observers !== void 0) {
      const observers = this._observers;
      this._observers = void 0;
      for (let i = 0; i < observers.length; i++) {
        observers[i](exit3);
      }
    }
    this._stack.length = 0;
    this._children = void 0;
    this.context = empty();
  }
  runLoop(effect) {
    const prevFiber = globalThis[currentFiberTypeId];
    globalThis[currentFiberTypeId] = this;
    const prevRunning = this._running;
    this._running = true;
    let yielding = false;
    let current = effect;
    this.currentOpCount = 0;
    try {
      while (true) {
        try {
          if (this._deferredInterrupt) {
            this._deferredInterrupt = false;
            current = failCause(this._interruptedCause);
          }
          this.currentOpCount++;
          const cache2 = this.cache;
          if (!yielding && !cache2.preventYield && cache2.scheduler.shouldYield(this)) {
            yielding = true;
            const prev = current;
            current = flatMap3(yieldNow, () => prev);
          }
          current = cache2.tracerContext ? cache2.tracerContext(current, this) : current[evaluate](this);
          if (current === Yield) {
            const yielded = this._yielded;
            if (ExitTypeId in yielded) {
              this._deferredInterrupt = false;
              this._yielded = void 0;
              return yielded;
            } else if (this._deferredInterrupt) {
              this._yielded = void 0;
              yielded();
              continue;
            }
            return Yield;
          }
        } catch (error) {
          if (!hasProperty(current, evaluate)) {
            return exitDie(`Fiber.runLoop: Not a valid effect: ${String(current)}`);
          }
          current = exitDie(error);
        }
      }
    } finally {
      this._running = prevRunning;
      globalThis[currentFiberTypeId] = prevFiber;
    }
  }
  getCont(symbol4) {
    if (this._deferredInterrupt) {
      this._deferredInterrupt = false;
      return deferredInterruptCont;
    }
    while (true) {
      const op = this._stack.pop();
      if (!op) return void 0;
      const all4 = op[contAll];
      if (all4 !== void 0) {
        const cont = all4.call(op, this);
        if (cont) {
          ;
          cont[symbol4] = cont;
          return cont;
        }
      }
      if (op[symbol4]) return op;
    }
  }
  // Passes a success value straight to the next continuation instead of
  // returning an Exit for the run loop to unwrap. Each call counts as an
  // operation, and every `maxInlineSteps`th call returns an Exit instead, so
  // continuations calling continuations never nest deeper than that.
  succeedWith(value3) {
    if ((++this.currentOpCount & maxInlineSteps - 1) === 0) {
      return exitSucceed(value3);
    }
    const cont = this.getCont(contA);
    return cont ? cont[contA](value3, this) : this.yieldWith(exitSucceed(value3));
  }
  yieldWith(value3) {
    this._yielded = value3;
    return Yield;
  }
  children() {
    return this._children ??= /* @__PURE__ */ new Set();
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
  setContext(context3) {
    const previous = this.context;
    this.context = context3;
    if (previous !== void 0 && hasSameCache(previous, context3)) return;
    const root = context3.cacheRoot;
    const cache2 = root._fiberCache ??= makeFiberContextCache(context3);
    if (this.cache?.scheduler !== cache2.scheduler) {
      this._dispatcher = void 0;
    }
    this.cache = cache2;
  }
  get currentSpanLocal() {
    const span = this.cache.span;
    return span?._tag === "Span" ? span : void 0;
  }
};
var makeFiberContextCache = (context3) => {
  const currentTracer = getOrUndefinedUnsafe(context3, TracerKey);
  return {
    scheduler: get(context3, Scheduler),
    tracer: currentTracer,
    tracerContext: currentTracer ? currentTracer["context"] : void 0,
    tracerEnabled: get(context3, TracerEnabled),
    span: getOrUndefinedUnsafe(context3, ParentSpanKey),
    logLevel: get(context3, CurrentLogLevel),
    minimumLogLevel: get(context3, MinimumLogLevel),
    stackFrame: get(context3, CurrentStackFrame),
    runtimeMetrics: getOrUndefinedUnsafe(context3, FiberRuntimeMetricsKey),
    maxOpsBeforeYield: get(context3, MaxOpsBeforeYield),
    preventYield: get(context3, PreventSchedulerYield)
  };
};
var deferredInterruptCont = {
  [contA](_value, fiber3) {
    return failCause(fiber3._interruptedCause);
  },
  [contE](_cause, fiber3) {
    return failCause(fiber3._interruptedCause);
  }
};
var maxInlineSteps = 32;
var fiberMiddleware = {
  interruptChildren: void 0
};
var fiberStackAnnotations = (fiber3) => {
  if (!fiber3.cache.stackFrame) return void 0;
  const annotations = /* @__PURE__ */ new Map();
  annotations.set(InterruptorStackTrace.key, fiber3.cache.stackFrame);
  return makeUnsafe(annotations);
};
var fiberInterruptChildren = (fiber3) => {
  if (fiber3._children === void 0 || fiber3._children.size === 0) {
    return void 0;
  }
  return fiberInterruptAll(fiber3._children);
};
var fiberAwait = (self) => {
  const impl = self;
  if (impl._exit) return succeed3(impl._exit);
  return callback((resume) => {
    if (impl._exit) return resume(succeed3(impl._exit));
    return sync(self.addObserver((exit3) => resume(succeed3(exit3))));
  });
};
var fiberAwaitAll = (self) => callback((resume) => {
  const iter = self[Symbol.iterator]();
  const exits = [];
  let cancel = void 0;
  function loop() {
    let result3 = iter.next();
    while (!result3.done) {
      if (result3.value._exit) {
        exits.push(result3.value._exit);
        result3 = iter.next();
        continue;
      }
      cancel = result3.value.addObserver((exit3) => {
        exits.push(exit3);
        loop();
      });
      return;
    }
    resume(succeed3(exits));
  }
  loop();
  return sync(() => cancel?.());
});
var fiberJoin = (self) => {
  const impl = self;
  if (impl._exit) return impl._exit;
  return callback((resume) => {
    if (impl._exit) return resume(impl._exit);
    return sync(self.addObserver(resume));
  });
};
var fiberInterrupt = (self) => withFiber((fiber3) => fiberInterruptAs(self, fiber3.id));
var fiberInterruptAs = /* @__PURE__ */ dual((args2) => hasProperty(args2[0], FiberTypeId), (self, fiberId3, annotations) => withFiber((parent) => {
  let ann = fiberStackAnnotations(parent);
  ann = ann && annotations ? merge(ann, annotations) : ann ?? annotations;
  self.interruptUnsafe(fiberId3, ann);
  return asVoid(fiberAwait(self));
}));
var fiberInterruptAll = (fibers) => withFiber((parent) => {
  const annotations = fiberStackAnnotations(parent);
  let fiberArr = empty2();
  for (const fiber3 of fibers) {
    fiber3.interruptUnsafe(parent.id, annotations);
    fiberArr.push(fiber3);
  }
  return asVoid(fiberAwaitAll(fiberArr));
});
var succeed3 = exitSucceed;
var failCause = exitFailCause;
var fail3 = exitFail;
var sync = /* @__PURE__ */ makePrimitive({
  op: "Sync",
  [evaluate](fiber3) {
    const value3 = this[args]();
    const cont = fiber3.getCont(contA);
    return cont ? cont[contA](value3, fiber3) : fiber3.yieldWith(exitSucceed(value3));
  }
});
var suspend = /* @__PURE__ */ makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]();
  }
});
var fromOption3 = /* @__PURE__ */ dual((args2) => args2.length >= 2 || isOption2(args2[0]), (option3, onNone) => isNone2(option3) ? onNone ? failSync(onNone) : fail3(new NoSuchElementError("Effect.fromOption: Option.none")) : succeed3(option3.value));
var fromResult = /* @__PURE__ */ match2({
  onFailure: fail3,
  onSuccess: succeed3
});
var fromNullishOr3 = (value3) => value3 == null ? fail3(new NoSuchElementError()) : succeed3(value3);
var yieldNowWith = /* @__PURE__ */ makePrimitive({
  op: "Yield",
  [evaluate](fiber3) {
    let resumed = false;
    fiber3.currentDispatcher.scheduleTask(() => {
      if (resumed) return;
      fiber3.evaluate(exitVoid);
    }, this[args] ?? 0);
    return fiber3.yieldWith(() => {
      resumed = true;
    });
  }
});
var yieldNow = /* @__PURE__ */ yieldNowWith(0);
var succeedSome2 = (a) => succeed3(some2(a));
var succeedNone2 = /* @__PURE__ */ succeed3(/* @__PURE__ */ none2());
var transposeOption2 = (self) => isNone2(self) ? succeedNone2 : map5(self.value, some2);
var failCauseSync = (evaluate2) => suspend(() => failCause(evaluate2()));
var die = (defect) => exitDie(defect);
var failSync = (error) => suspend(() => fail3(error()));
var void_2 = /* @__PURE__ */ succeed3(void 0);
var try_2 = (options) => {
  const evaluate2 = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.try") : options.catch;
  return suspend(() => {
    try {
      return succeed3(evaluate2());
    } catch (err) {
      return fail3(catcher(err));
    }
  });
};
var promise = (evaluate2) => callbackOptions(function(resume, signal) {
  evaluate2(signal).then((a) => resume(succeed3(a)), (e) => resume(die(e)));
}, evaluate2.length !== 0);
var tryPromise = (options) => {
  const f = typeof options === "function" ? options : options.try;
  const catcher = typeof options === "function" ? (cause) => new UnknownError(cause, "An error occurred in Effect.tryPromise") : options.catch;
  return callbackOptions(function(resume, signal) {
    const failWithCatch = (cause) => suspend(() => {
      try {
        return fail3(internalCall(() => catcher(cause)));
      } catch (err) {
        return die(err);
      }
    });
    try {
      f(signal).then((a) => resume(succeed3(a)), (e) => resume(failWithCatch(e)));
    } catch (err) {
      resume(failWithCatch(err));
    }
  }, f.length !== 0);
};
var withFiberId = (f) => withFiber((fiber3) => f(fiber3.id));
var fiber = /* @__PURE__ */ withFiber(succeed3);
var fiberId = /* @__PURE__ */ withFiberId(succeed3);
var callbackOptions = /* @__PURE__ */ (function() {
  const Proto8 = /* @__PURE__ */ makePrimitiveProto({
    op: "Async",
    [evaluate](fiber3) {
      let resumed = false;
      let yielded = false;
      const controller = this.withSignal ? new AbortController() : void 0;
      const onCancel = this.register.call(fiber3.cache.scheduler, (effect) => {
        if (resumed) return;
        resumed = true;
        if (yielded) {
          fiber3.evaluate(effect);
        } else {
          yielded = effect;
        }
      }, controller?.signal);
      if (yielded !== false) return yielded;
      yielded = true;
      fiber3.yieldWith(() => {
        resumed = true;
      });
      if (controller === void 0 && onCancel === void 0) {
        return Yield;
      }
      fiber3._stack.push(asyncFinalizer(() => {
        resumed = true;
        controller?.abort();
        return onCancel ?? exitVoid;
      }));
      return Yield;
    }
  });
  const AsyncImpl = function(register, withSignal) {
    this.register = register;
    this.withSignal = withSignal;
  };
  AsyncImpl.prototype = Proto8;
  return function(register, withSignal) {
    return new AsyncImpl(register, withSignal);
  };
})();
var asyncFinalizer = /* @__PURE__ */ makePrimitive({
  op: "AsyncFinalizer",
  [contAll](fiber3) {
    if (fiber3.interruptible) {
      fiber3.interruptible = false;
      fiber3._stack.push(setInterruptibleTrue);
    }
  },
  [contE](cause, _fiber) {
    return hasInterrupts(cause) ? flatMap3(combineFinalizerCause(exitFailCause(cause), this[args]()), () => failCause(cause)) : failCause(cause);
  }
});
var callback = (register) => callbackOptions(register, register.length >= 2);
var never = /* @__PURE__ */ callback(constVoid);
var gen2 = (...args2) => {
  if (args2.length === 1) {
    const body2 = args2[0];
    return suspend(() => fromIteratorUnsafe(body2()));
  }
  const [options, body] = args2;
  return suspend(() => fromIteratorUnsafe(body.call(options.self)));
};
var fnUntraced = (body, ...pipeables) => {
  const fn3 = pipeables.length === 0 ? function() {
    return suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
  } : function() {
    let effect = suspend(() => fromIteratorUnsafe(body.apply(this, arguments)));
    for (let i = 0; i < pipeables.length; i++) {
      effect = pipeables[i](effect, ...arguments);
    }
    return effect;
  };
  return defineFunctionLength(body.length, fn3);
};
var defineFunctionLength = (length, fn3) => Object.defineProperty(fn3, "length", {
  value: length,
  configurable: true
});
var fnStackCleaner = /* @__PURE__ */ makeStackCleaner(2);
var fn = function() {
  const nameFirst = typeof arguments[0] === "string";
  const name = nameFirst ? arguments[0] : "Effect.fn";
  const spanOptions = nameFirst ? arguments[1] : void 0;
  const prevLimit = getStackTraceLimit();
  let defError;
  if (prevLimit !== 0) {
    setStackTraceLimit(2);
    defError = new globalThis.Error();
    setStackTraceLimit(prevLimit);
  }
  if (nameFirst) {
    return (body, ...pipeables) => makeFn(name, body, defError, pipeables, nameFirst, spanOptions);
  }
  return makeFn(name, arguments[0], defError, Array.prototype.slice.call(arguments, 1), nameFirst, spanOptions);
};
var makeFn = (name, bodyOrOptions, defError, pipeables, addSpan, spanOptions) => {
  const body = typeof bodyOrOptions === "function" ? bodyOrOptions : pipeables.shift().bind(bodyOrOptions.self);
  const definitionName = `${name} (definition)`;
  const definitionStack = defError ? fnStackCleaner(() => defError.stack) : constUndefined;
  return defineFunctionLength(body.length, function(...args2) {
    let result3 = suspend(() => {
      const iter = body.apply(this, arguments);
      return isEffect(iter) ? iter : fromIteratorUnsafe(iter);
    });
    for (let i = 0; i < pipeables.length; i++) {
      result3 = pipeables[i](result3, ...args2);
    }
    if (!isEffect(result3)) {
      return result3;
    }
    const prevLimit = getStackTraceLimit();
    let callError;
    if (prevLimit !== 0) {
      setStackTraceLimit(2);
      callError = new globalThis.Error();
      setStackTraceLimit(prevLimit);
    }
    return updateService(addSpan ? useSpan(name, spanOptions, (span) => provideParentSpan(result3, span)) : result3, CurrentStackFrame, (prev) => ({
      name,
      stack: callError ? fnStackCleaner(() => callError.stack) : constUndefined,
      parent: {
        name: definitionName,
        stack: definitionStack,
        parent: prev
      }
    }));
  });
};
var fnUntracedEager = (body, ...pipeables) => defineFunctionLength(body.length, pipeables.length === 0 ? function() {
  return fromIteratorEagerUnsafe(() => body.apply(this, arguments));
} : function() {
  let effect = fromIteratorEagerUnsafe(() => body.apply(this, arguments));
  for (const pipeable of pipeables) {
    effect = pipeable(effect, ...arguments);
  }
  return effect;
});
var fromIteratorEagerUnsafe = (evaluate2) => {
  try {
    const iterator = evaluate2();
    let value3 = void 0;
    while (true) {
      const state = iterator.next(value3);
      if (state.done) {
        return succeed3(state.value);
      }
      const primitive = state.value;
      if (primitive && primitive._tag === "Success") {
        value3 = primitive.value;
        continue;
      } else if (primitive && primitive._tag === "Failure") {
        return state.value;
      } else {
        let isFirstExecution = true;
        return suspend(() => {
          if (isFirstExecution) {
            isFirstExecution = false;
            return flatMap3(state.value, (value4) => fromIteratorUnsafe(iterator, value4));
          } else {
            return suspend(() => fromIteratorUnsafe(evaluate2()));
          }
        });
      }
    }
  } catch (error) {
    return die(error);
  }
};
var fromIteratorUnsafe = /* @__PURE__ */ (function() {
  const Proto8 = /* @__PURE__ */ makePrimitiveProto({
    op: "Iterator",
    [contA](value3, fiber3) {
      const iter = this.iterator;
      while (true) {
        const state = iter.next(value3);
        if (state.done) return succeed3(state.value);
        if (!effectIsExit(state.value)) {
          fiber3._stack.push(this);
          return state.value;
        } else if (state.value._tag === "Failure") {
          return state.value;
        }
        value3 = state.value.value;
      }
    },
    [evaluate](fiber3) {
      return this[contA](this.initial, fiber3);
    }
  });
  const IteratorImpl = function(iterator, initial) {
    this.iterator = iterator;
    this.initial = initial;
  };
  IteratorImpl.prototype = Proto8;
  return function(iterator, initial) {
    return new IteratorImpl(iterator, initial);
  };
})();
var as = /* @__PURE__ */ dual(2, (self, value3) => new ContImpl(self, returnPayload, succeed3(value3)));
var evaluateCont = function(fiber3) {
  fiber3._stack.push(this);
  return this[args];
};
var OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccess",
  [evaluate]: evaluateCont
});
var ContImpl = function(self, cont, payload) {
  this[args] = self;
  this[contA] = cont;
  this.payload = payload;
};
ContImpl.prototype = OnSuccessProto;
var returnPayload = function() {
  return this.payload;
};
var succeedPayload = function(_value, fiber3) {
  return fiber3.succeedWith(this.payload);
};
var continuationMarksStack = /* @__PURE__ */ (() => {
  const limit = /* @__PURE__ */ getStackTraceLimit();
  if (limit === 0) return false;
  const marker = "~effect/Effect/stackProbe";
  const probe = {
    [marker]: function stackProbe() {
      return new Error();
    }
  };
  setStackTraceLimit(1);
  const error = /* @__PURE__ */ probe[marker]();
  setStackTraceLimit(limit);
  return error.stack?.includes("[as " + marker + "]") === true;
})();
var mapCont = function(value3, fiber3) {
  const f = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? f(value3) : internalCall(() => f(value3)));
};
var andThenCont = function(value3) {
  const f = this.payload;
  return f(value3);
};
var tapCont = function(value3) {
  const f = this.payload;
  return new ContImpl(f(value3), succeedPayload, value3);
};
var tapEffectCont = function(value3) {
  return new ContImpl(this.payload, succeedPayload, value3);
};
var asSome = (self) => map5(self, some2);
var flip2 = (self) => matchEffect(self, {
  onFailure: succeed3,
  onSuccess: fail3
});
var andThen2 = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, isEffect(f) ? returnPayload : andThenCont, f));
var tap2 = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, isEffect(f) ? tapEffectCont : tapCont, f));
var asVoid = (self) => new ContImpl(self, returnPayload, exitVoid);
var sandbox = (self) => catchCause(self, fail3);
var raceAll = (all4, options) => withFiber((parent) => {
  const fibers = /* @__PURE__ */ new Set();
  onExitUnsafe(parent, () => fibers.size === 0 ? void 0 : fiberInterruptAll(fibers));
  return callback((resume) => {
    const effects = fromIterable(all4);
    const len = effects.length;
    let doneCount = 0;
    let done3 = false;
    const failures = [];
    const onExit3 = (exit3, fiber3, i) => {
      doneCount++;
      if (exit3._tag === "Failure") {
        failures.push(...exit3.cause.reasons);
        if (doneCount >= len) {
          resume(failCause(causeElectDefects(causeFromReasons(failures))));
        }
        return;
      }
      const isWinner = !done3;
      done3 = true;
      resume(exit3);
      if (isWinner && options?.onWinner) {
        options.onWinner({
          fiber: fiber3,
          index: i,
          parentFiber: parent
        });
      }
    };
    for (let i = 0; i < len; i++) {
      const fiber3 = forkUnsafe(parent, effects[i], true, true, false);
      fibers.add(fiber3);
      fiber3.addObserver((exit3) => {
        fibers.delete(fiber3);
        onExit3(exit3, fiber3, i);
      });
      if (done3) break;
    }
  });
});
var raceAllFirst = (all4, options) => withFiber((parent) => {
  const fibers = /* @__PURE__ */ new Set();
  onExitUnsafe(parent, () => fibers.size === 0 ? void 0 : fiberInterruptAll(fibers));
  return callback((resume) => {
    let done3 = false;
    let i = 0;
    for (const effect of all4) {
      if (done3) break;
      const index2 = i++;
      const fiber3 = forkUnsafe(parent, effect, true, true, false);
      fibers.add(fiber3);
      fiber3.addObserver((exit3) => {
        fibers.delete(fiber3);
        const isWinner = !done3;
        done3 = true;
        resume(exit3);
        if (isWinner && options?.onWinner) {
          options.onWinner({
            fiber: fiber3,
            index: index2,
            parentFiber: parent
          });
        }
      });
    }
  });
});
var race = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAll([self, that], options));
var raceFirst = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => raceAllFirst([self, that], options));
var flatMap3 = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, andThenCont, f));
var matchCauseEffectEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? options.onSuccess(self.value) : options.onFailure(self.cause);
  }
  return matchCauseEffect(self, options);
});
var effectIsExit = (effect) => effect[ExitTypeId] !== void 0;
var flatMapEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    return self._tag === "Success" ? f(self.value) : self;
  }
  return flatMap3(self, f);
});
var flatten3 = (self) => flatMap3(self, identity);
var map5 = /* @__PURE__ */ dual(2, (self, f) => new ContImpl(self, mapCont, f));
var mapEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMap(self, f) : map5(self, f));
var mapErrorEager = /* @__PURE__ */ dual(2, (self, f) => effectIsExit(self) ? exitMapError(self, f) : mapError2(self, f));
var mapBothEager = /* @__PURE__ */ dual(2, (self, options) => effectIsExit(self) ? exitMapBoth(self, options) : mapBoth2(self, options));
var catchEager = /* @__PURE__ */ dual(2, (self, f) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success") return self;
    const error = findRecoverableError(self.cause);
    if (isFailure2(error)) return exitFailCause(error.failure);
    return f(error.success);
  }
  return catch_(self, f);
});
var exitInterrupt = (fiberId3) => exitFailCause(causeInterrupt(fiberId3));
var exitIsSuccess = (self) => self._tag === "Success";
var exitIsFailure = (self) => self._tag === "Failure";
var exitFilterCause = (self) => self._tag === "Failure" ? succeed2(self.cause) : fail2(self);
var exitHasInterrupts = (self) => self._tag === "Failure" && hasInterrupts(self.cause);
var exitVoid = /* @__PURE__ */ exitSucceed(void 0);
var exitMap = /* @__PURE__ */ dual(2, (self, f) => self._tag === "Success" ? exitSucceed(f(self.value)) : self);
var exitMapError = /* @__PURE__ */ dual(2, (self, f) => {
  if (self._tag === "Success") return self;
  return exitFailCause(causeMap(self.cause, f));
});
var exitMapBoth = /* @__PURE__ */ dual(2, (self, options) => {
  if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
  return exitFailCause(causeMap(self.cause, options.onFailure));
});
var exitAsVoidAll = (exits) => {
  const failures = [];
  for (const exit3 of exits) {
    if (exit3._tag === "Failure") {
      failures.push(...exit3.cause.reasons);
    }
  }
  return failures.length === 0 ? exitVoid : exitFailCause(causeFromReasons(failures));
};
var service = (service3) => service3;
var serviceOption = (service3) => withFiber((fiber3) => succeed3(getOption(fiber3.context, service3)));
var serviceOptional = (service3) => withFiber((fiber3) => fromOption3(getOption(fiber3.context, service3)));
var updateContext = /* @__PURE__ */ dual(2, (self, f) => withFiber((fiber3) => {
  const prevContext = fiber3.context;
  const nextContext = f(prevContext);
  if (prevContext === nextContext) return self;
  fiber3.setContext(nextContext);
  onExitUnsafe(fiber3, () => {
    fiber3.setContext(prevContext);
    return void 0;
  });
  return self;
}));
var updateService = /* @__PURE__ */ dual(3, (self, service3, f) => updateContext(self, (s) => {
  const prev = getUnsafe(s, service3);
  const next = f(prev);
  if (prev === next) return s;
  return add(s, service3, next);
}));
var updateServiceScoped = (service3, update3, options) => uninterruptible(withFiber((fiber3) => {
  const original = getUnsafe(fiber3.context, service3);
  const updated = update3(original);
  fiber3.setContext(add(fiber3.context, service3, updated));
  return scopeAddFinalizerExit(getUnsafe(fiber3.context, scopeTag), (_) => {
    const currentOption = getOption(fiber3.context, service3);
    if (isNone2(currentOption)) return void_2;
    const current = currentOption.value;
    let next;
    if (options?.reset === void 0) {
      if (current !== updated) return void_2;
      next = original;
    } else {
      next = options.reset(original, updated, current);
    }
    fiber3.setContext(add(fiber3.context, service3, next));
    return void_2;
  });
}));
var context = () => getContext;
var getContext = /* @__PURE__ */ withFiber((fiber3) => succeed3(fiber3.context));
var contextWith = (f) => withFiber((fiber3) => f(fiber3.context));
var setContext = /* @__PURE__ */ dual(2, (self, context3) => updateContext(self, constant(context3)));
var provideContext = /* @__PURE__ */ dual(2, (self, context3) => {
  if (effectIsExit(self)) return self;
  return updateContext(self, merge(context3));
});
var provideService = function() {
  if (arguments.length === 1) {
    return dual(2, (self, impl) => provideServiceImpl(self, arguments[0], impl));
  }
  return dual(3, (self, service3, impl) => provideServiceImpl(self, service3, impl)).apply(this, arguments);
};
var provideServiceImpl = (self, service3, implementation) => updateContext(self, add(service3, implementation));
var provideServiceEffect = /* @__PURE__ */ dual(3, (self, service3, acquire) => flatMap3(acquire, (implementation) => provideService(self, service3, implementation)));
var zip = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, options) => zipWith(self, that, (a, a2) => [a, a2], options));
var zipWith = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self, that, f, options) => options?.concurrent ? map5(all2([self, that], {
  concurrency: 2
}), ([a, a2]) => f(a, a2)) : flatMap3(self, (a) => map5(that, (a2) => f(a, a2))));
var filterOrFail2 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, orFailWith) => filterOrElse(self, predicate, orFailWith ? (a) => fail3(orFailWith(a)) : () => fail3(new NoSuchElementError())));
var when = /* @__PURE__ */ dual(2, (self, condition) => flatMap3(condition, (pass) => pass ? asSome(self) : succeedNone2));
var replicate = /* @__PURE__ */ dual(2, (self, n) => Array.from({
  length: n
}, () => self));
var replicateEffect = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, n, options) => all2(replicate(self, n), options));
var forever = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => whileLoop({
  while: constTrue,
  body: constant(options?.disableYield ? self : flatMap3(self, (_) => yieldNow)),
  step: constVoid
}));
var catchCause = /* @__PURE__ */ dual(2, (self, f) => new OnFailureImpl(self, f.length !== 1 ? (cause) => f(cause) : f));
var OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnFailure",
  [evaluate]: evaluateCont
});
var OnFailureImpl = function(self, f) {
  this[args] = self;
  this[contE] = f;
};
OnFailureImpl.prototype = OnFailureProto;
var catchCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCause(self, (cause) => {
  if (!predicate(cause)) {
    return failCause(cause);
  }
  return f(cause);
}));
var catchCauseFilter = /* @__PURE__ */ dual(3, (self, filter8, f) => catchCause(self, (cause) => {
  const eb = filter8(cause);
  return isFailure2(eb) ? failCause(eb.failure) : f(eb.success, cause);
}));
var catch_ = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findRecoverableError, (e) => f(e)));
var catchNoSuchElement = (self) => matchEffect(self, {
  onFailure: (error) => isNoSuchElementError(error) ? succeedNone2 : fail3(error),
  onSuccess: succeedSome2
});
var catchDefect = /* @__PURE__ */ dual(2, (self, f) => catchCauseFilter(self, findDefect, f));
var tapCause = /* @__PURE__ */ dual(2, (self, f) => catchCause(self, (cause) => andThen2(f(cause), failCause(cause))));
var tapCauseIf = /* @__PURE__ */ dual(3, (self, predicate, f) => catchCauseIf(self, predicate, (cause) => andThen2(f(cause), failCause(cause))));
var tapCauseFilter = /* @__PURE__ */ dual(3, (self, filter8, f) => catchCause(self, (cause) => {
  const result3 = filter8(cause);
  if (isFailure2(result3)) {
    return failCause(cause);
  }
  return andThen2(f(result3.success, cause), failCause(cause));
}));
var tapError = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findError, (e) => f(e)));
var tapErrorTag = /* @__PURE__ */ dual(3, (self, k, f) => {
  const predicate = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return tapError(self, (error) => predicate(error) ? f(error) : void_2);
});
var tapDefect = /* @__PURE__ */ dual(2, (self, f) => tapCauseFilter(self, findDefect, (_) => f(_)));
var catchIf = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, predicate, f, orElse2) => catchCause(self, (cause) => {
  const error = findRecoverableError(cause);
  if (isFailure2(error)) return failCause(error.failure);
  if (!predicate(error.success)) {
    return orElse2 ? orElse2(error.success) : failCause(cause);
  }
  return f(error.success);
}));
var catchFilter = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter8, f, orElse2) => catchCause(self, (cause) => {
  const error = findRecoverableError(cause);
  if (isFailure2(error)) return failCause(error.failure);
  const result3 = filter8(error.success);
  if (isFailure2(result3)) {
    return orElse2 ? orElse2(result3.failure) : failCause(cause);
  }
  return f(result3.success);
}));
var catchTag = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, k, f, orElse2) => {
  const pred = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return catchIf(self, pred, f, orElse2);
});
var catchTags = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, cases, orElse2) => {
  let keys3;
  return catchFilter(self, (e) => {
    keys3 ??= Object.keys(cases);
    return hasProperty(e, "_tag") && isString(e["_tag"]) && keys3.includes(e["_tag"]) ? succeed2(e) : fail2(e);
  }, (e) => cases[e["_tag"]](e), orElse2);
});
var catchReason = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, reasonTag, f, orElse2) => catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && (orElse2 !== void 0 || isTagged(e.reason, reasonTag)), (e) => {
  const reason = e.reason;
  if (isTagged(reason, reasonTag)) return f(reason, e);
  return orElse2 ? orElse2(reason, e) : fail3(e);
}));
var catchReasons = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, errorTag, cases, orElse2) => {
  let keys3;
  return catchIf(self, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && hasProperty(e.reason, "_tag") && isString(e.reason._tag) && (orElse2 !== void 0 || (keys3 ??= Object.keys(cases)).includes(e.reason._tag)), (e) => {
    const reason = e.reason;
    keys3 ??= Object.keys(cases);
    if (keys3.includes(reason._tag)) {
      return cases[reason._tag](reason, e);
    }
    return orElse2 ? orElse2(reason, e) : fail3(e);
  });
});
var unwrapReason = /* @__PURE__ */ dual(2, (self, errorTag) => catchFilter(self, (e) => {
  if (isTagged(e, errorTag) && hasProperty(e, "reason")) {
    return succeed2(e.reason);
  }
  return fail2(e);
}, fail3));
var mapError2 = /* @__PURE__ */ dual(2, (self, f) => catchCause(self, (cause) => failCause(causeMap(cause, f))));
var mapBoth2 = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => failCause(causeMap(cause, options.onFailure)),
  onSuccess: (a) => sync(() => options.onSuccess(a))
}));
var orDie = (self) => catch_(self, die);
var orElseSucceed = /* @__PURE__ */ dual(2, (self, f) => catch_(self, (error) => sync(() => f(error))));
var firstSuccessOf = (effects) => suspend(() => {
  const iterator = effects[Symbol.iterator]();
  let state = iterator.next();
  if (state.done) {
    return die(new Error("Received an empty collection of effects"));
  }
  function loop(current) {
    const next = iterator.next();
    if (next.done) return current.value;
    return catch_(current.value, (_) => loop(next));
  }
  return loop(state);
});
var eventually = (self) => catch_(self, (_) => flatMap3(yieldNow, () => eventually(self)));
var ignore = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
  if (!options?.log) {
    return matchEffect(self, {
      onFailure: (_) => void_2,
      onSuccess: (_) => void_2
    });
  }
  const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
  return matchCauseEffect(self, {
    onFailure(cause) {
      const error = findRecoverableError(cause);
      return isFailure2(error) ? failCause(error.failure) : options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause);
    },
    onSuccess: (_) => void_2
  });
});
var ignoreCause = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => {
  if (!options?.log) {
    return matchCauseEffect(self, {
      onFailure: (_) => void_2,
      onSuccess: (_) => void_2
    });
  }
  const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
  return matchCauseEffect(self, {
    onFailure: (cause) => options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause),
    onSuccess: (_) => void_2
  });
});
var option = (self) => match4(self, {
  onFailure: none2,
  onSuccess: some2
});
var result = (self) => matchEager(self, {
  onFailure: fail2,
  onSuccess: succeed2
});
var matchCauseEffect = /* @__PURE__ */ dual(2, (self, options) => new OnSuccessAndFailureImpl(self, options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess, options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure));
var OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate]: evaluateCont
});
var OnSuccessAndFailureImpl = function(self, onSuccess, onFailure) {
  this[args] = self;
  this[contA] = onSuccess;
  this[contE] = onFailure;
};
OnSuccessAndFailureImpl.prototype = OnSuccessAndFailureProto;
var matchSuccess = function(value3, fiber3) {
  const handlers = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? handlers.onSuccess(value3) : internalCall(() => handlers.onSuccess(value3)));
};
var makeMatch = (op, onFailure) => {
  const Proto8 = makePrimitiveProto({
    op,
    [evaluate]: evaluateCont,
    [contA]: matchSuccess,
    [contE]: onFailure
  });
  const MatchImpl2 = function(self, handlers) {
    this[args] = self;
    this.payload = handlers;
  };
  MatchImpl2.prototype = Proto8;
  return MatchImpl2;
};
var MatchImpl = /* @__PURE__ */ makeMatch("Match", function(cause, fiber3) {
  const error = findRecoverableError(cause);
  if (isFailure2(error)) return failCause(error.failure);
  const handlers = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? handlers.onFailure(error.success) : internalCall(() => handlers.onFailure(error.success)));
});
var MatchCauseImpl = /* @__PURE__ */ makeMatch("MatchCause", function(cause, fiber3) {
  const handlers = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? handlers.onFailure(cause) : internalCall(() => handlers.onFailure(cause)));
});
var matchCause = /* @__PURE__ */ dual(2, (self, options) => new MatchCauseImpl(self, options));
var matchEffect = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onFailure: (cause) => {
    const error = findRecoverableError(cause);
    return isFailure2(error) ? failCause(error.failure) : options.onFailure(error.success);
  },
  onSuccess: options.onSuccess
}));
var match4 = /* @__PURE__ */ dual(2, (self, options) => new MatchImpl(self, options));
var matchEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
    const error = findRecoverableError(self.cause);
    if (isFailure2(error)) return exitFailCause(error.failure);
    return exitSucceed(options.onFailure(error.success));
  }
  return match4(self, options);
});
var matchCauseEager = /* @__PURE__ */ dual(2, (self, options) => {
  if (effectIsExit(self)) {
    if (self._tag === "Success") return exitSucceed(options.onSuccess(self.value));
    return exitSucceed(options.onFailure(self.cause));
  }
  return matchCause(self, options);
});
var exit = (self) => effectIsExit(self) ? exitSucceed(self) : exitPrimitive(self);
var exitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "Exit",
  [evaluate](fiber3) {
    fiber3._stack.push(this);
    return this[args];
  },
  [contA](value3, fiber3, exit3) {
    return fiber3.succeedWith(exit3 ?? exitSucceed(value3));
  },
  [contE](cause, fiber3, exit3) {
    return fiber3.succeedWith(exit3 ?? exitFailCause(cause));
  }
});
var isFailure3 = /* @__PURE__ */ matchEager({
  onFailure: () => true,
  onSuccess: () => false
});
var isSuccess3 = /* @__PURE__ */ matchEager({
  onFailure: () => false,
  onSuccess: () => true
});
var delay = /* @__PURE__ */ dual(2, (self, duration) => andThen2(sleep(duration), self));
var timeoutOrElse = /* @__PURE__ */ dual(2, (self, options) => flatMap3(timeoutOption(self, options.duration), (option3) => isNone2(option3) ? options.orElse() : succeed3(option3.value)));
var timeoutErrorFromDuration = (duration) => new TimeoutError(`Operation timed out after '${format2(duration)}'`);
var timeout = /* @__PURE__ */ dual(2, (self, duration) => {
  const decoded = fromInputUnsafe(duration);
  return timeoutOrElse(self, {
    duration: decoded,
    orElse: () => fail3(timeoutErrorFromDuration(decoded))
  });
});
var timeoutOption = /* @__PURE__ */ dual(2, (self, duration) => raceFirst(asSome(self), as(sleep(duration), none2())));
var timed = (self) => clockWith((clock) => {
  const start = clock.monotonicTimeNanosUnsafe();
  return map5(self, (a) => [nanos(clock.monotonicTimeNanosUnsafe() - start), a]);
});
var ScopeTypeId = "~effect/Scope";
var ScopeCloseableTypeId = "~effect/Scope/Closeable";
var scopeTag = /* @__PURE__ */ Service("effect/Scope");
var scopeClose = (self, exit_) => withFiber((fiber3) => {
  fiberEnterUninterruptibleUnsafe(fiber3);
  return scopeCloseUnsafe(self, exit_) ?? void_2;
});
var scopeCloseUnsafe = (self, exit_) => {
  const state = self.state;
  if (state._tag === "Closed") return;
  self.state = {
    _tag: "Closed",
    exit: exit_
  };
  if (self.parent !== void 0) {
    scopeRemoveFinalizerUnsafe(self.parent, self);
  }
  if (state._tag === "Empty") return;
  if (state.finalizer !== void 0) {
    return runFinalizer(state.finalizer, exit_);
  }
  const finalizers = state.finalizers;
  if (finalizers.size === 1) {
    return runFinalizer(finalizers.values().next().value, exit_);
  }
  return scopeCloseFinalizers(self, finalizers, exit_);
};
var runFinalizer = (finalizer, exit_) => {
  try {
    return finalizer(exit_);
  } catch (defect) {
    return exitDie(defect);
  }
};
var combineFinalizerCause = (exit_, finalizer) => exitIsSuccess(exit_) ? finalizer : catchCause(finalizer, (cause) => failCause(causeElectDefects(causeCombine(exit_.cause, cause))));
var scopeCloseFinalizers = /* @__PURE__ */ fnUntraced(function* (self, finalizers, exit_) {
  let exits = [];
  const fibers = [];
  const arr = Array.from(finalizers);
  const parent = getCurrentFiber();
  for (let i = arr.length - 1; i >= 0; i--) {
    const [key, finalizer] = arr[i];
    if (self.strategy === "sequential") {
      exits.push(yield* exit(runFinalizer(finalizer, exit_)));
    } else if (key !== parent) {
      fibers.push(forkUnsafe(parent, runFinalizer(finalizer, exit_), true, true, "inherit"));
    }
  }
  if (fibers.length > 0) {
    exits = yield* fiberAwaitAll(fibers);
  }
  return yield* exitAsVoidAll(exits);
});
var scopeForkUnsafe = (scope3, finalizerStrategy) => {
  const child = makeScope(finalizerStrategy, scope3);
  if (scope3.state._tag === "Closed") {
    child.state = scope3.state;
    return child;
  }
  scopeAddFinalizerUnsafe(scope3, child, (exit3) => scopeClose(child, exit3));
  return child;
};
var scopeAddFinalizerExit = (scope3, finalizer) => {
  return suspend(() => {
    if (scope3.state._tag === "Closed") {
      return finalizer(scope3.state.exit);
    }
    scopeAddFinalizerUnsafe(scope3, {}, finalizer);
    return void_2;
  });
};
var scopeAddFinalizerUnsafe = (scope3, key, finalizer) => {
  if (scope3.state._tag === "Empty") {
    scope3.state = {
      _tag: "Open",
      finalizerKey: key,
      finalizer,
      finalizers: void 0
    };
  } else if (scope3.state._tag === "Open") {
    const state = scope3.state;
    if (state.finalizer !== void 0) {
      state.finalizers = /* @__PURE__ */ new Map([[state.finalizerKey, state.finalizer]]);
      state.finalizerKey = void 0;
      state.finalizer = void 0;
      state.finalizers.set(key, finalizer);
    } else {
      state.finalizers.set(key, finalizer);
    }
  }
};
var scopeRemoveFinalizerUnsafe = (scope3, key) => {
  if (scope3.state._tag !== "Open") return;
  const state = scope3.state;
  if (state.finalizerKey === key) {
    scope3.state = constScopeEmpty;
  } else if (state.finalizers !== void 0) {
    state.finalizers.delete(key);
    if (state.finalizers.size === 0) {
      scope3.state = constScopeEmpty;
    }
  }
};
var scopeMakeUnsafe = (finalizerStrategy) => makeScope(finalizerStrategy, void 0);
var makeScope = (finalizerStrategy = "sequential", parent) => ({
  [ScopeCloseableTypeId]: ScopeCloseableTypeId,
  [ScopeTypeId]: ScopeTypeId,
  strategy: finalizerStrategy,
  parent,
  state: constScopeEmpty
});
var constScopeEmpty = {
  _tag: "Empty"
};
var scope = scopeTag;
var scoped = (self) => withFiber((fiber3) => {
  const prev = fiber3.context;
  const scope3 = scopeMakeUnsafe();
  fiber3.setContext(add(fiber3.context, scopeTag, scope3));
  onExitUnsafe(fiber3, (exit3) => {
    fiber3.setContext(prev);
    return scopeCloseUnsafe(scope3, exit3);
  });
  return self;
});
var scopedWith = (f) => suspend(() => {
  const scope3 = scopeMakeUnsafe();
  return onExit(f(scope3), (exit3) => suspend(() => scopeCloseUnsafe(scope3, exit3) ?? void_2));
});
var acquireRelease = (acquire, release, options) => contextWith((context3) => uninterruptibleMask((restore) => flatMap3(scope, (scope3) => tap2(options?.interruptible ? restore(acquire) : acquire, (a) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(release(a, exit3), context3))))));
var addFinalizer = (finalizer) => flatMap3(scope, (scope3) => contextWith((context3) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(finalizer(exit3), context3))));
var OnExitImpl = /* @__PURE__ */ (function() {
  const Proto8 = /* @__PURE__ */ makePrimitiveProto({
    op: "OnExit",
    [evaluate](fiber3) {
      fiber3._stack.push(this);
      return this.effect;
    },
    [contAll](fiber3) {
      if (fiber3.interruptible && this.interruptible !== true) {
        fiber3._stack.push(setInterruptibleTrue);
        fiber3.interruptible = false;
      }
    },
    [contA](value3, _, exit3) {
      exit3 ??= exitSucceed(value3);
      let eff;
      try {
        eff = this.onExit(exit3);
      } catch (defect) {
        eff = exitDie(defect);
      }
      return eff ? flatMap3(eff, (_2) => exit3) : exit3;
    },
    [contE](cause, _, exit3) {
      exit3 ??= exitFailCause(cause);
      let eff;
      try {
        eff = this.onExit(exit3);
      } catch (defect) {
        eff = exitDie(defect);
      }
      return eff ? flatMap3(combineFinalizerCause(exit3, eff), (_2) => exit3) : exit3;
    }
  });
  const OnExitImpl2 = function(effect, onExit3, interruptible3) {
    this.effect = effect;
    this.onExit = onExit3;
    this.interruptible = interruptible3;
  };
  OnExitImpl2.prototype = Proto8;
  return OnExitImpl2;
})();
var onExitPrimitive = (effect, onExit3, interruptible3) => new OnExitImpl(effect, onExit3, interruptible3);
var onExitUnsafe = (fiber3, f) => {
  ;
  fiber3._stack.push(new OnExitImpl(void 0, f, void 0));
};
var onExit = /* @__PURE__ */ dual(2, onExitPrimitive);
var ensuring = /* @__PURE__ */ dual(2, (self, finalizer) => onExit(self, (_) => finalizer));
var onExitIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExit(self, (exit3) => {
  if (!predicate(exit3)) {
    return void_2;
  }
  return f(exit3);
}));
var onExitFilter = /* @__PURE__ */ dual(3, (self, filter8, f) => onExit(self, (exit3) => {
  const b = filter8(exit3);
  return isFailure2(b) ? void_2 : f(b.success, exit3);
}));
var onError = /* @__PURE__ */ dual(2, (self, f) => onExitFilter(self, exitFilterCause, f));
var onErrorIf = /* @__PURE__ */ dual(3, (self, predicate, f) => onExitIf(self, (exit3) => {
  if (exit3._tag !== "Failure") {
    return false;
  }
  return predicate(exit3.cause);
}, (exit3) => f(exit3.cause)));
var onErrorFilter = /* @__PURE__ */ dual(3, (self, filter8, f) => onExit(self, (exit3) => {
  if (exit3._tag !== "Failure") {
    return void_2;
  }
  const result3 = filter8(exit3.cause);
  return isFailure2(result3) ? void_2 : f(result3.success, exit3.cause);
}));
var onInterrupt = /* @__PURE__ */ dual(2, (self, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self));
var acquireUseRelease = (acquire, use, release) => uninterruptibleMask((restore) => flatMap3(acquire, (a) => onExitPrimitive(suspend(() => restore(use(a))), (exit3) => release(a, exit3), true)));
var acquireDisposable = (acquire) => acquireRelease(acquire, (resource) => hasProperty(resource, Symbol.asyncDispose) ? promise(() => resource[Symbol.asyncDispose]()) : sync(() => resource[Symbol.dispose]()));
var cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self, ttl) => sync(() => makeCachedUnsafe(self, typeof ttl === "function" ? (exit3) => toMillis(fromInputUnsafe(ttl(exit3))) : constant(toMillis(fromInputUnsafe(ttl))))));
var infiniteTTL = /* @__PURE__ */ constant(Infinity);
var makeCachedUnsafe = (self, ttlMillis) => {
  let expiresAt = 0;
  let exit3;
  let current;
  const join = (fiber3, run2) => {
    run2.awaiters++;
    onExitUnsafe(fiber3, () => {
      if (--run2.awaiters > 0 || run2.done) return;
      if (current === run2) current = void 0;
      return fiberInterrupt(run2.fiber);
    });
    return fiberJoin(run2.fiber);
  };
  return [withFiber((fiber3) => {
    if (current !== void 0) {
      return fiber3 === current.fiber ? fiberJoin(current.fiber) : join(fiber3, current);
    }
    if (exit3 !== void 0 && (expiresAt === Infinity || fiber3.getRef(ClockRef).currentTimeMillisUnsafe() < expiresAt)) {
      return exit3;
    }
    exit3 = void 0;
    const clock = fiber3.getRef(ClockRef);
    const run2 = {
      fiber: new FiberImpl(fiber3.context),
      awaiters: 0,
      done: false
    };
    current = run2;
    const joined = join(fiber3, run2);
    run2.fiber.evaluate(onExitPrimitive(self, (exit_) => {
      run2.done = true;
      if (current !== run2) return;
      current = void 0;
      if (exitHasInterrupts(exit_)) return;
      const duration = ttlMillis(exit_);
      expiresAt = duration === Infinity ? Infinity : clock.currentTimeMillisUnsafe() + duration;
      exit3 = exit_;
    }));
    return run2.fiber._exit ?? joined;
  }), sync(() => {
    current = void 0;
    exit3 = void 0;
  })];
};
var cachedWithTTL = /* @__PURE__ */ dual(2, (self, timeToLive) => map5(cachedInvalidateWithTTL(self, timeToLive), (tuple2) => tuple2[0]));
var cached = (self) => sync(() => makeCachedUnsafe(self, infiniteTTL)[0]);
var interrupt = /* @__PURE__ */ withFiber((fiber3) => failCause(causeInterrupt(fiber3.id)));
var uninterruptible = (self) => withFiber((fiber3) => {
  if (!fiber3.interruptible) return self;
  fiber3.interruptible = false;
  fiber3._stack.push(setInterruptibleTrue);
  return self;
});
var setInterruptible = /* @__PURE__ */ makePrimitive({
  op: "SetInterruptible",
  [contAll](fiber3) {
    fiber3.interruptible = this[args];
    if (fiber3._interruptedCause && fiber3.interruptible) {
      return () => failCause(fiber3._interruptedCause);
    }
  }
});
var setInterruptibleTrue = /* @__PURE__ */ setInterruptible(true);
var setInterruptibleFalse = /* @__PURE__ */ setInterruptible(false);
var setFiberInterruptible = (fiber3) => {
  fiber3.interruptible = true;
  fiber3._stack.push(setInterruptibleFalse);
  if (fiber3._interruptedCause) return failCause(fiber3._interruptedCause);
};
var fiberEnterUninterruptibleUnsafe = (fiber3) => {
  const impl = fiber3;
  if (!impl.interruptible) return;
  impl.interruptible = false;
  impl._stack.push(setInterruptibleTrue);
};
var interruptible = (self) => withFiber((fiber3) => {
  if (fiber3.interruptible) return self;
  return setFiberInterruptible(fiber3) ?? self;
});
var uninterruptibleMask = (f) => withFiber((fiber3) => {
  if (!fiber3.interruptible) return f(identity);
  fiber3.interruptible = false;
  fiber3._stack.push(setInterruptibleTrue);
  return f(interruptible);
});
var interruptibleMask = (f) => withFiber((fiber3) => {
  if (fiber3.interruptible) return f(identity);
  const interrupted = setFiberInterruptible(fiber3);
  const effect = f(uninterruptible);
  return interrupted ?? effect;
});
var abortSignal = /* @__PURE__ */ map5(/* @__PURE__ */ acquireRelease(/* @__PURE__ */ sync(() => new AbortController()), (controller) => sync(() => controller.abort())), (_) => _.signal);
var all2 = (arg, options) => {
  if (isIterable(arg)) {
    return options?.mode === "result" ? forEach(arg, result, options) : forEach(arg, identity, options);
  } else if (options?.discard) {
    return options.mode === "result" ? forEach(Object.values(arg), result, options) : forEach(Object.values(arg), identity, options);
  }
  return suspend(() => map5(forEach(Object.entries(arg), ([key, effect]) => map5(options?.mode === "result" ? result(effect) : effect, (value3) => [key, value3]), {
    concurrency: options?.concurrency
  }), Object.fromEntries));
};
var partition2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => map5(forEach(elements, (a, i) => result(f(a, i)), options), (results2) => partition(results2, identity)));
var reduce = /* @__PURE__ */ dual(3, (elements, zero3, f) => {
  const arr = fromIterable(elements);
  if (arr.length === 0) return sync(zero3);
  return suspend(() => {
    let index2 = 0;
    let state = zero3();
    return map5(whileLoop({
      while: () => index2 < arr.length,
      body: () => f(state, arr[index2], index2),
      step(next) {
        state = next;
        index2++;
      }
    }), () => state);
  });
});
var validate = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => flatMap3(partition2(elements, f, {
  concurrency: options?.concurrency
}), ([passes, fails]) => {
  if (isArrayNonEmpty2(fails)) {
    return fail3(fails);
  }
  return options?.discard ? void_2 : succeed3(passes);
}));
var findFirst3 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, 0, predicate, next.value);
  }
  return succeed3(none2());
}));
var findFirstLoop = (iterator, index2, predicate, value3) => flatMap3(predicate(value3, index2), (keep) => {
  if (keep) {
    return succeed3(some2(value3));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, index2 + 1, predicate, next.value);
  }
  return succeed3(none2());
});
var findFirstFilter = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter8) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, 0, filter8, next.value);
  }
  return succeed3(none2());
}));
var findFirstFilterLoop = (iterator, index2, filter8, value3) => flatMap3(filter8(value3, index2), (result3) => {
  if (isSuccess2(result3)) {
    return succeed3(some2(result3.success));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, index2 + 1, filter8, next.value);
  }
  return succeed3(none2());
});
var whileLoop = /* @__PURE__ */ makePrimitive({
  op: "While",
  [contA](value3, fiber3) {
    this[args].step(value3);
    if (this[args].while()) {
      fiber3._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  },
  [evaluate](fiber3) {
    if (this[args].while()) {
      fiber3._stack.push(this);
      return this[args].body();
    }
    return exitVoid;
  }
});
var forEach = /* @__PURE__ */ dual((args2) => typeof args2[1] === "function", (iterable, f, options) => suspend(() => {
  const concurrency = resolveConcurrency(options?.concurrency);
  if (concurrency === 1) {
    return forEachSequential(iterable, f, options);
  }
  const items = fromIterable(iterable);
  let length = items.length;
  if (length === 0) {
    return options?.discard ? void_2 : succeed3([]);
  }
  const out = options?.discard ? void 0 : new Array(length);
  const eff = forEachConcurrent({
    f,
    out
  }, items, {
    concurrency
  });
  return eff ? as(eff, out) : succeed3(out);
}));
var head = (self) => flatMap3(self, (elements) => {
  const result3 = elements[Symbol.iterator]().next();
  return result3.done ? fail3(new NoSuchElementError()) : succeed3(result3.value);
});
var forEachSequential = (iterable, f, options) => suspend(() => {
  const out = options?.discard ? void 0 : [];
  const iterator = iterable[Symbol.iterator]();
  let state = iterator.next();
  let index2 = 0;
  return as(whileLoop({
    while: () => !state.done,
    body: () => f(state.value, index2++),
    step: (b) => {
      if (out) out.push(b);
      state = iterator.next();
    }
  }), out);
});
var resolveConcurrency = (concurrency) => concurrency === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrency ?? 1);
var iterateEager = () => (options) => {
  const onItem = options.onItem;
  const step = options.step;
  const resumeSequential = (state, items, index2, end, effect) => flatMap3(exit(effect), (itemExit) => step(state, items[index2], itemExit, index2) ?? runSequential(state, items, index2 + 1, end) ?? void_2);
  const runSequential = (state, items, index2 = 0, end = items.length) => {
    for (; index2 < end; index2++) {
      const item = items[index2];
      const effect = onItem(state, item, index2);
      if (!effectIsExit(effect)) {
        return resumeSequential(state, items, index2, end, effect);
      }
      const terminal = step(state, item, effect, index2);
      if (terminal) return terminal._tag === "Failure" ? terminal : void 0;
    }
  };
  return runSequential;
};
var iterateConcurrentImpl = (options) => {
  const onItem = options.onItem;
  const step = options.step;
  return (state, items, opts) => {
    let index2 = 0;
    const end = opts.end ?? items.length;
    const concurrency = opts.concurrency;
    let done3 = false;
    let parentFiber;
    let fibers;
    let resume;
    let terminal;
    let effect;
    const failDefect = (error) => {
      const defect = exitDie(error);
      terminal = defect;
      done3 = true;
      return fibers && fibers.size > 0 ? flatMap3(uninterruptible(fiberInterruptAll(Array.from(fibers))), () => terminal ?? defect) : defect;
    };
    const go = () => {
      let paused = false;
      for (; !terminal && index2 < end; index2++) {
        const item = items[index2];
        const eff = effect ?? onItem(state, item, index2);
        if (effectIsExit(eff)) {
          terminal = step(state, item, eff, index2);
          if (terminal) break;
        } else if (!parentFiber) {
          return callback((cb) => {
            parentFiber = getCurrentFiber();
            fibers = /* @__PURE__ */ new Set();
            effect = eff;
            resume = cb;
            let result3;
            try {
              result3 = go();
            } catch (error) {
              return cb(failDefect(error));
            }
            if (result3) return cb(result3);
            return suspend(() => {
              terminal ??= exitVoid;
              return flatMap3(fibers ? fiberInterruptAll(fibers) : void_2, () => terminal?._tag === "Failure" ? terminal : void_2);
            });
          });
        } else {
          effect = void 0;
          const fiber3 = forkUnsafe(parentFiber, eff, true, true, "inherit");
          if (fiber3._exit) {
            terminal = step(state, item, fiber3._exit, index2);
            if (terminal) break;
            continue;
          }
          fibers.add(fiber3);
          const currentIndex = index2;
          fiber3.addObserver((exit3) => {
            fibers.delete(fiber3);
            try {
              if (terminal) {
                if (exit3._tag === "Failure") {
                  const reasons = exit3.cause.reasons.filter((reason) => reason._tag !== "Interrupt");
                  if (reasons.length > 0) {
                    const cause = causeFromReasons(reasons);
                    terminal = exitFailCause(terminal._tag === "Failure" ? causeElectDefects(causeCombine(terminal.cause, cause)) : cause);
                  }
                }
              } else {
                const result3 = step(state, item, exit3, currentIndex);
                if (result3) {
                  terminal = result3;
                  go();
                }
              }
              if (paused) {
                const eff2 = go();
                if (eff2) resume(eff2);
              } else if (done3 && fibers.size === 0) {
                resume(terminal ?? void_2);
              }
            } catch (error) {
              resume(failDefect(error));
            }
          });
          if (fibers.size < concurrency) continue;
          paused = true;
          index2++;
          return;
        }
      }
      done3 = true;
      if (terminal) {
        if (fibers && fibers.size > 0) {
          const annotations = fiberStackAnnotations(parentFiber);
          fibers.forEach((f) => f.interruptUnsafe(parentFiber.id, annotations));
          return;
        }
        if (resume || terminal._tag === "Failure") {
          return terminal;
        }
      } else if (resume) {
        if (!fibers) {
          return exitVoid;
        } else if (fibers.size === 0) {
          resume(void_2);
        }
      }
    };
    return go();
  };
};
var iterateConcurrent = () => (options) => iterateConcurrentImpl(options);
var forEachConcurrent = /* @__PURE__ */ iterateConcurrentImpl({
  onItem(state, item, index2) {
    return state.f(item, index2);
  },
  step(state, _, exit3, index2) {
    if (exit3._tag === "Failure") return exit3;
    else if (state.out) {
      state.out[index2] = exit3.value;
    }
  }
});
var filterOrElse = /* @__PURE__ */ dual(3, (self, predicate, orElse2) => flatMap3(self, (a) => predicate(a) ? succeed3(a) : orElse2(a)));
var filterMapOrElse = /* @__PURE__ */ dual(3, (self, filter8, orElse2) => flatMap3(self, (a) => {
  const result3 = filter8(a);
  return isFailure2(result3) ? orElse2(result3.failure) : succeed3(result3.success);
}));
var filterMapOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, filter8, orFailWith) => filterMapOrElse(self, filter8, orFailWith ? (x) => fail3(orFailWith(x)) : () => fail3(new NoSuchElementError())));
var filter3 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate, options) => map5(forEach(elements, (a, i) => {
  const result3 = predicate(a, i);
  if (typeof result3 === "boolean") {
    return succeed3(result3 ? some2(a) : none2());
  }
  return map5(result3, (keep) => keep ? some2(a) : none2());
}, options), getSomes));
var filterMap = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter8) => suspend(() => {
  const out = [];
  for (const a of elements) {
    const result3 = filter8(a);
    if (isSuccess2(result3)) {
      out.push(result3.success);
    }
  }
  return succeed3(out);
}));
var filterMapEffect = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter8, options) => suspend(() => {
  const out = [];
  return as(forEach(elements, (a) => map5(filter8(a), (result3) => {
    if (isSuccess2(result3)) {
      out.push(result3.success);
    }
  }), {
    discard: true,
    concurrency: options?.concurrency
  }), out);
}));
var Do2 = /* @__PURE__ */ succeed3({});
var bindTo3 = /* @__PURE__ */ bindTo(map5);
var bind3 = /* @__PURE__ */ bind(map5, flatMap3);
var let_3 = /* @__PURE__ */ let_(map5);
var forkChild = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber3) => {
  interruptChildrenPatch();
  return succeed3(forkUnsafe(fiber3, self, options?.startImmediately, false, options?.uninterruptible ?? false));
}));
var forkUnsafe = (parent, effect, immediate = false, daemon = false, uninterruptible3 = false) => {
  const parentRuntime = parent;
  const interruptible3 = uninterruptible3 === "inherit" ? parentRuntime.interruptible : !uninterruptible3;
  const child = new FiberImpl(parentRuntime.context, interruptible3);
  if (!daemon) {
    parentRuntime.children().add(child);
    child._parent = parentRuntime;
  }
  if (immediate) {
    child.evaluate(effect);
  } else {
    child._asyncContext = captureAsyncContext();
    parentRuntime.currentDispatcher.scheduleTask(() => child.evaluate(effect), 0);
  }
  return child;
};
var forkDetach = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => withFiber((fiber3) => succeed3(forkUnsafe(fiber3, self, options?.startImmediately, true, options?.uninterruptible))));
var awaitAllChildren = (self) => withFiber((fiber3) => {
  const initialChildren = fiber3._children && new Set(fiber3._children);
  const isInterruptible = fiber3.interruptible;
  return onExitPrimitive(self, (_) => {
    let children = fiber3._children;
    if (children === void 0 || children.size === 0) {
      return void_2;
    } else if (initialChildren) {
      children = filter2(children, (child) => !initialChildren.has(child));
    }
    const awaitChildren = asVoid(fiberAwaitAll(children));
    return isInterruptible ? interruptible(awaitChildren) : awaitChildren;
  });
});
var fiberScopeFinalizer = (fiber3) => () => withFiber((current) => current === fiber3 ? void_2 : fiberInterrupt(fiber3));
var forkIn = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, scope3, options) => withFiber((parent) => {
  const fiber3 = scope3.state._tag === "Closed" ? new FiberImpl(parent.context) : forkUnsafe(parent, self, options?.startImmediately, true, options?.uninterruptible);
  if (!fiber3._exit) {
    if (scope3.state._tag !== "Closed") {
      scopeAddFinalizerUnsafe(scope3, fiber3, fiberScopeFinalizer(fiber3));
      fiber3.addObserver(() => scopeRemoveFinalizerUnsafe(scope3, fiber3));
    } else {
      fiber3.interruptUnsafe(parent.id, fiberStackAnnotations(parent));
    }
  }
  return succeed3(fiber3);
}));
var forkScoped = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => flatMap3(scope, (scope3) => forkIn(self, scope3, options)));
var runForkWith = (context3) => (effect, options) => {
  const fiber3 = new FiberImpl(options?.scheduler ? add(context3, Scheduler, options.scheduler) : context3, options?.uninterruptible !== true);
  fiber3.evaluate(effect);
  if (fiber3._exit) return fiber3;
  if (options?.signal) {
    if (options.signal.aborted) {
      fiber3.interruptUnsafe();
    } else {
      const abort = () => fiber3.interruptUnsafe();
      options.signal.addEventListener("abort", abort, {
        once: true
      });
      fiber3.addObserver(() => options.signal.removeEventListener("abort", abort));
    }
  }
  if (options?.onFiberStart) {
    options.onFiberStart(fiber3);
  }
  return fiber3;
};
var runFork = /* @__PURE__ */ runForkWith(/* @__PURE__ */ empty());
var runCallbackWith = (context3) => {
  const runFork3 = runForkWith(context3);
  return (effect, options) => {
    const fiber3 = runFork3(effect, options);
    if (options?.onExit) {
      fiber3.addObserver(options.onExit);
    }
    return (interruptor) => {
      return fiber3.interruptUnsafe(interruptor);
    };
  };
};
var runCallback = /* @__PURE__ */ runCallbackWith(/* @__PURE__ */ empty());
var runPromiseExitWith = (context3) => {
  const runFork3 = runForkWith(context3);
  return (effect, options) => {
    const fiber3 = runFork3(effect, options);
    return new Promise((resolve3) => {
      fiber3.addObserver((exit3) => resolve3(exit3));
    });
  };
};
var runPromiseExit = /* @__PURE__ */ runPromiseExitWith(/* @__PURE__ */ empty());
var runPromiseWith = (context3) => {
  const runPromiseExit3 = runPromiseExitWith(context3);
  return (effect, options) => runPromiseExit3(effect, options).then((exit3) => {
    if (exit3._tag === "Failure") {
      throw causeSquash(exit3.cause);
    }
    return exit3.value;
  });
};
var runPromise = /* @__PURE__ */ runPromiseWith(/* @__PURE__ */ empty());
var runSyncExitWith = (context3) => {
  const runFork3 = runForkWith(context3);
  return (effect) => {
    if (effectIsExit(effect)) return effect;
    const scheduler = new MixedScheduler("sync");
    const fiber3 = runFork3(effect, {
      scheduler
    });
    fiber3._dispatcher?.flush();
    return fiber3._exit ?? exitDie(new AsyncFiberError(fiber3));
  };
};
var runSyncExit = /* @__PURE__ */ runSyncExitWith(/* @__PURE__ */ empty());
var runSyncWith = (context3) => {
  const runSyncExit3 = runSyncExitWith(context3);
  return (effect) => {
    const exit3 = runSyncExit3(effect);
    if (exit3._tag === "Failure") throw causeSquash(exit3.cause);
    return exit3.value;
  };
};
var runSync = /* @__PURE__ */ runSyncWith(/* @__PURE__ */ empty());
var tracer = /* @__PURE__ */ withFiber((fiber3) => succeed3(fiber3.getRef(Tracer)));
var withTracer = /* @__PURE__ */ dual(2, (effect, tracer3) => provideService(effect, Tracer, tracer3));
var withTracerEnabled = /* @__PURE__ */ provideService(TracerEnabled);
var withTracerTiming = /* @__PURE__ */ provideService(TracerTimingEnabled);
var bigint02 = /* @__PURE__ */ BigInt(0);
var NoopSpanProto = {
  _tag: "Span",
  spanId: "noop",
  traceId: "noop",
  sampled: false,
  status: {
    _tag: "Ended",
    startTime: bigint02,
    endTime: bigint02,
    exit: exitVoid
  },
  attributes: /* @__PURE__ */ new Map(),
  links: [],
  kind: "internal",
  attribute() {
  },
  event() {
  },
  end() {
  },
  addLinks() {
  }
};
var noopSpan = (options) => Object.assign(Object.create(NoopSpanProto), options);
var filterDisablePropagation = (span) => {
  if (!span) return none2();
  return get(span.annotations, DisablePropagation) ? span._tag === "Span" ? filterDisablePropagation(getOrUndefined(span.parent)) : none2() : some2(span);
};
var makeSpanUnsafe = (fiber3, name, options) => {
  const disablePropagation = !fiber3.cache.tracerEnabled || options?.annotations && get(options.annotations, DisablePropagation);
  const parent = options?.parent !== void 0 ? some2(options.parent) : options?.root ? none2() : filterDisablePropagation(fiber3.cache.span);
  let span;
  if (disablePropagation) {
    span = noopSpan({
      name,
      parent,
      annotations: add(options?.annotations ?? empty(), DisablePropagation, true)
    });
  } else {
    const tracer3 = fiber3.cache.tracer ?? nativeTracer;
    const clock = fiber3.getRef(ClockRef);
    const timingEnabled = fiber3.getRef(TracerTimingEnabled);
    const annotationsFromEnv = fiber3.getRef(TracerSpanAnnotations);
    const linksFromEnv = fiber3.getRef(TracerSpanLinks);
    const level = options?.level ?? fiber3.getRef(CurrentTraceLevel);
    const links = options?.links !== void 0 ? [...linksFromEnv, ...options.links] : linksFromEnv.length === 0 ? [] : linksFromEnv.slice();
    span = tracer3.span({
      name,
      parent,
      annotations: options?.annotations ?? empty(),
      links,
      startTime: timingEnabled ? clock.currentTimeNanosUnsafe() : bigint02,
      kind: options?.kind ?? "internal",
      root: options?.root ?? false,
      sampled: options?.sampled ?? (isSome2(parent) && parent.value.sampled === false ? false : !isLogLevelGreaterThan(fiber3.getRef(MinimumTraceLevel), level))
    });
    for (const key in annotationsFromEnv) {
      span.attribute(key, annotationsFromEnv[key]);
    }
    if (options?.attributes !== void 0) {
      for (const key in options.attributes) {
        span.attribute(key, options.attributes[key]);
      }
    }
  }
  return span;
};
var makeSpan = (name, options) => withFiber((fiber3) => succeed3(makeSpanUnsafe(fiber3, name, options)));
var makeSpanScoped = (name, options) => uninterruptible(withFiber((fiber3) => {
  const scope3 = getUnsafe(fiber3.context, scopeTag);
  const span = makeSpanUnsafe(fiber3, name, options ?? {});
  const clock = fiber3.getRef(ClockRef);
  const timingEnabled = fiber3.getRef(TracerTimingEnabled);
  return as(scopeAddFinalizerExit(scope3, (exit3) => endSpan(span, exit3, clock, timingEnabled)), span);
}));
var withSpanScoped = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const options = addSpanStackTrace(dataFirst ? arguments[2] : arguments[1]);
  if (dataFirst) {
    const self = arguments[0];
    return flatMap3(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
  }
  return (self) => flatMap3(makeSpanScoped(name, options), (span) => withParentSpan(self, span, options));
};
var provideSpanStackFrame = (name, stack) => {
  stack = typeof stack === "function" ? stack : constUndefined;
  return updateService(CurrentStackFrame, (parent) => ({
    name,
    stack,
    parent
  }));
};
var spanAnnotations = TracerSpanAnnotations;
var spanLinks = TracerSpanLinks;
var linkSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, span, attributes = {}) => {
  const spans = Array.isArray(span) ? span : [span];
  const links = spans.map((span2) => ({
    span: span2,
    attributes
  }));
  return updateService(self, TracerSpanLinks, (current) => [...current, ...links]);
});
var endSpan = (span, exit3, clock, timingEnabled) => sync(() => {
  if (span.status._tag === "Ended") return;
  span.end(timingEnabled ? clock.currentTimeNanosUnsafe() : bigint02, exit3);
});
var useSpan = (name, ...args2) => {
  const options = args2.length === 1 ? void 0 : args2[0];
  const evaluate2 = args2[args2.length - 1];
  return withFiber((fiber3) => {
    const span = makeSpanUnsafe(fiber3, name, options);
    const clock = fiber3.getRef(ClockRef);
    const timingEnabled = fiber3.getRef(TracerTimingEnabled);
    onExitUnsafe(fiber3, (exit3) => endSpan(span, exit3, clock, timingEnabled));
    return evaluate2(span);
  });
};
var provideParentSpan = /* @__PURE__ */ provideService(ParentSpan);
var withParentSpan = function() {
  const dataFirst = isEffect(arguments[0]);
  const span = dataFirst ? arguments[1] : arguments[0];
  let options = dataFirst ? arguments[2] : arguments[1];
  let provideStackFrame = identity;
  if (span._tag === "Span") {
    options = addSpanStackTrace(options);
    provideStackFrame = provideSpanStackFrame(span.name, options?.captureStackTrace);
  }
  if (dataFirst) {
    return provideParentSpan(provideStackFrame(arguments[0]), span);
  }
  return (self) => provideParentSpan(provideStackFrame(self), span);
};
var withSpan = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const traceOptions = addSpanStackTrace(arguments[2]);
  if (dataFirst) {
    const self = arguments[0];
    return useSpan(name, arguments[2], (span) => withParentSpan(self, span, traceOptions));
  }
  const fnArg = typeof arguments[1] === "function" ? arguments[1] : void 0;
  const options = fnArg ? void 0 : arguments[1];
  return (self, ...args2) => useSpan(name, fnArg ? fnArg(...args2) : options, (span) => withParentSpan(self, span, traceOptions));
};
var annotateSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (effect, ...args2) => updateService(effect, TracerSpanAnnotations, (annotations) => {
  const newAnnotations = args2.length === 1 ? {
    ...annotations,
    ...args2[0]
  } : {
    ...annotations
  };
  if (args2.length === 1) {
    return newAnnotations;
  } else {
    assignProperty(newAnnotations, args2[0], args2[1]);
  }
  return newAnnotations;
}));
var annotateCurrentSpan = (...args2) => withFiber((fiber3) => {
  const span = fiber3.currentSpanLocal;
  if (span) {
    if (args2.length === 1) {
      for (const [key, value3] of Object.entries(args2[0])) {
        span.attribute(key, value3);
      }
    } else {
      span.attribute(args2[0], args2[1]);
    }
  }
  return void_2;
});
var currentSpan = /* @__PURE__ */ withFiber((fiber3) => {
  const span = fiber3.currentSpanLocal;
  return span ? succeed3(span) : fail3(new NoSuchElementError());
});
var currentParentSpan = /* @__PURE__ */ serviceOptional(ParentSpan);
var ClockRef = /* @__PURE__ */ Reference("effect/Clock", {
  defaultValue: () => new ClockImpl()
});
var MAX_TIMER_MILLIS = 2 ** 31 - 1;
var ClockImpl = class {
  currentTimeMillisUnsafe() {
    return Date.now();
  }
  currentTimeMillis = /* @__PURE__ */ sync(() => this.currentTimeMillisUnsafe());
  currentTimeNanosUnsafe() {
    return wallTimeNanos();
  }
  currentTimeNanos = /* @__PURE__ */ sync(() => this.currentTimeNanosUnsafe());
  monotonicTimeNanosUnsafe() {
    return monotonicNowNanos();
  }
  monotonicTimeNanos = /* @__PURE__ */ sync(() => this.monotonicTimeNanosUnsafe());
  sleep(duration) {
    return this.sleepMillis(toMillis(duration));
  }
  sleepMillis(millis2) {
    if (millis2 <= 0) return yieldNow;
    else if (!Number.isFinite(millis2)) return never;
    return callback((resume) => {
      const continuation = millis2 > MAX_TIMER_MILLIS ? this.sleepMillis(millis2 - MAX_TIMER_MILLIS) : void_2;
      const handle = setTimeout(() => resume(continuation), Math.min(millis2, MAX_TIMER_MILLIS));
      return sync(() => clearTimeout(handle));
    });
  }
};
var nanosPerMilli = /* @__PURE__ */ BigInt(1e6);
var monotonicNowNanos = /* @__PURE__ */ (function() {
  const processHrtime = globalThis.process?.hrtime;
  if (typeof processHrtime?.bigint === "function") {
    return () => processHrtime.bigint();
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return () => BigInt(Math.round(performance.now() * 1e6));
  }
  let previous = /* @__PURE__ */ BigInt(0);
  return () => {
    const current = BigInt(Date.now()) * nanosPerMilli;
    if (current > previous) {
      previous = current;
    }
    return previous;
  };
})();
var wallTimeNanos = /* @__PURE__ */ (function() {
  const reanchorThresholdNanos = /* @__PURE__ */ BigInt(1e9);
  let origin;
  return () => {
    const monotonic = monotonicNowNanos();
    const wall = BigInt(Date.now()) * nanosPerMilli;
    if (origin === void 0) {
      origin = wall - monotonic;
    } else {
      const projected = origin + monotonic;
      const skew = wall > projected ? wall - projected : projected - wall;
      if (skew > reanchorThresholdNanos) {
        origin = wall - monotonic;
      }
    }
    return origin + monotonic;
  };
})();
var clockWith = (f) => withFiber((fiber3) => f(fiber3.getRef(ClockRef)));
var sleep = (duration) => clockWith((clock) => clock.sleep(fromInputUnsafe(duration)));
var currentTimeMillis = /* @__PURE__ */ clockWith((clock) => clock.currentTimeMillis);
var TimeoutErrorTypeId = "~effect/Cause/TimeoutError";
var TimeoutError = class extends (/* @__PURE__ */ TaggedError("TimeoutError")) {
  [TimeoutErrorTypeId] = TimeoutErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
};
var IllegalArgumentErrorTypeId = "~effect/Cause/IllegalArgumentError";
var IllegalArgumentError = class extends (/* @__PURE__ */ TaggedError("IllegalArgumentError")) {
  [IllegalArgumentErrorTypeId] = IllegalArgumentErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
};
var ExceededCapacityErrorTypeId = "~effect/Cause/ExceededCapacityError";
var ExceededCapacityError = class extends (/* @__PURE__ */ TaggedError("ExceededCapacityError")) {
  [ExceededCapacityErrorTypeId] = ExceededCapacityErrorTypeId;
  constructor(message) {
    super({
      message
    });
  }
};
var AsyncFiberErrorTypeId = "~effect/Cause/AsyncFiberError";
var AsyncFiberError = class extends (/* @__PURE__ */ TaggedError("AsyncFiberError")) {
  [AsyncFiberErrorTypeId] = AsyncFiberErrorTypeId;
  constructor(fiber3) {
    super({
      message: "An asynchronous Effect was executed with Effect.runSync",
      fiber: fiber3
    });
  }
};
var UnknownErrorTypeId = "~effect/Cause/UnknownError";
var UnknownError = class extends (/* @__PURE__ */ TaggedError("UnknownError")) {
  [UnknownErrorTypeId] = UnknownErrorTypeId;
  constructor(cause, message) {
    super({
      message,
      cause
    });
  }
};
var ConsoleRef = /* @__PURE__ */ Reference("effect/Console", {
  defaultValue: () => globalThis.console
});
var logLevelToOrder = (level) => {
  switch (level) {
    case "All":
      return Number.MIN_SAFE_INTEGER;
    case "Fatal":
      return 5e4;
    case "Error":
      return 4e4;
    case "Warn":
      return 3e4;
    case "Info":
      return 2e4;
    case "Debug":
      return 1e4;
    case "Trace":
      return 0;
    case "None":
      return Number.MAX_SAFE_INTEGER;
  }
};
var LogLevelOrder = /* @__PURE__ */ mapInput(Number2, logLevelToOrder);
var isLogLevelGreaterThan = /* @__PURE__ */ isGreaterThan(LogLevelOrder);
var CurrentLoggers = /* @__PURE__ */ Reference("effect/Logger/CurrentLoggers", {
  defaultValue: () => /* @__PURE__ */ new Set([defaultLogger, tracerLogger])
});
var LogToStderr = /* @__PURE__ */ Reference("effect/Logger/LogToStderr", {
  defaultValue: constFalse
});
var annotateLogsScoped = function() {
  const entries3 = typeof arguments[0] === "string" ? [[arguments[0], arguments[1]]] : Object.entries(arguments[0]);
  return uninterruptible(withFiber((fiber3) => {
    const prev = fiber3.getRef(CurrentLogAnnotations);
    const next = {
      ...prev
    };
    for (let i = 0; i < entries3.length; i++) {
      const [key, value3] = entries3[i];
      assignProperty(next, key, value3);
    }
    fiber3.setContext(add(fiber3.context, CurrentLogAnnotations, next));
    return scopeAddFinalizerExit(getUnsafe(fiber3.context, scopeTag), (_) => {
      const current = fiber3.getRef(CurrentLogAnnotations);
      const next2 = {
        ...current
      };
      for (let i = 0; i < entries3.length; i++) {
        const [key, value3] = entries3[i];
        if (current[key] !== value3 && !Object.is(current[key], value3)) continue;
        if (Object.hasOwn(prev, key)) {
          assignProperty(next2, key, prev[key]);
        } else {
          delete next2[key];
        }
      }
      fiber3.setContext(add(fiber3.context, CurrentLogAnnotations, next2));
      return void_2;
    });
  }));
};
var LoggerTypeId = "~effect/Logger";
var LoggerProto = {
  [LoggerTypeId]: {
    _Message: identity,
    _Output: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var loggerMake = (log2) => {
  const self = Object.create(LoggerProto);
  self.log = log2;
  return self;
};
var formatLabel = (key) => key.replace(/[\s="]/g, "_");
var formatLogSpan = (self, now2) => {
  const label = formatLabel(self[0]);
  return `${label}=${now2 - self[1]}ms`;
};
var logWithLevel = (level) => (...message) => {
  let cause = void 0;
  for (let i = 0, len = message.length; i < len; i++) {
    const msg = message[i];
    if (isCause(msg)) {
      if (cause) {
        ;
        message.splice(i, 1);
      } else {
        message = message.slice(0, i).concat(message.slice(i + 1));
      }
      cause = cause ? causeFromReasons(cause.reasons.concat(msg.reasons)) : msg;
      i--;
    }
  }
  if (cause === void 0) {
    cause = causeEmpty;
  }
  return withFiber((fiber3) => {
    const logLevel = level ?? fiber3.cache.logLevel;
    if (isLogLevelGreaterThan(fiber3.cache.minimumLogLevel, logLevel)) {
      return void_2;
    }
    const clock = fiber3.getRef(ClockRef);
    const loggers = fiber3.getRef(CurrentLoggers);
    if (loggers.size > 0) {
      const date = new Date(clock.currentTimeMillisUnsafe());
      for (const logger of loggers) {
        logger.log({
          cause,
          fiber: fiber3,
          date,
          logLevel,
          message
        });
      }
    }
    return void_2;
  });
};
var colors = {
  bold: "1",
  red: "31",
  green: "32",
  yellow: "33",
  blue: "34",
  cyan: "36",
  white: "37",
  gray: "90",
  black: "30",
  bgBrightRed: "101"
};
var logLevelColors = {
  None: [],
  All: [],
  Trace: [colors.gray],
  Debug: [colors.blue],
  Info: [colors.green],
  Warn: [colors.yellow],
  Error: [colors.red],
  Fatal: [colors.bgBrightRed, colors.black]
};
var defaultDateFormat = (date) => `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}.${date.getMilliseconds().toString().padStart(3, "0")}`;
var defaultLogger = /* @__PURE__ */ loggerMake(({
  cause,
  date,
  fiber: fiber3,
  logLevel,
  message
}) => {
  const message_ = Array.isArray(message) ? message.slice() : [message];
  if (cause.reasons.length > 0) {
    message_.push(causePretty(cause));
  }
  const now2 = date.getTime();
  const spans = fiber3.getRef(CurrentLogSpans);
  let spanString = "";
  for (const span of spans) {
    spanString += ` ${formatLogSpan(span, now2)}`;
  }
  const annotations = fiber3.getRef(CurrentLogAnnotations);
  if (Object.keys(annotations).length > 0) {
    message_.push(annotations);
  }
  const console = fiber3.getRef(ConsoleRef);
  const log2 = fiber3.getRef(LogToStderr) ? console.error : console.log;
  log2(`[${defaultDateFormat(date)}] ${logLevel.toUpperCase()} (#${fiber3.id})${spanString}:`, ...message_);
});
var tracerLogger = /* @__PURE__ */ loggerMake(({
  cause,
  fiber: fiber3,
  logLevel,
  message
}) => {
  const clock = fiber3.getRef(ClockRef);
  const annotations = fiber3.getRef(CurrentLogAnnotations);
  const span = fiber3.cache.span;
  if (span === void 0 || span._tag === "ExternalSpan") return;
  const attributes = {};
  for (const [key, value3] of Object.entries(annotations)) {
    assignProperty(attributes, key, value3);
  }
  attributes["effect.fiberId"] = fiber3.id;
  attributes["effect.logLevel"] = logLevel.toUpperCase();
  if (cause.reasons.length > 0) {
    attributes["effect.cause"] = causePretty(cause);
  }
  span.event(toStringUnknown(Array.isArray(message) && message.length === 1 ? message[0] : message), clock.currentTimeNanosUnsafe(), attributes);
});
function interruptChildrenPatch() {
  fiberMiddleware.interruptChildren ??= fiberInterruptChildren;
}
var undefined_ = /* @__PURE__ */ succeed3(void 0);
var withErrorReporting = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, options) => onError(self, (cause) => withFiber((fiber3) => {
  reportCauseUnsafe(fiber3, cause, options?.defectsOnly);
  return void_2;
})));
var reportCauseUnsafe = (fiber3, cause, defectsOnly) => {
  const reporters = fiber3.getRef(CurrentErrorReporters);
  if (reporters.size === 0) return;
  if (defectsOnly && !hasDies(cause)) return;
  const opts = {
    cause,
    fiber: fiber3,
    timestamp: fiber3.getRef(ClockRef).currentTimeNanosUnsafe()
  };
  reporters.forEach((reporter) => reporter.report(opts));
};

// node_modules/effect/dist/Cause.js
var isCause2 = isCause;
var isReason = isCauseReason;
var isFailReason2 = isFailReason;
var fromReasons = causeFromReasons;
var die2 = causeDie;
var makeFailReason = (error) => new Fail(error);
var makeDieReason = (defect) => new Die(defect);
var makeInterruptReason2 = makeInterruptReason;
var map6 = causeMap;
var pretty = causePretty;
var isDone2 = isDone;
var done2 = done;
var IllegalArgumentError2 = IllegalArgumentError;

// node_modules/effect/dist/Effect.js
var Effect_exports = {};
__export(Effect_exports, {
  Do: () => Do3,
  Transaction: () => Transaction,
  TypeId: () => TypeId13,
  abortSignal: () => abortSignal2,
  acquireDisposable: () => acquireDisposable2,
  acquireRelease: () => acquireRelease2,
  acquireUseRelease: () => acquireUseRelease2,
  addFinalizer: () => addFinalizer2,
  all: () => all3,
  andThen: () => andThen3,
  annotateCurrentSpan: () => annotateCurrentSpan2,
  annotateLogs: () => annotateLogs,
  annotateLogsScoped: () => annotateLogsScoped2,
  annotateSpans: () => annotateSpans2,
  as: () => as2,
  asSome: () => asSome2,
  asVoid: () => asVoid2,
  awaitAllChildren: () => awaitAllChildren2,
  bind: () => bind4,
  bindTo: () => bindTo4,
  cached: () => cached2,
  cachedInvalidateWithTTL: () => cachedInvalidateWithTTL2,
  cachedWithTTL: () => cachedWithTTL2,
  callback: () => callback2,
  catch: () => catch_2,
  catchCause: () => catchCause2,
  catchCauseFilter: () => catchCauseFilter2,
  catchCauseIf: () => catchCauseIf2,
  catchDefect: () => catchDefect2,
  catchEager: () => catchEager2,
  catchFilter: () => catchFilter2,
  catchIf: () => catchIf2,
  catchNoSuchElement: () => catchNoSuchElement2,
  catchReason: () => catchReason2,
  catchReasons: () => catchReasons2,
  catchTag: () => catchTag2,
  catchTags: () => catchTags2,
  clockWith: () => clockWith2,
  context: () => context2,
  contextWith: () => contextWith2,
  currentParentSpan: () => currentParentSpan2,
  currentSpan: () => currentSpan2,
  delay: () => delay2,
  die: () => die3,
  effectify: () => effectify,
  ensuring: () => ensuring2,
  eventually: () => eventually2,
  exit: () => exit2,
  fail: () => fail5,
  failCause: () => failCause3,
  failCauseSync: () => failCauseSync2,
  failSync: () => failSync2,
  fiber: () => fiber2,
  fiberId: () => fiberId2,
  filter: () => filter4,
  filterMap: () => filterMap2,
  filterMapEffect: () => filterMapEffect2,
  filterMapOrElse: () => filterMapOrElse2,
  filterMapOrFail: () => filterMapOrFail2,
  filterOrElse: () => filterOrElse2,
  filterOrFail: () => filterOrFail3,
  findFirst: () => findFirst4,
  findFirstFilter: () => findFirstFilter2,
  firstSuccessOf: () => firstSuccessOf2,
  flatMap: () => flatMap4,
  flatMapEager: () => flatMapEager2,
  flatten: () => flatten4,
  flip: () => flip3,
  fn: () => fn2,
  fnUntraced: () => fnUntraced2,
  fnUntracedEager: () => fnUntracedEager2,
  forEach: () => forEach2,
  forever: () => forever3,
  forkChild: () => forkChild2,
  forkDetach: () => forkDetach2,
  forkIn: () => forkIn2,
  forkScoped: () => forkScoped2,
  fromNullishOr: () => fromNullishOr4,
  fromOption: () => fromOption4,
  fromResult: () => fromResult2,
  gen: () => gen3,
  head: () => head2,
  ignore: () => ignore2,
  ignoreCause: () => ignoreCause2,
  interrupt: () => interrupt2,
  interruptible: () => interruptible2,
  interruptibleMask: () => interruptibleMask2,
  isEffect: () => isEffect2,
  isFailure: () => isFailure5,
  isSuccess: () => isSuccess5,
  let: () => let_4,
  linkSpans: () => linkSpans2,
  log: () => log,
  logDebug: () => logDebug,
  logError: () => logError,
  logFatal: () => logFatal,
  logInfo: () => logInfo,
  logTrace: () => logTrace,
  logWarning: () => logWarning,
  logWithLevel: () => logWithLevel2,
  makeSpan: () => makeSpan2,
  makeSpanScoped: () => makeSpanScoped2,
  map: () => map7,
  mapBoth: () => mapBoth3,
  mapBothEager: () => mapBothEager2,
  mapEager: () => mapEager2,
  mapError: () => mapError3,
  mapErrorEager: () => mapErrorEager2,
  match: () => match5,
  matchCause: () => matchCause2,
  matchCauseEager: () => matchCauseEager2,
  matchCauseEffect: () => matchCauseEffect2,
  matchCauseEffectEager: () => matchCauseEffectEager2,
  matchEager: () => matchEager2,
  matchEffect: () => matchEffect3,
  never: () => never2,
  onError: () => onError2,
  onErrorFilter: () => onErrorFilter2,
  onErrorIf: () => onErrorIf2,
  onExit: () => onExit2,
  onExitFilter: () => onExitFilter2,
  onExitIf: () => onExitIf2,
  onExitPrimitive: () => onExitPrimitive2,
  onInterrupt: () => onInterrupt2,
  option: () => option2,
  orDie: () => orDie2,
  orElseSucceed: () => orElseSucceed2,
  partition: () => partition3,
  promise: () => promise2,
  provide: () => provide4,
  provideContext: () => provideContext2,
  provideService: () => provideService2,
  provideServiceEffect: () => provideServiceEffect2,
  race: () => race2,
  raceAll: () => raceAll2,
  raceAllFirst: () => raceAllFirst2,
  raceFirst: () => raceFirst2,
  reduce: () => reduce2,
  repeat: () => repeat2,
  repeatOrElse: () => repeatOrElse2,
  replicate: () => replicate2,
  replicateEffect: () => replicateEffect2,
  request: () => request2,
  requestUnsafe: () => requestUnsafe2,
  result: () => result2,
  retry: () => retry2,
  retryOrElse: () => retryOrElse2,
  runCallback: () => runCallback2,
  runCallbackWith: () => runCallbackWith2,
  runFork: () => runFork2,
  runForkWith: () => runForkWith2,
  runPromise: () => runPromise2,
  runPromiseExit: () => runPromiseExit2,
  runPromiseExitWith: () => runPromiseExitWith2,
  runPromiseWith: () => runPromiseWith2,
  runSync: () => runSync2,
  runSyncExit: () => runSyncExit2,
  runSyncExitWith: () => runSyncExitWith2,
  runSyncWith: () => runSyncWith2,
  sandbox: () => sandbox2,
  satisfiesErrorType: () => satisfiesErrorType,
  satisfiesServicesType: () => satisfiesServicesType,
  satisfiesSuccessType: () => satisfiesSuccessType,
  schedule: () => schedule,
  scheduleFrom: () => scheduleFrom2,
  scope: () => scope2,
  scoped: () => scoped2,
  scopedWith: () => scopedWith2,
  service: () => service2,
  serviceOption: () => serviceOption2,
  setContext: () => setContext2,
  sleep: () => sleep2,
  spanAnnotations: () => spanAnnotations2,
  spanLinks: () => spanLinks2,
  succeed: () => succeed5,
  succeedNone: () => succeedNone3,
  succeedSome: () => succeedSome3,
  suspend: () => suspend2,
  sync: () => sync2,
  tap: () => tap3,
  tapCause: () => tapCause2,
  tapCauseFilter: () => tapCauseFilter2,
  tapCauseIf: () => tapCauseIf2,
  tapDefect: () => tapDefect2,
  tapError: () => tapError2,
  tapErrorTag: () => tapErrorTag2,
  timed: () => timed2,
  timeout: () => timeout2,
  timeoutOption: () => timeoutOption2,
  timeoutOrElse: () => timeoutOrElse2,
  tracer: () => tracer2,
  track: () => track,
  trackDefects: () => trackDefects,
  trackDuration: () => trackDuration,
  trackErrors: () => trackErrors,
  trackSuccesses: () => trackSuccesses,
  transposeOption: () => transposeOption3,
  try: () => try_3,
  tryPromise: () => tryPromise2,
  tx: () => tx,
  txRetry: () => txRetry,
  undefined: () => undefined_2,
  uninterruptible: () => uninterruptible2,
  uninterruptibleMask: () => uninterruptibleMask2,
  unwrapReason: () => unwrapReason2,
  updateContext: () => updateContext2,
  updateService: () => updateService2,
  updateServiceScoped: () => updateServiceScoped2,
  useSpan: () => useSpan2,
  validate: () => validate2,
  void: () => void_4,
  when: () => when2,
  whileLoop: () => whileLoop2,
  withErrorReporting: () => withErrorReporting2,
  withExecutionPlan: () => withExecutionPlan2,
  withFiber: () => withFiber2,
  withFiberSucceed: () => withFiberSucceed2,
  withLogSpan: () => withLogSpan,
  withLogger: () => withLogger,
  withParentSpan: () => withParentSpan2,
  withSpan: () => withSpan2,
  withSpanScoped: () => withSpanScoped2,
  withTracer: () => withTracer2,
  withTracerEnabled: () => withTracerEnabled2,
  withTracerTiming: () => withTracerTiming2,
  yieldNow: () => yieldNow2,
  yieldNowWith: () => yieldNowWith2,
  zip: () => zip2,
  zipWith: () => zipWith2
});

// node_modules/effect/dist/Exit.js
var isExit2 = isExit;
var succeed4 = exitSucceed;
var failCause2 = exitFailCause;
var fail4 = exitFail;
var void_3 = exitVoid;
var isSuccess4 = exitIsSuccess;
var isFailure4 = exitIsFailure;

// node_modules/effect/dist/Deferred.js
var TypeId5 = "~effect/Deferred";
var DeferredProto = {
  [TypeId5]: {
    _A: identity,
    _E: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var DeferredImpl = function() {
  this.resumes = void 0;
  this.effect = void 0;
};
DeferredImpl.prototype = DeferredProto;
var makeUnsafe2 = () => new DeferredImpl();
var _await = (self) => callback((resume) => {
  if (self.effect) return resume(self.effect);
  self.resumes ??= [];
  self.resumes.push(resume);
  return sync(() => {
    const resumes = self.resumes;
    if (resumes === void 0) return;
    const index2 = resumes.indexOf(resume);
    if (index2 >= 0) resumes.splice(index2, 1);
  });
});
var doneUnsafe = (self, effect) => {
  if (self.effect) return false;
  self.effect = effect;
  if (self.resumes) {
    const resumes = self.resumes;
    self.resumes = void 0;
    for (let i = 0; i < resumes.length; i++) {
      resumes[i](effect);
    }
  }
  return true;
};

// node_modules/effect/dist/References.js
var CurrentLogAnnotations2 = CurrentLogAnnotations;
var CurrentLogSpans2 = CurrentLogSpans;

// node_modules/effect/dist/Scope.js
var makeUnsafe3 = scopeMakeUnsafe;
var forkUnsafe2 = scopeForkUnsafe;
var close = scopeClose;

// node_modules/effect/dist/Layer.js
var TypeId6 = "~effect/Layer";
var MemoMapTypeId = "~effect/Layer/MemoMap";
var makeMemoMapEntry = (memoMap, layer) => {
  const entry = {
    observers: 0,
    deferred: makeUnsafe2(),
    scope: makeUnsafe3(),
    finalizer: (exit3) => suspend(() => {
      if (--entry.observers > 0) return void_2;
      memoMap.map.delete(layer);
      return close(entry.scope, exit3);
    })
  };
  return entry;
};
var memoMapObserve = (entry, scope3) => {
  if (scope3.state._tag === "Closed") return false;
  entry.observers++;
  scopeAddFinalizerUnsafe(scope3, {}, entry.finalizer);
  return true;
};
var isLayer = (u) => hasProperty(u, TypeId6);
var LayerProto = {
  [TypeId6]: {
    _ROut: identity,
    _E: identity,
    _RIn: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromBuildUnsafe = (build) => {
  const self = Object.create(LayerProto);
  self.build = build;
  return self;
};
var fromBuild = (build) => fromBuildUnsafe((memoMap, scope3) => {
  const layerScope = forkUnsafe2(scope3);
  return onExit(build(memoMap, layerScope), (exit3) => exit3._tag === "Failure" ? close(layerScope, exit3) : void_2);
});
var fromBuildMemo = (build) => {
  const self = fromBuild((memoMap, scope3) => memoMap.getOrElseMemoize(self, scope3, build));
  return self;
};
var MemoMapImpl = class {
  get [MemoMapTypeId]() {
    return MemoMapTypeId;
  }
  parent;
  constructor(parent) {
    this.parent = parent;
  }
  map = /* @__PURE__ */ new Map();
  get(layer, scope3) {
    const local = this.map.get(layer);
    if (local) {
      memoMapObserve(local, scope3);
      return local.deferred.effect ?? _await(local.deferred);
    }
    return this.parent?.get(layer, scope3);
  }
  getOrElseMemoize(layer, scope3, build) {
    return suspend(() => {
      let deferred;
      return onExitPrimitive(suspend(() => {
        const existing = this.get(layer, scope3);
        if (existing) return existing;
        const entry = makeMemoMapEntry(this, layer);
        if (!memoMapObserve(entry, scope3)) return build(this, scope3);
        deferred = entry.deferred;
        this.map.set(layer, entry);
        return build(this, entry.scope);
      }), (exit3) => {
        if (deferred) doneUnsafe(deferred, exit3);
      });
    });
  }
};
var makeMemoMapUnsafe = () => new MemoMapImpl();
var forkMemoMapUnsafe = (parent) => new MemoMapImpl(parent);
var CurrentMemoMap = class _CurrentMemoMap extends (/* @__PURE__ */ Service()("effect/Layer/CurrentMemoMap")) {
  static forkOrCreate(self) {
    const current = getOrUndefined2(self, _CurrentMemoMap);
    return current ? forkMemoMapUnsafe(current) : makeMemoMapUnsafe();
  }
};
var buildWithMemoMap = /* @__PURE__ */ dual(3, (self, memoMap, scope3) => provideService(map5(suspend(() => self.build(memoMap, scope3)), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
var buildWithScope = /* @__PURE__ */ dual(2, (self, scope3) => withFiber((fiber3) => buildWithMemoMap(self, CurrentMemoMap.forkOrCreate(fiber3.context), scope3)));
var succeedContext = (context3) => fromBuildUnsafe(constant(succeed3(context3)));
var mergeAllEffect = (layers, memoMap, scope3) => {
  const parentScope = forkUnsafe2(scope3, "parallel");
  return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe2(parentScope, "sequential")), {
    concurrency: layers.length
  }).pipe(map5((context3) => mergeAll(...context3)));
};
var mergeAll2 = (...layers) => fromBuildMemo((memoMap, scope3) => mergeAllEffect(layers, memoMap, scope3));
var provideWith = (self, that, f) => fromBuildMemo((memoMap, scope3) => flatMap3(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope3) : that.build(memoMap, scope3), (context3) => self.build(memoMap, scope3).pipe(provideContext(context3), map5((merged) => f(merged, context3)))));
var provide2 = /* @__PURE__ */ dual(2, (self, that) => provideWith(self, that, identity));

// node_modules/effect/dist/internal/dateTime.js
var TypeId7 = "~effect/DateTime";
var TimeZoneTypeId = "~effect/DateTime/TimeZone";
var Proto2 = {
  [TypeId7]: TypeId7,
  pipe() {
    return pipeArguments(this, arguments);
  },
  [NodeInspectSymbol]() {
    return this.toString();
  },
  toJSON() {
    return toDateUtc(this).toJSON();
  }
};
var ProtoUtc = {
  ...Proto2,
  _tag: "Utc",
  [symbol]() {
    return number(this.epochMilliseconds);
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Utc" && this.epochMilliseconds === that.epochMilliseconds;
  },
  toString() {
    return `DateTime.Utc(${toDateUtc(this).toJSON()})`;
  }
};
var ProtoZoned = {
  ...Proto2,
  _tag: "Zoned",
  [symbol]() {
    return combine(number(this.epochMilliseconds))(hash(this.zone));
  },
  [symbol2](that) {
    return isDateTime(that) && that._tag === "Zoned" && this.epochMilliseconds === that.epochMilliseconds && equals(this.zone, that.zone);
  },
  toString() {
    return `DateTime.Zoned(${formatIsoZoned(this)})`;
  }
};
var ProtoTimeZone = {
  [TimeZoneTypeId]: TimeZoneTypeId,
  [NodeInspectSymbol]() {
    return this.toString();
  }
};
var ProtoTimeZoneNamed = {
  ...ProtoTimeZone,
  _tag: "Named",
  [symbol]() {
    return string(`Named:${this.id}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Named" && this.id === that.id;
  },
  toString() {
    return `TimeZone.Named(${this.id})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Named",
      id: this.id
    };
  }
};
var ProtoTimeZoneOffset = {
  ...ProtoTimeZone,
  _tag: "Offset",
  [symbol]() {
    return string(`Offset:${this.offset}`);
  },
  [symbol2](that) {
    return isTimeZone(that) && that._tag === "Offset" && this.offset === that.offset;
  },
  toString() {
    return `TimeZone.Offset(${offsetToString(this.offset)})`;
  },
  toJSON() {
    return {
      _id: "TimeZone",
      _tag: "Offset",
      offset: this.offset
    };
  }
};
var makeZonedProto = (epochMillis, zone, partsUtc) => {
  const self = Object.create(ProtoZoned);
  self.epochMilliseconds = epochMillis;
  self.zone = zone;
  Object.defineProperty(self, "partsUtc", {
    value: partsUtc,
    enumerable: false,
    writable: true
  });
  Object.defineProperty(self, "adjustedEpochMillis", {
    value: void 0,
    enumerable: false,
    writable: true
  });
  Object.defineProperty(self, "partsAdjusted", {
    value: void 0,
    enumerable: false,
    writable: true
  });
  return self;
};
var isDateTime = (u) => hasProperty(u, TypeId7);
var isTimeZone = (u) => hasProperty(u, TimeZoneTypeId);
var isTimeZoneOffset = (u) => isTimeZone(u) && u._tag === "Offset";
var isTimeZoneNamed = (u) => isTimeZone(u) && u._tag === "Named";
var isUtc = (self) => self._tag === "Utc";
var isZoned = (self) => self._tag === "Zoned";
var Equivalence2 = /* @__PURE__ */ make((a, b) => a.epochMilliseconds === b.epochMilliseconds);
var makeUtc = (epochMillis) => {
  const self = Object.create(ProtoUtc);
  self.epochMilliseconds = epochMillis;
  Object.defineProperty(self, "partsUtc", {
    value: void 0,
    enumerable: false,
    writable: true
  });
  return self;
};
var fromDateUnsafe = (date) => {
  const epochMillis = date.getTime();
  if (Number.isNaN(epochMillis)) {
    throw new IllegalArgumentError2("Invalid date");
  }
  return makeUtc(epochMillis);
};
var makeUnsafe4 = (input) => {
  if (isDateTime(input)) {
    return input;
  } else if (input instanceof Date) {
    return fromDateUnsafe(input);
  } else if (typeof input === "object") {
    if ("epochMilliseconds" in input) {
      return fromDateUnsafe(new Date(input.epochMilliseconds));
    }
    const date = /* @__PURE__ */ new Date(0);
    setPartsDate(date, input);
    return fromDateUnsafe(date);
  } else if (typeof input === "string" && !hasZone(input)) {
    return fromDateUnsafe(/* @__PURE__ */ new Date(input + "Z"));
  }
  return fromDateUnsafe(new Date(input));
};
var hasZone = (input) => /Z|GMT|[+-]\d{2}$|[+-]\d{2}:?\d{2}$|\]$/.test(input) || /z$|gmt$/i.test(input);
var minEpochMillis = -864e13 + 12 * 60 * 60 * 1e3;
var maxEpochMillis = 864e13 - 14 * 60 * 60 * 1e3;
var makeZonedUnsafe = (input, options) => {
  let timeZoneOption = options?.timeZone;
  if (timeZoneOption === void 0 && isDateTime(input) && isZoned(input)) {
    return input;
  }
  const self = makeUnsafe4(input);
  if (self.epochMilliseconds < minEpochMillis || self.epochMilliseconds > maxEpochMillis) {
    throw new RangeError(`Epoch millis out of range: ${self.epochMilliseconds}`);
  }
  if (timeZoneOption === void 0 && typeof input === "object" && "timeZoneId" in input) {
    timeZoneOption = input.timeZoneId;
  }
  let zone;
  if (timeZoneOption === void 0) {
    const offset = new Date(self.epochMilliseconds).getTimezoneOffset() * -60 * 1e3;
    zone = zoneMakeOffset(offset);
  } else if (isTimeZone(timeZoneOption)) {
    zone = timeZoneOption;
  } else if (typeof timeZoneOption === "number") {
    zone = zoneMakeOffset(timeZoneOption);
  } else {
    const parsedZone = zoneFromString(timeZoneOption);
    if (isNone2(parsedZone)) {
      throw new IllegalArgumentError2(`Invalid time zone: ${timeZoneOption}`);
    }
    zone = parsedZone.value;
  }
  if (options?.adjustForTimeZone !== true) {
    return makeZonedProto(self.epochMilliseconds, zone, self.partsUtc);
  }
  return makeZonedFromAdjusted(self.epochMilliseconds, zone, options?.disambiguation ?? "compatible");
};
var makeZoned = /* @__PURE__ */ liftThrowable(makeZonedUnsafe);
var make6 = /* @__PURE__ */ liftThrowable(makeUnsafe4);
var zonedStringRegExp = /^(.{17,35})\[(.+)\]$/;
var makeZonedFromString = (input) => {
  const match7 = zonedStringRegExp.exec(input);
  if (match7 === null) {
    const offset = parseOffset(input);
    return offset !== null ? makeZoned(input, {
      timeZone: offset
    }) : none2();
  }
  const [, isoString, timeZone] = match7;
  return makeZoned(isoString, {
    timeZone
  });
};
var toUtc = (self) => makeUtc(self.epochMilliseconds);
var validZoneCache = /* @__PURE__ */ new Map();
var formatOptions = {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  era: "short",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  timeZoneName: "longOffset",
  fractionalSecondDigits: 3,
  hourCycle: "h23"
};
var zoneMakeIntl = (format9) => {
  const zoneId = format9.resolvedOptions().timeZone;
  const cached3 = validZoneCache.get(zoneId);
  if (cached3 !== void 0) {
    return cached3;
  }
  const zone = Object.create(ProtoTimeZoneNamed);
  zone.id = zoneId;
  zone.format = format9;
  validZoneCache.set(zoneId, zone);
  return zone;
};
var zoneMakeNamedUnsafe = (zoneId) => {
  const cached3 = validZoneCache.get(zoneId);
  if (cached3 !== void 0) {
    return cached3;
  }
  try {
    const zone = zoneMakeIntl(new Intl.DateTimeFormat("en-US", {
      ...formatOptions,
      timeZone: zoneId
    }));
    validZoneCache.set(zoneId, zone);
    return zone;
  } catch {
    throw new IllegalArgumentError2(`Invalid time zone: ${zoneId}`);
  }
};
var zoneMakeOffset = (offset) => {
  const zone = Object.create(ProtoTimeZoneOffset);
  zone.offset = offset;
  return zone;
};
var zoneMakeNamed = /* @__PURE__ */ liftThrowable(zoneMakeNamedUnsafe);
var offsetZoneRegExp = /^(?:GMT)?[+-]/;
var zoneFromString = (zone) => {
  if (offsetZoneRegExp.test(zone)) {
    const offset = parseOffset(zone);
    return offset === null ? none2() : some2(zoneMakeOffset(offset));
  }
  return zoneMakeNamed(zone);
};
var zoneToString = (self) => {
  if (self._tag === "Offset") {
    return offsetToString(self.offset);
  }
  return self.id;
};
var toDateUtc = (self) => new Date(self.epochMilliseconds);
var toDate = (self) => {
  if (self._tag === "Utc") {
    return new Date(self.epochMilliseconds);
  } else if (self.zone._tag === "Offset") {
    return new Date(self.epochMilliseconds + self.zone.offset);
  } else if (self.adjustedEpochMilliseconds !== void 0) {
    return new Date(self.adjustedEpochMilliseconds);
  }
  let bc = false;
  const parts2 = self.zone.format.formatToParts(self.epochMilliseconds).filter((_) => {
    if (_.type === "era") {
      bc = _.value === "BC";
      return false;
    }
    return _.type !== "literal";
  });
  const year = Number(parts2[2].value);
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(bc ? 1 - year : year, Number(parts2[0].value) - 1, Number(parts2[1].value));
  date.setUTCHours(Number(parts2[3].value), Number(parts2[4].value), Number(parts2[5].value), parts2[6]?.type === "fractionalSecond" ? Number(parts2[6].value) : (self.epochMilliseconds % 1e3 + 1e3) % 1e3);
  self.adjustedEpochMilliseconds = date.getTime();
  return date;
};
var zonedOffset = (self) => {
  const date = toDate(self);
  return date.getTime() - toEpochMillis(self);
};
var offsetToString = (offset) => {
  const abs2 = Math.abs(offset);
  let hours = Math.floor(abs2 / (60 * 60 * 1e3));
  let minutes = Math.round(abs2 % (60 * 60 * 1e3) / (60 * 1e3));
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return `${offset < 0 ? "-" : "+"}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};
var zonedOffsetIso = (self) => offsetToString(zonedOffset(self));
var toEpochMillis = (self) => self.epochMilliseconds;
var setPartsDate = (date, parts2) => {
  if (parts2.year !== void 0 || parts2.month !== void 0 || parts2.day !== void 0) {
    date.setUTCFullYear(parts2.year ?? date.getUTCFullYear(), parts2.month !== void 0 ? parts2.month - 1 : date.getUTCMonth(), parts2.day ?? date.getUTCDate());
  }
  if (parts2.weekDay !== void 0) {
    const diff = parts2.weekDay - date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + diff);
  }
  if (parts2.hour !== void 0) {
    date.setUTCHours(parts2.hour);
  }
  if (parts2.minute !== void 0) {
    date.setUTCMinutes(parts2.minute);
  }
  if (parts2.second !== void 0) {
    date.setUTCSeconds(parts2.second);
  }
  if (parts2.millisecond !== void 0) {
    date.setUTCMilliseconds(parts2.millisecond);
  }
};
var constDayMillis = 24 * 60 * 60 * 1e3;
var makeZonedFromAdjusted = (adjustedMillis, zone, disambiguation) => {
  if (zone._tag === "Offset") {
    return makeZonedProto(adjustedMillis - zone.offset, zone);
  }
  const beforeOffset = calculateNamedOffset(adjustedMillis - constDayMillis, adjustedMillis, zone);
  const afterOffset = calculateNamedOffset(adjustedMillis + constDayMillis, adjustedMillis, zone);
  if (beforeOffset === afterOffset) {
    return makeZonedProto(adjustedMillis - beforeOffset, zone);
  }
  const isForwards = beforeOffset < afterOffset;
  const transitionMillis = beforeOffset - afterOffset;
  if (isForwards) {
    const currentAfterOffset = calculateNamedOffset(adjustedMillis - afterOffset, adjustedMillis, zone);
    if (currentAfterOffset === afterOffset) {
      return makeZonedProto(adjustedMillis - afterOffset, zone);
    }
    const before = makeZonedProto(adjustedMillis - beforeOffset, zone);
    const beforeAdjustedMillis = toDate(before).getTime();
    if (adjustedMillis !== beforeAdjustedMillis) {
      switch (disambiguation) {
        case "reject": {
          const formatted = new Date(adjustedMillis).toISOString();
          throw new RangeError(`Gap time: ${formatted} does not exist in time zone ${zone.id}`);
        }
        case "earlier":
          return makeZonedProto(adjustedMillis - afterOffset, zone);
        case "compatible":
        case "later":
          return before;
      }
    }
    return before;
  }
  const currentBeforeOffset = calculateNamedOffset(adjustedMillis - beforeOffset, adjustedMillis, zone);
  if (currentBeforeOffset === beforeOffset) {
    if (disambiguation === "earlier" || disambiguation === "compatible") {
      return makeZonedProto(adjustedMillis - beforeOffset, zone);
    }
    const laterOffset = calculateNamedOffset(adjustedMillis - beforeOffset + transitionMillis, adjustedMillis + transitionMillis, zone);
    if (laterOffset === beforeOffset) {
      return makeZonedProto(adjustedMillis - beforeOffset, zone);
    }
    if (disambiguation === "reject") {
      const formatted = new Date(adjustedMillis).toISOString();
      throw new RangeError(`Ambiguous time: ${formatted} occurs twice in time zone ${zone.id}`);
    }
  }
  return makeZonedProto(adjustedMillis - afterOffset, zone);
};
var offsetRegExp = /([+-])(\d{2}):?(\d{2})$/;
var parseOffset = (offset) => {
  const match7 = offsetRegExp.exec(offset);
  if (match7 === null) {
    return null;
  }
  const [, sign2, hours, minutes] = match7;
  return (sign2 === "+" ? 1 : -1) * (Number(hours) * 60 + Number(minutes)) * 60 * 1e3;
};
var calculateNamedOffset = (utcMillis, adjustedMillis, zone) => {
  const offset = zone.format.formatToParts(utcMillis).find((_) => _.type === "timeZoneName")?.value ?? "";
  if (offset === "GMT") {
    return 0;
  }
  const result3 = parseOffset(offset);
  if (result3 === null) {
    return zonedOffset(makeZonedProto(adjustedMillis, zone));
  }
  return result3;
};
var formatIso = (self) => toDateUtc(self).toISOString();
var formatIsoOffset = (self) => {
  const date = toDate(self);
  return self._tag === "Utc" ? date.toISOString() : `${date.toISOString().slice(0, -1)}${zonedOffsetIso(self)}`;
};
var formatIsoZoned = (self) => self.zone._tag === "Offset" ? formatIsoOffset(self) : `${formatIsoOffset(self)}[${self.zone.id}]`;

// node_modules/effect/dist/Number.js
var Number3 = globalThis.Number;
var remainder = /* @__PURE__ */ dual(2, (self, divisor) => {
  if (!globalThis.Number.isFinite(self) || !globalThis.Number.isFinite(divisor) || divisor === 0) {
    return NaN;
  }
  if (globalThis.Number.isInteger(self) && globalThis.Number.isInteger(divisor)) {
    return self % divisor;
  }
  const [selfCoefficient, selfExponent] = toScientificInteger(self);
  const [divisorCoefficient, divisorExponent] = toScientificInteger(divisor);
  const exponent = Math.min(selfExponent, divisorExponent);
  const selfInteger = selfCoefficient * BigInt(10) ** BigInt(selfExponent - exponent);
  const divisorInteger = divisorCoefficient * BigInt(10) ** BigInt(divisorExponent - exponent);
  const out = selfInteger % divisorInteger;
  if (out === BigInt(0)) {
    return self < 0 || Object.is(self, -0) ? -0 : 0;
  }
  const remainder2 = globalThis.Number(`${out}e${exponent}`);
  return remainder2 === 0 ? Math.sign(self) * globalThis.Number.MIN_VALUE : remainder2;
});
function toScientificInteger(n) {
  if (globalThis.Number.isInteger(n)) {
    return [BigInt(n), 0];
  }
  const scientific = Math.abs(n).toExponential();
  const eIndex = scientific.indexOf("e");
  const digits = scientific.slice(0, eIndex).replace(".", "");
  const coefficient = BigInt(digits) * (n < 0 ? -BigInt(1) : BigInt(1));
  return [coefficient, globalThis.Number(scientific.slice(eIndex + 1)) - digits.length + 1];
}

// node_modules/effect/dist/String.js
var String3 = globalThis.String;
var trim = (self) => self.trim();

// node_modules/effect/dist/Pull.js
var catchDone = /* @__PURE__ */ dual(2, (effect, f) => catchCauseFilter(effect, filterDoneLeftover, (l) => f(l)));
var isDoneFailure = (failure) => failure._tag === "Fail" && isDone2(failure.error);
var filterDone = (cause) => {
  let done3;
  let hasFailure = false;
  for (const reason of cause.reasons) {
    if (isDoneFailure(reason)) {
      done3 ??= reason.error;
    } else if (reason._tag !== "Interrupt") {
      hasFailure = true;
    }
  }
  if (done3 === void 0) return fail2(cause);
  return hasFailure ? fail2(fromReasons(cause.reasons.filter((reason) => !isDoneFailure(reason)))) : succeed2(done3);
};
var filterDoneLeftover = (cause) => {
  const done3 = filterDone(cause);
  return isFailure2(done3) ? done3 : succeed2(done3.success.value);
};
var matchEffect2 = /* @__PURE__ */ dual(2, (self, options) => matchCauseEffect(self, {
  onSuccess: options.onSuccess,
  onFailure: (cause) => {
    const halt = filterDone(cause);
    return !isFailure2(halt) ? options.onDone(halt.success.value) : options.onFailure(halt.failure);
  }
}));

// node_modules/effect/dist/Schedule.js
var TypeId8 = "~effect/Schedule";
var CurrentMetadata = /* @__PURE__ */ Reference("effect/Schedule/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    input: void 0,
    output: void 0,
    duration: zero,
    attempt: 0,
    start: 0,
    now: 0,
    elapsed: 0,
    elapsedSincePrevious: 0
  })
});
var ScheduleProto = {
  [TypeId8]: {
    _Out: identity,
    _In: identity,
    _Env: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isSchedule = (u) => hasProperty(u, TypeId8);
var fromStep = (step) => {
  const self = Object.create(ScheduleProto);
  self.step = step;
  return self;
};
var metadataFn = () => {
  let n = 0;
  let previous;
  let start;
  return (now2, input) => {
    if (start === void 0) start = now2;
    const elapsed = now2 - start;
    const elapsedSincePrevious = previous === void 0 ? 0 : now2 - previous;
    previous = now2;
    return {
      input,
      attempt: ++n,
      start,
      now: now2,
      elapsed,
      elapsedSincePrevious
    };
  };
};
var fromStepWithMetadata = (step) => fromStep(map5(step, (f) => {
  const meta = metadataFn();
  return (now2, input) => f(meta(now2, input));
}));
var toStep = (schedule2) => catchCause(schedule2.step, (cause) => succeed3(() => failCause(cause)));
var toStepWithMetadata = (schedule2) => clockWith((clock) => map5(toStep(schedule2), (step) => {
  const metaFn = metadataFn();
  return (input) => suspend(() => {
    const now2 = clock.currentTimeMillisUnsafe();
    return flatMap3(step(now2, input), ([output, duration]) => {
      const meta = metaFn(now2, input);
      meta.output = output;
      meta.duration = duration;
      return as(sleep(duration), meta);
    });
  });
}));
var passthrough = (self) => fromStep(map5(toStep(self), (step) => (now2, input) => matchEffect2(step(now2, input), {
  onSuccess: (result3) => succeed3([input, result3[1]]),
  onFailure: failCause,
  onDone: () => done2(input)
})));
var recurs = (times) => while_(forever2, ({
  attempt: attempt3
}) => succeed3(attempt3 <= times));
var spaced = (duration) => {
  const decoded = fromInputUnsafe(duration);
  return fromStepWithMetadata(succeed3((meta) => succeed3([meta.attempt - 1, decoded])));
};
var while_ = /* @__PURE__ */ dual(2, (self, predicate) => fromStep(map5(toStep(self), (step) => {
  const meta = metadataFn();
  return (now2, input) => flatMap3(step(now2, input), (result3) => {
    const [output, duration] = result3;
    const eff = predicate({
      ...meta(now2, input),
      output,
      duration
    });
    return flatMap3(isEffect(eff) ? eff : succeed3(eff), (check2) => check2 ? succeed3(result3) : done2(output));
  });
})));
var forever2 = /* @__PURE__ */ spaced(zero);

// node_modules/effect/dist/ExecutionPlan.js
var TypeId9 = "~effect/ExecutionPlan";
var Proto3 = {
  [TypeId9]: TypeId9,
  get captureRequirements() {
    const self = this;
    return contextWith((context3) => succeed3(makeProto(self.steps.map((step) => ({
      ...step,
      while: step.while ? (input) => provideContext(step.while(input), context3) : void 0,
      schedule: step.schedule ? fromStep(provideContext(map5(toStep(step.schedule), (next) => (now2, input) => provideContext(next(now2, input), context3)), context3)) : void 0,
      provide: isLayer(step.provide) ? provide2(step.provide, succeedContext(context3)) : step.provide
    })))));
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeProto = (steps) => {
  const self = Object.create(Proto3);
  self.steps = steps;
  return self;
};
var CurrentMetadata2 = /* @__PURE__ */ Reference("effect/ExecutionPlan/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    attempt: 0,
    stepIndex: 0
  })
});

// node_modules/effect/dist/internal/layer.js
var provideLayer = (self, layer, options) => scopedWith((scope3) => flatMap3(options?.local ? buildWithMemoMap(layer, makeMemoMapUnsafe(), scope3) : buildWithScope(layer, scope3), (context3) => provideContext(self, context3)));
var provide3 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, source, options) => isContext(source) ? provideContext(self, source) : provideLayer(self, Array.isArray(source) ? mergeAll2(...source) : source, options));

// node_modules/effect/dist/internal/schedule.js
var repeatOrElse = /* @__PURE__ */ dual(3, (self, schedule2, orElse2) => flatMap3(toStepWithMetadata(schedule2), (step) => {
  let meta = CurrentMetadata.defaultValue();
  const loop = (input) => matchEffect2(step(input), {
    onSuccess(meta_) {
      meta = meta_;
      return flatMap3(provideService(self, CurrentMetadata, meta), loop);
    },
    onFailure: failCause,
    onDone: succeed3
  });
  return catchCauseFilter(flatMap3(provideService(self, CurrentMetadata, meta), loop), findRecoverableError, (error) => orElse2(error, meta.attempt === 0 ? none2() : some2(meta)));
}));
var retryOrElse = /* @__PURE__ */ dual(3, (self, policy, orElse2) => flatMap3(toStepWithMetadata(policy), (step) => {
  let meta = CurrentMetadata.defaultValue();
  let lastError;
  const loop = catchCauseFilter(suspend(() => provideService(self, CurrentMetadata, meta)), findRecoverableError, (error) => {
    lastError = error;
    return flatMap3(step(error), (meta_) => {
      meta = meta_;
      return loop;
    });
  });
  return catchDone(loop, (out) => internalCall(() => orElse2(lastError, out)));
}));
var repeat = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return repeatOrElse(self, schedule2, fail3);
});
var retry = /* @__PURE__ */ dual(2, (self, options) => {
  const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return retryOrElse(self, schedule2, fail3);
});
var scheduleFrom = /* @__PURE__ */ dual(3, (self, initial, schedule2) => flatMap3(toStepWithMetadata(schedule2), (step) => {
  const loop = (input) => matchEffect2(step(input), {
    onSuccess: (meta) => flatMap3(provideService(self, CurrentMetadata, meta), loop),
    onFailure: failCause,
    onDone: succeed3
  });
  return loop(initial);
}));
var passthroughForever = /* @__PURE__ */ passthrough(forever2);
var buildFromOptions = (options) => {
  let schedule2 = options.schedule ? passthrough(options.schedule) : passthroughForever;
  if (options.while) {
    schedule2 = while_(schedule2, ({
      input
    }) => {
      const applied = options.while(input);
      return isEffect(applied) ? applied : succeed3(applied);
    });
  }
  if (options.until) {
    schedule2 = while_(schedule2, ({
      input
    }) => {
      const applied = options.until(input);
      return isEffect(applied) ? map5(applied, (b) => !b) : succeed3(!applied);
    });
  }
  if (options.times !== void 0) {
    schedule2 = while_(schedule2, ({
      attempt: attempt3
    }) => succeed3(attempt3 <= options.times));
  }
  return schedule2;
};

// node_modules/effect/dist/internal/executionPlan.js
var makeEventEmitter = (onEvent, currentMetadata) => {
  let lastStepIndex = -1;
  let stepAttempt = 0;
  const emit = (event) => ignoreCause(onEvent(event));
  return {
    begin: clockWith((clock) => suspend(() => {
      const meta = currentMetadata();
      if (meta.stepIndex !== lastStepIndex) {
        lastStepIndex = meta.stepIndex;
        stepAttempt = 0;
      }
      stepAttempt++;
      const state = {
        attempt: meta.attempt,
        stepAttempt,
        stepIndex: meta.stepIndex,
        startNanos: clock.monotonicTimeNanosUnsafe()
      };
      return as(emit({
        _tag: "AttemptStart",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex
      }), state);
    })),
    end: (state, exit3) => clockWith((clock) => {
      const duration = nanos(clock.monotonicTimeNanosUnsafe() - state.startNanos);
      return emit(exit3._tag === "Success" ? {
        _tag: "AttemptSuccess",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex,
        duration
      } : {
        _tag: "AttemptFailure",
        attempt: state.attempt,
        stepAttempt: state.stepAttempt,
        stepIndex: state.stepIndex,
        duration,
        cause: exit3.cause
      });
    })
  };
};
var withExecutionPlan = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self, plan, options) => suspend(() => {
  let i = 0;
  let meta = {
    attempt: 0,
    stepIndex: 0
  };
  const provideMeta = provideServiceEffect(CurrentMetadata2, sync(() => {
    meta = {
      attempt: meta.attempt + 1,
      stepIndex: i
    };
    return meta;
  }));
  const emitter = options?.onEvent === void 0 ? void 0 : makeEventEmitter(options.onEvent, () => meta);
  const instrument = emitter === void 0 ? identity : (attempt3) => uninterruptibleMask((restore) => flatMap3(emitter.begin, (state) => onExit(restore(attempt3), (exit3) => emitter.end(state, exit3))));
  let result3;
  return flatMap3(whileLoop({
    while: () => i < plan.steps.length && (result3 === void 0 || isFailure2(result3)),
    body() {
      const step = plan.steps[i];
      let nextEffect = provideMeta(instrument(provide3(self, step.provide)));
      if (result3) {
        let attempted = false;
        const wrapped = nextEffect;
        nextEffect = suspend(() => {
          if (attempted) return wrapped;
          attempted = true;
          return fromResult(result3);
        });
        nextEffect = retry(nextEffect, scheduleFromStep(step, false));
      } else {
        const schedule2 = scheduleFromStep(step, true);
        nextEffect = schedule2 ? retry(nextEffect, schedule2) : nextEffect;
      }
      return result(nextEffect);
    },
    step(result_) {
      result3 = result_;
      i++;
    }
  }), () => fromResult(result3));
}));
var scheduleFromStep = (step, first) => {
  if (!first) {
    return buildFromOptions({
      schedule: step.schedule ? step.schedule : step.attempts ? void 0 : scheduleOnce,
      times: step.attempts,
      while: step.while
    });
  } else if (step.attempts === 1 || !(step.schedule || step.attempts)) {
    return void 0;
  }
  return buildFromOptions({
    schedule: step.schedule,
    while: step.while,
    times: step.attempts ? step.attempts - 1 : void 0
  });
};
var scheduleOnce = /* @__PURE__ */ recurs(1);

// node_modules/effect/dist/MutableHashMap.js
var TypeId10 = "~effect/MutableHashMap";
var MutableHashMapProto = {
  [TypeId10]: TypeId10,
  [Symbol.iterator]() {
    return this.backing[Symbol.iterator]();
  },
  toString() {
    return `MutableHashMap(${format(Array.from(this))})`;
  },
  toJSON() {
    return {
      _id: "MutableHashMap",
      values: toJson(Array.from(this))
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var empty3 = () => {
  const self = Object.create(MutableHashMapProto);
  self.backing = /* @__PURE__ */ new Map();
  self.buckets = /* @__PURE__ */ new Map();
  return self;
};
var get2 = /* @__PURE__ */ dual(2, (self, key) => {
  if (self.backing.has(key)) {
    return some2(self.backing.get(key));
  } else if (isSimpleKey(key)) {
    return none2();
  }
  const hash2 = hash(key);
  const bucket = self.buckets.get(hash2);
  if (bucket === void 0) {
    return none2();
  }
  return getFromBucket(self, bucket, key);
});
var isSimpleKey = (u) => typeof u !== "object" && typeof u !== "function";
var getFromBucket = (self, bucket, key) => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (equals(key, bucket[i])) {
      const refKey = bucket[i];
      return some2(self.backing.get(refKey));
    }
  }
  return none2();
};
var has2 = /* @__PURE__ */ dual(2, (self, key) => isSome2(get2(self, key)));
var set = /* @__PURE__ */ dual(3, (self, key, value3) => {
  if (self.backing.has(key) || isSimpleKey(key)) {
    self.backing.set(key, value3);
    return self;
  }
  const hash2 = hash(key);
  const bucket = self.buckets.get(hash2);
  if (bucket === void 0) {
    self.buckets.set(hash2, [key]);
    self.backing.set(key, value3);
    return self;
  }
  let refKey = getRefKey(bucket, key);
  if (refKey === void 0) {
    bucket.push(key);
    refKey = key;
  }
  self.backing.set(refKey, value3);
  return self;
});
var getRefKey = (bucket, key) => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (equals(key, bucket[i])) {
      return bucket[i];
    }
  }
};
var remove = /* @__PURE__ */ dual(2, (self, key_) => {
  if (isSimpleKey(key_)) {
    self.backing.delete(key_);
    return self;
  }
  const hash2 = hash(key_);
  const bucket = self.buckets.get(hash2);
  if (bucket === void 0) {
    return self;
  }
  for (let i = 0, len = bucket.length; i < len; i++) {
    const bkey = bucket[i];
    if (bkey === key_ || equals(key_, bkey)) {
      self.backing.delete(bkey);
      bucket.splice(i, 1);
      break;
    }
  }
  if (bucket.length === 0) {
    self.buckets.delete(hash2);
  }
  return self;
});

// node_modules/effect/dist/Request.js
var TypeId11 = "~effect/Request";
var requestVariance = /* @__PURE__ */ byReferenceUnsafe({
  /* c8 ignore next */
  _E: (_) => _,
  /* c8 ignore next */
  _A: (_) => _,
  /* c8 ignore next */
  _R: (_) => _
});
var RequestPrototype = {
  ...StructuralProto,
  [TypeId11]: requestVariance
};
var makeEntry = (options) => options;

// node_modules/effect/dist/internal/request.js
var request = /* @__PURE__ */ dual(2, (self, resolver) => {
  const withResolver = (resolver2) => callback((resume) => {
    const entry = addEntry(resolver2, self, resume, getCurrentFiber());
    return maybeRemoveEntry(resolver2, entry);
  });
  return isEffect(resolver) ? flatMap3(resolver, withResolver) : withResolver(resolver);
});
var requestUnsafe = (self, options) => {
  const entry = addEntry(options.resolver, self, options.onExit, {
    context: options.context,
    cache: {
      scheduler: get(options.context, Scheduler)
    }
  });
  return () => removeEntryUnsafe(options.resolver, entry);
};
var equalBatchKeys = /* @__PURE__ */ new WeakSet();
var makeBatchMap = (resolver) => {
  if (!equalBatchKeys.has(resolver.batchKey)) return /* @__PURE__ */ new Map();
  const map10 = empty3();
  return {
    get: (key) => getOrUndefined(get2(map10, key)),
    has: (key) => has2(map10, key),
    set: (key, batch) => set(map10, key, batch),
    delete: (key) => remove(map10, key)
  };
};
var batchPool = [];
var pendingBatches = /* @__PURE__ */ new WeakMap();
var addEntry = (resolver, request3, resume, fiber3) => {
  let batchMap = pendingBatches.get(resolver);
  if (!batchMap) {
    batchMap = makeBatchMap(resolver);
    pendingBatches.set(resolver, batchMap);
  }
  let batch;
  let completed = false;
  const entry = makeEntry({
    request: request3,
    context: fiber3.context,
    uninterruptible: false,
    completeUnsafe(effect) {
      if (completed) return;
      completed = true;
      if (batch && !batch.entrySet.delete(entry)) return;
      resume(effect);
    }
  });
  if (resolver.preCheck !== void 0 && !resolver.preCheck(entry)) {
    return entry;
  }
  const key = resolver.batchKey(entry);
  batch = batchMap.get(key);
  const isNewBatch = batch === void 0;
  if (!batch) {
    if (batchPool.length > 0) {
      batch = batchPool.pop();
      batch.key = key;
      batch.context = fiber3.context;
      batch.resolver = resolver;
      batch.map = batchMap;
    } else {
      const newBatch = {
        key,
        context: fiber3.context,
        resolver,
        map: batchMap,
        entrySet: /* @__PURE__ */ new Set(),
        entries: /* @__PURE__ */ new Set(),
        delayEffect: flatMap3(withFiber((delayFiber) => {
          newBatch.fiber = delayFiber;
          return newBatch.resolver.delay;
        }), (_) => runBatch(newBatch)),
        run: onExit(suspend(() => newBatch.resolver.runAll(Array.from(newBatch.entries), newBatch.key)), (exit3) => {
          for (const entry2 of newBatch.entrySet) {
            entry2.completeUnsafe(exit3._tag === "Success" ? exitDie(new Error("Effect.request: RequestResolver did not complete request", {
              cause: entry2.request
            })) : exit3);
          }
          newBatch.entries.clear();
          if (batchPool.length < 128) {
            newBatch.entrySet.clear();
            newBatch.key = void 0;
            newBatch.context = void 0;
            newBatch.fiber = void 0;
            newBatch.resolver = void 0;
            newBatch.map = void 0;
            batchPool.push(newBatch);
          }
          return void_2;
        })
      };
      batch = newBatch;
    }
    batchMap.set(key, batch);
  }
  batch.entrySet.add(entry);
  batch.entries.add(entry);
  if (isNewBatch) {
    const delayFiber = runForkWith(fiber3.context)(batch.delayEffect, {
      scheduler: fiber3.cache.scheduler
    });
    if (completed || batchMap.get(key) !== batch) return entry;
    batch.fiber = delayFiber;
  }
  if (batch.resolver.collectWhile(batch.entries)) return entry;
  batch.fiber.interruptUnsafe(fiber3.id);
  runForkWith(batch.context)(runBatch(batch), {
    scheduler: get(batch.context, Scheduler)
  });
  return entry;
};
var removeEntryUnsafe = (resolver, entry) => {
  if (entry.uninterruptible) return;
  const batchMap = pendingBatches.get(resolver);
  if (!batchMap) return;
  const key = resolver.batchKey(entry);
  const batch = batchMap.get(key);
  if (!batch) return;
  if (!batch.entries.delete(entry)) return;
  batch.entrySet.delete(entry);
  let fiber3;
  if (batch.entries.size === 0) {
    batchMap.delete(key);
    fiber3 = batch.fiber;
  }
  entry.completeUnsafe(exitInterrupt());
  fiber3?.interruptUnsafe();
};
var maybeRemoveEntry = (resolver, entry) => sync(() => removeEntryUnsafe(resolver, entry));
function runBatch(batch) {
  if (!batch.map.has(batch.key)) return void_2;
  batch.map.delete(batch.key);
  return batch.run;
}

// node_modules/effect/dist/Metric.js
var CurrentMetricAttributesKey = "effect/Metric/CurrentMetricAttributes";
var CurrentMetricAttributes = /* @__PURE__ */ Reference(CurrentMetricAttributesKey, {
  defaultValue: () => ({})
});
var MetricRegistryKey = "effect/Metric/MetricRegistry";
var MetricRegistry = /* @__PURE__ */ Reference(MetricRegistryKey, {
  defaultValue: () => /* @__PURE__ */ new Map()
});
var TypeId12 = "~effect/Metric";
var Metric$ = class {
  [TypeId12] = TypeId12;
  #extraAttributes;
  #mergedAttributes;
  #key = "";
  id;
  description;
  attributes;
  constructor(id2, description, attributes) {
    this.id = id2;
    this.description = description;
    this.attributes = attributes;
  }
  valueUnsafe(context3) {
    return this.hook(context3).get(context3);
  }
  modifyUnsafe(input, context3) {
    return this.hook(context3).modify(input, context3);
  }
  updateUnsafe(input, context3) {
    return this.hook(context3).update(input, context3);
  }
  hook(context3) {
    const key = this.key(context3);
    const registry = get(context3, MetricRegistry);
    let metadata = registry.get(key);
    if (isUndefined(metadata)) {
      metadata = this.metadata(this.createHooks());
      registry.set(key, metadata);
    }
    return metadata.hooks;
  }
  removeUnsafe(context3) {
    get(context3, MetricRegistry).delete(this.key(context3));
  }
  registerUnsafe(context3, hooks) {
    const key = this.key(context3);
    const registry = get(context3, MetricRegistry);
    const metadata = this.metadata({
      get: hooks.get,
      update: constVoid,
      modify: constVoid
    });
    registry.set(key, metadata);
    return {
      remove() {
        if (registry.get(key) === metadata) {
          registry.delete(key);
        }
      }
    };
  }
  // Merges the attributes once per contextual attribute set, so series key and
  // metadata share the result.
  key(context3) {
    const extraAttributes = get(context3, CurrentMetricAttributes);
    if (extraAttributes !== this.#extraAttributes) {
      this.#extraAttributes = extraAttributes;
      const merged = mergeAttributes(this.attributes, extraAttributes);
      this.#mergedAttributes = Object.keys(extraAttributes).length > 0 ? merged : this.attributes;
      this.#key = makeKey(this, merged);
    }
    return this.#key;
  }
  // Must follow `key(context)`, which computes the merged attributes.
  metadata(hooks) {
    return {
      id: this.id,
      type: this.type,
      description: this.description,
      attributes: this.#mergedAttributes,
      hooks
    };
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var update = /* @__PURE__ */ dual(2, (self, input) => contextWith((services) => sync(() => self.updateUnsafe(input, services))));
function makeKey(metric, attributes) {
  const entries3 = Object.entries(attributes).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return JSON.stringify([metric.type, metric.id, metric.description, entries3]);
}
function mergeAttributes(self, other) {
  return {
    ...attributesToRecord(self),
    ...attributesToRecord(other)
  };
}
function attributesToRecord(attributes) {
  if (isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value3]) => {
      assignProperty(acc, key, value3);
      return acc;
    }, {});
  }
  return attributes;
}

// node_modules/effect/dist/Effect.js
var TypeId13 = EffectTypeId;
var isEffect2 = isEffect;
var all3 = all2;
var partition3 = partition2;
var reduce2 = reduce;
var validate2 = validate;
var findFirst4 = findFirst3;
var findFirstFilter2 = findFirstFilter;
var forEach2 = forEach;
var head2 = head;
var whileLoop2 = whileLoop;
var promise2 = promise;
var tryPromise2 = tryPromise;
var succeed5 = succeed3;
var succeedNone3 = succeedNone2;
var succeedSome3 = succeedSome2;
var suspend2 = suspend;
var sync2 = sync;
var void_4 = void_2;
var undefined_2 = undefined_;
var callback2 = callback;
var never2 = never;
var Do3 = Do2;
var bindTo4 = bindTo3;
var let_4 = let_3;
var bind4 = bind3;
var gen3 = gen2;
var fail5 = fail3;
var failSync2 = failSync;
var failCause3 = failCause;
var failCauseSync2 = failCauseSync;
var die3 = die;
var try_3 = try_2;
var yieldNow2 = yieldNow;
var yieldNowWith2 = yieldNowWith;
var withFiber2 = withFiber;
var withFiberSucceed2 = withFiberSucceed;
var fromResult2 = fromResult;
var fromOption4 = fromOption3;
var transposeOption3 = transposeOption2;
var fromNullishOr4 = fromNullishOr3;
var flatMap4 = flatMap3;
var flatten4 = flatten3;
var andThen3 = andThen2;
var tap3 = tap2;
var result2 = result;
var option2 = option;
var exit2 = exit;
var map7 = map5;
var as2 = as;
var asSome2 = asSome;
var asVoid2 = asVoid;
var flip3 = flip2;
var zip2 = zip;
var zipWith2 = zipWith;
var catch_2 = catch_;
var catchTag2 = catchTag;
var catchTags2 = catchTags;
var catchReason2 = catchReason;
var catchReasons2 = catchReasons;
var unwrapReason2 = unwrapReason;
var catchCause2 = catchCause;
var catchDefect2 = catchDefect;
var catchIf2 = catchIf;
var catchFilter2 = catchFilter;
var catchNoSuchElement2 = catchNoSuchElement;
var catchCauseIf2 = catchCauseIf;
var catchCauseFilter2 = catchCauseFilter;
var mapError3 = mapError2;
var mapBoth3 = mapBoth2;
var orDie2 = orDie;
var tapError2 = tapError;
var tapErrorTag2 = tapErrorTag;
var tapCause2 = tapCause;
var tapCauseIf2 = tapCauseIf;
var tapCauseFilter2 = tapCauseFilter;
var tapDefect2 = tapDefect;
var eventually2 = eventually;
var retry2 = retry;
var retryOrElse2 = retryOrElse;
var sandbox2 = sandbox;
var ignore2 = ignore;
var ignoreCause2 = ignoreCause;
var withExecutionPlan2 = withExecutionPlan;
var withErrorReporting2 = withErrorReporting;
var orElseSucceed2 = orElseSucceed;
var firstSuccessOf2 = firstSuccessOf;
var timeout2 = timeout;
var timeoutOption2 = timeoutOption;
var timeoutOrElse2 = timeoutOrElse;
var delay2 = delay;
var sleep2 = sleep;
var timed2 = timed;
var raceAll2 = raceAll;
var raceAllFirst2 = raceAllFirst;
var race2 = race;
var raceFirst2 = raceFirst;
var filter4 = filter3;
var filterMap2 = filterMap;
var filterMapEffect2 = filterMapEffect;
var filterOrElse2 = filterOrElse;
var filterMapOrElse2 = filterMapOrElse;
var filterOrFail3 = filterOrFail2;
var filterMapOrFail2 = filterMapOrFail;
var when2 = when;
var match5 = match4;
var matchEager2 = matchEager;
var matchCause2 = matchCause;
var matchCauseEager2 = matchCauseEager;
var matchCauseEffectEager2 = matchCauseEffectEager;
var matchCauseEffect2 = matchCauseEffect;
var matchEffect3 = matchEffect;
var isFailure5 = isFailure3;
var isSuccess5 = isSuccess3;
var context2 = context;
var contextWith2 = contextWith;
var provide4 = provide3;
var provideContext2 = provideContext;
var setContext2 = setContext;
var service2 = service;
var serviceOption2 = serviceOption;
var updateContext2 = updateContext;
var updateService2 = updateService;
var updateServiceScoped2 = updateServiceScoped;
var provideService2 = provideService;
var provideServiceEffect2 = provideServiceEffect;
var scope2 = scope;
var scoped2 = scoped;
var scopedWith2 = scopedWith;
var acquireRelease2 = acquireRelease;
var acquireDisposable2 = acquireDisposable;
var acquireUseRelease2 = acquireUseRelease;
var addFinalizer2 = addFinalizer;
var ensuring2 = ensuring;
var onError2 = onError;
var onErrorIf2 = onErrorIf;
var onErrorFilter2 = onErrorFilter;
var onExitPrimitive2 = onExitPrimitive;
var onExit2 = onExit;
var onExitIf2 = onExitIf;
var onExitFilter2 = onExitFilter;
var cached2 = cached;
var cachedWithTTL2 = cachedWithTTL;
var cachedInvalidateWithTTL2 = cachedInvalidateWithTTL;
var interrupt2 = interrupt;
var interruptible2 = interruptible;
var onInterrupt2 = onInterrupt;
var uninterruptible2 = uninterruptible;
var uninterruptibleMask2 = uninterruptibleMask;
var interruptibleMask2 = interruptibleMask;
var abortSignal2 = abortSignal;
var forever3 = forever;
var repeat2 = repeat;
var repeatOrElse2 = repeatOrElse;
var replicate2 = replicate;
var replicateEffect2 = replicateEffect;
var schedule = /* @__PURE__ */ dual(2, (self, schedule2) => scheduleFrom2(self, void 0, schedule2));
var scheduleFrom2 = scheduleFrom;
var tracer2 = tracer;
var withTracer2 = withTracer;
var withTracerEnabled2 = withTracerEnabled;
var withTracerTiming2 = withTracerTiming;
var annotateSpans2 = annotateSpans;
var annotateCurrentSpan2 = annotateCurrentSpan;
var currentSpan2 = currentSpan;
var currentParentSpan2 = currentParentSpan;
var spanAnnotations2 = spanAnnotations;
var spanLinks2 = spanLinks;
var linkSpans2 = linkSpans;
var makeSpan2 = makeSpan;
var makeSpanScoped2 = makeSpanScoped;
var useSpan2 = useSpan;
var withSpan2 = withSpan;
var withSpanScoped2 = withSpanScoped;
var withParentSpan2 = withParentSpan;
var request2 = request;
var requestUnsafe2 = requestUnsafe;
var forkChild2 = forkChild;
var forkIn2 = forkIn;
var forkScoped2 = forkScoped;
var forkDetach2 = forkDetach;
var awaitAllChildren2 = awaitAllChildren;
var fiber2 = fiber;
var fiberId2 = fiberId;
var runFork2 = runFork;
var runForkWith2 = runForkWith;
var runCallbackWith2 = runCallbackWith;
var runCallback2 = runCallback;
var runPromise2 = runPromise;
var runPromiseWith2 = runPromiseWith;
var runPromiseExit2 = runPromiseExit;
var runPromiseExitWith2 = runPromiseExitWith;
var runSync2 = runSync;
var runSyncWith2 = runSyncWith;
var runSyncExit2 = runSyncExit;
var runSyncExitWith2 = runSyncExitWith;
var fnUntraced2 = fnUntraced;
var fn2 = fn;
var clockWith2 = clockWith;
var logWithLevel2 = logWithLevel;
var log = /* @__PURE__ */ logWithLevel();
var logFatal = /* @__PURE__ */ logWithLevel("Fatal");
var logWarning = /* @__PURE__ */ logWithLevel("Warn");
var logError = /* @__PURE__ */ logWithLevel("Error");
var logInfo = /* @__PURE__ */ logWithLevel("Info");
var logDebug = /* @__PURE__ */ logWithLevel("Debug");
var logTrace = /* @__PURE__ */ logWithLevel("Trace");
var withLogger = /* @__PURE__ */ dual(2, (effect, logger) => updateService(effect, CurrentLoggers, (loggers) => /* @__PURE__ */ new Set([...loggers, logger])));
var annotateLogs = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (effect, ...args2) => updateService(effect, CurrentLogAnnotations2, (annotations) => {
  const newAnnotations = args2.length === 1 ? {
    ...annotations,
    ...args2[0]
  } : {
    ...annotations
  };
  if (args2.length === 1) {
    return newAnnotations;
  } else {
    assignProperty(newAnnotations, args2[0], args2[1]);
  }
  return newAnnotations;
}));
var annotateLogsScoped2 = annotateLogsScoped;
var withLogSpan = /* @__PURE__ */ dual(2, (effect, label) => flatMap3(currentTimeMillis, (now2) => updateService(effect, CurrentLogSpans2, (spans) => {
  const span = [label, now2];
  return [span, ...spans];
})));
var track = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => onExit2(self, (exit3) => {
  const input = f === void 0 ? exit3 : f(exit3);
  return update(metric, input);
}));
var trackSuccesses = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tap3(self, (value3) => {
  const input = f === void 0 ? value3 : f(value3);
  return update(metric, input);
}));
var trackErrors = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapError2(self, (error) => {
  const input = f === void 0 ? error : f(error);
  return update(metric, input);
}));
var trackDefects = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => tapDefect2(self, (defect) => {
  const input = f === void 0 ? defect : f(defect);
  return update(metric, input);
}));
var trackDuration = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self, metric, f) => clockWith2((clock) => {
  const startTime = clock.monotonicTimeNanosUnsafe();
  return onExit2(self, () => {
    const endTime = clock.monotonicTimeNanosUnsafe();
    const duration = subtract(fromInputUnsafe(endTime), fromInputUnsafe(startTime));
    const input = f === void 0 ? duration : f(duration);
    return update(metric, input);
  });
}));
var Transaction = class extends (/* @__PURE__ */ Service()("effect/Effect/Transaction")) {
};
var tx = (effect) => withFiber2((fiber3) => {
  const state = getOrUndefined2(fiber3.context, Transaction);
  if (state && !completedTransactions.has(state)) {
    return effect;
  }
  const clock = fiber3.getRef(ClockRef);
  const now2 = clock.currentTimeMillisUnsafe();
  const mutable3 = {
    journal: /* @__PURE__ */ new Map(),
    retry: false,
    attempt: 1,
    retryReason: void 0,
    start: now2,
    now: now2,
    elapsed: 0,
    elapsedSincePrevious: 0
  };
  let result3;
  return uninterruptibleMask2((restore) => {
    const run2 = restore(effect).pipe(provideService2(Transaction, mutable3), tapCause2((cause) => {
      if (!mutable3.retry) return void_4;
      if (!hasInterruptsOnly(cause)) return sync2(() => clearTransaction(mutable3));
      return restore(awaitPendingTransaction(mutable3));
    }), exit2);
    return flatMap4(whileLoop2({
      while: () => !result3,
      body: () => {
        if (mutable3.attempt > 1) {
          stampTransaction(mutable3, clock.currentTimeMillisUnsafe());
        }
        return run2;
      },
      step(exit3) {
        if (mutable3.retry || !isTransactionConsistent(mutable3)) {
          mutable3.attempt++;
          mutable3.retryReason = mutable3.retry ? "retry" : "conflict";
          return clearTransaction(mutable3);
        }
        if (isSuccess4(exit3)) {
          commitTransaction(fiber3, mutable3);
        }
        clearTransaction(mutable3);
        completedTransactions.add(mutable3);
        result3 = exit3;
      }
    }), () => result3);
  });
});
var completedTransactions = /* @__PURE__ */ new WeakSet();
var stampTransaction = (state, now2) => {
  state.elapsedSincePrevious = now2 - state.now;
  state.now = now2;
  state.elapsed = now2 - state.start;
};
var isTransactionConsistent = (state) => {
  for (const [ref, {
    version
  }] of state.journal) {
    if (ref.version !== version) {
      return false;
    }
  }
  return true;
};
var awaitPendingTransaction = (state) => callback2((resume) => {
  if (!isTransactionConsistent(state)) {
    return resume(void_4);
  }
  const key = {};
  const refs = Array.from(state.journal.keys());
  const clearPending = () => {
    for (const clear of refs) {
      clear.pending.delete(key);
    }
  };
  const onCall = () => {
    clearPending();
    resume(void_4);
  };
  for (const ref of refs) {
    ref.pending.set(key, onCall);
  }
  return sync2(clearPending);
});
function commitTransaction(fiber3, state) {
  for (const [ref, {
    value: value3,
    written
  }] of state.journal) {
    if (!written) continue;
    if (!Object.is(value3, ref.value)) {
      ref.version = ref.version + 1;
      ref.value = value3;
    }
    for (const pending of ref.pending.values()) {
      fiber3.currentDispatcher.scheduleTask(pending, 0);
    }
    ref.pending.clear();
  }
}
function clearTransaction(state) {
  state.retry = false;
  state.journal.clear();
}
var txRetry = /* @__PURE__ */ flatMap4(Transaction, (state) => {
  const mutable3 = state;
  mutable3.retry = true;
  return interrupt2;
});
var effectify = (fn3, onError3, onSyncError) => (...args2) => callback2((resume) => {
  let synchronous = true;
  let pending;
  try {
    fn3(...args2, (err, result3) => {
      const effect = err ? onError3 ? suspend2(() => fail5(onError3(err, args2))) : fail5(err) : succeed5(result3);
      if (synchronous) {
        pending ??= effect;
      } else {
        resume(effect);
      }
    });
  } catch (err) {
    pending = onSyncError ? fail5(onSyncError(err, args2)) : die3(err);
  }
  synchronous = false;
  if (pending) {
    resume(pending);
  }
});
var satisfiesSuccessType = () => (effect) => effect;
var satisfiesErrorType = () => (effect) => effect;
var satisfiesServicesType = () => (effect) => effect;
var mapEager2 = mapEager;
var mapErrorEager2 = mapErrorEager;
var mapBothEager2 = mapBothEager;
var flatMapEager2 = flatMapEager;
var catchEager2 = catchEager;
var fnUntracedEager2 = fnUntracedEager;

// node_modules/effect/dist/BigDecimal.js
var FINITE_INT_REGEXP = /^[+-]?\d+$/;
var TypeId14 = "~effect/BigDecimal";
var BigDecimalProto = {
  [TypeId14]: TypeId14,
  [symbol]() {
    const normalized = normalize(this);
    return combine(string(String(normalized.value)), number(normalized.scale));
  },
  [symbol2](that) {
    return isBigDecimal(that) && compare(this, that) === 0;
  },
  toString() {
    return `BigDecimal(${format3(this)})`;
  },
  toJSON() {
    return {
      _id: "BigDecimal",
      value: String(this.value),
      scale: this.scale
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isBigDecimal = (u) => hasProperty(u, TypeId14);
var make7 = (value3, scale) => {
  if (!Number.isSafeInteger(scale)) {
    throw new RangeError(`Scale must be a safe integer, got ${scale}`);
  }
  const o = Object.create(BigDecimalProto);
  o.value = value3;
  o.scale = scale;
  return o;
};
var makeNormalized = (value3, scale) => {
  const o = make7(value3, scale);
  o.normalized = o;
  return o;
};
var bigint03 = /* @__PURE__ */ BigInt(0);
var bigint12 = /* @__PURE__ */ BigInt(1);
var bigint102 = /* @__PURE__ */ BigInt(10);
var zero2 = /* @__PURE__ */ makeNormalized(bigint03, 0);
var normalize = (self) => {
  if (self.normalized === void 0) {
    if (self.value === bigint03) {
      self.normalized = zero2;
    } else {
      const digits = `${self.value}`;
      let end = digits.length;
      while (digits[end - 1] === "0") end--;
      self.normalized = makeNormalized(BigInt(digits.slice(0, end)), self.scale - (digits.length - end));
    }
  }
  return self.normalized;
};
var MAX_COMPARISON_SCALE_ALIGNMENT = 100;
var comparisonPowersOfTen = [bigint12];
var compareBigInt = (self, that) => self === that ? 0 : self < that ? -1 : 1;
var compareMagnitude = (self, that) => {
  const selfDigits = `${self.value < bigint03 ? -self.value : self.value}`;
  const thatDigits = `${that.value < bigint03 ? -that.value : that.value}`;
  const exponentDifference = BigInt(selfDigits.length - thatDigits.length) - BigInt(self.scale) + BigInt(that.scale);
  if (exponentDifference !== bigint03) return exponentDifference < bigint03 ? -1 : 1;
  const length = Math.max(selfDigits.length, thatDigits.length);
  return String2(selfDigits.padEnd(length, "0"), thatDigits.padEnd(length, "0"));
};
var compare = (self, that) => {
  if (self.scale === that.scale) return compareBigInt(self.value, that.value);
  const selfSign = sign(self);
  const thatSign = sign(that);
  if (selfSign !== thatSign) return selfSign < thatSign ? -1 : 1;
  if (selfSign === 0) return 0;
  const scaleDifference = self.scale - that.scale;
  const absoluteScaleDifference = Math.abs(scaleDifference);
  if (absoluteScaleDifference > MAX_COMPARISON_SCALE_ALIGNMENT) {
    return selfSign === -1 ? compareMagnitude(that, self) : compareMagnitude(self, that);
  }
  const powerOfTen = comparisonPowersOfTen[absoluteScaleDifference] ??= bigint102 ** BigInt(absoluteScaleDifference);
  return scaleDifference > 0 ? compareBigInt(self.value, that.value * powerOfTen) : compareBigInt(self.value * powerOfTen, that.value);
};
var Order = /* @__PURE__ */ make2(compare);
var sign = (n) => n.value === bigint03 ? 0 : n.value < bigint03 ? -1 : 1;
var fromString = (s) => {
  if (s === "") {
    return some2(zero2);
  }
  let base;
  let exp;
  const seperator = s.search(/[eE]/);
  if (seperator !== -1) {
    const trail = s.slice(seperator + 1);
    base = s.slice(0, seperator);
    exp = Number(trail);
    if (base === "" || !Number.isSafeInteger(exp) || !FINITE_INT_REGEXP.test(trail)) {
      return none2();
    }
  } else {
    base = s;
    exp = 0;
  }
  let digits;
  let offset;
  const dot = base.search(/\./);
  if (dot !== -1) {
    const lead = base.slice(0, dot);
    const trail = base.slice(dot + 1);
    digits = `${lead}${trail}`;
    offset = trail.length;
  } else {
    digits = base;
    offset = 0;
  }
  if (!FINITE_INT_REGEXP.test(digits)) {
    return none2();
  }
  const scale = offset - exp;
  if (!Number.isSafeInteger(scale)) {
    return none2();
  }
  return some2(make7(BigInt(digits), scale));
};
var format3 = (n) => {
  const normalized = normalize(n);
  if (Math.abs(normalized.scale) >= 16) {
    return toExponential(normalized);
  }
  const negative = normalized.value < bigint03;
  const absolute = `${negative ? -normalized.value : normalized.value}`;
  const digits = normalized.scale > 0 ? absolute.padStart(normalized.scale + 1, "0") : absolute.padEnd(absolute.length - normalized.scale, "0");
  const point = digits.length - normalized.scale;
  const complete = normalized.scale > 0 ? `${digits.slice(0, point)}.${digits.slice(point)}` : digits;
  return negative ? `-${complete}` : complete;
};
var toExponential = (n) => {
  if (isZero2(n)) {
    return "0e+0";
  }
  const normalized = normalize(n);
  const digits = `${normalized.value}`;
  const point = normalized.value < bigint03 ? 2 : 1;
  const head3 = digits.slice(0, point);
  const tail = digits.slice(point);
  const exp = tail.length - normalized.scale;
  return `${head3}${tail === "" ? "" : `.${tail}`}e${exp >= 0 ? "+" : ""}${exp}`;
};
var isZero2 = (n) => n.value === bigint03;

// node_modules/effect/dist/Schema.js
var Schema_exports = {};
__export(Schema_exports, {
  Any: () => Any2,
  Array: () => ArraySchema,
  ArrayEnsure: () => ArrayEnsure,
  BigDecimal: () => BigDecimal,
  BigDecimalFromString: () => BigDecimalFromString,
  BigInt: () => BigInt6,
  BigIntFromString: () => BigIntFromString,
  Boolean: () => Boolean3,
  BooleanFromBit: () => BooleanFromBit,
  BooleanLiterals: () => BooleanLiterals,
  ByteSize: () => ByteSize,
  ByteSizeFromBigInt: () => ByteSizeFromBigInt,
  ByteSizeFromNumber: () => ByteSizeFromNumber,
  ByteSizeFromString: () => ByteSizeFromString,
  Cause: () => Cause,
  CauseReason: () => CauseReason,
  Char: () => Char,
  Chunk: () => Chunk,
  Class: () => Class4,
  Cookie: () => Cookie,
  Cookies: () => Cookies,
  Date: () => Date4,
  DateFromMillis: () => DateFromMillis,
  DateFromString: () => DateFromString,
  DateTimeUtc: () => DateTimeUtc,
  DateTimeUtcFromDate: () => DateTimeUtcFromDate,
  DateTimeUtcFromHttpDate: () => DateTimeUtcFromHttpDate,
  DateTimeUtcFromMillis: () => DateTimeUtcFromMillis,
  DateTimeUtcFromString: () => DateTimeUtcFromString,
  DateTimeZoned: () => DateTimeZoned,
  DateTimeZonedFromString: () => DateTimeZonedFromString,
  Defect: () => Defect,
  DnsARecord: () => DnsARecord,
  DnsAaaaRecord: () => DnsAaaaRecord,
  DnsCaaRecord: () => DnsCaaRecord,
  DnsCnameRecord: () => DnsCnameRecord,
  DnsMxRecord: () => DnsMxRecord,
  DnsNaptrRecord: () => DnsNaptrRecord,
  DnsNsRecord: () => DnsNsRecord,
  DnsPtrRecord: () => DnsPtrRecord,
  DnsRecord: () => DnsRecord,
  DnsRecordType: () => DnsRecordType,
  DnsSoaRecord: () => DnsSoaRecord,
  DnsSrvRecord: () => DnsSrvRecord,
  DnsTlsaRecord: () => DnsTlsaRecord,
  DnsTxtRecord: () => DnsTxtRecord,
  DomainName: () => DomainName,
  DomainNameFromString: () => DomainNameFromString,
  Duration: () => Duration,
  DurationFromMillis: () => DurationFromMillis,
  DurationFromNanos: () => DurationFromNanos,
  DurationFromString: () => DurationFromString,
  Enum: () => Enum2,
  Error: () => Error4,
  ErrorInstance: () => ErrorInstance,
  Exit: () => Exit,
  FalseLiterals: () => FalseLiterals,
  File: () => File2,
  Finite: () => Finite,
  FiniteFromString: () => FiniteFromString,
  FormData: () => FormData2,
  Graph: () => Graph,
  HashMap: () => HashMap,
  HashSet: () => HashSet,
  Headers: () => Headers,
  Host: () => Host,
  HostFromString: () => HostFromString,
  HostPort: () => HostPort,
  HostPortFromString: () => HostPortFromString,
  InetAddress: () => InetAddress,
  InetAddressFromString: () => InetAddressFromString,
  InetAddressV4: () => InetAddressV4,
  InetAddressV6: () => InetAddressV6,
  Int: () => Int,
  IpAddress: () => IpAddress,
  IpAddressFromString: () => IpAddressFromString,
  IpInterface: () => IpInterface,
  IpInterfaceFromString: () => IpInterfaceFromString,
  IpLinkLocalAddress: () => IpLinkLocalAddress,
  IpLinkLocalAddressFromString: () => IpLinkLocalAddressFromString,
  IpLoopbackAddress: () => IpLoopbackAddress,
  IpLoopbackAddressFromString: () => IpLoopbackAddressFromString,
  IpMulticastAddress: () => IpMulticastAddress,
  IpMulticastAddressFromString: () => IpMulticastAddressFromString,
  IpNetwork: () => IpNetwork,
  IpNetworkFromString: () => IpNetworkFromString,
  IpUnicastAddress: () => IpUnicastAddress,
  IpUnicastAddressFromString: () => IpUnicastAddressFromString,
  IpUnspecifiedAddress: () => IpUnspecifiedAddress,
  IpUnspecifiedAddressFromString: () => IpUnspecifiedAddressFromString,
  Ipv4Address: () => Ipv4Address,
  Ipv4AddressFromString: () => Ipv4AddressFromString,
  Ipv4BroadcastAddress: () => Ipv4BroadcastAddress,
  Ipv4BroadcastAddressFromString: () => Ipv4BroadcastAddressFromString,
  Ipv4Interface: () => Ipv4Interface,
  Ipv4InterfaceFromString: () => Ipv4InterfaceFromString,
  Ipv4Network: () => Ipv4Network,
  Ipv4NetworkFromString: () => Ipv4NetworkFromString,
  Ipv4PrivateAddress: () => Ipv4PrivateAddress,
  Ipv4PrivateAddressFromString: () => Ipv4PrivateAddressFromString,
  Ipv6Address: () => Ipv6Address,
  Ipv6AddressFromString: () => Ipv6AddressFromString,
  Ipv6Interface: () => Ipv6Interface,
  Ipv6InterfaceFromString: () => Ipv6InterfaceFromString,
  Ipv6Network: () => Ipv6Network,
  Ipv6NetworkFromString: () => Ipv6NetworkFromString,
  Ipv6UniqueLocalAddress: () => Ipv6UniqueLocalAddress,
  Ipv6UniqueLocalAddressFromString: () => Ipv6UniqueLocalAddressFromString,
  Json: () => Json2,
  JsonFromUrlParamsField: () => JsonFromUrlParamsField,
  JsonObject: () => JsonObject,
  Literal: () => Literal2,
  Literals: () => Literals,
  MacAddress: () => MacAddress,
  MacAddressFromString: () => MacAddressFromString,
  MacBroadcastAddress: () => MacBroadcastAddress,
  MacBroadcastAddressFromString: () => MacBroadcastAddressFromString,
  MacLocallyAdministeredAddress: () => MacLocallyAdministeredAddress,
  MacLocallyAdministeredAddressFromString: () => MacLocallyAdministeredAddressFromString,
  MacMulticastAddress: () => MacMulticastAddress,
  MacMulticastAddressFromString: () => MacMulticastAddressFromString,
  MacUnicastAddress: () => MacUnicastAddress,
  MacUnicastAddressFromString: () => MacUnicastAddressFromString,
  MacUniversallyAdministeredAddress: () => MacUniversallyAdministeredAddress,
  MacUniversallyAdministeredAddressFromString: () => MacUniversallyAdministeredAddressFromString,
  MutableJson: () => MutableJson2,
  Natural: () => Natural,
  Never: () => Never2,
  NonEmptyArray: () => NonEmptyArray,
  NonEmptyString: () => NonEmptyString,
  Null: () => Null2,
  NullOr: () => NullOr,
  NullishOr: () => NullishOr,
  Number: () => Number6,
  NumberFromString: () => NumberFromString,
  ObjectKeyword: () => ObjectKeyword2,
  Opaque: () => Opaque,
  Option: () => Option,
  OptionFromNullOr: () => OptionFromNullOr,
  OptionFromNullishOr: () => OptionFromNullishOr,
  OptionFromOptional: () => OptionFromOptional,
  OptionFromOptionalKey: () => OptionFromOptionalKey,
  OptionFromOptionalNullOr: () => OptionFromOptionalNullOr,
  OptionFromUndefinedOr: () => OptionFromUndefinedOr,
  Port: () => Port,
  PropertyKey: () => PropertyKey,
  ReadonlyMap: () => ReadonlyMap,
  ReadonlySet: () => ReadonlySet,
  Record: () => Record,
  RecordFromCookies: () => RecordFromCookies,
  RecordFromUrlParams: () => RecordFromUrlParams,
  Redacted: () => Redacted,
  RedactedFromValue: () => RedactedFromValue,
  RegExp: () => RegExp3,
  Result: () => Result,
  RetryAfter: () => RetryAfter,
  RetryAfterFromString: () => RetryAfterFromString,
  SchemaError: () => SchemaError,
  ScopedIpv6Literal: () => ScopedIpv6Literal,
  ScopedIpv6LiteralFromString: () => ScopedIpv6LiteralFromString,
  SemVer: () => SemVer,
  SemVerFromString: () => SemVerFromString,
  SemVerRange: () => SemVerRange,
  SemVerRangeFromString: () => SemVerRangeFromString,
  SocketAddress: () => SocketAddress,
  StandardSchemaV1FailureResult: () => StandardSchemaV1FailureResult,
  String: () => String6,
  StringForLiteralAutocomplete: () => StringForLiteralAutocomplete,
  StringFromBase64: () => StringFromBase64,
  StringFromBase64Url: () => StringFromBase64Url,
  StringFromHex: () => StringFromHex,
  StringFromUriComponent: () => StringFromUriComponent,
  Struct: () => Struct,
  StructWithRest: () => StructWithRest,
  Symbol: () => Symbol3,
  TaggedClass: () => TaggedClass,
  TaggedError: () => TaggedError3,
  TaggedStruct: () => TaggedStruct,
  TaggedUnion: () => TaggedUnion,
  TemplateLiteral: () => TemplateLiteral2,
  TemplateLiteralParser: () => TemplateLiteralParser,
  TimeZone: () => TimeZone,
  TimeZoneFromString: () => TimeZoneFromString,
  TimeZoneNamed: () => TimeZoneNamed,
  TimeZoneNamedFromString: () => TimeZoneNamedFromString,
  TimeZoneOffset: () => TimeZoneOffset,
  Tree: () => Tree,
  Trim: () => Trim,
  Trimmed: () => Trimmed,
  TrueLiterals: () => TrueLiterals,
  Tuple: () => Tuple2,
  TupleWithRest: () => TupleWithRest,
  URL: () => URL2,
  URLFromString: () => URLFromString,
  URLSearchParams: () => URLSearchParams2,
  Uint8Array: () => Uint8Array2,
  Uint8ArrayFromBase64: () => Uint8ArrayFromBase64,
  Uint8ArrayFromBase64Url: () => Uint8ArrayFromBase64Url,
  Uint8ArrayFromHex: () => Uint8ArrayFromHex,
  Undefined: () => Undefined2,
  UndefinedOr: () => UndefinedOr,
  Union: () => Union2,
  UniqueArray: () => UniqueArray,
  UniqueSymbol: () => UniqueSymbol2,
  UnixPathAddress: () => UnixPathAddress,
  UnixPathAddressFromString: () => UnixPathAddressFromString,
  Unknown: () => Unknown2,
  UnknownFromJsonString: () => UnknownFromJsonString,
  UrlParams: () => UrlParams,
  Void: () => Void2,
  annotate: () => annotate2,
  annotateEncoded: () => annotateEncoded,
  annotateKey: () => annotateKey2,
  asserts: () => asserts2,
  brand: () => brand,
  catchDecoding: () => catchDecoding,
  catchDecodingWithContext: () => catchDecodingWithContext,
  catchEncoding: () => catchEncoding,
  catchEncodingWithContext: () => catchEncodingWithContext,
  check: () => check,
  declare: () => declare,
  declareConstructor: () => declareConstructor,
  decode: () => decode4,
  decodeEffect: () => decodeEffect2,
  decodeExit: () => decodeExit,
  decodeOption: () => decodeOption2,
  decodePromise: () => decodePromise,
  decodeResult: () => decodeResult,
  decodeSync: () => decodeSync2,
  decodeTo: () => decodeTo2,
  decodeUnknownEffect: () => decodeUnknownEffect2,
  decodeUnknownExit: () => decodeUnknownExit2,
  decodeUnknownOption: () => decodeUnknownOption2,
  decodeUnknownPromise: () => decodeUnknownPromise,
  decodeUnknownResult: () => decodeUnknownResult2,
  decodeUnknownSync: () => decodeUnknownSync2,
  encode: () => encode4,
  encodeEffect: () => encodeEffect2,
  encodeExit: () => encodeExit,
  encodeKeys: () => encodeKeys,
  encodeOption: () => encodeOption2,
  encodePromise: () => encodePromise,
  encodeResult: () => encodeResult,
  encodeSync: () => encodeSync2,
  encodeTo: () => encodeTo,
  encodeUnknownEffect: () => encodeUnknownEffect2,
  encodeUnknownExit: () => encodeUnknownExit2,
  encodeUnknownOption: () => encodeUnknownOption2,
  encodeUnknownPromise: () => encodeUnknownPromise,
  encodeUnknownResult: () => encodeUnknownResult2,
  encodeUnknownSync: () => encodeUnknownSync2,
  extendTo: () => extendTo,
  fieldsAssign: () => fieldsAssign,
  flip: () => flip5,
  fromBrand: () => fromBrand,
  fromFormData: () => fromFormData2,
  fromJsonString: () => fromJsonString2,
  fromURLSearchParams: () => fromURLSearchParams2,
  instanceOf: () => instanceOf,
  is: () => is2,
  isBase64: () => isBase64,
  isBase64Url: () => isBase64Url,
  isBetween: () => isBetween2,
  isBetweenBigDecimal: () => isBetweenBigDecimal,
  isBetweenBigInt: () => isBetweenBigInt,
  isBetweenCodePoints: () => isBetweenCodePoints,
  isBetweenDate: () => isBetweenDate,
  isBetweenLength: () => isBetweenLength,
  isBetweenProperties: () => isBetweenProperties,
  isBetweenSize: () => isBetweenSize,
  isCapitalized: () => isCapitalized,
  isEndingWith: () => isEndingWith,
  isFinite: () => isFinite3,
  isGUID: () => isGUID,
  isGreaterThan: () => isGreaterThan4,
  isGreaterThanBigDecimal: () => isGreaterThanBigDecimal,
  isGreaterThanBigInt: () => isGreaterThanBigInt,
  isGreaterThanDate: () => isGreaterThanDate,
  isGreaterThanOrEqualTo: () => isGreaterThanOrEqualTo4,
  isGreaterThanOrEqualToBigDecimal: () => isGreaterThanOrEqualToBigDecimal,
  isGreaterThanOrEqualToBigInt: () => isGreaterThanOrEqualToBigInt,
  isGreaterThanOrEqualToDate: () => isGreaterThanOrEqualToDate,
  isIncluding: () => isIncluding,
  isInt: () => isInt,
  isInt32: () => isInt32,
  isLessThan: () => isLessThan4,
  isLessThanBigDecimal: () => isLessThanBigDecimal,
  isLessThanBigInt: () => isLessThanBigInt,
  isLessThanDate: () => isLessThanDate,
  isLessThanOrEqualTo: () => isLessThanOrEqualTo5,
  isLessThanOrEqualToBigDecimal: () => isLessThanOrEqualToBigDecimal,
  isLessThanOrEqualToBigInt: () => isLessThanOrEqualToBigInt,
  isLessThanOrEqualToDate: () => isLessThanOrEqualToDate,
  isLowercased: () => isLowercased,
  isMaxCodePoints: () => isMaxCodePoints,
  isMaxLength: () => isMaxLength,
  isMaxProperties: () => isMaxProperties,
  isMaxSize: () => isMaxSize,
  isMinCodePoints: () => isMinCodePoints,
  isMinLength: () => isMinLength,
  isMinProperties: () => isMinProperties,
  isMinSize: () => isMinSize,
  isMultipleOf: () => isMultipleOf,
  isNonEmpty: () => isNonEmpty,
  isPattern: () => isPattern2,
  isPropertyNames: () => isPropertyNames,
  isSchema: () => isSchema,
  isSchemaError: () => isSchemaError2,
  isStartingWith: () => isStartingWith,
  isStringBigInt: () => isStringBigInt2,
  isStringFinite: () => isStringFinite2,
  isStringSymbol: () => isStringSymbol2,
  isTrimmed: () => isTrimmed,
  isULID: () => isULID,
  isUUID: () => isUUID,
  isUint32: () => isUint322,
  isUncapitalized: () => isUncapitalized,
  isUnique: () => isUnique,
  isUniqueKey: () => isUniqueKey,
  isUppercased: () => isUppercased,
  link: () => link,
  linkDecoding: () => linkDecoding,
  make: () => make21,
  makeClassTrusted: () => makeClassTrusted,
  makeFilter: () => makeFilter2,
  makeFilterGroup: () => makeFilterGroup,
  makeIsBetween: () => makeIsBetween,
  makeIsGreaterThan: () => makeIsGreaterThan,
  makeIsGreaterThanOrEqualTo: () => makeIsGreaterThanOrEqualTo,
  makeIsLessThan: () => makeIsLessThan,
  makeIsLessThanOrEqualTo: () => makeIsLessThanOrEqualTo,
  makeIsMultipleOf: () => makeIsMultipleOf,
  middlewareDecoding: () => middlewareDecoding2,
  middlewareEncoding: () => middlewareEncoding2,
  mutable: () => mutable2,
  mutableKey: () => mutableKey2,
  optional: () => optional2,
  optionalKey: () => optionalKey2,
  overrideToCodecIso: () => overrideToCodecIso,
  overrideToEquivalence: () => overrideToEquivalence,
  overrideToFormatter: () => overrideToFormatter,
  readonlyKey: () => readonlyKey,
  refine: () => refine,
  required: () => required,
  requiredKey: () => requiredKey,
  resolveAnnotations: () => resolveAnnotations,
  resolveAnnotationsKey: () => resolveAnnotationsKey,
  revealBottom: () => revealBottom,
  revealCodec: () => revealCodec,
  suspend: () => suspend3,
  tag: () => tag,
  tagDefaultOmit: () => tagDefaultOmit,
  toCodecArrayFromSingle: () => toCodecArrayFromSingle2,
  toCodecGoJson: () => toCodecGoJson2,
  toCodecIso: () => toCodecIso2,
  toCodecJson: () => toCodecJson2,
  toCodecStringTree: () => toCodecStringTree2,
  toDifferJsonPatch: () => toDifferJsonPatch2,
  toEncoded: () => toEncoded2,
  toEncoderXml: () => toEncoderXml2,
  toEquivalence: () => toEquivalence2,
  toFormatter: () => toFormatter2,
  toIso: () => toIso2,
  toIsoFocus: () => toIsoFocus2,
  toIsoSource: () => toIsoSource2,
  toJsonSchemaDocument: () => toJsonSchemaDocument3,
  toRepresentation: () => toRepresentation2,
  toStandardJSONSchemaV1: () => toStandardJSONSchemaV12,
  toStandardSchemaV1: () => toStandardSchemaV12,
  toTaggedUnion: () => toTaggedUnion,
  toType: () => toType2,
  withArrayLengthConstraints: () => withArrayLengthConstraints,
  withConstructorDefault: () => withConstructorDefault2,
  withDecodingDefault: () => withDecodingDefault,
  withDecodingDefaultKey: () => withDecodingDefaultKey,
  withDecodingDefaultType: () => withDecodingDefaultType,
  withDecodingDefaultTypeKey: () => withDecodingDefaultTypeKey
});

// node_modules/effect/dist/BigInt.js
var BigInt3 = globalThis.BigInt;
var toNumber = (b) => {
  if (b > BigInt3(Number.MAX_SAFE_INTEGER) || b < BigInt3(Number.MIN_SAFE_INTEGER)) {
    return none2();
  }
  return some2(Number(b));
};

// node_modules/effect/dist/ByteSize.js
var bigint04 = /* @__PURE__ */ BigInt(0);
var bigint13 = /* @__PURE__ */ BigInt(1);
var decimalBase = /* @__PURE__ */ BigInt(1e3);
var binaryBase = /* @__PURE__ */ BigInt(1024);
var decimalUnits = [{
  symbol: "B",
  factor: bigint13,
  names: ["B", "byte", "bytes"]
}, {
  symbol: "kB",
  factor: decimalBase,
  names: ["kB", "kilobyte", "kilobytes"]
}, {
  symbol: "MB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(2),
  names: ["MB", "megabyte", "megabytes"]
}, {
  symbol: "GB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(3),
  names: ["GB", "gigabyte", "gigabytes"]
}, {
  symbol: "TB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(4),
  names: ["TB", "terabyte", "terabytes"]
}, {
  symbol: "PB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(5),
  names: ["PB", "petabyte", "petabytes"]
}, {
  symbol: "EB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(6),
  names: ["EB", "exabyte", "exabytes"]
}, {
  symbol: "ZB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(7),
  names: ["ZB", "zettabyte", "zettabytes"]
}, {
  symbol: "YB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(8),
  names: ["YB", "yottabyte", "yottabytes"]
}, {
  symbol: "RB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(9),
  names: ["RB", "ronnabyte", "ronnabytes"]
}, {
  symbol: "QB",
  factor: decimalBase ** /* @__PURE__ */ BigInt(10),
  names: ["QB", "quettabyte", "quettabytes"]
}];
var binaryUnits = [decimalUnits[0], {
  symbol: "KiB",
  factor: binaryBase,
  names: ["KiB", "kibibyte", "kibibytes"]
}, {
  symbol: "MiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(2),
  names: ["MiB", "mebibyte", "mebibytes"]
}, {
  symbol: "GiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(3),
  names: ["GiB", "gibibyte", "gibibytes"]
}, {
  symbol: "TiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(4),
  names: ["TiB", "tebibyte", "tebibytes"]
}, {
  symbol: "PiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(5),
  names: ["PiB", "pebibyte", "pebibytes"]
}, {
  symbol: "EiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(6),
  names: ["EiB", "exbibyte", "exbibytes"]
}, {
  symbol: "ZiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(7),
  names: ["ZiB", "zebibyte", "zebibytes"]
}, {
  symbol: "YiB",
  factor: binaryBase ** /* @__PURE__ */ BigInt(8),
  names: ["YiB", "yobibyte", "yobibytes"]
}];
var allUnits = [...decimalUnits, .../* @__PURE__ */ binaryUnits.slice(1)];
var unitsByName = /* @__PURE__ */ new Map(/* @__PURE__ */ allUnits.flatMap((unit) => unit.names.map((name) => [name, unit])));
var make8 = (value3) => value3;
var invalid2 = (message) => {
  throw new Error(`Invalid ByteSize: ${message}`);
};
var fromNumber = (input) => {
  if (!Number.isSafeInteger(input) || input < 0) {
    return invalid2(`expected a non-negative safe integer, received ${input}`);
  }
  return make8(BigInt(input));
};
var fromStringUnsafe = (input) => {
  const match7 = /^\s*(\d+)(?:\.(\d+))?\s*([A-Za-z]+)\s*$/.exec(input);
  if (match7 === null) return invalid2(`unsupported syntax ${JSON.stringify(input)}`);
  const unit = unitsByName.get(match7[3]);
  if (unit === void 0) return invalid2(`unsupported unit ${JSON.stringify(match7[3])}`);
  const fraction = match7[2] ?? "";
  const scale = BigInt(10) ** BigInt(fraction.length);
  const numerator = BigInt(match7[1] + fraction) * unit.factor;
  if (numerator % scale !== bigint04) {
    return invalid2(`${JSON.stringify(input)} does not represent an integral number of bytes`);
  }
  return make8(numerator / scale);
};
var fromString2 = /* @__PURE__ */ liftThrowable(fromStringUnsafe);
var fromInputUnsafe2 = (input) => {
  switch (typeof input) {
    case "bigint":
      if (input < bigint04) return invalid2(`expected a non-negative bigint, received ${input}`);
      return make8(input);
    case "number":
      return fromNumber(input);
    case "string":
      return fromStringUnsafe(input);
  }
  return invalid2(`unsupported input ${input}`);
};
var fromInput2 = /* @__PURE__ */ liftThrowable(fromInputUnsafe2);
var bytes = (value3) => typeof value3 === "bigint" ? fromInputUnsafe2(value3) : fromNumber(value3);
var isByteSize = (input) => typeof input === "bigint" && input >= bigint04;
var toBigInt = (self) => self;
var toNumber2 = toNumber;

// node_modules/effect/dist/Chunk.js
var TypeId15 = "~effect/Chunk";
function copy(src, srcPos, dest, destPos, len) {
  for (let i = srcPos; i < Math.min(src.length, srcPos + len); i++) {
    dest[destPos + i - srcPos] = src[i];
  }
  return dest;
}
var emptyArray = [];
var makeEquivalence5 = (isEquivalent) => make((self, that) => {
  if (self.length !== that.length) {
    return false;
  }
  const as3 = toReadonlyArray(self);
  const bs = toReadonlyArray(that);
  for (let i = 0; i < as3.length; i++) {
    if (!isEquivalent(as3[i], bs[i])) {
      return false;
    }
  }
  return true;
});
var _equivalence = /* @__PURE__ */ makeEquivalence5(equals);
var ChunkProto = {
  [TypeId15]: {
    _A: (_) => _
  },
  toString() {
    return `Chunk(${format(toReadonlyArray(this))})`;
  },
  toJSON() {
    return {
      _id: "Chunk",
      values: toJson(toReadonlyArray(this))
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol2](that) {
    return isChunk(that) && _equivalence(this, that);
  },
  [symbol]() {
    return array(toReadonlyArray(this));
  },
  [Symbol.iterator]() {
    switch (this.backing._tag) {
      case "IArray": {
        return this.backing.array[Symbol.iterator]();
      }
      case "IEmpty": {
        return emptyArray[Symbol.iterator]();
      }
      default: {
        return toReadonlyArray(this)[Symbol.iterator]();
      }
    }
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeChunk = (backing) => {
  const chunk = Object.create(ChunkProto);
  chunk.backing = backing;
  switch (backing._tag) {
    case "IEmpty": {
      chunk.length = 0;
      chunk.depth = 0;
      chunk.left = chunk;
      chunk.right = chunk;
      break;
    }
    case "IConcat": {
      chunk.length = backing.left.length + backing.right.length;
      chunk.depth = 1 + Math.max(backing.left.depth, backing.right.depth);
      chunk.left = backing.left;
      chunk.right = backing.right;
      break;
    }
    case "IArray": {
      chunk.length = backing.array.length;
      chunk.depth = 0;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
    case "ISingleton": {
      chunk.length = 1;
      chunk.depth = 0;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
    case "ISlice": {
      chunk.length = backing.length;
      chunk.depth = 0;
      chunk.left = _empty;
      chunk.right = _empty;
      break;
    }
  }
  return chunk;
};
var isChunk = (u) => hasProperty(u, TypeId15);
var _empty = /* @__PURE__ */ makeChunk({
  _tag: "IEmpty"
});
var empty4 = () => _empty;
var of = (a) => makeChunk({
  _tag: "ISingleton",
  a
});
var fromIterable2 = (self) => isChunk(self) ? self : fromArrayUnsafe(fromIterable(self));
var copyToArray = (self, array2, initial) => {
  switch (self.backing._tag) {
    case "IArray": {
      copy(self.backing.array, 0, array2, initial, self.length);
      break;
    }
    case "IConcat": {
      copyToArray(self.left, array2, initial);
      copyToArray(self.right, array2, initial + self.left.length);
      break;
    }
    case "ISingleton": {
      array2[initial] = self.backing.a;
      break;
    }
    case "ISlice": {
      copy(toReadonlyArray(self.backing.chunk), self.backing.offset, array2, initial, self.length);
      break;
    }
  }
};
var toReadonlyArray_ = (self) => {
  switch (self.backing._tag) {
    case "IEmpty": {
      return emptyArray;
    }
    case "IArray": {
      return self.backing.array;
    }
    default: {
      const arr = new Array(self.length);
      copyToArray(self, arr, 0);
      self.backing = {
        _tag: "IArray",
        array: arr
      };
      self.left = _empty;
      self.right = _empty;
      self.depth = 0;
      return arr;
    }
  }
};
var toReadonlyArray = toReadonlyArray_;
var fromArrayUnsafe = (self) => self.length === 0 ? empty4() : self.length === 1 ? of(self[0]) : makeChunk({
  _tag: "IArray",
  array: self
});
var size = (self) => self.length;

// node_modules/effect/dist/DateTime.js
var isDateTime2 = isDateTime;
var isTimeZone2 = isTimeZone;
var isTimeZoneOffset2 = isTimeZoneOffset;
var isTimeZoneNamed2 = isTimeZoneNamed;
var isUtc2 = isUtc;
var isZoned2 = isZoned;
var Equivalence4 = Equivalence2;
var makeUnsafe5 = makeUnsafe4;
var makeZonedUnsafe2 = makeZonedUnsafe;
var make9 = make6;
var makeZonedFromString2 = makeZonedFromString;
var toUtc2 = toUtc;
var zoneMakeNamedUnsafe2 = zoneMakeNamedUnsafe;
var zoneMakeOffset2 = zoneMakeOffset;
var zoneMakeNamed2 = zoneMakeNamed;
var zoneFromString2 = zoneFromString;
var zoneToString2 = zoneToString;
var toDateUtc2 = toDateUtc;
var toEpochMillis2 = toEpochMillis;
var formatIso2 = formatIso;
var formatIsoZoned2 = formatIsoZoned;

// node_modules/effect/dist/encoding/Base64.js
var encode2 = (input) => encodeBytes(typeof input === "string" ? encoder2.encode(input) : input);
var decode2 = (str) => {
  const stripped = stripCrlf(str);
  const length = stripped.length;
  if (length % 4 !== 0) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: `Length must be a multiple of 4, but is ${length}`
    }));
  }
  const index2 = stripped.indexOf("=");
  if (index2 !== -1 && (index2 < length - 2 || index2 === length - 2 && stripped[length - 1] !== "=")) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: "Found a '=' character, but it is not at the end"
    }));
  }
  try {
    const missingOctets = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
    const result3 = new Uint8Array(3 * (length / 4) - missingOctets);
    for (let i = 0, j = 0; i < length; i += 4, j += 3) {
      const buffer = getCode(stripped.charCodeAt(i)) << 18 | getCode(stripped.charCodeAt(i + 1)) << 12 | getCode(stripped.charCodeAt(i + 2)) << 6 | getCode(stripped.charCodeAt(i + 3));
      result3[j] = buffer >> 16;
      result3[j + 1] = buffer >> 8 & 255;
      result3[j + 2] = buffer & 255;
    }
    return succeed2(result3);
  } catch (cause) {
    return fail2(new EncodingError({
      kind: "Decode",
      module: "Base64",
      input: stripped,
      message: cause instanceof Error ? cause.message : "Invalid input"
    }));
  }
};
var decodeString2 = (str) => map2(decode2(str), (_) => decoder2.decode(_));
var encodeBytes = (bytes2) => {
  const length = bytes2.length;
  let result3 = "";
  let i;
  for (i = 2; i < length; i += 3) {
    result3 += alphabet[bytes2[i - 2] >> 2];
    result3 += alphabet[(bytes2[i - 2] & 3) << 4 | bytes2[i - 1] >> 4];
    result3 += alphabet[(bytes2[i - 1] & 15) << 2 | bytes2[i] >> 6];
    result3 += alphabet[bytes2[i] & 63];
  }
  if (i === length + 1) {
    result3 += alphabet[bytes2[i - 2] >> 2];
    result3 += alphabet[(bytes2[i - 2] & 3) << 4];
    result3 += "==";
  }
  if (i === length) {
    result3 += alphabet[bytes2[i - 2] >> 2];
    result3 += alphabet[(bytes2[i - 2] & 3) << 4 | bytes2[i - 1] >> 4];
    result3 += alphabet[(bytes2[i - 1] & 15) << 2];
    result3 += "=";
  }
  return result3;
};
var encoder2 = /* @__PURE__ */ new TextEncoder();
var decoder2 = /* @__PURE__ */ new TextDecoder();
var stripCrlf = (str) => str.replace(/[\n\r]/g, "");
var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var codes = /* @__PURE__ */ new Uint8Array(123).fill(255);
for (let i = 0; i < alphabet.length; i++) codes[/* @__PURE__ */ alphabet.charCodeAt(i)] = i;
codes[/* @__PURE__ */ "=".charCodeAt(0)] = 0;
var getCode = (charCode) => {
  if (charCode >= codes.length || codes[charCode] === 255) {
    throw new TypeError(`Invalid character ${String.fromCharCode(charCode)}`);
  }
  return codes[charCode];
};

// node_modules/effect/dist/internal/hashMap.js
var HashMapTypeId = "~effect/HashMap";
var SHIFT = 5;
var BUCKET_SIZE = 1 << SHIFT;
var MIN_ARRAY_NODE = BUCKET_SIZE / 4;
var MAX_INDEX_NODE = BUCKET_SIZE / 2;
var BITMAP_INDEX_MASK = BUCKET_SIZE - 1;
var popcount = (n) => {
  n = n - (n >>> 1 & 1431655765);
  n = (n & 858993459) + (n >>> 2 & 858993459);
  return (n + (n >>> 4) & 252645135) * 16843009 >>> 24;
};
var mask = (hash2, shift) => hash2 >>> shift & BITMAP_INDEX_MASK;
var bitpos = (hash2, shift) => 1 << mask(hash2, shift);
var index = (bitmap, bit) => popcount(bitmap & bit - 1);
function mergeLeaves(edit, shift, hash1, node1, hash2, node2) {
  if (shift > 32) {
    throw new Error("HashMap: max depth exceeded");
  }
  const bit1 = bitpos(hash1, shift);
  const bit2 = bitpos(hash2, shift);
  if (bit1 === bit2) {
    const child = mergeLeaves(edit, shift + SHIFT, hash1, node1, hash2, node2);
    return new IndexedNode(edit, bit1, [child]);
  }
  const bitmap = bit1 | bit2;
  const children = bit1 >>> 0 < bit2 >>> 0 ? [node1, node2] : [node2, node1];
  return new IndexedNode(edit, bitmap, children);
}
var hashMapSeed = /* @__PURE__ */ string("HashMap");
var entryHash2 = (key, value3) => combine(hash(key), hash(value3));
var childrenHash = (children) => {
  let h = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child) h ^= child.subtreeHash();
  }
  return h;
};
var Node = class {
  canEdit(edit) {
    return this.edit === edit;
  }
  subtreeHash() {
    let h = this._hash;
    if (h === void 0) {
      const seen = backEdges;
      h = this.computeHash();
      if (seen === backEdges) {
        this._hash = h;
      }
    }
    return h;
  }
};
var EmptyNode = class extends Node {
  _tag = "EmptyNode";
  edit = 0;
  get size() {
    return 0;
  }
  get(_shift, _hash, _key) {
    return none2();
  }
  has(_shift, _hash, _key) {
    return false;
  }
  set(edit, _shift, hash2, key, value3, added) {
    added.value = true;
    return new LeafNode(edit, hash2, key, value3);
  }
  remove(_edit, _shift, _hash, _key, _removed) {
    return this;
  }
  canEdit(_edit) {
    return false;
  }
  computeHash() {
    return 0;
  }
};
var LeafNode = class _LeafNode extends Node {
  _tag = "LeafNode";
  edit;
  hash;
  key;
  value;
  constructor(edit, hash2, key, value3) {
    super();
    this.edit = edit;
    this.hash = hash2;
    this.key = key;
    this.value = value3;
  }
  get size() {
    return 1;
  }
  get(_shift, hash2, key) {
    if (this.hash === hash2 && equals(this.key, key)) {
      return some2(this.value);
    }
    return none2();
  }
  has(_shift, hash2, key) {
    return this.hash === hash2 && equals(this.key, key);
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.canEdit(edit)) this._hash = void 0;
    if (this.hash === hash2 && equals(this.key, key)) {
      if (Object.is(this.value, value3)) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.value = value3;
        return this;
      }
      return new _LeafNode(edit, hash2, key, value3);
    }
    added.value = true;
    if (this.hash === hash2) {
      return new CollisionNode(edit, hash2, [[this.key, this.value], [key, value3]]);
    }
    const newBit = bitpos(hash2, shift);
    const existingBit = bitpos(this.hash, shift);
    if (newBit === existingBit) {
      return new IndexedNode(edit, newBit, [this.set(edit, shift + SHIFT, hash2, key, value3, added)]);
    }
    const bitmap = newBit | existingBit;
    const nodes = newBit >>> 0 < existingBit >>> 0 ? [new _LeafNode(edit, hash2, key, value3), this] : [this, new _LeafNode(edit, hash2, key, value3)];
    return new IndexedNode(edit, bitmap, nodes);
  }
  remove(_edit, _shift, hash2, key, removed) {
    if (this.hash === hash2 && equals(this.key, key)) {
      removed.value = true;
      return void 0;
    }
    return this;
  }
  computeHash() {
    return entryHash2(this.key, this.value);
  }
};
var CollisionNode = class _CollisionNode extends Node {
  _tag = "CollisionNode";
  edit;
  hash;
  entries;
  constructor(edit, hash2, entries3) {
    super();
    this.edit = edit;
    this.hash = hash2;
    this.entries = entries3;
  }
  get size() {
    return this.entries.length;
  }
  get(_shift, hash2, key) {
    if (this.hash !== hash2) {
      return none2();
    }
    for (const [k, v] of this.entries) {
      if (equals(k, key)) {
        return some2(v);
      }
    }
    return none2();
  }
  has(_shift, hash2, key) {
    if (this.hash !== hash2) {
      return false;
    }
    for (const [k] of this.entries) {
      if (equals(k, key)) {
        return true;
      }
    }
    return false;
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.canEdit(edit)) this._hash = void 0;
    if (this.hash !== hash2) {
      added.value = true;
      return mergeLeaves(edit, shift, this.hash, this, hash2, new LeafNode(edit, hash2, key, value3));
    }
    for (let i = 0; i < this.entries.length; i++) {
      if (equals(this.entries[i][0], key)) {
        if (Object.is(this.entries[i][1], value3)) {
          return this;
        }
        if (this.canEdit(edit)) {
          this.entries[i] = [key, value3];
          return this;
        }
        const newEntries = [...this.entries];
        newEntries[i] = [key, value3];
        return new _CollisionNode(edit, this.hash, newEntries);
      }
    }
    added.value = true;
    if (this.canEdit(edit)) {
      this.entries.push([key, value3]);
      return this;
    }
    return new _CollisionNode(edit, this.hash, [...this.entries, [key, value3]]);
  }
  remove(edit, _shift, hash2, key, removed) {
    if (this.canEdit(edit)) this._hash = void 0;
    if (this.hash !== hash2) {
      return this;
    }
    const idx = this.entries.findIndex(([k]) => equals(k, key));
    if (idx === -1) {
      return this;
    }
    removed.value = true;
    if (this.entries.length === 1) {
      return void 0;
    }
    if (this.entries.length === 2) {
      const remaining = this.entries[idx === 0 ? 1 : 0];
      return new LeafNode(edit, this.hash, remaining[0], remaining[1]);
    }
    if (this.canEdit(edit)) {
      this.entries.splice(idx, 1);
      return this;
    }
    const newEntries = [...this.entries];
    newEntries.splice(idx, 1);
    return new _CollisionNode(edit, this.hash, newEntries);
  }
  computeHash() {
    let h = 0;
    const entries3 = this.entries;
    for (let i = 0; i < entries3.length; i++) {
      h ^= entryHash2(entries3[i][0], entries3[i][1]);
    }
    return h;
  }
};
var IndexedNode = class _IndexedNode extends Node {
  _tag = "IndexedNode";
  edit;
  _size;
  bitmap;
  children;
  constructor(edit, bitmap, children) {
    super();
    this.edit = edit;
    this.bitmap = bitmap;
    this.children = children;
  }
  get size() {
    if (this._size === void 0) {
      this._size = this.children.reduce((acc, child) => acc + child.size, 0);
    }
    return this._size;
  }
  get(shift, hash2, key) {
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return none2();
    }
    const idx = index(this.bitmap, bit);
    return this.children[idx].get(shift + SHIFT, hash2, key);
  }
  has(shift, hash2, key) {
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return false;
    }
    const idx = index(this.bitmap, bit);
    return this.children[idx].has(shift + SHIFT, hash2, key);
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.canEdit(edit)) this._hash = void 0;
    const bit = bitpos(hash2, shift);
    const idx = index(this.bitmap, bit);
    if ((this.bitmap & bit) !== 0) {
      const child = this.children[idx];
      const newChild = child.set(edit, shift + SHIFT, hash2, key, value3, added);
      if (child === newChild) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new _IndexedNode(edit, this.bitmap, newChildren);
    } else {
      added.value = true;
      const newChild = new LeafNode(edit, hash2, key, value3);
      const newBitmap = this.bitmap | bit;
      if (this.canEdit(edit)) {
        this.children.splice(idx, 0, newChild);
        this.bitmap = newBitmap;
        this._size = void 0;
        if (this.children.length > MAX_INDEX_NODE) {
          return this.expand(edit, newBitmap, this.children);
        }
        return this;
      }
      const newChildren = [...this.children];
      newChildren.splice(idx, 0, newChild);
      if (newChildren.length > MAX_INDEX_NODE) {
        return this.expand(edit, newBitmap, newChildren);
      }
      return new _IndexedNode(edit, newBitmap, newChildren);
    }
  }
  remove(edit, shift, hash2, key, removed) {
    if (this.canEdit(edit)) this._hash = void 0;
    const bit = bitpos(hash2, shift);
    if ((this.bitmap & bit) === 0) {
      return this;
    }
    const idx = index(this.bitmap, bit);
    const child = this.children[idx];
    const newChild = child.remove(edit, shift + SHIFT, hash2, key, removed);
    if (!removed.value) {
      return this;
    }
    if (newChild === void 0) {
      const newBitmap = this.bitmap ^ bit;
      if (newBitmap === 0) {
        return void 0;
      }
      if (this.children.length === 2) {
        const remaining = this.children[idx === 0 ? 1 : 0];
        if (remaining._tag === "LeafNode") {
          return remaining;
        }
      }
      if (this.canEdit(edit)) {
        this.children.splice(idx, 1);
        this.bitmap = newBitmap;
        this._size = void 0;
        return this;
      }
      const newChildren2 = [...this.children];
      newChildren2.splice(idx, 1);
      return new _IndexedNode(edit, newBitmap, newChildren2);
    }
    if (child === newChild) {
      return this;
    }
    if (this.canEdit(edit)) {
      this.children[idx] = newChild;
      return this;
    }
    const newChildren = [...this.children];
    newChildren[idx] = newChild;
    return new _IndexedNode(edit, this.bitmap, newChildren);
  }
  expand(edit, bitmap, children) {
    const nodes = new globalThis.Array(BUCKET_SIZE);
    let j = 0;
    for (let i = 0; i < BUCKET_SIZE; i++) {
      if ((bitmap & 1 << i) !== 0) {
        nodes[i] = children[j++];
      }
    }
    return new ArrayNode(edit, children.length, nodes);
  }
  computeHash() {
    return childrenHash(this.children);
  }
};
var ArrayNode = class _ArrayNode extends Node {
  _tag = "ArrayNode";
  edit;
  _size;
  count;
  children;
  constructor(edit, count, children) {
    super();
    this.edit = edit;
    this.count = count;
    this.children = children;
  }
  get size() {
    if (this._size === void 0) {
      this._size = this.children.reduce((acc, child) => acc + (child?.size ?? 0), 0);
    }
    return this._size;
  }
  get(shift, hash2, key) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    return child ? child.get(shift + SHIFT, hash2, key) : none2();
  }
  has(shift, hash2, key) {
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    return child ? child.has(shift + SHIFT, hash2, key) : false;
  }
  set(edit, shift, hash2, key, value3, added) {
    if (this.canEdit(edit)) this._hash = void 0;
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    if (child) {
      const newChild = child.set(edit, shift + SHIFT, hash2, key, value3, added);
      if (child === newChild) {
        return this;
      }
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new _ArrayNode(edit, this.count, newChildren);
    } else {
      added.value = true;
      const newChild = new LeafNode(edit, hash2, key, value3);
      if (this.canEdit(edit)) {
        this.children[idx] = newChild;
        this.count++;
        this._size = void 0;
        return this;
      }
      const newChildren = [...this.children];
      newChildren[idx] = newChild;
      return new _ArrayNode(edit, this.count + 1, newChildren);
    }
  }
  remove(edit, shift, hash2, key, removed) {
    if (this.canEdit(edit)) this._hash = void 0;
    const idx = mask(hash2, shift);
    const child = this.children[idx];
    if (!child) {
      return this;
    }
    const newChild = child.remove(edit, shift + SHIFT, hash2, key, removed);
    if (!removed.value) {
      return this;
    }
    const newCount = this.count - (newChild ? 0 : 1);
    if (newCount < MIN_ARRAY_NODE) {
      return this.pack(edit, idx, newChild);
    }
    if (child === newChild) {
      return this;
    }
    if (this.canEdit(edit)) {
      this.children[idx] = newChild;
      if (!newChild) {
        this.count = newCount;
      }
      this._size = void 0;
      return this;
    }
    const newChildren = [...this.children];
    newChildren[idx] = newChild;
    return new _ArrayNode(edit, newCount, newChildren);
  }
  pack(edit, excludeIdx, newChild) {
    const children = [];
    let bitmap = 0;
    let bit = 1;
    for (let i = 0; i < this.children.length; i++) {
      const child = i === excludeIdx ? newChild : this.children[i];
      if (child) {
        children.push(child);
        bitmap |= bit;
      }
      bit <<= 1;
    }
    return new IndexedNode(edit, bitmap, children);
  }
  computeHash() {
    return childrenHash(this.children);
  }
};
var HashMapIterator = class {
  stack;
  project;
  entries = [];
  index = 0;
  constructor(root, project) {
    this.stack = [root];
    this.project = project;
  }
  next() {
    while (true) {
      if (this.index < this.entries.length) {
        const entry = this.entries[this.index++];
        return {
          done: false,
          value: this.project(entry[0], entry[1])
        };
      }
      if (this.stack.length === 0) {
        return {
          done: true,
          value: void 0
        };
      }
      const node = this.stack.pop();
      switch (node._tag) {
        case "LeafNode": {
          const leaf = node;
          return {
            done: false,
            value: this.project(leaf.key, leaf.value)
          };
        }
        case "CollisionNode": {
          this.entries = node.entries;
          this.index = 0;
          break;
        }
        case "IndexedNode":
        case "ArrayNode": {
          const children = node.children;
          for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            if (child) this.stack.push(child);
          }
        }
      }
    }
  }
  [Symbol.iterator]() {
    return this;
  }
};
var toEntry = (key, value3) => [key, value3];
var HashMapImpl = class {
  [HashMapTypeId] = HashMapTypeId;
  _editable;
  _edit;
  _root;
  _size;
  constructor(editable, edit, root, size6) {
    this._editable = editable;
    this._edit = edit;
    this._root = root;
    this._size = size6;
  }
  get size() {
    return this._size;
  }
  [Symbol.iterator]() {
    return new HashMapIterator(this._root, toEntry);
  }
  [symbol2](that) {
    if (isHashMap(that)) {
      const thatImpl = that;
      if (this.size !== thatImpl.size) {
        return false;
      }
      for (const [key, value3] of this) {
        const otherValue = pipe(that, get3(key));
        if (isNone2(otherValue) || !equals(value3, otherValue.value)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  [symbol]() {
    return optimize(hashMapSeed ^ this._root.subtreeHash());
  }
  [NodeInspectSymbol]() {
    return toJson(this);
  }
  toString() {
    return `HashMap(${format(Array.from(this))})`;
  }
  toJSON() {
    return {
      _id: "HashMap",
      values: Array.from(this).map(([k, v]) => [toJson(k), toJson(v)])
    };
  }
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var emptyNode = /* @__PURE__ */ new EmptyNode();
var isHashMap = (u) => hasProperty(u, HashMapTypeId);
var empty5 = () => new HashMapImpl(false, 0, emptyNode, 0);
var fromIterable3 = (entries3) => {
  let root = emptyNode;
  let size6 = 0;
  const added = {
    value: false
  };
  for (const [key, value3] of entries3) {
    const hash2 = hash(key);
    added.value = false;
    root = root.set(NaN, 0, hash2, key, value3, added);
    if (added.value) {
      size6++;
    }
  }
  return new HashMapImpl(false, 0, root, size6);
};
var get3 = /* @__PURE__ */ dual(2, (self, key) => {
  const impl = self;
  return impl._root.get(0, hash(key), key);
});
var has3 = /* @__PURE__ */ dual(2, (self, key) => {
  const impl = self;
  return impl._root.has(0, hash(key), key);
});
var setHash = (self, key, hash2, value3) => {
  const impl = self;
  const added = {
    value: false
  };
  const edit = impl._editable ? impl._edit : NaN;
  const newRoot = impl._root.set(edit, 0, hash2, key, value3, added);
  if (impl._editable) {
    impl._root = newRoot;
    if (added.value) {
      impl._size++;
    }
    return self;
  }
  if (impl._root === newRoot) {
    return self;
  }
  return new HashMapImpl(false, impl._edit, newRoot, impl._size + (added.value ? 1 : 0));
};
var set2 = /* @__PURE__ */ dual(3, (self, key, value3) => {
  return setHash(self, key, hash(key), value3);
});
var keys2 = (self) => new HashMapIterator(self._root, identity);
var entries = (self) => self[Symbol.iterator]();
var size2 = (self) => self.size;

// node_modules/effect/dist/HashMap.js
var isHashMap2 = isHashMap;
var fromIterable4 = fromIterable3;
var entries2 = entries;
var toEntries = (self) => Array.from(entries2(self));
var size3 = size2;

// node_modules/effect/dist/internal/hashSet.js
var HashSetTypeId = "~effect/HashSet";
var hashSetSeed = /* @__PURE__ */ string(HashSetTypeId);
var HashSetProto = {
  [symbol]() {
    return optimize(combine(hashSetSeed, hash(keyMap(this))));
  },
  [symbol2](that) {
    return isHashSet(that) && size4(this) === size4(that) && every2(this, (value3) => has4(that, value3));
  },
  [Symbol.iterator]() {
    return keys2(keyMap(this));
  },
  toString() {
    return `HashSet(${format(Array.from(this))})`;
  },
  toJSON() {
    return {
      _id: "HashSet",
      values: toJson(Array.from(this))
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeImpl2 = (keyMap2) => {
  const set6 = Object.create(HashSetProto);
  set6[HashSetTypeId] = HashSetTypeId;
  set6.keyMap = keyMap2;
  return set6;
};
var isHashSet = (u) => hasProperty(u, HashSetTypeId);
var keyMap = (self) => self.keyMap;
var fromIterable5 = (values2) => {
  let map10 = empty5();
  for (const value3 of values2) {
    map10 = set2(map10, value3, true);
  }
  return makeImpl2(map10);
};
var has4 = (self, value3) => has3(keyMap(self), value3);
var size4 = (self) => size2(keyMap(self));
var every2 = (self, predicate) => {
  for (const value3 of self) {
    if (!predicate(value3)) {
      return false;
    }
  }
  return true;
};

// node_modules/effect/dist/HashSet.js
var fromIterable6 = fromIterable5;
var isHashSet2 = isHashSet;
var size5 = size4;

// node_modules/effect/dist/http/Cookies.js
var TypeId16 = "~effect/http/Cookies";
var isCookies = (u) => hasProperty(u, TypeId16);
var CookieTypeId = "~effect/http/Cookies/Cookie";
var isCookie = (u) => hasProperty(u, CookieTypeId);
var CookieErrorTypeId = "~effect/http/Cookies/CookieError";
var CookiesErrorReason = class extends Error3 {
};
var CookiesError = class _CookiesError extends (/* @__PURE__ */ TaggedError2("CookiesError")) {
  /**
   * Creates a cookie error from a reason tag and optional cause.
   *
   * @stability unstable
   * @since 4.0.0
   */
  static fromReason(reason, cause) {
    return new _CookiesError({
      reason: new CookiesErrorReason({
        _tag: reason,
        cause
      })
    });
  }
  /**
   * Marks this value as a cookie validation error for runtime guards.
   *
   * @stability unstable
   * @since 4.0.0
   */
  [CookieErrorTypeId] = CookieErrorTypeId;
  /**
   * Uses the concrete cookie error reason as the public message.
   *
   * @stability unstable
   * @since 4.0.0
   */
  get message() {
    return this.reason._tag;
  }
};
var Proto4 = {
  [TypeId16]: TypeId16,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies",
      cookies: map3(this.cookies, (cookie) => cookie.toJSON())
    };
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var fromReadonlyRecord = (cookies) => {
  const self = Object.create(Proto4);
  self.cookies = cookies;
  return self;
};
var fromIterable7 = (cookies) => {
  const record2 = {};
  for (const cookie of cookies) {
    assignProperty(record2, cookie.name, cookie);
  }
  return fromReadonlyRecord(record2);
};
var fromSetCookie = (headers) => {
  const arrayHeaders = typeof headers === "string" ? [headers] : headers;
  const cookies = [];
  for (const header of arrayHeaders) {
    const cookie = parseSetCookie(header.trim());
    if (cookie) {
      cookies.push(cookie);
    }
  }
  return fromIterable7(cookies);
};
function parseSetCookie(header) {
  const parts2 = header.split(";").map((_) => _.trim()).filter((_) => _ !== "");
  if (parts2.length === 0) {
    return void 0;
  }
  const firstEqual = parts2[0].indexOf("=");
  if (firstEqual === -1) {
    return void 0;
  }
  const name = parts2[0].slice(0, firstEqual);
  if (!cookieNameRegExp.test(name)) {
    return void 0;
  }
  const valueEncoded = parts2[0].slice(firstEqual + 1);
  const value3 = tryDecodeURIComponent(valueEncoded);
  if (parts2.length === 1) {
    return Object.assign(Object.create(CookieProto), {
      name,
      value: value3,
      valueEncoded
    });
  }
  const options = {};
  for (let i = 1; i < parts2.length; i++) {
    const part = parts2[i];
    const equalIndex = part.indexOf("=");
    const key = equalIndex === -1 ? part : part.slice(0, equalIndex).trim();
    const value4 = equalIndex === -1 ? void 0 : part.slice(equalIndex + 1).trim();
    switch (key.toLowerCase()) {
      case "domain": {
        if (value4 === void 0) {
          break;
        }
        const domain = value4.trim().replace(/^\./, "");
        if (domain) {
          options.domain = domain;
        }
        break;
      }
      case "expires": {
        if (value4 === void 0) {
          break;
        }
        const date = new Date(value4);
        if (!isNaN(date.getTime())) {
          options.expires = date;
        }
        break;
      }
      case "max-age": {
        if (value4 === void 0) {
          break;
        }
        const maxAge = parseInt(value4, 10);
        if (!isNaN(maxAge)) {
          options.maxAge = seconds(maxAge);
        }
        break;
      }
      case "path": {
        if (value4 === void 0) {
          break;
        }
        if (value4[0] === "/") {
          options.path = value4;
        }
        break;
      }
      case "priority": {
        if (value4 === void 0) {
          break;
        }
        switch (value4.toLowerCase()) {
          case "low":
            options.priority = "low";
            break;
          case "medium":
            options.priority = "medium";
            break;
          case "high":
            options.priority = "high";
            break;
        }
        break;
      }
      case "httponly": {
        options.httpOnly = true;
        break;
      }
      case "secure": {
        options.secure = true;
        break;
      }
      case "partitioned": {
        options.partitioned = true;
        break;
      }
      case "samesite": {
        if (value4 === void 0) {
          break;
        }
        switch (value4.toLowerCase()) {
          case "lax":
            options.sameSite = "lax";
            break;
          case "strict":
            options.sameSite = "strict";
            break;
          case "none":
            options.sameSite = "none";
            break;
        }
        break;
      }
    }
  }
  return Object.assign(Object.create(CookieProto), {
    name,
    value: value3,
    valueEncoded,
    options: Object.keys(options).length > 0 ? options : void 0
  });
}
var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;
var cookieNameRegExp = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
var cookieDomainRegExp = /^[\u0009\u0020-\u003a\u003c-\u007e\u0080-\u00ff]+$/;
var cookiePathRegExp = /^[\u0020-\u003a\u003c-\u007e]+$/;
var CookieProto = {
  [CookieTypeId]: CookieTypeId,
  ...BaseProto,
  toJSON() {
    return {
      _id: "effect/Cookies/Cookie",
      name: this.name,
      value: this.value,
      options: this.options
    };
  }
};
function makeCookie(name, value3, options) {
  const encodedValue = encodeURIComponent(value3);
  const error = validateCookie(name, encodedValue, options);
  if (error !== void 0) {
    return fail2(error);
  }
  return succeed2(Object.assign(Object.create(CookieProto), {
    name,
    value: value3,
    valueEncoded: encodedValue,
    options
  }));
}
function validateCookie(name, encodedValue, options) {
  if (!cookieNameRegExp.test(name)) {
    return CookiesError.fromReason("InvalidCookieName");
  }
  if (encodedValue && !fieldContentRegExp.test(encodedValue)) {
    return CookiesError.fromReason("InvalidCookieValue");
  }
  if (options?.domain !== void 0 && !cookieDomainRegExp.test(options.domain)) {
    return CookiesError.fromReason("InvalidCookieDomain");
  }
  if (options?.path !== void 0 && !cookiePathRegExp.test(options.path)) {
    return CookiesError.fromReason("InvalidCookiePath");
  }
  if (options?.maxAge !== void 0 && !isFinite(fromInputUnsafe(options.maxAge))) {
    return CookiesError.fromReason("CookieInfinityMaxAge");
  }
}
var makeCookieUnsafe = (name, value3, options) => getOrThrow(makeCookie(name, value3, options));
function serializeCookie(self) {
  const error = validateCookie(self.name, self.valueEncoded, self.options);
  if (error !== void 0) {
    throw error;
  }
  let str = self.name + "=" + self.valueEncoded;
  if (self.options === void 0) {
    return str;
  }
  const options = self.options;
  if (options.maxAge !== void 0) {
    const maxAge = toSeconds(fromInputUnsafe(options.maxAge));
    str += "; Max-Age=" + Math.trunc(maxAge);
  }
  if (options.domain !== void 0) {
    str += "; Domain=" + options.domain;
  }
  if (options.path !== void 0) {
    str += "; Path=" + options.path;
  }
  if (options.priority !== void 0) {
    switch (options.priority) {
      case "low":
        str += "; Priority=Low";
        break;
      case "medium":
        str += "; Priority=Medium";
        break;
      case "high":
        str += "; Priority=High";
        break;
    }
  }
  if (options.expires !== void 0) {
    str += "; Expires=" + options.expires.toUTCString();
  }
  if (options.httpOnly) {
    str += "; HttpOnly";
  }
  if (options.secure) {
    str += "; Secure";
  }
  if (options.partitioned) {
    str += "; Partitioned";
  }
  if (options.sameSite !== void 0) {
    switch (options.sameSite) {
      case "lax":
        str += "; SameSite=Lax";
        break;
      case "strict":
        str += "; SameSite=Strict";
        break;
      case "none":
        str += "; SameSite=None";
        break;
    }
  }
  return str;
}
var toRecord = (self) => {
  const record2 = {};
  const cookies = Object.values(self.cookies);
  for (let index2 = 0; index2 < cookies.length; index2++) {
    const cookie = cookies[index2];
    assignProperty(record2, cookie.name, cookie.value);
  }
  return record2;
};
var toSetCookieHeaders = (self) => Object.values(self.cookies).map(serializeCookie);
var tryDecodeURIComponent = (str) => {
  try {
    return decodeURIComponent(str);
  } catch (_) {
    return str;
  }
};

// node_modules/effect/dist/internal/redacted.js
var redactedRegistry = /* @__PURE__ */ new WeakMap();
var value = (self) => {
  if (redactedRegistry.has(self)) {
    return redactedRegistry.get(self);
  } else {
    throw new Error("Unable to get redacted value" + (self.label ? ` with label: "${self.label}"` : ""));
  }
};

// node_modules/effect/dist/Redacted.js
var TypeId17 = "~effect/Redacted";
var isRedacted = (u) => hasProperty(u, TypeId17);
var make12 = (value3, options) => {
  const self = Object.create(Proto5);
  if (options?.label) {
    self.label = options.label;
  }
  redactedRegistry.set(self, value3);
  return self;
};
var Proto5 = {
  [TypeId17]: {
    _A: (_) => _
  },
  label: void 0,
  ...PipeInspectableProto,
  toJSON() {
    return this.toString();
  },
  toString() {
    return `<redacted${isString(this.label) ? ":" + this.label : ""}>`;
  },
  [symbol]() {
    return hash(redactedRegistry.get(this));
  },
  [symbol2](that) {
    return isRedacted(that) && equals(redactedRegistry.get(this), redactedRegistry.get(that));
  }
};
var value2 = value;
var makeEquivalence6 = (isEquivalent) => make((x, y) => isEquivalent(value2(x), value2(y)));

// node_modules/effect/dist/http/Headers.js
var TypeId18 = /* @__PURE__ */ Symbol.for("~effect/http/Headers");
var isHeaders = (u) => hasProperty(u, TypeId18);
var Proto6 = /* @__PURE__ */ Object.defineProperties(/* @__PURE__ */ Object.create(null), {
  [TypeId18]: {
    value: TypeId18
  },
  [symbolRedactable]: {
    value(context3) {
      return redact2(this, get(context3, CurrentRedactedNames));
    }
  },
  toJSON: {
    value() {
      return redact(this);
    }
  },
  [symbol2]: {
    value(that) {
      return Equivalence5(this, that);
    }
  },
  [symbol]: {
    value() {
      return structure(this);
    }
  },
  toString: {
    value: BaseProto.toString
  },
  [NodeInspectSymbol]: {
    value: BaseProto[NodeInspectSymbol]
  }
});
var Equivalence5 = /* @__PURE__ */ makeEquivalence3(/* @__PURE__ */ strictEqual());
var empty7 = /* @__PURE__ */ Object.create(Proto6);
var fromInput3 = (input) => {
  if (input === void 0) {
    return empty7;
  } else if (Symbol.iterator in input) {
    const out2 = Object.create(Proto6);
    for (const [k, v] of input) {
      out2[k.toLowerCase()] = v;
    }
    return out2;
  }
  const out = Object.create(Proto6);
  for (const [k, v] of Object.entries(input)) {
    if (Array.isArray(v)) {
      out[k.toLowerCase()] = v.join(", ");
    } else if (v !== void 0) {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
};
var redact2 = /* @__PURE__ */ dual(2, (self, key) => {
  const out = {
    ...self
  };
  const modify4 = (key2) => {
    if (typeof key2 === "string") {
      const k = key2.toLowerCase();
      if (k in self) {
        out[k] = make12(self[k]);
      }
    } else {
      for (const name in self) {
        if (name.search(key2) !== -1) {
          out[name] = make12(self[name]);
        }
      }
    }
  };
  if (Array.isArray(key)) {
    for (let i = 0; i < key.length; i++) {
      modify4(key[i]);
    }
  } else {
    modify4(key);
  }
  return out;
});
var isRedactedName = (name, patterns) => {
  const lowerName = name.toLowerCase();
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (typeof pattern === "string") {
      if (pattern.toLowerCase() === lowerName) {
        return true;
      }
    } else if (name.search(pattern) !== -1) {
      return true;
    }
  }
  return false;
};
var CurrentRedactedNames = /* @__PURE__ */ Reference("effect/Headers/CurrentRedactedNames", {
  defaultValue: () => ["authorization", "cookie", "set-cookie", "x-api-key"]
});
var HeaderParseErrorTypeId = "~effect/http/Headers/HeaderParseError";
var HeaderParseErrorReason = class extends Error3 {
};
var HeaderParseError = class _HeaderParseError extends (/* @__PURE__ */ TaggedError2("HeaderParseError")) {
  /**
   * Creates a header parse error from a reason tag and the rejected input.
   *
   * @stability unstable
   * @since 4.0.0
   */
  static fromReason(reason, input) {
    return new _HeaderParseError({
      reason: new HeaderParseErrorReason({
        _tag: reason,
        input
      })
    });
  }
  /**
   * Marks this value as a header parse error for runtime guards.
   *
   * @stability unstable
   * @since 4.0.0
   */
  [HeaderParseErrorTypeId] = HeaderParseErrorTypeId;
  /**
   * Names the failed header and the rejected input.
   *
   * @stability unstable
   * @since 4.0.0
   */
  get message() {
    return `${this.reason._tag}: ${JSON.stringify(this.reason.input)}`;
  }
};
var monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
var httpDateFormats = [
  // Sun, 06 Nov 1994 08:49:37 GMT
  /^(?:mon|tue|wed|thu|fri|sat|sun), (?<day>\d{2}) (?<month>[a-z]{3}) (?<year>\d{4}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}) gmt$/i,
  // Sunday, 06-Nov-94 08:49:37 GMT
  /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday), (?<day>\d{2})-(?<month>[a-z]{3})-(?<year>\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}) gmt$/i,
  // Sun Nov  6 08:49:37 1994
  /^(?:mon|tue|wed|thu|fri|sat|sun) (?<month>[a-z]{3}) (?<day> \d|\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2}) (?<year>\d{4})$/i
];
var httpDateToMillis = (input) => {
  for (const format9 of httpDateFormats) {
    const groups = format9.exec(input)?.groups;
    if (groups === void 0) continue;
    const month = monthNames.indexOf(groups.month.toLowerCase());
    const hour = Number(groups.hour);
    const minute = Number(groups.minute);
    const second = Number(groups.second);
    if (month === -1 || hour > 23 || minute > 59 || second > 60) {
      return void 0;
    }
    let year = Number(groups.year);
    if (groups.year.length === 2) {
      year += year < 70 ? 2e3 : 1900;
    }
    const day = Number(groups.day);
    const date = /* @__PURE__ */ new Date(0);
    date.setUTCFullYear(year, month, day);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
      return void 0;
    }
    return date.getTime() + ((hour * 60 + minute) * 60 + second) * 1e3;
  }
  return void 0;
};
var parseHttpDate = (input) => {
  const millis2 = httpDateToMillis(input.trim());
  return millis2 === void 0 ? fail2(HeaderParseError.fromReason("InvalidHttpDate", input)) : succeed2(makeUnsafe5(millis2));
};
var formatHttpDate = (self) => toDateUtc2(self).toUTCString();
var retryAfterDateTime = (dateTime) => ({
  _tag: "DateTime",
  dateTime
});
var wholeSeconds = /^\d+$/;
var nanosPerSecond = /* @__PURE__ */ BigInt(1e9);
var parseRetryAfter = (input) => {
  const trimmed = input.trim();
  if (wholeSeconds.test(trimmed)) {
    const seconds2 = Number(trimmed);
    const duration = Number.isSafeInteger(seconds2 * 1e3) ? seconds(seconds2) : nanos(BigInt(trimmed) * nanosPerSecond);
    return succeed2({
      _tag: "Duration",
      duration
    });
  }
  const millis2 = httpDateToMillis(trimmed);
  return millis2 === void 0 ? fail2(HeaderParseError.fromReason("InvalidRetryAfter", input)) : succeed2(retryAfterDateTime(makeUnsafe5(millis2)));
};
var formatRetryAfter = (self) => self._tag === "Duration" ? String((toNanosUnsafe(self.duration) + nanosPerSecond - BigInt(1)) / nanosPerSecond) : formatHttpDate(self.dateTime);

// node_modules/effect/dist/http/internal/urlParams.js
var unwrap = (value3) => typeof value3 === "string" ? value3 : value2(value3);

// node_modules/effect/dist/http/UrlParams.js
var TypeId19 = "~effect/http/UrlParams";
var isUrlParams = (u) => hasProperty(u, TypeId19);
var Proto7 = {
  ...PipeInspectableProto,
  [TypeId19]: TypeId19,
  [Symbol.iterator]() {
    return this.params[Symbol.iterator]();
  },
  [symbolRedactable](context3) {
    return {
      _id: "UrlParams",
      params: Object.fromEntries(redact3(this, get(context3, CurrentRedactedNames2)))
    };
  },
  toJSON() {
    return redact(this);
  },
  [symbol2](that) {
    return Equivalence6(this, that);
  },
  [symbol]() {
    return array(this.params.flat());
  }
};
var make13 = (params) => {
  const self = Object.create(Proto7);
  self.params = params;
  return self;
};
var fromInput4 = (input) => {
  if (isUrlParams(input)) {
    return input;
  }
  const parsed = fromInputNested(input);
  const out = [];
  for (let i = 0; i < parsed.length; i++) {
    if (Array.isArray(parsed[i][0])) {
      const [keys3, value3] = parsed[i];
      out.push([`${keys3[0]}[${keys3.slice(1).join("][")}]`, value3]);
    } else {
      out.push(parsed[i]);
    }
  }
  return make13(out);
};
var fromInputNested = (input) => {
  const entries3 = typeof input[Symbol.iterator] === "function" ? fromIterable(input) : Object.entries(input);
  const out = [];
  for (const [key, value3] of entries3) {
    if (Array.isArray(value3)) {
      for (let i = 0; i < value3.length; i++) {
        if (value3[i] !== void 0) {
          out.push([key, coerce(value3[i])]);
        }
      }
    } else if (value3 !== null && typeof value3 === "object" && !isRedacted(value3)) {
      const nested = fromInputNested(value3);
      for (const [k, v] of nested) {
        out.push([[key, ...typeof k === "string" ? [k] : k], v]);
      }
    } else if (value3 !== void 0) {
      out.push([key, coerce(value3)]);
    }
  }
  return out;
};
var coerce = (value3) => isRedacted(value3) ? value3 : String(value3);
var Equivalence6 = /* @__PURE__ */ make((a, b) => arrayEquivalence(a.params, b.params));
var arrayEquivalence = /* @__PURE__ */ makeEquivalence4(/* @__PURE__ */ makeEquivalence2([/* @__PURE__ */ strictEqual(), /* @__PURE__ */ asEquivalence()]));
var getFirst = /* @__PURE__ */ dual(2, (self, key) => findFirst2(self.params, ([k]) => k === key).pipe(map(([, value3]) => unwrap(value3))));
var toRecord2 = (self) => {
  const out = {};
  for (const [k, v] of self.params) {
    const value3 = unwrap(v);
    if (!Object.hasOwn(out, k)) {
      assignProperty(out, k, value3);
    } else {
      const current = out[k];
      if (typeof current === "string") {
        assignProperty(out, k, [current, value3]);
      } else {
        current.push(value3);
      }
    }
  }
  return out;
};
var toReadonlyRecord = toRecord2;
var redact3 = /* @__PURE__ */ dual(2, (self, key) => {
  const patterns = Array.isArray(key) ? key : [key];
  return self.params.map(([name, value3]) => [name, typeof value3 === "string" && isRedactedName2(name, patterns) ? make12(value3) : value3]);
});
var isRedactedName2 = isRedactedName;
var CurrentRedactedNames2 = /* @__PURE__ */ Reference("effect/http/UrlParams/CurrentRedactedNames", {
  defaultValue: () => ["AWSAccessKeyId", "Signature", "sig", "X-Goog-Signature"]
});

// node_modules/effect/dist/internal/graph.js
var TypeId20 = "~effect/Graph";
var isGraph = (u) => hasProperty(u, TypeId20);
var toImpl = (graph) => graph;
var edgeEquals = (type, self, that) => (type === "directed" ? self.source === that.source && self.target === that.target : self.source === that.source && self.target === that.target || self.source === that.target && self.target === that.source) && equals(self.data, that.data);
var edgeHash = (type, edge) => type === "directed" ? hash(edge) : optimize(combine(hash(edge.data), endpointsHash(edge.source, edge.target)));
var endpointsHash = (source, target) => combine(0, hash(source)) + combine(0, hash(target));
var graphSeed = /* @__PURE__ */ string("Graph");
var ProtoGraph = {
  [TypeId20]: {
    _N: (_) => _,
    _E: (_) => _
  },
  [Symbol.iterator]() {
    return this.nodes[Symbol.iterator]();
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  [symbol2](that) {
    if (hasProperty(that, TypeId20)) {
      const thatImpl = toImpl(that);
      if (this.nodes.size !== thatImpl.nodes.size || this.edges.size !== thatImpl.edges.size || this.type !== thatImpl.type) {
        return false;
      }
      for (const [nodeIndex, nodeData] of this.nodes) {
        if (!thatImpl.nodes.has(nodeIndex) || !equals(nodeData, thatImpl.nodes.get(nodeIndex))) {
          return false;
        }
      }
      for (const [edgeIndex, edgeData] of this.edges) {
        const otherEdge = thatImpl.edges.get(edgeIndex);
        if (otherEdge === void 0 || !edgeEquals(this.type, edgeData, otherEdge)) {
          return false;
        }
      }
      return true;
    }
    return false;
  },
  [symbol]() {
    let hash2 = graphSeed;
    hash2 = hash2 ^ string(this.type);
    hash2 = hash2 ^ number(this.nodes.size);
    hash2 = hash2 ^ number(this.edges.size);
    for (const [nodeIndex, nodeData] of this.nodes) {
      hash2 ^= combine(hash(nodeIndex), hash(nodeData));
    }
    for (const [edgeIndex, edgeData] of this.edges) {
      hash2 ^= combine(hash(edgeIndex), edgeHash(this.type, edgeData));
    }
    return optimize(hash2);
  },
  toJSON() {
    return {
      _id: "Graph",
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      type: this.type
    };
  },
  toString() {
    return `Graph(${this.type}, ${this.nodes.size}, ${this.edges.size})`;
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var make14 = (type, mutable3) => {
  const graph = Object.create(ProtoGraph);
  graph.type = type;
  graph.mutable = mutable3;
  graph.transforming = false;
  graph.nodes = /* @__PURE__ */ new Map();
  graph.edges = /* @__PURE__ */ new Map();
  graph.adjacency = /* @__PURE__ */ new Map();
  graph.reverseAdjacency = /* @__PURE__ */ new Map();
  graph.nextNodeIndex = 0;
  graph.nextEdgeIndex = 0;
  graph.acyclic = some2(true);
  return graph;
};
var snapshot = (graph) => {
  const impl = toImpl(graph);
  return {
    type: graph.type,
    nodes: Array.from(impl.nodes, ([index2, data]) => ({
      index: index2,
      data
    })).sort((a, b) => a.index - b.index),
    edges: Array.from(impl.edges, ([index2, edge]) => ({
      index: index2,
      source: edge.source,
      target: edge.target,
      data: edge.data
    })).sort((a, b) => a.index - b.index)
  };
};
var hydrate = (snapshot2) => {
  const graph = make14(snapshot2.type, false);
  for (const node of snapshot2.nodes) {
    graph.nodes.set(node.index, node.data);
    graph.adjacency.set(node.index, []);
    graph.reverseAdjacency.set(node.index, []);
  }
  for (const edge of snapshot2.edges) {
    graph.edges.set(edge.index, {
      source: edge.source,
      target: edge.target,
      data: edge.data
    });
    graph.adjacency.get(edge.source).push(edge.index);
    graph.reverseAdjacency.get(edge.target).push(edge.index);
    if (snapshot2.type === "undirected") {
      graph.adjacency.get(edge.target).push(edge.index);
      graph.reverseAdjacency.get(edge.source).push(edge.index);
    }
  }
  graph.nextNodeIndex = snapshot2.nodes.length === 0 ? 0 : snapshot2.nodes[snapshot2.nodes.length - 1].index + 1;
  graph.nextEdgeIndex = snapshot2.edges.length === 0 ? 0 : snapshot2.edges[snapshot2.edges.length - 1].index + 1;
  graph.acyclic = none2();
  return graph;
};

// node_modules/effect/dist/internal/schema/annotations.js
function resolve(ast) {
  return ast.checks ? ast.checks[ast.checks.length - 1].annotations : ast.annotations;
}
function resolveAt(key) {
  return (ast) => resolve(ast)?.[key];
}
var STRUCTURAL_ANNOTATION_KEY = "~structural";
var IDENTIFIER_FALLBACK_KEY = "~identifier";
var SENTINELS_ANNOTATION_KEY = "~sentinels";
var CONSTRUCTOR_ANNOTATION_KEY = "~constructor";
var jsonSchemaAnnotationKeys = ["title", "description", "default", "examples", "readOnly", "writeOnly", "format", "contentEncoding", "contentMediaType", "contentSchema"];
var resolveIdentifier = /* @__PURE__ */ resolveAt("identifier");
var resolveIdentifierFallback = /* @__PURE__ */ resolveAt(IDENTIFIER_FALLBACK_KEY);
var resolveTitle = /* @__PURE__ */ resolveAt("title");
var getExpected = /* @__PURE__ */ memoize((ast) => {
  const identifier2 = resolve(ast)?.identifier;
  if (typeof identifier2 === "string") return identifier2;
  return ast.getExpected(getExpected);
});
var annotationExcludedKeys = /* @__PURE__ */ new Set([SENTINELS_ANNOTATION_KEY, STRUCTURAL_ANNOTATION_KEY, "representation", "arbitraryConstraint", "toJsonSchema", "toCode", "toEquivalence", "toFormatter", "toCodec", "toCodecJson", "toCodecStringTree", "toCodecIso", "toCodecArbitrary"]);

// node_modules/effect/dist/internal/schema/parser.js
var missing = /* @__PURE__ */ Symbol();
var succeed6 = succeed4;
var missingExit = /* @__PURE__ */ succeed6(missing);
var sameExit = /* @__PURE__ */ succeed6(missing);
var toOption = (value3) => value3 === missing ? none2() : some2(value3);
var fromOptionExit = (option3) => option3._tag === "None" ? missingExit : succeed6(option3.value);

// node_modules/effect/dist/SchemaIssue.js
var TypeId21 = "~effect/SchemaIssue/Issue";
function isIssue(u) {
  return hasProperty(u, TypeId21) && u[TypeId21] === TypeId21;
}
function hasInput(issue) {
  return Object.hasOwn(issue, "input");
}
var IssueNodeImpl = class {
  [TypeId21] = TypeId21;
  constructor(input, options) {
    if (options?.reportInput === true && input !== missing) {
      this.input = input;
    }
  }
};
var Filter = class extends IssueNodeImpl {
  _tag = "Filter";
  /**
   * The filter that failed.
   */
  filter;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(filter8, issue, input, options) {
    super(input, options);
    this.filter = filter8;
    this.issue = issue;
  }
};
var Encoding = class extends IssueNodeImpl {
  _tag = "Encoding";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(ast, issue, input, options) {
    super(input, options);
    this.ast = ast;
    this.issue = issue;
  }
};
var Pointer = class extends IssueNodeImpl {
  _tag = "Pointer";
  /**
   * The path to the location in the input that caused the issue.
   */
  path;
  /**
   * The issue that occurred.
   */
  issue;
  constructor(path, issue) {
    super();
    this.path = path;
    this.issue = issue;
  }
};
var MissingKey = class extends IssueNodeImpl {
  _tag = "MissingKey";
  /**
   * The metadata for the issue.
   */
  annotations;
  constructor(annotations) {
    super();
    this.annotations = annotations;
  }
};
var UnexpectedKey = class extends IssueNodeImpl {
  _tag = "UnexpectedKey";
  /**
   * The schema that caused the issue.
   */
  ast;
  constructor(ast, input, options) {
    super(input, options);
    this.ast = ast;
  }
};
var Composite = class extends IssueNodeImpl {
  _tag = "Composite";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The issues that occurred.
   */
  issues;
  constructor(ast, issues, input, options) {
    super(input, options);
    this.ast = ast;
    this.issues = issues;
  }
};
var InvalidType = class extends IssueNodeImpl {
  _tag = "InvalidType";
  /**
   * The schema that caused the issue.
   */
  ast;
  constructor(ast, input, options) {
    super(input, options);
    this.ast = ast;
  }
};
var InvalidValue = class extends IssueNodeImpl {
  _tag = "InvalidValue";
  /**
   * The metadata for the issue.
   */
  annotations;
  constructor(annotations, input, options) {
    super(input, options);
    this.annotations = annotations;
  }
};
function makeCompositeAtKey(compositeAst, pointerKey, pointerIssue, compositeInput, parseOptions) {
  return new Composite(compositeAst, [new Pointer([pointerKey], pointerIssue)], compositeInput, parseOptions);
}
var Forbidden = class extends IssueNodeImpl {
  _tag = "Forbidden";
  /**
   * The metadata for the issue.
   */
  annotations;
  constructor(annotations, input, options) {
    super(input, options);
    this.annotations = annotations;
  }
};
var AnyOf = class extends IssueNodeImpl {
  _tag = "AnyOf";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The issues that occurred.
   */
  issues;
  constructor(ast, issues, input, options) {
    super(input, options);
    this.ast = ast;
    this.issues = issues;
  }
};
var OneOf = class extends IssueNodeImpl {
  _tag = "OneOf";
  /**
   * The schema that caused the issue.
   */
  ast;
  /**
   * The schemas that were successful.
   */
  successes;
  constructor(ast, successes, input, options) {
    super(input, options);
    this.ast = ast;
    this.successes = successes;
  }
};
function makeFilterIssue(entry, input, options) {
  if (isIssue(entry)) {
    return entry;
  }
  if (typeof entry === "string") {
    return new InvalidValue({
      message: entry
    }, input, options);
  }
  const inner = typeof entry.issue === "string" ? new InvalidValue({
    message: entry.issue
  }, input, options) : entry.issue;
  return new Pointer(entry.path, inner);
}
function makeSingle(out, input, options) {
  if (out === void 0) {
    return void 0;
  }
  if (typeof out === "boolean") {
    return out ? void 0 : new InvalidValue(void 0, input, options);
  }
  return makeFilterIssue(out, input, options);
}
function normalizeFilterOutput(ast, out, input, options) {
  if (Array.isArray(out)) {
    if (!isReadonlyArrayNonEmpty(out)) {
      return void 0;
    }
    return out.length === 1 ? makeFilterIssue(out[0], input, options) : new Composite(ast, map4(out, (entry) => makeFilterIssue(entry, input, options)), input, options);
  }
  return makeSingle(out, input, options);
}
var defaultLeafHook = (issue) => {
  const message = findMessage(issue);
  if (message !== void 0) return message;
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(getExpected(issue.ast), issue);
    case "InvalidValue": {
      const expected = findExpected(issue);
      if (expected !== void 0) return getExpectedMessage(expected, issue);
      const input = formatInput(issue);
      return input === void 0 ? "Expected a valid value" : `Invalid data ${input}`;
    }
    case "MissingKey":
      return "Missing key";
    case "UnexpectedKey": {
      const input = formatInput(issue);
      return input === void 0 ? "Expected no excess property" : `Unexpected key with value ${input}`;
    }
    case "Forbidden":
      return "Forbidden operation";
    case "OneOf": {
      const input = formatInput(issue);
      return input === void 0 ? "Expected exactly one member to match" : `Expected exactly one member to match the input ${input}`;
    }
  }
};
var defaultCheckHook = (issue) => findMessage(issue) ?? findMessage(issue.issue);
function makeFormatterStandardSchemaV1(options) {
  return (issue) => ({
    issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook, options?.checkHook ?? defaultCheckHook)
  });
}
function formatInput(issue) {
  return hasInput(issue) ? format(issue.input) : void 0;
}
function findExpected(issue) {
  const expected = issue.annotations?.expected;
  return typeof expected === "string" ? expected : void 0;
}
function getExpectedMessage(expected, issue) {
  const input = formatInput(issue);
  return input === void 0 ? `Expected ${expected}` : `Expected ${expected}, got ${input}`;
}
function getFilterMessage(issue, checkHook) {
  const message = checkHook(issue);
  if (message !== void 0 || issue.issue._tag !== "InvalidValue") return message;
  const expected = findExpected(issue.issue);
  return expected === void 0 ? getExpectedMessage(formatCheck(issue.filter), issue) : getExpectedMessage(expected, issue.issue);
}
function toDefaultIssues(issue, path, leafHook, checkHook, messageOverride) {
  switch (issue._tag) {
    case "Filter":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook, messageOverride ?? getFilterMessage(issue, checkHook));
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook, messageOverride);
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook, checkHook, messageOverride);
    case "Composite":
    case "AnyOf": {
      if (issue._tag === "Composite" || issue.issues.length > 0) {
        return issue.issues.flatMap((issue2) => toDefaultIssues(issue2, path, leafHook, checkHook, messageOverride));
      }
      return [{
        path,
        message: messageOverride ?? findMessage(issue) ?? getExpectedMessage(getExpected(issue.ast), issue)
      }];
    }
    default:
      return [{
        path,
        message: messageOverride ?? leafHook(issue)
      }];
  }
}
function formatCheck(check2) {
  const expected = check2.annotations?.expected;
  if (typeof expected === "string") return expected;
  switch (check2._tag) {
    case "Filter":
      return "<filter>";
    case "FilterGroup":
      return check2.checks.map((check3) => formatCheck(check3)).join(" & ");
  }
}
function makeFormatterDefault() {
  return (issue) => formatIssue(issue, "");
}
var defaultFormatter = /* @__PURE__ */ makeFormatterDefault();
function formatIssue(issue, path, messageOverride) {
  let message;
  switch (issue._tag) {
    case "Filter":
      return formatIssue(issue.issue, path, messageOverride ?? getFilterMessage(issue, defaultCheckHook));
    case "Encoding":
      return formatIssue(issue.issue, path, messageOverride);
    case "Pointer":
      return formatIssue(issue.issue, path + formatPath(issue.path), messageOverride);
    case "Composite":
    case "AnyOf": {
      if (issue._tag === "Composite" || issue.issues.length > 0) {
        return issue.issues.map((issue2) => formatIssue(issue2, path, messageOverride)).join("\n");
      }
      message = messageOverride ?? findMessage(issue) ?? getExpectedMessage(getExpected(issue.ast), issue);
      break;
    }
    default:
      message = messageOverride ?? defaultLeafHook(issue);
      break;
  }
  return path ? `${message}
  at ${path}` : message;
}
function findMessage(issue) {
  if (issue._tag === "Pointer" || issue._tag === "Composite") return;
  if (issue._tag === "Encoding") return findMessage(issue.issue);
  const annotations = issue._tag === "Filter" ? issue.filter.annotations : "annotations" in issue ? issue.annotations : issue.ast.annotations;
  const message = annotations?.[issue._tag === "MissingKey" ? "messageMissingKey" : issue._tag === "UnexpectedKey" ? "messageUnexpectedKey" : "message"];
  if (typeof message === "string") return message;
}

// node_modules/effect/dist/internal/schema/cause.js
function getSchemaIssue(cause) {
  let issue;
  for (const reason of cause.reasons) {
    if (!isFailReason2(reason) || !isIssue(reason.error)) {
      return void 0;
    }
    issue ??= reason.error;
  }
  return issue;
}
function getSchemaIssueOrThrow(cause, message) {
  const issue = getSchemaIssue(cause);
  if (issue === void 0) {
    throw new Error(message, {
      cause
    });
  }
  return issue;
}

// node_modules/effect/dist/encoding/Base64Url.js
var encode3 = (input) => encode2(input).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
var encodePadded = (input) => encode2(input).replace(/\+/g, "-").replace(/\//g, "_");
var decode3 = (str) => {
  const stripped = str.replace(/[\n\r]/g, "");
  const length = stripped.length;
  if (length % 4 === 1) {
    return fail2(new EncodingError({
      module: "Base64Url",
      kind: "Decode",
      input: stripped,
      message: `Length should be a multiple of 4, but is ${length}`
    }));
  }
  if (!/^[-_A-Z0-9]*?={0,2}$/i.test(stripped)) {
    return fail2(new EncodingError({
      module: "Base64Url",
      kind: "Decode",
      input: stripped,
      message: "Invalid input"
    }));
  }
  let sanitized = length % 4 === 2 ? `${stripped}==` : length % 4 === 3 ? `${stripped}=` : stripped;
  sanitized = sanitized.replace(/-/g, "+").replace(/_/g, "/");
  return decode2(sanitized);
};
var decodeString3 = (str) => map2(decode3(str), (_) => decoder3.decode(_));
var decoder3 = /* @__PURE__ */ new TextDecoder();

// node_modules/effect/dist/SchemaGetter.js
var makeGetter = (fields) => Object.assign(Object.create(Prototype), fields);
function fail6(f) {
  return transformOptionalEffect((oe, options) => fail5(f(oe, options)));
}
function forbidden(message) {
  return fail6((oe, options) => {
    const annotations = {
      message: message(oe)
    };
    return isSome2(oe) ? new Forbidden(annotations, oe.value, options) : new Forbidden(annotations);
  });
}
var forbiddenEncoding = /* @__PURE__ */ forbidden(() => "Encoding is not supported");
var passthrough_ = /* @__PURE__ */ makeGetter({
  _tag: "Passthrough"
});
function passthrough2() {
  return passthrough_;
}
function transform(f) {
  return makeGetter({
    _tag: "Transform",
    transform: f
  });
}
function transformEffect(f) {
  return makeGetter({
    _tag: "TransformEffect",
    transform: f
  });
}
function transformOptional(f) {
  return makeGetter({
    _tag: "TransformOptional",
    transform: f
  });
}
function transformOptionalEffect(f) {
  return makeGetter({
    _tag: "TransformOptionalEffect",
    transform: f
  });
}
function omit() {
  return transformOptional(() => none2());
}
function withDefault(defaultValue) {
  return transformOptionalEffect((o) => {
    const filtered = filter(o, isNotUndefined);
    return isSome2(filtered) ? succeed5(filtered) : mapEager2(defaultValue, some2);
  });
}
function String4() {
  return transform(globalThis.String);
}
function Number4() {
  return transform(globalThis.Number);
}
function BigInt4() {
  return transformEffect((input, options) => {
    try {
      return succeed5(globalThis.BigInt(input));
    } catch {
      return fail5(new InvalidValue({
        expected: "a value that can be converted to a bigint"
      }, input, options));
    }
  });
}
function Date3() {
  return transform((u) => new globalThis.Date(u));
}
function trim2() {
  return transform(trim);
}
function parseJson(options) {
  return transformEffect((input, parseOptions) => try_3({
    try: () => JSON.parse(input, options?.reviver),
    catch: () => new InvalidValue({
      expected: "a valid JSON string"
    }, input, parseOptions)
  }));
}
function stringifyJson(options) {
  return transformEffect((input, parseOptions) => try_3({
    try: () => {
      const output = JSON.stringify(input, options?.replacer, options?.space);
      if (output === void 0) {
        throw new TypeError("Value cannot be represented as JSON");
      }
      return output;
    },
    catch: () => new InvalidValue({
      expected: "a JSON-serializable value"
    }, input, parseOptions)
  }));
}
function encodeBase64() {
  return transform(encode2);
}
function encodeBase64Url(options) {
  return transform(options?.padding ? encodePadded : encode3);
}
function encodeHex() {
  return transform(encode);
}
function decodeBase64() {
  return transformEffect((input, options) => mapErrorEager2(fromResult2(decode2(input)), () => new InvalidValue({
    expected: "a valid Base64 string"
  }, input, options)));
}
function decodeBase64String() {
  return transformEffect((input, options) => match2(decodeString2(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64 string"
    }, input, options)),
    onSuccess: succeed5
  }));
}
function decodeBase64Url() {
  return transformEffect((input, options) => match2(decode3(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64Url string"
    }, input, options)),
    onSuccess: succeed5
  }));
}
function decodeBase64UrlString() {
  return transformEffect((input, options) => match2(decodeString3(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid Base64Url string"
    }, input, options)),
    onSuccess: succeed5
  }));
}
function decodeHex() {
  return transformEffect((input, options) => match2(decode(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid hexadecimal string"
    }, input, options)),
    onSuccess: succeed5
  }));
}
function decodeHexString() {
  return transformEffect((input, options) => match2(decodeString(input), {
    onFailure: () => fail5(new InvalidValue({
      expected: "a valid hexadecimal string"
    }, input, options)),
    onSuccess: succeed5
  }));
}
function encodeUriComponent() {
  return transform(encodeURIComponent);
}
function decodeUriComponent() {
  return transformEffect((input, options) => {
    try {
      return succeed5(globalThis.decodeURIComponent(input));
    } catch {
      return fail5(new InvalidValue({
        expected: "a valid URI component"
      }, input, options));
    }
  });
}
function decodeFormData() {
  return transform((input) => makeTreeRecord(Array.from(input.entries())));
}
var collectFormDataEntries = /* @__PURE__ */ collectBracketPathEntries((value3) => typeof value3 === "string" || typeof Blob !== "undefined" && value3 instanceof Blob);
function encodeFormData() {
  return transform((input) => {
    const out = new FormData();
    if (typeof input === "object" && input !== null) {
      const entries3 = collectFormDataEntries(input);
      entries3.forEach(([key, value3]) => {
        out.append(key, value3);
      });
    }
    return out;
  });
}
function decodeURLSearchParams() {
  return transform((input) => makeTreeRecord(Array.from(input.entries())));
}
var collectURLSearchParamsEntries = /* @__PURE__ */ collectBracketPathEntries(isString);
function encodeURLSearchParams() {
  return transform((input) => {
    if (typeof input === "object" && input !== null) {
      return new URLSearchParams(collectURLSearchParamsEntries(input));
    }
    return new URLSearchParams();
  });
}
function bracketPathToTokens(bracketPath) {
  if (bracketPath === "") {
    return [""];
  }
  const replaced = bracketPath.replace(/\[(.*?)\]/g, ".$1");
  const parts2 = replaced.split(".");
  const start = replaced.startsWith(".") ? 1 : 0;
  return parts2.slice(start).map((part) => isCanonicalArrayIndex(part) ? globalThis.Number(part) : part);
}
var MAX_ARRAY_HOLES = 20;
function makeTreeRecord(bracketPathEntries) {
  const out = {};
  const containers = /* @__PURE__ */ new WeakSet();
  const duplicates = /* @__PURE__ */ new WeakSet();
  const indexed = /* @__PURE__ */ new Map();
  bracketPathEntries.forEach(([key, value3]) => {
    const tokens = bracketPathToTokens(key);
    let cur = out;
    for (let i = 0; i < tokens.length; i++) {
      const state = indexed.get(cur);
      const token = tokens[i] === "" && state !== void 0 ? state.length : tokens[i];
      if (state !== void 0 && typeof token === "number") {
        state.length = Math.max(state.length, token + 1);
      }
      const hasOwn = Object.hasOwn(cur, token);
      const current = hasOwn ? cur[token] : void 0;
      if (i === tokens.length - 1) {
        const currentState = indexed.get(current);
        if (currentState !== void 0) {
          assignProperty(current, currentState.length++, value3);
        } else if (duplicates.has(current)) {
          current.push(value3);
        } else if (hasOwn) {
          const values2 = [current, value3];
          duplicates.add(values2);
          assignProperty(cur, token, values2);
        } else {
          assignProperty(cur, token, value3);
        }
      } else {
        const next = tokens[i + 1];
        const shouldBeArray = typeof next === "number" || next === "";
        if (containers.has(current) && indexed.has(current) === shouldBeArray) {
          cur = current;
        } else {
          const container = {};
          containers.add(container);
          if (shouldBeArray) {
            indexed.set(container, {
              parent: cur,
              key: token,
              length: 0
            });
          }
          assignProperty(cur, token, container);
          cur = container;
        }
      }
    }
  });
  for (const [builder, {
    key,
    length,
    parent
  }] of Array.from(indexed).reverse()) {
    if (parent[key] === builder && length - Object.keys(builder).length <= MAX_ARRAY_HOLES) {
      assignProperty(parent, key, Object.assign(new Array(length), builder));
    }
  }
  return out;
}
function collectBracketPathEntries(isLeaf) {
  return (input) => {
    const bracketPathEntries = [];
    function append2(key, value3) {
      if (isLeaf(value3)) {
        bracketPathEntries.push([key, value3]);
      } else if (Array.isArray(value3)) {
        const allLeaves = value3.every(isLeaf);
        if (allLeaves) {
          value3.forEach((v) => {
            bracketPathEntries.push([key, v]);
          });
        } else {
          value3.forEach((v, i) => {
            append2(`${key}[${i}]`, v);
          });
        }
      } else if (typeof value3 === "object" && value3 !== null) {
        for (const [k, v] of Object.entries(value3)) {
          append2(`${key}[${k}]`, v);
        }
      }
    }
    for (const [key, value3] of Object.entries(input)) {
      append2(key, value3);
    }
    return bracketPathEntries;
  };
}

// node_modules/effect/dist/SchemaTransformation.js
var Middleware = class extends Class {
  _tag = "Middleware";
  decode;
  encode;
  constructor(decode5, encode5) {
    super();
    this.decode = decode5;
    this.encode = encode5;
  }
  flip() {
    return new Middleware(this.encode, this.decode);
  }
};
var TypeId22 = "~effect/SchemaTransformation/Transformation";
var Transformation = class extends Class {
  [TypeId22] = TypeId22;
  _tag = "Transformation";
  decode;
  encode;
  constructor(decode5, encode5) {
    super();
    this.decode = decode5;
    this.encode = encode5;
  }
  flip() {
    return new Transformation(this.encode, this.decode);
  }
};
function isTransformation(u) {
  return hasProperty(u, TypeId22) && u[TypeId22] === TypeId22;
}
var makeTransformation = (options) => {
  if (isTransformation(options)) {
    return options;
  }
  return new Transformation(options.decode, options.encode);
};
function transformEffect2(options) {
  return new Transformation(transformEffect(options.decode), transformEffect(options.encode));
}
function transform2(options) {
  return new Transformation(transform(options.decode), transform(options.encode));
}
function transformOptional2(options) {
  return new Transformation(transformOptional(options.decode), transformOptional(options.encode));
}
function trim3() {
  return new Transformation(trim2(), passthrough2());
}
var passthrough_2 = /* @__PURE__ */ new Transformation(/* @__PURE__ */ passthrough2(), /* @__PURE__ */ passthrough2());
function passthrough3() {
  return passthrough_2;
}
var numberFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number4(), /* @__PURE__ */ String4());
var bigintFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ BigInt4(), /* @__PURE__ */ String4());
var dateFromString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Date3(), /* @__PURE__ */ transform(formatDate));
var dateFromMillis = /* @__PURE__ */ new Transformation(/* @__PURE__ */ Date3(), /* @__PURE__ */ transform((date) => date.getTime()));
var byteSizeFromString = /* @__PURE__ */ transformEffect2({
  decode: (input, options) => match(fromString2(input), {
    onNone: () => fail5(new InvalidValue({
      expected: "a valid ByteSize string"
    }, input, options)),
    onSome: succeed5
  }),
  encode: (byteSize) => succeed5(`${byteSize} ${byteSize === BigInt(1) ? "byte" : "bytes"}`)
});
var byteSizeFromBigInt = /* @__PURE__ */ transformEffect2({
  decode: (input, options) => match(fromInput2(input), {
    onNone: () => fail5(new InvalidValue({
      expected: "a non-negative bigint byte count"
    }, input, options)),
    onSome: succeed5
  }),
  encode: (byteSize) => succeed5(toBigInt(byteSize))
});
var byteSizeFromNumber = /* @__PURE__ */ transformEffect2({
  decode: (input, options) => match(fromInput2(input), {
    onNone: () => fail5(new InvalidValue({
      expected: "a non-negative safe-integer byte count"
    }, input, options)),
    onSome: succeed5
  }),
  encode: (byteSize, options) => match(toNumber2(byteSize), {
    onNone: () => fail5(new InvalidValue({
      expected: "a ByteSize representable as a safe integer"
    }, byteSize, options)),
    onSome: succeed5
  })
});
var isJsonError = (input) => isObject(input) && typeof input["message"] === "string";
var decodeJsonError = (input) => {
  const hasCause = Object.hasOwn(input, "cause");
  const err = hasCause ? new Error(input.message, {
    cause: decodeDefect(input.cause)
  }) : new Error(input.message);
  if (typeof input.name === "string" && input.name !== "Error") err.name = input.name;
  if (typeof input.stack === "string") err.stack = input.stack;
  return err;
};
var encodeUnknownAsJson = (input) => {
  try {
    const json = formatJson(input);
    return json === void 0 ? format(input) : JSON.parse(json);
  } catch {
    return format(input);
  }
};
var encodeJsonError = (input, options, encodeDefect) => {
  const encoded = {
    name: input.name,
    message: typeof input.message === "string" ? input.message : ""
  };
  if (options?.includeStack && typeof input.stack === "string") {
    encoded.stack = input.stack;
  }
  if (!options?.excludeCause && input.cause !== void 0) {
    encoded.cause = encodeDefect(input.cause);
  }
  return encoded;
};
var makeEncodeDefect = (options) => {
  const seen = /* @__PURE__ */ new WeakSet();
  const encode5 = (input) => {
    if (isError(input)) {
      if (seen.has(input)) {
        return "[Circular]";
      }
      seen.add(input);
      const encoded = encodeJsonError(input, options, encode5);
      seen.delete(input);
      return encoded;
    }
    return encodeUnknownAsJson(input);
  };
  return encode5;
};
var decodeDefect = (input) => isJsonError(input) ? decodeJsonError(input) : input;
var errorFromJsonError = (options) => transform2({
  decode: decodeJsonError,
  encode: (input) => makeEncodeDefect(options)(input)
});
var defectFromJson = (options) => transform2({
  decode: decodeDefect,
  encode: makeEncodeDefect(options)
});
function optionFromNullOr() {
  return transform2({
    decode: fromNullOr,
    encode: getOrNull
  });
}
function optionFromUndefinedOr() {
  return transform2({
    decode: fromUndefinedOr,
    encode: getOrUndefined
  });
}
function optionFromNullishOr(options) {
  return transform2({
    decode: fromNullishOr,
    encode: options?.onNoneEncoding === null ? getOrNull : getOrUndefined
  });
}
function optionFromOptionalKey() {
  return transformOptional2({
    decode: some2,
    encode: flatten
  });
}
function optionFromOptional() {
  return transformOptional2({
    decode: (ot) => ot.pipe(filter(isNotUndefined), some2),
    encode: flatten
  });
}
var urlFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => URL.canParse(s) ? succeed5(new URL(s)) : fail5(new InvalidValue({
    expected: "a valid URL string"
  }, s, options)),
  encode: (url) => succeed5(url.href)
});
var uint8ArrayFromBase64String = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase64(), /* @__PURE__ */ encodeBase64());
var stringFromBase64String = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase64String(), /* @__PURE__ */ encodeBase64());
var stringFromBase64UrlString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeBase64UrlString(), /* @__PURE__ */ encodeBase64Url());
var stringFromHexString = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeHexString(), /* @__PURE__ */ encodeHex());
var stringFromUriComponent = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeUriComponent(), /* @__PURE__ */ encodeUriComponent());
function fromJsonString(options) {
  return new Transformation(parseJson(options ?? {}), stringifyJson(options));
}
var fromFormData = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeFormData(), /* @__PURE__ */ encodeFormData());
var fromURLSearchParams = /* @__PURE__ */ new Transformation(/* @__PURE__ */ decodeURLSearchParams(), /* @__PURE__ */ encodeURLSearchParams());

// node_modules/effect/dist/SchemaAST.js
function makeGuard(tag2) {
  return (ast) => ast._tag === tag2;
}
var isDeclaration = /* @__PURE__ */ makeGuard("Declaration");
var isNever2 = /* @__PURE__ */ makeGuard("Never");
var isLiteral = /* @__PURE__ */ makeGuard("Literal");
var isUniqueSymbol = /* @__PURE__ */ makeGuard("UniqueSymbol");
var isArrays = /* @__PURE__ */ makeGuard("Arrays");
var isObjects = /* @__PURE__ */ makeGuard("Objects");
var isUnion = /* @__PURE__ */ makeGuard("Union");
var isSuspend = /* @__PURE__ */ makeGuard("Suspend");
var Link = class {
  to;
  transformation;
  constructor(to, transformation) {
    this.to = to;
    this.transformation = transformation;
  }
};
var defaultParseOptions = {};
var Context = class {
  isOptional;
  isMutable;
  /** Used for constructor default values (e.g. `withConstructorDefault` API) */
  constructorDefault;
  annotations;
  constructor(isOptional2, isMutable2, constructorDefault = void 0, annotations = void 0) {
    this.isOptional = isOptional2;
    this.isMutable = isMutable2;
    this.constructorDefault = constructorDefault;
    this.annotations = annotations;
  }
};
var TypeId23 = "~effect/Schema";
var ASTNodeImpl = class {
  [TypeId23] = TypeId23;
  annotations;
  checks;
  encoding;
  context;
  constructor(annotations = void 0, checks = void 0, encoding = void 0, context3 = void 0) {
    this.annotations = annotations;
    this.checks = checks;
    this.encoding = encoding;
    this.context = context3;
  }
  toString() {
    return `<${this._tag}>`;
  }
};
var Declaration = class extends ASTNodeImpl {
  _tag = "Declaration";
  typeParameters;
  run;
  encodingChecks;
  /**
   * Parser factory {@link flip} swaps in, so a declaration can behave
   * differently when encoding. `undefined` reuses `run`.
   */
  encodingRun;
  constructor(typeParameters, run2, annotations, checks, encoding, context3, encodingChecks, encodingRun) {
    super(annotations, checks, encoding, context3);
    this.typeParameters = typeParameters;
    this.run = run2;
    this.encodingChecks = encodingChecks;
    this.encodingRun = encodingRun;
  }
  /** @internal */
  getParser() {
    let run2;
    return (input, options) => {
      if (input === missing) return missingExit;
      run2 ??= this.run(this.typeParameters);
      try {
        return run2(input, this, options);
      } catch (error) {
        return die3(error);
      }
    };
  }
  _rebuild(recur2, checks, encodingChecks, run2, encodingRun) {
    const tps = mapOrSame(this.typeParameters, recur2);
    return tps === this.typeParameters && checks === this.checks && encodingChecks === this.encodingChecks && run2 === this.run && encodingRun === this.encodingRun ? this : new Declaration(tps, run2, this.annotations, checks, void 0, this.context, encodingChecks, encodingRun);
  }
  /** @internal */
  recur(recur2) {
    return this._rebuild(recur2, this.checks, this.encodingChecks, this.run, this.encodingRun);
  }
  /** @internal */
  flip(recur2) {
    return this._rebuild(recur2, this.encodingChecks, this.checks, this.encodingRun ?? this.run, this.run);
  }
  /** @internal */
  getExpected() {
    const expected = this.annotations?.expected;
    if (typeof expected === "string") return expected;
    return "<Declaration>";
  }
};
var Null = class extends ASTNodeImpl {
  _tag = "Null";
  /** @internal */
  getParser() {
    return fromConst(this, null);
  }
  /** @internal */
  getExpected() {
    return "null";
  }
};
var null_ = /* @__PURE__ */ new Null();
var Undefined = class extends ASTNodeImpl {
  _tag = "Undefined";
  /** @internal */
  getParser() {
    return fromConst(this, void 0);
  }
  /** @internal */
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  /** @internal */
  getExpected() {
    return "undefined";
  }
};
var undefinedToNull = /* @__PURE__ */ new Link(null_, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform(() => void 0), /* @__PURE__ */ transform(() => null)));
var undefined_3 = /* @__PURE__ */ new Undefined();
var Void = class extends ASTNodeImpl {
  _tag = "Void";
  /** @internal */
  getParser() {
    const succeed7 = succeed6(void 0);
    return (input) => input === missing ? missingExit : succeed7;
  }
  /** @internal */
  toCodecJson() {
    return replaceEncoding(this, [undefinedToNull]);
  }
  /** @internal */
  getExpected() {
    return "void";
  }
};
var void_5 = /* @__PURE__ */ new Void();
var Never = class extends ASTNodeImpl {
  _tag = "Never";
  /** @internal */
  getParser() {
    return fromRefinement(this, isNever);
  }
  /** @internal */
  getExpected() {
    return "never";
  }
};
var never3 = /* @__PURE__ */ new Never();
var Any = class extends ASTNodeImpl {
  _tag = "Any";
  /** @internal */
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  /** @internal */
  getExpected() {
    return "any";
  }
};
var any = /* @__PURE__ */ new Any();
var Unknown = class extends ASTNodeImpl {
  _tag = "Unknown";
  /** @internal */
  getParser() {
    return fromRefinement(this, isUnknown);
  }
  /** @internal */
  getExpected() {
    return "unknown";
  }
};
var unknown = /* @__PURE__ */ new Unknown();
var ObjectKeyword = class extends ASTNodeImpl {
  _tag = "ObjectKeyword";
  /** @internal */
  getParser() {
    return fromRefinement(this, isObjectKeyword);
  }
  /** @internal */
  getExpected() {
    return "object | array | function";
  }
};
var objectKeyword = /* @__PURE__ */ new ObjectKeyword();
var Enum = class extends ASTNodeImpl {
  _tag = "Enum";
  enums;
  constructor(enums, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    for (const [, value3] of enums) {
      if (typeof value3 === "number" && !globalThis.Number.isFinite(value3)) {
        throw new Error(`A numeric enum value must be finite, got ${format(value3)}`);
      }
    }
    this.enums = enums;
  }
  /** @internal */
  getParser() {
    const values2 = new Set(this.enums.map(([, v]) => v));
    return fromRefinement(this, (input) => values2.has(input));
  }
  /** @internal */
  toCodecStringTree() {
    if (this.enums.some(([_, v]) => typeof v === "number")) {
      const coercions = Object.fromEntries(this.enums.map(([_, v]) => [globalThis.String(v), v]));
      return replaceEncoding(this, [new Link(new Union(Object.keys(coercions).map((k) => new Literal(k))), new Transformation(transform((s) => coercions[s]), String4()))]);
    }
    return this;
  }
  /** @internal */
  getExpected() {
    return this.enums.map(([_, value3]) => JSON.stringify(value3)).join(" | ");
  }
};
function formatTemplateLiteralPath(path) {
  return typeof path === "number" ? `parts[${path}]` : path;
}
function isTemplateLiteralPart(ast, path, validated) {
  if (validated.has(ast)) return true;
  if (ast.encoding) {
    throw new Error(`TemplateLiteral parts cannot have an encoding at ${formatTemplateLiteralPath(path)}`);
  }
  let valid;
  switch (ast._tag) {
    case "String":
    case "Number":
    case "BigInt":
      valid = true;
      break;
    case "Literal":
      valid = !ast.checks;
      break;
    case "TemplateLiteral": {
      const currentPath = formatTemplateLiteralPath(path);
      valid = !ast.checks && ast.parts.every((part, index2) => isTemplateLiteralPart(part, `${currentPath}.parts[${index2}]`, validated));
      break;
    }
    case "Union": {
      const currentPath = formatTemplateLiteralPath(path);
      valid = !ast.checks && ast.types.every((part, index2) => isTemplateLiteralPart(part, `${currentPath}.types[${index2}]`, validated));
      break;
    }
    default:
      return false;
  }
  if (valid) validated.add(ast);
  return valid;
}
var TemplateLiteral = class extends ASTNodeImpl {
  _tag = "TemplateLiteral";
  parts;
  /** @internal */
  encodedParts;
  /** @internal */
  literals;
  /** @internal */
  suffixLengths;
  constructor(parts2, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    const encodedParts = [];
    const literals = [];
    const validated = /* @__PURE__ */ new Set();
    for (let index2 = 0; index2 < parts2.length; index2++) {
      const part = parts2[index2];
      if (!isTemplateLiteralPart(part, index2, validated)) {
        throw new Error(`Invalid TemplateLiteral part ${part._tag}`);
      }
      encodedParts.push(part);
      literals.push(part._tag === "Literal" ? globalThis.String(part.literal) : void 0);
    }
    const suffixLengths = new Array(encodedParts.length + 1);
    suffixLengths[encodedParts.length] = 0;
    for (let i = encodedParts.length - 1; i >= 0; i--) {
      suffixLengths[i] = suffixLengths[i + 1] + (literals[i]?.length ?? 0);
    }
    this.parts = parts2;
    this.encodedParts = encodedParts;
    this.literals = literals;
    this.suffixLengths = suffixLengths;
  }
  /** @internal */
  getParser(compile2) {
    const tuple2 = new Arrays(false, this.parts.map(partFromString), []);
    const parser = compile2(decodeTo(string2, tuple2, templateLiteralTransformation(this)));
    return (input, options) => {
      if (input === missing) return missingExit;
      const result3 = parser(input, options);
      if (result3._tag === "Success") {
        return sameExit;
      }
      return mapBothEager2(result3, {
        onSuccess: () => input,
        onFailure: (issue) => new Composite(this, [issue], input, options)
      });
    };
  }
  /** @internal */
  getExpected() {
    return "string";
  }
  /** @internal */
  matchPart(s, options) {
    return segmentTemplateLiteralParts(this, s, options) === void 0 ? void 0 : s;
  }
};
function templateLiteralParser(parts2) {
  const normalize2 = memoize((encoded) => {
    if (encoded._tag !== "Union") return encoded;
    const types = mapOrSame(encoded.types, normalize2);
    return (encoded.options?.mode ?? "anyOf") === "anyOf" && types === encoded.types ? encoded : new Union(types, encoded.options === void 0 ? void 0 : {
      ...encoded.options,
      mode: "anyOf"
    }, encoded.annotations, encoded.checks, void 0, encoded.context);
  });
  const template = new TemplateLiteral(parts2.map((part) => normalize2(toEncoded(part))));
  const tuple2 = new Arrays(false, parts2.map(partFromString), []);
  return decodeTo(template, tuple2, templateLiteralTransformation(template));
}
function templateLiteralTransformation(template) {
  return new Transformation(transformEffect((s, options) => {
    const segments = segmentTemplateLiteralParts(template, s, options);
    if (segments) return succeed5(segments);
    return fail5(new InvalidValue({
      expected: "a string matching template literal parts"
    }, s, options));
  }), transform((parts2) => parts2.join("")));
}
var UniqueSymbol = class extends ASTNodeImpl {
  _tag = "UniqueSymbol";
  symbol;
  constructor(symbol4, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    this.symbol = symbol4;
  }
  /** @internal */
  getParser() {
    return fromConst(this, this.symbol);
  }
  /** @internal */
  toCodecStringTree() {
    const key = globalThis.Symbol.keyFor(this.symbol);
    return replaceEncoding(this, [new Link(key === void 0 ? never3 : new Literal(globalThis.String(this.symbol)), symbolToString.transformation)]);
  }
  /** @internal */
  getExpected() {
    return globalThis.String(this.symbol);
  }
};
var Literal = class extends ASTNodeImpl {
  _tag = "Literal";
  literal;
  constructor(literal, annotations, checks, encoding, context3) {
    super(annotations, checks, encoding, context3);
    if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) {
      throw new Error(`A numeric literal must be finite, got ${format(literal)}`);
    }
    this.literal = literal;
  }
  /** @internal */
  getParser() {
    return fromConst(this, this.literal);
  }
  /** @internal */
  matchPart(s, _options) {
    return s === globalThis.String(this.literal) ? this.literal : void 0;
  }
  /** @internal */
  toCodecJson() {
    return typeof this.literal === "bigint" ? literalToString(this) : this;
  }
  /** @internal */
  toCodecStringTree() {
    return typeof this.literal === "string" ? this : literalToString(this);
  }
  /** @internal */
  getExpected() {
    return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal);
  }
};
function literalToString(ast) {
  const literalAsString = globalThis.String(ast.literal);
  return replaceEncoding(ast, [new Link(new Literal(literalAsString), new Transformation(transform(() => ast.literal), transform(() => literalAsString)))]);
}
var String5 = class extends ASTNodeImpl {
  _tag = "String";
  /** @internal */
  getParser() {
    return fromRefinement(this, isString);
  }
  /** @internal */
  matchPart(s, options) {
    const checks = this.checks;
    return checks && !options.disableChecks && collectIssues(checks, s, void 0, this, options) ? void 0 : s;
  }
  /** @internal */
  getExpected() {
    return "string";
  }
};
var string2 = /* @__PURE__ */ new String5();
var Number5 = class extends ASTNodeImpl {
  _tag = "Number";
  /** @internal */
  getParser() {
    return fromRefinement(this, isNumber);
  }
  /** @internal */
  matchKey(s, options) {
    return this._match(isStringNumberRegExp, s, options);
  }
  /** @internal */
  matchPart(s, options) {
    return this._match(isStringFiniteRegExp, s, options);
  }
  _match(regexp, s, options) {
    if (!regexp.test(s)) return void 0;
    const value3 = globalThis.Number(s);
    if (options.disableChecks || !this.checks) return value3;
    return collectIssues(this.checks, value3, void 0, this, options) ? void 0 : value3;
  }
  /** @internal */
  toCodecJson() {
    if (this.checks && (hasCheck(this.checks, "effect/schema/isFinite") || hasCheck(this.checks, "effect/schema/isInt"))) {
      return this;
    }
    return replaceEncoding(this, [numberToJson]);
  }
  /** @internal */
  toCodecStringTree() {
    if (this.toCodecJson() === this) {
      return replaceEncoding(this, [finiteToString]);
    }
    return replaceEncoding(this, [numberToString]);
  }
  /** @internal */
  getExpected() {
    return "number";
  }
};
function hasCheck(checks, id2) {
  return checks.some((check2) => check2.annotations?.representation?.id === id2 || check2._tag === "FilterGroup" && hasCheck(check2.checks, id2));
}
var number2 = /* @__PURE__ */ new Number5();
var Boolean2 = class extends ASTNodeImpl {
  _tag = "Boolean";
  /** @internal */
  getParser() {
    return fromRefinement(this, isBoolean);
  }
  /** @internal */
  getExpected() {
    return "boolean";
  }
};
var boolean = /* @__PURE__ */ new Boolean2();
var Symbol2 = class extends ASTNodeImpl {
  _tag = "Symbol";
  /** @internal */
  getParser() {
    return fromRefinement(this, isSymbol);
  }
  /** @internal */
  matchKey(s, options) {
    if (options.disableChecks || !this.checks) return s;
    return collectIssues(this.checks, s, void 0, this, options) ? void 0 : s;
  }
  /** @internal */
  toCodecStringTree() {
    return replaceEncoding(this, [symbolToString]);
  }
  /** @internal */
  getExpected() {
    return "symbol";
  }
};
var symbol3 = /* @__PURE__ */ new Symbol2();
var BigInt5 = class extends ASTNodeImpl {
  _tag = "BigInt";
  /** @internal */
  getParser() {
    return fromRefinement(this, isBigInt);
  }
  /** @internal */
  matchPart(s, options) {
    if (!isStringBigIntRegExp.test(s)) return void 0;
    const value3 = globalThis.BigInt(s);
    if (options.disableChecks || !this.checks) return value3;
    return collectIssues(this.checks, value3, void 0, this, options) ? void 0 : value3;
  }
  /** @internal */
  toCodecStringTree() {
    return replaceEncoding(this, [bigIntToString]);
  }
  /** @internal */
  getExpected() {
    return "bigint";
  }
};
var bigInt = /* @__PURE__ */ new BigInt5();
var Arrays = class extends ASTNodeImpl {
  _tag = "Arrays";
  isMutable;
  elements;
  rest;
  encodingChecks;
  constructor(isMutable2, elements, rest, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.isMutable = isMutable2;
    this.elements = elements;
    this.rest = rest;
    this.encodingChecks = encodingChecks;
    let hasOptional = false;
    for (let i = 0; i < elements.length; i++) {
      if (isOptional(elements[i])) {
        hasOptional = true;
      } else if (hasOptional) {
        throw new Error("A required element cannot follow an optional element. ts(1257)");
      }
    }
    if (hasOptional && rest.length > 1) {
      throw new Error("A required element cannot follow an optional element. ts(1257)");
    }
    for (let i = 1; i < rest.length; i++) {
      if (isOptional(rest[i])) {
        throw new Error("An optional element cannot follow a rest element. ts(1266)");
      }
    }
  }
  /** @internal */
  getParser(compile2, compileField2 = compile2) {
    const ast = this;
    let elements;
    let rest;
    const elementLen = ast.elements.length;
    const tailLen = Math.max(0, ast.rest.length - 1);
    function getParser(tailThreshold, index2) {
      if (index2 < elementLen) {
        return elements[index2];
      } else if (index2 >= tailThreshold) {
        return rest[index2 - tailThreshold + 1];
      }
      return rest[0];
    }
    const finish = (state) => {
      const {
        input,
        len,
        options
      } = state;
      if (ast.rest.length === 0 && len > elementLen) {
        for (let i = elementLen; i < len; i++) {
          const unexpected = new UnexpectedKey(ast, input[i], options);
          const issue = new Pointer([i], unexpected);
          if (options.errors === "all") {
            if (state.issues) state.issues.push(issue);
            else state.issues = [issue];
          } else {
            return fail5(new Composite(ast, [issue], input, options));
          }
        }
      }
      if (state.issues) {
        return fail5(new Composite(ast, state.issues, input, options));
      }
      return succeed6(state.output);
    };
    const parse3 = (input, options) => {
      const len = input.length;
      const state = {
        ast,
        getParser,
        input,
        len,
        tailThreshold: Math.max(elementLen, len - tailLen),
        output: [],
        issues: void 0,
        options
      };
      const end = ast.rest.length === 0 ? elementLen : Math.max(len, elementLen + tailLen);
      const concurrency = options.concurrency === void 0 ? 1 : resolveConcurrency(options.concurrency);
      const eff = concurrency === 1 ? parseArray(state, input, 0, end) : parseArrayConcurrent(state, input, {
        concurrency,
        end
      });
      if (!eff) return finish(state);
      if (effectIsExit(eff)) return flatMapEager2(eff, () => finish(state));
      let first = true;
      return suspend2(() => {
        if (!first) return parse3(input, options);
        first = false;
        return flatMap4(eff, () => finish(state));
      });
    };
    return (input, options) => {
      if (input === missing) return missingExit;
      try {
        if (!Array.isArray(input)) {
          return fail5(new InvalidType(ast, input, options));
        }
        if (!elements) {
          elements = ast.elements.map((ast2) => ({
            ast: ast2,
            parser: compileField2(ast2)
          }));
          rest = ast.rest.map((ast2) => ({
            ast: ast2,
            parser: compileField2(ast2)
          }));
        }
        return parse3(input, options);
      } catch (error) {
        return die3(error);
      }
    };
  }
  _rebuild(recur2, checks, encodingChecks) {
    const elements = mapOrSame(this.elements, recur2);
    const rest = mapOrSame(this.rest, recur2);
    return elements === this.elements && rest === this.rest && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Arrays(this.isMutable, elements, rest, this.annotations, checks, void 0, this.context, encodingChecks);
  }
  /** @internal */
  recur(recur2) {
    return this._rebuild(recur2, this.checks, this.encodingChecks);
  }
  /** @internal */
  flip(recur2) {
    return this._rebuild(recur2, this.encodingChecks, this.checks);
  }
  /** @internal */
  getExpected() {
    return "array";
  }
};
function stepArray(s, item, exit3, i) {
  if (exit3._tag === "Failure") {
    return wrapPropertyKeyIssue(s, s.ast, i, exit3);
  }
  const value3 = exit3 === sameExit ? item : exit3[args];
  if (value3 !== missing) {
    s.output[i] = value3;
  } else {
    const p = s.getParser(s.tailThreshold, i);
    if (isOptional(p.ast)) return;
    const issue = new Pointer([i], new MissingKey(p.ast.context?.annotations));
    if (s.options.errors === "all") {
      if (s.issues) s.issues.push(issue);
      else s.issues = [issue];
    } else {
      return fail4(new Composite(s.ast, [issue], s.input, s.options));
    }
  }
}
var parseArrayOptions = {
  onItem(s, item, i) {
    const value3 = i < s.len ? item : missing;
    return s.getParser(s.tailThreshold, i).parser(value3, s.options);
  },
  step: stepArray
};
var parseArray = /* @__PURE__ */ iterateEager()(parseArrayOptions);
var parseArrayConcurrent = /* @__PURE__ */ iterateConcurrent()(parseArrayOptions);
var wrapPropertyKeyIssue = (s, ast, key, exit3) => {
  if (exit3.cause.reasons.length === 0) {
    return exit3;
  }
  const issue = getSchemaIssue(exit3.cause);
  if (issue === void 0) {
    return failCause2(map6(exit3.cause, (issue2) => new Composite(ast, [new Pointer([key], issue2)], s.input, s.options)));
  }
  const pointer = new Pointer([key], issue);
  if (s.options.errors === "all") {
    if (s.issues) s.issues.push(pointer);
    else s.issues = [pointer];
  } else {
    return fail4(new Composite(ast, [pointer], s.input, s.options));
  }
};
var FINITE_PATTERN = "[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[Ee][+-]?\\d+)?";
function getIndexSignatureKeys(input, parameter, options = defaultParseOptions) {
  let stringKeys;
  let symbolKeys;
  function go(parameter2) {
    switch (parameter2._tag) {
      case "String":
      case "TemplateLiteral":
        return (stringKeys ??= Object.keys(input)).filter((k) => parameter2.matchPart(k, options) !== void 0);
      case "Number":
        return (stringKeys ??= Object.keys(input)).filter((k) => parameter2.matchKey(k, options) !== void 0);
      case "Symbol":
        return (symbolKeys ??= Object.getOwnPropertySymbols(input)).filter((k) => Object.prototype.propertyIsEnumerable.call(input, k) && parameter2.matchKey(k, options) !== void 0);
      case "Union":
        return [...new Set(parameter2.types.flatMap(go))];
      default:
        return [];
    }
  }
  return go(parameterFromPropertyKey(toEncoded(parameter)));
}
var PropertySignature = class {
  name;
  type;
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }
};
function isIndexSignatureParameterSide(ast) {
  switch (ast._tag) {
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return true;
    case "Union":
      return ast.types.every(isIndexSignatureParameterSide);
    default:
      return false;
  }
}
function isIndexSignatureParameterEncodedSide(ast) {
  const encoded = getLastEncoding(ast);
  switch (encoded._tag) {
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return true;
    case "Union":
      return encoded.types.every(isIndexSignatureParameterEncodedSide);
    default:
      return false;
  }
}
function isIndexSignatureParameter(ast) {
  return isIndexSignatureParameterSide(ast) && isIndexSignatureParameterEncodedSide(ast);
}
var IndexSignature = class {
  parameter;
  type;
  constructor(parameter, type) {
    if (!isIndexSignatureParameter(parameter)) {
      throw new Error(`Invalid index signature parameter ${parameter._tag}`);
    }
    this.parameter = parameter;
    this.type = type;
    if (isOptional(type) && !containsUndefined(type)) {
      throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.");
    }
  }
};
var Objects = class extends ASTNodeImpl {
  _tag = "Objects";
  propertySignatures;
  indexSignatures;
  encodingChecks;
  constructor(propertySignatures, indexSignatures, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.propertySignatures = propertySignatures;
    this.indexSignatures = indexSignatures;
    this.encodingChecks = encodingChecks;
  }
  /** @internal */
  getParser(compile2, compileField2 = compile2) {
    const ast = this;
    const hasProperties = ast.propertySignatures.length;
    const indexCount = ast.indexSignatures.length;
    if (!hasProperties && !indexCount) {
      return fromRefinement(ast, isNotNullish);
    }
    let properties;
    let indexes;
    const compileMembers = () => {
      if (!properties) {
        properties = ast.propertySignatures.map((ps) => ({
          parser: compileField2(ps.type),
          name: ps.name,
          type: ps.type
        }));
        indexes = indexCount ? ast.indexSignatures.map((is3) => ({
          is: is3,
          parserKey: compile2(parameterFromPropertyKey(is3.parameter)),
          parserValue: compileField2(is3.type)
        })) : void 0;
      }
      return properties;
    };
    const makeFallback = () => {
      const expectedKeys = new Set(ast.propertySignatures.map((ps) => typeof ps.name === "number" ? globalThis.String(ps.name) : ps.name));
      const finishIndex = (s, key, k2, inputValue, exitValue) => {
        if (exitValue._tag === "Failure") {
          return wrapPropertyKeyIssue(s, ast, key, exitValue) ?? void_3;
        }
        const value3 = exitValue === sameExit ? inputValue : exitValue[args];
        if (k2 !== missing && value3 !== missing) {
          if (hasProperties && (expectedKeys.has(key) || expectedKeys.has(typeof k2 === "number" ? globalThis.String(k2) : k2))) return void_3;
          assignProperty(s.out, k2, value3);
        }
        return void_3;
      };
      const parseIndex = (s, key, index2, exitKey) => {
        if (!exitKey) {
          const eff = index2.parserKey(key, s.options);
          if (!effectIsExit(eff)) {
            return flatMap4(exit2(eff), (exit3) => parseIndex(s, key, index2, exit3));
          }
          exitKey = eff;
        }
        if (exitKey._tag === "Failure") {
          return wrapPropertyKeyIssue(s, ast, key, exitKey) ?? void_3;
        }
        const k2 = exitKey === sameExit ? key : exitKey[args];
        const inputValue = s.input[key];
        const result3 = index2.parserValue(inputValue, s.options);
        return effectIsExit(result3) ? finishIndex(s, key, k2, inputValue, result3) : flatMap4(exit2(result3), (exit3) => finishIndex(s, key, k2, inputValue, exit3));
      };
      const parseStringIndex = (s, key, index2) => {
        const inputValue = s.input[key];
        const result3 = index2.parserValue(inputValue, s.options);
        return effectIsExit(result3) ? finishIndex(s, key, key, inputValue, result3) : flatMap4(exit2(result3), (exit3) => finishIndex(s, key, key, inputValue, exit3));
      };
      const parseIndexes = indexCount ? iterateConcurrent()({
        onItem: (s, [key, index2]) => index2.is.parameter === string2 ? parseStringIndex(s, key, index2) : parseIndex(s, key, index2),
        step: (_s, _item, exit3) => exit3._tag === "Failure" ? exit3 : void 0
      }) : void 0;
      return fnUntracedEager2(function* (input, options) {
        if (input === missing) {
          return missing;
        }
        if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
          return yield* fail5(new InvalidType(ast, input, options));
        }
        compileMembers();
        const record2 = input;
        const out = {};
        const state = {
          ast,
          input: record2,
          out,
          issues: void 0,
          options
        };
        const errorsAllOption = options.errors === "all";
        const onExcessPropertyError = options.onExcessProperty === "error";
        const concurrency = options.concurrency === void 0 ? 1 : resolveConcurrency(options.concurrency);
        const indexKeys = indexCount && onExcessPropertyError ? ast.indexSignatures.map((index2) => getIndexSignatureKeys(record2, index2.parameter, options)) : void 0;
        if (onExcessPropertyError) {
          const coveredKeys = indexKeys ? new Set(expectedKeys) : expectedKeys;
          if (indexKeys) {
            for (const keys3 of indexKeys) {
              for (const key of keys3) coveredKeys.add(key);
            }
          }
          const inputKeys = Reflect.ownKeys(record2);
          for (let i = 0; i < inputKeys.length; i++) {
            const key = inputKeys[i];
            if (!coveredKeys.has(key) && Object.prototype.propertyIsEnumerable.call(record2, key)) {
              const unexpected = new UnexpectedKey(ast, record2[key], options);
              const issue = new Pointer([key], unexpected);
              if (errorsAllOption) {
                if (state.issues) {
                  state.issues.push(issue);
                } else {
                  state.issues = [issue];
                }
                continue;
              } else {
                return yield* fail5(new Composite(ast, [issue], input, options));
              }
            }
          }
        }
        if (hasProperties) {
          const eff = concurrency === 1 ? parseProperties(state, properties) : parsePropertiesConcurrent(state, properties, {
            concurrency
          });
          if (eff) yield* eff;
        }
        if (indexCount && concurrency === 1) {
          for (let i = 0; i < indexCount; i++) {
            const index2 = indexes[i];
            const parse3 = index2.is.parameter === string2 ? parseStringIndex : parseIndex;
            const keys3 = indexKeys?.[i] ?? (index2.is.parameter === string2 ? Object.keys(record2) : getIndexSignatureKeys(record2, index2.is.parameter, options));
            for (let j = 0; j < keys3.length; j++) {
              const eff = parse3(state, keys3[j], index2);
              if (!effectIsExit(eff)) yield* eff;
              else if (eff._tag === "Failure") return yield* eff;
            }
          }
        } else if (parseIndexes) {
          const keyPairs = empty2();
          for (let i = 0; i < indexCount; i++) {
            const index2 = indexes[i];
            const keys3 = indexKeys?.[i] ?? (index2.is.parameter === string2 ? Object.keys(record2) : getIndexSignatureKeys(record2, index2.is.parameter, options));
            for (let j = 0; j < keys3.length; j++) {
              keyPairs.push([keys3[j], index2]);
            }
          }
          const eff = parseIndexes(state, keyPairs, {
            concurrency
          });
          if (eff) yield* eff;
        }
        if (state.issues) {
          return yield* fail5(new Composite(ast, state.issues, input, options));
        }
        return out;
      });
    };
    if (indexCount) return makeFallback();
    let fallback;
    const resume = (snapshot2, index2, pending) => {
      const property = properties[index2];
      return flatMap4(exit2(pending), (exit3) => {
        const state = {
          ...snapshot2,
          out: {
            ...snapshot2.out
          }
        };
        const terminal = stepProperty(state, property, exit3);
        if (terminal) return terminal;
        const done3 = () => succeed6(state.out);
        const eff = parseProperties(state, properties.slice(index2 + 1));
        return eff ? flatMapEager2(eff, done3) : done3();
      });
    };
    return (input, options) => {
      if (input === missing) return missingExit;
      if (options.errors === "all" || options.onExcessProperty !== void 0 || options.concurrency !== void 0 && resolveConcurrency(options.concurrency) !== 1) {
        return (fallback ??= makeFallback())(input, options);
      }
      if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
        return fail5(new InvalidType(ast, input, options));
      }
      const props = compileMembers();
      const record2 = input;
      const out = {};
      const state = {
        ast,
        input: record2,
        out,
        issues: void 0,
        options
      };
      try {
        for (let index2 = 0; index2 < props.length; index2++) {
          const property = props[index2];
          const name = property.name;
          const hasKey = hasPropertySignature(record2, name);
          const value3 = hasKey ? record2[name] : missing;
          const exit3 = property.parser(value3, options);
          if (!effectIsExit(exit3)) {
            return resume(state, index2, exit3);
          }
          if (exit3 === sameExit) {
            if (hasKey) assignProperty(out, name, value3);
            continue;
          }
          const terminal = stepProperty(state, property, exit3);
          if (terminal) return terminal;
        }
      } catch (error) {
        return die3(error);
      }
      return succeed6(out);
    };
  }
  _rebuild(recur2, recurParameter, checks, encodingChecks) {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = recur2(ps.type);
      return t === ps.type ? ps : new PropertySignature(ps.name, t);
    });
    const indexes = mapOrSame(this.indexSignatures, (is3) => {
      const p = recurParameter(is3.parameter);
      const t = recur2(is3.type);
      return p === is3.parameter && t === is3.type ? is3 : new IndexSignature(p, t);
    });
    return props === this.propertySignatures && indexes === this.indexSignatures && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Objects(props, indexes, this.annotations, checks, void 0, this.context, encodingChecks);
  }
  /** @internal */
  flip(recur2) {
    return this._rebuild(recur2, recur2, this.encodingChecks, this.checks);
  }
  /** @internal */
  recur(recur2, recurParameter = recur2) {
    return this._rebuild(recur2, recurParameter, this.checks, this.encodingChecks);
  }
  /** @internal */
  getExpected() {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0) return "object | array";
    return "object";
  }
};
function stepProperty(s, p, exit3) {
  if (exit3._tag === "Failure") {
    return wrapPropertyKeyIssue(s, s.ast, p.name, exit3);
  }
  if (exit3 === sameExit) return;
  const value3 = exit3[args];
  if (value3 !== missing) {
    assignProperty(s.out, p.name, value3);
    return;
  }
  delete s.out[p.name];
  if (!isOptional(p.type)) {
    const issue = new Pointer([p.name], new MissingKey(p.type.context?.annotations));
    if (s.options.errors === "all") {
      if (s.issues) s.issues.push(issue);
      else s.issues = [issue];
      return;
    } else {
      return fail4(new Composite(s.ast, [issue], s.input, s.options));
    }
  }
}
var parsePropertiesOptions = {
  onItem(s, p) {
    if (!hasPropertySignature(s.input, p.name)) {
      return p.parser(missing, s.options);
    }
    const value3 = s.input[p.name];
    assignProperty(s.out, p.name, value3);
    return p.parser(value3, s.options);
  },
  step: stepProperty
};
var parseProperties = /* @__PURE__ */ iterateEager()(parsePropertiesOptions);
var parsePropertiesConcurrent = /* @__PURE__ */ iterateConcurrent()(parsePropertiesOptions);
function combineChecks(a, b) {
  if (!a) return b;
  if (!b) return a;
  return [...a, ...b];
}
function struct(fields, checks, annotations) {
  return new Objects(Reflect.ownKeys(fields).map((key) => {
    return new PropertySignature(key, fields[key].ast);
  }), [], annotations, checks);
}
function getAST(self) {
  return self.ast;
}
function tuple(elements, checks = void 0) {
  return new Arrays(false, elements.map((e) => e.ast), [], void 0, checks);
}
function union4(members, options, checks) {
  return new Union(members.map(getAST), options, void 0, checks);
}
function structWithRest(ast, records) {
  if (ast.encoding || records.some((r) => r.encoding)) {
    throw new Error("StructWithRest does not support encodings");
  }
  let propertySignatures = ast.propertySignatures;
  let indexSignatures = ast.indexSignatures;
  let checks = ast.checks;
  for (const record2 of records) {
    for (const propertySignature of record2.propertySignatures) {
      if (propertySignatures.some((ps) => ps.name === propertySignature.name)) {
        throw new Error(`Duplicate identifier: ${JSON.stringify(propertySignature.name)}. ts(2300)`);
      }
    }
    propertySignatures = propertySignatures.concat(record2.propertySignatures);
    indexSignatures = indexSignatures.concat(record2.indexSignatures);
    checks = combineChecks(checks, record2.checks);
  }
  return new Objects(propertySignatures, indexSignatures, void 0, checks);
}
function tupleWithRest(ast, rest) {
  if (ast.encoding) {
    throw new Error("TupleWithRest does not support encodings");
  }
  return new Arrays(ast.isMutable, ast.elements, rest, void 0, ast.checks);
}
function mutable(ast) {
  if (ast.encoding) {
    throw new Error("mutable does not support encodings");
  }
  return new Arrays(true, ast.elements, ast.rest, ast.annotations, ast.checks, void 0, ast.context, ast.encodingChecks);
}
var toCandidate = /* @__PURE__ */ memoizeIdempotent((ast) => {
  while (true) {
    if (isSuspend(ast)) return unknown;
    const encoding = ast.encoding;
    if (!encoding) {
      return ast.recur?.(toCandidate, identity) ?? ast;
    }
    if (encoding.some((link2) => link2.transformation._tag === "Middleware" && link2.transformation.decode !== identity)) return unknown;
    ast = encoding[encoding.length - 1].to;
  }
});
function getCandidateTypes(ast) {
  switch (ast._tag) {
    case "Null":
      return ["null"];
    case "Undefined":
      return ["undefined"];
    case "String":
    case "TemplateLiteral":
      return ["string"];
    case "Number":
      return ["number"];
    case "Boolean":
      return ["boolean"];
    case "Symbol":
    case "UniqueSymbol":
      return ["symbol"];
    case "BigInt":
      return ["bigint"];
    case "Arrays":
      return ["array"];
    case "ObjectKeyword":
      return ["object", "array", "function"];
    case "Objects":
      return ast.propertySignatures.length || ast.indexSignatures.length ? ["object"] : ["string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
    case "Enum":
      return Array.from(new Set(ast.enums.map(([, v]) => typeof v)));
    case "Literal":
      return [typeof ast.literal];
    case "Union":
      return Array.from(new Set(ast.types.flatMap(getCandidateTypes)));
    default:
      return ["null", "undefined", "string", "number", "boolean", "symbol", "bigint", "object", "array", "function"];
  }
}
function collectSentinels(ast) {
  switch (ast._tag) {
    default:
      return [];
    case "Declaration": {
      const s = ast.annotations?.[SENTINELS_ANNOTATION_KEY];
      return Array.isArray(s) ? s : [];
    }
    case "Objects":
      return ast.propertySignatures.flatMap((ps) => {
        const type = ps.type;
        if (!isOptional(type)) {
          if (isLiteral(type)) {
            return [{
              key: ps.name,
              literal: type.literal
            }];
          }
          if (isUniqueSymbol(type)) {
            return [{
              key: ps.name,
              literal: type.symbol
            }];
          }
        }
        return [];
      });
    case "Arrays":
      return ast.elements.flatMap((e, i) => {
        if (!isOptional(e)) {
          if (isLiteral(e)) {
            return [{
              key: i,
              literal: e.literal
            }];
          }
          if (isUniqueSymbol(e)) {
            return [{
              key: i,
              literal: e.symbol
            }];
          }
        }
        return [];
      });
    case "Union": {
      if (ast.types.length === 0) return [];
      const members = ast.types.map((type) => collectSentinels(toCandidate(type)));
      return members[0].filter((s) => members.every((sentinels) => sentinels.some((o) => o.key === s.key && o.literal === s.literal)));
    }
    case "Suspend":
      return collectSentinels(ast.thunk());
  }
}
var candidateIndexCache = /* @__PURE__ */ new WeakMap();
var emptyCandidates = /* @__PURE__ */ Object.freeze([]);
var getRuntimeType = (input) => input === null ? "null" : Array.isArray(input) ? "array" : typeof input;
var hasPropertySignature = (input, key) => key === "__proto__" ? Object.hasOwn(input, key) : key in input;
function getCandidateIndex(types) {
  let index2 = candidateIndexCache.get(types);
  if (index2) return index2;
  let bySentinel;
  let sentinelCandidateCount = 0;
  let otherwise;
  let literalCandidates;
  let onlyLiterals = true;
  const literalOf = [];
  for (let i = 0; i < types.length; i++) {
    const a = types[i];
    const encoded = toCandidate(a);
    if (isNever2(encoded)) continue;
    if (isLiteral(encoded) || isUniqueSymbol(encoded)) {
      literalCandidates ??= /* @__PURE__ */ new Map();
      const literal = isLiteral(encoded) ? encoded.literal : encoded.symbol;
      literalOf[i] = literal;
      let arr = literalCandidates.get(literal);
      if (!arr) literalCandidates.set(literal, arr = []);
      arr.push(i);
    } else {
      onlyLiterals = false;
    }
    const sentinels = collectSentinels(encoded);
    if (sentinels.length) {
      bySentinel ??= /* @__PURE__ */ new Map();
      sentinelCandidateCount++;
      for (const {
        key,
        literal
      } of sentinels) {
        let entry = bySentinel.get(key);
        if (!entry) bySentinel.set(key, entry = [/* @__PURE__ */ new Map(), /* @__PURE__ */ new Set()]);
        entry[1].add(i);
        let indexes = entry[0].get(literal);
        if (!indexes) entry[0].set(literal, indexes = /* @__PURE__ */ new Set());
        indexes.add(i);
      }
    } else {
      otherwise ??= {};
      const candidateTypes = getCandidateTypes(encoded);
      for (const t of candidateTypes) (otherwise[t] ??= []).push(i);
    }
  }
  const fallbacks = {};
  const getFallback = (type) => fallbacks[type] ??= Object.freeze(otherwise?.[type] ?? emptyCandidates);
  if (onlyLiterals && literalCandidates) {
    literalCandidates.forEach(Object.freeze);
    index2 = (input) => literalCandidates.get(input) ?? emptyCandidates;
  } else if (bySentinel?.size === 1 && !otherwise) {
    const [key, [byValue]] = bySentinel.entries().next().value;
    const candidates = /* @__PURE__ */ new Map();
    for (const [literal, indexes] of byValue) {
      candidates.set(literal, Object.freeze(Array.from(indexes)));
    }
    const all4 = Object.freeze(types.map((_, i) => i));
    index2 = (input, isConstructor) => {
      if (isObjectKeyword(input)) {
        const value3 = hasPropertySignature(input, key) ? input[key] : void 0;
        if (value3 !== void 0) return candidates.get(value3) ?? emptyCandidates;
        if (isConstructor) return all4;
      }
      return emptyCandidates;
    };
  } else if (bySentinel) {
    let commonSentinel;
    for (const entry of bySentinel) {
      if ((!commonSentinel || entry[1][0].size > commonSentinel[1][0].size) && entry[1][1].size === sentinelCandidateCount) {
        commonSentinel = entry;
      }
    }
    index2 = (input, isConstructor) => {
      const runtimeType = getRuntimeType(input);
      if (!isObjectKeyword(input)) return getFallback(runtimeType);
      const selected = new Set(otherwise?.[runtimeType]);
      let directKey;
      if (commonSentinel) {
        const [key, [byValue]] = commonSentinel;
        const hasKey = hasPropertySignature(input, key);
        const value3 = hasKey ? input[key] : void 0;
        if (hasKey && (!isConstructor || value3 !== void 0)) {
          const match7 = byValue.get(value3);
          if (!match7) return getFallback(runtimeType);
          for (const i of match7) selected.add(i);
          directKey = key;
        }
      }
      if (directKey === void 0) {
        for (const [key, [byValue, all4]] of bySentinel) {
          const hasKey = hasPropertySignature(input, key);
          const value3 = hasKey ? input[key] : void 0;
          if (hasKey && (!isConstructor || value3 !== void 0)) {
            const match7 = byValue.get(value3);
            if (match7) {
              for (const i of match7) selected.add(i);
            }
          } else if (isConstructor) {
            for (const i of all4) selected.add(i);
          }
        }
      }
      for (const [key, [byValue, all4]] of bySentinel) {
        if (key === directKey) continue;
        const hasKey = hasPropertySignature(input, key);
        const value3 = hasKey ? input[key] : void 0;
        if (hasKey && (!isConstructor || value3 !== void 0)) {
          const match7 = byValue.get(value3);
          for (const i of selected) {
            if (all4.has(i) && !match7?.has(i)) selected.delete(i);
          }
        }
      }
      return Array.from(selected).sort((a, b) => a - b);
    };
  } else {
    index2 = (input) => {
      const fallback = getFallback(getRuntimeType(input));
      return literalCandidates ? fallback.filter((i) => literalOf[i] === void 0 || literalOf[i] === input) : fallback;
    };
  }
  candidateIndexCache.set(types, index2);
  return index2;
}
var Union = class extends ASTNodeImpl {
  _tag = "Union";
  types;
  options;
  encodingChecks;
  constructor(types, options, annotations, checks, encoding, context3, encodingChecks) {
    super(annotations, checks, encoding, context3);
    this.types = types;
    this.options = options;
    this.encodingChecks = encodingChecks;
  }
  /** @internal */
  getParser(compile2, compileField2) {
    const ast = this;
    const isConstructor = compileField2 !== void 0;
    const parsers = [];
    const parser = (i) => parsers[i] ??= compile2(ast.types[i]);
    let index2;
    return (input, options) => {
      if (input === missing) {
        return missingExit;
      }
      const candidates = (index2 ??= getCandidateIndex(ast.types))(input, isConstructor);
      if (candidates.length === 0) {
        return fail5(new AnyOf(ast, [], input, options));
      }
      if (candidates.length === 1) {
        const result3 = parser(candidates[0])(input, options);
        if (result3._tag === "Success") return result3;
        return effectIsExit(result3) ? failSingleUnionCandidate(ast, result3.cause, input, options) : catchSingleUnionCandidate(ast, result3, input, options);
      }
      return parseUnionCandidates(ast, parser, candidates, input, options);
    };
  }
  _rebuild(recur2, checks, encodingChecks) {
    const types = mapOrSame(this.types, recur2);
    return types === this.types && checks === this.checks && encodingChecks === this.encodingChecks ? this : new Union(types, this.options, this.annotations, checks, void 0, this.context, encodingChecks);
  }
  /** @internal */
  recur(recur2) {
    return this._rebuild(recur2, this.checks, this.encodingChecks);
  }
  /** @internal */
  flip(recur2) {
    return this._rebuild(recur2, this.encodingChecks, this.checks);
  }
  /** @internal */
  matchPart(s, options) {
    for (const type of this.types) {
      const out = type.matchPart(s, options);
      if (out !== void 0) return out;
    }
    return void 0;
  }
  /** @internal */
  getExpected(getExpected2) {
    const expected = this.annotations?.expected;
    if (typeof expected === "string") return expected;
    if (this.types.length === 0) return "never";
    const types = this.types.map((type) => {
      const encoded = toEncoded(type);
      switch (encoded._tag) {
        case "Arrays": {
          const literals = encoded.elements.filter(isLiteral);
          if (literals.length > 0) {
            return `${formatIsMutable(encoded.isMutable)}[ ${literals.map((e) => getExpected2(e) + formatIsOptional(e.context?.isOptional)).join(", ")}, ... ]`;
          }
          break;
        }
        case "Objects": {
          const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type));
          if (literals.length > 0) {
            return `{ ${literals.map((ps) => `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${formatIsOptional(ps.type.context?.isOptional)}: ${getExpected2(ps.type)}`).join(", ")}, ... }`;
          }
          break;
        }
      }
      return getExpected2(encoded);
    });
    return Array.from(new Set(types)).join(" | ");
  }
};
function failSingleUnionCandidate(ast, cause, input, options) {
  const issue = getSchemaIssue(cause);
  if (!issue) return failCause2(cause);
  return fail4(new AnyOf(ast, [issue], input, options));
}
function catchSingleUnionCandidate(ast, result3, input, options) {
  return catchCause2(result3, (cause) => failSingleUnionCandidate(ast, cause, input, options));
}
function parseUnionCandidates(ast, parser, candidates, input, options) {
  const state = {
    ast,
    parser,
    input,
    out: void 0,
    successes: ast.options?.mode === "oneOf" ? [] : void 0,
    issues: void 0,
    options
  };
  const eff = parseUnion(state, candidates);
  if (!eff) {
    if (state.out) return state.out;
    return fail5(new AnyOf(ast, state.issues ?? [], input, options));
  }
  if (effectIsExit(eff)) return resumeUnion(eff, state);
  let first = true;
  return suspend2(() => {
    if (!first) return parseUnionCandidates(ast, parser, candidates, input, options);
    first = false;
    return resumeUnion(eff, state);
  });
}
function resumeUnion(eff, state) {
  return flatMapEager2(eff, (_) => {
    if (state.out === sameExit) return succeed5(state.input);
    if (state.out) return state.out;
    return fail5(new AnyOf(state.ast, state.issues ?? [], state.input, state.options));
  });
}
var parseUnion = /* @__PURE__ */ iterateEager()({
  onItem(s, i) {
    return s.parser(i)(s.input, s.options);
  },
  step(s, i, exit3) {
    if (exit3._tag === "Failure") {
      const issue = getSchemaIssue(exit3.cause);
      if (issue === void 0) {
        return exit3;
      }
      if (s.issues) s.issues.push(issue);
      else s.issues = [issue];
    } else {
      if (s.out && s.successes) {
        s.successes.push(s.ast.types[i]);
        return fail4(new OneOf(s.ast, s.successes, s.input, s.options));
      }
      s.out = exit3;
      if (s.successes) {
        s.successes.push(s.ast.types[i]);
      } else {
        return void_3;
      }
    }
  }
});
var nonFiniteLiterals = /* @__PURE__ */ new Union([/* @__PURE__ */ new Literal("Infinity"), /* @__PURE__ */ new Literal("-Infinity"), /* @__PURE__ */ new Literal("NaN")]);
function formatIsMutable(isMutable2) {
  return isMutable2 ? "" : "readonly ";
}
function formatIsOptional(isOptional2) {
  return isOptional2 ? "?" : "";
}
var Suspend = class extends ASTNodeImpl {
  _tag = "Suspend";
  thunk;
  constructor(thunk, annotations, checks, encoding, context3) {
    if (checks) {
      throw new Error("Cannot add checks to Suspend");
    }
    super(annotations, void 0, encoding, context3);
    let ast;
    this.thunk = () => ast ??= thunk();
  }
  /** @internal */
  getParser(compile2) {
    let parser;
    return (input, options) => (parser ??= compile2(this.thunk()))(input, options);
  }
  /** @internal */
  recur(recur2) {
    return new Suspend(() => recur2(this.thunk()), this.annotations, void 0, void 0, this.context);
  }
  /** @internal */
  getExpected(getExpected2) {
    return getExpected2(this.thunk());
  }
};
var Filter2 = class extends Class {
  _tag = "Filter";
  run;
  annotations;
  /**
   * Whether the parsing process should be aborted after this check has failed.
   */
  aborted;
  constructor(run2, annotations = void 0, aborted = false) {
    super();
    this.run = run2;
    this.annotations = annotations;
    this.aborted = aborted;
  }
  annotate(annotations) {
    return new Filter2(this.run, {
      ...this.annotations,
      ...annotations
    }, this.aborted);
  }
  abort() {
    return new Filter2(this.run, this.annotations, true);
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
};
var FilterGroup = class extends Class {
  _tag = "FilterGroup";
  checks;
  annotations;
  constructor(checks, annotations = void 0) {
    super();
    this.checks = checks;
    this.annotations = annotations;
  }
  annotate(annotations) {
    return new FilterGroup(this.checks, {
      ...this.annotations,
      ...annotations
    });
  }
  and(other, annotations) {
    return new FilterGroup([this, other], annotations);
  }
};
function makeFilter(filter8, annotations, aborted = false) {
  return new Filter2((input, ast, options) => normalizeFilterOutput(ast, filter8(input, ast, options), input, options), annotations, aborted);
}
function makeFilterByGuard(is3, annotations) {
  return new Filter2(
    (input, _ast, options) => is3(input) ? void 0 : new InvalidValue(void 0, input, options),
    annotations,
    true
    // after a guard, we always want to abort
  );
}
function isFinite2(annotations) {
  return makeFilter((n) => globalThis.Number.isFinite(n), {
    expected: "a finite number",
    representation: {
      id: "effect/schema/isFinite",
      payload: null
    },
    toJsonSchema: () => ({
      type: "number"
    }),
    toCode: () => ({
      runtime: "Schema.isFinite()"
    }),
    arbitraryConstraint: {
      number: "finite"
    },
    ...annotations
  });
}
var finite = /* @__PURE__ */ appendChecks(number2, [/* @__PURE__ */ isFinite2()]);
var numberToJson = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([finite, nonFiniteLiterals]), /* @__PURE__ */ new Transformation(/* @__PURE__ */ Number4(), /* @__PURE__ */ transform((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))));
function isPattern(regExp, annotations) {
  const copy3 = new globalThis.RegExp(regExp);
  const payload = {
    source: copy3.source,
    flags: copy3.flags
  };
  return makeFilter((s) => {
    copy3.lastIndex = 0;
    return copy3.test(s);
  }, {
    expected: `a string matching the RegExp ${payload.source}`,
    representation: {
      id: "effect/schema/isPattern",
      payload
    },
    // Keep the filter exportable so its JSON Schema annotations are preserved
    // when the RegExp constraint itself is omitted.
    toJsonSchema: () => [{}, true],
    arbitraryConstraint: {
      patterns: [payload]
    },
    ...annotations
  });
}
var bodyOwners = /* @__PURE__ */ new WeakMap();
function copy2(ast, changes) {
  const out = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, changes);
  if (Reflect.ownKeys(changes).every((key) => key === "context" || key === "encoding")) {
    bodyOwners.set(out, getContextOwner(ast));
  }
  return out;
}
function getContextOwner(ast) {
  const existing = bodyOwners.get(ast);
  if (existing !== void 0) return existing;
  if (ast.encoding === void 0) return ast;
  const owner = Object.assign(Object.create(Object.getPrototypeOf(ast)), ast, {
    encoding: void 0
  });
  bodyOwners.set(ast, owner);
  return owner;
}
function replaceEncoding(ast, encoding) {
  return ast.encoding === encoding ? ast : copy2(ast, {
    encoding
  });
}
function replaceContext(ast, context3) {
  if (ast.context === context3) {
    return ast;
  }
  const owner = getContextOwner(ast);
  if (owner.context === context3 && owner.encoding === ast.encoding) {
    return owner;
  }
  return copy2(ast, {
    context: context3
  });
}
function getLastEncoding(ast) {
  return ast.encoding ? getLastEncoding(ast.encoding[ast.encoding.length - 1].to) : ast;
}
function annotate(ast, annotations) {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1];
    return replaceChecks(ast, append(ast.checks.slice(0, -1), last.annotate(annotations)));
  }
  return copy2(ast, {
    annotations: {
      ...ast.annotations,
      ...annotations
    }
  });
}
function replaceChecks(ast, checks) {
  if (ast._tag === "Suspend" && checks) {
    throw new Error("Cannot add checks to Suspend");
  }
  if (ast.checks === checks) {
    return ast;
  }
  return copy2(ast, {
    checks
  });
}
function appendChecks(ast, checks) {
  return replaceChecks(ast, combineChecks(ast.checks, checks));
}
function mapLink(link2, f) {
  const to = f(link2.to);
  return to === link2.to ? link2 : new Link(to, link2.transformation);
}
function updateLastLink(encoding, f) {
  const links = encoding;
  const last = links[links.length - 1];
  const out = mapLink(last, f);
  return out === last ? encoding : append(encoding.slice(0, encoding.length - 1), out);
}
function applyToLastLink(f) {
  return (ast) => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast;
}
function replaceContextLastLink(ast, context3) {
  return applyToLastLink((ast2) => replaceContext(ast2, context3))(ast);
}
function applyToSelfOrLastLinkEncoding(f) {
  function out(ast) {
    return ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, out)) : f(ast);
  }
  return memoize(out);
}
function applyToSelfOrLastLinkEncodingIdempotent(f, options) {
  function out(ast) {
    if (ast.encoding) {
      const last = ast.encoding[ast.encoding.length - 1];
      return options?.stopAt?.(last) ? ast : replaceEncoding(ast, updateLastLink(ast.encoding, out));
    }
    return f(ast);
  }
  return memoizeIdempotent(out);
}
function middlewareDecoding(ast, middleware) {
  return appendTransformation(ast, middleware, toType(ast));
}
function middlewareEncoding(ast, middleware) {
  return appendTransformation(toEncoded(ast), middleware, ast);
}
function appendTransformation(from, transformation, to) {
  const link2 = new Link(from, transformation);
  return replaceEncoding(to, to.encoding ? [...to.encoding, link2] : [link2]);
}
function mapOrSame(as3, f) {
  let out;
  for (let i = 0; i < as3.length; i++) {
    const a = as3[i];
    const fa = f(a);
    if (out) {
      out[i] = fa;
    } else if (fa !== a) {
      out = new Array(as3.length);
      for (let j = 0; j < i; j++) {
        out[j] = as3[j];
      }
      out[i] = fa;
    }
  }
  return out ?? as3;
}
function annotateKey(ast, annotations) {
  const context3 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, ast.context.constructorDefault, {
    ...ast.context.annotations,
    ...annotations
  }) : new Context(false, false, void 0, annotations);
  return replaceContext(ast, context3);
}
var optionalKey = /* @__PURE__ */ memoizeIdempotent((ast) => {
  const context3 = ast.context ? ast.context.isOptional === false ? new Context(true, ast.context.isMutable, ast.context.constructorDefault, ast.context.annotations) : ast.context : new Context(true, false);
  return optionalKeyLastLink(replaceContext(ast, context3));
});
var optionalKeyLastLink = /* @__PURE__ */ applyToLastLink(optionalKey);
var optional = /* @__PURE__ */ memoize((ast) => optionalKey(new Union([ast, undefined_3])));
var mutableKey = /* @__PURE__ */ memoizeIdempotent((ast) => {
  const context3 = ast.context ? ast.context.isMutable === false ? new Context(ast.context.isOptional, true, ast.context.constructorDefault, ast.context.annotations) : ast.context : new Context(false, true);
  return mutableKeyLastLink(replaceContext(ast, context3));
});
var mutableKeyLastLink = /* @__PURE__ */ applyToLastLink(mutableKey);
function withConstructorDefault(ast, defaultValue) {
  const context3 = ast.context ? new Context(ast.context.isOptional, ast.context.isMutable, defaultValue, ast.context.annotations) : new Context(false, false, defaultValue);
  return replaceContext(ast, context3);
}
function decodeTo(from, to, transformation) {
  return appendTransformation(from, transformation, to);
}
function parseParameter(ast) {
  const literals = [];
  const parameters = [];
  function go(ast2) {
    switch (ast2._tag) {
      case "Literal":
        if (isPropertyKey(ast2.literal) && !literals.includes(ast2.literal)) {
          literals.push(ast2.literal);
        }
        return;
      case "UniqueSymbol":
        if (!literals.includes(ast2.symbol)) {
          literals.push(ast2.symbol);
        }
        return;
      case "Never":
        return;
      case "Union":
        for (let i = 0; i < ast2.types.length; i++) {
          go(ast2.types[i]);
        }
        return;
      default:
        parameters.push(ast2);
    }
  }
  go(ast);
  return {
    literals,
    parameters
  };
}
function record(key, value3) {
  const {
    literals,
    parameters: indexSignatures
  } = parseParameter(key);
  return new Objects(literals.map((literal) => new PropertySignature(literal, value3)), indexSignatures.map((parameter) => new IndexSignature(parameter, value3)));
}
function isOptional(ast) {
  return ast.context?.isOptional ?? false;
}
function isMutable(ast) {
  return ast.context?.isMutable ?? false;
}
function isStructuralCheck(check2) {
  return check2.annotations?.[STRUCTURAL_ANNOTATION_KEY] === true || check2._tag === "FilterGroup" && check2.checks.every(isStructuralCheck);
}
function extractStructuralChecks(checks) {
  function extract(check2) {
    if (isStructuralCheck(check2)) return [check2];
    return check2._tag === "FilterGroup" ? check2.checks.flatMap(extract) : [];
  }
  const out = checks.flatMap(extract);
  return isArrayNonEmpty2(out) ? out : void 0;
}
function canPreserveEncodingChecks(ast) {
  let preserve = true;
  function visit(child) {
    preserve = preserve && !child.encoding && !isSuspend(child);
    if (preserve && "recur" in child) child.recur(visit);
    return child;
  }
  if ("recur" in ast) ast.recur(visit);
  return preserve;
}
var toType = /* @__PURE__ */ memoizeIdempotent((ast) => {
  const owner = getContextOwner(ast);
  if (owner !== ast) {
    const type2 = toType(owner);
    return type2 === owner && ast.encoding === void 0 ? ast : replaceContext(type2, ast.context);
  }
  const type = "recur" in ast ? ast.recur(toType) : ast;
  if ("encodingChecks" in type && type.encodingChecks) {
    const checks = canPreserveEncodingChecks(ast) ? type.encodingChecks : isArrays(type) || isObjects(type) || isDeclaration(type) && type.typeParameters.length > 0 ? extractStructuralChecks(type.encodingChecks) : void 0;
    return copy2(type, {
      encodingChecks: void 0,
      checks: combineChecks(type.checks, checks)
    });
  }
  return type;
});
var toEncoded = /* @__PURE__ */ memoizeIdempotent((ast) => {
  return toType(flip4(ast));
});
function flipEncoding(ast, encoding) {
  const links = encoding;
  const len = links.length;
  const last = links[len - 1];
  const ls = [new Link(flip4(replaceEncoding(ast, void 0)), links[0].transformation.flip())];
  for (let i = 1; i < len; i++) {
    ls.unshift(new Link(flip4(links[i - 1].to), links[i].transformation.flip()));
  }
  const to = flip4(last.to);
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, ...ls]);
  } else {
    return replaceEncoding(to, ls);
  }
}
var flip4 = /* @__PURE__ */ memoize((ast) => {
  if (ast.encoding) {
    return flipEncoding(ast, ast.encoding);
  }
  const owner = getContextOwner(ast);
  if (owner !== ast) {
    const flipped = flip4(owner);
    return flipped === owner ? ast : replaceContext(flipped, ast.context);
  }
  return "flip" in ast ? ast.flip(flip4) : "recur" in ast ? ast.recur(flip4) : ast;
});
function containsUndefined(ast) {
  switch (ast._tag) {
    case "Undefined":
      return true;
    case "Union":
      return ast.types.some(containsUndefined);
    default:
      return false;
  }
}
function fromConst(ast, value3) {
  const succeed7 = value3 === 0 ? sameExit : succeed6(value3);
  return (input, options) => {
    if (input === missing) return missingExit;
    if (input === value3) return succeed7;
    return fail5(new InvalidType(ast, input, options));
  };
}
function fromRefinement(ast, refinement) {
  return (input, options) => {
    if (input === missing) return missingExit;
    if (refinement(input)) return sameExit;
    return fail5(new InvalidType(ast, input, options));
  };
}
function segmentTemplateLiteralParts(ast, input, options) {
  const parts2 = ast.encodedParts;
  const literals = ast.literals;
  const inputLength = input.length;
  for (let i = 0; i < literals.length; i++) {
    const literal = literals[i];
    if (literal && !input.includes(literal)) return void 0;
  }
  if (ast.suffixLengths[0] > inputLength) return void 0;
  const out = new Array(parts2.length);
  let failures;
  function go(i, pos) {
    if (i === parts2.length) return pos === inputLength;
    if (failures?.has(i * (inputLength + 1) + pos)) return false;
    const part = parts2[i];
    if (i === parts2.length - 1) {
      const s = input.slice(pos);
      if (part.matchPart(s, options) !== void 0) {
        out[i] = s;
        return true;
      }
    } else if (part._tag === "Literal") {
      const s = literals[i];
      if (input.startsWith(s, pos) && go(i + 1, pos + s.length)) {
        out[i] = s;
        return true;
      }
    } else {
      const maximumEnd = inputLength - ast.suffixLengths[i + 1];
      const anchor = literals[i + 1];
      let end = anchor === void 0 ? maximumEnd : input.lastIndexOf(anchor, maximumEnd);
      while (end >= pos) {
        const s = input.slice(pos, end);
        if (part.matchPart(s, options) !== void 0 && go(i + 1, end)) {
          out[i] = s;
          return true;
        }
        if (end === 0) break;
        end = anchor === void 0 ? end - 1 : input.lastIndexOf(anchor, end - 1);
      }
    }
    failures ??= /* @__PURE__ */ new Set();
    failures.add(i * (inputLength + 1) + pos);
    return false;
  }
  return go(0, 0) ? out : void 0;
}
var parameterFromPropertyKey = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(parameterFromPropertyKey);
  }
});
var parameterFromString = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Symbol":
    case "UniqueSymbol":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(parameterFromString);
  }
});
var partFromString = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    default:
      return ast;
    case "Number":
    case "Literal":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Union":
      return ast.recur(partFromString);
  }
});
var STRING_PATTERN = "[\\s\\S]*?";
var isStringFiniteRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${FINITE_PATTERN}$`);
var isStringNumberRegExp = /* @__PURE__ */ new globalThis.RegExp(`^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`);
function isStringFinite(annotations) {
  return isPattern(isStringFiniteRegExp, {
    expected: "a string representing a finite number",
    representation: {
      id: "effect/schema/isStringFinite",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringFiniteRegExp.source
    }),
    ...annotations
  });
}
var finiteString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringFinite()]);
var finiteToString = /* @__PURE__ */ new Link(finiteString, numberFromString);
var numberToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([finiteString, nonFiniteLiterals]), numberFromString);
var BIGINT_PATTERN = "-?\\d+";
var isStringBigIntRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${BIGINT_PATTERN}$`);
function isStringBigInt(annotations) {
  return isPattern(isStringBigIntRegExp, {
    expected: "a string representing a bigint",
    representation: {
      id: "effect/schema/isStringBigInt",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringBigIntRegExp.source
    }),
    ...annotations
  });
}
var bigIntString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringBigInt({
  expected: "a string representing a bigint"
})]);
var bigIntToString = /* @__PURE__ */ new Link(bigIntString, bigintFromString);
var REGEXP_PATTERN = "Symbol\\(([\\s\\S]*)\\)";
var isStringSymbolRegExp = /* @__PURE__ */ new globalThis.RegExp(`^${REGEXP_PATTERN}$`);
var symbolString = /* @__PURE__ */ appendChecks(string2, [/* @__PURE__ */ isStringSymbol()]);
var symbolToString = /* @__PURE__ */ new Link(symbolString, /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((description) => globalThis.Symbol.for(isStringSymbolRegExp.exec(description)[1])), /* @__PURE__ */ transformEffect((sym, options) => {
  const key = globalThis.Symbol.keyFor(sym);
  if (key !== void 0) {
    return succeed5(globalThis.String(sym));
  }
  return fail5(new Forbidden({
    message: "cannot serialize to string, Symbol is not registered"
  }, sym, options));
})));
function isStringSymbol(annotations) {
  return isPattern(isStringSymbolRegExp, {
    expected: "a string representing a symbol",
    representation: {
      id: "effect/schema/isStringSymbol",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: isStringSymbolRegExp.source
    }),
    ...annotations
  });
}
function collectIssues(checks, value3, issues, ast, options) {
  for (let i = 0; i < checks.length; i++) {
    const check2 = checks[i];
    if (check2._tag === "FilterGroup") {
      issues = collectIssues(check2.checks, value3, issues, ast, options);
      if (issues && (options.errors !== "all" || issues[issues.length - 1].filter.aborted)) {
        return issues;
      }
    } else {
      const issue = check2.run(value3, ast, options);
      if (issue) {
        const filter8 = new Filter(check2, issue, value3, options);
        if (issues) issues.push(filter8);
        else issues = [filter8];
        if (options.errors !== "all" || check2.aborted) {
          return issues;
        }
      }
    }
  }
  return issues;
}
function runChecks(checks, s) {
  const issues = collectIssues(checks, s, void 0, unknown, {
    errors: "all"
  });
  if (issues) {
    const issue = new Composite(unknown, issues);
    return fail2(issue);
  }
  return succeed2(s);
}
function getConstructorDescriptor(ast) {
  if (!isDeclaration(ast)) return void 0;
  const getDescriptor = ast.annotations?.[CONSTRUCTOR_ANNOTATION_KEY];
  return isFunction(getDescriptor) ? getDescriptor(ast.typeParameters) : void 0;
}
function isJsonLeaf(u) {
  return u === null || typeof u === "string" || typeof u === "boolean" || typeof u === "number" && globalThis.Number.isFinite(u);
}
function isStringTreeLeaf(u) {
  return u === void 0 || typeof u === "string";
}
function isTree(u, isLeaf) {
  const cache2 = /* @__PURE__ */ new WeakMap();
  const stack = [];
  outer: while (true) {
    if (typeof u !== "object" || u === null) {
      if (!isLeaf(u)) {
        return false;
      }
    } else {
      const value3 = u;
      const cached3 = cache2.get(value3);
      if (cached3 === false) {
        return false;
      }
      if (cached3 === void 0) {
        const isArray2 = Array.isArray(value3);
        if (!isArray2) {
          const prototype = Object.getPrototypeOf(value3);
          if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
            return false;
          }
        }
        cache2.set(value3, false);
        stack.push({
          value: value3,
          keys: isArray2 ? value3.length : Object.keys(value3),
          index: 0
        });
      }
    }
    while (stack.length > 0) {
      const frame2 = stack[stack.length - 1];
      const keys3 = frame2.keys;
      if (typeof keys3 === "number") {
        if (frame2.index < keys3) {
          u = frame2.value[frame2.index++];
          continue outer;
        }
      } else if (frame2.index < keys3.length) {
        u = frame2.value[keys3[frame2.index++]];
        continue outer;
      }
      cache2.set(frame2.value, true);
      stack.pop();
    }
    return true;
  }
}
function isJson(u) {
  return isTree(u, isJsonLeaf);
}
var Json = /* @__PURE__ */ new Declaration([], () => (input, ast, options) => isJson(input) ? sameExit : fail5(new InvalidType(ast, input, options)), {
  representation: {
    id: "effect/schema/Json",
    payload: null
  },
  expected: "JSON value",
  toCodecJson: () => void 0,
  toCodecStringTree: () => unknownToStringTree
});
var MutableJson = /* @__PURE__ */ annotate(Json, {
  representation: {
    id: "effect/schema/MutableJson",
    payload: null
  }
});
var unknownToJson = /* @__PURE__ */ new Link(Json, /* @__PURE__ */ passthrough3());
var objectKeywordToJson = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([/* @__PURE__ */ new Arrays(false, [], [Json]), /* @__PURE__ */ new Objects([], [/* @__PURE__ */ new IndexSignature(string2, Json)])]), /* @__PURE__ */ passthrough3());
function isStringTree(u) {
  return isTree(u, isStringTreeLeaf);
}
var StringTree = /* @__PURE__ */ new Declaration([], () => (input, ast, options) => isStringTree(input) ? sameExit : fail5(new InvalidType(ast, input, options)), {
  expected: "StringTree",
  toCodecStringTree: () => void 0
});
var unknownToStringTree = /* @__PURE__ */ new Link(StringTree, /* @__PURE__ */ passthrough3());

// node_modules/effect/dist/internal/schema/interpreter.js
var flatMapTransformation = (result3, current, f) => result3 === sameExit ? f(current) : flatMapEager2(result3, f);
function compileTransformation(transformation) {
  const apply2 = compileTransformationUnsafe(transformation);
  return (result3, current, options) => {
    try {
      return apply2(result3, current, options);
    } catch (error) {
      return die3(error);
    }
  };
}
function compileTransformationUnsafe(transformation) {
  if (transformation._tag === "Middleware") {
    return (result3, current, options) => {
      const transformed = result3 === sameExit ? transformation.decode(succeed6(toOption(current)), options) : transformation.decode(mapEager2(result3, toOption), options);
      return fromOptionalEffect(transformed);
    };
  }
  const getter = transformation.decode;
  switch (getter._tag) {
    case "Passthrough":
      return (result3, current) => result3 === sameExit ? succeed6(current) : result3;
    case "Transform": {
      const transform3 = (value3) => value3 === missing ? missingExit : succeed6(getter.transform(value3));
      return (result3, current) => flatMapTransformation(result3, current, transform3);
    }
    case "TransformOptional": {
      const transform3 = (value3) => fromOptionExit(getter.transform(toOption(value3)));
      return (result3, current) => flatMapTransformation(result3, current, transform3);
    }
    case "TransformEffect":
      return (result3, current, options) => flatMapTransformation(result3, current, (value3) => value3 === missing ? missingExit : getter.transform(value3, options));
    case "TransformOptionalEffect":
      return (result3, current, options) => flatMapTransformation(result3, current, (value3) => fromOptionalEffect(getter.transform(toOption(value3), options)));
  }
}
var fromOptionalEffect = (effect) => flatMapEager2(effect, fromOptionExit);
var wrapEncoding = (ast, input, options, effect) => catchCause2(effect, (cause) => failCauseSync2(() => map6(cause, (issue) => new Encoding(ast, issue, input, options))));
function makeConstructorParser(descriptor, compile2) {
  const transform3 = compileTransformation(descriptor.link.transformation);
  let sourceParser;
  return (input, options) => {
    if (input === missing) return missingExit;
    if (descriptor.isConstructed(input)) return sameExit;
    const result3 = (sourceParser ??= compile2(descriptor.link.to))(input, options);
    return transform3(result3, input, options);
  };
}
function withDefault2(ast, parser) {
  const defaultValue = ast.context.constructorDefault;
  return (input, options) => {
    if (input !== missing && input !== void 0) return parser(input, options);
    const result3 = defaultValue;
    if (effectIsExit(result3) && result3._tag === "Success") {
      const local = parser(result3[args], options);
      return local === sameExit ? result3 : local;
    }
    return flatMapEager2(wrapEncoding(ast, input, options, result3), (value3) => {
      const local = parser(value3, options);
      return local === sameExit ? succeed6(value3) : local;
    });
  };
}
function compileField(ast, compile2) {
  const parser = compile2(ast);
  return ast.context?.constructorDefault === void 0 ? parser : withDefault2(ast, parser);
}
function compile(ast, compile2, compileField2, base, specialize) {
  if (ast._tag === "Declaration") {
    for (const parameter of ast.typeParameters) compile2(parameter);
  }
  const descriptor = compileField2 ? getConstructorDescriptor(ast) : void 0;
  const parser = descriptor ? makeConstructorParser(descriptor, compile2) : base ?? ast.getParser(compile2, compileField2);
  const checks = ast.checks;
  const links = ast.encoding;
  const transformations = links?.map((link2) => compileTransformation(link2.transformation));
  const encodingChecks = ast.encodingChecks;
  if (!links && !checks && !encodingChecks) {
    return parser;
  }
  let encodingParsers;
  const parseChecks = (input, options) => {
    let result3 = parser(input, options);
    try {
      if (encodingChecks && !options.disableChecks) {
        if (effectIsExit(result3)) {
          if (result3._tag === "Success") {
            const output = result3 === sameExit ? input : result3[args];
            if (input !== missing && output !== missing) {
              const issues = collectIssues(encodingChecks, input, void 0, ast, options);
              if (issues) {
                result3 = fail5(new Composite(ast, issues, input, options));
              }
            }
          }
        } else {
          result3 = flatMap4(result3, (value3) => {
            if (input !== missing && value3 !== missing) {
              const issues = collectIssues(encodingChecks, input, void 0, ast, options);
              if (issues) {
                return fail5(new Composite(ast, issues, input, options));
              }
            }
            return succeed5(value3);
          });
        }
      }
      if (checks && !options.disableChecks) {
        if (effectIsExit(result3)) {
          if (result3._tag === "Success") {
            const value3 = result3 === sameExit ? input : result3[args];
            if (value3 === missing) return result3;
            const issues = collectIssues(checks, value3, void 0, ast, options);
            if (issues) {
              result3 = fail5(new Composite(ast, issues, value3, options));
            }
          }
        } else {
          result3 = flatMap4(result3, (value3) => {
            if (value3 !== missing) {
              const issues = collectIssues(checks, value3, void 0, ast, options);
              if (issues) {
                return fail5(new Composite(ast, issues, value3, options));
              }
            }
            return succeed5(value3);
          });
        }
      }
      return result3;
    } catch (error) {
      return die3(error);
    }
  };
  const parseLocal = specialize === void 0 ? parseChecks : specialize(parseChecks);
  if (!links) {
    return parseLocal;
  }
  return (input, options) => {
    const parsers = encodingParsers ??= links.map((link2) => compile2(link2.to));
    let current = input;
    let result3 = parsers[parsers.length - 1](input, options);
    for (let i = links.length - 1; i >= 0; i--) {
      result3 = transformations[i](result3, current, options);
      if (i !== 0) {
        const next = parsers[i - 1];
        if (result3._tag === "Success") {
          current = result3[args];
          result3 = next(current, options);
        } else {
          result3 = flatMapEager2(result3, (value3) => {
            const nextResult = next(value3, options);
            return nextResult === sameExit ? succeed6(value3) : nextResult;
          });
        }
      }
    }
    if (result3._tag === "Success") {
      const value3 = result3[args];
      const local = parseLocal(value3, options);
      return local === sameExit ? result3 : local;
    }
    result3 = wrapEncoding(ast, input, options, result3);
    return flatMapEager2(result3, (value3) => {
      const local = parseLocal(value3, options);
      return local === sameExit ? succeed6(value3) : local;
    });
  };
}

// node_modules/effect/dist/internal/schema/compilerRegistry.js
var invalid3 = /* @__PURE__ */ Symbol();
var cache = /* @__PURE__ */ new WeakMap();
var compiler;
var compilerAdaptersEnabled = false;
var decodeChild = (ast) => compilerAdaptersEnabled ? lazyParser(resolve2, ast, "parser") : resolve2(ast).parser;
var makeChild = (ast) => compilerAdaptersEnabled ? lazyParser(resolve2, ast, "makeEffect") : resolve2(ast).makeEffect;
var makeField = (ast) => compileField(ast, makeChild);
var InterpretedEntry = class {
  ast;
  constructor(ast) {
    this.ast = ast;
  }
  get decodeEffect() {
    return this.cachedDecodeEffect ??= compile(this.ast, decodeChild);
  }
  get parser() {
    return this.decodeEffect;
  }
  get makeEffect() {
    return this.cachedMakeEffect ??= compile(this.ast, makeChild, makeField);
  }
};
var CompilerEntry = class extends InterpretedEntry {
  compiled;
  resolve;
  constructor(ast, compiled, resolve3) {
    super(ast);
    this.compiled = compiled;
    this.resolve = resolve3;
  }
  save(key, value3) {
    Object.defineProperty(this, key, {
      value: value3
    });
    return value3;
  }
  operation(key) {
    const compiled = this.compiled;
    return typeof compiled === "function" ? compiled(this.ast, this.resolve, key) : compiled?.[key];
  }
  get is() {
    return this.save("is", this.operation("is"));
  }
  get decode() {
    return this.save("decode", this.operation("decode"));
  }
  get make() {
    return this.save("make", this.operation("make"));
  }
  get decodeEffect() {
    return this.save("decodeEffect", this.operation("decodeEffect") ?? compile(this.ast, (ast) => lazyParser(this.resolve, ast, "parser")));
  }
  get parser() {
    const decode5 = this.decode;
    return decode5 === void 0 ? this.decodeEffect : this.save("parser", withDecode(decode5, () => this.decodeEffect));
  }
  get makeEffect() {
    const makeEffect2 = this.operation("makeEffect");
    if (makeEffect2 !== void 0) return this.save("makeEffect", makeEffect2);
    const child = (ast) => lazyParser(this.resolve, ast, "makeEffect");
    return this.save("makeEffect", compile(this.ast, child, (ast) => compileField(ast, child)));
  }
};
function withDecode(fastDecode, decodeEffect3) {
  let detailed;
  return (input, options) => {
    if (input !== missing) {
      try {
        const value3 = fastDecode(input, options);
        if (value3 !== invalid3) return value3 === input ? sameExit : succeed6(value3);
      } catch (error) {
        return die3(error);
      }
    }
    return (detailed ??= decodeEffect3())(input, options);
  };
}
function lazyParser(resolve3, ast, operation) {
  const entry = resolve3(ast);
  if (entry.compiled === void 0 || Object.hasOwn(entry, operation)) {
    return entry[operation];
  }
  let parser;
  return (input, options) => (parser ??= entry[operation])(input, options);
}
function resolve2(ast) {
  const cached3 = cache.get(ast);
  if (cached3 !== void 0) return cached3;
  const entry = compiler === void 0 ? new InterpretedEntry(ast) : new CompilerEntry(ast, compiler(ast, resolve2), resolve2);
  cache.set(ast, entry);
  return entry;
}

// node_modules/effect/dist/SchemaParser.js
function makeEffect(schema) {
  const ast = schema.ast;
  let parser;
  return (input, options) => {
    return (parser ??= runWithCompiler(constructorCompiler, toType(ast)))(input, options?.disableChecks ? options?.parseOptions ? {
      ...options.parseOptions,
      disableChecks: true
    } : {
      disableChecks: true
    } : options?.parseOptions);
  };
}
function makeOption(schema) {
  const parser = makeEffect(schema);
  return (input, options) => {
    const exit3 = runSyncExit2(parser(input, options));
    if (isSuccess4(exit3)) {
      return some2(exit3.value);
    }
    getSchemaIssueOrThrow(exit3.cause, "Option adapter can only return none for schema issues");
    return none2();
  };
}
function make15(schema) {
  return makeConstructorSync(toType(schema.ast));
}
function is(schema) {
  return _is(schema.ast);
}
function makeIs(ast) {
  if (!compilerAdaptersEnabled) {
    const parser2 = asExit(run(ast));
    return (input) => {
      const exit3 = parser2(input, defaultParseOptions);
      if (isSuccess4(exit3)) return true;
      getSchemaIssueOrThrow(exit3.cause, "Type guard adapter can only return false for schema issues");
      return false;
    };
  }
  const entry = resolve2(ast);
  const guard = entry.is;
  if (guard !== void 0) {
    return (input) => {
      try {
        return guard(input, defaultParseOptions);
      } catch (error) {
        getSchemaIssueOrThrow(die2(error), "Type guard adapter can only return false for schema issues");
        return false;
      }
    };
  }
  const parser = entry.parser;
  return (input) => {
    const exit3 = runSyncExit2(parserResult(parser(input, defaultParseOptions), input));
    if (isSuccess4(exit3)) return true;
    getSchemaIssueOrThrow(exit3.cause, "Type guard adapter can only return false for schema issues");
    return false;
  };
}
function _is(ast) {
  const typeAST = toType(ast);
  let guard = (input) => {
    guard = makeIs(typeAST);
    return guard(input);
  };
  return (input) => {
    return guard(input);
  };
}
function _issue(ast) {
  const parser = run(ast);
  return (input, options) => {
    const exit3 = runSyncExit2(parser(input, options));
    if (isSuccess4(exit3)) {
      return void 0;
    }
    return getSchemaIssueOrThrow(exit3.cause, "Issue adapter can only return schema issues");
  };
}
function asserts(schema, input) {
  const ast = toType(schema.ast);
  const result3 = resolve2(ast).parser(input, defaultParseOptions);
  const exit3 = runSyncExit2(parserResult(result3, input));
  if (isFailure4(exit3)) {
    const issue = getSchemaIssueOrThrow(exit3.cause, "Assertion adapter can only throw schema issues");
    throw new Error("Schema validation failed", {
      cause: issue
    });
  }
}
function decodeUnknownEffect(schema, options) {
  const parser = run(schema.ast);
  return options === void 0 ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
var decodeEffect = decodeUnknownEffect;
function decodeUnknownExit(schema, options) {
  return asExit(decodeUnknownEffect(schema, options));
}
function decodeUnknownOption(schema, options) {
  return asOption(decodeUnknownEffect(schema, options));
}
var decodeOption = decodeUnknownOption;
function decodeUnknownResult(schema, options) {
  return asResult(decodeUnknownEffect(schema, options));
}
function decodeUnknownSync(schema, options) {
  return compilerAdaptersEnabled ? makeSync(schema.ast, options) : asSync(decodeUnknownEffect(schema, options));
}
var decodeSync = decodeUnknownSync;
function encodeUnknownEffect(schema, options) {
  const parser = run(flip4(schema.ast));
  return options === void 0 ? parser : (input, overrideOptions) => parser(input, mergeParseOptions(options, overrideOptions));
}
var encodeEffect = encodeUnknownEffect;
function encodeUnknownExit(schema, options) {
  return asExit(encodeUnknownEffect(schema, options));
}
function encodeUnknownOption(schema, options) {
  return asOption(encodeUnknownEffect(schema, options));
}
var encodeOption = encodeUnknownOption;
function encodeUnknownResult(schema, options) {
  return asResult(encodeUnknownEffect(schema, options));
}
function encodeUnknownSync(schema, options) {
  return compilerAdaptersEnabled ? makeSync(flip4(schema.ast), options) : asSync(encodeUnknownEffect(schema, options));
}
var encodeSync = encodeUnknownSync;
var mergeParseOptions = (options, overrideOptions) => overrideOptions ? {
  ...options,
  ...overrideOptions
} : options;
var getValue = (value3) => {
  if (value3 === missing) {
    return fail5(new InvalidValue());
  }
  return succeed5(value3);
};
function run(ast) {
  return runWithCompiler(normalCompiler, ast);
}
function parserResult(result3, input) {
  if (result3 === sameExit) {
    return succeed5(input);
  }
  if (!effectIsExit(result3)) {
    return flatMapEager2(result3, getValue);
  }
  return result3[args] === missing ? getValue(missing) : result3;
}
function runWithCompiler(compiler2, ast) {
  let parser;
  return (input, options) => {
    const result3 = (parser ??= compiler2(ast))(input, options ?? defaultParseOptions);
    if (result3 === sameExit) {
      return succeed5(input);
    }
    if (!effectIsExit(result3)) {
      return flatMapEager2(result3, getValue);
    }
    return result3[args] === missing ? getValue(missing) : result3;
  };
}
function asExit(parser) {
  return (input, options) => runSyncExit2(parser(input, options));
}
function asOption(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return some2(exit3.value);
    }
    getSchemaIssueOrThrow(exit3.cause, "Option adapter can only return none for schema issues");
    return none2();
  };
}
function asResult(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return succeed2(exit3.value);
    }
    return fail2(getSchemaIssueOrThrow(exit3.cause, "Result adapter can only return schema issues"));
  };
}
function makeSync(ast, options) {
  let run2;
  return (input, overrideOptions) => (run2 ??= makeSyncEntry(resolve2(ast), options))(input, overrideOptions);
}
function makeSyncEntry(entry, options) {
  const decode5 = entry.decode;
  let detailed;
  const run2 = decode5 === void 0 ? (input, parseOptions = defaultParseOptions) => (detailed ??= makeDetailedSync(entry))(input, parseOptions) : (input, parseOptions = defaultParseOptions) => {
    if (input === missing) {
      return (detailed ??= makeDetailedSync(entry))(input, parseOptions);
    }
    let output;
    try {
      output = decode5(input, parseOptions);
    } catch (error) {
      getSchemaIssueOrThrow(die2(error), "Sync adapter can only throw schema issues");
      throw error;
    }
    if (output !== invalid3) return output;
    return (detailed ??= makeDetailedSync(entry))(input, parseOptions);
  };
  return options === void 0 ? run2 : (input, overrideOptions) => run2(input, mergeParseOptions(options, overrideOptions));
}
function makeDetailedSync(entry) {
  return asSync(runWithCompiler(() => entry.decodeEffect, entry.ast));
}
function asSync(parser) {
  const parserExit = asExit(parser);
  return (input, options) => {
    const exit3 = parserExit(input, options);
    if (isSuccess4(exit3)) {
      return exit3.value;
    }
    const issue = getSchemaIssueOrThrow(exit3.cause, "Sync adapter can only throw schema issues");
    throw new Error("Schema validation failed", {
      cause: issue
    });
  };
}
function runSync3(effect, message) {
  const exit3 = runSyncExit2(effect);
  if (isSuccess4(exit3)) {
    return exit3.value;
  }
  const issue = getSchemaIssueOrThrow(exit3.cause, message);
  throw new Error("Schema validation failed", {
    cause: issue
  });
}
function makeConstructorSync(ast) {
  let entry;
  let parser;
  return (input, options) => {
    entry ??= resolve2(ast);
    const parseOptions = options?.disableChecks ? options.parseOptions ? {
      ...options.parseOptions,
      disableChecks: true
    } : {
      disableChecks: true
    } : options?.parseOptions ?? defaultParseOptions;
    const make24 = entry.make;
    if (make24 !== void 0 && input !== missing) {
      let output;
      try {
        output = make24(input, parseOptions);
      } catch (error) {
        getSchemaIssueOrThrow(die2(error), "Constructor adapter can only throw schema issues");
        throw error;
      }
      if (output !== invalid3 && output !== missing) return output;
    }
    const result3 = (parser ??= entry.makeEffect)(input, parseOptions);
    return runSync3(parserResult(result3, input), "Constructor adapter can only throw schema issues");
  };
}
var normalCompiler = (ast) => resolve2(ast).parser;
var constructorCompiler = (ast) => resolve2(ast).makeEffect;

// node_modules/effect/dist/internal/schema/make.js
var TypeId24 = "~effect/Schema/Schema";
var RebuildOptions = /* @__PURE__ */ Symbol();
var SchemaProto = {
  [TypeId24]: TypeId24,
  get make() {
    const value3 = make15(this);
    Object.defineProperty(this, "make", {
      value: value3,
      enumerable: true
    });
    return value3;
  },
  get makeEffect() {
    const value3 = makeEffect(this);
    Object.defineProperty(this, "makeEffect", {
      value: value3,
      enumerable: true
    });
    return value3;
  },
  get makeOption() {
    const value3 = makeOption(this);
    Object.defineProperty(this, "makeOption", {
      value: value3,
      enumerable: true
    });
    return value3;
  },
  pipe() {
    return pipeArguments(this, arguments);
  },
  annotate(annotations) {
    return this.rebuild(annotate(this.ast, annotations));
  },
  annotateKey(annotations) {
    return this.rebuild(annotateKey(this.ast, annotations));
  },
  check(...checks) {
    return this.rebuild(appendChecks(this.ast, checks));
  },
  rebuild(ast) {
    return make16(ast, this[RebuildOptions]);
  }
};
function make16(ast, options) {
  function Schema() {
  }
  const self = Object.setPrototypeOf(Schema, SchemaProto);
  if (options && (Object.hasOwn(options, "name") || Object.hasOwn(options, "length") || Object.hasOwn(options, "__proto__"))) {
    Object.defineProperties(self, Object.getOwnPropertyDescriptors({
      ...options
    }));
  } else {
    Object.assign(self, options);
  }
  self[RebuildOptions] = options;
  self.ast = ast;
  return self;
}

// node_modules/effect/dist/JsonPointer.js
function escapeToken(token) {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}
function unescapeToken(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}
function formatUriFragmentToken(token) {
  return encodeURI(escapeToken(token)).replace(/#/g, "%23");
}
function decodeUriFragment(fragment) {
  if (fragment.length === 0 || fragment === "#") return "";
  if (!fragment.startsWith("#")) return void 0;
  const encoded = fragment.slice(1);
  try {
    if (encodeURI(encoded).replace(/%25/g, "%").replace(/#/g, "%23") !== encoded) return void 0;
    const pointer = decodeURIComponent(encoded);
    return pointer.startsWith("/") && !/~(?:[^01]|$)/.test(pointer) ? pointer : void 0;
  } catch {
    return void 0;
  }
}
function parseUriFragment(fragment) {
  const pointer = decodeUriFragment(fragment);
  return pointer === void 0 ? void 0 : pointer.length === 0 ? [] : pointer.slice(1).split("/").map(unescapeToken);
}
function formatUriFragment(path) {
  return path.reduce((fragment, token) => `${fragment}/${formatUriFragmentToken(token)}`, "#");
}

// node_modules/effect/dist/JsonSchema.js
var META_SCHEMA_URI_DRAFT_07 = "http://json-schema.org/draft-07/schema#";
var META_SCHEMA_URI_DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";
function isMetaSchemaUri(value3, uri) {
  return value3 === uri || value3 === (uri.endsWith("#") ? uri.slice(0, -1) : `${uri}#`);
}
function toDocumentDraft07(document) {
  return {
    dialect: "draft-07",
    ...convertDocument(document, draft07Adapter)
  };
}
function transformSchema(node, transform3) {
  return walk(node, false, true);
  function walk(node2, inheritedResource, isRoot = false) {
    if (!isObject(node2)) return node2;
    const inEmbeddedResource = inheritedResource || !isRoot && createsResource(node2.$id);
    const out = {};
    for (const key of Object.keys(node2)) {
      const value3 = node2[key];
      let transformed = value3;
      switch (key) {
        case "$defs":
        case "properties":
        case "patternProperties":
        case "dependentSchemas":
          transformed = mapObject(value3, (value4) => walk(value4, inEmbeddedResource)) ?? value3;
          break;
        case "allOf":
        case "anyOf":
        case "oneOf":
        case "prefixItems":
          transformed = Array.isArray(value3) ? value3.map((value4) => walk(value4, inEmbeddedResource)) : value3;
          break;
        case "not":
        case "additionalProperties":
        case "propertyNames":
        case "unevaluatedProperties":
        case "items":
        case "contains":
        case "unevaluatedItems":
        case "if":
        case "then":
        case "else":
        case "contentSchema":
          transformed = walk(value3, inEmbeddedResource);
      }
      assignProperty(out, key, transformed);
    }
    transform3(out, inEmbeddedResource);
    return out;
  }
}
function rewriteRefs(schema, rewrite) {
  return transformSchema(schema, (schema2) => {
    rewriteSchemaRef(schema2, rewrite);
  });
}
function rewriteSchemaRef(schema, rewrite) {
  if (typeof schema.$ref === "string") {
    assignProperty(schema, "$ref", rewrite(schema.$ref, "$ref"));
  }
  if (typeof schema.$dynamicRef === "string") {
    assignProperty(schema, "$dynamicRef", rewrite(schema.$dynamicRef, "$dynamicRef"));
  }
}
function mapObject(value3, f) {
  if (!isObject(value3)) return void 0;
  const out = {};
  for (const key of Object.keys(value3)) {
    assignProperty(out, key, f(value3[key], key));
  }
  return out;
}
function runConverter(adapter, options, use) {
  const locations = /* @__PURE__ */ new Map();
  const references = [];
  let rootUri = ROOT_URI;
  function convert(root, sourcePath = [], targetPath = []) {
    if (sourcePath.length === 0 && options?.trackIds) {
      const id2 = isObject(root) ? getResourceId(root) : void 0;
      rootUri = resolveResourceUri(id2, ROOT_URI) ?? ROOT_URI;
    }
    return loop(root, sourcePath, targetPath, {
      sourceRoot: [],
      targetRoot: [],
      uri: rootUri
    });
  }
  function finish() {
    for (const [out2, value3, sourceResource] of references) {
      let reference = value3;
      const resolved = resolveUrl(value3, sourceResource);
      if (resolved !== void 0) {
        const sourcePointer = parseUriFragment(resolved.hash);
        resolved.hash = "";
        if (sourcePointer !== void 0) {
          const targetPath = locations.get(locationKey(resolved.href, sourcePointer));
          if (targetPath !== void 0) reference = relocateReference(value3, targetPath);
        }
      }
      assignProperty(out2, "$ref", reference);
    }
  }
  const out = use(convert);
  finish();
  return out;
  function loop(node, sourcePath, targetPath, resourceScope) {
    if (typeof node === "boolean") {
      recordLocations(sourcePath, targetPath, resourceScope);
      return options?.booleanAdapter?.(node) ?? node;
    }
    if (!isObject(node)) return node;
    let currentResourceScope = resourceScope;
    const id2 = getResourceId(node);
    if (sourcePath.length > 0 && options?.trackIds && createsResource(id2)) {
      const uri = resolveResourceUri(id2, resourceScope.uri);
      if (uri !== void 0) {
        currentResourceScope = {
          parent: resourceScope,
          sourceRoot: sourcePath,
          targetRoot: targetPath,
          uri
        };
      }
    }
    recordLocations(sourcePath, targetPath, currentResourceScope);
    const currentResource = currentResourceScope.uri;
    const context3 = {
      isDocumentRoot: sourcePath.length === 0,
      schema(value3, sourceKey, targetKey = sourceKey) {
        return loop(value3, [...sourcePath, sourceKey], [...targetPath, targetKey], currentResourceScope);
      },
      schemaAt(value3, sourceSuffix, targetSuffix) {
        return loop(value3, [...sourcePath, ...sourceSuffix], [...targetPath, ...targetSuffix], currentResourceScope);
      },
      schemaArray(value3, sourceKey, targetKey = sourceKey) {
        return Array.isArray(value3) ? value3.map((item, index2) => loop(item, [...sourcePath, sourceKey, String(index2)], [...targetPath, targetKey, String(index2)], currentResourceScope)) : value3;
      },
      schemaMap(value3, sourceKey, targetKey = sourceKey) {
        if (!isObject(value3)) return value3;
        return mapObject(value3, (item, key) => loop(item, [...sourcePath, sourceKey, key], [...targetPath, targetKey, key], currentResourceScope));
      },
      reference(out2, value3) {
        if (typeof value3 === "string") {
          references.push([out2, value3, currentResource]);
        } else {
          assignProperty(out2, "$ref", value3);
        }
      }
    };
    return adapter(node, context3);
  }
  function getResourceId(schema) {
    return options?.ignoreRefSiblings === true && typeof schema.$ref === "string" ? void 0 : schema.$id;
  }
  function recordLocations(sourcePath, targetPath, scope3) {
    if (scope3.parent !== void 0) recordLocations(sourcePath, targetPath, scope3.parent);
    locations.set(locationKey(scope3.uri, sourcePath.slice(scope3.sourceRoot.length)), targetPath.slice(scope3.targetRoot.length));
  }
}
var ROOT_URI = "https://effect.invalid/.json-schema/";
function resolveUrl(value3, base) {
  return URL.canParse(value3, base) ? new URL(value3, base) : void 0;
}
function resolveResourceUri(value3, base) {
  if (typeof value3 !== "string") return void 0;
  const url = resolveUrl(value3, base);
  if (url === void 0) return void 0;
  url.hash = "";
  return url.href;
}
function relocateReference(reference, targetPath) {
  const index2 = reference.indexOf("#");
  if (index2 === -1 && targetPath.length === 0) return reference;
  const uri = index2 === -1 ? reference : reference.slice(0, index2);
  return `${uri}${formatUriFragment(targetPath)}`;
}
function locationKey(resource, pointer) {
  return `${resource}\0${JSON.stringify(pointer)}`;
}
function createsResource(id2) {
  return typeof id2 === "string" && id2.length > 0 && id2[0] !== "#";
}
function convertDocument(document, adapter, options) {
  return runConverter(adapter, {
    ...options,
    trackIds: true
  }, (convert) => ({
    schema: convert(document.schema),
    definitions: mapObject(document.definitions, (definition, key) => convert(definition, ["$defs", key], ["definitions", key]))
  }));
}
var SCHEMA_MAP_KEYWORDS = /* @__PURE__ */ new Set(["properties", "patternProperties"]);
var SCHEMA_ARRAY_KEYWORDS = /* @__PURE__ */ new Set(["allOf", "anyOf", "oneOf"]);
var JSON_SCHEMA_SINGLE_KEYWORDS = /* @__PURE__ */ new Set(["not", "additionalProperties", "propertyNames", "contains", "if", "then", "else", "contentSchema"]);
function convertSubschemaKeyword(out, key, value3, context3, singleKeywords, mapKeywords = SCHEMA_MAP_KEYWORDS) {
  let converted;
  if (mapKeywords.has(key)) converted = context3.schemaMap(value3, key);
  else if (SCHEMA_ARRAY_KEYWORDS.has(key)) converted = context3.schemaArray(value3, key);
  else if (singleKeywords.has(key)) converted = context3.schema(value3, key);
  else return false;
  assignProperty(out, key, converted);
  return true;
}
var PRE_2020_TO_2020_COLLISIONS = ["$anchor", "$defs", "$dynamicAnchor", "$dynamicRef", "$vocabulary", "contentSchema", "dependentRequired", "dependentSchemas", "maxContains", "minContains", "prefixItems", "unevaluatedItems", "unevaluatedProperties"];
var DRAFT_07_TO_2020_COLLISIONS = [...PRE_2020_TO_2020_COLLISIONS, "deprecated"];
var OPEN_API_30_TO_2020_COLLISIONS = [...PRE_2020_TO_2020_COLLISIONS, "$comment", "$id", "$schema", "const", "contains", "contentEncoding", "contentMediaType", "else", "examples", "if", "patternProperties", "propertyNames", "then"];
var ANCHOR_REGEXP = /^[A-Za-z_][-A-Za-z0-9._]*$/;
var LEGACY_ID_FRAGMENT_REGEXP = /^[A-Za-z][-A-Za-z0-9._:]*$/;
function unsupported(keyword, dialect, details) {
  throw new Error(`Cannot convert JSON Schema keyword "${keyword}" to ${dialect}: ${details}`);
}
function rejectKeywordCollisions(source, keywords, targetDialect, sourceDialect) {
  for (const keyword of keywords) {
    if (Object.hasOwn(source, keyword)) {
      unsupported(keyword, targetDialect, `it is not active in ${sourceDialect} but would become active in the target`);
    }
  }
}
var DRAFT_07_TARGET_COLLISIONS = ["additionalItems", "definitions", "dependencies"];
function convertMetaSchemaKeyword(out, value3, context3, targetUri, targetDialect) {
  if (context3.isDocumentRoot) {
    assignProperty(out, "$schema", isMetaSchemaUri(value3, META_SCHEMA_URI_DRAFT_2020_12) ? targetUri : value3);
  } else if (!isMetaSchemaUri(value3, META_SCHEMA_URI_DRAFT_2020_12)) {
    unsupported("$schema", targetDialect, "an embedded resource cannot declare a different dialect");
  }
}
function draft07Adapter(source, context3) {
  rejectKeywordCollisions(source, DRAFT_07_TARGET_COLLISIONS, "Draft-07", "Draft 2020-12");
  const out = {};
  let reference = void 0;
  let prefixItems = void 0;
  let items = void 0;
  for (const key of Object.keys(source)) {
    const value3 = source[key];
    if (convertSubschemaKeyword(out, key, value3, context3, JSON_SCHEMA_SINGLE_KEYWORDS)) continue;
    switch (key) {
      case "$ref":
        reference = value3;
        break;
      case "$schema":
        convertMetaSchemaKeyword(out, value3, context3, META_SCHEMA_URI_DRAFT_07, "Draft-07");
        break;
      case "$id":
      case "$anchor":
        break;
      case "$defs":
        assignProperty(out, "definitions", context3.schemaMap(value3, key, "definitions"));
        break;
      case "prefixItems":
        prefixItems = value3;
        break;
      case "items":
        items = value3;
        break;
      case "dependentRequired":
      case "dependentSchemas":
      case "minContains":
      case "maxContains":
        break;
      case "$dynamicRef":
      case "$dynamicAnchor":
      case "$vocabulary":
      case "unevaluatedProperties":
      case "unevaluatedItems":
        unsupported(key, "Draft-07", "the target dialect has no equivalent");
      case "required":
        if (Array.isArray(value3) && value3.length === 0) break;
        assignProperty(out, key, value3);
        break;
      default:
        assignProperty(out, key, value3);
    }
  }
  convertTuple(out, prefixItems, items, context3);
  if (Object.hasOwn(source, "contains")) {
    const minContains = source.minContains;
    const maxContains = source.maxContains;
    if (minContains !== void 0 && minContains !== 1 || maxContains !== void 0) {
      unsupported("minContains/maxContains", "Draft-07", "contains cardinality cannot be represented");
    }
    if (Object.hasOwn(source, "minContains")) assignProperty(out, "minContains", minContains);
  } else {
    if (Object.hasOwn(source, "minContains")) assignProperty(out, "minContains", source.minContains);
    if (Object.hasOwn(source, "maxContains")) assignProperty(out, "maxContains", source.maxContains);
  }
  convertDependencies(source, out, context3, "draft-07");
  convertLegacyId(source, out, "$id", "Draft-07");
  convertReference(out, reference, context3);
  return out;
}
function convertTuple(out, prefixItems, items, context3) {
  if (prefixItems === void 0) {
    if (items !== void 0) assignProperty(out, "items", context3.schema(items, "items"));
    return;
  }
  assignProperty(out, "items", context3.schemaArray(prefixItems, "prefixItems", "items"));
  if (items !== void 0) {
    assignProperty(out, "additionalItems", context3.schema(items, "items", "additionalItems"));
  }
}
function convertReference(out, reference, context3) {
  if (reference === void 0) return;
  if (typeof reference === "string" && Object.keys(out).length > 0) {
    const referenceSchema = {};
    context3.reference(referenceSchema, reference);
    appendAllOf(out, referenceSchema);
  } else {
    context3.reference(out, reference);
  }
}
function convertDependencies(source, out, context3, targetDialect) {
  const dependentRequired = isObject(source.dependentRequired) ? source.dependentRequired : void 0;
  const dependentSchemas = isObject(source.dependentSchemas) ? source.dependentSchemas : void 0;
  if (dependentRequired === void 0 && dependentSchemas === void 0) return;
  const dependencies = {};
  const keys3 = /* @__PURE__ */ new Set([...Object.keys(dependentRequired ?? {}), ...Object.keys(dependentSchemas ?? {})]);
  for (const key of keys3) {
    const required2 = dependentRequired?.[key];
    const dependency = dependentSchemas?.[key];
    const omitRequired = targetDialect === "draft-04" && Array.isArray(required2) && required2.length === 0;
    if (dependency === void 0) {
      if (!omitRequired) assignProperty(dependencies, key, required2);
    } else if (required2 === void 0 || omitRequired) {
      assignProperty(dependencies, key, context3.schemaAt(dependency, ["dependentSchemas", key], ["dependencies", key]));
    } else {
      assignProperty(dependencies, key, {
        allOf: [context3.schemaAt(dependency, ["dependentSchemas", key], ["dependencies", key, "allOf", "0"]), {
          required: required2
        }]
      });
    }
  }
  if (Object.keys(dependencies).length > 0) assignProperty(out, "dependencies", dependencies);
}
function appendAllOf(out, schema) {
  if (Array.isArray(out.allOf)) out.allOf.push(schema);
  else assignProperty(out, "allOf", [schema]);
}
function convertLegacyId(source, out, targetKey, dialect) {
  const id2 = source.$id;
  const anchor = source.$anchor;
  if (anchor === void 0) {
    if (id2 !== void 0) assignProperty(out, targetKey, id2);
    return;
  }
  if (typeof anchor !== "string" || !ANCHOR_REGEXP.test(anchor)) {
    unsupported("$anchor", dialect, "the anchor is not valid");
  }
  if (!LEGACY_ID_FRAGMENT_REGEXP.test(anchor)) {
    unsupported("$anchor", dialect, "the anchor cannot be represented as a plain-name fragment identifier");
  }
  if (id2 === void 0) {
    assignProperty(out, targetKey, `#${anchor}`);
  } else {
    unsupported("$anchor", dialect, "it cannot be combined with the schema $id");
  }
}

// node_modules/effect/dist/internal/schema/toCodec.js
function toCodecJson(schema) {
  return make16(toCodecJsonAST(schema.ast), {
    schema
  });
}
var toCodecJsonAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const owner = getContextOwner(ast);
  if (owner !== ast) {
    const fromOwner = toCodecJsonAST(owner);
    if (fromOwner === owner) return ast;
    if (fromOwner.encoding === void 0) return replaceContext(fromOwner, ast.context);
  }
  const out = toCodecJsonASTStep(ast, toCodecJsonAST);
  const context3 = ast.context;
  if (out === ast || context3 === void 0) return out;
  return replaceContextLastLink(out, withoutConstructorDefault(context3));
});
function withoutConstructorDefault(context3) {
  return context3.constructorDefault === void 0 ? context3 : new Context(context3.isOptional, context3.isMutable, void 0, context3.annotations);
}
function validateCanonicalObjectPropertyNames(ast) {
  if (ast.propertySignatures.some((ps) => typeof ps.name !== "string")) {
    throw new globalThis.Error("Objects property names must be strings", {
      cause: ast
    });
  }
}
function makeReorder(getPriority) {
  return (types) => {
    const sortedTypes = [...types].sort((a, b) => getPriority(toEncoded(a)) - getPriority(toEncoded(b)));
    const orderChanged = sortedTypes.some((ast, index2) => ast !== types[index2]);
    if (!orderChanged) return types;
    return sortedTypes;
  };
}
var toCodecJsonReorder = /* @__PURE__ */ makeReorder((ast) => {
  switch (ast._tag) {
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol":
      return 0;
    default:
      return 1;
  }
});
function toCodecJsonASTStep(ast, recur2) {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.toCodecJson ?? ast.annotations?.toCodec;
      if (!isFunction(getLink)) {
        return replaceEncoding(ast, [unknownToJson]);
      }
      const typeParameters = ast.typeParameters.map((tp) => make16(toEncoded(tp)));
      const link2 = getLink(typeParameters);
      return link2 === void 0 ? ast : replaceEncoding(ast, [mapLink(link2, recur2)]);
    }
    case "Unknown":
      return replaceEncoding(ast, [unknownToJson]);
    case "ObjectKeyword":
      return replaceEncoding(ast, [objectKeywordToJson]);
    case "Undefined":
    case "Void":
    case "Literal":
    case "Number":
      return ast.toCodecJson();
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Objects": {
      validateCanonicalObjectPropertyNames(ast);
      return ast.recur(recur2, parameterFromString);
    }
    case "Union": {
      const sortedTypes = toCodecJsonReorder(ast.types);
      if (sortedTypes !== ast.types) {
        return new Union(sortedTypes, ast.options, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur2);
      }
      return ast.recur(recur2);
    }
    case "Arrays":
    case "Suspend":
      return ast.recur(recur2);
  }
  return ast;
}
function toCodecIso(schema) {
  return make16(toCodecIsoAST(toType(schema.ast)));
}
var toCodecIsoAST = /* @__PURE__ */ memoize((ast) => {
  const out = toCodecIsoASTStep(ast, toCodecIsoAST);
  return out !== ast && ast.context !== void 0 ? replaceContextLastLink(out, withoutConstructorDefault(ast.context)) : out;
});
function toCodecIsoASTStep(ast, recur2) {
  switch (ast._tag) {
    case "Declaration": {
      const getLink = ast.annotations?.toCodecIso ?? ast.annotations?.toCodec;
      if (isFunction(getLink)) {
        const link2 = getLink(ast.typeParameters.map((tp) => make16(tp)));
        return replaceEncoding(ast, [mapLink(link2, recur2)]);
      }
      return ast;
    }
    case "Arrays":
    case "Objects":
    case "Union":
    case "Suspend":
      return ast.recur(recur2);
  }
  return ast;
}
function toCodecStringTree(schema) {
  return make16(toCodecStringTreeAST(schema.ast), {
    schema
  });
}
function toCodecArrayFromSingle(schema) {
  return make16(toCodecArrayFromSingleAST(schema.ast));
}
var toStringTreeReorder = /* @__PURE__ */ makeReorder((ast) => {
  switch (ast._tag) {
    case "Null":
    case "Boolean":
    case "Number":
    case "BigInt":
    case "Symbol":
    case "UniqueSymbol":
      return 0;
    default:
      return 1;
  }
});
function toCodecStringTreeASTStep(ast, recur2, onMissingAnnotation) {
  switch (ast._tag) {
    case "Declaration": {
      const typeParameters = ast.typeParameters.map((tp) => make16(recur2(toEncoded(tp))));
      const getStringTreeLink = ast.annotations?.toCodecStringTree;
      if (isFunction(getStringTreeLink)) {
        const link3 = getStringTreeLink(typeParameters);
        if (link3 === void 0) return ast;
        return replaceEncoding(ast, [mapLink(link3, recur2)]);
      }
      const getJsonLink = ast.annotations?.toCodecJson;
      const jsonLink = isFunction(getJsonLink) ? getJsonLink(typeParameters) : void 0;
      const getLink = jsonLink === void 0 ? ast.annotations?.toCodec : void 0;
      const link2 = jsonLink ?? (isFunction(getLink) ? getLink(typeParameters) : void 0);
      return link2 === void 0 ? onMissingAnnotation(ast) : replaceEncoding(ast, [mapLink(link2, recur2)]);
    }
    case "Null":
      return replaceEncoding(ast, [nullToString]);
    case "Boolean":
      return replaceEncoding(ast, [booleanToString]);
    case "Unknown":
    case "ObjectKeyword":
      return replaceEncoding(ast, [unknownToStringTree]);
    case "Enum":
    case "Number":
    case "Literal":
    case "UniqueSymbol":
    case "Symbol":
    case "BigInt":
      return ast.toCodecStringTree();
    case "Objects": {
      validateCanonicalObjectPropertyNames(ast);
      return ast.recur(recur2, parameterFromString);
    }
    case "Union": {
      const sortedTypes = toStringTreeReorder(ast.types);
      if (sortedTypes !== ast.types) {
        return new Union(sortedTypes, ast.options, ast.annotations, ast.checks, ast.encoding, ast.context, ast.encodingChecks).recur(recur2);
      }
      return ast.recur(recur2);
    }
    case "Arrays":
    case "Suspend":
      return ast.recur(recur2);
  }
  return ast;
}
var nullToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Literal("null"), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform(() => null), /* @__PURE__ */ transform(() => "null")));
var booleanToString = /* @__PURE__ */ new Link(/* @__PURE__ */ new Union([/* @__PURE__ */ new Literal("true"), /* @__PURE__ */ new Literal("false")]), /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((s) => s === "true"), /* @__PURE__ */ String4()));
var arrayFromSingleTransformation = /* @__PURE__ */ new Transformation(/* @__PURE__ */ transform((input) => typeof input === "string" ? [input] : input), /* @__PURE__ */ passthrough2());
var isCodecArrayFromSingleLink = (link2) => link2.transformation === arrayFromSingleTransformation;
var toCodecStringTreeAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const out = toCodecStringTreeASTStep(ast, toCodecStringTreeAST, (ast2) => {
    throw new globalThis.Error("Missing structural codec for StringTree", {
      cause: ast2
    });
  });
  if (out !== ast && ast.context !== void 0) {
    return replaceContextLastLink(out, withoutConstructorDefault(ast.context));
  }
  return out;
}, {
  stopAt: isCodecArrayFromSingleLink
});
var toArrayFromSingleInputElement = (ast) => isOptional(ast) ? optionalKey(unknown) : unknown;
var toCodecArrayFromSingleAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  const out = toCodecArrayFromSingleASTStep(ast);
  if (isArrays(out)) {
    const ensure = decodeTo(new Union([new Arrays(out.isMutable, out.elements.map(toArrayFromSingleInputElement), out.rest.map(toArrayFromSingleInputElement)), string2], {
      mode: "anyOf"
    }), out, arrayFromSingleTransformation);
    return isOptional(ast) ? optionalKey(ensure) : ensure;
  }
  return out;
}, {
  stopAt: isCodecArrayFromSingleLink
});
function toCodecGoJson(schema) {
  return make16(toCodecGoJsonAST(schema.ast), {
    schema
  });
}
var toCodecGoJsonAST = /* @__PURE__ */ memoizeIdempotent((ast) => nilAsEmptyAtEncoded(goNilAST(toCodecJsonAST(ast))));
var goNilAST = /* @__PURE__ */ applyToSelfOrLastLinkEncodingIdempotent((ast) => {
  switch (ast._tag) {
    case "Objects":
      return ast.recur((type) => nilAsMissingOrEmptyAtEncoded(goNilAST(type)), identity);
    case "Arrays":
      return ast.recur((type) => nilAsEmptyAtEncoded(goNilAST(type)));
    case "Declaration":
    case "Union":
    case "Suspend":
      return ast.recur(goNilAST);
  }
  return ast;
});
var nilAsMissingOrEmptyAtEncoded = /* @__PURE__ */ applyToSelfOrLastLinkEncoding((ast) => isOptional(ast) ? nilAsMissingAtEncoded(ast) : nilAsEmptyAtEncoded(ast));
var nilAsMissingAtEncoded = /* @__PURE__ */ applyToSelfOrLastLinkEncoding((ast) => {
  if (isSuspend(ast)) return ast.recur(nilAsMissingAtEncoded);
  if (isGoNil(ast) || acceptsNull(ast)) return ast;
  return orNull(ast, decodeNull(never3, nullAsMissing));
});
var nilAsEmptyAtEncoded = /* @__PURE__ */ applyToSelfOrLastLinkEncoding((ast) => {
  if (isSuspend(ast)) return ast.recur(nilAsEmptyAtEncoded);
  if (isArrays(ast) && ast.elements.length === 0 && ast.rest.length === 1) {
    return orNull(ast, decodeNull(replaceChecks(emptyArray2, ast.checks), nullAsEmptyArray));
  }
  if (isObjects(ast) && ast.propertySignatures.length === 0 && ast.indexSignatures.length > 0) {
    return orNull(ast, decodeNull(replaceChecks(emptyRecord, ast.checks), nullAsEmptyRecord));
  }
  return ast;
});
function acceptsNull(ast) {
  const encoded = getLastEncoding(ast);
  switch (encoded._tag) {
    case "Union":
      return encoded.checks === void 0 && encoded.types.some(acceptsNull);
    case "Null":
    case "Unknown":
    case "Any":
    case "Declaration":
      return is(make16(replaceContext(encoded, void 0)))(null);
  }
  return false;
}
function orNull(ast, member) {
  return replaceContext(new Union([replaceContext(ast, void 0), member]), ast.context);
}
var nullTo = (decode5) => new Transformation(decode5, forbidden(() => "Go nil values are never encoded"));
var nullAsMissing = /* @__PURE__ */ nullTo(/* @__PURE__ */ transformOptional(() => none2()));
var nullAsEmptyArray = /* @__PURE__ */ nullTo(/* @__PURE__ */ transform(() => []));
var nullAsEmptyRecord = /* @__PURE__ */ nullTo(/* @__PURE__ */ transform(() => ({})));
var emptyArray2 = /* @__PURE__ */ new Arrays(false, [], []);
var emptyRecord = /* @__PURE__ */ record(string2, never3);
function decodeNull(to, transformation) {
  return decodeTo(null_, to, transformation);
}
function isGoNil(ast) {
  if (!isUnion(ast)) return false;
  const transformation = ast.types[ast.types.length - 1].encoding?.[0].transformation;
  return transformation === nullAsMissing || transformation === nullAsEmptyArray || transformation === nullAsEmptyRecord;
}
function toCodecArrayFromSingleASTStep(ast) {
  return ast._tag === "Declaration" || ast._tag === "Arrays" || ast._tag === "Objects" || ast._tag === "Union" || ast._tag === "Suspend" ? ast.recur(toCodecArrayFromSingleAST) : ast;
}

// node_modules/effect/dist/RegExp.js
var RegExp2 = globalThis.RegExp;
var escape = (string3) => string3.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");

// node_modules/effect/dist/internal/errors.js
function errorWithPath(message, path) {
  if (path.length > 0) {
    message += `
  at ${formatPath(path)}`;
  }
  return new Error(message);
}

// node_modules/effect/dist/internal/schema/toJsonSchemaDocument.js
function formatDefinitionReference(key) {
  return `#/$defs/${formatUriFragmentToken(key)}`;
}
var jsonSchemaAnnotationExcludedKeys = /* @__PURE__ */ new Set([...annotationExcludedKeys, IDENTIFIER_FALLBACK_KEY, ...jsonSchemaAnnotationKeys]);
function collectJsonSchemaAnnotations(annotations, options) {
  if (annotations === void 0) return void 0;
  const out = {};
  for (const key of ["title", "description", "format", "contentEncoding", "contentMediaType"]) {
    const value3 = annotations[key];
    if (typeof value3 === "string") out[key] = value3;
  }
  for (const key of ["readOnly", "writeOnly"]) {
    const value3 = annotations[key];
    if (typeof value3 === "boolean") out[key] = value3;
  }
  const expected = annotations.expected;
  if (out.description === void 0 && options?.generateDescriptions === true && typeof expected === "string") {
    out.description = expected;
  }
  const defaultValue = annotations.default;
  if (isJson(defaultValue)) out.default = defaultValue;
  const examples = annotations.examples;
  if (Array.isArray(examples) && isJson(examples)) out.examples = examples;
  const contentSchema = annotations.contentSchema;
  if (isJson(contentSchema)) out.contentSchema = contentSchema;
  if (options?.includeAnnotationKey !== void 0) {
    for (const [key, value3] of Object.entries(annotations)) {
      if (jsonSchemaAnnotationExcludedKeys.has(key) || !options.includeAnnotationKey(key)) {
        continue;
      }
      if (isJson(value3)) assignProperty(out, key, value3);
    }
  }
  return Object.keys(out).length === 0 ? void 0 : out;
}
function extractJsonSchemaNumberType(schema) {
  let type = schema.type === "number" || schema.type === "integer" ? schema.type : void 0;
  let out = schema;
  if (type !== void 0) {
    out = {
      ...schema
    };
    delete out.type;
  }
  if (Array.isArray(out.allOf)) {
    const members = [];
    let changed = false;
    for (const member of out.allOf) {
      const extracted = extractJsonSchemaNumberType(member);
      if (extracted.type !== void 0) {
        changed = true;
        if (type === void 0 || extracted.type === "integer") type = extracted.type;
      }
      if (Object.keys(extracted.schema).length > 0) members.push(extracted.schema);
    }
    if (changed) {
      const {
        allOf: _,
        ...rest
      } = out;
      out = members.length === 0 ? rest : {
        ...rest,
        allOf: members
      };
    }
  }
  return {
    type,
    schema: out
  };
}
function isJsonSchemaNumberEncoding(schema) {
  if (!Array.isArray(schema.anyOf) || schema.anyOf.length !== 2 || schema.anyOf[0]?.type !== "number") return false;
  const special = schema.anyOf[1];
  return special?.type === "string" && Array.isArray(special.enum) && special.enum.length === 3 && special.enum.includes("NaN") && special.enum.includes("Infinity") && special.enum.includes("-Infinity");
}
var inlineableCheckKeywords = "|type|format|pattern|multipleOf|minimum|maximum|exclusiveMinimum|exclusiveMaximum|minLength|maxLength|minItems|maxItems|uniqueItems|minProperties|maxProperties|propertyNames|";
function hasOnlyKeywords(schema, allowed) {
  return Object.keys(schema).every((key) => allowed.includes(`|${key}|`));
}
function hasNoCollisions(left, rightKeys) {
  return typeof left.$ref !== "string" && rightKeys.every((key) => !Object.hasOwn(left, key));
}
var lowerBoundKeywords = "|minimum|exclusiveMinimum|minLength|minItems|minProperties|";
var upperBoundKeywords = "|maximum|exclusiveMaximum|maxLength|maxItems|maxProperties|";
function mergeInlineCheck(left, right, rightKeys) {
  if (typeof left.$ref === "string") return void 0;
  const out = {
    ...left,
    ...right
  };
  for (const key of rightKeys) {
    if (!Object.hasOwn(left, key)) continue;
    const a = left[key];
    const b = right[key];
    if (typeof a !== "number" || typeof b !== "number") return void 0;
    if (lowerBoundKeywords.includes(`|${key}|`)) out[key] = Math.max(a, b);
    else if (upperBoundKeywords.includes(`|${key}|`)) out[key] = Math.min(a, b);
    else return void 0;
  }
  if (typeof out.minimum === "number" && typeof out.exclusiveMinimum === "number") {
    delete out[out.exclusiveMinimum >= out.minimum ? "minimum" : "exclusiveMinimum"];
  }
  if (typeof out.maximum === "number" && typeof out.exclusiveMaximum === "number") {
    delete out[out.exclusiveMaximum <= out.maximum ? "maximum" : "exclusiveMaximum"];
  }
  return out;
}
var promotableAnnotationKeywords = "|title|description|default|examples|readOnly|writeOnly|";
var inlineableAnnotatedCheckKeywords = inlineableCheckKeywords + promotableAnnotationKeywords;
function appendJsonSchema(left, right, inlineCheck) {
  if (Object.keys(left).length === 0) return right;
  const rightKeys = Object.keys(right);
  if (rightKeys.length === 0) return left;
  const leftType = left.type === "number" || left.type === "integer" ? left.type : void 0;
  const isNumberEncoding = isJsonSchemaNumberEncoding(left);
  if (leftType !== void 0 || isNumberEncoding) {
    const extracted = extractJsonSchemaNumberType(right);
    if (extracted.type !== void 0) {
      const type = leftType === "integer" || extracted.type === "integer" ? "integer" : "number";
      const base = {
        ...left,
        type
      };
      if (isNumberEncoding) delete base.anyOf;
      const extractedKeys = Object.keys(extracted.schema);
      if (extractedKeys.length === 0) return base;
      return hasOnlyKeywords(extracted.schema, promotableAnnotationKeywords) && hasNoCollisions(base, extractedKeys) ? {
        ...base,
        ...extracted.schema
      } : appendJsonSchema(base, extracted.schema, inlineCheck);
    }
  }
  if (inlineCheck) {
    const merged = mergeInlineCheck(left, right, rightKeys);
    if (merged !== void 0) return merged;
  }
  const members = Array.isArray(right.allOf) && rightKeys.length === 1 ? right.allOf : [right];
  if (Array.isArray(left.allOf)) {
    return {
      ...left,
      allOf: [...left.allOf, ...members]
    };
  }
  if (typeof left.$ref === "string") {
    return {
      allOf: [left, ...members]
    };
  }
  return {
    ...left,
    allOf: members
  };
}
function isExact(exactness, seen = /* @__PURE__ */ new Set()) {
  if (typeof exactness === "boolean") return exactness;
  if (seen.has(exactness)) return true;
  seen.add(exactness);
  return exactness.every((dependency) => isExact(dependency, seen));
}
function isApproximateCheckOutput(output) {
  return Array.isArray(output);
}
function compileJsonSchema(representations, rootPaths, references, options) {
  const compiledDefinitions = /* @__PURE__ */ new Map();
  const definitionAliases = /* @__PURE__ */ new Map();
  const compiledRepresentations = /* @__PURE__ */ new WeakMap();
  const pendingOneOf = /* @__PURE__ */ new Map();
  const fallbackDefinitions = /* @__PURE__ */ new Map();
  const referenceKeys = Object.keys(references);
  for (const key of referenceKeys) {
    compileDefinition(key, ["references", key]);
  }
  const compiledSchemas = map4(representations, (representation, index2) => recur2(representation, rootPaths[index2], []));
  for (const [branches, schemas2] of pendingOneOf.values()) {
    if (!isExact(branches)) {
      for (const schema of schemas2) {
        if (Array.isArray(schema.oneOf)) {
          schema.anyOf = schema.oneOf;
          delete schema.oneOf;
        }
      }
    }
  }
  for (const key of referenceKeys) {
    const representation = references[key];
    const fallback = getIdentifierFallback(representation);
    if (fallback === void 0) continue;
    const schema = compiledDefinitions.get(key)[0];
    const candidates = fallbackDefinitions.get(fallback);
    const match7 = candidates?.find((candidate) => equals(compiledDefinitions.get(candidate)[0], schema));
    if (match7 === void 0) {
      if (candidates === void 0) fallbackDefinitions.set(fallback, [key]);
      else candidates.push(key);
    } else {
      definitionAliases.set(key, match7);
    }
  }
  const schemas = map4(compiledSchemas, finalizeJsonSchema);
  const definitions = {};
  for (const key of referenceKeys) {
    if (!definitionAliases.has(key)) {
      assignProperty(definitions, key, finalizeJsonSchema(compiledDefinitions.get(key)[0]));
    }
  }
  return {
    dialect: "draft-2020-12",
    schemas,
    definitions
  };
  function registerPendingOneOf(schema) {
    if (Array.isArray(schema.oneOf)) pendingOneOf.get(schema.oneOf)?.[1].push(schema);
    return schema;
  }
  function compileDefinition(key, path) {
    if (!Object.hasOwn(references, key)) {
      throw errorWithPath(`Invalid reference ${key}`, [...path, "$ref"]);
    }
    const cached3 = compiledDefinitions.get(key);
    if (cached3 !== void 0) return cached3;
    const result3 = [{}, []];
    compiledDefinitions.set(key, result3);
    result3[0] = recur2(references[key], ["references", key], result3[1]);
    return result3;
  }
  function finalizeJsonSchema(schema) {
    return rewriteRefs(schema, ($ref) => {
      const pointer = decodeUriFragment($ref);
      if (pointer === void 0) {
        if (/^#(?:\/|%2f)/i.test($ref)) {
          throw new Error(`Invalid JSON Pointer URI fragment ${JSON.stringify($ref)}`);
        }
        return $ref;
      }
      if (!pointer.startsWith("/$defs/")) return $ref;
      const separator = pointer.indexOf("/", 7);
      const canonical = definitionAliases.get(unescapeToken(pointer.slice(7, separator < 0 ? void 0 : separator)));
      if (canonical === void 0) return $ref;
      return $ref.replace(/^#(?:\/|%2f).*?(?:\/|%2f).*?(?=\/|%2f|$)/i, formatDefinitionReference(canonical));
    });
  }
  function getIdentifierFallback(representation) {
    if (representation._tag === "Reference") return void 0;
    const annotations = representation.checks.length === 0 ? representation.annotations : representation.checks[representation.checks.length - 1].annotations;
    return typeof annotations?.identifier !== "string" && typeof annotations?.[IDENTIFIER_FALLBACK_KEY] === "string" ? annotations[IDENTIFIER_FALLBACK_KEY] : void 0;
  }
  function compileCheck(check2, type, path, dependencies) {
    const annotations = check2.annotations;
    const callback3 = annotations?.toJsonSchema;
    if (callback3 !== void 0) {
      const schemas3 = check2.representation?.schemas?.map((schema3, index2) => recur2(schema3, [...path, "representation", "schemas", index2], dependencies)) ?? [];
      const result3 = callback3({
        type,
        schemas: schemas3
      });
      const approximate = isApproximateCheckOutput(result3);
      if (approximate) {
        dependencies.push(false);
      }
      const fragment = approximate ? result3[0] : result3;
      const ordinary2 = collectJsonSchemaAnnotations(annotations, options);
      const schema2 = ordinary2 === void 0 ? fragment : {
        ...fragment,
        ...ordinary2
      };
      const allowed = ordinary2 === void 0 ? inlineableCheckKeywords : inlineableAnnotatedCheckKeywords;
      return [schema2, check2._tag === "Filter" && hasOnlyKeywords(schema2, allowed) && (ordinary2 === void 0 || hasOnlyKeywords(ordinary2, promotableAnnotationKeywords)) ? true : void 0];
    }
    if (check2._tag === "Filter") {
      dependencies.push(false);
      return void 0;
    }
    const schemas2 = check2.checks.flatMap((child, index2) => {
      const result3 = compileCheck(child, type, [...path, "checks", index2], dependencies);
      return result3 === void 0 ? [] : [result3[0]];
    });
    if (schemas2.length === 0) return void 0;
    const ordinary = collectJsonSchemaAnnotations(annotations, options);
    const schema = {
      allOf: schemas2
    };
    return [ordinary === void 0 ? schema : {
      ...schema,
      ...ordinary
    }];
  }
  function recur2(representation, path, dependencies) {
    if (representation._tag === "Reference") {
      dependencies.push(compileDefinition(representation.$ref, path)[1]);
      return {
        $ref: formatDefinitionReference(representation.$ref)
      };
    }
    const cached3 = compiledRepresentations.get(representation);
    if (cached3 !== void 0) {
      dependencies.push(cached3[1]);
      return cached3[0];
    }
    const local = [];
    dependencies.push(local);
    let output = on(representation, path, local);
    const ordinary = collectJsonSchemaAnnotations(representation.annotations, options);
    if (ordinary !== void 0) {
      output = {
        ...output,
        ...ordinary
      };
    }
    for (let index2 = 0; index2 < representation.checks.length; index2++) {
      const type = typeof output.type === "string" && isJsonSchemaType(output.type) ? output.type : void 0;
      const check2 = compileCheck(representation.checks[index2], type, [...path, "checks", index2], local);
      if (check2 !== void 0) output = appendJsonSchema(output, ...check2);
    }
    compiledRepresentations.set(representation, [output, local]);
    return registerPendingOneOf(output);
  }
  function on(representation, path, dependencies) {
    switch (representation._tag) {
      case "Any":
      case "Unknown":
        return {};
      case "ObjectKeyword":
        return {
          anyOf: [{
            type: "object"
          }, {
            type: "array"
          }]
        };
      case "Void":
      case "Undefined":
      case "Null":
        return {
          type: "null"
        };
      case "BigInt":
        return {
          type: "string",
          allOf: [{
            pattern: "^-?\\d+$"
          }]
        };
      case "Symbol":
        return {
          type: "string",
          allOf: [{
            pattern: "^Symbol\\(([\\s\\S]*)\\)$"
          }]
        };
      case "UniqueSymbol":
        return globalThis.Symbol.keyFor(representation.symbol) === void 0 ? {
          not: {}
        } : {
          type: "string",
          enum: [globalThis.String(representation.symbol)]
        };
      case "Declaration":
        dependencies.push(false);
        return {};
      case "Suspend":
        return recur2(representation.thunk, [...path, "thunk"], dependencies);
      case "Never":
        return {
          not: {}
        };
      case "String":
        return {
          type: "string"
        };
      case "Number":
        return {
          anyOf: [{
            type: "number"
          }, {
            type: "string",
            enum: ["NaN", "Infinity", "-Infinity"]
          }]
        };
      case "Boolean":
        return {
          type: "boolean"
        };
      case "Literal": {
        const literal = representation.literal;
        return typeof literal === "bigint" ? {
          type: "string",
          enum: [globalThis.String(literal)]
        } : {
          type: typeof literal,
          enum: [literal]
        };
      }
      case "Enum": {
        const types = representation.enums.map(([title, literal]) => ({
          type: typeof literal,
          enum: [literal],
          title
        }));
        return types.length === 0 ? {
          not: {}
        } : {
          anyOf: types
        };
      }
      case "TemplateLiteral":
        return {
          type: "string",
          pattern: `^${representation.parts.map(getPartPattern).join("")}$`
        };
      case "Arrays": {
        const out = {
          type: "array"
        };
        let minItems = representation.elements.length;
        const prefixItems = representation.elements.map((element, index2) => {
          if (element.isOptional) minItems--;
          const schema = recur2(element.type, [...path, "elements", index2, "type"], dependencies);
          const annotations = collectJsonSchemaAnnotations(element.annotations, options);
          return annotations === void 0 ? schema : registerPendingOneOf(appendJsonSchema(schema, annotations));
        });
        if (prefixItems.length > 0) {
          out.prefixItems = prefixItems;
          out.maxItems = representation.elements.length;
          if (minItems > 0) out.minItems = minItems;
        } else {
          out.items = false;
        }
        if (representation.rest.length === 1) {
          delete out.maxItems;
          const rest = recur2(representation.rest[0], [...path, "rest", 0], dependencies);
          if (Object.keys(rest).length > 0) out.items = rest;
          else delete out.items;
        } else if (representation.rest.length > 1) {
          delete out.maxItems;
          delete out.items;
          out.minItems = minItems + representation.rest.length - 1;
          dependencies.push(false);
        }
        return out;
      }
      case "Objects": {
        if (representation.propertySignatures.length === 0 && representation.indexSignatures.length === 0) {
          return {
            not: {
              type: "null"
            }
          };
        }
        const out = {
          type: "object"
        };
        const properties = {};
        const required2 = [];
        for (let index2 = 0; index2 < representation.propertySignatures.length; index2++) {
          const property = representation.propertySignatures[index2];
          if (typeof property.name !== "string") {
            throw errorWithPath("Objects property names must be strings", [...path, "propertySignatures", index2, "name"]);
          }
          const name = property.name;
          const schema = recur2(property.type, [...path, "propertySignatures", index2, "type"], dependencies);
          const annotations = collectJsonSchemaAnnotations(property.annotations, options);
          assignProperty(properties, name, annotations === void 0 ? schema : registerPendingOneOf(appendJsonSchema(schema, annotations)));
          if (!property.isOptional) required2.push(name);
        }
        if (representation.propertySignatures.length > 0) out.properties = properties;
        if (required2.length > 0) out.required = required2;
        const patternProperties = {};
        const additionalPropertySchemas = [];
        const indexValueSchemas = [];
        let hasUnrepresentableIndexPattern = false;
        for (let index2 = 0; index2 < representation.indexSignatures.length; index2++) {
          const signature = representation.indexSignatures[index2];
          let type = recur2(signature.type, [...path, "indexSignatures", index2, "type"], dependencies);
          if (equals(type, {
            not: {}
          })) type = false;
          indexValueSchemas.push(type);
          const patterns = getParameterPatterns(signature.parameter, [...path, "indexSignatures", index2, "parameter"], /* @__PURE__ */ new Set());
          if (patterns === void 0) {
            hasUnrepresentableIndexPattern = true;
            dependencies.push(false);
            continue;
          }
          if (patterns.length === 0) {
            additionalPropertySchemas.push(type);
          } else {
            for (const pattern of patterns) {
              const previous = patternProperties[pattern];
              assignProperty(patternProperties, pattern, previous === void 0 ? type : previous === false || type === false ? false : registerPendingOneOf(appendJsonSchema(previous, type)));
            }
          }
        }
        const hasPatternProperties = Object.keys(patternProperties).length > 0;
        if (hasPatternProperties) {
          out.patternProperties = patternProperties;
        }
        if (hasUnrepresentableIndexPattern && options?.onExcessProperty === "error") {
          const propertyNames = [];
          if (representation.propertySignatures.length > 0) {
            propertyNames.push({
              enum: Object.keys(properties)
            });
          }
          for (let index2 = 0; index2 < representation.indexSignatures.length; index2++) {
            propertyNames.push(getPropertyNameSchema(representation.indexSignatures[index2].parameter, [...path, "indexSignatures", index2, "parameter"], dependencies, /* @__PURE__ */ new Set()));
          }
          out.propertyNames = propertyNames.length === 1 ? propertyNames[0] : {
            anyOf: propertyNames
          };
          out.additionalProperties = indexValueSchemas.length === 1 ? indexValueSchemas[0] : {
            anyOf: indexValueSchemas
          };
          if (additionalPropertySchemas.length > 0) {
            out.allOf = additionalPropertySchemas.map((type) => ({
              type: "object",
              additionalProperties: type
            }));
          }
        } else if (additionalPropertySchemas.length === 0) {
          out.additionalProperties = hasUnrepresentableIndexPattern || options?.onExcessProperty !== "error";
        } else if (additionalPropertySchemas.length === 1 && representation.propertySignatures.length === 0 && !hasPatternProperties) {
          out.additionalProperties = additionalPropertySchemas[0];
        } else if (additionalPropertySchemas.length > 0) {
          out.allOf = additionalPropertySchemas.map((type) => ({
            type: "object",
            additionalProperties: type
          }));
        }
        if (typeof out.additionalProperties === "object" && out.additionalProperties !== null && Object.keys(out.additionalProperties).length === 0) {
          delete out.additionalProperties;
        }
        return out;
      }
      case "Union": {
        const branches = [];
        const types = representation.types.map((type, index2) => recur2(type, [...path, "types", index2], branches));
        dependencies.push(branches);
        if (types.length === 0) return {
          not: {}
        };
        if (representation.options?.mode === "oneOf") {
          pendingOneOf.set(types, [branches, []]);
          return {
            oneOf: types
          };
        }
        if (types.length > 1) {
          const compacted = compactEnums(types);
          if (compacted !== void 0) return compacted;
        }
        return {
          anyOf: types.flatMap((type) => Array.isArray(type.anyOf) && Object.keys(type).length === 1 ? type.anyOf : [type])
        };
      }
    }
  }
  function getPropertyNameSchema(parameter, path, dependencies, seenReferences) {
    switch (parameter._tag) {
      case "Number":
        return {
          type: "string",
          pattern: `^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`
        };
      case "Reference": {
        if (seenReferences.has(parameter.$ref)) return {
          type: "string"
        };
        return getPropertyNameSchema(references[parameter.$ref], ["references", parameter.$ref], dependencies, new Set(seenReferences).add(parameter.$ref));
      }
      case "Union":
        return {
          anyOf: parameter.types.map((type) => getPropertyNameSchema(type, path, dependencies, seenReferences))
        };
      default:
        return recur2(parameter, path, dependencies);
    }
  }
  function getParameterPatterns(parameter, path, seenReferences) {
    switch (parameter._tag) {
      case "Reference": {
        compileDefinition(parameter.$ref, path);
        if (seenReferences.has(parameter.$ref)) return void 0;
        const next = new Set(seenReferences).add(parameter.$ref);
        return getParameterPatterns(references[parameter.$ref], ["references", parameter.$ref], next);
      }
      case "String": {
        if (parameter.checks.length === 0) return [];
        if (parameter.checks.length !== 1 || parameter.checks[0]._tag !== "Filter" || parameter.checks[0].annotations?.toJsonSchema === void 0) {
          return void 0;
        }
        const dependencies = [];
        const schema = recur2(parameter, path, dependencies);
        if (!isExact(dependencies)) return void 0;
        return schema.type === "string" && typeof schema.pattern === "string" && hasOnlyKeywords(schema, "|type|pattern|title|description|default|examples|readOnly|writeOnly|") ? [schema.pattern] : void 0;
      }
      case "TemplateLiteral":
        return parameter.checks.length === 0 ? [`^${parameter.parts.map(getPartPattern).join("")}$`] : void 0;
      case "Union": {
        if (parameter.types.length === 0 || parameter.checks.length > 0 || parameter.options?.mode === "oneOf") {
          return void 0;
        }
        const patterns = [];
        for (let index2 = 0; index2 < parameter.types.length; index2++) {
          const memberPatterns = getParameterPatterns(parameter.types[index2], [...path, "types", index2], seenReferences);
          if (memberPatterns === void 0) return void 0;
          if (memberPatterns.length === 0) return [];
          patterns.push(...memberPatterns);
        }
        return patterns;
      }
      case "Number":
        return parameter.checks.length === 0 ? [`^(?:${FINITE_PATTERN}|Infinity|-Infinity|NaN)$`] : void 0;
      default:
        throw errorWithPath(`Invalid index signature parameter ${parameter._tag}`, path);
    }
  }
}
function isJsonSchemaType(input) {
  return input === "string" || input === "number" || input === "boolean" || input === "array" || input === "object" || input === "null" || input === "integer";
}
function compactEnums(schemas) {
  let sharedType = void 0;
  const values2 = [];
  for (const schema of schemas) {
    const keys3 = Object.keys(schema);
    if (keys3.length !== 2 || schema.type === void 0 || !Array.isArray(schema.enum) || schema.enum.length === 0) {
      return void 0;
    }
    if (sharedType === void 0) sharedType = schema.type;
    else if (schema.type !== sharedType) return void 0;
    for (const value3 of schema.enum) {
      if (values2.includes(value3)) return void 0;
      values2.push(value3);
    }
  }
  return {
    type: sharedType,
    enum: values2
  };
}
function getPartPattern(part) {
  switch (part._tag) {
    case "Literal":
      return escape(globalThis.String(part.literal));
    case "String":
      return STRING_PATTERN;
    case "Number":
      return FINITE_PATTERN;
    case "BigInt":
      return "-?\\d+";
    case "TemplateLiteral":
      return part.parts.map(getPartPattern).join("");
    case "Union":
      return `(?:${part.types.map(getPartPattern).join("|")})`;
    default:
      throw errorWithPath(`Invalid TemplateLiteral part ${part._tag}`, []);
  }
}
function toJsonSchemaDocument(document, options) {
  const output = compileJsonSchema([document.representation], [["representation"]], document.references, options);
  return {
    dialect: output.dialect,
    schema: output.schemas[0],
    definitions: output.definitions
  };
}

// node_modules/effect/dist/internal/schema/toRepresentation.js
var defaultReferencePolicy = ({
  identifier: identifier2
}) => identifier2;
function annotationsField(annotations) {
  return annotations === void 0 ? void 0 : {
    annotations
  };
}
function toRepresentation(ast, options) {
  const {
    references,
    representations
  } = toRepresentations([ast], options);
  return {
    representation: representations[0],
    references
  };
}
function toRepresentations(asts, options) {
  const references = {};
  const referenceOwners = /* @__PURE__ */ new Map();
  const buildingReferences = /* @__PURE__ */ new Set();
  const candidates = /* @__PURE__ */ new Map();
  const visitingCandidates = /* @__PURE__ */ new Set();
  for (const ast of asts) visit(ast);
  const referencePolicy = options?.referencePolicy ?? defaultReferencePolicy;
  for (const candidatesByIdentifier of candidates.values()) {
    for (const candidate of candidatesByIdentifier.values()) {
      const requestedReference = referencePolicy({
        ast: candidate.ast,
        occurrences: candidate.occurrences,
        identifier: candidate.identifier
      });
      if (requestedReference !== void 0) {
        const separator = requestedReference === candidate.identifier || !requestedReference.endsWith("_") ? "_" : "";
        candidate.reference = getReference(requestedReference, candidate, separator);
      } else if (candidate.isRecursive) {
        candidate.reference = getReference(`${candidate.ast._tag}_`, candidate, "");
      }
    }
  }
  const representations = map4(asts, (ast) => recur2(ast));
  return {
    representations,
    references
  };
  function getReference(prefix, owner, separator = "_") {
    let candidate = prefix;
    let suffix = 0;
    while (referenceOwners.has(candidate)) {
      if (referenceOwners.get(candidate) === owner) return candidate;
      candidate = `${prefix}${separator}${++suffix}`;
    }
    referenceOwners.set(candidate, owner);
    return candidate;
  }
  function annotateReference(ast, candidate, reference) {
    const fallback = candidate.fallback;
    if (fallback !== void 0) {
      return resolveIdentifierFallback(ast) === fallback ? ast : annotate(ast, {
        [IDENTIFIER_FALLBACK_KEY]: fallback
      });
    }
    return reference === candidate.identifier ? ast : annotate(ast, {
      identifier: reference
    });
  }
  function makeReference(reference, ast) {
    if (!Object.hasOwn(references, reference) && !buildingReferences.has(reference)) {
      buildingReferences.add(reference);
      const representation = on(ast);
      buildingReferences.delete(reference);
      assignProperty(references, reference, representation);
    }
    return {
      _tag: "Reference",
      $ref: reference
    };
  }
  function getCandidate(input) {
    const ast = getLastEncoding(input);
    const owner = getContextOwner(ast);
    let identifier2 = resolveIdentifier(ast);
    const fallback = identifier2 === void 0 ? (ast !== input ? resolveIdentifier(input) : void 0) ?? resolveIdentifierFallback(ast) : void 0;
    if (fallback !== void 0) identifier2 = `${fallback}Encoded`;
    let candidatesByIdentifier = candidates.get(owner);
    if (candidatesByIdentifier === void 0) {
      candidatesByIdentifier = /* @__PURE__ */ new Map();
      candidates.set(owner, candidatesByIdentifier);
    }
    let candidate = candidatesByIdentifier.get(identifier2);
    if (candidate === void 0) {
      candidate = {
        ast: owner,
        identifier: identifier2,
        fallback,
        occurrences: 0,
        isRecursive: false,
        reference: void 0
      };
      candidatesByIdentifier.set(identifier2, candidate);
    }
    return candidate;
  }
  function visit(input) {
    const candidate = getCandidate(input);
    const ast = candidate.ast;
    candidate.occurrences++;
    if (visitingCandidates.has(candidate)) {
      candidate.isRecursive = true;
      return;
    }
    if (candidate.occurrences > 1) return;
    visitingCandidates.add(candidate);
    visitChecks(ast.checks);
    switch (ast._tag) {
      case "Declaration":
      case "Arrays":
      case "Objects":
      case "Union":
        ast.recur((child) => {
          visit(child);
          return child;
        });
        break;
      case "TemplateLiteral":
        ast.parts.forEach(visit);
        break;
      case "Suspend":
        visit(ast.thunk());
        break;
    }
    visitingCandidates.delete(candidate);
  }
  function visitChecks(checks) {
    checks?.forEach((check2) => {
      check2.annotations?.representation?.schemas?.forEach((schema) => visit(toType(schema)));
      if (check2._tag === "FilterGroup") visitChecks(check2.checks);
    });
  }
  function recur2(input) {
    const candidate = getCandidate(input);
    const ast = candidate.ast;
    const reference = candidate.reference;
    if (reference !== void 0) {
      const annotated = candidate.identifier === void 0 ? ast : annotateReference(ast, candidate, reference);
      return makeReference(reference, annotated);
    }
    return on(ast);
  }
  function on(ast) {
    const checks = fromChecks(ast.checks);
    switch (ast._tag) {
      case "Declaration":
        return {
          _tag: "Declaration",
          typeParameters: ast.typeParameters.map((ast2) => recur2(ast2)),
          checks,
          ...fromDeclarationAnnotations(ast.annotations)
        };
      case "Null":
      case "Undefined":
      case "Void":
      case "Never":
      case "Unknown":
      case "Any":
      case "String":
      case "Boolean":
      case "Number":
      case "BigInt":
      case "Symbol":
      case "ObjectKeyword":
        return {
          _tag: ast._tag,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Literal":
        return {
          _tag: "Literal",
          literal: ast.literal,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "UniqueSymbol":
        return {
          _tag: "UniqueSymbol",
          symbol: ast.symbol,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Enum":
        return {
          _tag: "Enum",
          enums: ast.enums,
          checks,
          ...annotationsField(ast.annotations)
        };
      case "TemplateLiteral":
        return {
          _tag: "TemplateLiteral",
          parts: ast.parts.map((ast2) => recur2(ast2)),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Arrays":
        return {
          _tag: "Arrays",
          elements: ast.elements.map((element) => {
            const projected = getLastEncoding(element);
            const annotations = projected.context?.annotations;
            return {
              isOptional: isOptional(projected),
              type: recur2(element),
              ...annotationsField(annotations)
            };
          }),
          rest: ast.rest.map((ast2) => recur2(ast2)),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Objects":
        return {
          _tag: "Objects",
          propertySignatures: ast.propertySignatures.map((property) => {
            const projected = getLastEncoding(property.type);
            const annotations = projected.context?.annotations;
            return {
              name: property.name,
              type: recur2(property.type),
              isOptional: isOptional(projected),
              isMutable: isMutable(projected),
              ...annotationsField(annotations)
            };
          }),
          indexSignatures: ast.indexSignatures.map((index2) => ({
            parameter: recur2(index2.parameter),
            type: recur2(index2.type)
          })),
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Union":
        return {
          _tag: "Union",
          types: ast.types.map((ast2) => recur2(ast2)),
          ...ast.options === void 0 ? {} : {
            options: ast.options
          },
          checks,
          ...annotationsField(ast.annotations)
        };
      case "Suspend":
        return {
          _tag: "Suspend",
          checks: [],
          thunk: recur2(ast.thunk()),
          ...annotationsField(ast.annotations)
        };
    }
  }
  function fromChecks(checks) {
    return checks?.map(fromCheck) ?? [];
  }
  function fromCheck(check2) {
    switch (check2._tag) {
      case "Filter":
        return {
          _tag: "Filter",
          aborted: check2.aborted,
          ...fromCheckAnnotations(check2.annotations)
        };
      case "FilterGroup":
        return {
          _tag: "FilterGroup",
          checks: map4(check2.checks, fromCheck),
          ...fromCheckAnnotations(check2.annotations)
        };
    }
  }
  function fromDeclarationAnnotations(annotations) {
    if (annotations === void 0) return void 0;
    const {
      representation,
      ...ordinary
    } = annotations;
    return {
      ...representation === void 0 ? void 0 : {
        representation
      },
      ...Object.keys(ordinary).length === 0 ? void 0 : {
        annotations: ordinary
      }
    };
  }
  function fromCheckAnnotations(annotations) {
    if (annotations === void 0) return void 0;
    const {
      representation,
      ...ordinary
    } = annotations;
    const projected = representation === void 0 ? void 0 : representation.schemas === void 0 ? representation : {
      ...representation,
      schemas: representation.schemas.map((schema) => recur2(toType(schema)))
    };
    return {
      ...projected === void 0 ? void 0 : {
        representation: projected
      },
      ...Object.keys(ordinary).length === 0 ? void 0 : {
        annotations: ordinary
      }
    };
  }
}

// node_modules/effect/dist/internal/schema/standardSchema.js
function makeStandardResult(exit3) {
  return isSuccess4(exit3) ? exit3.value : {
    issues: [{
      message: pretty(exit3.cause)
    }]
  };
}
function toStandardSchemaV1(self, options) {
  const decodeUnknownEffect3 = decodeUnknownEffect(self);
  const parseOptions = {
    errors: "all",
    ...options?.parseOptions
  };
  const formatter = makeFormatterStandardSchemaV1(options);
  const validate3 = (value3) => {
    const scheduler = new MixedScheduler("sync");
    const fiber3 = runFork2(match5(decodeUnknownEffect3(value3, parseOptions), {
      onFailure: formatter,
      onSuccess: (value4) => ({
        value: value4
      })
    }), {
      scheduler
    });
    fiber3.currentDispatcher?.flush();
    const exit3 = fiber3.pollUnsafe();
    if (exit3) {
      return makeStandardResult(exit3);
    }
    return new Promise((resolve3) => {
      fiber3.addObserver((exit4) => {
        resolve3(makeStandardResult(exit4));
      });
    });
  };
  return attach(self, {
    validate: validate3
  });
}
function attach(self, members) {
  const standard = {
    version: 1,
    vendor: "effect",
    // Only an own adapter describes `self`; an inherited one describes a parent class.
    ...Object.hasOwn(self, "~standard") ? self["~standard"] : void 0,
    ...members
  };
  const out = typeof self === "function" ? Function.prototype.bind.call(self, void 0) : Object.create(Object.getPrototypeOf(self));
  return Object.defineProperties(out, {
    ...Object.getOwnPropertyDescriptors(self),
    // Initialize a class's lazy AST with the original constructor as its receiver.
    ast: {
      value: self.ast,
      enumerable: true,
      configurable: true
    },
    "~standard": {
      value: standard,
      writable: true,
      enumerable: true,
      configurable: true
    }
  });
}
function toJsonSchemaDocument2(ast) {
  const document = toRepresentation(toCodecJsonAST(ast));
  return toJsonSchemaDocument(document);
}
function toBaseStandardJSONSchemaV1(ast, target) {
  const doc2020_12 = toJsonSchemaDocument2(ast);
  if (target === "draft-2020-12") {
    const schema = doc2020_12.schema;
    if (Object.keys(doc2020_12.definitions).length > 0) {
      schema.$defs = doc2020_12.definitions;
    }
    return schema;
  } else if (target === "draft-07") {
    const doc07 = toDocumentDraft07(doc2020_12);
    const schema = doc07.schema;
    if (Object.keys(doc07.definitions).length > 0) {
      schema.definitions = doc07.definitions;
    }
    return schema;
  }
  throw new globalThis.Error(`Unsupported target: ${target}`);
}
function toStandardJSONSchemaV1(self) {
  return attach(self, {
    jsonSchema: {
      input(options) {
        return toBaseStandardJSONSchemaV1(self.ast, options.target);
      },
      output(options) {
        return toBaseStandardJSONSchemaV1(toType(self.ast), options.target);
      }
    }
  });
}

// node_modules/effect/dist/JsonPatch.js
function get4(oldValue, newValue) {
  const patches = [];
  getLoop(oldValue, newValue, "", patches);
  return patches;
}
function getLoop(oldValue, newValue, path, patches) {
  if (Object.is(oldValue, newValue)) return;
  if (Array.isArray(oldValue) && Array.isArray(newValue)) {
    const len1 = oldValue.length;
    const len2 = newValue.length;
    const shared = Math.min(len1, len2);
    for (let i = 0; i < shared; i++) {
      getLoop(oldValue[i], newValue[i], `${path}/${i}`, patches);
    }
    for (let i = len1 - 1; i >= len2; i--) {
      patches.push({
        op: "remove",
        path: `${path}/${i}`
      });
    }
    for (let i = len1; i < len2; i++) {
      patches.push({
        op: "add",
        path: `${path}/${i}`,
        value: newValue[i]
      });
    }
    return;
  }
  if (isJsonObject(oldValue) && isJsonObject(newValue)) {
    const keys1 = Object.keys(oldValue);
    const keys22 = Object.keys(newValue);
    const allKeys = Array.from(/* @__PURE__ */ new Set([...keys1, ...keys22])).sort();
    for (const key of allKeys) {
      const keyPath = `${path}/${escapeToken(key)}`;
      const hasKey1 = Object.hasOwn(oldValue, key);
      const hasKey2 = Object.hasOwn(newValue, key);
      if (hasKey1 && hasKey2) {
        getLoop(oldValue[key], newValue[key], keyPath, patches);
      } else if (!hasKey1 && hasKey2) {
        patches.push({
          op: "add",
          path: keyPath,
          value: newValue[key]
        });
      } else {
        patches.push({
          op: "remove",
          path: keyPath
        });
      }
    }
    return;
  }
  patches.push({
    op: "replace",
    path,
    value: newValue
  });
}
function apply(patch, oldValue) {
  let doc = oldValue;
  for (const op of patch) {
    doc = applyOperation(doc, op);
  }
  return doc;
}
function isJsonObject(value3) {
  return typeof value3 === "object" && value3 !== null && !Array.isArray(value3);
}
function tokenize(pointer) {
  if (pointer === "") return [];
  if (pointer.charCodeAt(0) !== 47) {
    throw new Error(`Invalid JSON Pointer, it must start with "/": ${JSON.stringify(pointer)}`);
  }
  return pointer.split("/").slice(1).map(unescapeToken);
}
function toJsonPointerArrayIndex(token) {
  if (!/^(0|[1-9]\d*)$/.test(token)) {
    throw new Error(`Invalid array index: "${token}"`);
  }
  return Number(token);
}
function applyOperation(doc, op) {
  if (op.path === "") {
    if (op.op === "remove") throw new Error("Unsupported operation at the root");
    return op.value;
  }
  const resolved = resolveParent(doc, op.path);
  if (resolved === null) {
    throw new Error(`Cannot ${op.op} at "${op.path}" (parent not found or not a container).`);
  }
  const {
    lastToken,
    parent,
    stack
  } = resolved;
  if (Array.isArray(parent)) {
    if (lastToken === "-" && op.op !== "add") {
      throw new Error(`"-" is not valid for ${op.op} at "${op.path}".`);
    }
    const index2 = lastToken === "-" ? parent.length : toJsonPointerArrayIndex(lastToken);
    const maxIndex = op.op === "add" ? parent.length : parent.length - 1;
    if (index2 > maxIndex) throw new Error(`Array index out of bounds at "${op.path}".`);
    const updated = parent.slice();
    if (op.op === "add") updated.splice(index2, 0, op.value);
    else if (op.op === "remove") updated.splice(index2, 1);
    else updated[index2] = op.value;
    return rebuildFromStack(stack, updated);
  }
  if (isJsonObject(parent)) {
    if (op.op !== "add" && !Object.hasOwn(parent, lastToken)) {
      throw new Error(`Property "${lastToken}" does not exist at "${op.path}".`);
    }
    const updated = {
      ...parent
    };
    if (op.op === "remove") delete updated[lastToken];
    else assignProperty(updated, lastToken, op.value);
    return rebuildFromStack(stack, updated);
  }
  throw new Error(`Cannot ${op.op} at "${op.path}" (parent not found or not a container).`);
}
function resolveParent(doc, pointer) {
  const tokens = tokenize(pointer);
  if (tokens.length === 0) return null;
  const lastToken = tokens[tokens.length - 1];
  const stack = [];
  let cur = doc;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (Array.isArray(cur)) {
      const idx = toJsonPointerArrayIndex(token);
      if (idx >= cur.length) return null;
      stack.push({
        container: cur,
        token: idx
      });
      cur = cur[idx];
      continue;
    }
    if (isJsonObject(cur)) {
      if (!Object.hasOwn(cur, token)) return null;
      stack.push({
        container: cur,
        token
      });
      cur = cur[token];
      continue;
    }
    return null;
  }
  return {
    stack,
    parent: cur,
    lastToken
  };
}
function rebuildFromStack(stack, newParent) {
  let acc = newParent;
  for (let i = stack.length - 1; i >= 0; i--) {
    const {
      container,
      token
    } = stack[i];
    if (Array.isArray(container)) {
      const copy3 = container.slice();
      copy3[token] = acc;
      acc = copy3;
    } else {
      const copy3 = {
        ...container
      };
      assignProperty(copy3, token, acc);
      acc = copy3;
    }
  }
  return acc;
}

// node_modules/effect/dist/internal/schema/toDifferJsonPatch.js
function toDifferJsonPatch(schema) {
  const serializer = toCodecJson(schema);
  const get6 = encodeSync(serializer);
  const set6 = decodeSync(serializer);
  return {
    empty: [],
    diff: (oldValue, newValue) => get4(get6(oldValue), get6(newValue)),
    combine: (first, second) => [...first, ...second],
    patch: (oldValue, patch) => {
      const value3 = get6(oldValue);
      const patched = apply(patch, value3);
      return Object.is(patched, value3) ? oldValue : set6(patched);
    }
  };
}

// node_modules/effect/dist/internal/schema/toEncoderXml.js
function toEncoderXml(codec, options) {
  const rootName = resolveIdentifier(codec.ast) ?? resolveTitle(codec.ast);
  const serialize = encodeEffect(toCodecStringTree(codec));
  return (value3) => serialize(value3).pipe(map7((stringTree) => stringTreeToXml(stringTree, {
    rootName,
    ...options
  })));
}
function stringTreeToXml(value3, options) {
  const rootName = options.rootName ?? "root";
  const arrayItemName = options.arrayItemName ?? "item";
  const pretty2 = options.pretty ?? true;
  const indent = options.indent ?? "  ";
  const sortKeys = options.sortKeys ?? true;
  const seen = /* @__PURE__ */ new Set();
  const lines = [];
  recur2(rootName, value3, 0);
  return lines.join(pretty2 ? "\n" : "");
  function push(depth, text) {
    lines.push(pretty2 ? indent.repeat(depth) + text : text);
  }
  function recur2(tagName, node, depth, originalNameForMeta) {
    const {
      attrs,
      safe
    } = xml.tagInfo(tagName, originalNameForMeta);
    if (node === void 0) {
      push(depth, `<${safe}${attrs}/>`);
    } else if (typeof node === "string") {
      push(depth, `<${safe}${attrs}>${xml.escapeText(node)}</${safe}>`);
    } else if (typeof node !== "object" || node === null) {
      push(depth, `<${safe}${attrs}>${xml.escapeText(format(node))}</${safe}>`);
    } else {
      if (seen.has(node)) throw new globalThis.Error("Cycle detected while serializing to XML.", {
        cause: node
      });
      seen.add(node);
      try {
        if (globalThis.Array.isArray(node)) {
          if (node.length === 0) {
            push(depth, `<${safe}${attrs}/>`);
            return;
          }
          push(depth, `<${safe}${attrs}>`);
          for (const item of node) recur2(arrayItemName, item, depth + 1);
          push(depth, `</${safe}>`);
          return;
        }
        const object = node;
        const keys3 = Object.keys(object);
        if (sortKeys) keys3.sort();
        if (keys3.length === 0) {
          push(depth, `<${safe}${attrs}/>`);
          return;
        }
        push(depth, `<${safe}${attrs}>`);
        for (const key of keys3) {
          recur2(xml.parseTagName(key).safe, object[key], depth + 1, key);
        }
        push(depth, `</${safe}>`);
      } finally {
        seen.delete(node);
      }
    }
  }
}
var xml = {
  escapeText(value3) {
    return value3.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  escapeAttribute(value3) {
    return value3.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  },
  parseTagName(name) {
    const original = name;
    let safe = name;
    if (!/^[A-Za-z_]/.test(safe)) safe = "_" + safe;
    safe = safe.replace(/[^A-Za-z0-9._-]/g, "_");
    if (/^xml/i.test(safe)) safe = "_" + safe;
    return {
      safe,
      changed: safe !== original
    };
  },
  tagInfo(name, original) {
    const {
      changed,
      safe
    } = xml.parseTagName(name);
    const needsMeta = changed || original && original !== name;
    const attrs = needsMeta ? ` data-name="${xml.escapeAttribute(original ?? name)}"` : "";
    return {
      safe,
      attrs
    };
  }
};

// node_modules/effect/dist/internal/schema/toEquivalence.js
var toEquivalence = /* @__PURE__ */ memoize((ast) => {
  return recur(ast);
});
function recur(ast) {
  const annotation = resolve(ast)?.["toEquivalence"];
  if (annotation) {
    return annotation(isDeclaration(ast) ? ast.typeParameters.map(recur) : []);
  }
  switch (ast._tag) {
    case "Never":
      return strictEqual();
    case "Declaration":
      return declarationEquivalence(ast);
    case "Null":
    case "Undefined":
    case "Void":
    case "Unknown":
    case "Any":
    case "String":
    case "Number":
    case "Boolean":
    case "BigInt":
    case "Symbol":
    case "Literal":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enum":
    case "TemplateLiteral":
      return equals;
    case "Arrays": {
      const elements = ast.elements.map(recur);
      const rest = ast.rest.map(recur);
      const [head3, ...tail] = rest;
      const tailLength = tail.length;
      return make((a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return false;
        }
        const len = a.length;
        if (len !== b.length) {
          return false;
        }
        let i = 0;
        for (; i < Math.min(len, ast.elements.length); i++) {
          if (!elements[i](a[i], b[i])) {
            return false;
          }
        }
        if (rest.length > 0) {
          for (; i < len - tailLength; i++) {
            if (!head3(a[i], b[i])) {
              return false;
            }
          }
          for (let j = 0; j < tailLength; j++) {
            if (!tail[j](a[i + j], b[i + j])) {
              return false;
            }
          }
        }
        return true;
      });
    }
    case "Objects": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return equals;
      }
      const propertySignatures = ast.propertySignatures.map((ps) => recur(ps.type));
      const indexSignatures = ast.indexSignatures.map((is3) => recur(is3.type));
      return make((a, b) => {
        if (!isObject(a) || !isObject(b)) {
          return false;
        }
        for (let i = 0; i < propertySignatures.length; i++) {
          const ps = ast.propertySignatures[i];
          const name = ps.name;
          const aHas = Object.hasOwn(a, name);
          const bHas = Object.hasOwn(b, name);
          if (isOptional(ps.type)) {
            if (aHas !== bHas) {
              return false;
            }
          }
          if (aHas && bHas && !propertySignatures[i](a[name], b[name])) {
            return false;
          }
        }
        for (let i = 0; i < indexSignatures.length; i++) {
          const is3 = ast.indexSignatures[i];
          const aKeys = getIndexSignatureKeys(a, is3.parameter);
          const bKeys = getIndexSignatureKeys(b, is3.parameter);
          if (aKeys.length !== bKeys.length) return false;
          for (let j = 0; j < aKeys.length; j++) {
            const key = aKeys[j];
            if (!Object.hasOwn(b, key) || !indexSignatures[i](a[key], b[key])) {
              return false;
            }
          }
        }
        return true;
      });
    }
    case "Union": {
      const types = toType(ast).types;
      const index2 = getCandidateIndex(types);
      const compiled = types.map((candidate, i) => [_is(candidate), recur(ast.types[i])]);
      return make((a, b) => {
        const candidates = index2(a, false);
        for (let i = 0; i < candidates.length; i++) {
          const [is3, equivalence] = compiled[candidates[i]];
          if (is3(a) && is3(b)) {
            return equivalence(a, b);
          }
        }
        return false;
      });
    }
    case "Suspend": {
      let equivalence;
      return make((a, b) => (equivalence ??= toEquivalence(ast.thunk()))(a, b));
    }
  }
}
function declarationEquivalence(ast) {
  const representation = ast.annotations?.representation;
  if (representation === void 0) return equals;
  switch (representation.id) {
    case "effect/schema/Option": {
      const [value3] = declarationTypeParameters(ast);
      return (a, b) => a._tag === b._tag && (a._tag === "None" || value3(a.value, b.value));
    }
    case "effect/schema/Result": {
      const [success, failure] = declarationTypeParameters(ast);
      return (a, b) => a._tag === b._tag && (a._tag === "Success" ? success(a.success, b.success) : failure(a.failure, b.failure));
    }
    case "effect/schema/CauseReason": {
      const [error, defect] = declarationTypeParameters(ast);
      return causeReasonEquivalence(error, defect);
    }
    case "effect/schema/Cause": {
      const [error, defect] = declarationTypeParameters(ast);
      return causeEquivalence(error, defect);
    }
    case "effect/schema/Exit": {
      const [value3, error, defect] = declarationTypeParameters(ast);
      const cause = causeEquivalence(error, defect);
      return (a, b) => a._tag === b._tag && (a._tag === "Success" ? value3(a.value, b.value) : cause(a.cause, b.cause));
    }
    case "effect/schema/ReadonlyMap": {
      const [key, value3] = declarationTypeParameters(ast);
      return makeCompareMap(key, value3);
    }
    case "effect/schema/ReadonlySet":
      return makeCompareSet(declarationTypeParameters(ast)[0]);
    case "effect/schema/RegExp":
      return (a, b) => a.source === b.source && a.flags === b.flags;
    case "effect/schema/URL":
      return (a, b) => a.toString() === b.toString();
    default:
      return equals;
  }
}
function declarationTypeParameters(ast) {
  return ast.typeParameters.map(recur);
}
function causeReasonEquivalence(error, defect) {
  return (a, b) => {
    if (a._tag !== b._tag) return false;
    switch (a._tag) {
      case "Fail":
        return error(a.error, b.error);
      case "Die":
        return defect(a.defect, b.defect);
      case "Interrupt":
        return a.fiberId === b.fiberId;
    }
  };
}
function causeEquivalence(error, defect) {
  const reasons = Array_(causeReasonEquivalence(error, defect));
  return (a, b) => reasons(a.reasons, b.reasons);
}

// node_modules/effect/dist/internal/schema/toFormatter.js
function causeReasonToFormatter(error, defect) {
  return (reason) => {
    switch (reason._tag) {
      case "Fail":
        return `Fail(${error(reason.error)})`;
      case "Die":
        return `Die(${defect(reason.defect)})`;
      case "Interrupt":
        return "Interrupt";
    }
  };
}
function causeToFormatter(error, defect) {
  const causeReason = causeReasonToFormatter(error, defect);
  return (cause) => `Cause([${cause.reasons.map(causeReason).join(", ")}])`;
}
function toFormatter(ast, options) {
  const compiled = /* @__PURE__ */ new Map();
  return recur2(ast);
  function recur2(ast2) {
    let formatter = compiled.get(ast2);
    if (formatter === void 0) {
      formatter = compile2(ast2);
      compiled.set(ast2, formatter);
    }
    return formatter;
  }
  function compile2(ast2) {
    const annotation = resolve(ast2)?.["toFormatter"];
    if (typeof annotation === "function") {
      return annotation(isDeclaration(ast2) ? ast2.typeParameters.map(recur2) : []);
    }
    if (options?.onBefore) {
      const onBefore = options.onBefore(ast2, recur2);
      if (onBefore !== void 0) {
        return onBefore;
      }
    }
    return on(ast2);
  }
  function on(ast2) {
    switch (ast2._tag) {
      default:
        return format;
      case "Never":
        return () => "never";
      case "Void":
        return () => "void";
      case "Declaration": {
        const representation = ast2.annotations?.representation;
        if (representation === void 0) return format;
        const typeParameters = ast2.typeParameters.map(recur2);
        switch (representation.id) {
          case "effect/schema/Option": {
            const [value3] = typeParameters;
            return match({
              onNone: () => "none()",
              onSome: (value_) => `some(${value3(value_)})`
            });
          }
          case "effect/schema/Result": {
            const [success, failure] = typeParameters;
            return match2({
              onSuccess: (value3) => `success(${success(value3)})`,
              onFailure: (error) => `failure(${failure(error)})`
            });
          }
          case "effect/schema/CauseReason":
            return causeReasonToFormatter(typeParameters[0], typeParameters[1]);
          case "effect/schema/Cause":
            return causeToFormatter(typeParameters[0], typeParameters[1]);
          case "effect/schema/Exit": {
            const [value3, error, defect] = typeParameters;
            const cause = causeToFormatter(error, defect);
            return (exit3) => {
              switch (exit3._tag) {
                case "Success":
                  return `Exit.Success(${value3(exit3.value)})`;
                case "Failure":
                  return `Exit.Failure(${cause(exit3.cause)})`;
              }
            };
          }
          case "effect/schema/ReadonlyMap": {
            const [key, value3] = typeParameters;
            return (map10) => {
              const size6 = map10.size;
              if (size6 === 0) return "ReadonlyMap(0) {}";
              const entries3 = globalThis.Array.from(map10.entries()).map(([key_, value_]) => `${key(key_)} => ${value3(value_)}`).sort();
              return `ReadonlyMap(${size6}) { ${entries3.join(", ")} }`;
            };
          }
          case "effect/schema/HashMap": {
            const [key, value3] = typeParameters;
            return (map10) => {
              const size6 = size3(map10);
              if (size6 === 0) return "HashMap(0) {}";
              const entries3 = toEntries(map10).map(([key_, value_]) => `${key(key_)} => ${value3(value_)}`).sort();
              return `HashMap(${size6}) { ${entries3.join(", ")} }`;
            };
          }
          case "effect/schema/ReadonlySet": {
            const [value3] = typeParameters;
            return (set6) => {
              const size6 = set6.size;
              if (size6 === 0) return "ReadonlySet(0) {}";
              const values2 = globalThis.Array.from(set6.values()).map((item) => `${value3(item)}`).sort();
              return `ReadonlySet(${size6}) { ${values2.join(", ")} }`;
            };
          }
          case "effect/schema/HashSet": {
            const [value3] = typeParameters;
            return (set6) => {
              const size6 = size5(set6);
              if (size6 === 0) return "HashSet(0) {}";
              const values2 = globalThis.Array.from(set6).map((item) => `${value3(item)}`).sort();
              return `HashSet(${size6}) { ${values2.join(", ")} }`;
            };
          }
          case "effect/schema/Chunk": {
            const [value3] = typeParameters;
            return (chunk) => {
              const size6 = size(chunk);
              if (size6 === 0) return "Chunk(0) {}";
              const values2 = globalThis.Array.from(chunk).map((item) => `${value3(item)}`);
              return `Chunk(${size6}) { ${values2.join(", ")} }`;
            };
          }
          default:
            return format;
        }
      }
      case "Arrays": {
        const elements = ast2.elements.map((element) => recur2(element));
        const rest = ast2.rest.map(recur2);
        const [head3, ...tail] = rest;
        const tailLength = tail.length;
        return (value3) => {
          const out = [];
          let i = 0;
          for (; i < elements.length; i++) {
            if (value3.length < i + 1) {
              if (isOptional(ast2.elements[i])) {
                continue;
              }
            } else {
              out.push(elements[i](value3[i]));
            }
          }
          if (rest.length > 0) {
            for (; i < value3.length - tailLength; i++) {
              out.push(head3(value3[i]));
            }
            for (let j = 0; j < tailLength; j++) {
              out.push(tail[j](value3[i + j]));
            }
          }
          return "[" + out.join(", ") + "]";
        };
      }
      case "Objects": {
        const propertySignatures = ast2.propertySignatures.map((signature) => recur2(signature.type));
        const indexSignatures = ast2.indexSignatures.map((signature) => recur2(signature.type));
        if (ast2.propertySignatures.length === 0 && ast2.indexSignatures.length === 0) {
          return format;
        }
        return (value3) => {
          const out = [];
          const visited = /* @__PURE__ */ new Set();
          for (let i = 0; i < propertySignatures.length; i++) {
            const signature = ast2.propertySignatures[i];
            const name = signature.name;
            visited.add(name);
            if (isOptional(signature.type) && !Object.hasOwn(value3, name)) {
              continue;
            }
            out.push(`${formatPropertyKey(name)}: ${propertySignatures[i](value3[name])}`);
          }
          for (let i = 0; i < indexSignatures.length; i++) {
            const keys3 = getIndexSignatureKeys(value3, ast2.indexSignatures[i].parameter);
            for (const key of keys3) {
              if (visited.has(key)) {
                continue;
              }
              visited.add(key);
              out.push(`${formatPropertyKey(key)}: ${indexSignatures[i](value3[key])}`);
            }
          }
          return out.length > 0 ? "{ " + out.join(", ") + " }" : "{}";
        };
      }
      case "Union": {
        const types = toType(ast2).types;
        const index2 = getCandidateIndex(types);
        const compiled2 = types.map((candidate, i) => [_is(candidate), recur2(ast2.types[i])]);
        return (value3) => {
          const candidates = index2(value3, false);
          for (let i = 0; i < candidates.length; i++) {
            const [is3, formatter] = compiled2[candidates[i]];
            if (is3(value3)) {
              return formatter(value3);
            }
          }
          return format(value3);
        };
      }
      case "Suspend": {
        let formatter;
        return (value3) => (formatter ??= recur2(ast2.thunk()))(value3);
      }
    }
  }
}

// node_modules/effect/dist/Struct.js
var pick = /* @__PURE__ */ dual(2, (self, keys3) => {
  return buildStruct(self, (k, v) => hasPropertyKey(keys3, k) ? [k, v] : void 0);
});
var omit2 = /* @__PURE__ */ dual(2, (self, keys3) => {
  return buildStruct(self, (k, v) => !hasPropertyKey(keys3, k) ? [k, v] : void 0);
});
var assign = /* @__PURE__ */ dual(2, (self, that) => {
  return {
    ...self,
    ...that
  };
});
var renameKeys = /* @__PURE__ */ dual(2, (self, mapping) => {
  return buildStruct(self, (k, v) => [Object.hasOwn(mapping, k) ? mapping[k] : k, v]);
});
var lambda = (f) => f;
function hasPropertyKey(keys3, key) {
  return keys3.some((candidate) => candidate === key || typeof candidate === "number" && String(candidate) === key);
}
function buildStruct(source, f) {
  const out = {};
  for (const k of Reflect.ownKeys(source)) {
    if (!Object.prototype.propertyIsEnumerable.call(source, k)) continue;
    const res = f(k, source[k]);
    if (res) {
      const [nk, nv] = res;
      assignProperty(out, nk, nv);
    }
  }
  return out;
}

// node_modules/effect/dist/Optic.js
function makeIso(get6, set6) {
  return make17(primitiveNode("Iso", get6, set6));
}
function makeLens(get6, replace) {
  return make17(primitiveNode("Lens", get6, replace));
}
function primitiveNode(kind, get6, set6) {
  return [{
    _tag: "PrimitiveNode",
    kind,
    get: get6,
    set: set6
  }];
}
var identityOperation = {
  kind: "Iso",
  get: identity,
  set: identity
};
var PathNode = class {
  _tag = "PathNode";
  kind = "Lens";
  path;
  get;
  set;
  constructor(path) {
    this.path = path;
    this.get = (s) => {
      let out = s;
      for (let i = 0; i < path.length; i++) {
        out = out[path[i]];
      }
      return out;
    };
    this.set = (a, s) => {
      const out = cloneShallow(s);
      let current = out;
      let i = 0;
      for (; i < path.length - 1; i++) {
        const key = path[i];
        assignProperty(current, key, cloneShallow(current[key]));
        current = current[key];
      }
      assignProperty(current, path[i], a);
      return out;
    };
  }
};
var CheckNode = class {
  _tag = "CheckNode";
  kind = "Prism";
  checks;
  get;
  set = identity;
  constructor(checks) {
    this.checks = checks;
    this.get = (s) => runChecks(checks, s);
  }
};
function compose2(a, b) {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const nodes = a.slice();
  for (let i = 0; i < b.length; i++) {
    const node = b[i];
    const last = nodes[nodes.length - 1];
    if (last._tag === "PathNode" && node._tag === "PathNode") {
      nodes[nodes.length - 1] = new PathNode([...last.path, ...node.path]);
    } else if (last._tag === "CheckNode" && node._tag === "CheckNode") {
      nodes[nodes.length - 1] = new CheckNode([...last.checks, ...node.checks]);
    } else {
      nodes.push(node);
    }
  }
  return nodes;
}
function makeOptional(getResult, set6) {
  return make17(primitiveNode("Optional", getResult, set6));
}
var OptionalImpl = class {
  /** @internal */
  node;
  getResult;
  replaceResult;
  constructor(node, getResult, replaceResult) {
    this.node = node;
    this.getResult = getResult;
    this.replaceResult = replaceResult;
  }
  replace(a, s) {
    return getOrElse2(this.replaceResult(a, s), () => s);
  }
  modify(f) {
    return (s) => getOrElse2(flatMap2(this.getResult(s), (a) => this.replaceResult(f(a), s)), () => s);
  }
  compose(that) {
    return make17(compose2(this.node, that.node));
  }
  key(key) {
    return make17(compose2(this.node, [new PathNode([key])]));
  }
  optionalKey(key) {
    return make17(compose2(this.node, primitiveNode("Lens", (s) => s[key], (a, s) => {
      const copy3 = cloneShallow(s);
      if (a === void 0) {
        if (Array.isArray(copy3) && (typeof key === "number" || typeof key === "string" && isCanonicalArrayIndex(key))) {
          copy3.splice(Number(key), 1);
        } else {
          delete copy3[key];
        }
      } else {
        assignProperty(copy3, key, a);
      }
      return copy3;
    })));
  }
  check(...checks) {
    return make17(compose2(this.node, [new CheckNode(checks)]));
  }
  refine(refinement, annotations) {
    return make17(compose2(this.node, [new CheckNode([makeFilterByGuard(refinement, annotations)])]));
  }
  tag(tag2) {
    const err = fail2(new InvalidValue({
      expected: `${JSON.stringify(tag2)} tag`
    }));
    return make17(compose2(this.node, primitiveNode("Prism", (s) => s._tag === tag2 ? succeed2(s) : err, identity)));
  }
  at(key, ..._rest) {
    const err = fail2(new Pointer([key], new MissingKey(void 0)));
    return make17(compose2(this.node, primitiveNode("Optional", (s) => Object.hasOwn(s, key) ? succeed2(s[key]) : err, (a, s) => {
      if (Object.hasOwn(s, key)) {
        const copy3 = cloneShallow(s);
        assignProperty(copy3, key, a);
        return succeed2(copy3);
      } else {
        return err;
      }
    })));
  }
  pick(keys3) {
    return this.compose(makeLens(pick(keys3), (p, a) => ({
      ...omit2(a, keys3),
      ...p
    })));
  }
  omit(keys3) {
    return this.compose(makeLens(omit2(keys3), (o, a) => ({
      ...pick(a, keys3),
      ...o
    })));
  }
  notUndefined() {
    return this.refine(isNotUndefined, {
      expected: "a value other than `undefined`"
    });
  }
  forEach(f) {
    const inner = f(id());
    return makeOptional(
      // GET: collect focused Bs
      (s) => map2(this.getResult(s), (as3) => {
        const bs = [];
        for (let i = 0; i < as3.length; i++) {
          const r = inner.getResult(as3[i]);
          if (isSuccess2(r)) bs.push(r.success);
        }
        return bs;
      }),
      // SET: bs must match the number of focusable elements
      (bs, s) => flatMap2(this.getResult(s), (as3) => {
        const idxs = [];
        for (let i = 0; i < as3.length; i++) {
          if (isSuccess2(inner.getResult(as3[i]))) idxs.push(i);
        }
        if (bs.length !== idxs.length) {
          return fail2(new InvalidValue({
            message: `each: replacement length mismatch: ${bs.length} !== ${idxs.length}`
          }));
        }
        const out = as3.slice();
        for (let k = 0; k < idxs.length; k++) {
          const i = idxs[k];
          const r = inner.replaceResult(bs[k], as3[i]);
          if (isFailure2(r)) {
            return fail2(new Pointer([i], r.failure));
          }
          out[i] = r.success;
        }
        return this.replaceResult(out, s);
      })
    );
  }
  modifyAll(f) {
    return (s) => getOrElse2(flatMap2(this.getResult(s), (as3) => this.replaceResult(as3.map(f), s)), () => s);
  }
};
var IsoImpl = class extends OptionalImpl {
  get;
  set;
  constructor(node, get6, set6) {
    super(node, (s) => succeed2(get6(s)), (a) => succeed2(set6(a)));
    this.get = get6;
    this.set = set6;
  }
  replace(a, _) {
    return this.set(a);
  }
  modify(f) {
    return (s) => this.set(f(this.get(s)));
  }
};
var LensImpl = class extends OptionalImpl {
  get;
  constructor(node, get6, replace) {
    super(node, (s) => succeed2(get6(s)), (a, s) => succeed2(replace(a, s)));
    this.get = get6;
    this.replace = replace;
  }
  modify(f) {
    return (s) => this.replace(f(this.get(s)), s);
  }
};
var PrismImpl = class extends OptionalImpl {
  set;
  constructor(node, getResult, set6) {
    super(node, getResult, (a, _) => succeed2(set6(a)));
    this.set = set6;
  }
  replace(a, _) {
    return this.set(a);
  }
  modify(f) {
    return (s) => getOrElse2(map2(this.getResult(s), (a) => this.set(f(a))), () => s);
  }
};
function make17(node) {
  let op = node[0] ?? identityOperation;
  if (node.length > 1) {
    const kind = node.reduce((kind2, step) => composeKind(kind2, step.kind), "Iso");
    op = {
      kind,
      get: compileGet(node, kind),
      set: compileSet(node, kind)
    };
  }
  switch (op.kind) {
    case "Iso":
      return new IsoImpl(node, op.get, op.set);
    case "Lens":
      return new LensImpl(node, op.get, op.set);
    case "Prism":
      return new PrismImpl(node, op.get, op.set);
    case "Optional":
      return new OptionalImpl(node, op.get, op.set);
  }
}
function cloneShallow(pojo) {
  if (Array.isArray(pojo)) return pojo.slice();
  if (typeof pojo === "object" && pojo !== null) {
    const proto = Object.getPrototypeOf(pojo);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("Cannot clone object with non-Object constructor or null prototype");
    }
    return {
      ...pojo
    };
  }
  return pojo;
}
function compileGet(nodes, kind) {
  return (s) => {
    for (let i = 0; i < nodes.length; i++) {
      const op = nodes[i];
      const result3 = op.get(s);
      if (hasFailingGet(op.kind)) {
        if (isFailure2(result3)) {
          return result3;
        }
        s = result3.success;
      } else {
        s = result3;
      }
    }
    return hasFailingGet(kind) ? succeed2(s) : s;
  };
}
function compileSet(nodes, kind) {
  if (hasSourceFreeSet(kind)) {
    return (a) => {
      for (let i = nodes.length - 1; i >= 0; i--) {
        a = nodes[i].set(a);
      }
      return a;
    };
  }
  return (a, s) => {
    const len = nodes.length;
    const sources = new Array(len);
    for (let i = 0; i < len; i++) {
      sources[i] = s;
      const op = nodes[i];
      if (hasFailingGet(op.kind)) {
        const result3 = op.get(s);
        if (isFailure2(result3)) {
          return result3;
        }
        s = result3.success;
      } else {
        s = op.get(s);
      }
    }
    for (let i = len - 1; i >= 0; i--) {
      const op = nodes[i];
      if (hasSourceFreeSet(op.kind)) {
        a = op.set(a);
      } else if (op.kind === "Lens") {
        a = op.set(a, sources[i]);
      } else {
        const result3 = op.set(a, sources[i]);
        if (isFailure2(result3)) {
          return result3;
        }
        a = result3.success;
      }
    }
    return kind === "Optional" ? succeed2(a) : a;
  };
}
function hasFailingGet(kind) {
  return kind === "Prism" || kind === "Optional";
}
function hasSourceFreeSet(kind) {
  return kind === "Iso" || kind === "Prism";
}
function composeKind(a, b) {
  if (a === "Iso") return b;
  if (b === "Iso" || a === b) return a;
  return "Optional";
}
var identityIso = /* @__PURE__ */ make17([]);
function id() {
  return identityIso;
}

// node_modules/effect/dist/internal/schema/toIso.js
function toIso(schema) {
  const serializer = toCodecIso(schema);
  return makeIso(encodeSync(serializer), decodeSync(serializer));
}
function toIsoSource(_) {
  return id();
}
function toIsoFocus(_) {
  return id();
}

// node_modules/effect/dist/internal/schemaError.js
var SchemaErrorTypeId = "~effect/Schema/SchemaError";
function isSchemaError(u) {
  return hasProperty(u, SchemaErrorTypeId) && u[SchemaErrorTypeId] === SchemaErrorTypeId;
}

// node_modules/effect/dist/Bytes.js
var Equivalence7 = /* @__PURE__ */ make((self, that) => {
  if (self.length !== that.length) {
    return false;
  }
  for (let i = 0; i < self.length; i++) {
    if (self[i] !== that[i]) {
      return false;
    }
  }
  return true;
});

// node_modules/effect/dist/net/NetAddress.js
var TypeId25 = "~effect/net/NetAddress";
var ipv4Value = (self) => self.value;
var ipv6Words = (self) => self;
var getMacBytes = (self) => self.bytes;
var NetAddressError = class extends (/* @__PURE__ */ TaggedError2("NetAddressError")) {
};
var isAddress = (u) => hasProperty(u, TypeId25);
var isIpv4Address = (u) => isAddress(u) && u._tag === "Ipv4Address";
var isIpv6Address = (u) => isAddress(u) && u._tag === "Ipv6Address";
var isIpAddress = (u) => isIpv4Address(u) || isIpv6Address(u);
var width = (address) => isIpv4Address(address) ? 32 : 128;
var isMacAddress = (u) => isAddress(u) && u._tag === "MacAddress";
var isInetAddressV4 = (u) => isAddress(u) && u._tag === "InetAddressV4";
var isInetAddressV6 = (u) => isAddress(u) && u._tag === "InetAddressV6";
var isInetAddress = (u) => isInetAddressV4(u) || isInetAddressV6(u);
var isUnixPathAddress = (u) => isAddress(u) && u._tag === "UnixPathAddress";
var isSocketAddress = (u) => isInetAddress(u) || isUnixPathAddress(u);
var Ipv4Proto = {
  ...BaseProto,
  _tag: "Ipv4Address",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    return isIpv4Address(that) && ipv4Value(this) === ipv4Value(that);
  },
  [symbol]() {
    return optimize(combine(ipv4HashSeed, ipv4Value(this) | 0));
  },
  toString() {
    return formatIp(this);
  },
  toJSON() {
    return this.toString();
  }
};
var Ipv6Proto = {
  ...BaseProto,
  _tag: "Ipv6Address",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    if (!isIpv6Address(that)) return false;
    const self = ipv6Words(this);
    const other = ipv6Words(that);
    return self.w0 === other.w0 && self.w1 === other.w1 && self.w2 === other.w2 && self.w3 === other.w3;
  },
  [symbol]() {
    const self = ipv6Words(this);
    let h = combine(ipv6HashSeed, self.w0 | 0);
    h = combine(h, self.w1 | 0);
    h = combine(h, self.w2 | 0);
    return optimize(combine(h, self.w3 | 0));
  },
  toString() {
    return formatIp(this);
  },
  toJSON() {
    return this.toString();
  }
};
var MacProto = {
  ...BaseProto,
  _tag: "MacAddress",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    return isMacAddress(that) && Equivalence7(getMacBytes(this), getMacBytes(that));
  },
  [symbol]() {
    return combine(macHashSeed, array(getMacBytes(this)));
  },
  toString() {
    return formatMacAddress(this);
  },
  toJSON() {
    return this.toString();
  }
};
var ipv4HashSeed = /* @__PURE__ */ string("Ipv4Address");
var ipv6HashSeed = /* @__PURE__ */ string("Ipv6Address");
var macHashSeed = /* @__PURE__ */ string("MacAddress");
var makeIpv4 = (value3) => {
  const self = Object.create(Ipv4Proto);
  self.value = value3 >>> 0;
  return Object.freeze(self);
};
var makeIpv6 = (w0, w1, w2, w3) => {
  const self = Object.create(Ipv6Proto);
  self.w0 = w0 >>> 0;
  self.w1 = w1 >>> 0;
  self.w2 = w2 >>> 0;
  self.w3 = w3 >>> 0;
  return Object.freeze(self);
};
var packOctets = (a, b, c, d) => (a << 24 | b << 16 | c << 8 | d) >>> 0;
var wordToOctets = (word) => [word >>> 24, word >>> 16 & 255, word >>> 8 & 255, word & 255];
var makeMac = (bytes2) => {
  const self = Object.assign(Object.create(MacProto), {
    bytes: new Uint8Array(bytes2)
  });
  return Object.freeze(self);
};
var addressError = (input, message) => fail2(new NetAddressError({
  input,
  message
}));
var allIntegersInRange = (values2, max5) => {
  for (let i = 0; i < values2.length; i++) {
    const n = values2[i];
    if (!Number.isInteger(n) || n < 0 || n > max5) return false;
  }
  return true;
};
var ipv4FromOctets = (octets) => {
  if (!allIntegersInRange(octets, 255)) {
    return addressError(octets, "octets must be integers from 0 through 255");
  }
  return succeed2(makeIpv4(packOctets(octets[0], octets[1], octets[2], octets[3])));
};
var ipv6FromSegments = (segments) => {
  if (!allIntegersInRange(segments, 65535)) {
    return addressError(segments, "segments must be integers from 0 through 65535");
  }
  return succeed2(makeIpv6(segments[0] * 65536 + segments[1], segments[2] * 65536 + segments[3], segments[4] * 65536 + segments[5], segments[6] * 65536 + segments[7]));
};
var macAddressFromString = (input) => {
  if (!/^(?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(input)) {
    return addressError(input, "expected six two-digit hexadecimal octets separated by colons");
  }
  return succeed2(makeMac(new Uint8Array(input.split(":").map((part) => Number.parseInt(part, 16)))));
};
var ipv4FromString = (input) => {
  const parts2 = input.split(".");
  if (parts2.length !== 4 || parts2.some((part) => !/^\d{1,3}$/.test(part))) {
    return addressError(input, "expected exactly four decimal octets");
  }
  if (parts2.some((part) => part.length > 1 && part[0] === "0")) {
    return addressError(input, "leading zeroes are not allowed");
  }
  const octets = parts2.map(Number);
  if (octets.some((part) => part > 255)) {
    return addressError(input, "octets must be at most 255");
  }
  return ipv4FromOctets([octets[0], octets[1], octets[2], octets[3]]);
};
var parseIpv6Segments = (input) => {
  if (input.includes("[") || input.includes("]") || input.includes("%")) {
    return addressError(input, "brackets and zone identifiers are not valid in a bare IPv6 address");
  }
  const halves = input.split("::");
  if (halves.length > 2) return addressError(input, "only one compression marker is allowed");
  const head3 = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 && halves[1] !== "" ? halves[1].split(":") : [];
  if (head3.some((part) => part === "") || tail.some((part) => part === "")) {
    return addressError(input, "empty segments are only valid in the compression marker");
  }
  const trailing = tail.length > 0 ? tail[tail.length - 1] : head3.length > 0 ? head3[head3.length - 1] : "";
  let embedded;
  if (trailing.includes(".")) {
    if (halves.length === 2 && tail.length === 0) {
      return addressError(input, "embedded IPv4 syntax must be trailing");
    }
    const parsed = map2(ipv4FromString(trailing), (address) => {
      const value3 = ipv4Value(address);
      return [value3 >>> 16, value3 & 65535];
    });
    if (isFailure2(parsed)) return parsed;
    embedded = parsed.success;
    if (tail.length > 0) tail.pop();
    else head3.pop();
  }
  const explicit = head3.length + tail.length + (embedded ? 2 : 0);
  if (halves.length === 1 ? explicit !== 8 : explicit >= 8) {
    return addressError(input, halves.length === 1 ? "expected eight segments" : "compression must replace at least one segment");
  }
  const parse3 = (part) => /^[0-9a-fA-F]{1,4}$/.test(part) ? Number.parseInt(part, 16) : void 0;
  const parsedHead = head3.map(parse3);
  const parsedTail = tail.map(parse3);
  if (parsedHead.some((part) => part === void 0) || parsedTail.some((part) => part === void 0)) {
    return addressError(input, "segments must contain one through four hexadecimal digits");
  }
  return succeed2([...parsedHead, ...Array(8 - explicit).fill(0), ...parsedTail, ...embedded ?? []]);
};
var ipv6FromString = (input) => {
  return flatMap2(parseIpv6Segments(input), (segments) => ipv6FromSegments(segments));
};
var ipFromString = (input) => {
  const result3 = input.includes(":") ? ipv6FromString(input) : ipv4FromString(input);
  return result3;
};
var isScopedIpv6Literal = (u) => {
  if (typeof u !== "string" || !u.includes("%")) return false;
  const result3 = scopedIpv6LiteralFromString(u);
  return isSuccess2(result3) && result3.success === u;
};
var scopedIpv6LiteralFromString = (input) => {
  const separator = input.indexOf("%");
  if (separator === -1) return addressError(input, "expected an IPv6 zone");
  let zone = input.slice(separator + 1);
  if (zone.length === 0 || /[%[\]/\s\p{Cc}]/u.test(zone)) {
    return addressError(input, "invalid IPv6 scope identifier");
  }
  if (/^\d+$/.test(zone)) {
    const scopeId = Number(zone);
    if (scopeId > 4294967295) return addressError(input, "scope identifier must be an unsigned 32-bit integer");
    zone = String(scopeId);
  }
  return map2(ipv6FromString(input.slice(0, separator)), (address) => `${formatIp(address)}%${zone}`);
};
var ipv4ToOctets = (self) => wordToOctets(ipv4Value(self));
var ipv6ToSegments = (self) => {
  const {
    w0,
    w1,
    w2,
    w3
  } = ipv6Words(self);
  return [w0 >>> 16, w0 & 65535, w1 >>> 16, w1 & 65535, w2 >>> 16, w2 & 65535, w3 >>> 16, w3 & 65535];
};
var ipv6ToOctets = (self) => {
  const {
    w0,
    w1,
    w2,
    w3
  } = ipv6Words(self);
  return [...wordToOctets(w0), ...wordToOctets(w1), ...wordToOctets(w2), ...wordToOctets(w3)];
};
var formatMacAddress = (self) => Array.from(getMacBytes(self), (byte) => byte.toString(16).padStart(2, "0")).join(":");
var isMacBroadcast = (self) => getMacBytes(self).every((byte) => byte === 255);
var isMacMulticast = (self) => (getMacBytes(self)[0] & 1) !== 0;
var isMacUnicast = (self) => (getMacBytes(self)[0] & 1) === 0;
var isMacLocallyAdministered = (self) => (getMacBytes(self)[0] & 2) !== 0;
var isMacUniversallyAdministered = (self) => (getMacBytes(self)[0] & 2) === 0;
var formatIp = (self) => {
  if (isIpv4Address(self)) return ipv4ToOctets(self).join(".");
  const segments = ipv6ToSegments(self);
  if (isIpv4Mapped(self)) {
    return `::ffff:${segments[6] >> 8}.${segments[6] & 255}.${segments[7] >> 8}.${segments[7] & 255}`;
  }
  let bestStart = -1;
  let bestLength = 0;
  let start = -1;
  for (let index2 = 0; index2 <= 8; index2++) {
    if (index2 < 8 && segments[index2] === 0) {
      if (start === -1) start = index2;
    } else if (start !== -1) {
      if (index2 - start > bestLength) {
        bestStart = start;
        bestLength = index2 - start;
      }
      start = -1;
    }
  }
  if (bestLength < 2) return segments.map((segment) => segment.toString(16)).join(":");
  const head3 = segments.slice(0, bestStart).map((segment) => segment.toString(16)).join(":");
  const tail = segments.slice(bestStart + bestLength).map((segment) => segment.toString(16)).join(":");
  return `${head3}::${tail}`;
};
var isUnspecified = (self) => {
  if (isIpv4Address(self)) return ipv4Value(self) === 0;
  const {
    w0,
    w1,
    w2,
    w3
  } = ipv6Words(self);
  return w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0;
};
var isLoopback = (self) => {
  if (isIpv4Address(self)) return ipv4Value(self) >>> 24 === 127;
  const {
    w0,
    w1,
    w2,
    w3
  } = ipv6Words(self);
  return w0 === 0 && w1 === 0 && w2 === 0 && w3 === 1;
};
var isMulticast = (self) => {
  if (isMacAddress(self)) return isMacMulticast(self);
  if (isIpv4Address(self)) return ipv4Value(self) >>> 28 === 14;
  return ipv6Words(self).w0 >>> 24 === 255;
};
var isBroadcast = (self) => isMacAddress(self) ? isMacBroadcast(self) : ipv4Value(self) === 4294967295;
var isUnicast = (self) => {
  if (isMacAddress(self)) return isMacUnicast(self);
  return !isMulticast(self) && !isUnspecified(self) && (!isIpv4Address(self) || !isBroadcast(self));
};
var isLinkLocal = (self) => {
  if (isIpv4Address(self)) return ipv4Value(self) >>> 16 === 43518;
  return (ipv6Words(self).w0 >>> 16 & 65472) === 65152;
};
var isPrivate = (self) => {
  const value3 = ipv4Value(self);
  return value3 >>> 24 === 10 || (value3 >>> 16 & 65520) === 44048 || value3 >>> 16 === 49320;
};
var isUniqueLocal = (self) => (ipv6Words(self).w0 >>> 24 & 254) === 252;
var isIpv4Mapped = (self) => {
  const {
    w0,
    w1,
    w2
  } = ipv6Words(self);
  return w0 === 0 && w1 === 0 && w2 === 65535;
};
var InetV4Proto = {
  ...BaseProto,
  _tag: "InetAddressV4",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    return isInetAddressV4(that) && this.port === that.port && equals(this.address, that.address);
  },
  [symbol]() {
    return combine(hash(this.address), number(this.port));
  },
  toString() {
    return formatInet(this);
  },
  toJSON() {
    return this.toString();
  }
};
var InetV6Proto = {
  ...BaseProto,
  _tag: "InetAddressV6",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    return isInetAddressV6(that) && this.port === that.port && this.scopeId === that.scopeId && equals(this.address, that.address);
  },
  [symbol]() {
    return combine(combine(hash(this.address), number(this.port)), number(this.scopeId));
  },
  toString() {
    return formatInet(this);
  },
  toJSON() {
    return this.toString();
  }
};
var checkPort = (port) => Number.isInteger(port) && port >= 0 && port <= 65535;
var inetAddressV4 = (address, port) => {
  if (!checkPort(port)) {
    return addressError(address, "port must be an integer from 0 through 65535");
  }
  const self = Object.create(InetV4Proto);
  self.address = address;
  self.port = port;
  return succeed2(Object.freeze(self));
};
var inetAddressV6 = (address, port, options) => {
  if (!checkPort(port)) {
    return addressError(address, "port must be an integer from 0 through 65535");
  }
  const scopeId = options?.scopeId ?? 0;
  if (!Number.isInteger(scopeId) || scopeId < 0 || scopeId > 4294967295) {
    return addressError(address, "scopeId must be an unsigned 32-bit integer");
  }
  const self = Object.create(InetV6Proto);
  self.address = address;
  self.port = port;
  self.scopeId = scopeId;
  return succeed2(Object.freeze(self));
};
var inetAddressFromString = (input) => {
  let host;
  let portText;
  let scopeId = 0;
  const bracketed = input.startsWith("[");
  if (bracketed) {
    const end = input.indexOf("]");
    if (end < 0 || input[end + 1] !== ":" || input.indexOf("]", end + 1) !== -1) {
      return addressError(input, "expected [IPv6]:port");
    }
    host = input.slice(1, end);
    portText = input.slice(end + 2);
    const scopeSeparator = host.indexOf("%");
    if (scopeSeparator !== -1) {
      const scopeText = host.slice(scopeSeparator + 1);
      if (host.indexOf("%", scopeSeparator + 1) !== -1 || !/^\d+$/.test(scopeText)) {
        return addressError(input, "scope identifier must be decimal");
      }
      scopeId = Number(scopeText);
      if (!Number.isInteger(scopeId) || scopeId > 4294967295) {
        return addressError(input, "scope identifier must be an unsigned 32-bit integer");
      }
      host = host.slice(0, scopeSeparator);
    }
  } else {
    const separator = input.lastIndexOf(":");
    if (separator < 0) {
      return addressError(input, "expected host:port or [IPv6]:port");
    }
    if (input.indexOf(":") !== separator) {
      return addressError(input, "IPv6 addresses must be bracketed");
    }
    host = input.slice(0, separator);
    portText = input.slice(separator + 1);
  }
  if (!/^(0|[1-9]\d*)$/.test(portText)) {
    return addressError(input, "port must be an unpadded decimal integer");
  }
  return flatMap2(ipFromString(host), (address) => {
    if (bracketed !== isIpv6Address(address)) {
      return addressError(input, "only IPv6 addresses use brackets");
    }
    return isIpv6Address(address) ? inetAddressV6(address, Number(portText), {
      scopeId
    }) : inetAddressV4(address, Number(portText));
  });
};
var formatHost = (self) => formatIp(self.address) + (isInetAddressV6(self) && self.scopeId !== 0 ? `%${self.scopeId}` : "");
var formatInet = (self) => {
  const host = formatHost(self);
  return isInetAddressV4(self) ? `${host}:${self.port}` : `[${host}]:${self.port}`;
};
var UnixPathProto = {
  ...BaseProto,
  _tag: "UnixPathAddress",
  [TypeId25]: TypeId25,
  [symbol2](that) {
    return isUnixPathAddress(that) && this.path === that.path;
  },
  [symbol]() {
    return combine(string("UnixPathAddress"), string(this.path));
  },
  toString() {
    return this.path;
  },
  toJSON() {
    return this.toString();
  }
};
var unixPathAddress = (path) => {
  const self = Object.create(UnixPathProto);
  self.path = path;
  return Object.freeze(self);
};

// node_modules/effect/dist/net/Host.js
var TypeId26 = "~effect/net/Host";
var hostError = (input, message) => fail2(new NetAddressError({
  input,
  message
}));
var asciiNameCharacter = /^[a-z0-9_.-]$/i;
var labelPattern = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?$/;
var numericLabel = /^(?:\d+|0x[0-9a-f]*)$/;
var validateDomainName = (name) => {
  if (name === ".") return void 0;
  const relative = name.endsWith(".") ? name.slice(0, -1) : name;
  if (relative.length === 0) return "domain name must not be empty";
  if (relative.length > 253) return "domain name must be at most 253 characters";
  const labels = relative.split(".");
  for (const label of labels) {
    if (label.length === 0) return "domain name labels must not be empty";
    if (label.length > 63) return "domain name labels must be at most 63 characters";
    if (!labelPattern.test(label)) {
      return "domain name labels must contain only letters, digits, hyphens, or underscores and must not start or end with a hyphen";
    }
  }
  if (numericLabel.test(labels[labels.length - 1])) {
    return "the last domain name label must not be numeric";
  }
  return void 0;
};
var toAsciiDomainName = (input) => {
  let ascii = true;
  for (const character of input) {
    if (character.charCodeAt(0) < 128) {
      if (!asciiNameCharacter.test(character)) return void 0;
    } else {
      ascii = false;
    }
  }
  if (ascii) return input.toLowerCase();
  try {
    return new URL(`http://${input}`).hostname;
  } catch {
    return void 0;
  }
};
var isDomainName = (u) => typeof u === "string" && /^[a-z0-9_.-]+$/.test(u) && validateDomainName(u) === void 0;
var isHostPort = (u) => hasProperty(u, TypeId26);
var domainNameFromString = (input) => {
  const name = toAsciiDomainName(input);
  if (name === void 0) return hostError(input, "invalid domain name");
  const error = validateDomainName(name);
  return error === void 0 ? succeed2(name) : hostError(input, error);
};
var hostFromString = (input) => {
  if (input.includes("%")) return scopedIpv6LiteralFromString(input);
  if (input.includes(":")) return ipFromString(input);
  if (/^[\d.]+$/.test(input)) {
    const address = ipFromString(input);
    if (isSuccess2(address)) return address;
  }
  return domainNameFromString(input);
};
var formatHost2 = (self) => typeof self === "string" ? self : formatIp(self);
var HostPortProto = {
  ...BaseProto,
  _tag: "HostPort",
  [TypeId26]: TypeId26,
  [symbol2](that) {
    return isHostPort(that) && this.port === that.port && equals(this.host, that.host);
  },
  [symbol]() {
    return combine(hash(this.host), number(this.port));
  },
  toString() {
    return formatHostPort(this);
  },
  toJSON() {
    return this.toString();
  }
};
var isPort = (port) => Number.isInteger(port) && port >= 0 && port <= 65535;
var makeHostPort = (host, port) => {
  const self = Object.create(HostPortProto);
  self.host = host;
  self.port = port;
  return Object.freeze(self);
};
var hostPortFromString = (input) => {
  let hostText;
  let portText;
  if (input.startsWith("[")) {
    const end = input.indexOf("]");
    if (end === -1 || input[end + 1] !== ":") return hostError(input, "expected [IPv6]:port");
    hostText = input.slice(1, end);
    portText = input.slice(end + 2);
    if (!hostText.includes(":")) return hostError(input, "only IPv6 addresses use brackets");
  } else {
    const separator = input.lastIndexOf(":");
    if (separator === -1) return hostError(input, "expected host:port");
    if (input.indexOf(":") !== separator) return hostError(input, "IPv6 addresses must be bracketed");
    hostText = input.slice(0, separator);
    portText = input.slice(separator + 1);
  }
  if (!/^(0|[1-9]\d*)$/.test(portText)) {
    return hostError(input, "port must be an unpadded decimal integer");
  }
  const port = Number(portText);
  if (!isPort(port)) return hostError(input, "port must be an integer from 0 through 65535");
  return map2(hostFromString(hostText), (host) => makeHostPort(host, port));
};
var formatHostPort = (self) => {
  const host = formatHost2(self.host);
  return host.includes(":") ? `[${host}]:${self.port}` : `${host}:${self.port}`;
};

// node_modules/effect/dist/net/Dns.js
var RecordTypeId = "~effect/net/Dns/DnsRecord";
var isUint8 = (u) => Number.isInteger(u) && u >= 0 && u <= 255;
var isUint16 = (u) => Number.isInteger(u) && u >= 0 && u <= 65535;
var isUint32 = (u) => Number.isInteger(u) && u >= 0 && u <= 4294967295;
var isString2 = (u) => typeof u === "string";
var isTimer = (u) => isDuration(u) && isFinite(u) && isUint32(toSeconds(u));
var recordFields = {
  A: {
    address: isIpv4Address
  },
  AAAA: {
    address: isIpv6Address
  },
  CAA: {
    critical: (u) => typeof u === "boolean",
    tag: (u) => isString2(u) && /^[a-z0-9]+$/i.test(u),
    value: isString2
  },
  CNAME: {
    target: isDomainName
  },
  MX: {
    exchange: isDomainName,
    priority: isUint16
  },
  NAPTR: {
    order: isUint16,
    preference: isUint16,
    flags: isString2,
    service: isString2,
    regexp: isString2,
    replacement: isDomainName
  },
  NS: {
    host: isDomainName
  },
  PTR: {
    host: (u) => isString2(u) && u.length > 0
  },
  SOA: {
    primary: isDomainName,
    admin: (u) => isString2(u) && u.length > 0,
    serial: isUint32,
    refresh: isTimer,
    retry: isTimer,
    expire: isTimer,
    minimum: isTimer
  },
  SRV: {
    target: isDomainName,
    port: isUint16,
    priority: isUint16,
    weight: isUint16
  },
  TLSA: {
    certUsage: isUint8,
    selector: isUint8,
    matchingType: isUint8,
    data: (u) => u instanceof Uint8Array && u.length > 0
  },
  TXT: {
    chunks: (u) => Array.isArray(u) && u.length > 0 && u.every(isString2)
  }
};
var recordTypes = /* @__PURE__ */ Object.keys(recordFields);
var isRecordType = (u) => recordTypes.includes(u);
var isDnsRecord = (u) => hasProperty(u, RecordTypeId);
var RecordPrototype = {
  ...BaseProto,
  [RecordTypeId]: RecordTypeId,
  [symbol2](that) {
    return isDnsRecord(that) && that._tag === this._tag && Object.keys(this).every((key) => equals(this[key], that[key]));
  },
  [symbol]() {
    return structureKeys(this, Object.keys(this));
  },
  toString() {
    return formatRecord(this);
  },
  toJSON() {
    return {
      ...this
    };
  }
};
var makeRecord = (type, fields) => {
  if (!isRecordType(type)) {
    return fail2(new NetAddressError({
      input: type,
      message: "unknown DNS record type"
    }));
  }
  const input = typeof fields === "object" && fields !== null ? fields : {};
  const self = Object.create(RecordPrototype);
  self._tag = type;
  for (const [key, check2] of Object.entries(recordFields[type])) {
    const value3 = input[key];
    if (!check2(value3)) {
      return fail2(new NetAddressError({
        input: fields,
        message: `invalid ${type} record ${key}`
      }));
    }
    self[key] = Array.isArray(value3) ? Object.freeze([...value3]) : value3 instanceof Uint8Array ? new Uint8Array(value3) : value3;
  }
  return succeed2(Object.freeze(self));
};
var encoder3 = /* @__PURE__ */ new TextEncoder();
var decimalEscape = (byte) => `\\${byte.toString().padStart(3, "0")}`;
var quote = (value3) => {
  let out = '"';
  for (const byte of encoder3.encode(value3)) {
    out += byte === 34 || byte === 92 ? `\\${String.fromCharCode(byte)}` : byte < 32 || byte > 126 ? decimalEscape(byte) : String.fromCharCode(byte);
  }
  return out + '"';
};
var nameSpecials = [34, 36, 40, 41, 59, 64];
var formatName = (text) => {
  const bytes2 = encoder3.encode(text);
  let out = "";
  for (let i = 0; i < bytes2.length; i++) {
    const byte = bytes2[i];
    if (byte === 92) {
      const next = bytes2[i + 1];
      if (next === 46 || next === 92) {
        out += `\\${String.fromCharCode(next)}`;
        i++;
      } else {
        out += "\\\\";
      }
    } else if (byte <= 32 || byte > 126) {
      out += decimalEscape(byte);
    } else {
      out += nameSpecials.includes(byte) ? `\\${String.fromCharCode(byte)}` : String.fromCharCode(byte);
    }
  }
  return out;
};
var formatRecord = (self) => {
  switch (self._tag) {
    case "A":
    case "AAAA":
      return `${self._tag} ${formatIp(self.address)}`;
    case "CAA":
      return `CAA ${self.critical ? 128 : 0} ${self.tag} ${quote(self.value)}`;
    case "CNAME":
      return `CNAME ${self.target}`;
    case "MX":
      return `MX ${self.priority} ${self.exchange}`;
    case "NAPTR":
      return `NAPTR ${self.order} ${self.preference} ${quote(self.flags)} ${quote(self.service)} ${quote(self.regexp)} ${self.replacement}`;
    case "NS":
      return `NS ${self.host}`;
    case "PTR":
      return `PTR ${formatName(self.host)}`;
    case "SOA":
      return `SOA ${self.primary} ${formatName(self.admin)} ${self.serial} ${toSeconds(self.refresh)} ${toSeconds(self.retry)} ${toSeconds(self.expire)} ${toSeconds(self.minimum)}`;
    case "SRV":
      return `SRV ${self.priority} ${self.weight} ${self.port} ${self.target}`;
    case "TLSA":
      return `TLSA ${self.certUsage} ${self.selector} ${self.matchingType} ${encode(self.data).toUpperCase()}`;
    case "TXT":
      return `TXT ${self.chunks.map(quote).join(" ")}`;
  }
};

// node_modules/effect/dist/net/IpInterface.js
var TypeId27 = "~effect/net/IpInterface";
var isIpv4Interface = (u) => isIpInterface(u) && isIpv4Address(u.address);
var isIpv6Interface = (u) => isIpInterface(u) && isIpv6Address(u.address);
var isIpInterface = (u) => hasProperty(u, TypeId27);
var IpInterfaceProto = {
  ...BaseProto,
  _tag: "IpInterface",
  [TypeId27]: TypeId27,
  [symbol2](that) {
    return isIpInterface(that) && this.prefixLength === that.prefixLength && equals(this.address, that.address);
  },
  [symbol]() {
    return combine(hash(this.address), number(this.prefixLength));
  },
  toString() {
    return format5(this);
  },
  toJSON() {
    return this.toString();
  }
};
var interfaceError = (input, message) => fail2(new NetAddressError({
  input,
  message
}));
var make18 = (address, prefixLength) => {
  const max5 = width(address);
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > max5) {
    return interfaceError(address, `prefix length must be an integer from 0 through ${max5}`);
  }
  const self = Object.assign(Object.create(IpInterfaceProto), {
    address,
    prefixLength
  });
  return succeed2(Object.freeze(self));
};
var parseAddressWithPrefix = (input, options) => {
  const slash = input.indexOf("/");
  if (slash === -1 && options?.prefix !== "required") {
    return succeed2({
      address: input,
      prefixLength: void 0
    });
  }
  if (slash <= 0 || slash !== input.lastIndexOf("/") || slash === input.length - 1) {
    return interfaceError(input, "expected an address and prefix length separated by one slash");
  }
  const prefix = input.slice(slash + 1);
  if (!/^(0|[1-9][0-9]*)$/.test(prefix)) {
    return interfaceError(input, "prefix length must be an unpadded ASCII decimal integer");
  }
  return succeed2({
    address: input.slice(0, slash),
    prefixLength: Number(prefix)
  });
};
var ipv4FromString2 = (input, options) => flatMap2(parseAddressWithPrefix(input, options), (parts2) => flatMap2(ipv4FromString(parts2.address), (address) => make18(address, parts2.prefixLength ?? width(address))));
var ipv6FromString2 = (input, options) => flatMap2(parseAddressWithPrefix(input, options), (parts2) => flatMap2(ipv6FromString(parts2.address), (address) => make18(address, parts2.prefixLength ?? width(address))));
var fromString3 = (input, options) => flatMap2(parseAddressWithPrefix(input, options), (parts2) => flatMap2(ipFromString(parts2.address), (address) => make18(address, parts2.prefixLength ?? width(address))));
var format5 = (self) => `${formatIp(self.address)}/${self.prefixLength}`;

// node_modules/effect/dist/net/IpNetwork.js
var TypeId28 = "~effect/net/IpNetwork";
var isIpv4Network = (u) => isIpNetwork(u) && isIpv4Address(u.address);
var isIpv6Network = (u) => isIpNetwork(u) && isIpv6Address(u.address);
var isIpNetwork = (u) => hasProperty(u, TypeId28);
var IpNetworkProto = {
  ...BaseProto,
  _tag: "IpNetwork",
  [TypeId28]: TypeId28,
  [symbol2](that) {
    return isIpNetwork(that) && this.prefixLength === that.prefixLength && equals(this.address, that.address);
  },
  [symbol]() {
    return combine(hash(this.address), number(this.prefixLength));
  },
  toString() {
    return format6(this);
  },
  toJSON() {
    return this.toString();
  }
};
var fromInterfaceValue = (value3) => {
  const self = Object.assign(Object.create(IpNetworkProto), {
    address: value3.address,
    prefixLength: value3.prefixLength
  });
  return Object.freeze(self);
};
var toBytes = (address) => isIpv4Address(address) ? ipv4ToOctets(address) : ipv6ToOctets(address);
var maskBytes = (bytes2, prefixLength) => {
  const wholeBytes = Math.floor(prefixLength / 8);
  const partialBits = prefixLength % 8;
  return bytes2.map((byte, index2) => {
    if (index2 < wholeBytes) return byte;
    if (index2 === wholeBytes && partialBits !== 0) return byte & (255 << 8 - partialBits & 255);
    return 0;
  });
};
var make19 = (address, prefixLength) => {
  return flatMap2(make18(address, prefixLength), (value3) => {
    const bytes2 = toBytes(address);
    const masked = maskBytes(bytes2, prefixLength);
    if (bytes2.some((byte, index2) => byte !== masked[index2])) {
      return fail2(new NetAddressError({
        input: address,
        message: "address has non-zero host bits"
      }));
    }
    return succeed2(fromInterfaceValue(value3));
  });
};
var ipv4FromString3 = (input) => {
  return flatMap2(ipv4FromString2(input, {
    prefix: "required"
  }), (value3) => make19(value3.address, value3.prefixLength));
};
var ipv6FromString3 = (input) => {
  return flatMap2(ipv6FromString2(input, {
    prefix: "required"
  }), (value3) => make19(value3.address, value3.prefixLength));
};
var fromString4 = (input) => {
  return flatMap2(fromString3(input, {
    prefix: "required"
  }), (value3) => make19(value3.address, value3.prefixLength));
};
var format6 = (self) => `${formatIp(self.address)}/${self.prefixLength}`;

// node_modules/effect/dist/SemVer.js
var TypeId29 = "~effect/SemVer";
var SemVerErrorTypeId = "~effect/SemVer/SemVerError";
var SemVerError = class extends (/* @__PURE__ */ TaggedError2("SemVerError")) {
  [SemVerErrorTypeId] = SemVerErrorTypeId;
};
var isSemVerError = (u) => hasProperty(u, SemVerErrorTypeId);
var invalid4 = (message) => {
  throw new SemVerError({
    message
  });
};
var attempt = (evaluate2) => try_({
  try: evaluate2,
  catch: (error) => {
    if (!isSemVerError(error)) throw error;
    return error;
  }
});
var tryParse = (label, input, parse3) => mapError(attempt(() => parse3(input)), (error) => new SemVerError({
  message: `Invalid ${label} ${JSON.stringify(input)}: ${error.message}`,
  input
}));
var numericPattern = /^(?:0|[1-9]\d*)$/;
var digitsPattern = /^\d+$/;
var identifierPattern = /^[0-9A-Za-z-]+$/;
var checkComponent = (value3, label) => {
  if (!Number.isSafeInteger(value3) || value3 < 0) {
    return invalid4(`${label} must be a non-negative safe integer, received ${value3}`);
  }
  return value3;
};
var parseComponent = (value3, label) => {
  if (!numericPattern.test(value3)) {
    return invalid4(`${label} must be a non-negative integer without leading zeros, received ${JSON.stringify(value3)}`);
  }
  return checkComponent(Number(value3), label);
};
var prereleaseIdentifier = (identifier2) => {
  if (typeof identifier2 === "number") return checkComponent(identifier2, "numeric pre-release identifier");
  if (!identifierPattern.test(identifier2)) {
    return invalid4(`pre-release identifier must be non-empty [0-9A-Za-z-], received ${JSON.stringify(identifier2)}`);
  }
  return digitsPattern.test(identifier2) ? parseComponent(identifier2, "numeric pre-release identifier") : identifier2;
};
var buildIdentifier = (identifier2) => {
  if (!identifierPattern.test(identifier2)) {
    return invalid4(`build identifier must be non-empty [0-9A-Za-z-], received ${JSON.stringify(identifier2)}`);
  }
  return identifier2;
};
var SemVerProto = {
  [TypeId29]: TypeId29,
  [symbol2](that) {
    return isSemVer(that) && Equivalence8(this, that);
  },
  [symbol]() {
    return string(format7(this));
  },
  toString() {
    return `SemVer(${format7(this)})`;
  },
  toJSON() {
    return {
      _id: "SemVer",
      value: format7(this)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var unchecked = (major, minor, patch, prerelease, build) => {
  const self = Object.create(SemVerProto);
  self.major = major;
  self.minor = minor;
  self.patch = patch;
  self.prerelease = prerelease;
  self.build = build;
  return self;
};
var isSemVer = (u) => hasProperty(u, TypeId29);
var make20 = (components) => unchecked(checkComponent(components.major, "major"), checkComponent(components.minor, "minor"), checkComponent(components.patch, "patch"), components.prerelease?.map(prereleaseIdentifier) ?? [], components.build?.map(buildIdentifier) ?? []);
var parseOrThrow = (input) => {
  let rest = input;
  let build = [];
  const plus = rest.indexOf("+");
  if (plus !== -1) {
    build = rest.slice(plus + 1).split(".").map(buildIdentifier);
    rest = rest.slice(0, plus);
  }
  let prerelease = [];
  const dash = rest.indexOf("-");
  if (dash !== -1) {
    prerelease = rest.slice(dash + 1).split(".").map(prereleaseIdentifier);
    rest = rest.slice(0, dash);
  }
  const core = rest.split(".");
  if (core.length !== 3) return invalid4("expected MAJOR.MINOR.PATCH");
  return unchecked(parseComponent(core[0], "major"), parseComponent(core[1], "minor"), parseComponent(core[2], "patch"), prerelease, build);
};
var parse = (input) => tryParse("SemVer", input, parseOrThrow);
var format7 = (self) => {
  let out = `${self.major}.${self.minor}.${self.patch}`;
  if (self.prerelease.length > 0) out += `-${self.prerelease.join(".")}`;
  if (self.build.length > 0) out += `+${self.build.join(".")}`;
  return out;
};
var identifiersEqual = /* @__PURE__ */ Array_(/* @__PURE__ */ strictEqual());
var Equivalence8 = /* @__PURE__ */ make((self, that) => self.major === that.major && self.minor === that.minor && self.patch === that.patch && identifiersEqual(self.prerelease, that.prerelease) && identifiersEqual(self.build, that.build));

// node_modules/effect/dist/SemVerRange.js
var TypeId30 = "~effect/SemVerRange";
var SemVerRangeProto = {
  [TypeId30]: TypeId30,
  [symbol2](that) {
    return isSemVerRange(that) && format8(this) === format8(that);
  },
  [symbol]() {
    return string(format8(this));
  },
  toString() {
    return `SemVerRange(${format8(this)})`;
  },
  toJSON() {
    return {
      _id: "SemVerRange",
      value: format8(this)
    };
  },
  [NodeInspectSymbol]() {
    return this.toJSON();
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isSemVerRange = (u) => hasProperty(u, TypeId30);
var wildcard = {
  components: [],
  prerelease: []
};
var operatorPattern = /^(<=|>=|<|>|=|~|\^)?(.*)$/;
var isWildcard = (part) => part === "x" || part === "X" || part === "*";
var componentLabels = ["major", "minor", "patch"];
var parsePartial = (input) => {
  if (input.length === 0) return invalid4("expected a version after the operator");
  if (input.includes("+")) {
    return invalid4(`build metadata is not allowed in ranges, received ${JSON.stringify(input)}`);
  }
  const dash = input.indexOf("-");
  const parts2 = (dash === -1 ? input : input.slice(0, dash)).split(".");
  if (parts2.length > 3) return invalid4(`expected at most MAJOR.MINOR.PATCH, received ${JSON.stringify(input)}`);
  const components = [];
  for (let i = 0; i < parts2.length; i++) {
    if (isWildcard(parts2[i])) continue;
    if (components.length < i) {
      return invalid4(`a version component cannot follow a wildcard, received ${JSON.stringify(input)}`);
    }
    components.push(parseComponent(parts2[i], componentLabels[i]));
  }
  if (dash === -1) return {
    components,
    prerelease: []
  };
  if (components.length < 3) {
    return invalid4(`a pre-release requires MAJOR.MINOR.PATCH, received ${JSON.stringify(input)}`);
  }
  return {
    components,
    prerelease: input.slice(dash + 1).split(".").map(prereleaseIdentifier)
  };
};
var parseComparatorSet = (input) => {
  const tokens = input.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) return invalid4("expected a comparator");
  if (tokens.length === 3 && tokens[1] === "-") {
    return [{
      _tag: "Hyphen",
      from: parsePartial(tokens[0]),
      to: parsePartial(tokens[2])
    }];
  }
  const comparators = [];
  for (let i = 0; i < tokens.length; i++) {
    const [, operator, rest] = operatorPattern.exec(tokens[i]);
    const version = rest.length === 0 && operator !== void 0 && i + 1 < tokens.length ? tokens[++i] : rest;
    comparators.push({
      _tag: "Comparator",
      operator: operator ?? "=",
      version: parsePartial(version)
    });
  }
  return comparators;
};
var makeRange = (sets) => {
  const self = Object.create(SemVerRangeProto);
  self.sets = sets;
  return self;
};
var parseOrThrow2 = (input) => {
  if (input.trim().length === 0) return any2;
  return makeRange(input.split("||").map(parseComparatorSet));
};
var parse2 = (input) => tryParse("SemVer range", input, parseOrThrow2);
var parseUnsafe = (input) => getOrThrow(parse2(input));
var any2 = /* @__PURE__ */ makeRange([[{
  _tag: "Comparator",
  operator: "=",
  version: wildcard
}]]);
var formatPartial = (self) => {
  if (self.components.length === 0) return "*";
  const core = self.components.join(".");
  return self.prerelease.length === 0 ? core : `${core}-${self.prerelease.join(".")}`;
};
var formatComparator = (self) => self._tag === "Hyphen" ? `${formatPartial(self.from)} - ${formatPartial(self.to)}` : `${self.operator === "=" ? "" : self.operator}${formatPartial(self.version)}`;
var format8 = (self) => self.sets.map((set6) => set6.map(formatComparator).join(" ")).join(" || ");

// node_modules/effect/dist/Schema.js
var TypeId31 = TypeId24;
function declareConstructor() {
  return (typeParameters, run2, annotations) => {
    return make21(new Declaration(typeParameters.map(getAST), (typeParameters2) => run2(typeParameters2.map((ast) => make21(ast))), annotations));
  };
}
function declare(is3, annotations) {
  return declareConstructor()([], () => (input, ast, options) => is3(input) ? succeed5(input) : fail5(new InvalidType(ast, input, options)), annotations);
}
function revealBottom(bottom) {
  return bottom;
}
function annotate2(annotations) {
  return (self) => self.annotate(annotations);
}
function annotateEncoded(annotations) {
  return (self) => flip5(flip5(self).annotate(annotations));
}
function annotateKey2(annotations) {
  return (self) => {
    return self.rebuild(annotateKey(self.ast, annotations));
  };
}
function revealCodec(codec) {
  return codec;
}
var SchemaError = class extends (/* @__PURE__ */ TaggedError2("SchemaError")) {
  [SchemaErrorTypeId] = SchemaErrorTypeId;
  constructor(issue) {
    const stackTraceLimit = getStackTraceLimit();
    setStackTraceLimit(0);
    try {
      super({
        issue
      });
    } finally {
      setStackTraceLimit(stackTraceLimit);
    }
  }
  get message() {
    return defaultFormatter(this.issue);
  }
  toJSON() {
    return {
      _tag: this._tag,
      message: this.message
    };
  }
  [NodeInspectSymbol]() {
    return this.toJSON();
  }
  toString() {
    return `SchemaError(${this.message})`;
  }
};
function isSchemaError2(u) {
  return isSchemaError(u);
}
function fromIssueEffect(self) {
  if (effectIsExit(self)) {
    return fromIssueExit(self);
  }
  return catchCause2(self, (cause) => failCauseSync2(() => map6(cause, (issue) => new SchemaError(issue))));
}
function fromIssueExit(exit3) {
  return isSuccess4(exit3) ? exit3 : failCause2(map6(exit3.cause, (issue) => new SchemaError(issue)));
}
function getSchemaErrorOrThrow(cause, message) {
  let schemaError;
  for (const reason of cause.reasons) {
    if (!isFailReason2(reason) || !isSchemaError2(reason.error)) {
      throw new globalThis.Error(message, {
        cause
      });
    }
    schemaError ??= reason.error;
  }
  if (schemaError === void 0) {
    throw new globalThis.Error(message, {
      cause
    });
  }
  return schemaError;
}
function runSchemaErrorPromise(self) {
  return runPromiseExit2(self).then((exit3) => {
    if (isSuccess4(exit3)) {
      return exit3.value;
    }
    throw getSchemaErrorOrThrow(exit3.cause, "Promise adapter can only reject schema errors");
  });
}
function runSchemaErrorSync(self) {
  const exit3 = runSyncExit2(self);
  if (isSuccess4(exit3)) {
    return exit3.value;
  }
  throw getSchemaErrorOrThrow(exit3.cause, "Sync adapter can only throw schema errors");
}
function toStandardSchemaV12(self, options) {
  return toStandardSchemaV1(self, options);
}
function toStandardJSONSchemaV12(self) {
  return toStandardJSONSchemaV1(self);
}
var is2 = is;
var asserts2 = asserts;
function decodeUnknownEffect2(schema, options) {
  const parser = decodeUnknownEffect(schema, options);
  return (input, options2) => {
    return fromIssueEffect(parser(input, options2));
  };
}
var decodeEffect2 = decodeUnknownEffect2;
function decodeUnknownExit2(schema, options) {
  const parser = decodeUnknownExit(schema, options);
  return (input, options2) => {
    return fromIssueExit(parser(input, options2));
  };
}
var decodeExit = decodeUnknownExit2;
var decodeUnknownOption2 = decodeUnknownOption;
var decodeOption2 = decodeOption;
function decodeUnknownResult2(schema, options) {
  const parser = decodeUnknownResult(schema, options);
  return (input, options2) => {
    return mapError(parser(input, options2), (issue) => new SchemaError(issue));
  };
}
var decodeResult = decodeUnknownResult2;
function decodeUnknownPromise(schema, options) {
  const parser = decodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorPromise(parser(input, options2));
  };
}
var decodePromise = decodeUnknownPromise;
function decodeUnknownSync2(schema, options) {
  const parser = decodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorSync(parser(input, options2));
  };
}
var decodeSync2 = decodeUnknownSync2;
function encodeUnknownEffect2(schema, options) {
  const parser = encodeUnknownEffect(schema, options);
  return (input, options2) => {
    return fromIssueEffect(parser(input, options2));
  };
}
var encodeEffect2 = encodeUnknownEffect2;
function encodeUnknownExit2(schema, options) {
  const parser = encodeUnknownExit(schema, options);
  return (input, options2) => {
    return fromIssueExit(parser(input, options2));
  };
}
var encodeExit = encodeUnknownExit2;
var encodeUnknownOption2 = encodeUnknownOption;
var encodeOption2 = encodeOption;
function encodeUnknownResult2(schema, options) {
  const parser = encodeUnknownResult(schema, options);
  return (input, options2) => {
    return mapError(parser(input, options2), (issue) => new SchemaError(issue));
  };
}
var encodeResult = encodeUnknownResult2;
function encodeUnknownPromise(schema, options) {
  const parser = encodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorPromise(parser(input, options2));
  };
}
var encodePromise = encodeUnknownPromise;
function encodeUnknownSync2(schema, options) {
  const parser = encodeUnknownEffect2(schema, options);
  return (input, options2) => {
    return runSchemaErrorSync(parser(input, options2));
  };
}
var encodeSync2 = encodeUnknownSync2;
var make21 = make16;
function isSchema(u) {
  return hasProperty(u, TypeId31) && u[TypeId31] === TypeId31;
}
var optionalKey2 = /* @__PURE__ */ lambda((schema) => make21(optionalKey(schema.ast), {
  schema
}));
var requiredKey = /* @__PURE__ */ lambda((self) => self.schema);
var optional2 = /* @__PURE__ */ lambda((self) => {
  const schema = UndefinedOr(self);
  return make21(optional(self.ast), {
    schema
  });
});
var required = /* @__PURE__ */ lambda((self) => self.schema.members[0]);
var mutableKey2 = /* @__PURE__ */ lambda((schema) => make21(mutableKey(schema.ast), {
  schema
}));
var readonlyKey = /* @__PURE__ */ lambda((self) => self.schema);
var toType2 = /* @__PURE__ */ lambda((schema) => make21(toType(schema.ast), {
  schema
}));
var toEncoded2 = /* @__PURE__ */ lambda((schema) => make21(toEncoded(schema.ast), {
  schema
}));
var FlipTypeId = "~effect/Schema/flip";
function isFlip$(schema) {
  return hasProperty(schema, FlipTypeId) && schema[FlipTypeId] === FlipTypeId;
}
function flip5(schema) {
  if (isFlip$(schema)) {
    return schema.schema.rebuild(flip4(schema.ast));
  }
  return make21(flip4(schema.ast), {
    [FlipTypeId]: FlipTypeId,
    schema
  });
}
function Literal2(literal) {
  const out = make21(new Literal(literal), {
    literal,
    transform(to) {
      return out.pipe(decodeTo2(Literal2(to), {
        decode: transform(() => to),
        encode: transform(() => literal)
      }));
    }
  });
  return out;
}
function templateLiteralParts(parts2) {
  return parts2.map((part) => isSchema(part) ? part.ast : new Literal(part));
}
function TemplateLiteral2(parts2) {
  return make21(new TemplateLiteral(templateLiteralParts(parts2)), {
    parts: parts2
  });
}
function TemplateLiteralParser(parts2) {
  return make21(templateLiteralParser(templateLiteralParts(parts2)), {
    parts: parts2
  });
}
function Enum2(enums) {
  return make21(new Enum(Object.keys(enums).filter((key) => typeof enums[enums[key]] !== "number").map((key) => [key, enums[key]])), {
    enums
  });
}
var Never2 = /* @__PURE__ */ make21(never3);
var Any2 = /* @__PURE__ */ make21(any);
var Unknown2 = /* @__PURE__ */ make21(unknown);
var Null2 = /* @__PURE__ */ make21(null_);
var Undefined2 = /* @__PURE__ */ make21(undefined_3);
var String6 = /* @__PURE__ */ make21(string2);
var StringForLiteralAutocomplete = String6;
var Number6 = /* @__PURE__ */ make21(number2);
var Boolean3 = /* @__PURE__ */ make21(boolean);
var Symbol3 = /* @__PURE__ */ make21(symbol3);
var BigInt6 = /* @__PURE__ */ make21(bigInt);
var Void2 = /* @__PURE__ */ make21(void_5);
var ObjectKeyword2 = /* @__PURE__ */ make21(objectKeyword);
function UniqueSymbol2(symbol4) {
  return make21(new UniqueSymbol(symbol4));
}
function makeStruct(ast, fields) {
  return make21(ast, {
    fields,
    mapFields(f, options) {
      const fields2 = f(this.fields);
      return makeStruct(struct(fields2, options?.unsafePreserveChecks ? this.ast.checks : void 0), fields2);
    }
  });
}
function Struct(fields) {
  return makeStruct(struct(fields, void 0), fields);
}
function fieldsAssign(fields) {
  return lambda((struct2) => struct2.mapFields(assign(fields)));
}
var canonicalPropertyKey = (key) => typeof key === "symbol" ? key : globalThis.String(key);
function encodeKeys(mapping) {
  return function(self) {
    const fields = {};
    const appliedMapping = /* @__PURE__ */ Object.create(null);
    const reverseMapping = /* @__PURE__ */ Object.create(null);
    const seenEncodedKeys = /* @__PURE__ */ new Set();
    for (const k of Reflect.ownKeys(self.fields)) {
      const encoded = toEncoded2(self.fields[k]);
      const hasMapping = Object.hasOwn(mapping, k);
      const encodedKey = hasMapping ? mapping[k] : k;
      const canonical = canonicalPropertyKey(encodedKey);
      if (seenEncodedKeys.has(canonical)) {
        throw new globalThis.Error(`Duplicate encoded keys: ${formatPropertyKey(encodedKey)}`);
      }
      seenEncodedKeys.add(canonical);
      assignProperty(fields, encodedKey, encoded);
      if (hasMapping) {
        appliedMapping[k] = encodedKey;
        reverseMapping[encodedKey] = k;
      }
    }
    return Struct(fields).pipe(decodeTo2(self, transform2({
      decode: renameKeys(reverseMapping),
      encode: renameKeys(appliedMapping)
    })));
  };
}
function extendTo(fields, derive) {
  return (self) => {
    const f = map3(self.fields, toType2);
    const to = Struct({
      ...f,
      ...fields
    });
    return self.pipe(decodeTo2(to, transform2({
      decode: (input) => {
        const out = {
          ...input
        };
        for (const k in fields) {
          const f2 = derive[k];
          const o = f2(input);
          if (isSome2(o)) {
            assignProperty(out, k, o.value);
          }
        }
        return out;
      },
      encode: (input) => {
        const out = {
          ...input
        };
        for (const k in fields) {
          delete out[k];
        }
        return out;
      }
    })));
  };
}
function Record(key, value3) {
  return make21(record(key.ast, value3.ast), {
    key,
    value: value3
  });
}
function StructWithRest(schema, records) {
  return make21(structWithRest(schema.ast, records.map(getAST)), {
    schema,
    records
  });
}
function makeTuple(ast, elements) {
  return make21(ast, {
    elements,
    mapElements(f, options) {
      const elements2 = f(this.elements);
      return makeTuple(tuple(elements2, options?.unsafePreserveChecks ? this.ast.checks : void 0), elements2);
    }
  });
}
function Tuple2(elements) {
  return makeTuple(tuple(elements), elements);
}
function TupleWithRest(schema, rest) {
  return make21(tupleWithRest(schema.ast, rest.map(getAST)), {
    schema,
    rest
  });
}
var ArraySchema = /* @__PURE__ */ lambda((schema) => make21(new Arrays(false, [], [schema.ast]), {
  value: schema
}));
function withArrayLengthConstraints(self, minimum, maximum) {
  if (minimum !== void 0 && maximum !== void 0) {
    return self.check(isBetweenLength(minimum, maximum));
  }
  if (minimum !== void 0) return self.check(isMinLength(minimum));
  if (maximum !== void 0) return self.check(isMaxLength(maximum));
  return self;
}
var NonEmptyArray = /* @__PURE__ */ lambda((schema) => make21(new Arrays(false, [schema.ast], [schema.ast]), {
  value: schema
}));
function ArrayEnsure(schema) {
  const many = ArraySchema(schema);
  const to = ArraySchema(toType2(schema));
  const one = decodeTo2(Tuple2([Unknown2]), transform2({
    decode: (value3) => [value3],
    encode: ([value3]) => value3
  }))(schema);
  return make21(Union2([one, many]).pipe(decodeTo2(to)).ast, {
    from: Union2([schema, many]),
    to
  });
}
function UniqueArray(item) {
  return ArraySchema(item).check(isUnique());
}
var mutable2 = /* @__PURE__ */ lambda((schema) => make21(mutable(schema.ast), {
  schema
}));
function makeUnion(ast, members) {
  return make21(ast, {
    members,
    mapMembers(f, options) {
      const members2 = f(this.members);
      return makeUnion(union4(members2, this.ast.options, options?.unsafePreserveChecks ? this.ast.checks : void 0), members2);
    }
  });
}
function Union2(members, options) {
  return makeUnion(union4(members, options, void 0), members);
}
function Literals(literals) {
  const members = literals.map(Literal2);
  return make21(union4(members, void 0, void 0), {
    literals,
    members,
    mapMembers(f) {
      return Union2(f(this.members));
    },
    pick(literals2) {
      return Literals(literals2);
    },
    transform(to) {
      return Union2(members.map((member, index2) => member.transform(to[index2])));
    }
  });
}
var NullOr = /* @__PURE__ */ lambda((self) => Union2([self, Null2]));
var UndefinedOr = /* @__PURE__ */ lambda((self) => Union2([self, Undefined2]));
var NullishOr = /* @__PURE__ */ lambda((self) => Union2([self, Null2, Undefined2]));
function suspend3(f) {
  return make21(new Suspend(() => f().ast));
}
function check(...checks) {
  return (self) => self.check(...checks);
}
function refine(refinement, annotations) {
  return (schema) => make21(appendChecks(schema.ast, [makeFilterByGuard(refinement, annotations)]), {
    schema
  });
}
function brand(identifier2) {
  return (schema) => make21(schema.ast, {
    schema,
    identifier: identifier2
  });
}
function fromBrand(identifier2, ctor) {
  return (self) => (
    // The constructor already guarantees a single concrete brand key.
    (ctor.checks ? self.check(...ctor.checks) : self).pipe(brand(identifier2))
  );
}
function middlewareDecoding2(decode5) {
  return (schema) => make21(middlewareDecoding(schema.ast, new Middleware(decode5, identity)), {
    schema
  });
}
function middlewareEncoding2(encode5) {
  return (schema) => make21(middlewareEncoding(schema.ast, new Middleware(identity, encode5)), {
    schema
  });
}
function catchDecoding(f) {
  return catchDecodingWithContext(f);
}
function catchDecodingWithContext(f) {
  return (self) => middlewareDecoding2(catchEager2(f))(self);
}
function catchEncoding(f) {
  return catchEncodingWithContext(f);
}
function catchEncodingWithContext(f) {
  return (self) => middlewareEncoding2(catchEager2(f))(self);
}
function decodeTo2(to, transformation) {
  return (from) => {
    return make21(decodeTo(from.ast, to.ast, transformation ? makeTransformation(transformation) : passthrough3()), {
      from,
      to
    });
  };
}
function linkDecoding() {
  return (to, decode5) => link()(to, {
    decode: decode5,
    encode: forbiddenEncoding
  });
}
var TrueLiterals = /* @__PURE__ */ Literals(["true", "yes", "on", "1", "y"]);
var FalseLiterals = /* @__PURE__ */ Literals(["false", "no", "off", "0", "n"]);
var BooleanLiterals = /* @__PURE__ */ Literals([...TrueLiterals.literals, ...FalseLiterals.literals]).pipe(/* @__PURE__ */ decodeTo2(Boolean3, /* @__PURE__ */ transform2({
  decode: (value3) => value3 === "true" || value3 === "yes" || value3 === "on" || value3 === "1" || value3 === "y",
  encode: (value3) => value3 ? "true" : "false"
})));
function decode4(transformation) {
  return (self) => {
    return decodeTo2(toType2(self), transformation)(self);
  };
}
function encodeTo(to, transformation) {
  return (from) => {
    return transformation ? decodeTo2(from, transformation)(to) : decodeTo2(from)(to);
  };
}
function encode4(transformation) {
  return (self) => {
    return decodeTo2(self, transformation)(toEncoded2(self));
  };
}
function withConstructorDefault2(defaultValue) {
  return (schema) => make21(withConstructorDefault(schema.ast, defaultValue), {
    schema
  });
}
function toIssueEffect(self) {
  if (effectIsExit(self) && self._tag === "Success") {
    return self;
  }
  return catchCause2(self, (cause) => failCauseSync2(() => map6(cause, (error) => error.issue)));
}
function withDecodingDefaultKey(defaultValue, options) {
  const encode5 = options?.encodingStrategy === "omit" ? omit() : passthrough2();
  return (self) => {
    return optionalKey2(toEncoded2(self)).pipe(decodeTo2(self, {
      decode: withDefault(toIssueEffect(defaultValue)),
      encode: encode5
    }));
  };
}
function withDecodingDefaultTypeKey(defaultValue, options) {
  return (self) => {
    return toType2(self).pipe(withDecodingDefaultKey(defaultValue, options), encodeTo(optionalKey2(self)));
  };
}
function withDecodingDefault(defaultValue, options) {
  const encode5 = options?.encodingStrategy === "omit" ? omit() : passthrough2();
  return (self) => {
    return optional2(toEncoded2(self)).pipe(decodeTo2(self, {
      decode: withDefault(toIssueEffect(defaultValue)),
      encode: encode5
    }));
  };
}
function withDecodingDefaultType(defaultValue, options) {
  return (self) => {
    return toType2(self).pipe(withDecodingDefault(defaultValue, options), encodeTo(optional2(self)));
  };
}
function tag(literal) {
  return Literal2(literal).pipe(withConstructorDefault2(succeed5(literal)));
}
function tagDefaultOmit(literal) {
  return tag(literal).pipe(withDecodingDefaultKey(succeed5(literal), {
    encodingStrategy: "omit"
  }));
}
function TaggedStruct(value3, fields) {
  return Struct({
    _tag: tag(value3),
    ...fields
  });
}
function toTaggedUnion(tag2) {
  return (self) => {
    const cases = {};
    const discriminants = [];
    const discriminantKeys = /* @__PURE__ */ new Set();
    const guards = {};
    const isAnyOf = (keys3) => (value3) => keys3.includes(value3[tag2]);
    walk(self);
    return Object.assign(self, {
      tag: tag2,
      cases,
      discriminants,
      isAnyOf,
      guards,
      match: match7,
      matchOrElse
    });
    function walk(schema) {
      const ast = schema.ast;
      if (isUnion(ast) && "members" in schema && globalThis.Array.isArray(schema.members) && schema.members.every(isSchema)) {
        return schema.members.forEach(walk);
      }
      const sentinels = collectSentinels(ast);
      if (sentinels.length > 0) {
        const literal = sentinels.find((s) => s.key === tag2)?.literal;
        if (isPropertyKey(literal)) {
          const key = typeof literal === "number" ? globalThis.String(literal) : literal;
          if (discriminantKeys.has(key)) {
            throw new globalThis.Error(`Duplicate discriminant: ${globalThis.String(literal)}`);
          }
          discriminantKeys.add(key);
          discriminants.push(literal);
          assignProperty(cases, literal, schema);
          assignProperty(guards, literal, is(toType2(schema)));
          return;
        }
      }
      throw new globalThis.Error("No literal or unique symbol found");
    }
    function match7() {
      if (arguments.length === 1) {
        const cases3 = arguments[0];
        return function(value4) {
          const key2 = value4[tag2];
          const handler2 = Object.hasOwn(cases3, key2) ? cases3[key2] : void 0;
          return handler2(value4);
        };
      }
      const value3 = arguments[0];
      const cases2 = arguments[1];
      const key = value3[tag2];
      const handler = Object.hasOwn(cases2, key) ? cases2[key] : void 0;
      return handler(value3);
    }
    function matchOrElse() {
      if (arguments.length === 2) {
        const cases3 = arguments[0];
        const orElse3 = arguments[1];
        return function(value4) {
          const key2 = value4[tag2];
          const handler2 = Object.hasOwn(cases3, key2) ? cases3[key2] ?? orElse3 : orElse3;
          return handler2(value4);
        };
      }
      const value3 = arguments[0];
      const cases2 = arguments[1];
      const orElse2 = arguments[2];
      const key = value3[tag2];
      const handler = Object.hasOwn(cases2, key) ? cases2[key] ?? orElse2 : orElse2;
      return handler(value3);
    }
  };
}
function TaggedUnion(casesByTag) {
  const cases = {};
  const members = [];
  for (const key of Object.keys(casesByTag)) {
    const member = TaggedStruct(key, casesByTag[key]);
    assignProperty(cases, key, member);
    members.push(member);
  }
  const union5 = Union2(members);
  const {
    tag: tag2,
    guards,
    isAnyOf,
    match: match7,
    matchOrElse
  } = toTaggedUnion("_tag")(union5);
  return make21(union5.ast, {
    tag: tag2,
    cases,
    isAnyOf,
    guards,
    match: match7,
    matchOrElse
  });
}
function Opaque() {
  return (schema) => schema;
}
function instanceOf(constructor, annotations) {
  return declare((u) => u instanceof constructor, annotations);
}
function link() {
  return (encodeTo2, transformation) => {
    return new Link(encodeTo2.ast, makeTransformation(transformation));
  };
}
var makeFilter2 = makeFilter;
function makeFilterGroup(checks, annotations = void 0) {
  return new FilterGroup(checks, annotations);
}
var TRIMMED_PATTERN = "^\\S[\\s\\S]*\\S$|^\\S$|^$";
function isTrimmed(annotations) {
  const regExp = new globalThis.RegExp(TRIMMED_PATTERN);
  return makeFilter2((s) => s.trim() === s, {
    expected: "a string with no leading or trailing whitespace",
    representation: {
      id: "effect/schema/isTrimmed",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isTrimmed()"
    }),
    arbitraryConstraint: {
      patterns: [{
        source: TRIMMED_PATTERN,
        flags: ""
      }]
    },
    ...annotations
  });
}
function isPattern2(regExp, annotations) {
  const source = regExp.source;
  const flags = regExp.flags;
  const canExport = /^[dg]*uy?$/.test(flags);
  const runtimeRegExp = flags === "" ? `new RegExp(${format(source)})` : `new RegExp(${format(source)}, ${format(flags)})`;
  return isPattern(regExp, {
    toJsonSchema: () => canExport ? {
      pattern: flags.endsWith("y") ? `^(?:${source})` : source
    } : [{}, true],
    toCode: () => ({
      runtime: `Schema.isPattern(${runtimeRegExp})`
    }),
    ...annotations
  });
}
function isStringFinite2(annotations) {
  return isStringFinite({
    toCode: () => ({
      runtime: "Schema.isStringFinite()"
    }),
    ...annotations
  });
}
function isStringBigInt2(annotations) {
  return isStringBigInt({
    toCode: () => ({
      runtime: "Schema.isStringBigInt()"
    }),
    ...annotations
  });
}
function isStringSymbol2(annotations) {
  return isStringSymbol({
    toCode: () => ({
      runtime: "Schema.isStringSymbol()"
    }),
    ...annotations
  });
}
var getUUIDRegExp = (version) => {
  if (version) {
    return new globalThis.RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
  }
  return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|[fF]{8}-[fF]{4}-[fF]{4}-[fF]{4}-[fF]{12})$/;
};
function isUUID(version, annotations) {
  const regExp = getUUIDRegExp(version);
  return isPattern2(regExp, {
    expected: version ? `a UUID v${version}` : "a UUID",
    representation: {
      id: "effect/schema/isUUID",
      payload: {
        version: version ?? null
      }
    },
    toJsonSchema: () => ({
      pattern: regExp.source,
      format: "uuid"
    }),
    toCode: () => ({
      runtime: version === void 0 ? "Schema.isUUID()" : `Schema.isUUID(${version})`
    }),
    ...annotations
  });
}
var GUID_REGEXP = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
function isGUID(annotations) {
  return isPattern2(GUID_REGEXP, {
    expected: "a GUID",
    representation: {
      id: "effect/schema/isGUID",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: GUID_REGEXP.source
    }),
    toCode: () => ({
      runtime: "Schema.isGUID()"
    }),
    ...annotations
  });
}
function isULID(annotations) {
  const regExp = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
  return isPattern2(regExp, {
    representation: {
      id: "effect/schema/isULID",
      payload: null
    },
    toJsonSchema: () => ({
      pattern: regExp.source
    }),
    toCode: () => ({
      runtime: "Schema.isULID()"
    }),
    ...annotations
  });
}
function isBase64(annotations) {
  const pattern = "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$";
  const regExp = /^[0-9a-zA-Z+/]*={0,2}$/;
  return makeFilter2((s) => s.length % 4 === 0 && regExp.test(s), {
    expected: "a base64 encoded string",
    representation: {
      id: "effect/schema/isBase64",
      payload: null
    },
    toJsonSchema: () => ({
      pattern
    }),
    arbitraryConstraint: {
      patterns: [{
        source: pattern,
        flags: ""
      }]
    },
    toCode: () => ({
      runtime: "Schema.isBase64()"
    }),
    ...annotations
  });
}
function isBase64Url(annotations) {
  const pattern = "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$";
  const regExp = /^[0-9a-zA-Z-_]*={0,2}$/;
  return makeFilter2((s) => regExp.test(s) && (s.endsWith("=") ? s.length % 4 === 0 : s.length % 4 !== 1), {
    expected: "a base64url encoded string",
    representation: {
      id: "effect/schema/isBase64Url",
      payload: null
    },
    toJsonSchema: () => ({
      pattern
    }),
    arbitraryConstraint: {
      patterns: [{
        source: pattern,
        flags: ""
      }]
    },
    toCode: () => ({
      runtime: "Schema.isBase64Url()"
    }),
    ...annotations
  });
}
function literalToJsonSchema(literal, original, pattern) {
  if (literal.length === 0) return original.length === 0 ? {} : [{}, true];
  const constraint = {
    pattern: new globalThis.RegExp(pattern).source
  };
  return literal === original ? constraint : [constraint, true];
}
function isStartingWith(startsWith, annotations) {
  const formatted = JSON.stringify(startsWith);
  const regExp = new globalThis.RegExp(`^${escape(startsWith)}`);
  const jsonSchemaLiteral = startsWith.replace(/[\uD800-\uDBFF]$/, "");
  return makeFilter2((s) => s.startsWith(startsWith), {
    expected: `a string starting with ${formatted}`,
    representation: {
      id: "effect/schema/isStartingWith",
      payload: {
        startsWith
      }
    },
    toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, startsWith, `^${escape(jsonSchemaLiteral)}`),
    toCode: () => ({
      runtime: `Schema.isStartingWith(${format(startsWith)})`
    }),
    arbitraryConstraint: {
      patterns: [{
        source: regExp.source,
        flags: regExp.flags
      }]
    },
    ...annotations
  });
}
function isEndingWith(endsWith, annotations) {
  const formatted = JSON.stringify(endsWith);
  const regExp = new globalThis.RegExp(`${escape(endsWith)}$`);
  const jsonSchemaLiteral = endsWith.replace(/^[\uDC00-\uDFFF]/, "");
  return makeFilter2((s) => s.endsWith(endsWith), {
    expected: `a string ending with ${formatted}`,
    representation: {
      id: "effect/schema/isEndingWith",
      payload: {
        endsWith
      }
    },
    toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, endsWith, `${escape(jsonSchemaLiteral)}$`),
    toCode: () => ({
      runtime: `Schema.isEndingWith(${format(endsWith)})`
    }),
    arbitraryConstraint: {
      patterns: [{
        source: regExp.source,
        flags: regExp.flags
      }]
    },
    ...annotations
  });
}
function isIncluding(includes, annotations) {
  const formatted = JSON.stringify(includes);
  const regExp = new globalThis.RegExp(escape(includes));
  const jsonSchemaLiteral = includes.replace(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/g, "");
  return makeFilter2((s) => s.includes(includes), {
    expected: `a string including ${formatted}`,
    representation: {
      id: "effect/schema/isIncluding",
      payload: {
        includes
      }
    },
    toJsonSchema: () => literalToJsonSchema(jsonSchemaLiteral, includes, escape(jsonSchemaLiteral)),
    toCode: () => ({
      runtime: `Schema.isIncluding(${format(includes)})`
    }),
    arbitraryConstraint: {
      patterns: [{
        source: regExp.source,
        flags: regExp.flags
      }]
    },
    ...annotations
  });
}
var UPPERCASED_PATTERN = "^[^a-z]*$";
function isUppercased(annotations) {
  const regExp = new globalThis.RegExp(UPPERCASED_PATTERN);
  return makeFilter2((s) => s.toUpperCase() === s, {
    expected: "a string with all characters in uppercase",
    representation: {
      id: "effect/schema/isUppercased",
      payload: null
    },
    toJsonSchema: () => [{
      pattern: regExp.source
    }, true],
    toCode: () => ({
      runtime: "Schema.isUppercased()"
    }),
    arbitraryConstraint: {
      patterns: [{
        source: UPPERCASED_PATTERN,
        flags: ""
      }]
    },
    ...annotations
  });
}
var LOWERCASED_PATTERN = "^[^A-Z]*$";
function isLowercased(annotations) {
  const regExp = new globalThis.RegExp(LOWERCASED_PATTERN);
  return makeFilter2((s) => s.toLowerCase() === s, {
    expected: "a string with all characters in lowercase",
    representation: {
      id: "effect/schema/isLowercased",
      payload: null
    },
    toJsonSchema: () => [{
      pattern: regExp.source
    }, true],
    toCode: () => ({
      runtime: "Schema.isLowercased()"
    }),
    arbitraryConstraint: {
      patterns: [{
        source: LOWERCASED_PATTERN,
        flags: ""
      }]
    },
    ...annotations
  });
}
var CAPITALIZED_PATTERN = "^(?:[^a-z][\\s\\S]*)?$";
function isCapitalized(annotations) {
  const regExp = new globalThis.RegExp(CAPITALIZED_PATTERN);
  return makeFilter2((s) => s.charAt(0).toUpperCase() === s.charAt(0), {
    expected: "a string with the first character in uppercase",
    representation: {
      id: "effect/schema/isCapitalized",
      payload: null
    },
    toJsonSchema: () => [{
      pattern: regExp.source
    }, true],
    toCode: () => ({
      runtime: "Schema.isCapitalized()"
    }),
    arbitraryConstraint: {
      patterns: [{
        source: CAPITALIZED_PATTERN,
        flags: ""
      }]
    },
    ...annotations
  });
}
var UNCAPITALIZED_PATTERN = "^(?:[^A-Z][\\s\\S]*)?$";
function isUncapitalized(annotations) {
  const regExp = new globalThis.RegExp(UNCAPITALIZED_PATTERN);
  return makeFilter2((s) => s.charAt(0).toLowerCase() === s.charAt(0), {
    expected: "a string with the first character in lowercase",
    representation: {
      id: "effect/schema/isUncapitalized",
      payload: null
    },
    toJsonSchema: () => [{
      pattern: regExp.source
    }, true],
    toCode: () => ({
      runtime: "Schema.isUncapitalized()"
    }),
    arbitraryConstraint: {
      patterns: [{
        source: UNCAPITALIZED_PATTERN,
        flags: ""
      }]
    },
    ...annotations
  });
}
var Finite = /* @__PURE__ */ make21(finite);
var isFinite3 = isFinite2;
function makeIsGreaterThan(options) {
  const gt = isGreaterThan(options.order);
  const formatter = options.formatter ?? format;
  return (exclusiveMinimum, annotations) => {
    return makeFilter2((input) => gt(input, exclusiveMinimum), {
      expected: `a value greater than ${formatter(exclusiveMinimum)}`,
      arbitraryConstraint: {
        order: options.order,
        minimum: exclusiveMinimum,
        exclusiveMinimum: true
      },
      ...options.annotate?.(exclusiveMinimum),
      ...annotations
    });
  };
}
function makeIsGreaterThanOrEqualTo(options) {
  const gte = isGreaterThanOrEqualTo(options.order);
  const formatter = options.formatter ?? format;
  return (minimum, annotations) => {
    return makeFilter2((input) => gte(input, minimum), {
      expected: `a value greater than or equal to ${formatter(minimum)}`,
      arbitraryConstraint: {
        order: options.order,
        minimum
      },
      ...options.annotate?.(minimum),
      ...annotations
    });
  };
}
function makeIsLessThan(options) {
  const lt = isLessThan(options.order);
  const formatter = options.formatter ?? format;
  return (exclusiveMaximum, annotations) => {
    return makeFilter2((input) => lt(input, exclusiveMaximum), {
      expected: `a value less than ${formatter(exclusiveMaximum)}`,
      arbitraryConstraint: {
        order: options.order,
        maximum: exclusiveMaximum,
        exclusiveMaximum: true
      },
      ...options.annotate?.(exclusiveMaximum),
      ...annotations
    });
  };
}
function makeIsLessThanOrEqualTo(options) {
  const lte = isLessThanOrEqualTo(options.order);
  const formatter = options.formatter ?? format;
  return (maximum, annotations) => {
    return makeFilter2((input) => lte(input, maximum), {
      expected: `a value less than or equal to ${formatter(maximum)}`,
      arbitraryConstraint: {
        order: options.order,
        maximum
      },
      ...options.annotate?.(maximum),
      ...annotations
    });
  };
}
function makeIsBetween(deriveOptions) {
  const greaterThanOrEqualTo = isGreaterThanOrEqualTo(deriveOptions.order);
  const greaterThan = isGreaterThan(deriveOptions.order);
  const lessThanOrEqualTo = isLessThanOrEqualTo(deriveOptions.order);
  const lessThan = isLessThan(deriveOptions.order);
  const formatter = deriveOptions.formatter ?? format;
  return (options, annotations) => {
    const gte = options.exclusiveMinimum ? greaterThan : greaterThanOrEqualTo;
    const lte = options.exclusiveMaximum ? lessThan : lessThanOrEqualTo;
    return makeFilter2((input) => gte(input, options.minimum) && lte(input, options.maximum), {
      expected: `a value between ${formatter(options.minimum)}${options.exclusiveMinimum ? " (excluded)" : ""} and ${formatter(options.maximum)}${options.exclusiveMaximum ? " (excluded)" : ""}`,
      arbitraryConstraint: {
        order: deriveOptions.order,
        minimum: options.minimum,
        maximum: options.maximum,
        ...options.exclusiveMinimum && {
          exclusiveMinimum: true
        },
        ...options.exclusiveMaximum && {
          exclusiveMaximum: true
        }
      },
      ...deriveOptions.annotate?.(options),
      ...annotations
    });
  };
}
function makeIsMultipleOf(options) {
  return (divisor, annotations) => {
    const formatter = options.formatter ?? format;
    return makeFilter2((input) => options.remainder(input, divisor) === options.zero, {
      expected: `a value that is a multiple of ${formatter(divisor)}`,
      ...options.annotate?.(divisor),
      ...annotations
    });
  };
}
function encodeNumberPayload(number3) {
  if (!globalThis.Number.isFinite(number3)) {
    throw new globalThis.RangeError(`Expected a finite number, got ${format(number3)}`);
  }
  return number3;
}
var isGreaterThan4 = /* @__PURE__ */ makeIsGreaterThan({
  order: Number2,
  annotate: (exclusiveMinimum) => ({
    representation: {
      id: "effect/schema/isGreaterThan",
      payload: {
        exclusiveMinimum: encodeNumberPayload(exclusiveMinimum)
      }
    },
    toJsonSchema: () => ({
      exclusiveMinimum
    }),
    toCode: () => ({
      runtime: `Schema.isGreaterThan(${format(exclusiveMinimum)})`
    })
  })
});
var isGreaterThanOrEqualTo4 = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Number2,
  annotate: (minimum) => ({
    representation: {
      id: "effect/schema/isGreaterThanOrEqualTo",
      payload: {
        minimum: encodeNumberPayload(minimum)
      }
    },
    toJsonSchema: () => ({
      minimum
    }),
    toCode: () => ({
      runtime: `Schema.isGreaterThanOrEqualTo(${format(minimum)})`
    })
  })
});
var isLessThan4 = /* @__PURE__ */ makeIsLessThan({
  order: Number2,
  annotate: (exclusiveMaximum) => ({
    representation: {
      id: "effect/schema/isLessThan",
      payload: {
        exclusiveMaximum: encodeNumberPayload(exclusiveMaximum)
      }
    },
    toJsonSchema: () => ({
      exclusiveMaximum
    }),
    toCode: () => ({
      runtime: `Schema.isLessThan(${format(exclusiveMaximum)})`
    })
  })
});
var isLessThanOrEqualTo5 = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Number2,
  annotate: (maximum) => ({
    representation: {
      id: "effect/schema/isLessThanOrEqualTo",
      payload: {
        maximum: encodeNumberPayload(maximum)
      }
    },
    toJsonSchema: () => ({
      maximum
    }),
    toCode: () => ({
      runtime: `Schema.isLessThanOrEqualTo(${format(maximum)})`
    })
  })
});
var isBetween2 = /* @__PURE__ */ makeIsBetween({
  order: Number2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : void 0;
    const exclusiveMaximum = options.exclusiveMaximum ? true : void 0;
    const payload = {
      minimum: encodeNumberPayload(options.minimum),
      maximum: encodeNumberPayload(options.maximum),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetween",
        payload
      },
      toJsonSchema: () => ({
        [exclusiveMinimum ? "exclusiveMinimum" : "minimum"]: options.minimum,
        [exclusiveMaximum ? "exclusiveMaximum" : "maximum"]: options.maximum
      }),
      toCode: () => ({
        runtime: `Schema.isBetween({ minimum: ${format(options.minimum)}, maximum: ${format(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
function isMultipleOf(divisor, annotations) {
  if (!globalThis.Number.isFinite(divisor) || divisor === 0) {
    throw new globalThis.RangeError(`Expected a finite non-zero number, got ${globalThis.String(divisor)}`);
  }
  divisor = globalThis.Math.abs(divisor);
  return makeFilter2((input) => remainder(input, divisor) === 0, {
    expected: `a value that is a multiple of ${divisor}`,
    representation: {
      id: "effect/schema/isMultipleOf",
      payload: {
        divisor
      }
    },
    toJsonSchema: () => ({
      multipleOf: divisor
    }),
    toCode: () => ({
      runtime: `Schema.isMultipleOf(${format(divisor)})`
    }),
    ...annotations
  });
}
function isInt(annotations) {
  return makeFilter2((n) => globalThis.Number.isSafeInteger(n), {
    expected: "an integer",
    representation: {
      id: "effect/schema/isInt",
      payload: null
    },
    toJsonSchema: () => ({
      type: "integer",
      minimum: globalThis.Number.MIN_SAFE_INTEGER,
      maximum: globalThis.Number.MAX_SAFE_INTEGER
    }),
    toCode: () => ({
      runtime: "Schema.isInt()"
    }),
    arbitraryConstraint: {
      number: "integer"
    },
    ...annotations
  });
}
var Int = /* @__PURE__ */ Number6.check(/* @__PURE__ */ isInt());
var Natural = /* @__PURE__ */ Int.check(/* @__PURE__ */ isGreaterThanOrEqualTo4(0));
function isInt32(annotations) {
  return new FilterGroup([isInt(), isBetween2({
    minimum: -2147483648,
    maximum: 2147483647
  })], {
    expected: "a 32-bit integer",
    ...annotations
  });
}
function isUint322(annotations) {
  return new FilterGroup([isInt(), isBetween2({
    minimum: 0,
    maximum: 4294967295
  })], {
    expected: "a 32-bit unsigned integer",
    ...annotations
  });
}
function encodeDatePayload(date) {
  if (globalThis.Number.isNaN(date.getTime())) {
    throw new globalThis.RangeError(`Expected a valid Date, got ${format(date)}`);
  }
  return date.toISOString();
}
function formatDateRuntime(date) {
  return `new Date(${format(date.getTime())})`;
}
var isGreaterThanDate = /* @__PURE__ */ makeIsGreaterThan({
  order: Date2,
  annotate: (exclusiveMinimum) => {
    const encoded = encodeDatePayload(exclusiveMinimum);
    return {
      representation: {
        id: "effect/schema/isGreaterThanDate",
        payload: {
          exclusiveMinimum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isGreaterThanDate(${formatDateRuntime(exclusiveMinimum)})`
      })
    };
  }
});
var isGreaterThanOrEqualToDate = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Date2,
  annotate: (minimum) => {
    const encoded = encodeDatePayload(minimum);
    return {
      representation: {
        id: "effect/schema/isGreaterThanOrEqualToDate",
        payload: {
          minimum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isGreaterThanOrEqualToDate(${formatDateRuntime(minimum)})`
      })
    };
  }
});
var isLessThanDate = /* @__PURE__ */ makeIsLessThan({
  order: Date2,
  annotate: (exclusiveMaximum) => {
    const encoded = encodeDatePayload(exclusiveMaximum);
    return {
      representation: {
        id: "effect/schema/isLessThanDate",
        payload: {
          exclusiveMaximum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isLessThanDate(${formatDateRuntime(exclusiveMaximum)})`
      })
    };
  }
});
var isLessThanOrEqualToDate = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Date2,
  annotate: (maximum) => {
    const encoded = encodeDatePayload(maximum);
    return {
      representation: {
        id: "effect/schema/isLessThanOrEqualToDate",
        payload: {
          maximum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isLessThanOrEqualToDate(${formatDateRuntime(maximum)})`
      })
    };
  }
});
var isBetweenDate = /* @__PURE__ */ makeIsBetween({
  order: Date2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : void 0;
    const exclusiveMaximum = options.exclusiveMaximum ? true : void 0;
    const payload = {
      minimum: encodeDatePayload(options.minimum),
      maximum: encodeDatePayload(options.maximum),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetweenDate",
        payload
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isBetweenDate({ minimum: ${formatDateRuntime(options.minimum)}, maximum: ${formatDateRuntime(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
var isGreaterThanBigInt = /* @__PURE__ */ makeIsGreaterThan({
  order: BigInt2,
  annotate: (exclusiveMinimum) => {
    const encoded = exclusiveMinimum.toString(10);
    return {
      representation: {
        id: "effect/schema/isGreaterThanBigInt",
        payload: {
          exclusiveMinimum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isGreaterThanBigInt(${format(exclusiveMinimum)})`
      })
    };
  }
});
var isGreaterThanOrEqualToBigInt = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: BigInt2,
  annotate: (minimum) => {
    const encoded = minimum.toString(10);
    return {
      representation: {
        id: "effect/schema/isGreaterThanOrEqualToBigInt",
        payload: {
          minimum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isGreaterThanOrEqualToBigInt(${format(minimum)})`
      })
    };
  }
});
var isLessThanBigInt = /* @__PURE__ */ makeIsLessThan({
  order: BigInt2,
  annotate: (exclusiveMaximum) => {
    const encoded = exclusiveMaximum.toString(10);
    return {
      representation: {
        id: "effect/schema/isLessThanBigInt",
        payload: {
          exclusiveMaximum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isLessThanBigInt(${format(exclusiveMaximum)})`
      })
    };
  }
});
var isLessThanOrEqualToBigInt = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: BigInt2,
  annotate: (maximum) => {
    const encoded = maximum.toString(10);
    return {
      representation: {
        id: "effect/schema/isLessThanOrEqualToBigInt",
        payload: {
          maximum: encoded
        }
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isLessThanOrEqualToBigInt(${format(maximum)})`
      })
    };
  }
});
var isBetweenBigInt = /* @__PURE__ */ makeIsBetween({
  order: BigInt2,
  annotate: (options) => {
    const exclusiveMinimum = options.exclusiveMinimum ? true : void 0;
    const exclusiveMaximum = options.exclusiveMaximum ? true : void 0;
    const payload = {
      minimum: options.minimum.toString(10),
      maximum: options.maximum.toString(10),
      ...exclusiveMinimum && {
        exclusiveMinimum
      },
      ...exclusiveMaximum && {
        exclusiveMaximum
      }
    };
    return {
      representation: {
        id: "effect/schema/isBetweenBigInt",
        payload
      },
      toJsonSchema: () => [{}, true],
      toCode: () => ({
        runtime: `Schema.isBetweenBigInt({ minimum: ${format(options.minimum)}, maximum: ${format(options.maximum)}, exclusiveMinimum: ${format(exclusiveMinimum)}, exclusiveMaximum: ${format(exclusiveMaximum)} })`
      })
    };
  }
});
function isMinLength(minLength, annotations) {
  minLength = normalizeCardinality(minLength);
  return makeIsMinLength(minLength, Math.ceil(minLength / 2), annotations);
}
function makeIsMinLength(minLength, minCodePoints, annotations) {
  return makeFilter2((input) => input.length >= minLength, {
    expected: `a value with a length of at least ${minLength}`,
    representation: {
      id: "effect/schema/isMinLength",
      payload: {
        minLength
      }
    },
    toJsonSchema: ({
      type
    }) => type === "string" ? minLength <= 1 ? {
      minLength: minCodePoints
    } : [{
      minLength: minCodePoints
    }, true] : type === "array" ? {
      minItems: minLength
    } : type === void 0 ? [{
      minLength: minCodePoints,
      minItems: minLength
    }, true] : [{}, true],
    toCode: () => ({
      runtime: `Schema.isMinLength(${minLength})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minLength
    },
    ...annotations
  });
}
function isNonEmpty(annotations) {
  return makeIsMinLength(1, 1, annotations);
}
function isMaxLength(maxLength, annotations) {
  maxLength = normalizeCardinality(maxLength);
  return makeFilter2((input) => input.length <= maxLength, {
    expected: `a value with a length of at most ${maxLength}`,
    representation: {
      id: "effect/schema/isMaxLength",
      payload: {
        maxLength
      }
    },
    toJsonSchema: ({
      type
    }) => type === "string" ? maxLength === 0 ? {
      maxLength
    } : [{
      maxLength
    }, true] : type === "array" ? {
      maxItems: maxLength
    } : type === void 0 ? [{
      maxLength,
      maxItems: maxLength
    }, true] : [{}, true],
    toCode: () => ({
      runtime: `Schema.isMaxLength(${maxLength})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      maxLength
    },
    ...annotations
  });
}
function isBetweenLength(minimum, maximum, annotations) {
  minimum = normalizeCardinality(minimum);
  maximum = normalizeCardinality(maximum);
  return makeFilter2((input) => input.length >= minimum && input.length <= maximum, {
    expected: minimum === maximum ? `a value with a length of ${minimum}` : `a value with a length between ${minimum} and ${maximum}`,
    representation: {
      id: "effect/schema/isBetweenLength",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: ({
      type
    }) => type === "string" ? maximum === 0 || Math.ceil(minimum / 2) > maximum ? {
      minLength: Math.ceil(minimum / 2),
      maxLength: maximum
    } : [{
      minLength: Math.ceil(minimum / 2),
      maxLength: maximum
    }, true] : type === "array" ? {
      minItems: minimum,
      maxItems: maximum
    } : type === void 0 ? [{
      minLength: Math.ceil(minimum / 2),
      maxLength: maximum,
      minItems: minimum,
      maxItems: maximum
    }, true] : [{}, true],
    toCode: () => ({
      runtime: `Schema.isBetweenLength(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minLength: minimum,
      maxLength: maximum
    },
    ...annotations
  });
}
function isMinCodePoints(minCodePoints, annotations) {
  minCodePoints = normalizeCardinality(minCodePoints);
  return makeFilter2((input) => countCodePointsUpTo(input, minCodePoints) >= minCodePoints, {
    expected: `a string with at least ${minCodePoints} code points`,
    representation: {
      id: "effect/schema/isMinCodePoints",
      payload: {
        minCodePoints
      }
    },
    toJsonSchema: () => ({
      minLength: minCodePoints
    }),
    toCode: () => ({
      runtime: `Schema.isMinCodePoints(${minCodePoints})`
    }),
    arbitraryConstraint: {
      minCodePoints
    },
    ...annotations
  });
}
function isMaxCodePoints(maxCodePoints, annotations) {
  maxCodePoints = normalizeCardinality(maxCodePoints);
  return makeFilter2((input) => countCodePointsUpTo(input, maxCodePoints + 1) <= maxCodePoints, {
    expected: `a string with at most ${maxCodePoints} code points`,
    representation: {
      id: "effect/schema/isMaxCodePoints",
      payload: {
        maxCodePoints
      }
    },
    toJsonSchema: () => ({
      maxLength: maxCodePoints
    }),
    toCode: () => ({
      runtime: `Schema.isMaxCodePoints(${maxCodePoints})`
    }),
    arbitraryConstraint: {
      maxCodePoints
    },
    ...annotations
  });
}
function isBetweenCodePoints(minimum, maximum, annotations) {
  minimum = normalizeCardinality(minimum);
  maximum = normalizeCardinality(maximum);
  return makeFilter2((input) => {
    const count = countCodePointsUpTo(input, maximum + 1);
    return count >= minimum && count <= maximum;
  }, {
    expected: minimum === maximum ? `a string with ${minimum} code points` : `a string with between ${minimum} and ${maximum} code points`,
    representation: {
      id: "effect/schema/isBetweenCodePoints",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: () => ({
      allOf: [{
        minLength: minimum
      }, {
        maxLength: maximum
      }]
    }),
    toCode: () => ({
      runtime: `Schema.isBetweenCodePoints(${minimum}, ${maximum})`
    }),
    arbitraryConstraint: {
      minCodePoints: minimum,
      maxCodePoints: maximum
    },
    ...annotations
  });
}
function countCodePointsUpTo(input, limit) {
  if (limit === 0) return 0;
  let count = 0;
  for (const _ of input) {
    if (++count >= limit) break;
  }
  return count;
}
function normalizeCardinality(value3) {
  if (!globalThis.Number.isFinite(value3)) {
    throw new globalThis.RangeError(`Expected a finite number, got ${value3}`);
  }
  return Math.max(0, Math.floor(value3));
}
function isMinSize(minSize, annotations) {
  minSize = normalizeCardinality(minSize);
  return makeFilter2((input) => input.size >= minSize, {
    expected: `a value with a size of at least ${minSize}`,
    representation: {
      id: "effect/schema/isMinSize",
      payload: {
        minSize
      }
    },
    toJsonSchema: () => [{}, true],
    toCode: () => ({
      runtime: `Schema.isMinSize(${minSize})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minSize
    },
    ...annotations
  });
}
function isMaxSize(maxSize, annotations) {
  maxSize = normalizeCardinality(maxSize);
  return makeFilter2((input) => input.size <= maxSize, {
    expected: `a value with a size of at most ${maxSize}`,
    representation: {
      id: "effect/schema/isMaxSize",
      payload: {
        maxSize
      }
    },
    toJsonSchema: () => [{}, true],
    toCode: () => ({
      runtime: `Schema.isMaxSize(${maxSize})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      maxSize
    },
    ...annotations
  });
}
function isBetweenSize(minimum, maximum, annotations) {
  minimum = normalizeCardinality(minimum);
  maximum = normalizeCardinality(maximum);
  return makeFilter2((input) => input.size >= minimum && input.size <= maximum, {
    expected: minimum === maximum ? `a value with a size of ${minimum}` : `a value with a size between ${minimum} and ${maximum}`,
    representation: {
      id: "effect/schema/isBetweenSize",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: () => [{}, true],
    toCode: () => ({
      runtime: `Schema.isBetweenSize(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minSize: minimum,
      maxSize: maximum
    },
    ...annotations
  });
}
function isMinProperties(minProperties, annotations) {
  minProperties = normalizeCardinality(minProperties);
  return makeFilter2((input) => Reflect.ownKeys(input).length >= minProperties, {
    expected: `a value with at least ${minProperties === 1 ? "1 entry" : `${minProperties} entries`}`,
    representation: {
      id: "effect/schema/isMinProperties",
      payload: {
        minProperties
      }
    },
    toJsonSchema: ({
      type
    }) => type === "object" ? {
      minProperties
    } : [{
      minProperties
    }, true],
    toCode: () => ({
      runtime: `Schema.isMinProperties(${minProperties})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minProperties
    },
    ...annotations
  });
}
function isMaxProperties(maxProperties, annotations) {
  maxProperties = normalizeCardinality(maxProperties);
  return makeFilter2((input) => Reflect.ownKeys(input).length <= maxProperties, {
    expected: `a value with at most ${maxProperties === 1 ? "1 entry" : `${maxProperties} entries`}`,
    representation: {
      id: "effect/schema/isMaxProperties",
      payload: {
        maxProperties
      }
    },
    toJsonSchema: ({
      type
    }) => type === "object" ? {
      maxProperties
    } : [{
      maxProperties
    }, true],
    toCode: () => ({
      runtime: `Schema.isMaxProperties(${maxProperties})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      maxProperties
    },
    ...annotations
  });
}
function isBetweenProperties(minimum, maximum, annotations) {
  minimum = normalizeCardinality(minimum);
  maximum = normalizeCardinality(maximum);
  return makeFilter2((input) => Reflect.ownKeys(input).length >= minimum && Reflect.ownKeys(input).length <= maximum, {
    expected: minimum === maximum ? `a value with exactly ${minimum === 1 ? "1 entry" : `${minimum} entries`}` : `a value with between ${minimum} and ${maximum} entries`,
    representation: {
      id: "effect/schema/isBetweenProperties",
      payload: {
        minimum,
        maximum
      }
    },
    toJsonSchema: ({
      type
    }) => type === "object" ? {
      minProperties: minimum,
      maxProperties: maximum
    } : [{
      minProperties: minimum,
      maxProperties: maximum
    }, true],
    toCode: () => ({
      runtime: `Schema.isBetweenProperties(${minimum}, ${maximum})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    arbitraryConstraint: {
      minProperties: minimum,
      maxProperties: maximum
    },
    ...annotations
  });
}
function isPropertyNames(keySchema, annotations) {
  const propertyNames = toEncoded2(keySchema);
  const parser = _issue(propertyNames.ast);
  return makeFilter2((input, ast, options) => {
    const keys3 = Reflect.ownKeys(input);
    const issues = [];
    for (const key of keys3) {
      const issue = parser(key, options);
      if (issue !== void 0) {
        issues.push(new Pointer([key], issue));
        if (options.errors === "first") break;
      }
    }
    if (isArrayNonEmpty2(issues)) {
      return new Composite(ast, issues, input, options);
    }
    return true;
  }, {
    expected: "an object with property names matching the schema",
    representation: {
      id: "effect/schema/isPropertyNames",
      payload: null,
      schemas: [propertyNames.ast]
    },
    toJsonSchema: ({
      schemas,
      type
    }) => type === "object" ? {
      propertyNames: schemas[0]
    } : [{
      propertyNames: schemas[0]
    }, true],
    toCode: ({
      schemas
    }) => ({
      runtime: `Schema.isPropertyNames(${schemas[0].runtime})`
    }),
    [STRUCTURAL_ANNOTATION_KEY]: true,
    ...annotations
  });
}
function isUnique(annotations) {
  return makeFilter2((input) => dedupe(input).length === input.length, {
    expected: "an array with unique items",
    representation: {
      id: "effect/schema/isUnique",
      payload: null
    },
    toJsonSchema: () => ({
      uniqueItems: true
    }),
    toCode: () => ({
      runtime: "Schema.isUnique()"
    }),
    arbitraryConstraint: {
      uniqueBy: identity
    },
    ...annotations
  });
}
function isUniqueKey(annotations) {
  return makeFilter2((input) => dedupe(input.map(([key]) => key)).length === input.length, {
    expected: "an array with unique keys",
    representation: {
      id: "effect/schema/isUniqueKey",
      payload: null
    },
    toCode: () => ({
      runtime: "Schema.isUniqueKey()"
    }),
    arbitraryConstraint: {
      uniqueBy: (entry) => entry[0]
    },
    ...annotations
  });
}
var NonEmptyString = /* @__PURE__ */ String6.check(/* @__PURE__ */ isNonEmpty());
var Char = /* @__PURE__ */ String6.check(/* @__PURE__ */ isBetweenLength(1, 1));
var getErrorOptionsKey = (options) => (options?.includeStack === true ? 1 : 0) | (options?.excludeCause === true ? 2 : 0);
var getErrorOptions = (key) => {
  switch (key) {
    case 0:
      return void 0;
    case 1:
      return {
        includeStack: true
      };
    case 2:
      return {
        excludeCause: true
      };
    case 3:
      return {
        includeStack: true,
        excludeCause: true
      };
  }
};
var errorSchemaCache = [];
function ErrorInstance(options) {
  const key = getErrorOptionsKey(options);
  const cached3 = errorSchemaCache[key];
  if (cached3 !== void 0) {
    return cached3;
  }
  const normalizedOptions = getErrorOptions(key);
  const schema = instanceOf(globalThis.Error, {
    representation: {
      id: "effect/schema/Error",
      payload: normalizedOptions ?? null
    },
    toCode: () => ({
      runtime: normalizedOptions !== void 0 ? `Schema.ErrorInstance(${format(normalizedOptions)})` : `Schema.ErrorInstance()`,
      Type: `globalThis.Error`
    }),
    expected: "Error",
    toCodecJson: () => link()(JsonError, errorFromJsonError(normalizedOptions))
  });
  errorSchemaCache[key] = schema;
  return schema;
}
var defectSchemaCache = [];
function Defect(options) {
  const key = getErrorOptionsKey(options);
  const cached3 = defectSchemaCache[key];
  if (cached3 !== void 0) {
    return cached3;
  }
  const schema = Json2.pipe(decodeTo2(Unknown2, defectFromJson(getErrorOptions(key))));
  defectSchemaCache[key] = schema;
  return schema;
}
function ReadonlyMap(key, value3) {
  const schema = declareConstructor()([key, value3], ([key2, value4]) => {
    const array2 = ArraySchema(Tuple2([key2, value4]));
    return (input, ast, options) => {
      if (input instanceof globalThis.Map) {
        return mapBothEager2(decodeUnknownEffect(array2)([...input], options), {
          onSuccess: (array3) => new globalThis.Map(array3),
          onFailure: (issue) => makeCompositeAtKey(ast, "entries", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/ReadonlyMap",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.ReadonlyMap(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `globalThis.ReadonlyMap<${typeParameters[0].Type}, ${typeParameters[1].Type}>`
    }),
    expected: "ReadonlyMap",
    toCodec: ([key2, value4]) => link()(ArraySchema(Tuple2([key2, value4])), transform2({
      decode: (entries3) => new globalThis.Map(entries3),
      encode: (map10) => [...map10.entries()]
    }))
  });
  return make21(schema.ast, {
    key,
    value: value3
  });
}
function ReadonlySet(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const array2 = ArraySchema(value4);
    return (input, ast, options) => {
      if (input instanceof globalThis.Set) {
        return mapBothEager2(decodeUnknownEffect(array2)([...input], options), {
          onSuccess: (array3) => new globalThis.Set(array3),
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/ReadonlySet",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.ReadonlySet(${typeParameters[0].runtime})`,
      Type: `globalThis.ReadonlySet<${typeParameters[0].Type}>`
    }),
    expected: "ReadonlySet",
    toCodec: ([value4]) => link()(ArraySchema(value4), transform2({
      decode: (values2) => new globalThis.Set(values2),
      encode: (set6) => [...set6.values()]
    }))
  });
  return make21(schema.ast, {
    value: value3
  });
}
var RegExp3 = /* @__PURE__ */ instanceOf(globalThis.RegExp, {
  representation: {
    id: "effect/schema/RegExp",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.RegExp`,
    Type: `globalThis.RegExp`
  }),
  expected: "RegExp",
  toCodecJson: () => link()(Struct({
    source: String6,
    flags: String6
  }), transformEffect2({
    decode: (e, options) => try_3({
      try: () => new globalThis.RegExp(e.source, e.flags),
      catch: () => new InvalidValue({
        expected: "valid RegExp source and flags"
      }, e, options)
    }),
    encode: (regExp) => succeed5({
      source: regExp.source,
      flags: regExp.flags
    })
  }))
});
var URLString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a URL"
});
var URL2 = /* @__PURE__ */ instanceOf(globalThis.URL, {
  representation: {
    id: "effect/schema/URL",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.URL`,
    Type: `globalThis.URL`
  }),
  expected: "URL",
  toCodecJson: () => link()(URLString, urlFromString)
});
var URLFromString = /* @__PURE__ */ URLString.pipe(/* @__PURE__ */ decodeTo2(URL2, urlFromString));
var DateString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a Date"
});
var Date4 = /* @__PURE__ */ declare((input) => input instanceof globalThis.Date && !globalThis.Number.isNaN(input.getTime()), {
  representation: {
    id: "effect/schema/Date",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Date`,
    Type: `globalThis.Date`
  }),
  expected: "a valid Date",
  toCodecJson: () => link()(DateString, dateFromString)
});
var DateFromString = /* @__PURE__ */ DateString.pipe(/* @__PURE__ */ decodeTo2(Date4, dateFromString));
var DateFromMillis = /* @__PURE__ */ Int.pipe(/* @__PURE__ */ decodeTo2(Date4, dateFromMillis));
var JsonString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as JSON",
  contentMediaType: "application/json"
});
function fromJsonString2(schema, options) {
  return JsonString.pipe(decodeTo2(schema, fromJsonString(options)));
}
var UnknownFromJsonString = /* @__PURE__ */ fromJsonString2(Unknown2);
var File2 = /* @__PURE__ */ instanceOf(globalThis.File, {
  representation: {
    id: "effect/schema/File",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.File`,
    Type: `globalThis.File`
  }),
  expected: "File",
  toCodecJson: () => link()(Struct({
    data: String6.check(isBase64()),
    type: String6,
    name: String6,
    lastModified: Int
  }), transformEffect2({
    decode: (e, options) => match2(decode2(e.data), {
      onFailure: () => fail5(new InvalidValue({
        expected: "a valid Base64 string"
      }, e.data, options)),
      onSuccess: (bytes2) => {
        const buffer = new globalThis.Uint8Array(bytes2);
        return succeed5(new globalThis.File([buffer], e.name, {
          type: e.type,
          lastModified: e.lastModified
        }));
      }
    }),
    encode: (file, options) => tryPromise2({
      try: async () => {
        const bytes2 = new globalThis.Uint8Array(await file.arrayBuffer());
        return {
          data: encode2(bytes2),
          type: file.type,
          name: file.name,
          lastModified: file.lastModified
        };
      },
      catch: () => new InvalidValue({
        expected: "a readable File"
      }, file, options)
    })
  }))
});
var FormData2 = /* @__PURE__ */ declare((u) => u instanceof globalThis.FormData, {
  representation: {
    id: "effect/schema/FormData",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.FormData`,
    Type: `globalThis.FormData`
  }),
  expected: "FormData",
  toCodecJson: () => link()(ArraySchema(Tuple2([String6, Union2([Struct({
    _tag: tag("String"),
    value: String6
  }), Struct({
    _tag: tag("File"),
    value: File2
  })])])), transformEffect2({
    decode: (e) => {
      const out = new globalThis.FormData();
      for (const [key, entry] of e) {
        out.append(key, entry.value);
      }
      return succeed5(out);
    },
    encode: (formData) => {
      return succeed5(globalThis.Array.from(formData.entries()).map(([key, value3]) => {
        if (typeof value3 === "string") {
          return [key, {
            _tag: "String",
            value: value3
          }];
        } else {
          return [key, {
            _tag: "File",
            value: value3
          }];
        }
      }));
    }
  }))
});
function fromFormData2(schema) {
  return FormData2.pipe(decodeTo2(schema, fromFormData));
}
var URLSearchParams2 = /* @__PURE__ */ instanceOf(globalThis.URLSearchParams, {
  representation: {
    id: "effect/schema/URLSearchParams",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.URLSearchParams`,
    Type: `globalThis.URLSearchParams`
  }),
  expected: "URLSearchParams",
  toCodecJson: () => link()(String6.annotate({
    expected: "a query string that will be decoded as URLSearchParams"
  }), transform2({
    decode: (e) => new globalThis.URLSearchParams(e),
    encode: (params) => params.toString()
  }))
});
function fromURLSearchParams2(schema) {
  return URLSearchParams2.pipe(decodeTo2(schema, fromURLSearchParams));
}
var NumberFromString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a number"
}).pipe(/* @__PURE__ */ decodeTo2(Number6, numberFromString));
var FiniteFromString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a finite number"
}).pipe(/* @__PURE__ */ decodeTo2(Finite, numberFromString));
var BigIntFromString = /* @__PURE__ */ make21(bigIntString).pipe(/* @__PURE__ */ decodeTo2(BigInt6, bigintFromString));
var Trimmed = /* @__PURE__ */ String6.check(/* @__PURE__ */ isTrimmed());
var Trim = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a trimmed string"
}).pipe(/* @__PURE__ */ decodeTo2(Trimmed, /* @__PURE__ */ trim3()));
var StringFromBase64 = /* @__PURE__ */ String6.annotate({
  expected: "a base64 encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String6, stringFromBase64String));
var StringFromBase64Url = /* @__PURE__ */ String6.annotate({
  expected: "a base64 (URL) encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String6, stringFromBase64UrlString));
var StringFromHex = /* @__PURE__ */ String6.annotate({
  expected: "a hex encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String6, stringFromHexString));
var StringFromUriComponent = /* @__PURE__ */ String6.annotate({
  expected: "a URI component encoded string that will be decoded as a UTF-8 string"
}).pipe(/* @__PURE__ */ decodeTo2(String6, stringFromUriComponent));
var PropertyKey = /* @__PURE__ */ Union2([Finite, Symbol3, String6]);
var StandardSchemaV1FailureResult = /* @__PURE__ */ Struct({
  issues: /* @__PURE__ */ ArraySchema(/* @__PURE__ */ Struct({
    message: String6,
    path: /* @__PURE__ */ optional2(/* @__PURE__ */ ArraySchema(/* @__PURE__ */ Union2([PropertyKey, /* @__PURE__ */ Struct({
      key: PropertyKey
    })])))
  }))
});
var BooleanFromBit = /* @__PURE__ */ Literals([0, 1]).pipe(/* @__PURE__ */ decodeTo2(Boolean3, /* @__PURE__ */ transform2({
  decode: (bit) => bit === 1,
  encode: (bool) => bool ? 1 : 0
})));
var Base64String = /* @__PURE__ */ String6.annotate({
  expected: "a base64 encoded string that will be decoded as Uint8Array",
  format: "byte",
  contentEncoding: "base64"
});
var Uint8Array2 = /* @__PURE__ */ instanceOf(globalThis.Uint8Array, {
  representation: {
    id: "effect/schema/Uint8Array",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Uint8Array`,
    Type: `globalThis.Uint8Array`
  }),
  expected: "Uint8Array",
  toCodecJson: () => link()(Base64String, uint8ArrayFromBase64String)
});
var Uint8ArrayFromBase64 = /* @__PURE__ */ Base64String.pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, uint8ArrayFromBase64String));
var Uint8ArrayFromBase64Url = /* @__PURE__ */ String6.annotate({
  expected: "a base64 (URL) encoded string that will be decoded as a Uint8Array"
}).pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, {
  decode: /* @__PURE__ */ decodeBase64Url(),
  encode: /* @__PURE__ */ encodeBase64Url()
}));
var Uint8ArrayFromHex = /* @__PURE__ */ String6.annotate({
  expected: "a hex encoded string that will be decoded as a Uint8Array"
}).pipe(/* @__PURE__ */ decodeTo2(Uint8Array2, {
  decode: /* @__PURE__ */ decodeHex(),
  encode: /* @__PURE__ */ encodeHex()
}));
var bigDecimalFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => {
    const result3 = fromString(s);
    return isNone2(result3) ? fail5(new InvalidValue({
      expected: "a valid BigDecimal string"
    }, s, options)) : succeed5(result3.value);
  },
  encode: (bd) => succeed5(format3(bd))
});
var isGreaterThanBigDecimal = /* @__PURE__ */ makeIsGreaterThan({
  order: Order,
  formatter: (bd) => format3(bd)
});
var isGreaterThanOrEqualToBigDecimal = /* @__PURE__ */ makeIsGreaterThanOrEqualTo({
  order: Order,
  formatter: (bd) => format3(bd)
});
var isLessThanBigDecimal = /* @__PURE__ */ makeIsLessThan({
  order: Order,
  formatter: (bd) => format3(bd)
});
var isLessThanOrEqualToBigDecimal = /* @__PURE__ */ makeIsLessThanOrEqualTo({
  order: Order,
  formatter: (bd) => format3(bd)
});
var isBetweenBigDecimal = /* @__PURE__ */ makeIsBetween({
  order: Order,
  formatter: (bd) => format3(bd)
});
var BigDecimalString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a BigDecimal"
});
var BigDecimal = /* @__PURE__ */ declare(isBigDecimal, {
  representation: {
    id: "effect/schema/BigDecimal",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.BigDecimal`,
    Type: `BigDecimal.BigDecimal`,
    importDeclarations: [`import * as BigDecimal from "effect/BigDecimal"`]
  }),
  expected: "BigDecimal",
  toCodecJson: () => link()(BigDecimalString, bigDecimalFromString),
  toFormatter: () => (bd) => format3(bd)
});
var BigDecimalFromString = /* @__PURE__ */ BigDecimalString.pipe(/* @__PURE__ */ decodeTo2(BigDecimal, bigDecimalFromString));
var ByteSize = /* @__PURE__ */ declare(isByteSize, {
  representation: {
    id: "effect/schema/ByteSize",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.ByteSize`,
    Type: `ByteSize.ByteSize`,
    importDeclarations: [`import * as ByteSize from "effect/ByteSize"`]
  }),
  expected: "ByteSize",
  toCodecJson: () => link()(BigInt6.check(isGreaterThanOrEqualToBigInt(globalThis.BigInt(0))), transform2({
    decode: bytes,
    encode: toBigInt
  })),
  toCodecStringTree: () => link()(ByteSizeString, byteSizeFromString)
});
var ByteSizeString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a ByteSize"
});
var ByteSizeFromString = /* @__PURE__ */ ByteSizeString.pipe(/* @__PURE__ */ decodeTo2(ByteSize, byteSizeFromString));
var ByteSizeFromBigInt = /* @__PURE__ */ BigInt6.pipe(/* @__PURE__ */ decodeTo2(ByteSize, byteSizeFromBigInt));
var ByteSizeFromNumber = /* @__PURE__ */ Number6.pipe(/* @__PURE__ */ decodeTo2(ByteSize, byteSizeFromNumber));
function CauseReason(error, defect) {
  const schema = declareConstructor()([error, defect], ([error2, defect2]) => (input, ast, options) => {
    if (!isReason(input)) {
      return fail5(new InvalidType(ast, input, options));
    }
    switch (input._tag) {
      case "Fail":
        return mapBothEager2(decodeUnknownEffect(error2)(input.error, options), {
          onSuccess: makeFailReason,
          onFailure: (issue) => makeCompositeAtKey(ast, "error", issue, input, options)
        });
      case "Die":
        return mapBothEager2(decodeUnknownEffect(defect2)(input.defect, options), {
          onSuccess: makeDieReason,
          onFailure: (issue) => makeCompositeAtKey(ast, "defect", issue, input, options)
        });
      case "Interrupt":
        return succeed5(input);
    }
  }, {
    representation: {
      id: "effect/schema/CauseReason",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.CauseReason(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Cause.Failure<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Cause from "effect/Cause"`]
    }),
    expected: "Cause.Failure",
    toCodec: ([error2, defect2]) => link()(Union2([Struct({
      _tag: Literal2("Fail"),
      error: error2
    }), Struct({
      _tag: Literal2("Die"),
      defect: defect2
    }), Struct({
      _tag: Literal2("Interrupt"),
      fiberId: UndefinedOr(Finite)
    })]), transform2({
      decode: (e) => {
        switch (e._tag) {
          case "Fail":
            return makeFailReason(e.error);
          case "Die":
            return makeDieReason(e.defect);
          case "Interrupt":
            return makeInterruptReason2(e.fiberId);
        }
      },
      encode: (reason) => {
        switch (reason._tag) {
          case "Fail":
            return {
              _tag: "Fail",
              error: reason.error
            };
          case "Die":
            return {
              _tag: "Die",
              defect: reason.defect
            };
          case "Interrupt":
            return {
              _tag: "Interrupt",
              fiberId: reason.fiberId
            };
        }
      }
    }))
  });
  return make21(schema.ast, {
    error,
    defect
  });
}
function Cause(error, defect) {
  const schema = declareConstructor()([error, defect], ([error2, defect2]) => {
    const failures = ArraySchema(CauseReason(error2, defect2));
    return (input, ast, options) => {
      if (!isCause2(input)) {
        return fail5(new InvalidType(ast, input, options));
      }
      return mapBothEager2(decodeUnknownEffect(failures)(input.reasons, options), {
        onSuccess: fromReasons,
        onFailure: (issue) => makeCompositeAtKey(ast, "reasons", issue, input, options)
      });
    };
  }, {
    representation: {
      id: "effect/schema/Cause",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Cause(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Cause.Cause<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Cause from "effect/Cause"`]
    }),
    expected: "Cause",
    toCodec: ([error2, defect2]) => link()(ArraySchema(CauseReason(error2, defect2)), transform2({
      decode: fromReasons,
      encode: ({
        reasons: failures
      }) => failures
    }))
  });
  return make21(schema.ast, {
    error,
    defect
  });
}
function chunkLink(values2) {
  return link()(values2, transform2({
    decode: fromIterable2,
    encode: fromIterable
  }));
}
function Chunk(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const values2 = ArraySchema(value4);
    return (input, ast, options) => {
      if (isChunk(input)) {
        return mapBothEager2(decodeUnknownEffect(values2)(fromIterable(input), options), {
          onSuccess: fromIterable2,
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/Chunk",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Chunk(${typeParameters[0].runtime})`,
      Type: `Chunk.Chunk<${typeParameters[0].Type}>`
    }),
    expected: "Chunk",
    toCodec: ([value4]) => chunkLink(ArraySchema(value4)),
    toCodecArbitrary: ({
      constraint,
      typeParameters: [value4]
    }) => chunkLink(withArrayLengthConstraints(ArraySchema(value4), constraint?.minLength, constraint?.maxLength)),
    toEquivalence: ([value4]) => makeEquivalence5(value4)
  });
  return make21(schema.ast, {
    value: value3
  });
}
function dateTimeUtcFromInput() {
  return transformEffect((input, options) => {
    return match(make9(input), {
      onNone: () => fail5(new InvalidValue({
        message: "Invalid DateTime input"
      }, input, options)),
      onSome: (dt) => succeed5(toUtc2(dt))
    });
  });
}
var timeZoneOffsetFromNumber = /* @__PURE__ */ transform2({
  decode: (n) => zoneMakeOffset2(n),
  encode: (tz) => tz.offset
});
var timeZoneNamedFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => {
    return match(zoneMakeNamed2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid IANA time zone"
      }, s, options)),
      onSome: succeed5
    });
  },
  encode: (tz) => succeed5(tz.id)
});
var timeZoneFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => {
    return match(zoneFromString2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid time zone"
      }, s, options)),
      onSome: succeed5
    });
  },
  encode: (tz) => succeed5(zoneToString2(tz))
});
var dateTimeUtcFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => {
    return match(make9(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid UTC DateTime string"
      }, s, options)),
      onSome: (result3) => succeed5(toUtc2(result3))
    });
  },
  encode: (utc) => succeed5(formatIso2(utc))
});
var dateTimeZonedFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => {
    return match(makeZonedFromString2(s), {
      onNone: () => fail5(new InvalidValue({
        expected: "a valid Zoned DateTime string"
      }, s, options)),
      onSome: succeed5
    });
  },
  encode: (zoned) => succeed5(formatIsoZoned2(zoned))
});
var arbitraryMinimumDateTimestamp = -864e13;
var arbitraryMaximumDateTimestamp = 864e13;
var arbitraryMinimumZonedDateTimeTimestamp = arbitraryMinimumDateTimestamp + 14 * 60 * 60 * 1e3;
var arbitraryMaximumZonedDateTimeTimestamp = arbitraryMaximumDateTimestamp - 14 * 60 * 60 * 1e3;
var arbitraryMinimumTimeZoneOffset = -12 * 60 * 60 * 1e3;
var arbitraryMaximumTimeZoneOffset = 14 * 60 * 60 * 1e3;
var arbitraryNamedTimeZones = ["UTC", "Europe/London", "America/New_York", "Asia/Tokyo", "Australia/Sydney"];
function dateTimeArbitraryBounds(constraint, domainMinimum, domainMaximum) {
  const minimum = Math.max(domainMinimum, constraint?.minimum === void 0 ? domainMinimum : constraint.minimum.epochMilliseconds + (constraint.exclusiveMinimum === true ? 1 : 0));
  const maximum = Math.min(domainMaximum, constraint?.maximum === void 0 ? domainMaximum : constraint.maximum.epochMilliseconds - (constraint.exclusiveMaximum === true ? 1 : 0));
  return minimum <= maximum ? [minimum, maximum] : [domainMinimum, domainMaximum];
}
function dateTimeArbitraryInteger(minimum, maximum) {
  return Int.check(isBetween2({
    minimum,
    maximum
  }));
}
function timeZoneArbitrarySchema() {
  return Union2([dateTimeArbitraryInteger(arbitraryMinimumTimeZoneOffset, arbitraryMaximumTimeZoneOffset), Literals(arbitraryNamedTimeZones)]);
}
var DateTimeUtc = /* @__PURE__ */ declare((u) => isDateTime2(u) && isUtc2(u), {
  representation: {
    id: "effect/schema/DateTimeUtc",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.DateTimeUtc`,
    Type: `DateTime.Utc`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.Utc",
  toCodecArbitrary: ({
    constraint
  }) => {
    const [minimum, maximum] = dateTimeArbitraryBounds(constraint, arbitraryMinimumDateTimestamp, arbitraryMaximumDateTimestamp);
    return linkDecoding()(dateTimeArbitraryInteger(minimum, maximum), transform(makeUnsafe5));
  },
  toCodecJson: () => link()(String6, dateTimeUtcFromString),
  toFormatter: () => (utc) => utc.toString()
});
var DateTimeUtcFromDate = /* @__PURE__ */ Date4.pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, {
  decode: /* @__PURE__ */ dateTimeUtcFromInput(),
  encode: /* @__PURE__ */ transform(toDateUtc2)
}));
var DateTimeUtcFromString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a DateTime.Utc"
}).pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, dateTimeUtcFromString));
var dateTimeUtcFromHttpDate = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => match2(parseHttpDate(s), {
    onFailure: () => fail5(new InvalidValue({
      expected: "an HTTP date (RFC 9110 \xA75.6.7)"
    }, s, options)),
    onSuccess: succeed5
  }),
  encode: (utc) => succeed5(formatHttpDate(utc))
});
var DateTimeUtcFromHttpDate = /* @__PURE__ */ String6.annotate({
  expected: "an HTTP date string"
}).pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, dateTimeUtcFromHttpDate));
var DateTimeUtcFromMillis = /* @__PURE__ */ Int.pipe(/* @__PURE__ */ decodeTo2(DateTimeUtc, {
  decode: /* @__PURE__ */ dateTimeUtcFromInput(),
  encode: /* @__PURE__ */ transform(toEpochMillis2)
}));
var TimeZoneOffset = /* @__PURE__ */ declare(isTimeZoneOffset2, {
  representation: {
    id: "effect/schema/TimeZoneOffset",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZoneOffset`,
    Type: `DateTime.TimeZone.Offset`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone.Offset",
  toCodecJson: () => link()(Int, timeZoneOffsetFromNumber),
  toFormatter: () => (tz) => zoneToString2(tz)
});
var TimeZoneNamedString = /* @__PURE__ */ String6.annotate({
  expected: "an IANA time zone identifier"
});
var TimeZoneNamed = /* @__PURE__ */ declare(isTimeZoneNamed2, {
  representation: {
    id: "effect/schema/TimeZoneNamed",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZoneNamed`,
    Type: `DateTime.TimeZone.Named`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone.Named",
  toCodecArbitrary: () => linkDecoding()(Literals(arbitraryNamedTimeZones), transform(zoneMakeNamedUnsafe2)),
  toCodecJson: () => link()(TimeZoneNamedString, timeZoneNamedFromString),
  toFormatter: () => (tz) => zoneToString2(tz)
});
var TimeZoneNamedFromString = /* @__PURE__ */ TimeZoneNamedString.pipe(/* @__PURE__ */ decodeTo2(TimeZoneNamed, timeZoneNamedFromString));
var TimeZoneString = /* @__PURE__ */ String6.annotate({
  expected: "a time zone string (IANA identifier or offset like +03:00)"
});
var TimeZone = /* @__PURE__ */ declare(isTimeZone2, {
  representation: {
    id: "effect/schema/TimeZone",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.TimeZone`,
    Type: `DateTime.TimeZone`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.TimeZone",
  toCodecArbitrary: () => linkDecoding()(timeZoneArbitrarySchema(), transform((value3) => typeof value3 === "number" ? zoneMakeOffset2(value3) : zoneMakeNamedUnsafe2(value3))),
  toCodecJson: () => link()(TimeZoneString, timeZoneFromString),
  toFormatter: () => (tz) => zoneToString2(tz)
});
var TimeZoneFromString = /* @__PURE__ */ TimeZoneString.pipe(/* @__PURE__ */ decodeTo2(TimeZone, timeZoneFromString));
var DateTimeZonedString = /* @__PURE__ */ String6.annotate({
  expected: "a zoned DateTime string (e.g. 2024-01-01T00:00:00.000+00:00[Europe/London])"
});
var DateTimeZoned = /* @__PURE__ */ declare((u) => isDateTime2(u) && isZoned2(u), {
  representation: {
    id: "effect/schema/DateTimeZoned",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.DateTimeZoned`,
    Type: `DateTime.Zoned`,
    importDeclarations: [`import * as DateTime from "effect/DateTime"`]
  }),
  expected: "DateTime.Zoned",
  toCodecArbitrary: ({
    constraint
  }) => {
    const [minimum, maximum] = dateTimeArbitraryBounds(constraint, arbitraryMinimumZonedDateTimeTimestamp, arbitraryMaximumZonedDateTimeTimestamp);
    return linkDecoding()(Struct({
      epochMilliseconds: dateTimeArbitraryInteger(minimum, maximum),
      timeZone: timeZoneArbitrarySchema()
    }), transform(({
      epochMilliseconds,
      timeZone
    }) => makeZonedUnsafe2(epochMilliseconds, {
      timeZone
    })));
  },
  toCodecJson: () => link()(DateTimeZonedString, dateTimeZonedFromString),
  toFormatter: () => (zoned) => formatIsoZoned2(zoned),
  toEquivalence: () => Equivalence4
});
var DateTimeZonedFromString = /* @__PURE__ */ DateTimeZonedString.pipe(/* @__PURE__ */ decodeTo2(DateTimeZoned, dateTimeZonedFromString));
var netAddressFromString = (declaration, parse3, encode5, identifier2) => String6.pipe(decodeTo2(declaration, transformEffect2({
  decode: (input, options) => {
    const result3 = parse3(input);
    return isSuccess2(result3) ? succeed5(result3.success) : fail5(new InvalidValue({
      message: result3.failure.message
    }, input, options));
  },
  encode: (value3) => succeed5(encode5(value3))
}))).annotate({
  identifier: identifier2
});
var MacAddress = /* @__PURE__ */ declare(isMacAddress, {
  identifier: "MacAddress"
});
var MacAddressFromString = /* @__PURE__ */ netAddressFromString(MacAddress, macAddressFromString, formatMacAddress, "MacAddressFromString");
var Ipv4Address = /* @__PURE__ */ declare(isIpv4Address, {
  identifier: "Ipv4Address"
});
var Ipv4AddressFromString = /* @__PURE__ */ netAddressFromString(Ipv4Address, ipv4FromString, formatIp, "Ipv4AddressFromString");
var Ipv6Address = /* @__PURE__ */ declare(isIpv6Address, {
  identifier: "Ipv6Address"
});
var Ipv6AddressFromString = /* @__PURE__ */ netAddressFromString(Ipv6Address, ipv6FromString, formatIp, "Ipv6AddressFromString");
var IpAddress = /* @__PURE__ */ declare(isIpAddress, {
  identifier: "IpAddress"
});
var IpAddressFromString = /* @__PURE__ */ netAddressFromString(IpAddress, ipFromString, formatIp, "IpAddressFromString");
var netAddressRefinement = (schema, guard, expected, identifier2) => refine(guard, {
  expected
})(schema).annotate({
  identifier: identifier2
});
var IpMulticastAddress = /* @__PURE__ */ netAddressRefinement(IpAddress, isMulticast, "a multicast address", "IpMulticastAddress");
var IpMulticastAddressFromString = /* @__PURE__ */ netAddressRefinement(IpAddressFromString, isMulticast, "a multicast address", "IpMulticastAddressFromString");
var MacMulticastAddress = /* @__PURE__ */ netAddressRefinement(MacAddress, isMulticast, "a multicast address", "MacMulticastAddress");
var MacMulticastAddressFromString = /* @__PURE__ */ netAddressRefinement(MacAddressFromString, isMulticast, "a multicast address", "MacMulticastAddressFromString");
var IpUnicastAddress = /* @__PURE__ */ netAddressRefinement(IpAddress, isUnicast, "a unicast address", "IpUnicastAddress");
var IpUnicastAddressFromString = /* @__PURE__ */ netAddressRefinement(IpAddressFromString, isUnicast, "a unicast address", "IpUnicastAddressFromString");
var MacUnicastAddress = /* @__PURE__ */ netAddressRefinement(MacAddress, isMacUnicast, "a unicast address", "MacUnicastAddress");
var MacUnicastAddressFromString = /* @__PURE__ */ netAddressRefinement(MacAddressFromString, isMacUnicast, "a unicast address", "MacUnicastAddressFromString");
var Ipv4BroadcastAddress = /* @__PURE__ */ netAddressRefinement(Ipv4Address, isBroadcast, "a broadcast address", "Ipv4BroadcastAddress");
var Ipv4BroadcastAddressFromString = /* @__PURE__ */ netAddressRefinement(Ipv4AddressFromString, isBroadcast, "a broadcast address", "Ipv4BroadcastAddressFromString");
var MacBroadcastAddress = /* @__PURE__ */ netAddressRefinement(MacAddress, isMacBroadcast, "a broadcast address", "MacBroadcastAddress");
var MacBroadcastAddressFromString = /* @__PURE__ */ netAddressRefinement(MacAddressFromString, isMacBroadcast, "a broadcast address", "MacBroadcastAddressFromString");
var IpLoopbackAddress = /* @__PURE__ */ netAddressRefinement(IpAddress, isLoopback, "a loopback address", "IpLoopbackAddress");
var IpLoopbackAddressFromString = /* @__PURE__ */ netAddressRefinement(IpAddressFromString, isLoopback, "a loopback address", "IpLoopbackAddressFromString");
var IpLinkLocalAddress = /* @__PURE__ */ netAddressRefinement(IpAddress, isLinkLocal, "a link-local address", "IpLinkLocalAddress");
var IpLinkLocalAddressFromString = /* @__PURE__ */ netAddressRefinement(IpAddressFromString, isLinkLocal, "a link-local address", "IpLinkLocalAddressFromString");
var IpUnspecifiedAddress = /* @__PURE__ */ netAddressRefinement(IpAddress, isUnspecified, "an unspecified address", "IpUnspecifiedAddress");
var IpUnspecifiedAddressFromString = /* @__PURE__ */ netAddressRefinement(IpAddressFromString, isUnspecified, "an unspecified address", "IpUnspecifiedAddressFromString");
var Ipv4PrivateAddress = /* @__PURE__ */ netAddressRefinement(Ipv4Address, isPrivate, "a private address", "Ipv4PrivateAddress");
var Ipv4PrivateAddressFromString = /* @__PURE__ */ netAddressRefinement(Ipv4AddressFromString, isPrivate, "a private address", "Ipv4PrivateAddressFromString");
var Ipv6UniqueLocalAddress = /* @__PURE__ */ netAddressRefinement(Ipv6Address, isUniqueLocal, "a unique-local address", "Ipv6UniqueLocalAddress");
var Ipv6UniqueLocalAddressFromString = /* @__PURE__ */ netAddressRefinement(Ipv6AddressFromString, isUniqueLocal, "a unique-local address", "Ipv6UniqueLocalAddressFromString");
var MacLocallyAdministeredAddress = /* @__PURE__ */ netAddressRefinement(MacAddress, isMacLocallyAdministered, "a locally administered address", "MacLocallyAdministeredAddress");
var MacLocallyAdministeredAddressFromString = /* @__PURE__ */ netAddressRefinement(MacAddressFromString, isMacLocallyAdministered, "a locally administered address", "MacLocallyAdministeredAddressFromString");
var MacUniversallyAdministeredAddress = /* @__PURE__ */ netAddressRefinement(MacAddress, isMacUniversallyAdministered, "a universally administered address", "MacUniversallyAdministeredAddress");
var MacUniversallyAdministeredAddressFromString = /* @__PURE__ */ netAddressRefinement(MacAddressFromString, isMacUniversallyAdministered, "a universally administered address", "MacUniversallyAdministeredAddressFromString");
var Ipv4Interface = /* @__PURE__ */ declare(isIpv4Interface, {
  identifier: "Ipv4Interface"
});
var Ipv4InterfaceFromString = /* @__PURE__ */ netAddressFromString(Ipv4Interface, ipv4FromString2, format5, "Ipv4InterfaceFromString");
var Ipv6Interface = /* @__PURE__ */ declare(isIpv6Interface, {
  identifier: "Ipv6Interface"
});
var Ipv6InterfaceFromString = /* @__PURE__ */ netAddressFromString(Ipv6Interface, ipv6FromString2, format5, "Ipv6InterfaceFromString");
var IpInterface = /* @__PURE__ */ declare(isIpInterface, {
  identifier: "IpInterface"
});
var IpInterfaceFromString = /* @__PURE__ */ netAddressFromString(IpInterface, fromString3, format5, "IpInterfaceFromString");
var Ipv4Network = /* @__PURE__ */ declare(isIpv4Network, {
  identifier: "Ipv4Network"
});
var Ipv4NetworkFromString = /* @__PURE__ */ netAddressFromString(Ipv4Network, ipv4FromString3, format6, "Ipv4NetworkFromString");
var Ipv6Network = /* @__PURE__ */ declare(isIpv6Network, {
  identifier: "Ipv6Network"
});
var Ipv6NetworkFromString = /* @__PURE__ */ netAddressFromString(Ipv6Network, ipv6FromString3, format6, "Ipv6NetworkFromString");
var IpNetwork = /* @__PURE__ */ declare(isIpNetwork, {
  identifier: "IpNetwork"
});
var IpNetworkFromString = /* @__PURE__ */ netAddressFromString(IpNetwork, fromString4, format6, "IpNetworkFromString");
var InetAddressV4 = /* @__PURE__ */ declare(isInetAddressV4, {
  identifier: "InetAddressV4"
});
var InetAddressV6 = /* @__PURE__ */ declare(isInetAddressV6, {
  identifier: "InetAddressV6"
});
var InetAddress = /* @__PURE__ */ declare(isInetAddress, {
  identifier: "InetAddress"
});
var InetAddressFromString = /* @__PURE__ */ netAddressFromString(InetAddress, inetAddressFromString, formatInet, "InetAddressFromString");
var UnixPathAddress = /* @__PURE__ */ declare(isUnixPathAddress, {
  identifier: "UnixPathAddress"
});
var UnixPathAddressFromString = /* @__PURE__ */ String6.pipe(decodeTo2(UnixPathAddress, transform2({
  decode: unixPathAddress,
  encode: (address) => address.path
}))).annotate({
  identifier: "UnixPathAddressFromString"
});
var SocketAddress = /* @__PURE__ */ declare(isSocketAddress, {
  identifier: "SocketAddress"
});
var DomainName = /* @__PURE__ */ String6.check(makeFilter2(isDomainName, {
  expected: "a normalized domain name"
})).pipe(brand("~effect/net/Host/DomainName")).annotate({
  identifier: "DomainName"
});
var DomainNameFromString = /* @__PURE__ */ netAddressFromString(DomainName, domainNameFromString, (name) => name, "DomainNameFromString");
var ScopedIpv6Literal = /* @__PURE__ */ String6.check(makeFilter2(isScopedIpv6Literal, {
  expected: "a canonical scoped IPv6 literal"
})).pipe(brand("~effect/net/NetAddress/ScopedIpv6Literal")).annotate({
  identifier: "ScopedIpv6Literal"
});
var ScopedIpv6LiteralFromString = /* @__PURE__ */ netAddressFromString(ScopedIpv6Literal, scopedIpv6LiteralFromString, (literal) => literal, "ScopedIpv6LiteralFromString");
var Host = /* @__PURE__ */ Union2([IpAddress, ScopedIpv6Literal, DomainName]).annotate({
  identifier: "Host"
});
var HostFromString = /* @__PURE__ */ Union2([IpAddressFromString, ScopedIpv6LiteralFromString, DomainNameFromString]).annotate({
  identifier: "HostFromString"
});
var HostPort = /* @__PURE__ */ declare(isHostPort, {
  identifier: "HostPort"
});
var HostPortFromString = /* @__PURE__ */ netAddressFromString(HostPort, hostPortFromString, formatHostPort, "HostPortFromString");
var Port = /* @__PURE__ */ Int.check(/* @__PURE__ */ isBetween2({
  minimum: 0,
  maximum: 65535
}, {
  expected: "a port number"
}));
var durationFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => match(fromInput(s), {
    onNone: () => fail5(new InvalidValue({
      expected: "a valid Duration string"
    }, s, options)),
    onSome: succeed5
  }),
  encode: (duration) => succeed5(globalThis.String(duration))
});
var durationFromNanos = /* @__PURE__ */ transformEffect2({
  decode: (i) => succeed5(nanos(i)),
  encode: (a, options) => match(toNanos(a), {
    onNone: () => fail5(new InvalidValue({
      expected: "a Duration representable as a bigint"
    }, a, options)),
    onSome: (nanos2) => succeed5(nanos2)
  })
});
var durationFromMillis = /* @__PURE__ */ transform2({
  decode: (i) => millis(i),
  encode: (a) => toMillis(a)
});
var Duration = /* @__PURE__ */ declare(isDuration, {
  representation: {
    id: "effect/schema/Duration",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.Duration`,
    Type: `Duration.Duration`,
    importDeclarations: [`import * as Duration from "effect/Duration"`]
  }),
  expected: "Duration",
  toCodecJson: () => link()(Union2([Struct({
    _tag: Literal2("Infinity")
  }), Struct({
    _tag: Literal2("NegativeInfinity")
  }), Struct({
    _tag: Literal2("Nanos"),
    value: BigInt6
  }), Struct({
    _tag: Literal2("Millis"),
    value: Int
  })]), transform2({
    decode: (e) => {
      switch (e._tag) {
        case "Infinity":
          return infinity;
        case "NegativeInfinity":
          return negativeInfinity;
        case "Nanos":
          return nanos(e.value);
        case "Millis":
          return millis(e.value);
      }
    },
    encode: (duration) => {
      switch (duration.value._tag) {
        case "Infinity":
          return {
            _tag: "Infinity"
          };
        case "NegativeInfinity":
          return {
            _tag: "NegativeInfinity"
          };
        case "Nanos":
          return {
            _tag: "Nanos",
            value: duration.value.nanos
          };
        case "Millis":
          return {
            _tag: "Millis",
            value: duration.value.millis
          };
      }
    }
  }))
});
var DurationString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a Duration"
});
var DurationFromString = /* @__PURE__ */ DurationString.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromString));
var DurationFromNanos = /* @__PURE__ */ BigInt6.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromNanos));
var DurationFromMillis = /* @__PURE__ */ Number6.pipe(/* @__PURE__ */ decodeTo2(Duration, durationFromMillis));
var DnsRecordType = /* @__PURE__ */ Literals(recordTypes);
var dnsCanonicalAddress = (schema, parse3) => String6.pipe(decodeTo2(schema, transformEffect2({
  decode: (input, options) => {
    const result3 = parse3(input);
    if (isFailure2(result3)) {
      return fail5(new InvalidValue({
        message: result3.failure.message
      }, input, options));
    }
    return formatIp(result3.success) === input ? succeed5(result3.success) : fail5(new InvalidValue({
      message: "expected a canonical address"
    }, input, options));
  },
  encode: (address) => succeed5(formatIp(address))
})));
var dnsUint8 = /* @__PURE__ */ Int.check(/* @__PURE__ */ isBetween2({
  minimum: 0,
  maximum: 255
}));
var dnsUint16 = /* @__PURE__ */ Int.check(/* @__PURE__ */ isBetween2({
  minimum: 0,
  maximum: 65535
}));
var dnsUint32 = /* @__PURE__ */ Int.check(/* @__PURE__ */ isBetween2({
  minimum: 0,
  maximum: 4294967295
}));
var dnsSeconds = /* @__PURE__ */ dnsUint32.pipe(/* @__PURE__ */ decodeTo2(Duration, /* @__PURE__ */ transform2({
  decode: seconds,
  encode: toSeconds
})));
var dnsRecordOfType = (type, fields) => declare((u) => isDnsRecord(u) && u._tag === type, {
  identifier: `Dns${type.charAt(0)}${type.slice(1).toLowerCase()}Record`,
  toCodecJson: () => {
    const json = TaggedStruct(type, fields);
    return link()(json, transformEffect2({
      decode: (input, options) => {
        const {
          _tag,
          ...rest
        } = input;
        const result3 = makeRecord(type, rest);
        return isSuccess2(result3) ? succeed5(result3.success) : fail5(new InvalidValue({
          message: result3.failure.message
        }, input, options));
      },
      // Records hold only their tag and fields as own properties.
      encode: (record2) => succeed5({
        ...record2
      })
    }));
  }
});
var DnsARecord = /* @__PURE__ */ dnsRecordOfType("A", {
  address: /* @__PURE__ */ dnsCanonicalAddress(Ipv4Address, ipv4FromString)
});
var DnsAaaaRecord = /* @__PURE__ */ dnsRecordOfType("AAAA", {
  address: /* @__PURE__ */ dnsCanonicalAddress(Ipv6Address, ipv6FromString)
});
var DnsCaaRecord = /* @__PURE__ */ dnsRecordOfType("CAA", {
  critical: Boolean3,
  tag: /* @__PURE__ */ String6.check(/* @__PURE__ */ isPattern2(/^[a-z0-9]+$/i)),
  value: String6
});
var DnsCnameRecord = /* @__PURE__ */ dnsRecordOfType("CNAME", {
  target: DomainName
});
var DnsMxRecord = /* @__PURE__ */ dnsRecordOfType("MX", {
  exchange: DomainName,
  priority: dnsUint16
});
var DnsNaptrRecord = /* @__PURE__ */ dnsRecordOfType("NAPTR", {
  order: dnsUint16,
  preference: dnsUint16,
  flags: String6,
  service: String6,
  regexp: String6,
  replacement: DomainName
});
var DnsNsRecord = /* @__PURE__ */ dnsRecordOfType("NS", {
  host: DomainName
});
var DnsPtrRecord = /* @__PURE__ */ dnsRecordOfType("PTR", {
  host: NonEmptyString
});
var DnsSoaRecord = /* @__PURE__ */ dnsRecordOfType("SOA", {
  primary: DomainName,
  admin: NonEmptyString,
  serial: dnsUint32,
  refresh: dnsSeconds,
  retry: dnsSeconds,
  expire: dnsSeconds,
  minimum: dnsSeconds
});
var DnsSrvRecord = /* @__PURE__ */ dnsRecordOfType("SRV", {
  target: DomainName,
  port: dnsUint16,
  priority: dnsUint16,
  weight: dnsUint16
});
var DnsTlsaRecord = /* @__PURE__ */ dnsRecordOfType("TLSA", {
  certUsage: dnsUint8,
  selector: dnsUint8,
  matchingType: dnsUint8,
  data: Uint8ArrayFromHex
});
var DnsTxtRecord = /* @__PURE__ */ dnsRecordOfType("TXT", {
  chunks: /* @__PURE__ */ NonEmptyArray(String6)
});
var DnsRecord = /* @__PURE__ */ Union2([DnsARecord, DnsAaaaRecord, DnsCaaRecord, DnsCnameRecord, DnsMxRecord, DnsNaptrRecord, DnsNsRecord, DnsPtrRecord, DnsSoaRecord, DnsSrvRecord, DnsTlsaRecord, DnsTxtRecord]).annotate({
  identifier: "DnsRecord"
});
function Exit(value3, error, defect) {
  const schema = declareConstructor()([value3, error, defect], ([value4, error2, defect2]) => {
    const cause = Cause(error2, defect2);
    return (input, ast, options) => {
      if (!isExit2(input)) {
        return fail5(new InvalidType(ast, input, options));
      }
      switch (input._tag) {
        case "Success":
          return mapBothEager2(decodeUnknownEffect(value4)(input.value, options), {
            onSuccess: succeed4,
            onFailure: (issue) => makeCompositeAtKey(ast, "value", issue, input, options)
          });
        case "Failure":
          return mapBothEager2(decodeUnknownEffect(cause)(input.cause, options), {
            onSuccess: failCause2,
            onFailure: (issue) => makeCompositeAtKey(ast, "cause", issue, input, options)
          });
      }
    };
  }, {
    representation: {
      id: "effect/schema/Exit",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Exit(${typeParameters[0].runtime}, ${typeParameters[1].runtime}, ${typeParameters[2].runtime})`,
      Type: `Exit.Exit<${typeParameters[0].Type}, ${typeParameters[1].Type}, ${typeParameters[2].Type}>`,
      importDeclarations: [`import * as Exit from "effect/Exit"`]
    }),
    expected: "Exit",
    toCodec: ([value4, error2, defect2]) => link()(Union2([Struct({
      _tag: Literal2("Success"),
      value: value4
    }), Struct({
      _tag: Literal2("Failure"),
      cause: Cause(error2, defect2)
    })]), transform2({
      decode: (e) => e._tag === "Success" ? succeed4(e.value) : failCause2(e.cause),
      encode: (exit3) => isSuccess4(exit3) ? {
        _tag: "Success",
        value: exit3.value
      } : {
        _tag: "Failure",
        cause: exit3.cause
      }
    }))
  });
  return make21(schema.ast, {
    value: value3,
    error,
    defect
  });
}
function graphEncodedSchema(type, node, edge) {
  return Struct({
    type: Literal2(type),
    nodes: ArraySchema(Struct({
      index: Natural,
      data: node
    })),
    edges: ArraySchema(Struct({
      index: Natural,
      source: Natural,
      target: Natural,
      data: edge
    }))
  });
}
function graphDecode(input, options) {
  let previous = -1;
  const indexes = /* @__PURE__ */ new Set();
  for (let i = 0; i < input.nodes.length; i++) {
    const index2 = input.nodes[i].index;
    if (index2 <= previous) {
      return fail5(new Pointer(["nodes", i, "index"], new InvalidValue({
        expected: "a strictly increasing node index"
      }, index2, options)));
    }
    previous = index2;
    indexes.add(index2);
  }
  previous = -1;
  for (let i = 0; i < input.edges.length; i++) {
    const edge = input.edges[i];
    if (edge.index <= previous) {
      return fail5(new Pointer(["edges", i, "index"], new InvalidValue({
        expected: "a strictly increasing edge index"
      }, edge.index, options)));
    }
    previous = edge.index;
    if (!indexes.has(edge.source)) {
      return fail5(new Pointer(["edges", i, "source"], new InvalidValue({
        expected: "an encoded node index"
      }, edge.source, options)));
    }
    if (!indexes.has(edge.target)) {
      return fail5(new Pointer(["edges", i, "target"], new InvalidValue({
        expected: "an encoded node index"
      }, edge.target, options)));
    }
  }
  return succeed5(hydrate(input));
}
function graphEncode(input, type, options) {
  if (!isGraph(input) || input.mutable || input.type !== type) {
    return fail5(new InvalidValue({
      expected: `an immutable ${type} Graph`
    }, input, options));
  }
  return succeed5(snapshot(input));
}
function graphToEquivalence(node, edge) {
  return (self, that) => {
    const a = snapshot(self);
    const b = snapshot(that);
    if (a.type !== b.type || a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
    for (let i = 0; i < a.nodes.length; i++) {
      if (a.nodes[i].index !== b.nodes[i].index || !node(a.nodes[i].data, b.nodes[i].data)) return false;
    }
    for (let i = 0; i < a.edges.length; i++) {
      const ae = a.edges[i];
      const be = b.edges[i];
      const sameEndpoints = a.type === "directed" ? ae.source === be.source && ae.target === be.target : ae.source === be.source && ae.target === be.target || ae.source === be.target && ae.target === be.source;
      if (ae.index !== be.index || !sameEndpoints || !edge(ae.data, be.data)) return false;
    }
    return true;
  };
}
function graphToArbitrary(type, node, edge) {
  return linkDecoding()(Union2([Null2, Struct({
    nodes: NonEmptyArray(node),
    edges: ArraySchema(Tuple2([Natural, Natural, edge]))
  })]), transform((input) => {
    if (input === null) return hydrate({
      type,
      nodes: [],
      edges: []
    });
    const nodes = input.nodes.map((data, index2) => ({
      index: index2,
      data
    }));
    return hydrate({
      type,
      nodes,
      edges: input.edges.map(([source, target, data], index2) => ({
        index: index2,
        source: source % nodes.length,
        target: target % nodes.length,
        data
      }))
    });
  }));
}
function Graph(type, node, edge) {
  const schema = declareConstructor()([node, edge], ([node2, edge2]) => {
    const encoded = graphEncodedSchema(type, node2, edge2);
    return (input, ast, options) => {
      if (!isGraph(input) || input.mutable || input.type !== type) {
        return fail5(new InvalidType(ast, input, options));
      }
      return flatMap4(decodeUnknownEffect(encoded)(snapshot(input), options), (snapshot2) => graphDecode(snapshot2, options));
    };
  }, {
    representation: {
      id: "effect/schema/Graph",
      payload: type
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Graph(${format(type)}, ${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Graph.Graph<${typeParameters[0].Type}, ${typeParameters[1].Type}, ${format(type)}>`,
      importDeclarations: [`import * as Graph from "effect/Graph"`]
    }),
    expected: `an immutable ${type} Graph`,
    toCodec: ([node2, edge2]) => link()(graphEncodedSchema(type, node2, edge2), transformEffect2({
      decode: graphDecode,
      encode: (graph, options) => graphEncode(graph, type, options)
    })),
    toCodecArbitrary: ({
      typeParameters: [node2, edge2]
    }) => graphToArbitrary(type, node2, edge2),
    toEquivalence: ([node2, edge2]) => graphToEquivalence(node2, edge2)
  });
  return make21(schema.ast, {
    type,
    node,
    edge
  });
}
function hashMapLink(entries3) {
  return link()(entries3, transform2({
    decode: fromIterable4,
    encode: toEntries
  }));
}
function HashMap(key, value3) {
  const schema = declareConstructor()([key, value3], ([key2, value4]) => {
    const entries3 = ArraySchema(Tuple2([key2, value4]));
    return (input, ast, options) => {
      if (isHashMap2(input)) {
        return mapBothEager2(decodeUnknownEffect(entries3)(toEntries(input), options), {
          onSuccess: fromIterable4,
          onFailure: (issue) => makeCompositeAtKey(ast, "entries", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/HashMap",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.HashMap(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `HashMap.HashMap<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as HashMap from "effect/HashMap"`]
    }),
    expected: "HashMap",
    toCodec: ([key2, value4]) => hashMapLink(ArraySchema(Tuple2([key2, value4]))),
    toCodecArbitrary: ({
      constraint,
      typeParameters: [key2, value4]
    }) => hashMapLink(withArrayLengthConstraints(ArraySchema(Tuple2([key2, value4])).check(isUniqueKey()), constraint?.minSize, constraint?.maxSize)),
    toEquivalence: ([key2, value4]) => makeCompareMap(key2, value4)
  });
  return make21(schema.ast, {
    key,
    value: value3
  });
}
function hashSetLink(values2) {
  return link()(values2, transform2({
    decode: fromIterable6,
    encode: fromIterable
  }));
}
function HashSet(value3) {
  const schema = declareConstructor()([value3], ([value4]) => {
    const values2 = ArraySchema(value4);
    return (input, ast, options) => {
      if (isHashSet2(input)) {
        return mapBothEager2(decodeUnknownEffect(values2)(fromIterable(input), options), {
          onSuccess: fromIterable6,
          onFailure: (issue) => makeCompositeAtKey(ast, "values", issue, input, options)
        });
      }
      return fail5(new InvalidType(ast, input, options));
    };
  }, {
    representation: {
      id: "effect/schema/HashSet",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.HashSet(${typeParameters[0].runtime})`,
      Type: `HashSet.HashSet<${typeParameters[0].Type}>`
    }),
    expected: "HashSet",
    toCodec: ([value4]) => hashSetLink(ArraySchema(value4)),
    toCodecArbitrary: ({
      constraint,
      typeParameters: [value4]
    }) => hashSetLink(withArrayLengthConstraints(ArraySchema(value4).check(isUnique()), constraint?.minSize, constraint?.maxSize)),
    toEquivalence: ([value4]) => makeCompareSet(value4)
  });
  return make21(schema.ast, {
    value: value3
  });
}
function Option(value3) {
  const schema = declareConstructor()([value3], ([value4]) => (input, ast, options) => {
    if (isOption2(input)) {
      if (isNone2(input)) {
        return succeedNone3;
      }
      return mapBothEager2(decodeUnknownEffect(value4)(input.value, options), {
        onSuccess: some2,
        onFailure: (issue) => makeCompositeAtKey(ast, "value", issue, input, options)
      });
    }
    return fail5(new InvalidType(ast, input, options));
  }, {
    representation: {
      id: "effect/schema/Option",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Option(${typeParameters[0].runtime})`,
      Type: `Option.Option<${typeParameters[0].Type}>`,
      importDeclarations: [`import * as Option from "effect/Option"`]
    }),
    expected: "Option",
    toCodec: ([value4]) => link()(Union2([Struct({
      _tag: Literal2("Some"),
      value: value4
    }), Struct({
      _tag: Literal2("None")
    })]), transform2({
      decode: (e) => e._tag === "None" ? none2() : some2(e.value),
      encode: (o) => isSome2(o) ? {
        _tag: "Some",
        value: o.value
      } : {
        _tag: "None"
      }
    }))
  });
  return make21(schema.ast, {
    value: value3
  });
}
function OptionFromNullOr(schema) {
  return NullOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromNullOr()));
}
function OptionFromUndefinedOr(schema) {
  return UndefinedOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromUndefinedOr()));
}
function OptionFromNullishOr(schema, options) {
  return NullishOr(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromNullishOr(options)));
}
var Cookie = /* @__PURE__ */ declare(isCookie, {
  representation: {
    id: "effect/http/Cookie",
    payload: null
  },
  toCode: () => ({
    runtime: "Schema.Cookie",
    Type: "Cookies.Cookie",
    importDeclarations: [`import * as Cookies from "effect/http/Cookies"`]
  }),
  expected: "Cookie"
});
var Cookies = /* @__PURE__ */ declare(isCookies, {
  representation: {
    id: "effect/http/Cookies",
    payload: null
  },
  toCode: () => ({
    runtime: "Schema.Cookies",
    Type: "Cookies.Cookies",
    importDeclarations: [`import * as Cookies from "effect/http/Cookies"`]
  }),
  expected: "Cookies",
  toCodecJson: () => link()(ArraySchema(String6), transform2({
    decode: fromSetCookie,
    encode: toSetCookieHeaders
  })),
  toCodecIso: () => link()(Record(String6, Cookie), transform2({
    decode: fromReadonlyRecord,
    encode: (cookies) => cookies.cookies
  }))
});
var RecordFromCookies = /* @__PURE__ */ Cookies.pipe(/* @__PURE__ */ decodeTo2(/* @__PURE__ */ Record(String6, String6), /* @__PURE__ */ transform2({
  decode: toRecord,
  encode: (self) => fromIterable7(globalThis.Object.entries(self).map(([name, value3]) => makeCookieUnsafe(name, value3)))
})));
var Headers = /* @__PURE__ */ declare(isHeaders, {
  representation: {
    id: "effect/http/Headers",
    payload: null
  },
  toCode: () => ({
    runtime: "Schema.Headers",
    Type: "Headers.Headers",
    importDeclarations: [`import * as Headers from "effect/http/Headers"`]
  }),
  expected: "Headers",
  toEquivalence: () => Equivalence5,
  toCodec: () => link()(Record(String6, String6), transform2({
    decode: fromInput3,
    encode: (headers) => ({
      ...headers
    })
  }))
});
var RetryAfter = /* @__PURE__ */ Union2([/* @__PURE__ */ Struct({
  _tag: /* @__PURE__ */ tag("Duration"),
  duration: /* @__PURE__ */ Duration.check(/* @__PURE__ */ makeFilter2((d) => isFinite(d) && !isNegative(d), {
    expected: "a finite, non-negative duration"
  }))
}), /* @__PURE__ */ Struct({
  _tag: /* @__PURE__ */ tag("DateTime"),
  dateTime: DateTimeUtc
})]);
var retryAfterFromString = /* @__PURE__ */ transformEffect2({
  decode: (s, options) => match2(parseRetryAfter(s), {
    onFailure: () => fail5(new InvalidValue({
      expected: "whole non-negative seconds or an HTTP date (RFC 9110 \xA710.2.3)"
    }, s, options)),
    onSuccess: succeed5
  }),
  encode: (self) => succeed5(formatRetryAfter(self))
});
var RetryAfterFromString = /* @__PURE__ */ String6.annotate({
  expected: "a Retry-After header value"
}).pipe(/* @__PURE__ */ decodeTo2(RetryAfter, retryAfterFromString));
var UrlParams = /* @__PURE__ */ declare(isUrlParams, {
  representation: {
    id: "effect/http/UrlParams",
    payload: null
  },
  toCode: () => ({
    runtime: "Schema.UrlParams",
    Type: "UrlParams.UrlParams",
    importDeclarations: [`import * as UrlParams from "effect/http/UrlParams"`]
  }),
  expected: "UrlParams",
  toEquivalence: () => Equivalence6,
  toCodec: () => link()(ArraySchema(Tuple2([String6, String6])), transform2({
    decode: make13,
    encode: (self) => self.params.map(([key, value3]) => [key, unwrap(value3)])
  }))
});
var JsonFromUrlParamsField = (field, options) => UrlParams.pipe(decodeTo2(fromJsonString2(Unknown2, options), transformEffect2({
  decode: (params) => match(getFirst(params, field), {
    onNone: () => fail5(new Pointer([field], new MissingKey(void 0))),
    onSome: succeed5
  }),
  encode: (value3) => succeed5(make13([[field, value3]]))
})));
var RecordFromUrlParams = /* @__PURE__ */ UrlParams.pipe(/* @__PURE__ */ decodeTo2(/* @__PURE__ */ Record(String6, /* @__PURE__ */ Union2([String6, /* @__PURE__ */ NonEmptyArray(String6)])), /* @__PURE__ */ transform2({
  decode: toReadonlyRecord,
  encode: fromInput4
})));
function OptionFromOptionalKey(schema) {
  return optionalKey2(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromOptionalKey()));
}
function OptionFromOptional(schema) {
  return optional2(schema).pipe(decodeTo2(Option(toType2(schema)), optionFromOptional()));
}
function OptionFromOptionalNullOr(schema, options) {
  const onNoneEncoding = options === void 0 ? "omit" : options.onNoneEncoding;
  const noneValue = onNoneEncoding === null ? null : void 0;
  return optional2(NullOr(schema)).pipe(decodeTo2(Option(toType2(schema)), transformOptional2({
    decode: (oe) => oe.pipe(filter(isNotNullish), some2),
    encode: onNoneEncoding === "omit" ? flatten : (ot) => some2(getOrElse(flatten(ot), () => noneValue))
  })));
}
function Redacted(value3, options) {
  const label = typeof options?.label === "string" ? options.label : void 0;
  const disallowJsonEncode = options?.disallowJsonEncode === true;
  const normalizedOptions = label !== void 0 ? disallowJsonEncode ? {
    label,
    disallowJsonEncode: true
  } : {
    label
  } : disallowJsonEncode ? {
    disallowJsonEncode: true
  } : void 0;
  const decodeLabel = label !== void 0 ? decodeUnknownEffect(Literal2(label)) : void 0;
  const schema = declareConstructor()([value3], ([value4]) => (input, ast, poptions) => {
    if (isRedacted(input)) {
      const label2 = decodeLabel !== void 0 ? mapErrorEager2(decodeLabel(input.label, poptions), (issue) => new Pointer(["label"], issue)) : void_4;
      return flatMapEager2(label2, () => mapBothEager2(decodeUnknownEffect(value4)(value2(input), poptions), {
        onSuccess: (value5) => make12(value5, {
          label: input.label
        }),
        onFailure: () => {
          return new Composite(ast, [new Pointer(["value"], new InvalidValue(void 0, input, poptions))], input, poptions);
        }
      }));
    }
    return fail5(new InvalidType(ast, input, poptions));
  }, {
    representation: {
      id: "effect/schema/Redacted",
      payload: normalizedOptions ?? null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: normalizedOptions !== void 0 ? `Schema.Redacted(${typeParameters[0].runtime}, ${format(normalizedOptions)})` : `Schema.Redacted(${typeParameters[0].runtime})`,
      Type: `Redacted.Redacted<${typeParameters[0].Type}>`,
      importDeclarations: [`import * as Redacted from "effect/Redacted"`]
    }),
    expected: "Redacted",
    toCodecJson: ([value4]) => link()(value4, {
      decode: transform((e) => make12(e, {
        label
      })),
      encode: disallowJsonEncode ? forbidden((oe) => "Cannot serialize Redacted" + (isSome2(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) : transform(value2)
    }),
    toEquivalence: ([value4]) => makeEquivalence6(value4)
  });
  return make21(schema.ast, {
    value: value3
  });
}
function RedactedFromValue(value3, options) {
  return decodeTo2(Redacted(toType2(value3), {
    label: options?.label,
    disallowJsonEncode: options?.disallowEncode
  }), {
    decode: transform((t) => make12(t, {
      label: options?.label
    })),
    encode: options?.disallowEncode ? forbidden((oe) => "Cannot encode Redacted" + (isSome2(oe) && typeof oe.value.label === "string" ? ` with label: "${oe.value.label}"` : "")) : transform(value2)
  })(value3);
}
function Result(success, failure) {
  const schema = declareConstructor()([success, failure], ([success2, failure2]) => (input, ast, options) => {
    if (!isResult2(input)) {
      return fail5(new InvalidType(ast, input, options));
    }
    switch (input._tag) {
      case "Success":
        return mapBothEager2(decodeEffect(success2)(input.success, options), {
          onSuccess: succeed2,
          onFailure: (issue) => makeCompositeAtKey(ast, "success", issue, input, options)
        });
      case "Failure":
        return mapBothEager2(decodeEffect(failure2)(input.failure, options), {
          onSuccess: fail2,
          onFailure: (issue) => makeCompositeAtKey(ast, "failure", issue, input, options)
        });
    }
  }, {
    representation: {
      id: "effect/schema/Result",
      payload: null
    },
    toCode: ({
      typeParameters
    }) => ({
      runtime: `Schema.Result(${typeParameters[0].runtime}, ${typeParameters[1].runtime})`,
      Type: `Result.Result<${typeParameters[0].Type}, ${typeParameters[1].Type}>`,
      importDeclarations: [`import * as Result from "effect/Result"`]
    }),
    expected: "Result",
    toCodec: ([success2, failure2]) => link()(Union2([Struct({
      _tag: Literal2("Success"),
      success: success2
    }), Struct({
      _tag: Literal2("Failure"),
      failure: failure2
    })]), transform2({
      decode: (e) => e._tag === "Success" ? succeed2(e.success) : fail2(e.failure),
      encode: (r) => isSuccess2(r) ? {
        _tag: "Success",
        success: r.success
      } : {
        _tag: "Failure",
        failure: r.failure
      }
    }))
  });
  return make21(schema.ast, {
    success,
    failure
  });
}
var semVerStringTransformation = (parse3, format9) => transformEffect2({
  decode: (input, options) => mapErrorEager2(fromResult2(parse3(input)), (error) => new InvalidValue({
    message: error.message
  }, input, options)),
  encode: (value3) => succeed5(format9(value3))
});
var SemVerCoreArbitrary = /* @__PURE__ */ Struct({
  major: Natural,
  minor: Natural,
  patch: Natural,
  prerelease: /* @__PURE__ */ ArraySchema(/* @__PURE__ */ Union2([Natural, /* @__PURE__ */ String6.check(/* @__PURE__ */ isPattern2(/^[0-9]*[A-Za-z-][0-9A-Za-z-]*$/))]))
});
var semVerFromString = /* @__PURE__ */ semVerStringTransformation(parse, format7);
var SemVerString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a SemVer"
});
var SemVer = /* @__PURE__ */ declare(isSemVer, {
  representation: {
    id: "effect/schema/SemVer",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.SemVer`,
    Type: `SemVer.SemVer`,
    importDeclarations: [`import * as SemVer from "effect/SemVer"`]
  }),
  expected: "SemVer",
  toCodecArbitrary: () => linkDecoding()(Struct({
    ...SemVerCoreArbitrary.fields,
    build: ArraySchema(String6.check(isPattern2(/^[0-9A-Za-z-]+$/)))
  }), transform(make20)),
  toCodecJson: () => link()(SemVerString, semVerFromString),
  toFormatter: () => format7
});
var SemVerFromString = /* @__PURE__ */ SemVerString.pipe(/* @__PURE__ */ decodeTo2(SemVer, semVerFromString));
var semVerRangeFromString = /* @__PURE__ */ semVerStringTransformation(parse2, format8);
var SemVerRangeString = /* @__PURE__ */ String6.annotate({
  expected: "a string that will be decoded as a SemVer range"
});
var SemVerRange = /* @__PURE__ */ declare(isSemVerRange, {
  representation: {
    id: "effect/schema/SemVerRange",
    payload: null
  },
  toCode: () => ({
    runtime: `Schema.SemVerRange`,
    Type: `SemVerRange.SemVerRange`,
    importDeclarations: [`import * as SemVerRange from "effect/SemVerRange"`]
  }),
  expected: "SemVerRange",
  toCodecArbitrary: () => linkDecoding()(ArraySchema(ArraySchema(Struct({
    operator: Literals(["", "=", "<", "<=", ">", ">=", "~", "^"]),
    version: SemVerCoreArbitrary
  })).check(isMinLength(1))), transform((sets) => parseUnsafe(sets.map((set6) => set6.map(({
    operator,
    version
  }) => `${operator}${format7(make20(version))}`).join(" ")).join(" || ")))),
  toCodecJson: () => link()(SemVerRangeString, semVerRangeFromString),
  toFormatter: () => format8
});
var SemVerRangeFromString = /* @__PURE__ */ SemVerRangeString.pipe(/* @__PURE__ */ decodeTo2(SemVerRange, semVerRangeFromString));
var immerable = /* @__PURE__ */ globalThis.Symbol.for("immer-draftable");
var payloadToken = {};
function makeClass(Inherited, identifier2, struct2, annotations, proto) {
  const getClassSchema = getClassSchemaFactory(struct2, identifier2, annotations);
  const ClassTypeId = getClassTypeId(identifier2);
  const out = class extends Inherited {
    constructor(...[input, options]) {
      const internalOptions = options;
      const payload = internalOptions?.["~payload"];
      const value3 = payload?.token === payloadToken ? payload.value : struct2.make(input ?? {}, options);
      super(value3, {
        ...options,
        disableChecks: true,
        "~payload": {
          token: payloadToken,
          value: value3
        }
      });
    }
    static [TypeId31] = TypeId31;
    get [ClassTypeId]() {
      return ClassTypeId;
    }
    static [immerable] = true;
    static identifier = identifier2;
    static fields = struct2.fields;
    static get ast() {
      return getClassSchema(this).ast;
    }
    static pipe() {
      return pipeArguments(this, arguments);
    }
    static rebuild(ast) {
      return getClassSchema(this).rebuild(ast);
    }
    static make(input, options) {
      return make15(getClassSchema(this))(input ?? {}, options);
    }
    static makeOption(input, options) {
      return makeOption(getClassSchema(this))(input ?? {}, options);
    }
    static makeEffect(input, options) {
      return getClassSchema(this).makeEffect(input ?? {}, options);
    }
    static annotate(annotations2) {
      return this.rebuild(annotate(this.ast, annotations2));
    }
    static annotateKey(annotations2) {
      return this.rebuild(annotateKey(this.ast, annotations2));
    }
    static check(...checks) {
      return this.rebuild(appendChecks(this.ast, checks));
    }
    static extend(identifier3) {
      return (schema, annotations2) => {
        const extension = isStruct(schema) ? schema : Struct(schema);
        const fields = {
          ...struct2.fields,
          ...extension.fields
        };
        const ast = struct(fields, struct2.ast.checks, {
          identifier: identifier3
        });
        return makeClass(this, identifier3, makeStruct(appendChecks(ast, extension.ast.checks), fields), annotations2, proto);
      };
    }
    static mapFields(f, options) {
      return struct2.mapFields(f, options);
    }
  };
  if (proto !== void 0) {
    Object.assign(out.prototype, proto(identifier2));
  }
  return out;
}
function makeClassTrusted(self, fields) {
  return new self(fields, {
    "~payload": {
      token: payloadToken,
      value: fields
    }
  });
}
function getClassTransformation(self) {
  return new Transformation(transform((input) => makeClassTrusted(self, input)), passthrough2());
}
function getClassTypeId(identifier2) {
  return `~effect/Schema/Class/${identifier2}`;
}
function getClassSchemaFactory(from, identifier2, annotations) {
  let memo;
  return (self) => {
    if (memo !== void 0) {
      return memo;
    }
    const ClassTypeId = getClassTypeId(identifier2);
    const isClassValue = (input) => input instanceof self || hasProperty(input, ClassTypeId);
    const transformation = getClassTransformation(self);
    const to = make21(new Declaration([from.ast], () => (input, ast, options) => {
      return isClassValue(input) ? succeed5(input) : fail5(new InvalidType(ast, input, options));
    }, {
      identifier: identifier2,
      [CONSTRUCTOR_ANNOTATION_KEY]: ([from2]) => ({
        isConstructed: isClassValue,
        link: new Link(from2, transformation)
      }),
      toCodec: ([from2]) => new Link(from2.ast, transformation),
      toEquivalence: ([from2]) => from2,
      toFormatter: ([from2]) => (t) => `${self.identifier}(${from2(t)})`,
      [SENTINELS_ANNOTATION_KEY]: collectSentinels(from.ast),
      ...annotations
    }));
    return memo = decodeTo2(to, transformation)(from);
  };
}
function isStruct(schema) {
  return isSchema(schema);
}
var Class4 = (identifier2) => (schema, annotations) => {
  const struct2 = isStruct(schema) ? schema : Struct(schema);
  return makeClass(Class3, identifier2, struct2, annotations, (identifier3) => ({
    toString() {
      return `${identifier3}(${format({
        ...this
      })})`;
    }
  }));
};
var TaggedClass = (identifier2) => {
  return (tagValue, schema, annotations) => {
    const struct2 = isStruct(schema) ? schema.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema);
    return Class4(identifier2 ?? tagValue)(struct2, annotations);
  };
};
var Error4 = (identifier2) => (schema, annotations) => {
  const struct2 = isStruct(schema) ? schema : Struct(schema);
  const self = makeClass(Error2, identifier2, struct2, annotations, (identifier3) => ({
    name: identifier3
  }));
  return self;
};
var TaggedError3 = (identifier2) => {
  return (tagValue, schema, annotations) => {
    const struct2 = isStruct(schema) ? schema.mapFields((fields) => ({
      _tag: tag(tagValue),
      ...fields
    }), {
      unsafePreserveChecks: true
    }) : TaggedStruct(tagValue, schema);
    return Error4(identifier2 ?? tagValue)(struct2, annotations);
  };
};
function overrideToFormatter(toFormatter3) {
  return (self) => self.annotate({
    toFormatter: toFormatter3
  });
}
function toFormatter2(schema, options) {
  return toFormatter(schema.ast, options);
}
function overrideToEquivalence(toEquivalence3) {
  return (self) => self.annotate({
    toEquivalence: toEquivalence3
  });
}
function toEquivalence2(schema) {
  return toEquivalence(schema.ast);
}
function toRepresentation2(schema, options) {
  return toRepresentation(schema.ast, options);
}
function toJsonSchemaDocument3(schema, options) {
  const document = toRepresentation(toCodecJsonAST(schema.ast), options);
  return toJsonSchemaDocument(document, options);
}
var toCodecJson2 = toCodecJson;
var toCodecIso2 = toCodecIso;
var toCodecStringTree2 = toCodecStringTree;
var toCodecArrayFromSingle2 = toCodecArrayFromSingle;
var toCodecGoJson2 = toCodecGoJson;
function toEncoderXml2(codec, options) {
  return toEncoderXml(codec, options);
}
function toIso2(schema) {
  return toIso(schema);
}
function toIsoSource2(schema) {
  return toIsoSource(schema);
}
function toIsoFocus2(schema) {
  return toIsoFocus(schema);
}
function overrideToCodecIso(to, transformation) {
  return (schema) => {
    return make21(annotate(schema.ast, {
      toCodecIso: () => new Link(to.ast, makeTransformation(transformation))
    }), {
      schema
    });
  };
}
function toDifferJsonPatch2(schema) {
  return toDifferJsonPatch(schema);
}
function Tree(node) {
  const Tree$ref = suspend3(() => Tree2);
  const Tree2 = Union2([node, ArraySchema(Tree$ref), Record(String6, Tree$ref)]);
  return Tree2;
}
var Json2 = /* @__PURE__ */ make21(/* @__PURE__ */ annotate(Json, {
  toCode: () => ({
    runtime: "Schema.Json",
    Type: "Schema.Json"
  })
}));
var JsonObject = /* @__PURE__ */ Record(String6, Json2);
var JsonError = /* @__PURE__ */ Struct({
  message: String6,
  name: /* @__PURE__ */ optionalKey2(String6),
  stack: /* @__PURE__ */ optionalKey2(String6),
  cause: /* @__PURE__ */ optionalKey2(Json2)
});
var MutableJson2 = /* @__PURE__ */ make21(/* @__PURE__ */ annotate(MutableJson, {
  toCode: () => ({
    runtime: "Schema.MutableJson",
    Type: "Schema.MutableJson"
  })
}));
function resolveAnnotations(schema) {
  return resolve(schema.ast);
}
function resolveAnnotationsKey(schema) {
  return schema.ast.context?.annotations;
}

// node_modules/effect/dist/MutableRef.js
var TypeId32 = "~effect/MutableRef";
var MutableRefProto = {
  [TypeId32]: TypeId32,
  ...PipeInspectableProto,
  toJSON() {
    return {
      _id: "MutableRef",
      current: toJson(this.current)
    };
  }
};
var make22 = (value3) => {
  const ref = Object.create(MutableRefProto);
  ref.current = value3;
  return ref;
};
var set4 = /* @__PURE__ */ dual(2, (self, value3) => {
  self.current = value3;
  return self;
});

// node_modules/effect/dist/Ref.js
var Ref_exports = {};
__export(Ref_exports, {
  get: () => get5,
  getAndSet: () => getAndSet,
  getAndUpdate: () => getAndUpdate,
  getAndUpdateSome: () => getAndUpdateSome,
  getUnsafe: () => getUnsafe3,
  make: () => make23,
  makeUnsafe: () => makeUnsafe7,
  modify: () => modify3,
  modifySome: () => modifySome,
  set: () => set5,
  setAndGet: () => setAndGet,
  update: () => update2,
  updateAndGet: () => updateAndGet,
  updateSome: () => updateSome,
  updateSomeAndGet: () => updateSomeAndGet
});
var TypeId33 = "~effect/Ref";
var RefProto = {
  [TypeId33]: {
    _A: identity
  },
  ...PipeInspectableProto,
  toJSON() {
    return {
      _id: "Ref",
      ref: this.ref
    };
  }
};
var makeUnsafe7 = (value3) => {
  const self = Object.create(RefProto);
  self.ref = make22(value3);
  return self;
};
var make23 = (value3) => sync2(() => makeUnsafe7(value3));
var get5 = (self) => sync2(() => self.ref.current);
var set5 = /* @__PURE__ */ dual(2, (self, value3) => sync2(() => set4(self.ref, value3)));
var getAndSet = /* @__PURE__ */ dual(2, (self, value3) => sync2(() => {
  const current = self.ref.current;
  self.ref.current = value3;
  return current;
}));
var getAndUpdate = /* @__PURE__ */ dual(2, (self, f) => sync2(() => {
  const current = self.ref.current;
  self.ref.current = f(current);
  return current;
}));
var getAndUpdateSome = /* @__PURE__ */ dual(2, (self, pf) => sync2(() => {
  const current = self.ref.current;
  const option3 = pf(current);
  if (option3._tag === "Some") {
    self.ref.current = option3.value;
  }
  return current;
}));
var setAndGet = /* @__PURE__ */ dual(2, (self, value3) => sync2(() => self.ref.current = value3));
var modify3 = /* @__PURE__ */ dual(2, (self, f) => sync2(() => {
  const [b, a] = f(self.ref.current);
  self.ref.current = a;
  return b;
}));
var modifySome = /* @__PURE__ */ dual(2, (self, pf) => modify3(self, (value3) => {
  const [b, option3] = pf(value3);
  return [b, option3._tag === "None" ? value3 : option3.value];
}));
var update2 = /* @__PURE__ */ dual(2, (self, f) => sync2(() => {
  self.ref.current = f(self.ref.current);
}));
var updateAndGet = /* @__PURE__ */ dual(2, (self, f) => sync2(() => self.ref.current = f(self.ref.current)));
var updateSome = /* @__PURE__ */ dual(2, (self, f) => sync2(() => {
  const option3 = f(self.ref.current);
  if (option3._tag === "Some") {
    self.ref.current = option3.value;
  }
}));
var updateSomeAndGet = /* @__PURE__ */ dual(2, (self, pf) => sync2(() => {
  const option3 = pf(self.ref.current);
  if (option3._tag === "Some") {
    self.ref.current = option3.value;
  }
  return self.ref.current;
}));
var getUnsafe3 = (self) => self.ref.current;

// public/generated/contracts.ts
var WireConstants = {
  appUrl: "https://krusegit.github.io/i6-share/",
  chunkSize: 4194304,
  maxBody: 4259840,
  pairTokenTtlMs: 6e5,
  port: 47616,
  protocolVersion: 1,
  syncWaitMs: 25e3
};
var AdminSettingsRequestSchema = Schema_exports.Struct({
  "name": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String)),
  "receiveDirectory": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String))
});
var DeviceSummarySchema = Schema_exports.Struct({
  "deviceId": Schema_exports.String,
  "name": Schema_exports.String,
  "os": Schema_exports.String,
  "pairedAt": Schema_exports.Number,
  "lastSeen": Schema_exports.Number,
  "lastAddr": Schema_exports.String,
  "online": Schema_exports.Boolean
});
var TransferFileSummarySchema = Schema_exports.Struct({
  "name": Schema_exports.String,
  "originalName": Schema_exports.String,
  "size": Schema_exports.Number,
  "type": Schema_exports.String,
  "bytes": Schema_exports.Number,
  "done": Schema_exports.Boolean,
  "where": Schema_exports.NullOr(Schema_exports.String)
});
var IncomingTransferSummarySchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "deviceId": Schema_exports.String,
  "deviceName": Schema_exports.String,
  "files": Schema_exports.Array(TransferFileSummarySchema),
  "count": Schema_exports.Number,
  "done": Schema_exports.Number,
  "bytes": Schema_exports.Number,
  "total": Schema_exports.Number,
  "complete": Schema_exports.Boolean,
  "speed": Schema_exports.Number,
  "createdAt": Schema_exports.Number,
  "lastActivity": Schema_exports.Number
});
var FileMetadataSchema = Schema_exports.Struct({
  "name": Schema_exports.String,
  "size": Schema_exports.Number,
  "type": Schema_exports.String,
  "lastModified": Schema_exports.Number
});
var OutboxSummarySchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "deviceId": Schema_exports.String,
  "createdAt": Schema_exports.Number,
  "files": Schema_exports.Array(FileMetadataSchema),
  "count": Schema_exports.Number,
  "bytes": Schema_exports.Number,
  "total": Schema_exports.Number,
  "speed": Schema_exports.Number,
  "started": Schema_exports.Boolean
});
var ReceivedFileSummarySchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "deviceId": Schema_exports.String,
  "deviceName": Schema_exports.String,
  "name": Schema_exports.String,
  "originalName": Schema_exports.String,
  "size": Schema_exports.Number,
  "type": Schema_exports.String,
  "where": Schema_exports.NullOr(Schema_exports.String),
  "at": Schema_exports.Number
});
var AdminStatusResponseSchema = Schema_exports.Struct({
  "hubId": Schema_exports.String,
  "name": Schema_exports.String,
  "receiveDirectory": Schema_exports.String,
  "port": Schema_exports.Number,
  "addrs": Schema_exports.Array(Schema_exports.String),
  "devices": Schema_exports.Array(DeviceSummarySchema),
  "transfers": Schema_exports.Array(IncomingTransferSummarySchema),
  "outbox": Schema_exports.Array(OutboxSummarySchema),
  "history": Schema_exports.Array(ReceivedFileSummarySchema)
});
var ErrorResponseSchema = Schema_exports.Struct({
  "error": Schema_exports.String
});
var HelloResponseSchema = Schema_exports.Struct({
  "app": Schema_exports.Literal("i6-share-hub"),
  "v": Schema_exports.Number,
  "id": Schema_exports.String,
  "name": Schema_exports.String,
  "port": Schema_exports.Number,
  "addrs": Schema_exports.Array(Schema_exports.String)
});
var OfferedFileMetadataSchema = Schema_exports.Struct({
  "name": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String)),
  "size": Schema_exports.Number,
  "type": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String)),
  "lastModified": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.Number))
});
var OfferRequestSchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "files": Schema_exports.Array(OfferedFileMetadataSchema)
});
var OfferResponseSchema = Schema_exports.Struct({
  "received": Schema_exports.Array(Schema_exports.Number)
});
var OperationResponseSchema = Schema_exports.Struct({
  "ok": Schema_exports.Boolean
});
var OutboxEntrySchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "files": Schema_exports.Array(FileMetadataSchema)
});
var PairCodeResponseSchema = Schema_exports.Struct({
  "payload": Schema_exports.String,
  "link": Schema_exports.String,
  "expiresAt": Schema_exports.Number
});
var PairRequestSchema = Schema_exports.Struct({
  "deviceId": Schema_exports.String,
  "name": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String)),
  "os": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String))
});
var PairResponseSchema = Schema_exports.Struct({
  "secret": Schema_exports.String,
  "hubId": Schema_exports.String,
  "name": Schema_exports.String
});
var PullRequestSchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "i": Schema_exports.Number,
  "offset": Schema_exports.Number,
  "length": Schema_exports.Number
});
var PullResponseSchema = Schema_exports.Struct({
  "size": Schema_exports.Number
});
var PutRequestSchema = Schema_exports.Struct({
  "tid": Schema_exports.String,
  "i": Schema_exports.Number,
  "offset": Schema_exports.Number
});
var PutResponseSchema = Schema_exports.Struct({
  "bytes": Schema_exports.Number,
  "error": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String))
});
var QueueFilesRequestSchema = Schema_exports.Struct({
  "deviceId": Schema_exports.String,
  "paths": Schema_exports.Array(Schema_exports.String)
});
var QueueFilesResponseSchema = Schema_exports.Struct({
  "tid": Schema_exports.String
});
var SyncRequestSchema = Schema_exports.Struct({
  "wait": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.Number)),
  "name": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String)),
  "os": Schema_exports.optionalKey(Schema_exports.NullOr(Schema_exports.String))
});
var SyncResponseSchema = Schema_exports.Struct({
  "name": Schema_exports.String,
  "addrs": Schema_exports.Array(Schema_exports.String),
  "outbox": Schema_exports.Array(OutboxEntrySchema)
});
var TransferRequestSchema = Schema_exports.Struct({
  "tid": Schema_exports.String
});
var UnpairRequestSchema = Schema_exports.Struct({});
var WireResponseDecoders = {
  cancel: Schema_exports.decodeUnknownSync(OperationResponseSchema),
  end: Schema_exports.decodeUnknownSync(OperationResponseSchema),
  offer: Schema_exports.decodeUnknownSync(OfferResponseSchema),
  pair: Schema_exports.decodeUnknownSync(PairResponseSchema),
  pull: Schema_exports.decodeUnknownSync(PullResponseSchema),
  pulled: Schema_exports.decodeUnknownSync(OperationResponseSchema),
  put: Schema_exports.decodeUnknownSync(PutResponseSchema),
  sync: Schema_exports.decodeUnknownSync(SyncResponseSchema),
  unpair: Schema_exports.decodeUnknownSync(OperationResponseSchema)
};

// public/lib/runtime.ts
var runEffect = (program) => Effect_exports.runPromise(Effect_exports.result(program)).then(Result_exports.match({
  onFailure: (error) => {
    throw error;
  },
  onSuccess: (value3) => value3
}));

// public/lib/proto.ts
var PROTOCOL_VERSION = WireConstants.protocolVersion;
var PORT = WireConstants.port;
var APP_URL = WireConstants.appUrl;
var CHUNK_SIZE = WireConstants.chunkSize;
var MAX_BODY = WireConstants.maxBody;
var SYNC_WAIT_MS = WireConstants.syncWaitMs;
var PAIR_TOKEN_TTL_MS = WireConstants.pairTokenTtlMs;
var enc = new TextEncoder();
var dec = new TextDecoder();
var bytesOf = (bytes2) => new Uint8Array(bytes2);
var concat = (parts2) => {
  const out = new Uint8Array(parts2.reduce((size6, part) => size6 + part.length, 0));
  parts2.reduce((offset, part) => {
    out.set(part, offset);
    return offset + part.length;
  }, 0);
  return out;
};
var isJsonObject2 = (value3) => typeof value3 === "object" && value3 !== null && !Array.isArray(value3);
var b64url = (bytes2) => btoa(Array.from(bytesOf(bytes2), (byte) => String.fromCharCode(byte)).join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64url = (str) => {
  const value3 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(value3 + "=".repeat((4 - value3.length % 4) % 4)), (char) => char.charCodeAt(0));
};
var randomBytesEffect = (size6) => Effect_exports.sync(() => crypto.getRandomValues(new Uint8Array(size6)));
var randomBytes = (size6) => Effect_exports.runSync(randomBytesEffect(size6));
var bytesToHex = (bytes2) => Array.from(bytes2, (byte) => byte.toString(16).padStart(2, "0")).join("");
var randomId = (size6 = 8) => bytesToHex(randomBytes(size6));
var frame = (json, binary) => {
  const encoded = enc.encode(JSON.stringify(json ?? {}));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, encoded.length);
  return concat([length, encoded, binary == null ? new Uint8Array(0) : bytesOf(binary)]);
};
var unframe = (bytes2) => {
  const value3 = bytesOf(bytes2);
  if (value3.length < 4) throw new Error("bad frame");
  const length = new DataView(value3.buffer).getUint32(0);
  if (length > value3.length - 4) throw new Error("bad frame");
  const json = JSON.parse(dec.decode(value3.subarray(4, 4 + length)));
  if (!isJsonObject2(json)) throw new Error("frame JSON must be an object");
  return { json, binary: value3.subarray(4 + length) };
};
var attempt2 = (operation) => Effect_exports.tryPromise({ try: operation, catch: (error) => error });
var hkdfKey = (secret, salt, info) => attempt2(() => crypto.subtle.importKey("raw", bytesOf(secret), "HKDF", false, ["deriveKey"])).pipe(
  Effect_exports.flatMap((base) => attempt2(() => crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(salt), info: enc.encode(info) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )))
);
var pairKeyEffect = (token, hubId) => hkdfKey(token, "i6-share-pair", hubId);
var deviceKeyEffect = (secret, deviceId) => hkdfKey(secret, "i6-share-v1", deviceId);
var pairKey = (token, hubId) => runEffect(pairKeyEffect(token, hubId));
var deviceKey = (secret, deviceId) => runEffect(deviceKeyEffect(secret, deviceId));
var sealEffect = (key, aad, json, binary) => randomBytesEffect(12).pipe(Effect_exports.flatMap((iv) => attempt2(() => crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, frame(json, binary))).pipe(Effect_exports.map((ciphertext) => ({ body: concat([iv, new Uint8Array(ciphertext)]), iv })))));
var seal = (key, aad, json, binary) => runEffect(sealEffect(key, aad, json, binary));
var openEffect = (key, aad, body) => Effect_exports.suspend(() => {
  const value3 = bytesOf(body);
  if (value3.length < 28) return Effect_exports.fail(new Error("short envelope"));
  const iv = value3.slice(0, 12);
  return attempt2(() => crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(aad) },
    key,
    value3.subarray(12)
  )).pipe(Effect_exports.flatMap((plaintext) => Effect_exports.try({ try: () => ({ ...unframe(plaintext), iv }), catch: (error) => error })));
});
var open = (key, aad, body) => runEffect(openEffect(key, aad, body));
var requestAad = (op, deviceId) => `i6 req ${op} ${deviceId}`;
var responseAad = (op, requestIv) => `i6 res ${op} ${b64url(requestIv)}`;
var decodePairPayload = (str) => {
  const value3 = unb64url(str.trim());
  if (value3[0] !== 1) throw new Error("unsupported pairing code");
  if (value3.length < 28) throw new Error("truncated pairing code");
  const view = new DataView(value3.buffer);
  const port = view.getUint16(25);
  const count = view.getUint8(27);
  const addressData = Array.from({ length: count }).reduce((state) => {
    if (state.offset >= value3.length) throw new Error("truncated pairing code");
    const family = view.getUint8(state.offset);
    if (family !== 4 && family !== 6) throw new Error("unsupported address family");
    const end = state.offset + 1 + (family === 4 ? 4 : 16);
    if (end > value3.length) throw new Error("truncated pairing code");
    return { offset: end, addrs: [...state.addrs, bytesToIp(value3.subarray(state.offset + 1, end))] };
  }, { offset: 28, addrs: [] });
  return {
    hubId: bytesToHex(value3.subarray(1, 9)),
    token: value3.slice(9, 25),
    port,
    addrs: addressData.addrs,
    name: dec.decode(value3.subarray(addressData.offset))
  };
};
var pairPayloadFromText = (text) => decodePairPayload(/pair=([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? text);
var ipToBytes = (address) => {
  const ip = address.replace(/^\[|\]$/g, "").replace(/^::ffff:(?=\d+\.)/i, "").replace(/%.*$/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const octets = ip.split(".").map(Number);
    return octets.every((octet) => octet <= 255) ? Uint8Array.from(octets) : null;
  }
  if (!ip.includes(":")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const [head3 = "", tail] = halves;
  const left = head3 === "" ? [] : head3.split(":");
  const right = tail === void 0 || tail === "" ? [] : tail.split(":");
  const missing2 = 8 - left.length - right.length;
  if (tail !== void 0 && missing2 < 1) return null;
  const groups = [...left, ...Array.from({ length: tail === void 0 ? 0 : missing2 }, () => "0"), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) return null;
  return Uint8Array.from(groups.flatMap((group) => {
    const value3 = Number.parseInt(group, 16);
    return [value3 >> 8, value3 & 255];
  }));
};
var bytesToIp = (bytes2) => {
  if (bytes2.length === 4) return [...bytes2].join(".");
  if (bytes2.length !== 16) throw new Error("invalid IP byte length");
  const value3 = bytesOf(bytes2);
  const view = new DataView(value3.buffer);
  return Array.from({ length: 8 }, (_, index2) => view.getUint16(index2 * 2).toString(16)).join(":").replace(/(^|:)0(:0)+(:|$)/, "::").replace(/:{3,}/g, "::");
};
var isPrivateIp = (ip) => {
  const bytes2 = ipToBytes(ip);
  if (bytes2 === null) return false;
  const view = new DataView(bytes2.buffer);
  const first = view.getUint8(0);
  const second = view.getUint8(1);
  if (bytes2.length === 4) return first === 10 || first === 127 || first === 172 && second >= 16 && second <= 31 || first === 192 && second === 168 || first === 169 && second === 254;
  return (first & 254) === 252 || first === 254 && (second & 192) === 128 || bytes2.every((byte, index2) => byte === (index2 === 15 ? 1 : 0));
};
var baseUrl = (ip, port = PORT) => `http://${ip.includes(":") ? `[${ip}]` : ip}:${String(port)}`;
var backoffDelay = (attempt3, min5, max5, random3) => {
  const base = Math.min(max5, min5 * 2 ** attempt3);
  return base / 2 + random3 * (base / 2);
};
var createBackoff = (min5 = 500, max5 = 3e4, random3 = Math.random) => {
  const attempts = Effect_exports.runSync(Ref_exports.make(0));
  return {
    next: () => Effect_exports.runSync(Ref_exports.getAndUpdate(attempts, (attempt3) => attempt3 + 1).pipe(
      Effect_exports.map((attempt3) => backoffDelay(attempt3, min5, max5, random3()))
    )),
    reset: () => {
      Effect_exports.runSync(Ref_exports.set(attempts, 0));
    }
  };
};
var sleepEffect = (ms) => Effect_exports.sleep(ms);
var sleep3 = (ms, signal) => Effect_exports.runPromise(sleepEffect(ms), signal === void 0 ? {} : { signal });
var cleanFileName = (name) => {
  const cleaned = Array.from(name ?? "", (char) => char === "/" || char === "\\" || char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? "_" : char).join("").replace(/^\.+/, "").trim().slice(0, 200);
  return cleaned || "file";
};

// public/client.ts
var UserAgentSchema = Schema_exports.Struct({ platform: Schema_exports.optional(Schema_exports.String) });
var ModelSchema = Schema_exports.Struct({ model: Schema_exports.optional(Schema_exports.String) });
var HubSchema = Schema_exports.Struct({ hubId: Schema_exports.String, name: Schema_exports.String, port: Schema_exports.Number, addrs: Schema_exports.Array(Schema_exports.String), lastAddr: Schema_exports.String, secret: Schema_exports.String, pairedAt: Schema_exports.Number, lastSeen: Schema_exports.Number });
var QueueSchema = Schema_exports.Struct({ tid: Schema_exports.String, hubId: Schema_exports.String, files: Schema_exports.Array(Schema_exports.instanceOf(File)), names: Schema_exports.optional(Schema_exports.Array(Schema_exports.String)), total: Schema_exports.optional(Schema_exports.Number), createdAt: Schema_exports.optional(Schema_exports.Number), failed: Schema_exports.optional(Schema_exports.Array(Schema_exports.Number)), status: Schema_exports.optional(Schema_exports.String) });
var readError = async (response) => {
  const decoded = Schema_exports.decodeUnknownOption(ErrorResponseSchema)(await response.json().catch(() => ({})));
  return decoded._tag === "Some" ? decoded.value.error : "";
};
var APP_VERSION = "1.1.0";
var HELLO_TIMEOUT = 4e3;
var SWEEP_TIMEOUT = 1500;
var SWEEP_CONCURRENCY = 32;
var SWEEP_MIN_INTERVAL = 6e4;
var REQ_TIMEOUT = 15e3;
var DATA_TIMEOUT = 6e4;
var FAST_FAIL_MS = 500;
var SAVE_LASTSEEN_MS = 6e4;
var clientError = (name, message, cause, code = "", status = 0, fast = false) => Object.assign(new Error(message, { cause }), { name, code, status, fast });
var NetError = (message, cause, fast = false) => clientError("NetError", message, cause, "", 0, fast);
var HttpError = (status, code = "") => clientError("HttpError", `HTTP ${String(status)}${code ? ` ${code}` : ""}`, void 0, code, status);
var UnpairedError = (code) => clientError("UnpairedError", `unpaired (${code || "unknown-device"})`, void 0, code);
var AbortedError = () => clientError("AbortedError", "aborted");
var PairError = (code, message) => clientError("PairError", message, void 0, code);
var isClientError = (error, name) => error instanceof Error && error.name === name && "code" in error && typeof error.code === "string" && "status" in error && typeof error.status === "number" && "fast" in error && typeof error.fast === "boolean";
var isAbortedError = (error) => isClientError(error, "AbortedError");
var errorMessage = (error) => error instanceof Error ? error.message : String(error);
var nonempty = (value3) => value3 === void 0 || value3.length === 0 ? void 0 : value3;
var isEntropyReader = (value3) => typeof value3 === "function";
var ignore3 = () => void 0;
var unique = (list) => [...new Set(list.filter((entry) => typeof entry === "string" && entry.length > 0))];
var sum3 = (list) => list.reduce((n, x) => n + x, 0);
function anySignal(...signals) {
  return AbortSignal.any(signals.filter((signal) => signal !== void 0));
}
function addressSpace(ip) {
  const b = ipToBytes(ip);
  const loop = b !== null && (b.length === 4 ? b[0] === 127 : b.every((x, i) => x === (i === 15 ? 1 : 0)));
  return loop ? "loopback" : "local";
}
var defaultFetch = (input, init) => globalThis.fetch(input, init);
var fetchEffect = (fetch, input, init) => runEffect(Effect_exports.tryPromise({ try: () => fetch(input, init), catch: (error) => error }));
function memoryStore(entries3 = []) {
  const state = Effect_exports.runSync(Ref_exports.make(new Map(entries3)));
  return {
    get: (key) => runEffect(Effect_exports.map(Ref_exports.get(state), (map10) => map10.get(key))),
    put: (key, value3) => runEffect(Ref_exports.update(state, (map10) => new Map([...map10, [key, value3]]))),
    delete: (key) => runEffect(Ref_exports.update(state, (map10) => new Map([...map10].filter(([stored]) => stored !== key)))),
    all: () => runEffect(Effect_exports.map(Ref_exports.get(state), (map10) => [...map10.values()]))
  };
}
async function guessDevice() {
  const nav = globalThis.navigator;
  const uad = "userAgentData" in nav ? nav.userAgentData : void 0;
  const agent = Schema_exports.decodeUnknownOption(UserAgentSchema)(uad);
  const agentData = agent._tag === "Some" ? agent.value : void 0;
  const ua = nav.userAgent;
  const p = `${agentData?.platform ?? ""} ${ua}`;
  const os = /android/i.test(p) ? "android" : /cros|chrome ?os/i.test(p) ? "chromeos" : /iphone|ipad|ios/i.test(p) ? "ios" : /win/i.test(p) ? "windows" : /mac/i.test(p) ? "macos" : /linux/i.test(p) ? "linux" : "unknown";
  let model = "";
  try {
    if (uad !== null && typeof uad === "object" && "getHighEntropyValues" in uad && isEntropyReader(uad.getHighEntropyValues)) {
      const response = await uad.getHighEntropyValues(["model"]);
      model = Schema_exports.decodeUnknownSync(ModelSchema)(response).model ?? "";
    }
  } catch {
  }
  if (!model && os === "android") {
    const m = /Android [\d.]+; ([^;)]+)\)/.exec(ua);
    if (m?.[1] !== void 0 && m[1].trim() !== "K") model = m[1].trim();
  }
  const fallback = { android: "Android phone", chromeos: "Chromebook", ios: "iPhone", windows: "Windows PC", macos: "Mac", linux: "Linux PC", unknown: "Browser" };
  return { name: (model || fallback[os]).slice(0, 40), os };
}
async function hello(addr, port = PORT, { timeout: timeout3 = HELLO_TIMEOUT, signal, fetch = defaultFetch } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetchEffect(fetch, `${baseUrl(addr, port)}/i6/hello`, {
      cache: "no-store",
      credentials: "omit",
      targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(timeout3), signal)
    });
    if (!res.ok) throw HttpError(res.status);
    const j = Schema_exports.decodeUnknownSync(HelloResponseSchema)(await res.json());
    return j;
  } catch (err) {
    if (signal?.aborted === true) throw AbortedError();
    throw NetError(`hello ${addr}: ${errorMessage(err)}`, err, err instanceof TypeError && Date.now() - t0 < FAST_FAIL_MS);
  }
}
function sweepCandidates(addrs, maxNets = 4) {
  const seen = new Set(addrs);
  const nets = /* @__PURE__ */ new Set();
  const out = [];
  for (const a of addrs) {
    const b = ipToBytes(a);
    if (b?.length !== 4 || !isPrivateIp(a) || b[0] === 127 || b[0] === 169 && b[1] === 254) continue;
    const net = `${String(b[0])}.${String(b[1])}.${String(b[2])}`;
    if (nets.has(net) || nets.size >= maxNets) continue;
    nets.add(net);
    const host = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint8(3);
    const hosts = Array.from({ length: 254 }, (_, i) => i + 1).sort((x, y) => Math.abs(x - host) - Math.abs(y - host));
    for (const x of hosts) {
      const ip = `${net}.${String(x)}`;
      if (!seen.has(ip)) {
        seen.add(ip);
        out.push(ip);
      }
    }
  }
  return out;
}
async function locateHub({ hubId, port = PORT, addrs = [], lastAddr }, { sweep = false, signal, fetch } = {}) {
  const known = unique([lastAddr, ...addrs]);
  const tryAddr = async (addr, timeout3, sig2) => {
    const j = await hello(addr, port, { timeout: timeout3, signal: sig2, fetch });
    if (hubId !== void 0 && j.id !== hubId) throw NetError(`${addr} is a different hub`);
    return { addr, hello: j };
  };
  let fast = 0;
  if (known.length) {
    const ctl2 = new AbortController();
    try {
      const r = await Promise.any(known.map((a) => tryAddr(a, HELLO_TIMEOUT, anySignal(ctl2.signal, signal)).catch((err) => {
        if (isClientError(err, "NetError") && err.fast) fast++;
        throw err;
      })));
      ctl2.abort();
      return r;
    } catch {
      if (signal?.aborted === true) throw AbortedError();
    }
  }
  const blocked = known.length > 0 && fast === known.length;
  if (!sweep) return { addr: null, blocked };
  const candidates = sweepCandidates(known);
  const ctl = new AbortController();
  const sig = anySignal(ctl.signal, signal);
  const search = Effect_exports.runSync(Ref_exports.make(null));
  const found = () => Effect_exports.runSync(Ref_exports.get(search));
  const addresses = candidates.values();
  const worker = async () => {
    while (found() === null && !sig.aborted) {
      const next = addresses.next();
      if (next.done === true) return;
      try {
        const result3 = await tryAddr(next.value, SWEEP_TIMEOUT, sig);
        Effect_exports.runSync(Ref_exports.update(search, (current) => current ?? result3));
        ctl.abort();
      } catch {
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, candidates.length) }, worker));
  if (found() === null && signal?.aborted === true) throw AbortedError();
  return found() ?? { addr: null, blocked };
}
async function pairAt(addr, p, { deviceId, name, os, fetch = defaultFetch, signal }) {
  const key = await pairKey(p.token, p.hubId);
  const { body, iv } = await seal(key, requestAad("pair", "pair"), { deviceId, name, os });
  let res;
  let buf;
  try {
    res = await fetchEffect(fetch, `${baseUrl(addr, p.port)}/i6/pair?h=${p.hubId}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      cache: "no-store",
      credentials: "omit",
      targetAddressSpace: addressSpace(addr),
      signal: anySignal(AbortSignal.timeout(REQ_TIMEOUT), signal)
    });
    buf = res.status === 200 ? await res.arrayBuffer() : null;
  } catch (err) {
    if (signal?.aborted === true) throw AbortedError();
    throw NetError(`pair ${addr}: ${errorMessage(err)}`, err);
  }
  if (!buf) {
    const err = await readError(res);
    throw HttpError(res.status, err);
  }
  let json;
  try {
    json = Schema_exports.decodeUnknownSync(PairResponseSchema)((await open(key, responseAad("pair", iv), buf)).json);
  } catch {
    json = null;
  }
  if (json === null || json.secret.length === 0 || json.hubId !== p.hubId) throw PairError("bad-response", "The computer sent an invalid pairing response.");
  return { ...json, secret: json.secret };
}
async function pairWithHub(input, { deviceId, name, os, fetch = defaultFetch, signal, onStatus }) {
  const p = typeof input === "string" ? pairPayloadFromText(input) : input;
  const backoff = createBackoff(500, 5e3);
  for (let attempt3 = 0; ; attempt3++) {
    if (signal?.aborted === true) throw AbortedError();
    onStatus?.("searching");
    const sweep = attempt3 === 2 || attempt3 > 2 && attempt3 % 6 === 2;
    const loc = await locateHub({ hubId: p.hubId, port: p.port, addrs: p.addrs }, { sweep, signal, fetch });
    if (loc.addr !== null) {
      onStatus?.("pairing");
      try {
        const json = await pairAt(loc.addr, p, { deviceId, name, os, fetch, signal });
        const now2 = Date.now();
        return {
          hubId: p.hubId,
          name: nonempty(json.name) ?? nonempty(loc.hello.name) ?? nonempty(p.name) ?? "Computer",
          port: p.port,
          addrs: unique([loc.addr, ...loc.hello.addrs, ...p.addrs]).slice(0, 8),
          lastAddr: loc.addr,
          secret: json.secret,
          pairedAt: now2,
          lastSeen: now2
        };
      } catch (err) {
        if (isClientError(err, "HttpError") && err.status < 500) {
          throw err.status === 401 ? PairError("expired", "This pairing code has expired or was already used. Show the QR code again on your computer.") : PairError("rejected", `The computer rejected the pairing (${err.code || String(err.status)}).`);
        }
        if (!(isClientError(err, "NetError") || isClientError(err, "HttpError"))) throw err;
      }
    } else if (loc.blocked) onStatus?.("blocked");
    try {
      await sleep3(backoff.next(), signal);
    } catch {
      throw AbortedError();
    }
  }
}
function createHubClient(engine, rec) {
  const state = Effect_exports.runSync(Ref_exports.make({ rec, status: "searching", addr: null, fails: 0, lastSweep: 0, stopped: false, _key: null, _locating: null, _syncCtl: null, _pumping: false, _savedAt: 0, _forgetting: false }));
  const self = {
    update: (patch) => Effect_exports.runSync(Ref_exports.updateAndGet(state, (current) => ({ ...current, ...patch }))),
    engine,
    syncBackoff: createBackoff(500, 3e4),
    xferBackoff: createBackoff(500, 3e4),
    life: new AbortController(),
    get rec() {
      return Effect_exports.runSync(Ref_exports.get(state)).rec;
    },
    get status() {
      return Effect_exports.runSync(Ref_exports.get(state)).status;
    },
    get addr() {
      return Effect_exports.runSync(Ref_exports.get(state)).addr;
    },
    get fails() {
      return Effect_exports.runSync(Ref_exports.get(state)).fails;
    },
    get lastSweep() {
      return Effect_exports.runSync(Ref_exports.get(state)).lastSweep;
    },
    get stopped() {
      return Effect_exports.runSync(Ref_exports.get(state)).stopped;
    },
    get _key() {
      return Effect_exports.runSync(Ref_exports.get(state))._key;
    },
    get _locating() {
      return Effect_exports.runSync(Ref_exports.get(state))._locating;
    },
    get _syncCtl() {
      return Effect_exports.runSync(Ref_exports.get(state))._syncCtl;
    },
    get _pumping() {
      return Effect_exports.runSync(Ref_exports.get(state))._pumping;
    },
    get _savedAt() {
      return Effect_exports.runSync(Ref_exports.get(state))._savedAt;
    },
    get _forgetting() {
      return Effect_exports.runSync(Ref_exports.get(state))._forgetting;
    },
    get id() {
      return self.rec.hubId;
    },
    get name() {
      return self.rec.name;
    },
    get lastSeen() {
      return self.rec.lastSeen;
    },
    key() {
      const key = self._key ?? deviceKey(unb64url(self.rec.secret), self.engine.deviceId);
      self.update({ _key: key });
      return key;
    },
    start() {
      void self._syncLoop().catch(ignore3);
      self.pump();
    },
    stop() {
      self.update({ stopped: true });
      self.life.abort();
    },
    _setStatus(status) {
      if (self.status === status) return;
      self.update({ status });
      self.engine._emit("status", { hubId: self.id, status, lastSeen: self.rec.lastSeen });
    },
    _seen() {
      self.update({ fails: 0 });
      self.update({ rec: { ...self.rec, lastSeen: Date.now() } });
      self._setStatus("online");
      self.engine._network(false);
      if (Date.now() - self._savedAt > SAVE_LASTSEEN_MS) self._save();
    },
    _save() {
      if (self.stopped) return;
      self.update({ _savedAt: Date.now() });
      void self.engine.hubsStore.put(self.id, self.rec).catch(ignore3);
    },
    /** Merge addresses / name learnt from hello or sync. */
    _learn(addrs, addr, name) {
      const next = unique([addr, ...addrs, ...self.rec.addrs]).slice(0, 8);
      let changed = next.join() !== self.rec.addrs.join() || addr !== null && addr !== self.rec.lastAddr;
      self.update({ rec: { ...self.rec, addrs: next } });
      if (addr !== null) self.update({ rec: { ...self.rec, lastAddr: addr } });
      if (name.length > 0 && name !== self.rec.name) {
        self.update({ rec: { ...self.rec, name: name.slice(0, 60) } });
        changed = true;
        self.engine._emit("hubs", {});
      }
      if (changed) self._save();
    },
    /** Sleep that a kick() ends early; throws AbortedError if stopped / signal aborted. */
    async _nap(ms, signal) {
      try {
        await sleep3(ms, anySignal(self.engine._wake.signal, self.life.signal, signal));
      } catch {
      }
      if (self.stopped || signal?.aborted === true) throw AbortedError();
    },
    _waitWake() {
      return new Promise((resolve3) => {
        const s = anySignal(self.engine._wake.signal, self.life.signal);
        s.addEventListener("abort", () => {
          resolve3();
        }, { once: true });
      });
    },
    /** Single-flight hub location; resolves with a verified address or throws NetError. */
    locate() {
      const locating = self._locating ?? self._locate().finally(() => {
        self.update({ _locating: null });
      });
      self.update({ _locating: locating });
      return locating;
    },
    async _locate() {
      self._setStatus("searching");
      const now2 = Date.now();
      const sweep = self.fails >= 2 && now2 - self.lastSweep > SWEEP_MIN_INTERVAL;
      if (sweep) self.update({ lastSweep: now2 });
      const r = await locateHub(self.rec, { sweep, fetch: self.engine._fetch, signal: self.life.signal });
      if (r.addr !== null) {
        self.update({ addr: r.addr });
        self._learn(r.hello.addrs, r.addr, r.hello.name);
        self._seen();
        return r.addr;
      }
      self.update({ fails: self.fails + 1 });
      self._setStatus("offline");
      if (r.blocked) self.engine._network(true);
      throw NetError(`${self.name} not reachable`);
    },
    /** One encrypted request to one address. */
    async request(op, json, binary, { addr = self.addr ?? self.rec.lastAddr, timeout: timeout3 = REQ_TIMEOUT, signal } = {}) {
      const e = self.engine;
      const key = await self.key();
      const { body, iv } = await seal(key, requestAad(op, e.deviceId), json, binary);
      let res;
      let buf;
      try {
        res = await fetchEffect(e._fetch, `${baseUrl(addr, self.rec.port)}/i6/${op}?d=${e.deviceId}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body,
          cache: "no-store",
          credentials: "omit",
          targetAddressSpace: addressSpace(addr),
          signal: anySignal(AbortSignal.timeout(timeout3), signal, self.life.signal)
        });
        buf = res.status === 200 ? await res.arrayBuffer() : null;
      } catch (err2) {
        if (signal?.aborted === true || self.stopped) throw AbortedError();
        throw NetError(`${op} ${addr}: ${errorMessage(err2)}`, err2);
      }
      if (buf) {
        try {
          const opened = await open(key, responseAad(op, iv), buf);
          return { ...opened, json: WireResponseDecoders[op](opened.json) };
        } catch (err2) {
          throw NetError(`${op} ${addr}: undecryptable response`, err2);
        }
      }
      const err = await readError(res);
      if (res.status === 401) await self._checkUnpaired(addr, err);
      throw HttpError(res.status, err);
    },
    /** A 401 only counts if the hub at that address really is ours (not some other hub after a DHCP shuffle). */
    async _checkUnpaired(addr, code) {
      let j;
      try {
        j = await hello(addr, self.rec.port, { fetch: self.engine._fetch, signal: self.life.signal });
      } catch {
        throw NetError("auth failed, hub not verifiable");
      }
      if (j.id !== self.id) {
        self.update({ addr: null });
        throw NetError(`another hub answered at ${addr}`);
      }
      await self.engine._unpaired(self, code);
      throw UnpairedError(code);
    },
    /** request() on the current address, locating the hub first if needed. */
    async call(op, json, binary, opts = {}) {
      if (self.stopped) throw AbortedError();
      const addr = self.addr ?? await self.locate();
      try {
        const r = await self.request(op, json, binary, { ...opts, addr });
        self._seen();
        return r;
      } catch (err) {
        if (isClientError(err, "HttpError")) self._seen();
        if (isClientError(err, "NetError")) {
          if (self.addr === addr) self.update({ addr: null });
          self.update({ fails: self.fails + 1 });
        }
        throw err;
      }
    },
    /** call() retried forever on network errors / 5xx (backoff + jitter, kick resets). */
    async callRetry(op, json, binary, { backoff = self.xferBackoff, signal, timeout: timeout3 } = {}) {
      for (; ; ) {
        if (self.stopped || signal?.aborted === true) throw AbortedError();
        try {
          const r = await self.call(op, json, binary, { timeout: timeout3, signal });
          backoff.reset();
          return r;
        } catch (err) {
          if (!(isClientError(err, "NetError") || isClientError(err, "HttpError") && err.status >= 500)) throw err;
          await self._nap(backoff.next(), signal);
        }
      }
    },
    // ------------------------------------------------ sync (long poll) + incoming
    async _syncLoop() {
      const e = self.engine;
      try {
        while (!self.stopped) {
          if (!e.visible) {
            await self._waitWake();
            continue;
          }
          const ctl = new AbortController();
          self.update({ _syncCtl: ctl });
          const t0 = Date.now();
          try {
            const { json } = await self.call(
              "sync",
              { wait: SYNC_WAIT_MS, name: e.deviceName, os: e.os },
              null,
              { timeout: SYNC_WAIT_MS + 1e4, signal: ctl.signal }
            );
            self.syncBackoff.reset();
            self._learn(json.addrs, self.addr, json.name);
            const outbox = json.outbox;
            const ok = await self._receive(outbox);
            if (!ok) await self._nap(self.syncBackoff.next());
            else if (!outbox.length && Date.now() - t0 < 1e3) await self._nap(1e3);
          } catch (err) {
            if (self.life.signal.aborted || isClientError(err, "UnpairedError")) return;
            if (isClientError(err, "AbortedError") && ctl.signal.aborted) continue;
            await self._nap(self.syncBackoff.next());
          }
        }
      } finally {
        self.update({ _syncCtl: null });
      }
    },
    async _receive(outbox) {
      let ok = true;
      for (const entry of outbox) {
        if (!entry.tid) continue;
        try {
          await self._pull(entry);
        } catch (err) {
          if (self.stopped || isClientError(err, "UnpairedError")) throw err;
          ok = false;
        }
      }
      return ok;
    },
    async _pull({ tid, files }) {
      const e = self.engine;
      const initial = { tid, hubId: self.id, names: files.map((f) => f.name), total: sum3(files.map((f) => f.size)), received: 0, status: "receiving" };
      const incoming = Effect_exports.runSync(Ref_exports.make(initial));
      const snapshot2 = () => Effect_exports.runSync(Ref_exports.get(incoming));
      if (!e._pulled.has(tid)) {
        e._busy(1);
        try {
          e._emit("incoming", snapshot2());
          for (const [i, meta] of files.entries()) {
            let size6 = meta.size;
            let pos = 0;
            const parts2 = [];
            while (pos < size6) {
              const length = Math.min(CHUNK_SIZE, size6 - pos);
              const { json, binary } = await self.callRetry(
                "pull",
                { tid, i, offset: pos, length },
                null,
                { timeout: DATA_TIMEOUT, backoff: self.syncBackoff }
              );
              size6 = json.size;
              const chunk = binary.subarray(0, Math.max(0, Math.min(length, size6 - pos)));
              if (!chunk.byteLength) {
                if (pos >= size6) break;
                throw HttpError(502, "empty-chunk");
              }
              parts2.push(new Blob([chunk]));
              pos += chunk.byteLength;
              Effect_exports.runSync(Ref_exports.update(incoming, (current) => ({ ...current, received: current.received + chunk.byteLength })));
              e._emit("incoming", snapshot2());
            }
            const file = new File(parts2, cleanFileName(meta.name), { type: meta.type || "", lastModified: meta.lastModified || Date.now() });
            e._emit("file", { hubId: self.id, hubName: self.name, tid, index: i, file });
          }
        } finally {
          e._busy(-1);
        }
        await e._markPulled(tid);
      }
      await self.callRetry("pulled", { tid }, null, { backoff: self.syncBackoff });
      e._emit("incoming", { ...snapshot2(), received: initial.total, status: "done" });
    },
    // ------------------------------------------------ outgoing transfers
    /** Process this hub's queued transfers one at a time. */
    pump() {
      if (self._pumping || self.stopped) return;
      self.update({ _pumping: true });
      void (async () => {
        try {
          for (let t; !self.stopped && (t = self.engine._nextTransfer(self.id)); ) await self._send(t);
        } finally {
          self.update({ _pumping: false });
        }
      })().catch(ignore3);
    },
    async _send(t) {
      const e = self.engine;
      const sig = t.abort.signal;
      const { tid } = t;
      const meta = t.files.map((f) => ({ name: f.name || "file", size: f.size, type: f.type || "", lastModified: f.lastModified || t.createdAt }));
      t.update({ status: "sending" });
      e._busy(1);
      e._progress(t);
      try {
        for (; ; ) {
          try {
            const { json: offer } = await self.callRetry("offer", { tid, files: meta }, null, { signal: sig });
            const have = offer.received;
            t.update({ acked: meta.map((m, i) => t.failed.includes(i) ? m.size : Math.min(Number(have[i]) || 0, m.size)) });
            t.update({ error: null });
            t.update({ lastAt: 0 });
            e._progress(t);
            for (const [i, file] of t.files.entries()) {
              if (!t.failed.includes(i)) await self._sendFile(t, i, sig, file);
            }
            const { json: end } = await self.callRetry("end", { tid }, null, { signal: sig });
            if (!end.ok && !t.failed.length) throw HttpError(409, "incomplete");
            await e._finish(t, t.failed.length ? "partial" : "done");
            return;
          } catch (err) {
            if (sig.aborted || self.stopped || isClientError(err, "AbortedError") || isClientError(err, "UnpairedError")) return;
            t.update({ error: errorMessage(err) });
            e._progress(t);
            await self._nap(self.xferBackoff.next(), sig).catch(ignore3);
          }
        }
      } finally {
        e._busy(-1);
      }
    },
    async _sendFile(t, i, sig, f) {
      const size6 = f.size;
      const opts = { signal: sig, timeout: DATA_TIMEOUT };
      if (size6 === 0) {
        await self.callRetry("put", { tid: t.tid, i, offset: 0 }, new Uint8Array(0), opts);
        return;
      }
      let pos = sum3(t.acked.slice(i, i + 1));
      while (pos < size6) {
        let buf;
        try {
          buf = await f.slice(pos, Math.min(size6, pos + CHUNK_SIZE)).arrayBuffer();
        } catch (err) {
          await self.engine._failFile(t, i, err);
          return;
        }
        const { json } = await self.callRetry("put", { tid: t.tid, i, offset: pos }, buf, opts);
        pos = Math.min(json.bytes, size6);
        t.update({ acked: t.acked.map((acked, index2) => index2 === i ? pos : acked) });
        self.engine._progress(t);
      }
    }
  };
  return self;
}
var ACTIVE = /* @__PURE__ */ new Set(["queued", "sending"]);
function createShareEngine({ kv, hubs, queue, fetch }) {
  const listeners = {
    hubs: /* @__PURE__ */ new Map(),
    status: /* @__PURE__ */ new Map(),
    transfer: /* @__PURE__ */ new Map(),
    incoming: /* @__PURE__ */ new Map(),
    file: /* @__PURE__ */ new Map(),
    unpaired: /* @__PURE__ */ new Map(),
    network: /* @__PURE__ */ new Map(),
    busy: /* @__PURE__ */ new Map(),
    warning: /* @__PURE__ */ new Map()
  };
  const state = Effect_exports.runSync(Ref_exports.make({ _hubs: /* @__PURE__ */ new Map(), _transfers: /* @__PURE__ */ new Map(), _pulled: /* @__PURE__ */ new Set(), _wake: new AbortController(), _busyCount: 0, _blocked: false, visible: true, deviceId: "", deviceName: "", os: "" }));
  const self = {
    update: (patch) => Effect_exports.runSync(Ref_exports.updateAndGet(state, (current) => ({ ...current, ...patch }))),
    get _hubs() {
      return Effect_exports.runSync(Ref_exports.get(state))._hubs;
    },
    get _transfers() {
      return Effect_exports.runSync(Ref_exports.get(state))._transfers;
    },
    get _pulled() {
      return Effect_exports.runSync(Ref_exports.get(state))._pulled;
    },
    get _wake() {
      return Effect_exports.runSync(Ref_exports.get(state))._wake;
    },
    get _busyCount() {
      return Effect_exports.runSync(Ref_exports.get(state))._busyCount;
    },
    get _blocked() {
      return Effect_exports.runSync(Ref_exports.get(state))._blocked;
    },
    get visible() {
      return Effect_exports.runSync(Ref_exports.get(state)).visible;
    },
    get deviceId() {
      return Effect_exports.runSync(Ref_exports.get(state)).deviceId;
    },
    get deviceName() {
      return Effect_exports.runSync(Ref_exports.get(state)).deviceName;
    },
    get os() {
      return Effect_exports.runSync(Ref_exports.get(state)).os;
    },
    kv,
    hubsStore: hubs,
    queueStore: queue,
    _fetch: fetch ?? defaultFetch,
    addEventListener(type, listener, options) {
      const config = typeof options === "object" ? options : {};
      if (config.signal?.aborted === true || listeners[type].has(listener)) return;
      const abort = () => {
        self.removeEventListener(type, listener);
      };
      listeners[type].set(listener, { once: config.once === true, signal: config.signal, abort });
      config.signal?.addEventListener("abort", abort, { once: true });
    },
    removeEventListener(type, listener) {
      const entry = listeners[type].get(listener);
      listeners[type].delete(listener);
      entry?.signal?.removeEventListener("abort", entry.abort);
    },
    _emit(type, detail) {
      for (const [listener, entry] of [...listeners[type]]) {
        if (!listeners[type].has(listener)) continue;
        if (entry.once) self.removeEventListener(type, listener);
        Effect_exports.runSync(Effect_exports.ignore(Effect_exports.try(() => {
          listener(new CustomEvent(type, { detail }));
        })));
      }
    },
    async init({ visible = true, name, os } = {}) {
      self.update({ visible });
      const guess = await guessDevice();
      const storedId = await self.kv.get("deviceId");
      self.update({ deviceId: typeof storedId === "string" ? storedId : "" });
      if (!self.deviceId) {
        self.update({ deviceId: randomId(8) });
        await self.kv.put("deviceId", self.deviceId);
      }
      const storedName = await self.kv.get("deviceName");
      self.update({ deviceName: nonempty(typeof storedName === "string" ? storedName : "") ?? nonempty(name) ?? guess.name });
      self.update({ os: nonempty(os) ?? guess.os });
      await self.kv.put("deviceName", self.deviceName);
      await self.kv.put("os", self.os);
      const pulled = Schema_exports.decodeUnknownOption(Schema_exports.Array(Schema_exports.String))(await self.kv.get("pulledTids"));
      self.update({ _pulled: new Set(pulled._tag === "Some" ? pulled.value : []) });
      for (const raw of await self.hubsStore.all()) {
        const decoded = Schema_exports.decodeUnknownOption(HubSchema)(raw);
        if (decoded._tag === "Some") {
          const rec = { ...decoded.value, addrs: [...decoded.value.addrs] };
          self.update({ _hubs: new Map([...self._hubs, [rec.hubId, createHubClient(self, rec)]]) });
        }
      }
      for (const raw of await self.queueStore.all()) {
        const decoded = Schema_exports.decodeUnknownOption(QueueSchema)(raw);
        if (decoded._tag === "Some" && ACTIVE.has(decoded.value.status ?? "queued")) {
          const rec = decoded.value;
          self._track({ ...rec, files: [...rec.files], names: rec.names ? [...rec.names] : rec.files.map((file) => file.name), total: rec.total ?? sum3(rec.files.map((file) => file.size)), createdAt: rec.createdAt ?? Date.now(), failed: [...rec.failed ?? []] }, Promise.resolve());
        }
      }
      for (const hub of self._hubs.values()) hub.start();
      self._emit("hubs", {});
      for (const t of self._transfers.values()) self._emit("transfer", self._snap(t));
      return self;
    },
    get hubs() {
      return [...self._hubs.values()];
    },
    hub(hubId) {
      return self._hubs.get(hubId);
    },
    get transfers() {
      return [...self._transfers.values()].map((t) => self._snap(t));
    },
    async setDeviceName(name) {
      const n = name.trim().slice(0, 40);
      if (!n || n === self.deviceName) return;
      self.update({ deviceName: n });
      await self.kv.put("deviceName", n);
      self.kick();
    },
    setVisible(visible) {
      self.update({ visible });
      if (self.visible) self.kick();
    },
    kick() {
      const w = self._wake;
      self.update({ _wake: new AbortController() });
      w.abort();
      for (const hub of self._hubs.values()) {
        hub.syncBackoff.reset();
        hub.xferBackoff.reset();
        hub.update({ lastSweep: 0 });
        hub._syncCtl?.abort();
      }
    },
    stop() {
      for (const hub of self._hubs.values()) hub.stop();
      for (const t of self._transfers.values()) t.abort.abort();
    },
    async pair(input, { signal, onStatus } = {}) {
      const rec = await pairWithHub(input, {
        deviceId: self.deviceId,
        name: self.deviceName,
        os: self.os,
        fetch: self._fetch,
        signal,
        onStatus: (s) => {
          if (s === "blocked") self._network(true);
          onStatus?.(s);
        }
      });
      self._network(false);
      self._hubs.get(rec.hubId)?.stop();
      await self.hubsStore.put(rec.hubId, rec);
      const hub = createHubClient(self, rec);
      hub.update({ addr: rec.lastAddr });
      self.update({ _hubs: new Map([...self._hubs, [rec.hubId, hub]]) });
      hub.start();
      hub._seen();
      self._emit("hubs", {});
      return hub;
    },
    send(hubId, files) {
      return runEffect(Effect_exports.tryPromise({ try: async () => {
        const hub = self._hubs.get(hubId);
        if (!hub) throw new Error("Unknown computer");
        const list = [...files].map((f) => f instanceof File ? f : new File([f], "file", { type: f.type || "" }));
        if (!list.length) throw new Error("No files");
        const rec = {
          tid: randomId(12),
          hubId,
          files: list,
          names: list.map((f) => f.name),
          total: sum3(list.map((f) => f.size)),
          createdAt: Date.now(),
          failed: []
        };
        const saved = self.queueStore.put(rec.tid, rec).catch((err) => {
          self._emit("warning", { message: `Could not save transfer: ${errorMessage(err)}` });
        });
        const t = self._track(rec, saved);
        self._emit("transfer", self._snap(t));
        hub.pump();
        return await Promise.resolve(rec.tid);
      }, catch: (error) => error }));
    },
    async cancel(tid) {
      const t = self._transfers.get(tid);
      if (!t || !ACTIVE.has(t.status)) return;
      await self._drop(t);
      void self._hubs.get(t.hubId)?.call("cancel", { tid }, null, { timeout: 5e3 }).catch(ignore3);
    },
    async forget(hubId) {
      const hub = self._hubs.get(hubId);
      if (!hub) return;
      hub.update({ _forgetting: true });
      for (const t of [...self._transfers.values()]) if (t.hubId === hubId && ACTIVE.has(t.status)) await self._drop(t);
      try {
        await hub.request("unpair", {}, null, { timeout: 3e3 });
      } catch {
      }
      hub.stop();
      self.update({ _hubs: new Map([...self._hubs].filter(([id2]) => id2 !== hubId)) });
      await self.hubsStore.delete(hubId).catch(ignore3);
      self._emit("hubs", {});
    },
    // ------------------------------------------------ internals
    _track(rec, saved) {
      const state2 = Effect_exports.runSync(Ref_exports.make({ files: rec.files, status: "queued", failed: [...rec.failed], acked: rec.files.map(() => 0), rate: 0, error: null, doneAt: 0, rec, lastAt: 0, lastSent: 0 }));
      const t = {
        update: (patch) => Effect_exports.runSync(Ref_exports.updateAndGet(state2, (current) => ({ ...current, ...patch }))),
        tid: rec.tid,
        hubId: rec.hubId,
        names: rec.names,
        total: rec.total,
        createdAt: rec.createdAt || Date.now(),
        abort: new AbortController(),
        saved,
        get files() {
          return Effect_exports.runSync(Ref_exports.get(state2)).files;
        },
        get status() {
          return Effect_exports.runSync(Ref_exports.get(state2)).status;
        },
        get failed() {
          return Effect_exports.runSync(Ref_exports.get(state2)).failed;
        },
        get acked() {
          return Effect_exports.runSync(Ref_exports.get(state2)).acked;
        },
        get rate() {
          return Effect_exports.runSync(Ref_exports.get(state2)).rate;
        },
        get error() {
          return Effect_exports.runSync(Ref_exports.get(state2)).error;
        },
        get doneAt() {
          return Effect_exports.runSync(Ref_exports.get(state2)).doneAt;
        },
        get rec() {
          return Effect_exports.runSync(Ref_exports.get(state2)).rec;
        },
        get lastAt() {
          return Effect_exports.runSync(Ref_exports.get(state2)).lastAt;
        },
        get lastSent() {
          return Effect_exports.runSync(Ref_exports.get(state2)).lastSent;
        }
      };
      self.update({ _transfers: new Map([...self._transfers, [t.tid, t]]) });
      return t;
    },
    _snap(t) {
      return Object.freeze({
        tid: t.tid,
        hubId: t.hubId,
        names: Object.freeze([...t.names]),
        total: t.total,
        sent: Math.min(t.total, sum3(t.acked)),
        rate: t.rate,
        status: t.status,
        failed: Object.freeze([...t.failed]),
        error: t.error,
        createdAt: t.createdAt,
        doneAt: t.doneAt
      });
    },
    _nextTransfer(hubId) {
      let best;
      for (const t of self._transfers.values()) {
        if (t.hubId === hubId && ACTIVE.has(t.status) && (!best || t.createdAt < best.createdAt)) best = t;
      }
      return best;
    },
    _progress(t) {
      const sent = sum3(t.acked);
      const now2 = Date.now();
      if (t.lastAt && sent > t.lastSent) {
        const inst = (sent - t.lastSent) / Math.max(1e-3, (now2 - t.lastAt) / 1e3);
        t.update({ rate: t.rate ? t.rate * 0.6 + inst * 0.4 : inst });
      }
      if (!t.lastAt || sent !== t.lastSent) {
        t.update({ lastAt: now2 });
        t.update({ lastSent: sent });
      }
      self._emit("transfer", self._snap(t));
    },
    async _failFile(t, i, err) {
      t.update({ failed: [.../* @__PURE__ */ new Set([...t.failed, i])] });
      t.update({ acked: t.acked.map((acked, index2) => index2 === i ? sum3(t.files.slice(i, i + 1).map((file) => file.size)) : acked) });
      t.update({ error: `${t.names[i] ?? "file"}: ${(err instanceof Error ? err.name : "") || "read error"}` });
      t.update({ rec: { ...t.rec, failed: [...t.failed] } });
      await t.saved;
      await self.queueStore.put(t.tid, t.rec).catch(ignore3);
      self._progress(t);
    },
    async _finish(t, status) {
      t.update({ status });
      t.update({ doneAt: Date.now() });
      t.update({ rate: 0 });
      t.update({ files: [] });
      t.update({ rec: { ...t.rec, files: [] } });
      await t.saved;
      await self.queueStore.delete(t.tid).catch(ignore3);
      self._emit("transfer", self._snap(t));
    },
    /** Cancel locally: abort, forget the persisted record. Returns the files not yet failed. */
    async _drop(t) {
      const files = t.files.filter((_, i) => !t.failed.includes(i));
      t.update({ status: "cancelled" });
      t.abort.abort();
      t.update({ doneAt: Date.now() });
      t.update({ files: [] });
      t.update({ rec: { ...t.rec, files: [] } });
      await t.saved;
      await self.queueStore.delete(t.tid).catch(ignore3);
      self._emit("transfer", self._snap(t));
      return files;
    },
    async _unpaired(hub, reason) {
      if (hub.stopped || hub._forgetting) return;
      hub.stop();
      self.update({ _hubs: new Map([...self._hubs].filter(([id2]) => id2 !== hub.id)) });
      await self.hubsStore.delete(hub.id).catch(ignore3);
      const files = [];
      for (const t of [...self._transfers.values()]) {
        if (t.hubId === hub.id && ACTIVE.has(t.status)) files.push(...await self._drop(t));
      }
      self._emit("unpaired", { hubId: hub.id, name: hub.name, reason, files });
      self._emit("hubs", {});
    },
    async _markPulled(tid) {
      self.update({ _pulled: /* @__PURE__ */ new Set([...self._pulled, tid]) });
      const list = [...self._pulled].slice(-100);
      self.update({ _pulled: new Set(list) });
      await self.kv.put("pulledTids", list).catch(ignore3);
    },
    _busy(delta) {
      const was = self._busyCount > 0;
      self.update({ _busyCount: Math.max(0, self._busyCount + delta) });
      if (was !== self._busyCount > 0) self._emit("busy", { busy: self._busyCount > 0 });
    },
    _network(blocked) {
      if (self._blocked === blocked) return;
      self.update({ _blocked: blocked });
      self._emit("network", { blocked });
    }
  };
  const hubView = (hub) => Object.freeze({
    get id() {
      return hub.id;
    },
    get name() {
      return hub.name;
    },
    get status() {
      return hub.status;
    },
    get addr() {
      return hub.addr;
    },
    get lastSeen() {
      return hub.lastSeen;
    },
    get rec() {
      return Object.freeze({ ...hub.rec, addrs: Object.freeze([...hub.rec.addrs]) });
    }
  });
  const view = Object.freeze({
    get visible() {
      return self.visible;
    },
    get deviceId() {
      return self.deviceId;
    },
    get deviceName() {
      return self.deviceName;
    },
    get os() {
      return self.os;
    },
    get hubs() {
      return Object.freeze(self.hubs.map(hubView));
    },
    get transfers() {
      return Object.freeze(self.transfers);
    },
    addEventListener: self.addEventListener,
    removeEventListener: self.removeEventListener,
    init: async (options) => {
      await self.init(options);
      return view;
    },
    hub: (id2) => {
      const hub = self.hub(id2);
      return hub === void 0 ? void 0 : hubView(hub);
    },
    setDeviceName: self.setDeviceName,
    setVisible: self.setVisible,
    kick: self.kick,
    stop: self.stop,
    pair: async (input, options) => hubView(await self.pair(input, options)),
    send: self.send,
    cancel: self.cancel,
    forget: self.forget
  });
  return view;
}
export {
  APP_VERSION,
  AbortedError,
  HttpError,
  NetError,
  PairError,
  UnpairedError,
  createShareEngine,
  guessDevice,
  hello,
  isAbortedError,
  isClientError,
  locateHub,
  memoryStore,
  pairWithHub,
  sweepCandidates
};
//# sourceMappingURL=client.js.map
