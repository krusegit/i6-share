var __defProp = Object.defineProperty;
var __export = (target, all4) => {
  for (var name in all4)
    __defProp(target, name, { get: all4[name], enumerable: true });
};

// node_modules/effect/dist/Pipeable.js
var pipeArguments = (self2, args2) => {
  switch (args2.length) {
    case 0:
      return self2;
    case 1:
      return args2[0](self2);
    case 2:
      return args2[1](args2[0](self2));
    case 3:
      return args2[2](args2[1](args2[0](self2)));
    case 4:
      return args2[3](args2[2](args2[1](args2[0](self2))));
    case 5:
      return args2[4](args2[3](args2[2](args2[1](args2[0](self2)))));
    case 6:
      return args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self2))))));
    case 7:
      return args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self2)))))));
    case 8:
      return args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self2))))))));
    case 9:
      return args2[8](args2[7](args2[6](args2[5](args2[4](args2[3](args2[2](args2[1](args2[0](self2)))))))));
    default: {
      let ret = self2;
      for (let i = 0, len = args2.length; i < len; i++) {
        ret = args2[i](ret);
      }
      return ret;
    }
  }
};

// node_modules/effect/dist/Function.js
var dual = function(arity, body) {
  if (typeof arity === "function") {
    return function() {
      return arity(arguments) ? body.apply(this, arguments) : (self2) => body(self2, ...arguments);
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
        return function(self2) {
          return body(self2, a);
        };
      };
    case 3:
      return function(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c);
        }
        return function(self2) {
          return body(self2, a, b);
        };
      };
    default:
      return function() {
        if (arguments.length >= arity) {
          return body.apply(this, arguments);
        }
        const args2 = arguments;
        return function(self2) {
          return body(self2, ...args2);
        };
      };
  }
};
var identity = (a) => a;
var constant = (value) => () => value;
var constTrue = /* @__PURE__ */ constant(true);
var constFalse = /* @__PURE__ */ constant(false);
var constNull = /* @__PURE__ */ constant(null);
var constUndefined = /* @__PURE__ */ constant(void 0);
var constVoid = constUndefined;

// node_modules/effect/dist/internal/equal.js
var getAllObjectKeys = (obj) => {
  const keys = new Set(Reflect.ownKeys(obj));
  if (obj.constructor === Object) return keys;
  if (obj instanceof Error) {
    keys.delete("stack");
  }
  const proto = Object.getPrototypeOf(obj);
  let current = proto;
  while (current !== null && current !== Object.prototype) {
    const ownKeys = Reflect.ownKeys(current);
    for (let i = 0; i < ownKeys.length; i++) {
      keys.add(ownKeys[i]);
    }
    current = Object.getPrototypeOf(current);
  }
  if (keys.has("constructor") && typeof obj.constructor === "function" && proto === obj.constructor.prototype) {
    keys.delete("constructor");
  }
  return keys;
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
function isFunction(input) {
  return typeof input === "function";
}
function isUndefined(input) {
  return input === void 0;
}
function isNotUndefined(input) {
  return input !== void 0;
}
function isObjectKeyword(input) {
  return typeof input === "object" && input !== null || isFunction(input);
}
var hasProperty = /* @__PURE__ */ dual(2, (self2, property) => isObjectKeyword(self2) && property in self2);
var isTagged = /* @__PURE__ */ dual(2, (self2, tag) => hasProperty(self2, "_tag") && self2["_tag"] === tag);
function isIterable(input) {
  return hasProperty(input, Symbol.iterator) || isString(input);
}

// node_modules/effect/dist/Hash.js
var symbol = "~effect/Hash";
var hash = (self2) => {
  switch (typeof self2) {
    case "number":
      return number(self2);
    case "bigint":
      return string(self2.toString(10));
    case "string":
      return string(self2);
    case "function":
    case "object": {
      if (self2 === null) {
        break;
      } else if (self2 instanceof Date) {
        if (Number.isNaN(self2.getTime())) {
          return string("Invalid Date");
        }
        return string(self2.toISOString());
      } else if (self2 instanceof RegExp) {
        return string(self2.toString());
      } else {
        if (byReferenceInstances.has(self2)) {
          return random(self2);
        }
        const cached3 = hashCache.get(self2);
        if (cached3 !== void 0) {
          return cached3;
        }
        if (visitedObjects.has(self2)) {
          addBackEdge();
          return string("[Circular]");
        }
        visitedObjects.add(self2);
        const seen = backEdges;
        let h;
        try {
          if (symbol in self2) {
            h = self2[symbol]();
          } else if (typeof self2 === "function") {
            h = random(self2);
          } else if (self2 instanceof DataView) {
            h = array(viewBytes(self2));
          } else if (Array.isArray(self2) || ArrayBuffer.isView(self2)) {
            h = array(self2);
          } else if (self2 instanceof Map) {
            h = hashMap(self2);
          } else if (self2 instanceof Set) {
            h = hashSet(self2);
          } else {
            h = structure(self2);
          }
        } finally {
          visitedObjects.delete(self2);
        }
        if (seen === backEdges) {
          hashCache.set(self2, h);
        }
        return h;
      }
    }
  }
  return optimize(mix(string(String(self2))));
};
var random = (self2) => {
  if (!randomHashCache.has(self2)) {
    randomHashCache.set(self2, optimize(Math.random() * 4294967296 | 0));
  }
  return randomHashCache.get(self2);
};
var mix = (h) => {
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  return h ^ h >>> 16;
};
var combine = /* @__PURE__ */ dual(2, (self2, b) => mix(Math.imul(self2, 2654435761) + Math.imul(b, 2246822507)));
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
var structureKeys = (o, keys) => {
  let h = 12289;
  for (const key of keys) {
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
    return (self2) => compareBoth(self2, arguments[0]);
  }
  return compareBoth(arguments[0], arguments[1]);
}
function compareBoth(self2, that) {
  if (self2 === that) return true;
  if (self2 == null || that == null) return false;
  const selfType = typeof self2;
  if (selfType !== typeof that) {
    return false;
  }
  if (selfType === "number" && self2 !== self2 && that !== that) {
    return true;
  }
  if (selfType !== "object" && selfType !== "function") {
    return false;
  }
  if (byReferenceInstances.has(self2) || byReferenceInstances.has(that)) {
    return false;
  }
  return compareObjects(self2, that);
}
function compareObjects(self2, that) {
  const depth = pathLeft.length;
  for (let i = depth; i-- > 0; ) {
    if (pathLeft[i] === self2 && pathRight[i] === that) return true;
  }
  if (depth) return compareOnPath(self2, that);
  let known = results.get(self2);
  if (!known) results.set(self2, known = /* @__PURE__ */ new WeakMap());
  let result3 = known.get(that);
  if (result3 === void 0) known.set(that, result3 = compareOnPath(self2, that));
  return result3;
}
function compareOnPath(self2, that) {
  pathLeft.push(self2);
  pathRight.push(that);
  try {
    return compareStructure(self2, that);
  } finally {
    pathLeft.pop();
    pathRight.pop();
  }
}
var pathLeft = [];
var pathRight = [];
var results = /* @__PURE__ */ new WeakMap();
function compareStructure(self2, that) {
  if (hash(self2) !== hash(that)) {
    return false;
  } else if (self2 instanceof Date) {
    if (!(that instanceof Date)) return false;
    const selfTime = self2.getTime();
    const thatTime = that.getTime();
    return selfTime === thatTime || Number.isNaN(selfTime) && Number.isNaN(thatTime);
  } else if (self2 instanceof RegExp) {
    return that instanceof RegExp && self2.toString() === that.toString();
  }
  const bothEquals = isEqual(self2);
  if (bothEquals !== isEqual(that) || typeof self2 === "function" && !bothEquals) {
    return false;
  } else if (bothEquals) {
    return self2[symbol2](that);
  } else if (Array.isArray(self2)) {
    if (!Array.isArray(that) || self2.length !== that.length) {
      return false;
    }
    return compareArrays(self2, that);
  } else if (ArrayBuffer.isView(self2)) {
    const selfIsDataView = self2 instanceof DataView;
    if (!ArrayBuffer.isView(that) || self2.byteLength !== that.byteLength || selfIsDataView !== that instanceof DataView) {
      return false;
    }
    if (selfIsDataView) {
      return compareTypedArrays(viewBytes(self2), viewBytes(that));
    }
    return compareTypedArrays(self2, that);
  } else if (self2 instanceof Map) {
    if (!(that instanceof Map) || self2.size !== that.size) {
      return false;
    }
    return compareHashed(self2, that, entryHash, equalEntries);
  } else if (self2 instanceof Set) {
    if (!(that instanceof Set) || self2.size !== that.size) {
      return false;
    }
    return compareHashed(self2, that, hash, compareBoth);
  }
  return compareRecords(self2, that);
}
function compareArrays(self2, that) {
  for (let i = 0; i < self2.length; i++) {
    if (!compareBoth(self2[i], that[i])) {
      return false;
    }
  }
  return true;
}
function compareTypedArrays(self2, that) {
  if (self2.length !== that.length) {
    return false;
  }
  for (let i = 0; i < self2.length; i++) {
    if (self2[i] !== that[i]) {
      return false;
    }
  }
  return true;
}
function compareRecords(self2, that) {
  const selfKeys = getAllObjectKeys(self2);
  const thatKeys = getAllObjectKeys(that);
  if (selfKeys.size !== thatKeys.size) {
    return false;
  }
  for (const key of selfKeys) {
    if (!thatKeys.has(key) || !compareBoth(self2[key], that[key])) {
      return false;
    }
  }
  return true;
}
function compareHashed(self2, that, hashOf, equivalent) {
  const groups = /* @__PURE__ */ new Map();
  let remaining = 0;
  for (const item of that) {
    const h = hashOf(item);
    const group = groups.get(h);
    if (group) group.push(item);
    else groups.set(h, [item]);
    remaining++;
  }
  outer: for (const item of self2) {
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
var equalEntries = (self2, that) => compareBoth(self2[0], that[0]) && compareBoth(self2[1], that[1]);
var isEqual = (u) => hasProperty(u, symbol2);
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
  function recur(v, d = 0) {
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
        output = recur(getRedacted(v), d);
      } else if (Array.isArray(v)) {
        output = !gap || v.length <= 1 ? `[${v.map((x) => recur(x, d)).join(",")}]` : `[
${ind(d + 1)}${v.map((x) => recur(x, d + 1)).join(",\n" + ind(d + 1))}
${ind(d)}]`;
      } else if (v instanceof Date) {
        output = formatDate(v);
      } else if (!options?.ignoreToString && hasProperty(v, "toString") && typeof v["toString"] === "function" && v["toString"] !== Object.prototype.toString && v["toString"] !== Array.prototype.toString) {
        const s = safeToString(v);
        output = v instanceof Error && v.cause !== void 0 ? `${s} (cause: ${recur(v.cause, d)})` : s;
      } else if (Symbol.iterator in v) {
        output = `${v.constructor.name}(${recur(Array.from(v), d)})`;
      } else {
        const keys = ownKeys(v);
        if (!gap || keys.length <= 1) {
          const body = `{${keys.map((k) => `${formatPropertyKey(k)}:${recur(safeGet(v, k), d)}`).join(",")}}`;
          output = wrap(v, body);
        } else {
          const body = `{
${keys.map((k) => `${ind(d + 1)}${formatPropertyKey(k)}: ${recur(safeGet(v, k), d + 1)}`).join(",\n")}
${ind(d)}}`;
          output = wrap(v, body);
        }
      }
      ancestors.delete(v);
      return output;
    }
    return String(v);
  }
  return recur(input, 0);
}
var CIRCULAR = "[Circular]";
function formatPropertyKey(name) {
  return typeof name === "string" ? JSON.stringify(name) : String(name);
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
  return JSON.stringify(input, function(key, value) {
    const original = Object.getOwnPropertyDescriptor(this, key)?.value;
    const redacted = hasProperty(original, symbolRedactable) ? redact(original) : redact(value);
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
        const value2 = Reflect.get(target, key2, target);
        return Object.getOwnPropertyDescriptor(target, key2)?.get !== void 0 ? redact(value2) : value2;
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
var Class = class {
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
var setStackTraceLimit = (value) => {
  if (canWriteStackTraceLimit) {
    ;
    Error.stackTraceLimit = value;
  }
};

// node_modules/effect/dist/Utils.js
var SingleShotGen = class {
  constructor(self2) {
    this.value = self2;
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
function assignProperty(self2, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(self2, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } else {
    ;
    self2[key] = value;
  }
}
function assignProperties(self2, source) {
  if (!Object.hasOwn(source, "__proto__")) {
    Object.assign(self2, source);
    return;
  }
  for (const key of Reflect.ownKeys(source)) {
    if (Object.prototype.propertyIsEnumerable.call(source, key)) {
      assignProperty(self2, key, source[key]);
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
var isCause = (self2) => hasProperty(self2, CauseTypeId);
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
    annotations.mapUnsafe.forEach((value, key) => {
      if (options?.overwrite !== true && newAnnotations.has(key)) return;
      newAnnotations.set(key, value);
    });
    const self2 = Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    self2.annotations = newAnnotations;
    return self2;
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
var dedupeReasons = (self2, that) => {
  const buckets = /* @__PURE__ */ new Map();
  const out = [];
  for (const reason of self2.concat(that)) {
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
var causeCombine = /* @__PURE__ */ dual(2, (self2, that) => {
  if (self2.reasons.length === 0) {
    return that;
  } else if (that.reasons.length === 0) {
    return self2;
  }
  const newCause = new CauseImpl(dedupeReasons(self2.reasons, that.reasons));
  return equals(self2, newCause) ? self2 : newCause;
});
var causeAddInterrupts = (self2, interrupts) => {
  const reasons = self2.reasons.slice();
  for (const reason of interrupts.reasons) {
    if (isInterruptReason(reason) && !reasons.some((r) => isInterruptReason(r) && r.fiberId === reason.fiberId && r.annotations === reason.annotations)) {
      reasons.push(reason);
    }
  }
  return reasons.length === self2.reasons.length ? self2 : new CauseImpl(reasons);
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
var causeAnnotate = /* @__PURE__ */ dual((args2) => isCause(args2[0]), (self2, annotations, options) => {
  if (annotations.mapUnsafe.size === 0) return self2;
  return new CauseImpl(self2.reasons.map((f) => f.annotate(annotations, options)));
});
var isFailReason = (self2) => self2._tag === "Fail";
var isDieReason = (self2) => self2._tag === "Die";
var isInterruptReason = (self2) => self2._tag === "Interrupt";
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
  const Proto3 = makePrimitiveProto(options);
  const PrimitiveImpl = function(value) {
    this[args] = value;
  };
  PrimitiveImpl.prototype = Proto3;
  return function(value) {
    return new PrimitiveImpl(value);
  };
};
var makeExit = (options) => {
  const Proto3 = {
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
  const ExitPrimitive = function(value) {
    this[args] = value;
  };
  ExitPrimitive.prototype = Proto3;
  return function(value) {
    return new ExitPrimitive(value);
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
    const value = this[args](fiber3);
    const cont = fiber3.getCont(contA);
    return cont ? cont[contA](value, fiber3) : fiber3.yieldWith(exitSucceed(value));
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
var TaggedError = (tag) => {
  class Base extends Error2 {
    _tag = tag;
  }
  ;
  Base.prototype.name = tag;
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
var Done = (value) => {
  if (value === void 0) return DoneVoid;
  return {
    [DoneTypeId]: DoneTypeId,
    _tag: "Done",
    value
  };
};
var doneVoid = /* @__PURE__ */ exitFail(DoneVoid);
var done = (value) => {
  if (value === void 0) return doneVoid;
  return exitFail(Done(value));
};

// node_modules/effect/dist/Effectable.js
var Prototype = (options) => makePrimitiveProto({
  op: options.label,
  [evaluate]: options.evaluate
});

// node_modules/effect/dist/Equivalence.js
var make = (isEquivalent) => (self2, that) => self2 === that || isEquivalent(self2, that);

// node_modules/effect/dist/internal/doNotation.js
var let_ = (map4) => dual(3, (self2, name, f) => map4(self2, (a) => ({
  ...a,
  [name]: f(a)
})));
var bindTo = (map4) => dual(2, (self2, name) => map4(self2, (a) => ({
  [name]: a
})));
var bind = (map4, flatMap4) => dual(3, (self2, name, f) => flatMap4(self2, (a) => map4(f(a), (b) => ({
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
var SomeImpl = function(value) {
  this.value = value;
};
SomeImpl.prototype = SomeProto;
var some = (value) => new SomeImpl(value);

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
var getFailure = (self2) => isSuccess(self2) ? none : some(self2.failure);
var getSuccess = (self2) => isFailure(self2) ? none : some(self2.success);
var fromOption = /* @__PURE__ */ dual(2, (self2, onNone) => isNone(self2) ? fail(onNone()) : succeed(self2.value));

// node_modules/effect/dist/Order.js
function make2(compare) {
  return (self2, that) => self2 === that ? 0 : compare(self2, that);
}
var Number2 = /* @__PURE__ */ make2((self2, that) => {
  if (globalThis.Number.isNaN(self2) && globalThis.Number.isNaN(that)) return 0;
  if (globalThis.Number.isNaN(self2)) return -1;
  if (globalThis.Number.isNaN(that)) return 1;
  return self2 < that ? -1 : 1;
});
var mapInput = /* @__PURE__ */ dual(2, (self2, f) => make2((b1, b2) => self2(f(b1), f(b2))));
var isGreaterThan = (O) => dual(2, (self2, that) => O(self2, that) === 1);

// node_modules/effect/dist/Option.js
var none2 = () => none;
var some2 = some;
var isOption2 = isOption;
var isNone2 = isNone;
var isSome2 = isSome;
var getOrElse = /* @__PURE__ */ dual(2, (self2, onNone) => isNone2(self2) ? onNone() : self2.value);
var getOrUndefined = /* @__PURE__ */ getOrElse(constUndefined);

// node_modules/effect/dist/Context.js
var ServiceTypeId = "~effect/Context/Service";
var Service = function() {
  function KeyClass() {
  }
  const self2 = KeyClass;
  Object.setPrototypeOf(self2, ServiceProto);
  const init = (key, options) => {
    self2.key = key;
    if (options?.defaultValue) {
      self2[ReferenceTypeId] = ReferenceTypeId;
      self2.defaultValue = options.defaultValue;
    }
    if (options?.make) {
      ;
      self2.make = options.make;
    }
    if (options?.fiberCached) {
      cacheKeys.add(key);
    }
    return self2;
  };
  return arguments.length > 0 ? init(arguments[0], arguments[1]) : init;
};
var ServiceProto = {
  [ServiceTypeId]: ServiceTypeId,
  .../* @__PURE__ */ Prototype({
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
  of(self2) {
    return self2;
  },
  context(self2) {
    return make3(this, self2);
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
  const self2 = Object.create(Proto);
  self2.cacheRoot = cacheRoot ?? self2;
  self2.base = base;
  self2.overlay = overlay;
  self2.depth = depth;
  self2._flat = void 0;
  self2.baseHits = 0;
  return self2;
};
var applyOverlays = (map4, overlay) => {
  if (!overlay) return;
  applyOverlays(map4, overlay.parent);
  map4.set(overlay.key, overlay.value);
};
var flatten = (self2) => {
  if (self2._flat) return self2._flat;
  if (!self2.overlay) return self2._flat = self2.base;
  const map4 = new Map(self2.base);
  applyOverlays(map4, self2.overlay);
  return self2._flat = map4;
};
var withFlat = (self2, f) => {
  const map4 = new Map(self2.mapUnsafe);
  f(map4);
  return makeUnsafe(map4);
};
var notFound = /* @__PURE__ */ Symbol();
var lookup = (self2, key) => {
  const impl = self2;
  for (let overlay = impl.overlay; overlay; overlay = overlay.parent) {
    if (overlay.key === key) return overlay.value;
  }
  const value = impl.base.get(key);
  if (value === void 0 && !impl.base.has(key)) return notFound;
  if (impl.overlay && ++impl.baseHits >= impl.base.size && impl.baseHits >= FlattenAfterBaseHits) {
    impl.base = flatten(impl);
    impl.overlay = void 0;
    impl.depth = 0;
  }
  return value;
};
var makeUnsafe = (mapUnsafe) => makeImpl(void 0, mapUnsafe, void 0, 0);
var Proto = {
  get mapUnsafe() {
    return flatten(this);
  },
  ...PipeInspectableProto,
  [TypeId3]: {
    _Services: (_) => _
  },
  toJSON() {
    return {
      _id: "Context",
      services: Array.from(this.mapUnsafe).map(([key, value]) => ({
        key,
        value
      }))
    };
  },
  [symbol2](that) {
    if (!isContext(that)) return false;
    const self2 = this.mapUnsafe;
    const other = that.mapUnsafe;
    if (self2.size !== other.size) return false;
    for (const [key, value] of self2) {
      if (!other.has(key) || !equals(value, other.get(key))) return false;
    }
    return true;
  },
  [symbol]() {
    return number(this.mapUnsafe.size);
  }
};
var hasSameCache = (self2, that) => self2.cacheRoot === that.cacheRoot;
var isContext = (u) => hasProperty(u, TypeId3);
var isReference = (u) => !!u[ReferenceTypeId];
var empty = () => emptyContext2;
var emptyContext2 = /* @__PURE__ */ makeUnsafe(/* @__PURE__ */ new Map());
var make3 = (key, service3) => makeUnsafe(/* @__PURE__ */ new Map([[key.key, service3]]));
var add = /* @__PURE__ */ dual(3, (self2, key, service3) => addUnsafe(self2, key.key, service3));
var addUnsafe = (self2, key, service3) => {
  const impl = self2;
  const cacheRoot = cacheKeys.has(key) ? void 0 : impl.cacheRoot;
  if (impl.depth >= MaxDepth) {
    const map4 = new Map(impl._flat ?? impl.base);
    if (!impl._flat) applyOverlays(map4, impl.overlay);
    map4.set(key, service3);
    return makeImpl(cacheRoot, map4, void 0, 0);
  }
  return makeImpl(cacheRoot, impl.base, {
    key,
    value: service3,
    parent: impl.overlay
  }, impl.depth + 1);
};
var getOrUndefined2 = /* @__PURE__ */ dual(2, (self2, key) => getOrUndefinedUnsafe(self2, key.key));
var getOrUndefinedUnsafe = (self2, key) => {
  const value = lookup(self2, key);
  return value === notFound ? void 0 : value;
};
var getUnsafe = /* @__PURE__ */ dual(2, (self2, service3) => {
  const value = lookup(self2, service3.key);
  if (value === notFound) {
    if (isReference(service3)) return getDefaultValue(service3);
    throw serviceNotFoundError(service3);
  }
  return value;
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
var getOption = /* @__PURE__ */ dual(2, (self2, service3) => {
  const value = lookup(self2, service3.key);
  if (value !== notFound) return some2(value);
  return isReference(service3) ? some2(getDefaultValue(service3)) : none2();
});
var merge = /* @__PURE__ */ dual(2, (self2, that) => {
  if (self2.mapUnsafe.size === 0) return that;
  if (that.mapUnsafe.size === 0) return self2;
  return withFlat(self2, (map4) => that.mapUnsafe.forEach((value, key) => map4.set(key, value)));
});
var mergeAll = (...ctxs) => {
  const map4 = /* @__PURE__ */ new Map();
  for (let i = 0; i < ctxs.length; i++) {
    ctxs[i].mapUnsafe.forEach((value, key) => {
      map4.set(key, value);
    });
  }
  return makeUnsafe(map4);
};
var Reference = Service;

// node_modules/effect/dist/internal/array.js
var isArrayNonEmpty = (self2) => self2.length > 0;

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
  flatMap: () => flatMap,
  flip: () => flip,
  fromNullishOr: () => fromNullishOr,
  fromOption: () => fromOption2,
  gen: () => gen,
  getFailure: () => getFailure2,
  getOrElse: () => getOrElse2,
  getOrNull: () => getOrNull,
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
  map: () => map,
  mapBoth: () => mapBoth,
  mapError: () => mapError,
  match: () => match,
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
var fromNullishOr = /* @__PURE__ */ dual(2, (self2, onNullish) => self2 == null ? fail2(onNullish(self2)) : succeed2(self2));
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
var mapBoth = /* @__PURE__ */ dual(2, (self2, {
  onFailure,
  onSuccess
}) => isFailure2(self2) ? fail2(onFailure(self2.failure)) : succeed2(onSuccess(self2.success)));
var mapError = /* @__PURE__ */ dual(2, (self2, f) => isFailure2(self2) ? fail2(f(self2.failure)) : self2);
var map = /* @__PURE__ */ dual(2, (self2, f) => isSuccess2(self2) ? succeed2(f(self2.success)) : self2);
var match = /* @__PURE__ */ dual(2, (self2, {
  onFailure,
  onSuccess
}) => isFailure2(self2) ? onFailure(self2.failure) : onSuccess(self2.success));
var liftPredicate = /* @__PURE__ */ dual(3, (a, predicate, orFailWith) => predicate(a) ? succeed2(a) : fail2(orFailWith(a)));
var filterOrFail = /* @__PURE__ */ dual(3, (self2, predicate, orFailWith) => flatMap(self2, (a) => predicate(a) ? succeed2(a) : fail2(orFailWith(a))));
var merge2 = /* @__PURE__ */ match({
  onFailure: identity,
  onSuccess: identity
});
var getOrElse2 = /* @__PURE__ */ dual(2, (self2, onFailure) => isFailure2(self2) ? onFailure(self2.failure) : self2.success);
var getOrNull = /* @__PURE__ */ getOrElse2(constNull);
var getOrUndefined3 = /* @__PURE__ */ getOrElse2(constUndefined);
var getOrThrowWith = /* @__PURE__ */ dual(2, (self2, onFailure) => {
  if (isSuccess2(self2)) {
    return self2.success;
  }
  throw onFailure(self2.failure);
});
var getOrThrow = /* @__PURE__ */ getOrThrowWith(identity);
var orElse = /* @__PURE__ */ dual(2, (self2, that) => isFailure2(self2) ? that(self2.failure) : succeed2(self2.success));
var flatMap = /* @__PURE__ */ dual(2, (self2, f) => isFailure2(self2) ? fail2(self2.failure) : f(self2.success));
var andThen = /* @__PURE__ */ dual(2, (self2, f) => flatMap(self2, (a) => {
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
var flip = (self2) => isFailure2(self2) ? succeed2(self2.failure) : fail2(self2.success);
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
var bind2 = /* @__PURE__ */ bind(map, flatMap);
var bindTo2 = /* @__PURE__ */ bindTo(map);
var let_2 = /* @__PURE__ */ let_(map);
var transposeOption = (self2) => {
  return isNone(self2) ? succeedNone : map(self2.value, some);
};
var transposeMapOption = /* @__PURE__ */ dual(2, (self2, f) => isNone(self2) ? succeedNone : map(f(self2.value), some));
var succeedNone = /* @__PURE__ */ succeed2(none);
var succeedSome = (a) => succeed2(some(a));
var tap = /* @__PURE__ */ dual(2, (self2, f) => {
  if (isSuccess2(self2)) {
    f(self2.success);
  }
  return self2;
});

// node_modules/effect/dist/Iterable.js
var filter = /* @__PURE__ */ dual(2, (self2, predicate) => ({
  [Symbol.iterator]() {
    const iterator = self2[Symbol.iterator]();
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

// node_modules/effect/dist/Array.js
var Array2 = globalThis.Array;
var fromIterable = (collection) => Array2.isArray(collection) ? collection : Array2.from(collection);
var isArray = Array2.isArray;
var isArrayNonEmpty2 = isArrayNonEmpty;
var empty2 = () => [];
var getSomes = (self2) => {
  const out = [];
  for (const a of self2) {
    if (isSome2(a)) {
      out.push(a.value);
    }
  }
  return out;
};
var partition = /* @__PURE__ */ dual(2, (self2, f) => {
  const passes = [];
  const fails = [];
  let i = 0;
  for (const a of self2) {
    const result3 = f(a, i++);
    if (isSuccess2(result3)) {
      passes.push(result3.success);
    } else {
      fails.push(result3.failure);
    }
  }
  return [passes, fails];
});

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
  const value = Number(nanos2);
  if (Number.isFinite(value)) return value / divisor;
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
      const match5 = DURATION_REGEXP.exec(input);
      if (!match5) break;
      const [_, valueStr, unit] = match5;
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
var isZero = (self2) => {
  switch (self2.value._tag) {
    case "Millis":
      return self2.value.millis === 0;
    case "Nanos":
      return self2.value.nanos === bigint0;
    case "Infinity":
    case "NegativeInfinity":
      return false;
  }
};
var isNegative = (self2) => {
  switch (self2.value._tag) {
    case "Millis":
      return self2.value.millis < 0;
    case "Nanos":
      return self2.value.nanos < bigint0;
    case "NegativeInfinity":
      return true;
    case "Infinity":
      return false;
  }
};
var abs = (self2) => {
  switch (self2.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      return infinity;
    case "Millis":
      return self2.value.millis < 0 ? make4(-self2.value.millis) : self2;
    case "Nanos":
      return self2.value.nanos < bigint0 ? make4(-self2.value.nanos) : self2;
  }
};
var zero = /* @__PURE__ */ make4(0);
var infinity = /* @__PURE__ */ make4(Infinity);
var negativeInfinity = /* @__PURE__ */ make4(-Infinity);
var nanos = (nanos2) => make4(nanos2);
var millis = (millis2) => make4(millis2);
var toMillis = (self2) => match2(fromInputUnsafe(self2), {
  onMillis: identity,
  onNanos: (nanos2) => nanosToUnit(nanos2, 1e6),
  onInfinity: () => Infinity,
  onNegativeInfinity: () => -Infinity
});
var toNanosUnsafe = (input) => {
  const self2 = fromInputUnsafe(input);
  switch (self2.value._tag) {
    case "Infinity":
    case "NegativeInfinity":
      throw new Error("Cannot convert infinite duration to nanos");
    case "Nanos":
      return self2.value.nanos;
    case "Millis":
      return roundMillisToNanos(self2.value.millis);
  }
};
var match2 = /* @__PURE__ */ dual(2, (self2, options) => {
  switch (self2.value._tag) {
    case "Millis":
      return options.onMillis(self2.value.millis);
    case "Nanos":
      return options.onNanos(self2.value.nanos);
    case "Infinity":
      return options.onInfinity();
    case "NegativeInfinity":
      return (options.onNegativeInfinity ?? options.onInfinity)();
  }
});
var matchPair = /* @__PURE__ */ dual(3, (self2, that, options) => {
  if (self2.value._tag === "Infinity" || self2.value._tag === "NegativeInfinity" || that.value._tag === "Infinity" || that.value._tag === "NegativeInfinity") return options.onInfinity(self2, that);
  if (self2.value._tag === "Millis") {
    return that.value._tag === "Millis" ? options.onMillis(self2.value.millis, that.value.millis) : options.onNanos(toNanosUnsafe(self2), that.value.nanos);
  } else {
    return options.onNanos(self2.value.nanos, toNanosUnsafe(that));
  }
});
var Equivalence = (self2, that) => matchPair(self2, that, {
  onMillis: (self3, that2) => self3 === that2,
  onNanos: (self3, that2) => self3 === that2,
  onInfinity: (self3, that2) => self3.value._tag === that2.value._tag
});
var subtract = /* @__PURE__ */ dual(2, (self2, that) => matchPair(self2, that, {
  onMillis: (self3, that2) => make4(self3 - that2),
  onNanos: (self3, that2) => make4(self3 - that2),
  onInfinity: (self3, that2) => {
    const s = self3.value._tag;
    const t = that2.value._tag;
    if (s === "Infinity") return t === "Infinity" ? zero : infinity;
    if (s === "NegativeInfinity") return t === "NegativeInfinity" ? zero : negativeInfinity;
    return t === "Infinity" ? negativeInfinity : infinity;
  }
}));
var equals2 = /* @__PURE__ */ dual(2, (self2, that) => Equivalence(self2, that));
var parts = (self2) => {
  if (self2.value._tag === "Infinity") {
    return {
      days: Infinity,
      hours: Infinity,
      minutes: Infinity,
      seconds: Infinity,
      millis: Infinity,
      nanos: Infinity
    };
  }
  if (self2.value._tag === "NegativeInfinity") {
    return {
      days: -Infinity,
      hours: -Infinity,
      minutes: -Infinity,
      seconds: -Infinity,
      millis: -Infinity,
      nanos: -Infinity
    };
  }
  const n = toNanosUnsafe(self2);
  const neg = n < bigint0;
  const a = neg ? -n : n;
  const ms = a / bigint1e6;
  const sec = ms / bigint1e3;
  const min2 = sec / bigint60;
  const hr = min2 / bigint60;
  const d = hr / bigint24;
  const sign = neg ? -1 : 1;
  return {
    days: sign * Number(d),
    hours: sign * Number(hr % bigint24),
    minutes: sign * Number(min2 % bigint60),
    seconds: sign * Number(sec % bigint60),
    millis: sign * Number(ms % bigint1e3),
    nanos: sign * Number(a % bigint1e6)
  };
};
var format2 = (self2) => {
  if (self2.value._tag === "Infinity") {
    return "Infinity";
  }
  if (self2.value._tag === "NegativeInfinity") {
    return "-Infinity";
  }
  if (isZero(self2)) {
    return "0";
  }
  if (isNegative(self2)) {
    return "-" + format2(abs(self2));
  }
  const fragments = parts(self2);
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
    let index = 0;
    for (; index < len; index++) {
      if (buckets[index][0] > priority) break;
      bucket = buckets[index];
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task);
    } else if (index === len) {
      buckets.push([priority, [task]]);
    } else {
      buckets.splice(index, 0, [priority, [task]]);
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

// node_modules/effect/dist/encoding/Hex.js
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
  attribute(key, value) {
    this.attributes.set(key, value);
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
  let cache;
  return () => {
    if (cache !== void 0) return cache;
    const trace = stack();
    if (!trace) return void 0;
    const lines = trace.split("\n");
    if (lines[line] !== void 0) {
      cache = lines[line].trim();
      return cache;
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
var causeInterrupt = (fiberId3) => new CauseImpl([new Interrupt(fiberId3)]);
var hasFails = (self2) => self2.reasons.some(isFailReason);
var findError = (self2) => {
  for (let i = 0; i < self2.reasons.length; i++) {
    const reason = self2.reasons[i];
    if (reason._tag === "Fail") {
      return succeed2(reason.error);
    }
  }
  return fail2(self2);
};
var hasDies = (self2) => self2.reasons.some(isDieReason);
var causeElectDefects = (self2) => hasDies(self2) && hasFails(self2) ? causeFromReasons(self2.reasons.map((reason) => reason._tag === "Fail" && !isDone(reason.error) ? new Die(reason.error, reason.annotations) : reason)) : self2;
var findRecoverableError = (self2) => hasDies(self2) ? fail2(causeElectDefects(self2)) : findError(self2);
var findDefect = (self2) => {
  const reason = self2.reasons.find(isDieReason);
  return reason ? succeed2(reason.defect) : fail2(self2);
};
var hasInterrupts = (self2) => self2.reasons.some(isInterruptReason);
var causeFilterInterruptors = (self2) => {
  let interruptors;
  for (let i = 0; i < self2.reasons.length; i++) {
    const f = self2.reasons[i];
    if (f._tag !== "Interrupt") continue;
    interruptors ??= /* @__PURE__ */ new Set();
    if (f.fiberId !== void 0) {
      interruptors.add(f.fiberId);
    }
  }
  return interruptors ? succeed2(interruptors) : fail2(self2);
};
var hasInterruptsOnly = (self2) => self2.reasons.length > 0 && self2.reasons.every(isInterruptReason);
var causeMap = /* @__PURE__ */ dual(2, (self2, f) => {
  let hasFail = false;
  const failures = self2.reasons.map((failure) => {
    if (isFailReason(failure)) {
      hasFail = true;
      return new Fail(f(failure.error), failure.annotations);
    }
    return failure;
  });
  return hasFail ? causeFromReasons(failures) : self2;
});
var causeSquash = (self2) => {
  let die3;
  for (const reason of self2.reasons) {
    if (reason._tag === "Fail") return reason.error;
    if (reason._tag === "Die") die3 ??= reason;
  }
  if (die3 !== void 0) return die3.defect;
  if (self2.reasons.length > 0) return new globalThis.Error("All fibers interrupted without error");
  return new globalThis.Error("Empty cause");
};
var causePrettyErrors = (self2, options) => {
  const errors = [];
  const interrupts = [];
  if (self2.reasons.length === 0) return errors;
  const prevStackLimit = getStackTraceLimit();
  if (prevStackLimit !== 0) setStackTraceLimit(1);
  try {
    for (const failure of self2.reasons) {
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
  const frame = annotations?.get(StackTraceKey.key);
  if (frame) {
    stack = `${stack}
${currentStackTrace(frame)}`;
  }
  return stack;
};
var interruptCauseStack = (error, interrupts) => {
  const out = [`${error.name}: ${error.message}`];
  for (const current of interrupts) {
    const fiberId3 = current.fiberId !== void 0 ? `#${current.fiberId}` : "unknown";
    const frame = current.annotations.get(InterruptorStackTrace.key);
    out.push(`    at fiber (${fiberId3})`);
    if (frame) out.push(currentStackTrace(frame));
  }
  return out.join("\n");
};
var currentStackTrace = (frame) => {
  const out = [];
  let current = frame;
  let i = 0;
  while (current && i < 10) {
    const stack = current.stack();
    if (stack) {
      const locationMatchAll = stack.matchAll(locationRegExp);
      let match5 = false;
      for (const [, location] of locationMatchAll) {
        match5 = true;
        out.push(`    at ${current.name} (${location})`);
      }
      if (!match5) {
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
    const index = this._observers.indexOf(cb);
    if (index >= 0) {
      this._observers.splice(index, 1);
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
      return this.evaluate(flatMap2(interruptChildren, () => exit3));
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
          const cache = this.cache;
          if (!yielding && !cache.preventYield && cache.scheduler.shouldYield(this)) {
            yielding = true;
            const prev = current;
            current = flatMap2(yieldNow, () => prev);
          }
          current = cache.tracerContext ? cache.tracerContext(current, this) : current[evaluate](this);
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
  getCont(symbol3) {
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
          cont[symbol3] = cont;
          return cont;
        }
      }
      if (op[symbol3]) return op;
    }
  }
  // Passes a success value straight to the next continuation instead of
  // returning an Exit for the run loop to unwrap. Each call counts as an
  // operation, and every `maxInlineSteps`th call returns an Exit instead, so
  // continuations calling continuations never nest deeper than that.
  succeedWith(value) {
    if ((++this.currentOpCount & maxInlineSteps - 1) === 0) {
      return exitSucceed(value);
    }
    const cont = this.getCont(contA);
    return cont ? cont[contA](value, this) : this.yieldWith(exitSucceed(value));
  }
  yieldWith(value) {
    this._yielded = value;
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
    const cache = root._fiberCache ??= makeFiberContextCache(context3);
    if (this.cache?.scheduler !== cache.scheduler) {
      this._dispatcher = void 0;
    }
    this.cache = cache;
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
var fiberAwait = (self2) => {
  const impl = self2;
  if (impl._exit) return succeed3(impl._exit);
  return callback((resume) => {
    if (impl._exit) return resume(succeed3(impl._exit));
    return sync(self2.addObserver((exit3) => resume(succeed3(exit3))));
  });
};
var fiberAwaitAll = (self2) => callback((resume) => {
  const iter = self2[Symbol.iterator]();
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
var fiberJoin = (self2) => {
  const impl = self2;
  if (impl._exit) return impl._exit;
  return callback((resume) => {
    if (impl._exit) return resume(impl._exit);
    return sync(self2.addObserver(resume));
  });
};
var fiberInterrupt = (self2) => withFiber((fiber3) => fiberInterruptAs(self2, fiber3.id));
var fiberInterruptAs = /* @__PURE__ */ dual((args2) => hasProperty(args2[0], FiberTypeId), (self2, fiberId3, annotations) => withFiber((parent) => {
  let ann = fiberStackAnnotations(parent);
  ann = ann && annotations ? merge(ann, annotations) : ann ?? annotations;
  self2.interruptUnsafe(fiberId3, ann);
  return asVoid(fiberAwait(self2));
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
    const value = this[args]();
    const cont = fiber3.getCont(contA);
    return cont ? cont[contA](value, fiber3) : fiber3.yieldWith(exitSucceed(value));
  }
});
var suspend = /* @__PURE__ */ makePrimitive({
  op: "Suspend",
  [evaluate](_fiber) {
    return this[args]();
  }
});
var fromOption3 = /* @__PURE__ */ dual((args2) => args2.length >= 2 || isOption2(args2[0]), (option3, onNone) => isNone2(option3) ? onNone ? failSync(onNone) : fail3(new NoSuchElementError("Effect.fromOption: Option.none")) : succeed3(option3.value));
var fromResult = /* @__PURE__ */ match({
  onFailure: fail3,
  onSuccess: succeed3
});
var fromNullishOr2 = (value) => value == null ? fail3(new NoSuchElementError()) : succeed3(value);
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
var transposeOption2 = (self2) => isNone2(self2) ? succeedNone2 : map2(self2.value, some2);
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
  const Proto3 = /* @__PURE__ */ makePrimitiveProto({
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
  AsyncImpl.prototype = Proto3;
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
    return hasInterrupts(cause) ? flatMap2(combineFinalizerCause(exitFailCause(cause), this[args]()), () => failCause(cause)) : failCause(cause);
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
    let value = void 0;
    while (true) {
      const state = iterator.next(value);
      if (state.done) {
        return succeed3(state.value);
      }
      const primitive = state.value;
      if (primitive && primitive._tag === "Success") {
        value = primitive.value;
        continue;
      } else if (primitive && primitive._tag === "Failure") {
        return state.value;
      } else {
        let isFirstExecution = true;
        return suspend(() => {
          if (isFirstExecution) {
            isFirstExecution = false;
            return flatMap2(state.value, (value2) => fromIteratorUnsafe(iterator, value2));
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
  const Proto3 = /* @__PURE__ */ makePrimitiveProto({
    op: "Iterator",
    [contA](value, fiber3) {
      const iter = this.iterator;
      while (true) {
        const state = iter.next(value);
        if (state.done) return succeed3(state.value);
        if (!effectIsExit(state.value)) {
          fiber3._stack.push(this);
          return state.value;
        } else if (state.value._tag === "Failure") {
          return state.value;
        }
        value = state.value.value;
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
  IteratorImpl.prototype = Proto3;
  return function(iterator, initial) {
    return new IteratorImpl(iterator, initial);
  };
})();
var as = /* @__PURE__ */ dual(2, (self2, value) => new ContImpl(self2, returnPayload, succeed3(value)));
var evaluateCont = function(fiber3) {
  fiber3._stack.push(this);
  return this[args];
};
var OnSuccessProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccess",
  [evaluate]: evaluateCont
});
var ContImpl = function(self2, cont, payload) {
  this[args] = self2;
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
var mapCont = function(value, fiber3) {
  const f = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? f(value) : internalCall(() => f(value)));
};
var andThenCont = function(value) {
  const f = this.payload;
  return f(value);
};
var tapCont = function(value) {
  const f = this.payload;
  return new ContImpl(f(value), succeedPayload, value);
};
var tapEffectCont = function(value) {
  return new ContImpl(this.payload, succeedPayload, value);
};
var asSome = (self2) => map2(self2, some2);
var flip2 = (self2) => matchEffect(self2, {
  onFailure: succeed3,
  onSuccess: fail3
});
var andThen2 = /* @__PURE__ */ dual(2, (self2, f) => new ContImpl(self2, isEffect(f) ? returnPayload : andThenCont, f));
var tap2 = /* @__PURE__ */ dual(2, (self2, f) => new ContImpl(self2, isEffect(f) ? tapEffectCont : tapCont, f));
var asVoid = (self2) => new ContImpl(self2, returnPayload, exitVoid);
var sandbox = (self2) => catchCause(self2, fail3);
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
      const index = i++;
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
            index,
            parentFiber: parent
          });
        }
      });
    }
  });
});
var race = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self2, that, options) => raceAll([self2, that], options));
var raceFirst = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self2, that, options) => raceAllFirst([self2, that], options));
var flatMap2 = /* @__PURE__ */ dual(2, (self2, f) => new ContImpl(self2, andThenCont, f));
var matchCauseEffectEager = /* @__PURE__ */ dual(2, (self2, options) => {
  if (effectIsExit(self2)) {
    return self2._tag === "Success" ? options.onSuccess(self2.value) : options.onFailure(self2.cause);
  }
  return matchCauseEffect(self2, options);
});
var effectIsExit = (effect) => effect[ExitTypeId] !== void 0;
var flatMapEager = /* @__PURE__ */ dual(2, (self2, f) => {
  if (effectIsExit(self2)) {
    return self2._tag === "Success" ? f(self2.value) : self2;
  }
  return flatMap2(self2, f);
});
var flatten2 = (self2) => flatMap2(self2, identity);
var map2 = /* @__PURE__ */ dual(2, (self2, f) => new ContImpl(self2, mapCont, f));
var mapEager = /* @__PURE__ */ dual(2, (self2, f) => effectIsExit(self2) ? exitMap(self2, f) : map2(self2, f));
var mapErrorEager = /* @__PURE__ */ dual(2, (self2, f) => effectIsExit(self2) ? exitMapError(self2, f) : mapError2(self2, f));
var mapBothEager = /* @__PURE__ */ dual(2, (self2, options) => effectIsExit(self2) ? exitMapBoth(self2, options) : mapBoth2(self2, options));
var catchEager = /* @__PURE__ */ dual(2, (self2, f) => {
  if (effectIsExit(self2)) {
    if (self2._tag === "Success") return self2;
    const error = findRecoverableError(self2.cause);
    if (isFailure2(error)) return exitFailCause(error.failure);
    return f(error.success);
  }
  return catch_(self2, f);
});
var exitInterrupt = (fiberId3) => exitFailCause(causeInterrupt(fiberId3));
var exitIsSuccess = (self2) => self2._tag === "Success";
var exitFilterCause = (self2) => self2._tag === "Failure" ? succeed2(self2.cause) : fail2(self2);
var exitHasInterrupts = (self2) => self2._tag === "Failure" && hasInterrupts(self2.cause);
var exitVoid = /* @__PURE__ */ exitSucceed(void 0);
var exitMap = /* @__PURE__ */ dual(2, (self2, f) => self2._tag === "Success" ? exitSucceed(f(self2.value)) : self2);
var exitMapError = /* @__PURE__ */ dual(2, (self2, f) => {
  if (self2._tag === "Success") return self2;
  return exitFailCause(causeMap(self2.cause, f));
});
var exitMapBoth = /* @__PURE__ */ dual(2, (self2, options) => {
  if (self2._tag === "Success") return exitSucceed(options.onSuccess(self2.value));
  return exitFailCause(causeMap(self2.cause, options.onFailure));
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
var updateContext = /* @__PURE__ */ dual(2, (self2, f) => withFiber((fiber3) => {
  const prevContext = fiber3.context;
  const nextContext = f(prevContext);
  if (prevContext === nextContext) return self2;
  fiber3.setContext(nextContext);
  onExitUnsafe(fiber3, () => {
    fiber3.setContext(prevContext);
    return void 0;
  });
  return self2;
}));
var updateService = /* @__PURE__ */ dual(3, (self2, service3, f) => updateContext(self2, (s) => {
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
var setContext = /* @__PURE__ */ dual(2, (self2, context3) => updateContext(self2, constant(context3)));
var provideContext = /* @__PURE__ */ dual(2, (self2, context3) => {
  if (effectIsExit(self2)) return self2;
  return updateContext(self2, merge(context3));
});
var provideService = function() {
  if (arguments.length === 1) {
    return dual(2, (self2, impl) => provideServiceImpl(self2, arguments[0], impl));
  }
  return dual(3, (self2, service3, impl) => provideServiceImpl(self2, service3, impl)).apply(this, arguments);
};
var provideServiceImpl = (self2, service3, implementation) => updateContext(self2, add(service3, implementation));
var provideServiceEffect = /* @__PURE__ */ dual(3, (self2, service3, acquire) => flatMap2(acquire, (implementation) => provideService(self2, service3, implementation)));
var zip = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self2, that, options) => zipWith(self2, that, (a, a2) => [a, a2], options));
var zipWith = /* @__PURE__ */ dual((args2) => isEffect(args2[1]), (self2, that, f, options) => options?.concurrent ? map2(all2([self2, that], {
  concurrency: 2
}), ([a, a2]) => f(a, a2)) : flatMap2(self2, (a) => map2(that, (a2) => f(a, a2))));
var filterOrFail2 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, predicate, orFailWith) => filterOrElse(self2, predicate, orFailWith ? (a) => fail3(orFailWith(a)) : () => fail3(new NoSuchElementError())));
var when = /* @__PURE__ */ dual(2, (self2, condition) => flatMap2(condition, (pass) => pass ? asSome(self2) : succeedNone2));
var replicate = /* @__PURE__ */ dual(2, (self2, n) => Array.from({
  length: n
}, () => self2));
var replicateEffect = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, n, options) => all2(replicate(self2, n), options));
var forever = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => whileLoop({
  while: constTrue,
  body: constant(options?.disableYield ? self2 : flatMap2(self2, (_) => yieldNow)),
  step: constVoid
}));
var catchCause = /* @__PURE__ */ dual(2, (self2, f) => new OnFailureImpl(self2, f.length !== 1 ? (cause) => f(cause) : f));
var OnFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnFailure",
  [evaluate]: evaluateCont
});
var OnFailureImpl = function(self2, f) {
  this[args] = self2;
  this[contE] = f;
};
OnFailureImpl.prototype = OnFailureProto;
var catchCauseIf = /* @__PURE__ */ dual(3, (self2, predicate, f) => catchCause(self2, (cause) => {
  if (!predicate(cause)) {
    return failCause(cause);
  }
  return f(cause);
}));
var catchCauseFilter = /* @__PURE__ */ dual(3, (self2, filter4, f) => catchCause(self2, (cause) => {
  const eb = filter4(cause);
  return isFailure2(eb) ? failCause(eb.failure) : f(eb.success, cause);
}));
var catch_ = /* @__PURE__ */ dual(2, (self2, f) => catchCauseFilter(self2, findRecoverableError, (e) => f(e)));
var catchNoSuchElement = (self2) => matchEffect(self2, {
  onFailure: (error) => isNoSuchElementError(error) ? succeedNone2 : fail3(error),
  onSuccess: succeedSome2
});
var catchDefect = /* @__PURE__ */ dual(2, (self2, f) => catchCauseFilter(self2, findDefect, f));
var tapCause = /* @__PURE__ */ dual(2, (self2, f) => catchCause(self2, (cause) => andThen2(f(cause), failCause(cause))));
var tapCauseIf = /* @__PURE__ */ dual(3, (self2, predicate, f) => catchCauseIf(self2, predicate, (cause) => andThen2(f(cause), failCause(cause))));
var tapCauseFilter = /* @__PURE__ */ dual(3, (self2, filter4, f) => catchCause(self2, (cause) => {
  const result3 = filter4(cause);
  if (isFailure2(result3)) {
    return failCause(cause);
  }
  return andThen2(f(result3.success, cause), failCause(cause));
}));
var tapError = /* @__PURE__ */ dual(2, (self2, f) => tapCauseFilter(self2, findError, (e) => f(e)));
var tapErrorTag = /* @__PURE__ */ dual(3, (self2, k, f) => {
  const predicate = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return tapError(self2, (error) => predicate(error) ? f(error) : void_2);
});
var tapDefect = /* @__PURE__ */ dual(2, (self2, f) => tapCauseFilter(self2, findDefect, (_) => f(_)));
var catchIf = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, predicate, f, orElse2) => catchCause(self2, (cause) => {
  const error = findRecoverableError(cause);
  if (isFailure2(error)) return failCause(error.failure);
  if (!predicate(error.success)) {
    return orElse2 ? orElse2(error.success) : failCause(cause);
  }
  return f(error.success);
}));
var catchFilter = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, filter4, f, orElse2) => catchCause(self2, (cause) => {
  const error = findRecoverableError(cause);
  if (isFailure2(error)) return failCause(error.failure);
  const result3 = filter4(error.success);
  if (isFailure2(result3)) {
    return orElse2 ? orElse2(result3.failure) : failCause(cause);
  }
  return f(result3.success);
}));
var catchTag = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, k, f, orElse2) => {
  const pred = Array.isArray(k) ? (e) => hasProperty(e, "_tag") && k.includes(e._tag) : isTagged(k);
  return catchIf(self2, pred, f, orElse2);
});
var catchTags = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, cases, orElse2) => {
  let keys;
  return catchFilter(self2, (e) => {
    keys ??= Object.keys(cases);
    return hasProperty(e, "_tag") && isString(e["_tag"]) && keys.includes(e["_tag"]) ? succeed2(e) : fail2(e);
  }, (e) => cases[e["_tag"]](e), orElse2);
});
var catchReason = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, errorTag, reasonTag, f, orElse2) => catchIf(self2, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && (orElse2 !== void 0 || isTagged(e.reason, reasonTag)), (e) => {
  const reason = e.reason;
  if (isTagged(reason, reasonTag)) return f(reason, e);
  return orElse2 ? orElse2(reason, e) : fail3(e);
}));
var catchReasons = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, errorTag, cases, orElse2) => {
  let keys;
  return catchIf(self2, (e) => isTagged(e, errorTag) && hasProperty(e, "reason") && hasProperty(e.reason, "_tag") && isString(e.reason._tag) && (orElse2 !== void 0 || (keys ??= Object.keys(cases)).includes(e.reason._tag)), (e) => {
    const reason = e.reason;
    keys ??= Object.keys(cases);
    if (keys.includes(reason._tag)) {
      return cases[reason._tag](reason, e);
    }
    return orElse2 ? orElse2(reason, e) : fail3(e);
  });
});
var unwrapReason = /* @__PURE__ */ dual(2, (self2, errorTag) => catchFilter(self2, (e) => {
  if (isTagged(e, errorTag) && hasProperty(e, "reason")) {
    return succeed2(e.reason);
  }
  return fail2(e);
}, fail3));
var mapError2 = /* @__PURE__ */ dual(2, (self2, f) => catchCause(self2, (cause) => failCause(causeMap(cause, f))));
var mapBoth2 = /* @__PURE__ */ dual(2, (self2, options) => matchCauseEffect(self2, {
  onFailure: (cause) => failCause(causeMap(cause, options.onFailure)),
  onSuccess: (a) => sync(() => options.onSuccess(a))
}));
var orDie = (self2) => catch_(self2, die);
var orElseSucceed = /* @__PURE__ */ dual(2, (self2, f) => catch_(self2, (error) => sync(() => f(error))));
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
var eventually = (self2) => catch_(self2, (_) => flatMap2(yieldNow, () => eventually(self2)));
var ignore = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => {
  if (!options?.log) {
    return matchEffect(self2, {
      onFailure: (_) => void_2,
      onSuccess: (_) => void_2
    });
  }
  const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
  return matchCauseEffect(self2, {
    onFailure(cause) {
      const error = findRecoverableError(cause);
      return isFailure2(error) ? failCause(error.failure) : options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause);
    },
    onSuccess: (_) => void_2
  });
});
var ignoreCause = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => {
  if (!options?.log) {
    return matchCauseEffect(self2, {
      onFailure: (_) => void_2,
      onSuccess: (_) => void_2
    });
  }
  const logEffect = logWithLevel(options.log === true ? void 0 : options.log);
  return matchCauseEffect(self2, {
    onFailure: (cause) => options.message === void 0 ? logEffect(cause) : logEffect(options.message, cause),
    onSuccess: (_) => void_2
  });
});
var option = (self2) => match3(self2, {
  onFailure: none2,
  onSuccess: some2
});
var result = (self2) => matchEager(self2, {
  onFailure: fail2,
  onSuccess: succeed2
});
var matchCauseEffect = /* @__PURE__ */ dual(2, (self2, options) => new OnSuccessAndFailureImpl(self2, options.onSuccess.length !== 1 ? (a) => options.onSuccess(a) : options.onSuccess, options.onFailure.length !== 1 ? (cause) => options.onFailure(cause) : options.onFailure));
var OnSuccessAndFailureProto = /* @__PURE__ */ makePrimitiveProto({
  op: "OnSuccessAndFailure",
  [evaluate]: evaluateCont
});
var OnSuccessAndFailureImpl = function(self2, onSuccess, onFailure) {
  this[args] = self2;
  this[contA] = onSuccess;
  this[contE] = onFailure;
};
OnSuccessAndFailureImpl.prototype = OnSuccessAndFailureProto;
var matchSuccess = function(value, fiber3) {
  const handlers = this.payload;
  return fiber3.succeedWith(continuationMarksStack ? handlers.onSuccess(value) : internalCall(() => handlers.onSuccess(value)));
};
var makeMatch = (op, onFailure) => {
  const Proto3 = makePrimitiveProto({
    op,
    [evaluate]: evaluateCont,
    [contA]: matchSuccess,
    [contE]: onFailure
  });
  const MatchImpl2 = function(self2, handlers) {
    this[args] = self2;
    this.payload = handlers;
  };
  MatchImpl2.prototype = Proto3;
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
var matchCause = /* @__PURE__ */ dual(2, (self2, options) => new MatchCauseImpl(self2, options));
var matchEffect = /* @__PURE__ */ dual(2, (self2, options) => matchCauseEffect(self2, {
  onFailure: (cause) => {
    const error = findRecoverableError(cause);
    return isFailure2(error) ? failCause(error.failure) : options.onFailure(error.success);
  },
  onSuccess: options.onSuccess
}));
var match3 = /* @__PURE__ */ dual(2, (self2, options) => new MatchImpl(self2, options));
var matchEager = /* @__PURE__ */ dual(2, (self2, options) => {
  if (effectIsExit(self2)) {
    if (self2._tag === "Success") return exitSucceed(options.onSuccess(self2.value));
    const error = findRecoverableError(self2.cause);
    if (isFailure2(error)) return exitFailCause(error.failure);
    return exitSucceed(options.onFailure(error.success));
  }
  return match3(self2, options);
});
var matchCauseEager = /* @__PURE__ */ dual(2, (self2, options) => {
  if (effectIsExit(self2)) {
    if (self2._tag === "Success") return exitSucceed(options.onSuccess(self2.value));
    return exitSucceed(options.onFailure(self2.cause));
  }
  return matchCause(self2, options);
});
var exit = (self2) => effectIsExit(self2) ? exitSucceed(self2) : exitPrimitive(self2);
var exitPrimitive = /* @__PURE__ */ makePrimitive({
  op: "Exit",
  [evaluate](fiber3) {
    fiber3._stack.push(this);
    return this[args];
  },
  [contA](value, fiber3, exit3) {
    return fiber3.succeedWith(exit3 ?? exitSucceed(value));
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
var delay = /* @__PURE__ */ dual(2, (self2, duration) => andThen2(sleep(duration), self2));
var timeoutOrElse = /* @__PURE__ */ dual(2, (self2, options) => flatMap2(timeoutOption(self2, options.duration), (option3) => isNone2(option3) ? options.orElse() : succeed3(option3.value)));
var timeoutErrorFromDuration = (duration) => new TimeoutError(`Operation timed out after '${format2(duration)}'`);
var timeout = /* @__PURE__ */ dual(2, (self2, duration) => {
  const decoded = fromInputUnsafe(duration);
  return timeoutOrElse(self2, {
    duration: decoded,
    orElse: () => fail3(timeoutErrorFromDuration(decoded))
  });
});
var timeoutOption = /* @__PURE__ */ dual(2, (self2, duration) => raceFirst(asSome(self2), as(sleep(duration), none2())));
var timed = (self2) => clockWith((clock) => {
  const start = clock.monotonicTimeNanosUnsafe();
  return map2(self2, (a) => [nanos(clock.monotonicTimeNanosUnsafe() - start), a]);
});
var ScopeTypeId = "~effect/Scope";
var ScopeCloseableTypeId = "~effect/Scope/Closeable";
var scopeTag = /* @__PURE__ */ Service("effect/Scope");
var scopeClose = (self2, exit_) => withFiber((fiber3) => {
  fiberEnterUninterruptibleUnsafe(fiber3);
  return scopeCloseUnsafe(self2, exit_) ?? void_2;
});
var scopeCloseUnsafe = (self2, exit_) => {
  const state = self2.state;
  if (state._tag === "Closed") return;
  self2.state = {
    _tag: "Closed",
    exit: exit_
  };
  if (self2.parent !== void 0) {
    scopeRemoveFinalizerUnsafe(self2.parent, self2);
  }
  if (state._tag === "Empty") return;
  if (state.finalizer !== void 0) {
    return runFinalizer(state.finalizer, exit_);
  }
  const finalizers = state.finalizers;
  if (finalizers.size === 1) {
    return runFinalizer(finalizers.values().next().value, exit_);
  }
  return scopeCloseFinalizers(self2, finalizers, exit_);
};
var runFinalizer = (finalizer, exit_) => {
  try {
    return finalizer(exit_);
  } catch (defect) {
    return exitDie(defect);
  }
};
var combineFinalizerCause = (exit_, finalizer) => exitIsSuccess(exit_) ? finalizer : catchCause(finalizer, (cause) => failCause(causeElectDefects(causeCombine(exit_.cause, cause))));
var scopeCloseFinalizers = /* @__PURE__ */ fnUntraced(function* (self2, finalizers, exit_) {
  let exits = [];
  const fibers = [];
  const arr = Array.from(finalizers);
  const parent = getCurrentFiber();
  for (let i = arr.length - 1; i >= 0; i--) {
    const [key, finalizer] = arr[i];
    if (self2.strategy === "sequential") {
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
var scoped = (self2) => withFiber((fiber3) => {
  const prev = fiber3.context;
  const scope3 = scopeMakeUnsafe();
  fiber3.setContext(add(fiber3.context, scopeTag, scope3));
  onExitUnsafe(fiber3, (exit3) => {
    fiber3.setContext(prev);
    return scopeCloseUnsafe(scope3, exit3);
  });
  return self2;
});
var scopedWith = (f) => suspend(() => {
  const scope3 = scopeMakeUnsafe();
  return onExit(f(scope3), (exit3) => suspend(() => scopeCloseUnsafe(scope3, exit3) ?? void_2));
});
var acquireRelease = (acquire, release, options) => contextWith((context3) => uninterruptibleMask((restore) => flatMap2(scope, (scope3) => tap2(options?.interruptible ? restore(acquire) : acquire, (a) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(release(a, exit3), context3))))));
var addFinalizer = (finalizer) => flatMap2(scope, (scope3) => contextWith((context3) => scopeAddFinalizerExit(scope3, (exit3) => provideContext(finalizer(exit3), context3))));
var OnExitImpl = /* @__PURE__ */ (function() {
  const Proto3 = /* @__PURE__ */ makePrimitiveProto({
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
    [contA](value, _, exit3) {
      exit3 ??= exitSucceed(value);
      let eff;
      try {
        eff = this.onExit(exit3);
      } catch (defect) {
        eff = exitDie(defect);
      }
      return eff ? flatMap2(eff, (_2) => exit3) : exit3;
    },
    [contE](cause, _, exit3) {
      exit3 ??= exitFailCause(cause);
      let eff;
      try {
        eff = this.onExit(exit3);
      } catch (defect) {
        eff = exitDie(defect);
      }
      return eff ? flatMap2(combineFinalizerCause(exit3, eff), (_2) => exit3) : exit3;
    }
  });
  const OnExitImpl2 = function(effect, onExit3, interruptible3) {
    this.effect = effect;
    this.onExit = onExit3;
    this.interruptible = interruptible3;
  };
  OnExitImpl2.prototype = Proto3;
  return OnExitImpl2;
})();
var onExitPrimitive = (effect, onExit3, interruptible3) => new OnExitImpl(effect, onExit3, interruptible3);
var onExitUnsafe = (fiber3, f) => {
  ;
  fiber3._stack.push(new OnExitImpl(void 0, f, void 0));
};
var onExit = /* @__PURE__ */ dual(2, onExitPrimitive);
var ensuring = /* @__PURE__ */ dual(2, (self2, finalizer) => onExit(self2, (_) => finalizer));
var onExitIf = /* @__PURE__ */ dual(3, (self2, predicate, f) => onExit(self2, (exit3) => {
  if (!predicate(exit3)) {
    return void_2;
  }
  return f(exit3);
}));
var onExitFilter = /* @__PURE__ */ dual(3, (self2, filter4, f) => onExit(self2, (exit3) => {
  const b = filter4(exit3);
  return isFailure2(b) ? void_2 : f(b.success, exit3);
}));
var onError = /* @__PURE__ */ dual(2, (self2, f) => onExitFilter(self2, exitFilterCause, f));
var onErrorIf = /* @__PURE__ */ dual(3, (self2, predicate, f) => onExitIf(self2, (exit3) => {
  if (exit3._tag !== "Failure") {
    return false;
  }
  return predicate(exit3.cause);
}, (exit3) => f(exit3.cause)));
var onErrorFilter = /* @__PURE__ */ dual(3, (self2, filter4, f) => onExit(self2, (exit3) => {
  if (exit3._tag !== "Failure") {
    return void_2;
  }
  const result3 = filter4(exit3.cause);
  return isFailure2(result3) ? void_2 : f(result3.success, exit3.cause);
}));
var onInterrupt = /* @__PURE__ */ dual(2, (self2, finalizer) => onErrorFilter(causeFilterInterruptors, finalizer)(self2));
var acquireUseRelease = (acquire, use, release) => uninterruptibleMask((restore) => flatMap2(acquire, (a) => onExitPrimitive(suspend(() => restore(use(a))), (exit3) => release(a, exit3), true)));
var acquireDisposable = (acquire) => acquireRelease(acquire, (resource) => hasProperty(resource, Symbol.asyncDispose) ? promise(() => resource[Symbol.asyncDispose]()) : sync(() => resource[Symbol.dispose]()));
var cachedInvalidateWithTTL = /* @__PURE__ */ dual(2, (self2, ttl) => sync(() => makeCachedUnsafe(self2, typeof ttl === "function" ? (exit3) => toMillis(fromInputUnsafe(ttl(exit3))) : constant(toMillis(fromInputUnsafe(ttl))))));
var infiniteTTL = /* @__PURE__ */ constant(Infinity);
var makeCachedUnsafe = (self2, ttlMillis) => {
  let expiresAt = 0;
  let exit3;
  let current;
  const join = (fiber3, run) => {
    run.awaiters++;
    onExitUnsafe(fiber3, () => {
      if (--run.awaiters > 0 || run.done) return;
      if (current === run) current = void 0;
      return fiberInterrupt(run.fiber);
    });
    return fiberJoin(run.fiber);
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
    const run = {
      fiber: new FiberImpl(fiber3.context),
      awaiters: 0,
      done: false
    };
    current = run;
    const joined = join(fiber3, run);
    run.fiber.evaluate(onExitPrimitive(self2, (exit_) => {
      run.done = true;
      if (current !== run) return;
      current = void 0;
      if (exitHasInterrupts(exit_)) return;
      const duration = ttlMillis(exit_);
      expiresAt = duration === Infinity ? Infinity : clock.currentTimeMillisUnsafe() + duration;
      exit3 = exit_;
    }));
    return run.fiber._exit ?? joined;
  }), sync(() => {
    current = void 0;
    exit3 = void 0;
  })];
};
var cachedWithTTL = /* @__PURE__ */ dual(2, (self2, timeToLive) => map2(cachedInvalidateWithTTL(self2, timeToLive), (tuple) => tuple[0]));
var cached = (self2) => sync(() => makeCachedUnsafe(self2, infiniteTTL)[0]);
var interrupt = /* @__PURE__ */ withFiber((fiber3) => failCause(causeInterrupt(fiber3.id)));
var uninterruptible = (self2) => withFiber((fiber3) => {
  if (!fiber3.interruptible) return self2;
  fiber3.interruptible = false;
  fiber3._stack.push(setInterruptibleTrue);
  return self2;
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
var interruptible = (self2) => withFiber((fiber3) => {
  if (fiber3.interruptible) return self2;
  return setFiberInterruptible(fiber3) ?? self2;
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
var abortSignal = /* @__PURE__ */ map2(/* @__PURE__ */ acquireRelease(/* @__PURE__ */ sync(() => new AbortController()), (controller) => sync(() => controller.abort())), (_) => _.signal);
var all2 = (arg, options) => {
  if (isIterable(arg)) {
    return options?.mode === "result" ? forEach(arg, result, options) : forEach(arg, identity, options);
  } else if (options?.discard) {
    return options.mode === "result" ? forEach(Object.values(arg), result, options) : forEach(Object.values(arg), identity, options);
  }
  return suspend(() => map2(forEach(Object.entries(arg), ([key, effect]) => map2(options?.mode === "result" ? result(effect) : effect, (value) => [key, value]), {
    concurrency: options?.concurrency
  }), Object.fromEntries));
};
var partition2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => map2(forEach(elements, (a, i) => result(f(a, i)), options), (results2) => partition(results2, identity)));
var reduce = /* @__PURE__ */ dual(3, (elements, zero2, f) => {
  const arr = fromIterable(elements);
  if (arr.length === 0) return sync(zero2);
  return suspend(() => {
    let index = 0;
    let state = zero2();
    return map2(whileLoop({
      while: () => index < arr.length,
      body: () => f(state, arr[index], index),
      step(next) {
        state = next;
        index++;
      }
    }), () => state);
  });
});
var validate = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, f, options) => flatMap2(partition2(elements, f, {
  concurrency: options?.concurrency
}), ([passes, fails]) => {
  if (isArrayNonEmpty2(fails)) {
    return fail3(fails);
  }
  return options?.discard ? void_2 : succeed3(passes);
}));
var findFirst = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, 0, predicate, next.value);
  }
  return succeed3(none2());
}));
var findFirstLoop = (iterator, index, predicate, value) => flatMap2(predicate(value, index), (keep) => {
  if (keep) {
    return succeed3(some2(value));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstLoop(iterator, index + 1, predicate, next.value);
  }
  return succeed3(none2());
});
var findFirstFilter = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4) => suspend(() => {
  const iterator = elements[Symbol.iterator]();
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, 0, filter4, next.value);
  }
  return succeed3(none2());
}));
var findFirstFilterLoop = (iterator, index, filter4, value) => flatMap2(filter4(value, index), (result3) => {
  if (isSuccess2(result3)) {
    return succeed3(some2(result3.success));
  }
  const next = iterator.next();
  if (!next.done) {
    return findFirstFilterLoop(iterator, index + 1, filter4, next.value);
  }
  return succeed3(none2());
});
var whileLoop = /* @__PURE__ */ makePrimitive({
  op: "While",
  [contA](value, fiber3) {
    this[args].step(value);
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
var head = (self2) => flatMap2(self2, (elements) => {
  const result3 = elements[Symbol.iterator]().next();
  return result3.done ? fail3(new NoSuchElementError()) : succeed3(result3.value);
});
var forEachSequential = (iterable, f, options) => suspend(() => {
  const out = options?.discard ? void 0 : [];
  const iterator = iterable[Symbol.iterator]();
  let state = iterator.next();
  let index = 0;
  return as(whileLoop({
    while: () => !state.done,
    body: () => f(state.value, index++),
    step: (b) => {
      if (out) out.push(b);
      state = iterator.next();
    }
  }), out);
});
var resolveConcurrency = (concurrency) => concurrency === "unbounded" ? Number.POSITIVE_INFINITY : Math.max(1, concurrency ?? 1);
var iterateConcurrentImpl = (options) => {
  const onItem = options.onItem;
  const step = options.step;
  return (state, items, opts) => {
    let index = 0;
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
      return fibers && fibers.size > 0 ? flatMap2(uninterruptible(fiberInterruptAll(Array.from(fibers))), () => terminal ?? defect) : defect;
    };
    const go = () => {
      let paused = false;
      for (; !terminal && index < end; index++) {
        const item = items[index];
        const eff = effect ?? onItem(state, item, index);
        if (effectIsExit(eff)) {
          terminal = step(state, item, eff, index);
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
              return flatMap2(fibers ? fiberInterruptAll(fibers) : void_2, () => terminal?._tag === "Failure" ? terminal : void_2);
            });
          });
        } else {
          effect = void 0;
          const fiber3 = forkUnsafe(parentFiber, eff, true, true, "inherit");
          if (fiber3._exit) {
            terminal = step(state, item, fiber3._exit, index);
            if (terminal) break;
            continue;
          }
          fibers.add(fiber3);
          const currentIndex = index;
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
          index++;
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
var forEachConcurrent = /* @__PURE__ */ iterateConcurrentImpl({
  onItem(state, item, index) {
    return state.f(item, index);
  },
  step(state, _, exit3, index) {
    if (exit3._tag === "Failure") return exit3;
    else if (state.out) {
      state.out[index] = exit3.value;
    }
  }
});
var filterOrElse = /* @__PURE__ */ dual(3, (self2, predicate, orElse2) => flatMap2(self2, (a) => predicate(a) ? succeed3(a) : orElse2(a)));
var filterMapOrElse = /* @__PURE__ */ dual(3, (self2, filter4, orElse2) => flatMap2(self2, (a) => {
  const result3 = filter4(a);
  return isFailure2(result3) ? orElse2(result3.failure) : succeed3(result3.success);
}));
var filterMapOrFail = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, filter4, orFailWith) => filterMapOrElse(self2, filter4, orFailWith ? (x) => fail3(orFailWith(x)) : () => fail3(new NoSuchElementError())));
var filter2 = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, predicate, options) => map2(forEach(elements, (a, i) => {
  const result3 = predicate(a, i);
  if (typeof result3 === "boolean") {
    return succeed3(result3 ? some2(a) : none2());
  }
  return map2(result3, (keep) => keep ? some2(a) : none2());
}, options), getSomes));
var filterMap = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4) => suspend(() => {
  const out = [];
  for (const a of elements) {
    const result3 = filter4(a);
    if (isSuccess2(result3)) {
      out.push(result3.success);
    }
  }
  return succeed3(out);
}));
var filterMapEffect = /* @__PURE__ */ dual((args2) => isIterable(args2[0]) && !isEffect(args2[0]), (elements, filter4, options) => suspend(() => {
  const out = [];
  return as(forEach(elements, (a) => map2(filter4(a), (result3) => {
    if (isSuccess2(result3)) {
      out.push(result3.success);
    }
  }), {
    discard: true,
    concurrency: options?.concurrency
  }), out);
}));
var Do2 = /* @__PURE__ */ succeed3({});
var bindTo3 = /* @__PURE__ */ bindTo(map2);
var bind3 = /* @__PURE__ */ bind(map2, flatMap2);
var let_3 = /* @__PURE__ */ let_(map2);
var forkChild = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => withFiber((fiber3) => {
  interruptChildrenPatch();
  return succeed3(forkUnsafe(fiber3, self2, options?.startImmediately, false, options?.uninterruptible ?? false));
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
var forkDetach = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => withFiber((fiber3) => succeed3(forkUnsafe(fiber3, self2, options?.startImmediately, true, options?.uninterruptible))));
var awaitAllChildren = (self2) => withFiber((fiber3) => {
  const initialChildren = fiber3._children && new Set(fiber3._children);
  const isInterruptible = fiber3.interruptible;
  return onExitPrimitive(self2, (_) => {
    let children = fiber3._children;
    if (children === void 0 || children.size === 0) {
      return void_2;
    } else if (initialChildren) {
      children = filter(children, (child) => !initialChildren.has(child));
    }
    const awaitChildren = asVoid(fiberAwaitAll(children));
    return isInterruptible ? interruptible(awaitChildren) : awaitChildren;
  });
});
var fiberScopeFinalizer = (fiber3) => () => withFiber((current) => current === fiber3 ? void_2 : fiberInterrupt(fiber3));
var forkIn = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, scope3, options) => withFiber((parent) => {
  const fiber3 = scope3.state._tag === "Closed" ? new FiberImpl(parent.context) : forkUnsafe(parent, self2, options?.startImmediately, true, options?.uninterruptible);
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
var forkScoped = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => flatMap2(scope, (scope3) => forkIn(self2, scope3, options)));
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
    return new Promise((resolve) => {
      fiber3.addObserver((exit3) => resolve(exit3));
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
    const self2 = arguments[0];
    return flatMap2(makeSpanScoped(name, options), (span) => withParentSpan(self2, span, options));
  }
  return (self2) => flatMap2(makeSpanScoped(name, options), (span) => withParentSpan(self2, span, options));
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
var linkSpans = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, span, attributes = {}) => {
  const spans = Array.isArray(span) ? span : [span];
  const links = spans.map((span2) => ({
    span: span2,
    attributes
  }));
  return updateService(self2, TracerSpanLinks, (current) => [...current, ...links]);
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
  return (self2) => provideParentSpan(provideStackFrame(self2), span);
};
var withSpan = function() {
  const dataFirst = typeof arguments[0] !== "string";
  const name = dataFirst ? arguments[1] : arguments[0];
  const traceOptions = addSpanStackTrace(arguments[2]);
  if (dataFirst) {
    const self2 = arguments[0];
    return useSpan(name, arguments[2], (span) => withParentSpan(self2, span, traceOptions));
  }
  const fnArg = typeof arguments[1] === "function" ? arguments[1] : void 0;
  const options = fnArg ? void 0 : arguments[1];
  return (self2, ...args2) => useSpan(name, fnArg ? fnArg(...args2) : options, (span) => withParentSpan(self2, span, traceOptions));
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
      for (const [key, value] of Object.entries(args2[0])) {
        span.attribute(key, value);
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
  const entries = typeof arguments[0] === "string" ? [[arguments[0], arguments[1]]] : Object.entries(arguments[0]);
  return uninterruptible(withFiber((fiber3) => {
    const prev = fiber3.getRef(CurrentLogAnnotations);
    const next = {
      ...prev
    };
    for (let i = 0; i < entries.length; i++) {
      const [key, value] = entries[i];
      assignProperty(next, key, value);
    }
    fiber3.setContext(add(fiber3.context, CurrentLogAnnotations, next));
    return scopeAddFinalizerExit(getUnsafe(fiber3.context, scopeTag), (_) => {
      const current = fiber3.getRef(CurrentLogAnnotations);
      const next2 = {
        ...current
      };
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        if (current[key] !== value && !Object.is(current[key], value)) continue;
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
  const self2 = Object.create(LoggerProto);
  self2.log = log2;
  return self2;
};
var formatLabel = (key) => key.replace(/[\s="]/g, "_");
var formatLogSpan = (self2, now) => {
  const label = formatLabel(self2[0]);
  return `${label}=${now - self2[1]}ms`;
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
  const now = date.getTime();
  const spans = fiber3.getRef(CurrentLogSpans);
  let spanString = "";
  for (const span of spans) {
    spanString += ` ${formatLogSpan(span, now)}`;
  }
  const annotations = fiber3.getRef(CurrentLogAnnotations);
  if (Object.keys(annotations).length > 0) {
    message_.push(annotations);
  }
  const console2 = fiber3.getRef(ConsoleRef);
  const log2 = fiber3.getRef(LogToStderr) ? console2.error : console2.log;
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
  for (const [key, value] of Object.entries(annotations)) {
    assignProperty(attributes, key, value);
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
var withErrorReporting = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, options) => onError(self2, (cause) => withFiber((fiber3) => {
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
var fromReasons = causeFromReasons;
var isDone2 = isDone;
var done2 = done;

// node_modules/effect/dist/Effect.js
var Effect_exports = {};
__export(Effect_exports, {
  Do: () => Do3,
  Transaction: () => Transaction,
  TypeId: () => TypeId12,
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
  die: () => die2,
  effectify: () => effectify,
  ensuring: () => ensuring2,
  eventually: () => eventually2,
  exit: () => exit2,
  fail: () => fail4,
  failCause: () => failCause2,
  failCauseSync: () => failCauseSync2,
  failSync: () => failSync2,
  fiber: () => fiber2,
  fiberId: () => fiberId2,
  filter: () => filter3,
  filterMap: () => filterMap2,
  filterMapEffect: () => filterMapEffect2,
  filterMapOrElse: () => filterMapOrElse2,
  filterMapOrFail: () => filterMapOrFail2,
  filterOrElse: () => filterOrElse2,
  filterOrFail: () => filterOrFail3,
  findFirst: () => findFirst2,
  findFirstFilter: () => findFirstFilter2,
  firstSuccessOf: () => firstSuccessOf2,
  flatMap: () => flatMap3,
  flatMapEager: () => flatMapEager2,
  flatten: () => flatten3,
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
  fromNullishOr: () => fromNullishOr3,
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
  isFailure: () => isFailure4,
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
  map: () => map3,
  mapBoth: () => mapBoth3,
  mapBothEager: () => mapBothEager2,
  mapEager: () => mapEager2,
  mapError: () => mapError3,
  mapErrorEager: () => mapErrorEager2,
  match: () => match4,
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
  succeed: () => succeed4,
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
  void: () => void_3,
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
var isSuccess4 = exitIsSuccess;

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
var _await = (self2) => callback((resume) => {
  if (self2.effect) return resume(self2.effect);
  self2.resumes ??= [];
  self2.resumes.push(resume);
  return sync(() => {
    const resumes = self2.resumes;
    if (resumes === void 0) return;
    const index = resumes.indexOf(resume);
    if (index >= 0) resumes.splice(index, 1);
  });
});
var doneUnsafe = (self2, effect) => {
  if (self2.effect) return false;
  self2.effect = effect;
  if (self2.resumes) {
    const resumes = self2.resumes;
    self2.resumes = void 0;
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
  const self2 = Object.create(LayerProto);
  self2.build = build;
  return self2;
};
var fromBuild = (build) => fromBuildUnsafe((memoMap, scope3) => {
  const layerScope = forkUnsafe2(scope3);
  return onExit(build(memoMap, layerScope), (exit3) => exit3._tag === "Failure" ? close(layerScope, exit3) : void_2);
});
var fromBuildMemo = (build) => {
  const self2 = fromBuild((memoMap, scope3) => memoMap.getOrElseMemoize(self2, scope3, build));
  return self2;
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
  static forkOrCreate(self2) {
    const current = getOrUndefined2(self2, _CurrentMemoMap);
    return current ? forkMemoMapUnsafe(current) : makeMemoMapUnsafe();
  }
};
var buildWithMemoMap = /* @__PURE__ */ dual(3, (self2, memoMap, scope3) => provideService(map2(suspend(() => self2.build(memoMap, scope3)), add(CurrentMemoMap, memoMap)), CurrentMemoMap, memoMap));
var buildWithScope = /* @__PURE__ */ dual(2, (self2, scope3) => withFiber((fiber3) => buildWithMemoMap(self2, CurrentMemoMap.forkOrCreate(fiber3.context), scope3)));
var succeedContext = (context3) => fromBuildUnsafe(constant(succeed3(context3)));
var mergeAllEffect = (layers, memoMap, scope3) => {
  const parentScope = forkUnsafe2(scope3, "parallel");
  return forEach(layers, (layer) => layer.build(memoMap, forkUnsafe2(parentScope, "sequential")), {
    concurrency: layers.length
  }).pipe(map2((context3) => mergeAll(...context3)));
};
var mergeAll2 = (...layers) => fromBuildMemo((memoMap, scope3) => mergeAllEffect(layers, memoMap, scope3));
var provideWith = (self2, that, f) => fromBuildMemo((memoMap, scope3) => flatMap2(Array.isArray(that) ? mergeAllEffect(that, memoMap, scope3) : that.build(memoMap, scope3), (context3) => self2.build(memoMap, scope3).pipe(provideContext(context3), map2((merged) => f(merged, context3)))));
var provide2 = /* @__PURE__ */ dual(2, (self2, that) => provideWith(self2, that, identity));

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
var matchEffect2 = /* @__PURE__ */ dual(2, (self2, options) => matchCauseEffect(self2, {
  onSuccess: options.onSuccess,
  onFailure: (cause) => {
    const halt = filterDone(cause);
    return !isFailure2(halt) ? options.onDone(halt.success.value) : options.onFailure(halt.failure);
  }
}));

// node_modules/effect/dist/Schedule.js
var TypeId7 = "~effect/Schedule";
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
  [TypeId7]: {
    _Out: identity,
    _In: identity,
    _Env: identity
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var isSchedule = (u) => hasProperty(u, TypeId7);
var fromStep = (step) => {
  const self2 = Object.create(ScheduleProto);
  self2.step = step;
  return self2;
};
var metadataFn = () => {
  let n = 0;
  let previous;
  let start;
  return (now, input) => {
    if (start === void 0) start = now;
    const elapsed = now - start;
    const elapsedSincePrevious = previous === void 0 ? 0 : now - previous;
    previous = now;
    return {
      input,
      attempt: ++n,
      start,
      now,
      elapsed,
      elapsedSincePrevious
    };
  };
};
var fromStepWithMetadata = (step) => fromStep(map2(step, (f) => {
  const meta = metadataFn();
  return (now, input) => f(meta(now, input));
}));
var toStep = (schedule2) => catchCause(schedule2.step, (cause) => succeed3(() => failCause(cause)));
var toStepWithMetadata = (schedule2) => clockWith((clock) => map2(toStep(schedule2), (step) => {
  const metaFn = metadataFn();
  return (input) => suspend(() => {
    const now = clock.currentTimeMillisUnsafe();
    return flatMap2(step(now, input), ([output, duration]) => {
      const meta = metaFn(now, input);
      meta.output = output;
      meta.duration = duration;
      return as(sleep(duration), meta);
    });
  });
}));
var passthrough = (self2) => fromStep(map2(toStep(self2), (step) => (now, input) => matchEffect2(step(now, input), {
  onSuccess: (result3) => succeed3([input, result3[1]]),
  onFailure: failCause,
  onDone: () => done2(input)
})));
var recurs = (times) => while_(forever2, ({
  attempt: attempt2
}) => succeed3(attempt2 <= times));
var spaced = (duration) => {
  const decoded = fromInputUnsafe(duration);
  return fromStepWithMetadata(succeed3((meta) => succeed3([meta.attempt - 1, decoded])));
};
var while_ = /* @__PURE__ */ dual(2, (self2, predicate) => fromStep(map2(toStep(self2), (step) => {
  const meta = metadataFn();
  return (now, input) => flatMap2(step(now, input), (result3) => {
    const [output, duration] = result3;
    const eff = predicate({
      ...meta(now, input),
      output,
      duration
    });
    return flatMap2(isEffect(eff) ? eff : succeed3(eff), (check) => check ? succeed3(result3) : done2(output));
  });
})));
var forever2 = /* @__PURE__ */ spaced(zero);

// node_modules/effect/dist/ExecutionPlan.js
var TypeId8 = "~effect/ExecutionPlan";
var Proto2 = {
  [TypeId8]: TypeId8,
  get captureRequirements() {
    const self2 = this;
    return contextWith((context3) => succeed3(makeProto(self2.steps.map((step) => ({
      ...step,
      while: step.while ? (input) => provideContext(step.while(input), context3) : void 0,
      schedule: step.schedule ? fromStep(provideContext(map2(toStep(step.schedule), (next) => (now, input) => provideContext(next(now, input), context3)), context3)) : void 0,
      provide: isLayer(step.provide) ? provide2(step.provide, succeedContext(context3)) : step.provide
    })))));
  },
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeProto = (steps) => {
  const self2 = Object.create(Proto2);
  self2.steps = steps;
  return self2;
};
var CurrentMetadata2 = /* @__PURE__ */ Reference("effect/ExecutionPlan/CurrentMetadata", {
  defaultValue: /* @__PURE__ */ constant({
    attempt: 0,
    stepIndex: 0
  })
});

// node_modules/effect/dist/internal/layer.js
var provideLayer = (self2, layer, options) => scopedWith((scope3) => flatMap2(options?.local ? buildWithMemoMap(layer, makeMemoMapUnsafe(), scope3) : buildWithScope(layer, scope3), (context3) => provideContext(self2, context3)));
var provide3 = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, source, options) => isContext(source) ? provideContext(self2, source) : provideLayer(self2, Array.isArray(source) ? mergeAll2(...source) : source, options));

// node_modules/effect/dist/internal/schedule.js
var repeatOrElse = /* @__PURE__ */ dual(3, (self2, schedule2, orElse2) => flatMap2(toStepWithMetadata(schedule2), (step) => {
  let meta = CurrentMetadata.defaultValue();
  const loop = (input) => matchEffect2(step(input), {
    onSuccess(meta_) {
      meta = meta_;
      return flatMap2(provideService(self2, CurrentMetadata, meta), loop);
    },
    onFailure: failCause,
    onDone: succeed3
  });
  return catchCauseFilter(flatMap2(provideService(self2, CurrentMetadata, meta), loop), findRecoverableError, (error) => orElse2(error, meta.attempt === 0 ? none2() : some2(meta)));
}));
var retryOrElse = /* @__PURE__ */ dual(3, (self2, policy, orElse2) => flatMap2(toStepWithMetadata(policy), (step) => {
  let meta = CurrentMetadata.defaultValue();
  let lastError;
  const loop = catchCauseFilter(suspend(() => provideService(self2, CurrentMetadata, meta)), findRecoverableError, (error) => {
    lastError = error;
    return flatMap2(step(error), (meta_) => {
      meta = meta_;
      return loop;
    });
  });
  return catchDone(loop, (out) => internalCall(() => orElse2(lastError, out)));
}));
var repeat = /* @__PURE__ */ dual(2, (self2, options) => {
  const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return repeatOrElse(self2, schedule2, fail3);
});
var retry = /* @__PURE__ */ dual(2, (self2, options) => {
  const schedule2 = typeof options === "function" ? options(identity) : isSchedule(options) ? options : buildFromOptions(options);
  return retryOrElse(self2, schedule2, fail3);
});
var scheduleFrom = /* @__PURE__ */ dual(3, (self2, initial, schedule2) => flatMap2(toStepWithMetadata(schedule2), (step) => {
  const loop = (input) => matchEffect2(step(input), {
    onSuccess: (meta) => flatMap2(provideService(self2, CurrentMetadata, meta), loop),
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
      return isEffect(applied) ? map2(applied, (b) => !b) : succeed3(!applied);
    });
  }
  if (options.times !== void 0) {
    schedule2 = while_(schedule2, ({
      attempt: attempt2
    }) => succeed3(attempt2 <= options.times));
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
var withExecutionPlan = /* @__PURE__ */ dual((args2) => isEffect(args2[0]), (self2, plan, options) => suspend(() => {
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
  const instrument = emitter === void 0 ? identity : (attempt2) => uninterruptibleMask((restore) => flatMap2(emitter.begin, (state) => onExit(restore(attempt2), (exit3) => emitter.end(state, exit3))));
  let result3;
  return flatMap2(whileLoop({
    while: () => i < plan.steps.length && (result3 === void 0 || isFailure2(result3)),
    body() {
      const step = plan.steps[i];
      let nextEffect = provideMeta(instrument(provide3(self2, step.provide)));
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
var TypeId9 = "~effect/MutableHashMap";
var MutableHashMapProto = {
  [TypeId9]: TypeId9,
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
  const self2 = Object.create(MutableHashMapProto);
  self2.backing = /* @__PURE__ */ new Map();
  self2.buckets = /* @__PURE__ */ new Map();
  return self2;
};
var get2 = /* @__PURE__ */ dual(2, (self2, key) => {
  if (self2.backing.has(key)) {
    return some2(self2.backing.get(key));
  } else if (isSimpleKey(key)) {
    return none2();
  }
  const hash2 = hash(key);
  const bucket = self2.buckets.get(hash2);
  if (bucket === void 0) {
    return none2();
  }
  return getFromBucket(self2, bucket, key);
});
var isSimpleKey = (u) => typeof u !== "object" && typeof u !== "function";
var getFromBucket = (self2, bucket, key) => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (equals(key, bucket[i])) {
      const refKey = bucket[i];
      return some2(self2.backing.get(refKey));
    }
  }
  return none2();
};
var has = /* @__PURE__ */ dual(2, (self2, key) => isSome2(get2(self2, key)));
var set = /* @__PURE__ */ dual(3, (self2, key, value) => {
  if (self2.backing.has(key) || isSimpleKey(key)) {
    self2.backing.set(key, value);
    return self2;
  }
  const hash2 = hash(key);
  const bucket = self2.buckets.get(hash2);
  if (bucket === void 0) {
    self2.buckets.set(hash2, [key]);
    self2.backing.set(key, value);
    return self2;
  }
  let refKey = getRefKey(bucket, key);
  if (refKey === void 0) {
    bucket.push(key);
    refKey = key;
  }
  self2.backing.set(refKey, value);
  return self2;
});
var getRefKey = (bucket, key) => {
  for (let i = 0, len = bucket.length; i < len; i++) {
    if (equals(key, bucket[i])) {
      return bucket[i];
    }
  }
};
var remove = /* @__PURE__ */ dual(2, (self2, key_) => {
  if (isSimpleKey(key_)) {
    self2.backing.delete(key_);
    return self2;
  }
  const hash2 = hash(key_);
  const bucket = self2.buckets.get(hash2);
  if (bucket === void 0) {
    return self2;
  }
  for (let i = 0, len = bucket.length; i < len; i++) {
    const bkey = bucket[i];
    if (bkey === key_ || equals(key_, bkey)) {
      self2.backing.delete(bkey);
      bucket.splice(i, 1);
      break;
    }
  }
  if (bucket.length === 0) {
    self2.buckets.delete(hash2);
  }
  return self2;
});

// node_modules/effect/dist/Request.js
var TypeId10 = "~effect/Request";
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
  [TypeId10]: requestVariance
};
var makeEntry = (options) => options;

// node_modules/effect/dist/internal/request.js
var request = /* @__PURE__ */ dual(2, (self2, resolver) => {
  const withResolver = (resolver2) => callback((resume) => {
    const entry = addEntry(resolver2, self2, resume, getCurrentFiber());
    return maybeRemoveEntry(resolver2, entry);
  });
  return isEffect(resolver) ? flatMap2(resolver, withResolver) : withResolver(resolver);
});
var requestUnsafe = (self2, options) => {
  const entry = addEntry(options.resolver, self2, options.onExit, {
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
  const map4 = empty3();
  return {
    get: (key) => getOrUndefined(get2(map4, key)),
    has: (key) => has(map4, key),
    set: (key, batch) => set(map4, key, batch),
    delete: (key) => remove(map4, key)
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
        delayEffect: flatMap2(withFiber((delayFiber) => {
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
var TypeId11 = "~effect/Metric";
var Metric$ = class {
  [TypeId11] = TypeId11;
  #extraAttributes;
  #mergedAttributes;
  #key = "";
  id;
  description;
  attributes;
  constructor(id, description, attributes) {
    this.id = id;
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
var update = /* @__PURE__ */ dual(2, (self2, input) => contextWith((services) => sync(() => self2.updateUnsafe(input, services))));
function makeKey(metric, attributes) {
  const entries = Object.entries(attributes).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return JSON.stringify([metric.type, metric.id, metric.description, entries]);
}
function mergeAttributes(self2, other) {
  return {
    ...attributesToRecord(self2),
    ...attributesToRecord(other)
  };
}
function attributesToRecord(attributes) {
  if (isNotUndefined(attributes) && Array.isArray(attributes)) {
    return attributes.reduce((acc, [key, value]) => {
      assignProperty(acc, key, value);
      return acc;
    }, {});
  }
  return attributes;
}

// node_modules/effect/dist/Effect.js
var TypeId12 = EffectTypeId;
var isEffect2 = isEffect;
var all3 = all2;
var partition3 = partition2;
var reduce2 = reduce;
var validate2 = validate;
var findFirst2 = findFirst;
var findFirstFilter2 = findFirstFilter;
var forEach2 = forEach;
var head2 = head;
var whileLoop2 = whileLoop;
var promise2 = promise;
var tryPromise2 = tryPromise;
var succeed4 = succeed3;
var succeedNone3 = succeedNone2;
var succeedSome3 = succeedSome2;
var suspend2 = suspend;
var sync2 = sync;
var void_3 = void_2;
var undefined_2 = undefined_;
var callback2 = callback;
var never2 = never;
var Do3 = Do2;
var bindTo4 = bindTo3;
var let_4 = let_3;
var bind4 = bind3;
var gen3 = gen2;
var fail4 = fail3;
var failSync2 = failSync;
var failCause2 = failCause;
var failCauseSync2 = failCauseSync;
var die2 = die;
var try_3 = try_2;
var yieldNow2 = yieldNow;
var yieldNowWith2 = yieldNowWith;
var withFiber2 = withFiber;
var withFiberSucceed2 = withFiberSucceed;
var fromResult2 = fromResult;
var fromOption4 = fromOption3;
var transposeOption3 = transposeOption2;
var fromNullishOr3 = fromNullishOr2;
var flatMap3 = flatMap2;
var flatten3 = flatten2;
var andThen3 = andThen2;
var tap3 = tap2;
var result2 = result;
var option2 = option;
var exit2 = exit;
var map3 = map2;
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
var filter3 = filter2;
var filterMap2 = filterMap;
var filterMapEffect2 = filterMapEffect;
var filterOrElse2 = filterOrElse;
var filterMapOrElse2 = filterMapOrElse;
var filterOrFail3 = filterOrFail2;
var filterMapOrFail2 = filterMapOrFail;
var when2 = when;
var match4 = match3;
var matchEager2 = matchEager;
var matchCause2 = matchCause;
var matchCauseEager2 = matchCauseEager;
var matchCauseEffectEager2 = matchCauseEffectEager;
var matchCauseEffect2 = matchCauseEffect;
var matchEffect3 = matchEffect;
var isFailure4 = isFailure3;
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
var schedule = /* @__PURE__ */ dual(2, (self2, schedule2) => scheduleFrom2(self2, void 0, schedule2));
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
var withLogSpan = /* @__PURE__ */ dual(2, (effect, label) => flatMap2(currentTimeMillis, (now) => updateService(effect, CurrentLogSpans2, (spans) => {
  const span = [label, now];
  return [span, ...spans];
})));
var track = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self2, metric, f) => onExit2(self2, (exit3) => {
  const input = f === void 0 ? exit3 : f(exit3);
  return update(metric, input);
}));
var trackSuccesses = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self2, metric, f) => tap3(self2, (value) => {
  const input = f === void 0 ? value : f(value);
  return update(metric, input);
}));
var trackErrors = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self2, metric, f) => tapError2(self2, (error) => {
  const input = f === void 0 ? error : f(error);
  return update(metric, input);
}));
var trackDefects = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self2, metric, f) => tapDefect2(self2, (defect) => {
  const input = f === void 0 ? defect : f(defect);
  return update(metric, input);
}));
var trackDuration = /* @__PURE__ */ dual((args2) => isEffect2(args2[0]), (self2, metric, f) => clockWith2((clock) => {
  const startTime = clock.monotonicTimeNanosUnsafe();
  return onExit2(self2, () => {
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
  const now = clock.currentTimeMillisUnsafe();
  const mutable = {
    journal: /* @__PURE__ */ new Map(),
    retry: false,
    attempt: 1,
    retryReason: void 0,
    start: now,
    now,
    elapsed: 0,
    elapsedSincePrevious: 0
  };
  let result3;
  return uninterruptibleMask2((restore) => {
    const run = restore(effect).pipe(provideService2(Transaction, mutable), tapCause2((cause) => {
      if (!mutable.retry) return void_3;
      if (!hasInterruptsOnly(cause)) return sync2(() => clearTransaction(mutable));
      return restore(awaitPendingTransaction(mutable));
    }), exit2);
    return flatMap3(whileLoop2({
      while: () => !result3,
      body: () => {
        if (mutable.attempt > 1) {
          stampTransaction(mutable, clock.currentTimeMillisUnsafe());
        }
        return run;
      },
      step(exit3) {
        if (mutable.retry || !isTransactionConsistent(mutable)) {
          mutable.attempt++;
          mutable.retryReason = mutable.retry ? "retry" : "conflict";
          return clearTransaction(mutable);
        }
        if (isSuccess4(exit3)) {
          commitTransaction(fiber3, mutable);
        }
        clearTransaction(mutable);
        completedTransactions.add(mutable);
        result3 = exit3;
      }
    }), () => result3);
  });
});
var completedTransactions = /* @__PURE__ */ new WeakSet();
var stampTransaction = (state, now) => {
  state.elapsedSincePrevious = now - state.now;
  state.now = now;
  state.elapsed = now - state.start;
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
    return resume(void_3);
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
    resume(void_3);
  };
  for (const ref of refs) {
    ref.pending.set(key, onCall);
  }
  return sync2(clearPending);
});
function commitTransaction(fiber3, state) {
  for (const [ref, {
    value,
    written
  }] of state.journal) {
    if (!written) continue;
    if (!Object.is(value, ref.value)) {
      ref.version = ref.version + 1;
      ref.value = value;
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
var txRetry = /* @__PURE__ */ flatMap3(Transaction, (state) => {
  const mutable = state;
  mutable.retry = true;
  return interrupt2;
});
var effectify = (fn3, onError3, onSyncError) => (...args2) => callback2((resume) => {
  let synchronous = true;
  let pending;
  try {
    fn3(...args2, (err, result3) => {
      const effect = err ? onError3 ? suspend2(() => fail4(onError3(err, args2))) : fail4(err) : succeed4(result3);
      if (synchronous) {
        pending ??= effect;
      } else {
        resume(effect);
      }
    });
  } catch (err) {
    pending = onSyncError ? fail4(onSyncError(err, args2)) : die2(err);
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

// node_modules/effect/dist/MutableRef.js
var TypeId13 = "~effect/MutableRef";
var MutableRefProto = {
  [TypeId13]: TypeId13,
  ...PipeInspectableProto,
  toJSON() {
    return {
      _id: "MutableRef",
      current: toJson(this.current)
    };
  }
};
var make6 = (value) => {
  const ref = Object.create(MutableRefProto);
  ref.current = value;
  return ref;
};
var set2 = /* @__PURE__ */ dual(2, (self2, value) => {
  self2.current = value;
  return self2;
});

// node_modules/effect/dist/Ref.js
var Ref_exports = {};
__export(Ref_exports, {
  get: () => get3,
  getAndSet: () => getAndSet,
  getAndUpdate: () => getAndUpdate,
  getAndUpdateSome: () => getAndUpdateSome,
  getUnsafe: () => getUnsafe2,
  make: () => make7,
  makeUnsafe: () => makeUnsafe4,
  modify: () => modify,
  modifySome: () => modifySome,
  set: () => set3,
  setAndGet: () => setAndGet,
  update: () => update2,
  updateAndGet: () => updateAndGet,
  updateSome: () => updateSome,
  updateSomeAndGet: () => updateSomeAndGet
});
var TypeId14 = "~effect/Ref";
var RefProto = {
  [TypeId14]: {
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
var makeUnsafe4 = (value) => {
  const self2 = Object.create(RefProto);
  self2.ref = make6(value);
  return self2;
};
var make7 = (value) => sync2(() => makeUnsafe4(value));
var get3 = (self2) => sync2(() => self2.ref.current);
var set3 = /* @__PURE__ */ dual(2, (self2, value) => sync2(() => set2(self2.ref, value)));
var getAndSet = /* @__PURE__ */ dual(2, (self2, value) => sync2(() => {
  const current = self2.ref.current;
  self2.ref.current = value;
  return current;
}));
var getAndUpdate = /* @__PURE__ */ dual(2, (self2, f) => sync2(() => {
  const current = self2.ref.current;
  self2.ref.current = f(current);
  return current;
}));
var getAndUpdateSome = /* @__PURE__ */ dual(2, (self2, pf) => sync2(() => {
  const current = self2.ref.current;
  const option3 = pf(current);
  if (option3._tag === "Some") {
    self2.ref.current = option3.value;
  }
  return current;
}));
var setAndGet = /* @__PURE__ */ dual(2, (self2, value) => sync2(() => self2.ref.current = value));
var modify = /* @__PURE__ */ dual(2, (self2, f) => sync2(() => {
  const [b, a] = f(self2.ref.current);
  self2.ref.current = a;
  return b;
}));
var modifySome = /* @__PURE__ */ dual(2, (self2, pf) => modify(self2, (value) => {
  const [b, option3] = pf(value);
  return [b, option3._tag === "None" ? value : option3.value];
}));
var update2 = /* @__PURE__ */ dual(2, (self2, f) => sync2(() => {
  self2.ref.current = f(self2.ref.current);
}));
var updateAndGet = /* @__PURE__ */ dual(2, (self2, f) => sync2(() => self2.ref.current = f(self2.ref.current)));
var updateSome = /* @__PURE__ */ dual(2, (self2, f) => sync2(() => {
  const option3 = f(self2.ref.current);
  if (option3._tag === "Some") {
    self2.ref.current = option3.value;
  }
}));
var updateSomeAndGet = /* @__PURE__ */ dual(2, (self2, pf) => sync2(() => {
  const option3 = pf(self2.ref.current);
  if (option3._tag === "Some") {
    self2.ref.current = option3.value;
  }
  return self2.ref.current;
}));
var getUnsafe2 = (self2) => self2.ref.current;

// public/lib/runtime.ts
var runEffect = (program) => Effect_exports.runPromise(Effect_exports.result(program)).then(Result_exports.match({
  onFailure: (error) => {
    throw error;
  },
  onSuccess: (value) => value
}));

// public/lib/store.ts
var STORES = ["kv", "hubs", "devices", "queue"];
var createStorage = (options = {}) => {
  const cached3 = Ref_exports.makeUnsafe(void 0);
  const reset = () => {
    Effect_exports.runSync(Ref_exports.set(cached3, void 0));
  };
  const database = () => {
    const existing = Effect_exports.runSync(Ref_exports.get(cached3));
    if (existing !== void 0) return existing;
    const pending = runEffect(Effect_exports.callback((resume) => {
      const request3 = (options.factory ?? globalThis.indexedDB).open(options.name ?? "i6-share", 2);
      request3.onupgradeneeded = () => {
        const db = request3.result;
        Array.from(db.objectStoreNames).filter((name) => !STORES.some((storeName) => storeName === name)).forEach((name) => {
          db.deleteObjectStore(name);
        });
        STORES.filter((name) => !db.objectStoreNames.contains(name)).forEach((name) => db.createObjectStore(name));
      };
      request3.onsuccess = () => {
        const db = request3.result;
        db.onversionchange = () => {
          db.close();
          reset();
        };
        resume(Effect_exports.succeed(db));
      };
      request3.onerror = () => {
        reset();
        resume(Effect_exports.fail(request3.error));
      };
      request3.onblocked = () => {
        if (options.blocked !== void 0) options.blocked();
        else console.warn("[i6] IndexedDB upgrade blocked by another tab");
      };
    }));
    Effect_exports.runSync(Ref_exports.set(cached3, pending));
    return pending;
  };
  const transaction = (name, mode, request3) => runEffect(Effect_exports.flatMap(Effect_exports.tryPromise(database), (db) => Effect_exports.callback((resume) => {
    const tx2 = db.transaction(name, mode);
    const result3 = request3(tx2.objectStore(name));
    tx2.oncomplete = () => {
      resume(Effect_exports.succeed(result3.result));
    };
    tx2.onerror = () => {
      resume(Effect_exports.fail(tx2.error));
    };
    tx2.onabort = () => {
      resume(Effect_exports.fail(tx2.error));
    };
  })));
  const store2 = (name) => ({
    get: (key) => transaction(name, "readonly", (objectStore) => objectStore.get(key)),
    put: (key, value) => transaction(name, "readwrite", (objectStore) => objectStore.put(value, key)).then(() => void 0),
    delete: (key) => transaction(name, "readwrite", (objectStore) => objectStore.delete(key)),
    all: () => transaction(name, "readonly", (objectStore) => objectStore.getAll())
  });
  return {
    store: store2,
    close: async () => {
      const pending = Effect_exports.runSync(Ref_exports.get(cached3));
      reset();
      if (pending !== void 0) (await pending).close();
    }
  };
};
var storage = createStorage();
var store = storage.store;
var kv = store("kv");

// public/sw.ts
var CACHE = "i6-share-1.1.0";
var SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./app.css",
  "./client.js",
  "./style.css",
  "./lib/proto.js",
  "./lib/dom.js",
  "./lib/store.js",
  "./manifest.webmanifest",
  "./build-info.js"
];
var OPTIONAL = [
  "./icons/icon.svg",
  "./icons/favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];
var attempt = (run) => Effect_exports.tryPromise({ try: run, catch: (error) => error });
var scoped3 = (scope3, path) => new URL(path, scope3.registration.scope).href;
var install = ({ scope: scope3 }) => Effect_exports.gen(function* () {
  const cache = yield* attempt(() => scope3.caches.open(CACHE));
  yield* attempt(() => cache.addAll(SHELL.map((path) => new Request(scoped3(scope3, path), { cache: "reload" }))));
  yield* Effect_exports.forEach(OPTIONAL, (path) => attempt(() => cache.add(new Request(scoped3(scope3, path), { cache: "reload" }))).pipe(Effect_exports.ignore), { concurrency: "unbounded", discard: true });
  yield* attempt(() => scope3.skipWaiting());
});
var activate = ({ scope: scope3 }) => Effect_exports.gen(function* () {
  const keys = yield* attempt(() => scope3.caches.keys());
  yield* Effect_exports.forEach(keys.filter((key) => key.startsWith("i6-share-") && key !== CACHE), (key) => attempt(() => scope3.caches.delete(key)), { discard: true });
  yield* attempt(() => scope3.clients.claim());
});
var networkFirst = ({ scope: scope3 }, request3) => Effect_exports.gen(function* () {
  const cache = yield* attempt(() => scope3.caches.open(CACHE));
  return yield* Effect_exports.gen(function* () {
    const response = yield* attempt(() => scope3.fetch(request3, { cache: "no-cache" }));
    if (response.ok) yield* attempt(() => cache.put(request3, response.clone()));
    return response;
  }).pipe(Effect_exports.catch((error) => attempt(() => cache.match(request3)).pipe(Effect_exports.flatMap((cached3) => cached3 === void 0 ? Effect_exports.fail(error) : Effect_exports.succeed(cached3)))));
});
var navigationKey = (request3) => {
  if (request3.mode !== "navigate") return request3;
  const url = new URL(request3.url);
  url.search = "";
  url.hash = "";
  return url.href;
};
var staleWhileRevalidate = ({ scope: scope3 }, event, request3) => Effect_exports.gen(function* () {
  const cache = yield* attempt(() => scope3.caches.open(CACHE));
  const navigation = request3.mode === "navigate";
  const key = navigationKey(request3);
  const cached3 = yield* attempt(() => cache.match(key, { ignoreSearch: navigation }));
  const network = attempt(() => scope3.fetch(request3, { cache: "no-cache" })).pipe(Effect_exports.tap((response) => response.ok && response.type === "basic" ? attempt(() => cache.put(key, response.clone())) : Effect_exports.void));
  if (cached3 !== void 0) {
    event.waitUntil(Effect_exports.runPromise(network.pipe(Effect_exports.ignore)));
    return cached3;
  }
  return yield* network.pipe(Effect_exports.catch((error) => {
    if (!navigation || key !== scoped3(scope3, "./") && key !== scoped3(scope3, "./index.html")) return Effect_exports.fail(error);
    return attempt(() => cache.match(scoped3(scope3, "./"))).pipe(
      Effect_exports.flatMap((shell) => shell === void 0 ? attempt(() => cache.match(scoped3(scope3, "./index.html"))) : Effect_exports.succeed(shell)),
      Effect_exports.flatMap((shell) => shell === void 0 ? Effect_exports.fail(error) : Effect_exports.succeed(shell))
    );
  }));
});
var sharedFiles = (form, now) => {
  const files = form.getAll("files").filter((value) => typeof value !== "string" && (value.size > 0 || value.name.length > 0));
  if (files.length > 0) return files;
  const text = ["title", "text", "url"].map((key) => form.get(key)).filter((value) => typeof value === "string" && value.trim().length > 0);
  if (text.length === 0) return [];
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return [new File([`${[...new Set(text)].join("\n")}
`], `shared-${stamp}.txt`, { type: "text/plain" })];
};
var receiveShare = (dependencies, request3) => attempt(() => request3.formData()).pipe(
  Effect_exports.map((form) => sharedFiles(form, dependencies.now())),
  Effect_exports.flatMap((files) => files.length > 0 ? attempt(() => dependencies.stage(files)) : Effect_exports.void),
  Effect_exports.catch((error) => Effect_exports.sync(() => {
    dependencies.report(error);
  })),
  Effect_exports.map(() => Response.redirect(scoped3(dependencies.scope, "./?share=1"), 303))
);
var handleFetch = (dependencies, event) => {
  const { scope: scope3 } = dependencies;
  const request3 = event.request;
  const url = new URL(request3.url);
  if (url.origin !== scope3.location.origin) return;
  const target = new URL(url);
  target.search = "";
  target.hash = "";
  if (request3.method === "POST" && target.href === scoped3(scope3, "./share-target")) {
    event.respondWith(Effect_exports.runPromise(receiveShare(dependencies, request3)));
    return;
  }
  if (request3.method !== "GET" || request3.headers.has("range") || !url.href.startsWith(scope3.registration.scope) || url.href.startsWith(scoped3(scope3, "./downloads/"))) return;
  event.respondWith(Effect_exports.runPromise(url.pathname.endsWith("/build-info.js") ? networkFirst(dependencies, request3) : staleWhileRevalidate(dependencies, event, request3)));
};
var registerServiceWorker = (dependencies) => {
  dependencies.scope.addEventListener("install", (event) => {
    event.waitUntil(Effect_exports.runPromise(install(dependencies)));
  });
  dependencies.scope.addEventListener("activate", (event) => {
    event.waitUntil(Effect_exports.runPromise(activate(dependencies)));
  });
  dependencies.scope.addEventListener("fetch", (event) => {
    handleFetch(dependencies, event);
  });
};
var initializeServiceWorker = () => {
  registerServiceWorker({ scope: self, stage: (files) => store("kv").put("staged", files), now: () => /* @__PURE__ */ new Date(), report: (error) => {
    console.error("share target failed", error);
  } });
};
initializeServiceWorker();
export {
  CACHE,
  OPTIONAL,
  SHELL,
  activate,
  handleFetch,
  initializeServiceWorker,
  install,
  navigationKey,
  networkFirst,
  receiveShare,
  registerServiceWorker,
  scoped3 as scoped,
  sharedFiles,
  staleWhileRevalidate
};
//# sourceMappingURL=sw.js.map
