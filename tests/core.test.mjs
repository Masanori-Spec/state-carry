import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  applyPatch,
  clone,
  equal,
  pointer,
  resolve,
  exists,
  validateJSON,
  parseJSON,
  decodeUTF8,
  validateProject,
  serializeProject,
  parseProject,
  migrate,
  leaves,
  reviewContracts,
  runProject,
  LIMITS,
} from "../src/core.mjs";
import { example } from "../src/example.mjs";
import {
  moduleSource,
  fixtureSource,
  RUNNER_SOURCE,
  reportHTML,
} from "../src/export.mjs";
for (const file of ["tests", "spec_tests"]) {
  const corpus = JSON.parse(
    await readFile(`tests/vendor/${file}.json`, "utf8"),
  );
  for (const [index, c] of corpus.entries())
    test(
      `RFC corpus ${file}/${index}: ${c.comment ?? "unnamed"}`,
      { skip: c.disabled ? "Disabled by upstream" : false },
      () => {
        let before = JSON.stringify(c.doc),
          r;
        try {
          r = applyPatch(c.doc, c.patch);
        } catch (e) {
          r = { ok: false, error: e.message };
        }
        assert.equal(JSON.stringify(c.doc), before, "Original mutated");
        if (c.error) assert.equal(r.ok, false);
        else {
          assert.equal(r.ok, true, JSON.stringify(r));
          assert.ok(equal(r.value, c.expected));
        }
      },
    );
}
test("guarded example fixes overwrite expectation while retaining independent fixture data", () => {
  const bad = example(),
    good = example(true);
  assert.deepEqual(bad.fixtures, good.fixtures);
  assert.equal(runProject(bad).summary.passed, 2);
  assert.equal(runProject(good).summary.passed, 3);
  assert.equal(runProject(good).results[1].contractStatus, "not-run");
});
test("empty containers count as leaves; unrelated equal values never imply move", () => {
  assert.deepEqual(leaves({ a: {}, b: [], c: null }), [
    { path: "/a", value: {} },
    { path: "/b", value: [] },
    { path: "/c", value: null },
  ]);
  let r = reviewContracts({ old: 7 }, { unrelated: 7 }, [], { unrelated: 7 });
  assert.equal(r.ok, false);
  assert.equal(r.accounting[0].status, "unreviewed");
});
test("explicit preserve mapping succeeds and wrong target fails", () => {
  let before = { a: { x: 7 }, empty: [] },
    after = { b: { x: 7 }, empty: [] },
    contracts = [{ kind: "preserve", source: "/a", target: "/b", reason: "" }];
  assert.equal(reviewContracts(before, after, contracts, after).ok, true);
  contracts[0].target = "/empty";
  assert.equal(reviewContracts(before, after, contracts, after).ok, false);
});
test("change needs independent expected target; declaration alone is not a pass", () => {
  let c = [
    { kind: "change", source: "/a", target: "/b", reason: "new meaning" },
  ];
  assert.equal(reviewContracts({ a: 1 }, { b: 2 }, c, { b: 2 }).ok, true);
  assert.equal(reviewContracts({ a: 1 }, { b: 3 }, c, { b: 2 }).ok, false);
  assert.equal(reviewContracts({ a: 1 }, { b: 2 }, c, undefined).ok, false);
});
test("drop requires absence; array indices remain positional", () => {
  let c = [{ kind: "drop", source: "/items/0", reason: "remove obsolete" }];
  assert.equal(
    reviewContracts({ items: [1, 2] }, { items: [2] }, c, { items: [2] }).ok,
    false,
  );
  assert.equal(
    reviewContracts(
      { a: 1 },
      {},
      [{ kind: "drop", source: "/a", reason: "obsolete" }],
      {},
    ).ok,
    true,
  );
});
test("a missing original contract source cannot pass vacuously", () =>
  assert.equal(
    reviewContracts(
      {},
      { x: 1 },
      [{ kind: "preserve", source: "/missing", target: "/x", reason: "" }],
      { x: 1 },
    ).ok,
    false,
  ));
test("overlapping source contracts and empty intent reasons reject", () => {
  let p = example();
  p.fixtures[0].contracts.push({
    kind: "preserve",
    source: "",
    target: "",
    reason: "",
  });
  assert.throws(() => validateProject(p), /overlap/);
  p = example();
  p.fixtures[0].contracts[1].reason = "";
  assert.throws(() => validateProject(p));
});
test("failures are atomic within patch and across version transitions", () => {
  let input = { a: 1 };
  let r = applyPatch(input, [
    { op: "replace", path: "/a", value: 2 },
    { op: "test", path: "/a", value: 1 },
  ]);
  assert.equal(r.ok, false);
  assert.equal(Object.hasOwn(r, "value"), false);
  assert.deepEqual(input, { a: 1 });
  let p = example(true);
  p.transitions[1].ops.push({ op: "remove", path: "/missing" });
  let original = clone(p.fixtures[0].input);
  r = migrate(p, p.fixtures[0].input);
  assert.equal(r.ok, false);
  assert.equal(Object.hasOwn(r, "value"), false);
  assert.deepEqual(p.fixtures[0].input, original);
});
test("destination overwrites are visible even when values match", () => {
  for (const op of [
    { op: "add", path: "/x", value: 1 },
    { op: "copy", from: "/y", path: "/x" },
    { op: "move", from: "/y", path: "/x" },
    { op: "replace", path: "/x", value: 1 },
  ]) {
    let r = applyPatch({ x: 1, y: 1 }, [op]);
    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].beforePreview, "1");
  }
  assert.equal(
    applyPatch([1], [{ op: "replace", path: "/0", value: 1 }]).warnings.length,
    1,
  );
  assert.equal(
    applyPatch([1], [{ op: "add", path: "/0", value: 1 }]).warnings.length,
    0,
  );
});
test("overwrite and step previews are explicitly bounded", () => {
  let r = applyPatch({ x: "x".repeat(3000) }, [
    { op: "replace", path: "/x", value: 2 },
  ]);
  assert.equal(r.warnings[0].beforePreview.length, 1000);
  assert.equal(r.warnings[0].beforeTruncated, true);
});
test("current version is cloned without modification; unknown version explicit", () => {
  let p = example(true),
    input = { version: 3, payload: { same: { value: 3 } } };
  let r = migrate(p, input);
  assert.deepEqual(r.value, input);
  assert.notEqual(r.value, input);
  r.value.payload.same.value = 4;
  assert.equal(input.payload.same.value, 3);
  assert.equal(
    migrate(p, { version: 4, payload: {} }).error.code,
    "UNKNOWN_VERSION",
  );
});
test("chain gaps and unsupported transitions fail explicitly", () => {
  let p = example();
  p.transitions.pop();
  assert.throws(() => validateProject(p), /adjacent/);
  assert.equal(migrate(p, p.fixtures[0].input).error.code, "UNKNOWN_VERSION");
  p = example();
  p.versions[2] = 4;
  assert.throws(() => validateProject(p));
});
test("expected outputs remain independent and unasserted never passes", () => {
  let p = example(true);
  p.fixtures[0].expected.value.payload.metadata.title = "WRONG";
  assert.equal(runProject(p).results[0].expectation, "mismatch");
  p.fixtures[0].expected = { kind: "unasserted" };
  assert.equal(runProject(p).results[0].ok, false);
  p.fixtures = [];
  assert.equal(runProject(p).ok, false);
});
test("JSON roundtrip does not regenerate expected errors or preserve mappings", () => {
  const p = example(true);
  assert.deepEqual(
    JSON.parse(serializeProject(parseProject(serializeProject(p)))),
    p,
  );
});
test("strict JSON rejects duplicate keys, rounded decimal tokens, unsafe numbers and invalid Unicode", () => {
  for (const source of [
    '{"x":1,"x":2}',
    "9007199254740992",
    "0.1000000000000000000001",
    "-0",
    "1e999",
    "[1,]",
  ])
    assert.throws(() => parseJSON(source));
  assert.equal(parseJSON("1.00"), 1);
  assert.equal(parseJSON("1e-30"), 1e-30);
  assert.throws(() => validateJSON(parseJSON('"\\ud800"')));
  assert.throws(() => parseJSON(" ".repeat(LIMITS.projectBytes + 1)));
});
test("malformed UTF8 is rejected without replacement", () => {
  assert.throws(() => decodeUTF8(Uint8Array.of(255)));
  assert.equal(decodeUTF8(new TextEncoder().encode("日本語")), "日本語");
});
test("prototype-sensitive keys and pointers reject without side effects", () => {
  for (let k of ["__proto__", "constructor", "prototype"]) {
    assert.throws(() => validateJSON(JSON.parse(`{"${k}":1}`)));
    assert.throws(() => pointer("/" + k));
  }
  assert.equal({}.polluted, undefined);
  assert.deepEqual(
    applyPatch({ toString: 1 }, [
      { op: "replace", path: "/toString", value: 2 },
    ]).value,
    { toString: 2 },
  );
  assert.equal(
    applyPatch({}, [{ op: "test", path: "/toString", value: null }]).ok,
    false,
  );
});
test("sparse/extra arrays, cycles, getters and non-JSON values reject", () => {
  let a = Array(1);
  assert.throws(() => validateJSON(a));
  a = [1];
  a.extra = 2;
  assert.throws(() => validateJSON(a));
  let c = {};
  c.c = c;
  assert.throws(() => validateJSON(c));
  for (let v of [undefined, NaN, Infinity, -0, new Date(), { a: undefined }])
    assert.throws(() => validateJSON(v));
  assert.throws(
    () =>
      validateJSON({
        get a() {
          throw Error("must not run");
        },
      }),
    /Data properties/,
  );
});
test("depth, payload size, operation count and project caps are bounded", () => {
  let deep = 0;
  for (let i = 0; i < 21; i++) deep = { x: deep };
  assert.throws(() => validateJSON(deep));
  assert.throws(() =>
    applyPatch(
      {},
      Array.from({ length: 65 }, () => ({ op: "add", path: "/a", value: 1 })),
    ),
  );
  let p = example();
  p.fixtures = Array.from({ length: 51 }, (_, i) => ({
    ...clone(p.fixtures[0]),
    id: "f" + i,
  }));
  assert.throws(() => validateProject(p));
  let versions = example();
  versions.versions = Array.from({ length: 17 }, (_, i) => i);
  assert.throws(() => validateProject(versions));
});
test("resource failure returns no partial output", () => {
  let r = applyPatch({ a: 1 }, [{ op: "replace", path: "/a", value: 2 }], {
    budget: { remaining: 3 },
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "RESOURCE_LIMIT");
  assert.equal(Object.hasOwn(r, "value"), false);
});
test("root replacement and escaped empty keys are supported; root removal is explicit profile boundary", () => {
  assert.deepEqual(
    applyPatch({ a: 1 }, [{ op: "replace", path: "", value: [2] }]).value,
    [2],
  );
  assert.equal(resolve({ "": { "a/b": { "~": 4 } } }, "//a~1b/~0"), 4);
  assert.equal(applyPatch({ a: 1 }, [{ op: "remove", path: "" }]).ok, false);
});
test("array moves use post-removal destination, copy has independent structure", () => {
  assert.deepEqual(
    applyPatch(["a", "b", "c", "d"], [{ op: "move", from: "/1", path: "/3" }])
      .value,
    ["a", "c", "d", "b"],
  );
  let r = applyPatch({ a: { x: 1 } }, [
    { op: "copy", from: "/a", path: "/b" },
    { op: "replace", path: "/b/x", value: 2 },
  ]);
  assert.deepEqual(r.value, { a: { x: 1 }, b: { x: 2 } });
});
test("boolean numeric comparison is typed; object order ignored, array order retained", () => {
  assert.equal(equal(true, 1), false);
  assert.equal(equal({ x: 1, y: 2 }, { y: 2, x: 1 }), true);
  assert.equal(equal([1, 2], [2, 1]), false);
  assert.equal(
    applyPatch({ x: true }, [{ op: "test", path: "/x", value: 1 }]).ok,
    false,
  );
});
test("HTML report escapes hostile text and contains independent expected results", () => {
  let p = example();
  p.name = '<img onerror="evil">';
  p.fixtures[0].input.payload.title = "<script>alert(1)</script>";
  let h = reportHTML(p);
  assert.ok(!h.includes("<script>"));
  assert.ok(!h.includes("<img onerror"));
  assert.ok(h.includes("&lt;img"));
  assert.ok(h.includes("Independent expectation"));
});
test("generated module is same engine, runs independently, and runner has correct exit codes", async () => {
  const source = await readFile("src/core.mjs", "utf8"),
    bundle = await import("../src/runtime-source.mjs");
  assert.equal(bundle.CORE_SOURCE, source);
  assert.ok(bundle.WORKER_SOURCE.startsWith(source));
  assert.equal(/^import\s/m.test(bundle.WORKER_SOURCE), false);
  const dir = await mkdtemp(join(tmpdir(), "statecarry-export-"));
  try {
    for (const safe of [false, true]) {
      let p = example(safe);
      await writeFile(
        join(dir, "statecarry-migration.mjs"),
        moduleSource(p, source),
      );
      await writeFile(join(dir, "statecarry-fixtures.json"), fixtureSource(p));
      await writeFile(join(dir, "statecarry-run.mjs"), RUNNER_SOURCE);
      let r = spawnSync(process.execPath, ["statecarry-run.mjs"], {
        cwd: dir,
        encoding: "utf8",
      });
      assert.equal(r.status, safe ? 0 : 1, r.stderr);
      assert.deepEqual(JSON.parse(r.stdout), runProject(p));
    }
    const module = await import(
      pathToFileURL(join(dir, "statecarry-migration.mjs")).href
    );
    assert.equal(Object.isFrozen(module.PLAN.transitions[0].ops), true);
    let input = example(true).fixtures[0].input,
      before = clone(input);
    assert.deepEqual(module.migrateSaved(input), migrate(example(true), input));
    assert.deepEqual(input, before);
    await writeFile(
      join(dir, "statecarry-fixtures.json"),
      '{"schema":"wrong"}',
    );
    assert.equal(
      spawnSync(process.execPath, ["statecarry-run.mjs"], { cwd: dir }).status,
      2,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("generated runtime imports stay inside root and nested deployment paths", async () => {
  for (const base of [
    "https://example.invalid/",
    "https://example.invalid/state-carry/",
  ])
    for (const file of [
      "app.mjs",
      "worker.mjs",
      "src/example.mjs",
      "src/export.mjs",
    ]) {
      let source = await readFile("dist/" + file, "utf8");
      if (file === "src/export.mjs")
        source = source.slice(0, source.indexOf("export const RUNNER_SOURCE"));
      for (const m of source.matchAll(
        /^import[\s\S]*?\bfrom\s+["']([^"']+)["']/gm,
      )) {
        let url = new URL(m[1], new URL(file, base));
        assert.ok(url.href.startsWith(base));
        await readFile("dist/" + url.href.slice(base.length));
      }
    }
});

test("exhausted work budget before an operation returns structured failure", () => {
  const input = { a: 1 };
  const r = applyPatch(input, [], { budget: { remaining: 0 } });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "RESOURCE_LIMIT");
  assert.equal(Object.hasOwn(r, "value"), false);
  assert.deepEqual(input, { a: 1 });
});
test("non-enumerable and accessor array data cannot be silently lost or evaluated", () => {
  let hidden = { x: 1 };
  Object.defineProperty(hidden, "kept", { value: 2, enumerable: false });
  assert.throws(() => validateJSON(hidden), /Enumerable/);
  let array = [1];
  Object.defineProperty(array, "0", {
    get() {
      throw Error("must not evaluate");
    },
    enumerable: true,
  });
  assert.throws(() => validateJSON(array), /Data array/);
  let symbol = { a: 1 };
  symbol[Symbol("hidden")] = 2;
  assert.throws(() => validateJSON(symbol));
});
test("reserved schemas, sparse version chains, and duplicate fixtures reject", () => {
  let p = example();
  p.schema = "future";
  assert.throws(() => validateProject(p));
  p = example();
  delete p.versions[0];
  assert.throws(() => validateProject(p), /Dense/);
  p = example();
  p.fixtures.push(clone(p.fixtures[0]));
  assert.throws(() => validateProject(p), /Duplicate/);
});
test("missing and null stay different in pointer and preservation checks", () => {
  assert.deepEqual(exists({ a: null }, "/a"), { exists: true, value: null });
  assert.deepEqual(exists({}, "/a"), { exists: false });
  assert.equal(
    reviewContracts(
      { a: null },
      {},
      [{ kind: "preserve", source: "/a", target: "/a", reason: "" }],
      {},
    ).ok,
    false,
  );
});
test("unknown version can be an independent expected failure", () => {
  let p = example(true);
  p.fixtures = [
    {
      id: "future",
      name: "Unknown version",
      input: { version: 99, payload: {} },
      expected: { kind: "error", code: "UNKNOWN_VERSION" },
      contracts: [],
    },
  ];
  let r = runProject(p);
  assert.equal(r.ok, true);
  assert.equal(r.results[0].contractStatus, "not-run");
});
