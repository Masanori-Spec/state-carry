import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { applyPatch, equal, reviewContracts, clone } from "../src/core.mjs";
const seed = 0x53434152;
let state = seed;
function rand(n) {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) % n;
}
const patches = [],
  contracts = [];
for (let i = 0; i < 1200; i++) {
  let doc = {
      a: rand(20),
      b: { x: rand(20) },
      items: Array.from({ length: 1 + rand(5) }, () => rand(20)),
      empty: {},
    },
    patch = [];
  let variants = [
    () => ({ op: "add", path: "/a", value: rand(20) }),
    () => ({ op: "replace", path: "/b/x", value: rand(20) }),
    () => ({ op: "move", from: "/a", path: "/c" }),
    () => ({ op: "copy", from: "/b", path: "/d" }),
    () => ({ op: "add", path: "/items/-", value: rand(20) }),
    () => ({ op: "remove", path: "/items/0" }),
    () => ({ op: "test", path: "/a", value: rand(20) }),
    () => ({ op: "remove", path: "/missing" }),
    () => ({ op: "move", from: "/items/0", path: "/items/-" }),
    () => ({ op: "replace", path: "", value: { changed: rand(20) } }),
  ];
  for (let j = 0, n = 1 + rand(6); j < n; j++)
    patch.push(variants[rand(variants.length)]());
  patches.push({ doc, patch });
}
for (let i = 0; i < 1000; i++) {
  let old = {
      a: rand(9),
      b: { value: rand(9) },
      empty: [],
      items: [rand(9), rand(9)],
    },
    next = clone(old),
    rules = [],
    kind = rand(5);
  if (kind === 0) {
    next.renamed = next.a;
    delete next.a;
    rules = [
      { kind: "preserve", source: "/a", target: "/renamed", reason: "" },
    ];
  }
  if (kind === 1) {
    next.a++;
    rules = [{ kind: "change", source: "/a", target: "/a", reason: "intent" }];
  }
  if (kind === 2) {
    delete next.b;
    rules = [{ kind: "drop", source: "/b", reason: "obsolete" }];
  }
  if (kind === 3) {
    next.other = next.a;
    delete next.a;
  }
  if (kind === 4) {
    next.a++;
    rules = [{ kind: "preserve", source: "/a", target: "/a", reason: "" }];
  }
  let expected = clone(next);
  if (i % 7 === 0) expected.a = -1;
  contracts.push({ before: old, after: next, expected, contracts: rules });
}
const py = spawnSync(process.env.PYTHON ?? "python3", ["tests/oracle.py"], {
  input: JSON.stringify({ patches, contracts }),
  encoding: "utf8",
  maxBuffer: 40 * 1024 * 1024,
  timeout: 60000,
});
assert.equal(
  py.status,
  0,
  "Install pinned test dependencies in tests/requirements.txt. " + py.stderr,
);
const out = JSON.parse(py.stdout);
assert.equal(out.version, "1.33");
for (let i = 0; i < patches.length; i++) {
  let before = JSON.stringify(patches[i].doc),
    r = applyPatch(patches[i].doc, patches[i].patch);
  assert.equal(r.ok, out.patches[i].ok, "Patch " + i);
  if (r.ok) assert.ok(equal(r.value, out.patches[i].value), "Value " + i);
  assert.equal(JSON.stringify(patches[i].doc), before);
}
for (let i = 0; i < contracts.length; i++) {
  let c = contracts[i],
    r = reviewContracts(c.before, c.after, c.contracts, c.expected),
    got = {
      ok: r.ok,
      checks: r.checks.map((x) => x.ok),
      statuses: r.accounting.map((x) => x.status),
    };
  assert.deepEqual(got, out.contracts[i], "Contract " + i);
}
const evidence = {
  ok: true,
  seed,
  pythonJsonpatch: out.version,
  patchCases: patches.length,
  independentPointerContractCases: contracts.length,
};
await mkdir("tests/artifacts", { recursive: true });
await writeFile(
  "tests/artifacts/differential.json",
  JSON.stringify(evidence, null, 2),
);
console.log(JSON.stringify(evidence));
