// StateCarry's portable JSON profile and migration engine. No environment APIs.
export const LIMITS = Object.freeze({
  projectBytes: 4194304,
  payloadBytes: 524288,
  depth: 20,
  nodes: 20000,
  versions: 16,
  ops: 64,
  fixtures: 50,
  contracts: 256,
  work: 2000000,
  reportBytes: 8388608,
  htmlEstimateBytes: 16777216,
});
export class StateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StateError";
    this.code = code;
  }
}
const fail = (code, message) => {
    throw new StateError(code, message);
  },
  own = (x, k) => Object.hasOwn(x, k),
  object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const size = (s) => new TextEncoder().encode(s).length;
export function validateJSON(
  value,
  {
    maxBytes = LIMITS.payloadBytes,
    budget = null,
    maxNodes = LIMITS.nodes,
    maxDepth = LIMITS.depth,
  } = {},
) {
  let count = 0,
    seen = new Set();
  function walk(v, depth) {
    if (++count > maxNodes || depth > maxDepth)
      fail("RESOURCE_LIMIT", "JSON node/depth limit exceeded");
    if (budget && --budget.remaining < 0)
      fail("RESOURCE_LIMIT", "Migration work budget exceeded");
    if (v === null || typeof v === "boolean") return;
    if (typeof v === "number") {
      if (
        !Number.isFinite(v) ||
        Math.abs(v) > Number.MAX_SAFE_INTEGER ||
        Object.is(v, -0)
      )
        fail(
          "JSON_PROFILE",
          "Use finite numbers within safe magnitude; negative zero is unsupported",
        );
      return;
    }
    if (typeof v === "string") {
      if (v.length > 32768 || /[\uD800-\uDFFF]/u.test(v))
        fail("JSON_PROFILE", "String too long or unpaired surrogate");
      return;
    }
    if (typeof v !== "object" || !v)
      fail("JSON_PROFILE", "Only portable JSON values are supported");
    if (seen.has(v)) fail("JSON_PROFILE", "Cycles are unsupported");
    seen.add(v);
    if (Array.isArray(v)) {
      if (Object.getPrototypeOf(v) !== Array.prototype)
        fail("JSON_PROFILE", "Standard array prototypes required");
      if (
        Object.keys(v).length !== v.length ||
        Reflect.ownKeys(v).length !== v.length + 1
      )
        fail("JSON_PROFILE", "Dense arrays without extra properties required");
      for (let i = 0; i < v.length; i++) {
        if (!own(v, i))
          fail("JSON_PROFILE", "Dense own array elements required");
        const descriptor = Object.getOwnPropertyDescriptor(v, String(i));
        if (!descriptor || !own(descriptor, "value"))
          fail("JSON_PROFILE", "Data array elements required");
        walk(descriptor.value, depth + 1);
      }
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(v)))
        fail("JSON_PROFILE", "Plain objects required");
      if (Reflect.ownKeys(v).length !== Object.keys(v).length)
        fail("JSON_PROFILE", "Enumerable string keys required");
      for (const k of Object.keys(v)) {
        if (
          forbidden.has(k) ||
          k.length > 128 ||
          /[\uD800-\uDFFF]/u.test(k) ||
          /\p{Cc}/u.test(k)
        )
          fail("JSON_PROFILE", "Unsupported object key");
        let d = Object.getOwnPropertyDescriptor(v, k);
        if (!d || !own(d, "value"))
          fail("JSON_PROFILE", "Data properties required");
        walk(v[k], depth + 1);
      }
    }
    seen.delete(v);
  }
  walk(value, 0);
  if (size(JSON.stringify(value)) > maxBytes)
    fail("RESOURCE_LIMIT", "JSON byte limit exceeded");
  return value;
}
function decimalToken(s) {
  let [mant, exp = "0"] = s.toLowerCase().split("e"),
    negative = mant.startsWith("-");
  mant = mant.replace(/^[+-]/, "");
  let [a, b = ""] = mant.split("."),
    digits = (a + b).replace(/^0+/, "");
  let power = Number(exp) - b.length;
  if (!digits) return "0";
  while (digits.endsWith("0")) {
    digits = digits.slice(0, -1);
    power++;
  }
  return (negative ? "-" : "") + digits + "e" + power;
}
export function parseJSON(source, maxBytes = LIMITS.projectBytes) {
  if (typeof source !== "string" || size(source) > maxBytes)
    fail("RESOURCE_LIMIT", "JSON import byte limit exceeded");
  let i = 0;
  const ws = () => {
    while (/[ \n\r\t]/.test(source[i] ?? "!")) i++;
  };
  function string() {
    let start = i++;
    while (i < source.length) {
      if (source[i] === '"') {
        i++;
        try {
          return JSON.parse(source.slice(start, i));
        } catch {
          fail("INVALID_JSON", "Invalid JSON string");
        }
      }
      if (source[i] === "\\") i++;
      i++;
    }
    fail("INVALID_JSON", "Unterminated string");
  }
  function value(depth) {
    if (depth > 32) fail("RESOURCE_LIMIT", "Import nesting limit exceeded");
    ws();
    let c = source[i];
    if (c === '"') return string();
    if (c === "{") {
      i++;
      let out = Object.create(null);
      ws();
      if (source[i] === "}") {
        i++;
        return out;
      }
      while (true) {
        ws();
        if (source[i] !== '"') fail("INVALID_JSON", "Object key required");
        let k = string();
        if (own(out, k)) fail("INVALID_JSON", "Duplicate key: " + k);
        ws();
        if (source[i++] !== ":") fail("INVALID_JSON", "Colon required");
        out[k] = value(depth + 1);
        ws();
        let end = source[i++];
        if (end === "}") return out;
        if (end !== ",") fail("INVALID_JSON", "Object delimiter required");
      }
    }
    if (c === "[") {
      i++;
      let out = [];
      ws();
      if (source[i] === "]") {
        i++;
        return out;
      }
      while (true) {
        if (out.length > 20000) fail("RESOURCE_LIMIT", "Import array too long");
        out.push(value(depth + 1));
        ws();
        let end = source[i++];
        if (end === "]") return out;
        if (end !== ",") fail("INVALID_JSON", "Array delimiter required");
      }
    }
    let m =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        source.slice(i),
      );
    if (!m) fail("INVALID_JSON", "Invalid JSON token");
    i += m[0].length;
    let v = JSON.parse(m[0]);
    if (
      typeof v === "number" &&
      (m[0].length > 64 ||
        !Number.isFinite(v) ||
        Math.abs(v) > Number.MAX_SAFE_INTEGER ||
        Object.is(v, -0) ||
        decimalToken(m[0]) !== decimalToken(JSON.stringify(v)))
    )
      fail(
        "JSON_PROFILE",
        "Numeric literal loses decimal information; encode it as a string",
      );
    return v;
  }
  let out = value(0);
  ws();
  if (i !== source.length) fail("INVALID_JSON", "Unexpected JSON suffix");
  return out;
}
export function decodeUTF8(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > LIMITS.projectBytes)
    fail("RESOURCE_LIMIT", "File exceeds 4 MiB");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    fail("INVALID_JSON", "Invalid UTF-8 file");
  }
}
export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
export function equal(a, b) {
  if (a === b) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  let ak = Object.keys(a),
    bk = Object.keys(b);
  return (
    ak.length === bk.length && ak.every((k) => own(b, k) && equal(a[k], b[k]))
  );
}
function keys(v, required, optional = []) {
  if (
    !object(v) ||
    required.some((k) => !own(v, k)) ||
    Object.keys(v).some((k) => ![...required, ...optional].includes(k))
  )
    fail(
      "INVALID_PROJECT",
      "Invalid object keys; expected " + required.join(", "),
    );
}
function text(v, max = 120, nonempty = true) {
  if (
    typeof v !== "string" ||
    v.length > max ||
    /\p{Cc}/u.test(v) ||
    /[\uD800-\uDFFF]/u.test(v) ||
    (nonempty && !v.trim())
  )
    fail("INVALID_PROJECT", "Invalid bounded text");
}
function id(v) {
  if (
    typeof v !== "string" ||
    !/^[A-Za-z][A-Za-z0-9_-]{0,39}$(?![\s\S])/.test(v)
  )
    fail(
      "INVALID_PROJECT",
      "ID must be an ASCII letter followed by letters, digits, _ or -",
    );
}
export function pointer(path) {
  if (
    typeof path !== "string" ||
    path.length > 1024 ||
    !(path === "" || path.startsWith("/")) ||
    /~(?![01])/.test(path)
  )
    fail("INVALID_POINTER", "Use an RFC6901 pointer, not a URI fragment");
  const parts =
    path === ""
      ? []
      : path
          .slice(1)
          .split("/")
          .map((x) => x.replaceAll("~1", "/").replaceAll("~0", "~"));
  for (const p of parts)
    if (
      forbidden.has(p) ||
      p.length > 128 ||
      /\p{Cc}/u.test(p) ||
      /[\uD800-\uDFFF]/u.test(p)
    )
      fail("JSON_PROFILE", "Unsupported pointer key");
  if (parts.length > LIMITS.depth) fail("RESOURCE_LIMIT", "Pointer too deep");
  return parts;
}
const escapePart = (s) => s.replaceAll("~", "~0").replaceAll("/", "~1");
function index(token, length, add = false) {
  if (token === "-" && add) return length;
  if (!/^(?:0|[1-9]\d*)$(?![\s\S])/.test(token))
    fail("PATCH_FAILED", "Invalid array index");
  let i = Number(token);
  if (!Number.isSafeInteger(i) || i < 0 || i > (add ? length : length - 1))
    fail("PATCH_FAILED", "Array index out of range");
  return i;
}
function atParts(root, parts) {
  let v = root;
  for (const part of parts) {
    if (Array.isArray(v)) {
      v = v[index(part, v.length)];
    } else if (object(v) && own(v, part)) v = v[part];
    else fail("PATCH_FAILED", "Pointer does not resolve");
  }
  return v;
}
export function resolve(root, path) {
  return atParts(root, pointer(path));
}
export function exists(root, path) {
  try {
    return { exists: true, value: resolve(root, path) };
  } catch (e) {
    if (e.code === "PATCH_FAILED") return { exists: false };
    throw e;
  }
}
export function validateOps(ops) {
  // Descriptor-first validation precedes reading operation members or array entries.
  validateJSON(ops, {
    maxBytes: LIMITS.projectBytes,
    maxNodes: 120000,
    maxDepth: LIMITS.depth + 2,
  });
  if (!Array.isArray(ops) || ops.length > LIMITS.ops)
    fail("INVALID_PROJECT", "Up to 64 operations per transition");
  for (const op of ops) {
    if (
      !object(op) ||
      !["add", "remove", "replace", "move", "copy", "test"].includes(op.op) ||
      !own(op, "path")
    )
      fail("INVALID_PROJECT", "Invalid RFC6902 operation");
    pointer(op.path);
    if (["add", "replace", "test"].includes(op.op)) {
      if (!own(op, "value"))
        fail("INVALID_PROJECT", "Operation value required");
      validateJSON(op.value);
    }
    if (["move", "copy"].includes(op.op)) {
      if (!own(op, "from")) fail("INVALID_PROJECT", "Operation from required");
      pointer(op.from);
    } // RFC6902 extra operation members are ignored, but still bounded JSON.
    validateJSON(op, {
      maxBytes: LIMITS.projectBytes,
      maxNodes: LIMITS.nodes + 16,
      maxDepth: LIMITS.depth + 1,
    });
  }
  return ops;
}
const preview = (v) => {
  let s = JSON.stringify(v);
  return { beforePreview: s.slice(0, 1000), beforeTruncated: s.length > 1000 };
};
export function applyPatch(
  input,
  ops,
  { budget = { remaining: LIMITS.work } } = {},
) {
  validateJSON(input);
  validateOps(ops);
  let root = clone(input),
    warnings = [],
    trace = [];
  function destination(path, mode) {
    let parts = pointer(path);
    if (!parts.length) return { root: true };
    let parent = atParts(root, parts.slice(0, -1)),
      token = parts.at(-1);
    if (Array.isArray(parent))
      return {
        parent,
        key: index(token, parent.length, mode === "add"),
        array: true,
      };
    if (!object(parent))
      fail("PATCH_FAILED", "Destination parent is not a container");
    if (mode !== "add" && !own(parent, token))
      fail("PATCH_FAILED", "Destination does not exist");
    return { parent, key: token, array: false };
  }
  function remove(path) {
    let d = destination(path, "remove");
    if (d.root)
      fail(
        "PATCH_FAILED",
        "Removing the document root is outside the portable profile",
      );
    let old = d.parent[d.key];
    if (d.array) d.parent.splice(d.key, 1);
    else delete d.parent[d.key];
    return old;
  }
  function write(path, value, mode, operation) {
    let d = destination(path, mode);
    if (d.root) {
      warnings.push({ kind: "overwrite", operation, path, ...preview(root) });
      root = clone(value);
      return;
    }
    if ((!d.array && own(d.parent, d.key)) || (d.array && mode === "replace"))
      warnings.push({
        kind: "overwrite",
        operation,
        path,
        ...preview(d.parent[d.key]),
      });
    if (d.array && mode === "add") d.parent.splice(d.key, 0, clone(value));
    else d.parent[d.key] = clone(value);
  }
  try {
    validateJSON(root, { budget });
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.op === "test") {
        if (!equal(resolve(root, op.path), op.value))
          fail("PATCH_FAILED", "Test operation did not match");
      } else if (op.op === "remove") remove(op.path);
      else if (op.op === "add" || op.op === "replace")
        write(op.path, op.value, op.op, i);
      else {
        let from = pointer(op.from),
          to = pointer(op.path),
          value = clone(atParts(root, from));
        if (op.op === "move") {
          if (from.length < to.length && from.every((p, j) => p === to[j]))
            fail("PATCH_FAILED", "Cannot move a value into its descendant");
          if (op.from !== op.path) {
            remove(op.from);
            write(op.path, value, "add", i);
          }
        } else write(op.path, value, "add", i);
      }
      validateJSON(root, { budget });
      trace.push({ operation: i, op: op.op, path: op.path });
    }
    return { ok: true, value: root, warnings, trace };
  } catch (e) {
    if (e instanceof StateError)
      return {
        ok: false,
        error: { code: e.code, message: e.message, operation: trace.length },
        warnings,
        trace,
      };
    throw e;
  }
}
export function validateProject(p) {
  validateJSON(p, {
    maxBytes: LIMITS.projectBytes,
    maxNodes: 120000,
    maxDepth: 28,
  });
  keys(p, ["schema", "name", "versions", "transitions", "fixtures"]);
  if (p.schema !== "statecarry/v1")
    fail("INVALID_PROJECT", "Unsupported project schema");
  text(p.name);
  if (
    !Array.isArray(p.versions) ||
    !p.versions.length ||
    p.versions.length > 16 ||
    p.versions.some(
      (v, i) =>
        !Number.isSafeInteger(v) ||
        v < 0 ||
        v > 1000000 ||
        (i && v !== p.versions[i - 1] + 1),
    )
  )
    fail("INVALID_PROJECT", "Use 1–16 consecutive integer versions");
  if (
    !Array.isArray(p.transitions) ||
    p.transitions.length !== p.versions.length - 1
  )
    fail("INVALID_PROJECT", "Exactly one adjacent transition per version");
  p.transitions.forEach((s, i) => {
    keys(s, ["from", "to", "ops"]);
    if (s.from !== p.versions[i] || s.to !== p.versions[i + 1])
      fail("INVALID_PROJECT", "Transition chain has a gap or wrong order");
    validateOps(s.ops);
  });
  if (!Array.isArray(p.fixtures) || p.fixtures.length > 50)
    fail("INVALID_PROJECT", "Up to 50 fixtures");
  let ids = new Set();
  for (const f of p.fixtures) {
    keys(f, ["id", "name", "input", "expected", "contracts"]);
    id(f.id);
    if (ids.has(f.id)) fail("INVALID_PROJECT", "Duplicate fixture ID");
    ids.add(f.id);
    text(f.name);
    validateEnvelope(f.input);
    keys(
      f.expected,
      ["kind"],
      f.expected.kind === "value"
        ? ["value"]
        : f.expected.kind === "error"
          ? ["code"]
          : [],
    );
    if (f.expected.kind === "value") {
      if (!own(f.expected, "value"))
        fail("INVALID_PROJECT", "Independent expected output required");
      validateEnvelope(f.expected.value);
    } else if (f.expected.kind === "error") {
      if (
        !["PATCH_FAILED", "UNKNOWN_VERSION", "RESOURCE_LIMIT"].includes(
          f.expected.code,
        )
      )
        fail("INVALID_PROJECT", "Expected error code required");
    } else if (f.expected.kind !== "unasserted")
      fail("INVALID_PROJECT", "Expected kind: value, error or unasserted");
    if (!Array.isArray(f.contracts) || f.contracts.length > 256)
      fail("INVALID_PROJECT", "Up to 256 contracts");
    let paths = [];
    for (const c of f.contracts) {
      keys(
        c,
        ["kind", "source", "reason"],
        c.kind === "drop" ? [] : ["target"],
      );
      if (!["preserve", "change", "drop"].includes(c.kind))
        fail("INVALID_PROJECT", "Unknown contract kind");
      let source = pointer(c.source);
      if (c.kind !== "drop") pointer(c.target);
      text(c.reason, 500, c.kind !== "preserve");
      if (
        paths.some((p) => {
          let a = pointer(p);
          return (
            (a.slice(0, source.length).every((x, i) => x === source[i]) &&
              a.length >= source.length) ||
            (source.slice(0, a.length).every((x, i) => x === a[i]) &&
              source.length >= a.length)
          );
        })
      )
        fail("INVALID_PROJECT", "Contract source subtrees must not overlap");
      paths.push(c.source);
    }
  }
  if (size(JSON.stringify(p)) > LIMITS.projectBytes)
    fail("RESOURCE_LIMIT", "Project exceeds 4 MiB");
  return p;
}
export function validateEnvelope(e) {
  // Validate descriptors/prototypes on the envelope before reading version/payload.
  validateJSON(e, {
    maxBytes: LIMITS.payloadBytes + 128,
    maxNodes: LIMITS.nodes + 3,
    maxDepth: LIMITS.depth + 1,
  });
  keys(e, ["version", "payload"]);
  if (!Number.isSafeInteger(e.version) || e.version < 0 || e.version > 1000000)
    fail("INVALID_PROJECT", "Envelope version must be 0–1000000");
  validateJSON(e.payload);
  return e;
}
export function migrate(plan, envelope) {
  validateEnvelope(envelope);
  const versions = plan.versions;
  if (!Array.isArray(versions) || !versions.includes(envelope.version))
    return {
      ok: false,
      error: {
        code: "UNKNOWN_VERSION",
        message: "Version is outside the explicit chain",
      },
      steps: [],
      warnings: [],
    };
  let payload = clone(envelope.payload),
    steps = [],
    warnings = [],
    version = envelope.version,
    budget = { remaining: LIMITS.work };
  for (let i = versions.indexOf(version); i < versions.length - 1; i++) {
    const transition = plan.transitions[i];
    if (
      !transition ||
      transition.from !== version ||
      transition.to !== versions[i + 1]
    )
      return {
        ok: false,
        error: {
          code: "UNKNOWN_VERSION",
          message: "Missing adjacent migration",
        },
        steps,
        warnings,
      };
    let result = applyPatch(payload, transition.ops, { budget });
    warnings.push(
      ...result.warnings.map((w) => ({
        ...w,
        from: version,
        to: transition.to,
      })),
    );
    steps.push({
      from: version,
      to: transition.to,
      ok: result.ok,
      operations: result.trace.length,
      beforePreview: JSON.stringify(payload).slice(0, 2000),
      afterPreview: result.ok
        ? JSON.stringify(result.value).slice(0, 2000)
        : null,
      previewLimit: 2000,
    });
    if (!result.ok)
      return {
        ok: false,
        error: { ...result.error, from: version, to: transition.to },
        steps,
        warnings,
      };
    payload = result.value;
    version = transition.to;
  }
  return { ok: true, value: { version, payload }, steps, warnings };
}
function spendReport(budget, value) {
  budget.remaining -= size(JSON.stringify(value)) + 128;
  if (budget.remaining < 0)
    fail(
      "RESOURCE_LIMIT",
      "Aggregate report/accounting budget of 8 MiB exceeded; no partial report returned",
    );
}
function visitLeaves(value, path, visit) {
  if (
    value === null ||
    typeof value !== "object" ||
    Object.keys(value).length === 0
  ) {
    visit({ path, value: clone(value) });
    return;
  }
  for (const key of Object.keys(value))
    visitLeaves(value[key], path + "/" + escapePart(key), visit);
}
export function leaves(value, path = "") {
  validateJSON(value);
  const budget = { remaining: LIMITS.reportBytes },
    result = [];
  visitLeaves(value, path, (leaf) => {
    spendReport(budget, leaf);
    result.push(leaf);
  });
  return result;
}
function contains(source, path) {
  return source === "" || source === path || path.startsWith(source + "/");
}
export function reviewContracts(
  input,
  output,
  contracts,
  expected,
  reportBudget = { remaining: LIMITS.reportBytes },
) {
  const checks = contracts.map((c) => {
    const before = exists(input, c.source),
      after = exists(output, c.kind === "drop" ? c.source : c.target),
      reference =
        expected === undefined
          ? { exists: false }
          : exists(expected, c.kind === "drop" ? c.source : c.target);
    const ok =
      before.exists &&
      (c.kind === "preserve"
        ? after.exists && equal(before.value, after.value)
        : c.kind === "drop"
          ? !after.exists
          : after.exists &&
            reference.exists &&
            equal(after.value, reference.value));
    const check = {
      ...c,
      ok,
      detail: !before.exists
        ? "Missing original source"
        : c.kind === "preserve"
          ? "Explicit old/new equality"
          : c.kind === "drop"
            ? "Original path must be absent in output"
            : "Target must match independent expected output",
    };
    spendReport(reportBudget, check);
    return check;
  });
  const accounting = [];
  visitLeaves(input, "", (leaf) => {
    const contract = checks.find((c) => contains(c.source, leaf.path));
    let entry;
    if (contract)
      entry = {
        ...leaf,
        status: contract.ok
          ? contract.kind === "preserve"
            ? "preserved"
            : contract.kind === "drop"
              ? "intentional-drop"
              : "intentional-change"
          : "contract-failed",
        contractSource: contract.source,
      };
    else {
      // Generated paths retain valid long key segments without widening external pointers.
      const parts =
        leaf.path === ""
          ? []
          : leaf.path
              .slice(1)
              .split("/")
              .map((k) => k.replaceAll("~1", "/").replaceAll("~0", "~"));
      let after;
      try {
        after = { exists: true, value: atParts(output, parts) };
      } catch (error) {
        if (error.code !== "PATCH_FAILED") throw error;
        after = { exists: false };
      }
      entry = {
        ...leaf,
        status:
          after.exists && equal(leaf.value, after.value)
            ? "same-path-equal"
            : "unreviewed",
      };
    }
    // Charge each completed entry before retaining it, never materialize an unbounded leaves array.
    spendReport(reportBudget, entry);
    accounting.push(entry);
  });
  return {
    ok:
      checks.every((c) => c.ok) &&
      accounting.every(
        (a) => !["unreviewed", "contract-failed"].includes(a.status),
      ),
    checks,
    accounting,
    unreviewed: accounting.filter((a) =>
      ["unreviewed", "contract-failed"].includes(a.status),
    ).length,
  };
}
export function verifyFixture(
  plan,
  fixture,
  reportBudget = { remaining: LIMITS.reportBytes },
) {
  const migration = migrate(plan, fixture.input);
  spendReport(reportBudget, migration);
  const expectation =
    fixture.expected.kind === "unasserted"
      ? "unasserted"
      : fixture.expected.kind === "error"
        ? !migration.ok && migration.error.code === fixture.expected.code
          ? "pass"
          : "mismatch"
        : migration.ok && equal(migration.value, fixture.expected.value)
          ? "pass"
          : "mismatch";
  const contract = migration.ok
    ? reviewContracts(
        fixture.input.payload,
        migration.value.payload,
        fixture.contracts,
        fixture.expected.kind === "value"
          ? fixture.expected.value.payload
          : undefined,
        reportBudget,
      )
    : null;
  const metadata = {
    id: fixture.id,
    name: fixture.name,
    ok:
      expectation === "pass" &&
      (migration.ok ? contract.ok : fixture.expected.kind === "error"),
    expectation,
    execution: migration.ok ? "applied" : "error",
    contractStatus: contract ? (contract.ok ? "pass" : "failed") : "not-run",
  };
  spendReport(reportBudget, metadata);
  return { ...metadata, migration, contract };
}
export function runProject(p) {
  validateProject(p);
  const reportBudget = { remaining: LIMITS.reportBytes },
    results = [];
  for (const fixture of p.fixtures)
    results.push(verifyFixture(p, fixture, reportBudget));
  const report = {
    schema: "statecarry-report/v1",
    name: p.name,
    ok: results.length > 0 && results.every((r) => r.ok),
    results,
    summary: {
      fixtures: results.length,
      passed: results.filter((r) => r.ok).length,
      expectedMatched: results.filter((r) => r.expectation === "pass").length,
      contractsPassed: results.filter((r) => r.contractStatus === "pass")
        .length,
      overwrites: results.reduce((a, r) => a + r.migration.warnings.length, 0),
    },
  };
  if (size(JSON.stringify(report)) > LIMITS.reportBytes)
    fail(
      "RESOURCE_LIMIT",
      "Complete report exceeds 8 MiB; no partial report returned",
    );
  return report;
}
export function serializeProject(p) {
  validateProject(p);
  let pretty = JSON.stringify(p, null, 2);
  return size(pretty) <= LIMITS.projectBytes ? pretty : JSON.stringify(p);
}
export function parseProject(text) {
  return validateProject(parseJSON(text));
}
