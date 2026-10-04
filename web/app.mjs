import {
  parseJSON,
  parseProject,
  serializeProject,
  validateProject,
  validateOps,
  decodeUTF8,
  clone,
  LIMITS,
} from "../src/core.mjs";
import { example } from "../src/example.mjs";
import {
  moduleSource,
  fixtureSource,
  RUNNER_SOURCE,
  reportHTML,
} from "../src/export.mjs";
import { CORE_SOURCE, WORKER_SOURCE } from "../src/runtime-source.mjs";
const $ = (id) => document.getElementById(id),
  element = (tag, text, cls) => {
    let e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
let project = example(),
  lang = "ja",
  selectedStep = 0,
  selectedFixture = "collision",
  tab = "plan",
  history = [],
  dirty = new Set(),
  report = null,
  worker = null,
  workerURL = null,
  timer = null,
  generation = 0,
  importTicket = 0;
const choose = (ja, en) => (lang === "ja" ? ja : en),
  ja = {};
document
  .querySelectorAll("[data-t]")
  .forEach((e) => (ja[e.dataset.t] = e.innerText));
const en = {
  local: "Local processing · no storage connection",
  guideLink: "Field guide ↗",
  headline: "When formats change,\ncarry the important things.",
  lede: "Rehearse saved-project upgrades with independent expectations and preservation contracts. Separate “the migration ran” from “the values survived.”",
  riskExample: "Open the overwrite example",
  safeExample: "Add a guard ↗",
  heroNote: "What changes. What must not.",
  scope:
    "Tests operate on copies. No app storage, database connection or automatic user-file update. Passing fixtures do not prove that all data can survive.",
  session: "WORKSPACE / SESSION ONLY",
  undo: "Undo",
  import: "Open JSON",
  save: "Save ↓",
  run: "Verify all fixtures",
  cancelRun: "Cancel verification",
  planTab: "01 Migration plan",
  fixturesTab: "02 References & contracts",
  reviewTab: "03 Review & export",
  versionChain: "VERSION CHAIN / ADJACENT UPGRADES",
  addVersion: "+ Next version",
  chainHint:
    "Consecutive integer versions only. Test every supported starting version through the latest format.",
  guidedTitle: "Add an operation",
  operation: "Operation",
  path: "Destination pointer",
  from: "Source pointer",
  value: "JSON value",
  appendOperation: "Append operation",
  operationHint:
    "Add replaces an existing object key. Array positions shift after each operation. Test can guard against an unexpected input before it is changed.",
  patchJSON: "Patch JSON / edit the order too",
  applyPatch: "Apply patch",
  cancel: "Cancel",
  fixedExpectation:
    "Changing the plan never regenerates independent expected results or preservation contracts.",
  fixtureHeading: "Keep the reference outside the migration.",
  fixtureDescription:
    "Record the original data, independent expected result and preservation relationships separately.",
  addFixture: "+ Fixture",
  selectFixture: "Fixture",
  fixtureName: "Fixture name",
  originalJSON: "Original version and payload",
  expectedKind: "Expected result",
  expectedValue: "JSON output",
  expectedError: "Explicit error",
  unasserted: "Unasserted / exploratory",
  expectedJSON: "Independent expectation (JSON)",
  expectedHint:
    "Enter a value or obtain it from an independent reference. There is no “generate expected from actual” button.",
  applyFixture: "Save reference",
  contractHeading: "Preservation and change contracts",
  contractDescription:
    "Name the relationship between old and new values. Intentional changes and removals require a reason.",
  contractKind: "Contract",
  preserve: "Preserve / equal value",
  change: "Intentional change",
  drop: "Intentional removal",
  sourcePointer: "Old payload pointer",
  targetPointer: "New payload pointer",
  reason: "Reason",
  appendContract: "Append contract",
  contractsJSON: "Contract JSON",
  applyContracts: "Save contracts",
  contractHint:
    "Empty objects and arrays also count as original leaves. Array pointers describe positions. Equal values elsewhere never imply a move.",
  reviewHeading: "Did it run? Did it preserve?",
  reviewDescription:
    "Check operation completion, expected-result agreement and the preservation contract separately.",
  reviewEmpty: "Run verification to see a fresh result here.",
  fixture: "Fixture",
  execution: "Execution",
  expected: "Expected",
  contract: "Preservation",
  stepPreview: "Version-by-version results (bounded previews)",
  accounting: "Account for the original leaves",
  originalPath: "Original path",
  originalValue: "Original value",
  accountStatus: "Observation / contract status",
  exportModule: "Pure migration module",
  exportModuleSub: "The same tested engine",
  exportFixtures: "Independent fixtures",
  exportFixturesSub: "Inputs, expectations, contracts",
  exportRunner: "Repeatable Node runner",
  exportRunnerSub: "No external dependencies",
  exportReport: "Preservation review",
  exportReportSub: "Warnings and leaf accounting",
  runLocally: "Save all three files in one folder, then run",
  exitHint:
    "Exit 0: fixtures match / 1: mismatch or incomplete / 2: invalid input",
  reviewCaution:
    "Agreement covers only these fixtures and contracts. It does not guarantee every saved file, device, app integration or lossless upgrade. Test separate copies before using real data.",
  guideTitle: "Before changing the format,\nname what must remain.",
  g1t: "Keep expectations fixed",
  g1: "A migration output is not automatically the right answer. Save original data and expectations separately; editing the migration never rewrites them.",
  g2t: "Make preservation explicit",
  g2: "Preserve compares old and new values. Change checks the independent expected target. Drop requires the old path to be absent. Unreviewed original leaves block success.",
  g3t: "Fail on a copy",
  g3: "Operations run sequentially on a clone. A failure leaves the original input untouched and returns no partially migrated output.",
  g4t: "Bound the work",
  g4: "16 versions, 64 operations per transition, 50 fixtures, 4 MiB per project. No arbitrary JavaScript, storage or network connection.",
  footer:
    "Computation works offline after loading. Save JSON before reloading.",
  importTitle: "Open project JSON",
  importHint:
    "Invalid input leaves the current project unchanged. Up to4 MiB, UTF-8. Import makes prior results stale.",
  file: "File",
  paste: "Or paste JSON",
  load: "Load",
};
function status(s, error = false) {
  $("status").textContent = s;
  $("status").className = error ? "error" : "";
}
function stop() {
  if (workerURL) {
    URL.revokeObjectURL(workerURL);
    workerURL = null;
  }
  if (worker) {
    worker.terminate();
    worker = null;
  }
  clearTimeout(timer);
  $("cancel-run").hidden = true;
  $("run").disabled = false;
}
function stale() {
  generation++;
  stop();
  report = null;
  renderMetrics();
  renderResults();
  $("freshness").textContent = choose(
    "未検証 / 変更あり",
    "STALE / RERUN REQUIRED",
  );
  renderMetrics();
}
function mark(part) {
  dirty.add(part);
  stale();
}
function clean(except) {
  if ([...dirty].some((x) => x !== except))
    throw Error(
      choose(
        "編集中の内容を保存するか取り消してください。",
        "Apply or cancel the pending edits first.",
      ),
    );
}
function guard(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (e) {
      status(choose("変更されていません: ", "No change: ") + e.message, true);
    }
  };
}
function mutate(next, message) {
  validateProject(next);
  history.push(clone(project));
  if (history.length > 20) history.shift();
  project = next;
  dirty.clear();
  selectedStep = Math.min(selectedStep, project.transitions.length - 1);
  selectedFixture = project.fixtures.some((f) => f.id === selectedFixture)
    ? selectedFixture
    : project.fixtures[0]?.id;
  stale();
  render();
  status(message);
}
function activate(name) {
  clean();
  tab = name;
  for (const n of ["plan", "fixtures", "review"]) {
    $("tab-" + n).setAttribute("aria-selected", String(n === name));
    $("tab-" + n).tabIndex = n === name ? 0 : -1;
    $("panel-" + n).hidden = n !== name;
  }
}
for (const n of ["plan", "fixtures", "review"])
  $("tab-" + n).onclick = guard(() => activate(n));
document.querySelector(".tabs").onkeydown = guard((e) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
  e.preventDefault();
  let names = ["plan", "fixtures", "review"],
    i = names.indexOf(tab),
    n =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? 2
          : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
  activate(names[n]);
  $("tab-" + names[n]).focus();
});
$("language").onchange = guard(() => {
  if (dirty.size) {
    $("language").value = lang;
    clean();
  }
  lang = $("language").value;
  document.documentElement.lang = lang;
  document
    .querySelectorAll("[data-t]")
    .forEach(
      (e) =>
        (e.textContent =
          (lang === "ja" ? ja : en)[e.dataset.t] ?? ja[e.dataset.t]),
    );
  render();
});
function renderMetrics() {
  $("metrics").replaceChildren();
  let s = report?.summary,
    items = [
      [
        project.versions.length,
        choose("バージョン", "Versions"),
        "EXPLICIT CHAIN",
      ],
      [
        project.fixtures.length,
        choose("独立した基準", "Independent fixtures"),
        "SAVED REFERENCES",
      ],
      [
        s ? `${s.passed}/${s.fixtures}` : "—",
        choose("一致したフィクスチャ", "Passing fixtures"),
        "EXPECTED + CONTRACT",
      ],
      [
        s?.overwrites ?? "—",
        choose("上書きの警告", "Overwrite warnings"),
        "DESTINATIONS TO REVIEW",
      ],
    ];
  for (let i = 0; i < items.length; i++) {
    let [n, label, small] = items[i],
      d = element(
        "div",
        undefined,
        "metric" + (i === 3 && Number(n) > 0 ? " alert" : ""),
      ),
      t = element("span", label);
    t.append(element("small", small));
    d.append(t, element("strong", n));
    $("metrics").append(d);
  }
}
function render() {
  $("project-title").textContent = project.name;
  $("undo").disabled = !history.length;
  renderMetrics();
  renderPlan();
  renderFixture();
  renderResults();
  $("freshness").textContent = report
    ? choose("現行のプランで検証済み", "CURRENT PLAN VERIFIED")
    : choose("未検証 / 再実行が必要", "STALE / RERUN REQUIRED");
}
function renderPlan() {
  $("version-rail").replaceChildren();
  for (let i = 0; i < project.versions.length; i++) {
    let div = element("div", undefined, "version-item");
    div.append(
      element("span", "v" + project.versions[i], "version-node"),
      element(
        "small",
        i === project.versions.length - 1
          ? choose("最新", "Latest")
          : choose("入力版", "Input version"),
      ),
    );
    $("version-rail").append(div);
    if (i < project.transitions.length) {
      let s = project.transitions[i],
        b = element(
          "button",
          undefined,
          "step-button" + (i === selectedStep ? " selected" : ""),
        );
      b.append(
        element("strong", `${s.from} → ${s.to}`),
        element("span", `${s.ops.length} operations`),
      );
      b.onclick = guard(() => {
        clean();
        selectedStep = i;
        renderPlan();
      });
      $("version-rail").append(b);
    }
  }
  let s = project.transitions[selectedStep];
  $("step-title").textContent = s
    ? choose("移行 ", "Upgrade ") + `${s.from} → ${s.to}`
    : choose("最新バージョンのみ", "Current version only");
  $("patch-json").value = JSON.stringify(s?.ops ?? [], null, 2);
  $("patch-json").disabled = !s;
  $("apply-patch").disabled = !s;
  $("operation-form").hidden = !s;
  $("operation-list").replaceChildren();
  for (const [i, op] of (s?.ops ?? []).entries()) {
    let d = element("div", undefined, "op-card"),
      remove = element("button", "×");
    remove.setAttribute(
      "aria-label",
      choose("操作を削除 ", "Remove operation ") + i,
    );
    remove.onclick = guard(() => {
      clean();
      let next = clone(project);
      next.transitions[selectedStep].ops.splice(i, 1);
      mutate(
        next,
        choose(
          "操作を削除しました。期待値は保持されています。",
          "Operation removed; independent expectations are unchanged.",
        ),
      );
    });
    d.append(
      element("span", String(i + 1).padStart(2, "0")),
      element("b", op.op),
      element(
        "code",
        (op.from !== undefined ? op.from + " → " : "") +
          (op.path || "(root)") +
          (Object.hasOwn(op, "value")
            ? " = " + JSON.stringify(op.value).slice(0, 140)
            : ""),
      ),
      remove,
    );
    $("operation-list").append(d);
  }
  operationFields();
}
$("patch-json").oninput = () => mark("patch");
$("apply-patch").onclick = guard(() => {
  clean("patch");
  let ops = validateOps(parseJSON($("patch-json").value));
  let next = clone(project);
  next.transitions[selectedStep].ops = ops;
  mutate(
    next,
    choose(
      "パッチを更新しました。期待値は変更していません。",
      "Patch updated. Expected results are unchanged.",
    ),
  );
});
$("cancel-patch").onclick = () => {
  dirty.delete("patch");
  renderPlan();
  status(
    choose(
      "パッチの編集を取り消しました。再検証してください。",
      "Patch edits cancelled. Run verification again.",
    ),
  );
};
const of = $("operation-form");
function operationFields() {
  let op = of.elements.op.value;
  $("from-label").hidden = !["move", "copy"].includes(op);
  $("value-label").hidden = !["add", "replace", "test"].includes(op);
}
of.elements.op.onchange = operationFields;
of.onsubmit = guard((e) => {
  e.preventDefault();
  clean();
  let op = { op: of.elements.op.value, path: of.elements.path.value };
  if (["move", "copy"].includes(op.op)) op.from = of.elements.from.value;
  if (["add", "replace", "test"].includes(op.op))
    op.value = parseJSON(of.elements.value.value, LIMITS.payloadBytes);
  let next = clone(project);
  next.transitions[selectedStep].ops.push(op);
  mutate(
    next,
    choose(
      "操作を追加しました。実行順を確認してください。",
      "Operation appended. Review its order before running.",
    ),
  );
});
$("add-version").onclick = guard(() => {
  clean();
  let next = clone(project),
    last = next.versions.at(-1);
  next.versions.push(last + 1);
  next.transitions.push({ from: last, to: last + 1, ops: [] });
  validateProject(next);
  selectedStep = next.transitions.length - 1;
  mutate(
    next,
    choose(
      "バージョンを追加しました。独立した期待値は元のままです。",
      "Version added. Independent expected versions are unchanged.",
    ),
  );
});
function fixture() {
  return project.fixtures.find((f) => f.id === selectedFixture);
}
function renderFixture() {
  let f = fixture();
  $("fixture-select").replaceChildren(
    ...project.fixtures.map((x) => {
      let o = element("option", x.name);
      o.value = x.id;
      return o;
    }),
  );
  $("fixture-select").value = f?.id ?? "";
  for (const id of [
    "fixture-name",
    "input-json",
    "expected-kind",
    "expected-json",
    "contracts-json",
    "apply-fixture",
    "apply-contracts",
  ])
    $(id).disabled = !f;
  if (!f) {
    $("fixture-name").value = "";
    $("input-json").value = "";
    $("expected-json").value = "";
    $("contracts-json").value = "";
    return;
  }
  $("fixture-name").value = f.name;
  $("input-json").value = JSON.stringify(f.input, null, 2);
  $("expected-kind").value = f.expected.kind;
  $("expected-json").value = JSON.stringify(
    f.expected.kind === "value"
      ? f.expected.value
      : f.expected.kind === "error"
        ? { code: f.expected.code }
        : null,
    null,
    2,
  );
  $("expected-json").disabled = f.expected.kind === "unasserted";
  $("contracts-json").value = JSON.stringify(f.contracts, null, 2);
}
$("fixture-select").onchange = guard(() => {
  if (dirty.size) {
    $("fixture-select").value = selectedFixture;
    clean();
  }
  selectedFixture = $("fixture-select").value;
  renderFixture();
  renderResults();
});
for (const id of ["fixture-name", "input-json", "expected-json"])
  $(id).oninput = () => mark("fixture");
$("expected-kind").onchange = () => {
  mark("fixture");
  $("expected-json").disabled = $("expected-kind").value === "unasserted";
  $("expected-json").value =
    $("expected-kind").value === "error"
      ? '{"code":"PATCH_FAILED"}'
      : $("expected-kind").value === "unasserted"
        ? "null"
        : JSON.stringify(
            fixture().expected.kind === "value"
              ? fixture().expected.value
              : { version: project.versions.at(-1), payload: {} },
            null,
            2,
          );
};
$("apply-fixture").onclick = guard(() => {
  clean("fixture");
  let next = clone(project),
    f = next.fixtures.find((x) => x.id === selectedFixture);
  f.name = $("fixture-name").value;
  f.input = parseJSON($("input-json").value);
  let kind = $("expected-kind").value;
  f.expected =
    kind === "unasserted"
      ? { kind }
      : kind === "value"
        ? { kind, value: parseJSON($("expected-json").value) }
        : { kind, ...parseJSON($("expected-json").value) };
  mutate(
    next,
    choose("入力した基準を保存しました。", "Entered reference saved."),
  );
});
$("cancel-fixture").onclick = () => {
  dirty.delete("fixture");
  let contractDraft = $("contracts-json").value;
  renderFixture();
  if (dirty.has("contracts")) $("contracts-json").value = contractDraft;
  status(choose("基準の編集を取り消しました。", "Reference edits cancelled."));
};
$("add-fixture").onclick = guard(() => {
  clean();
  let next = clone(project),
    n = 1;
  while (next.fixtures.some((f) => f.id === "fixture" + n)) n++;
  let f = {
    id: "fixture" + n,
    name: "New fixture " + n,
    input: { version: next.versions[0], payload: {} },
    expected: { kind: "unasserted" },
    contracts: [],
  };
  next.fixtures.push(f);
  validateProject(next);
  selectedFixture = f.id;
  mutate(
    next,
    choose(
      "未検証のフィクスチャを追加しました。",
      "Unasserted exploratory fixture added.",
    ),
  );
});
$("contracts-json").oninput = () => mark("contracts");
$("apply-contracts").onclick = guard(() => {
  clean("contracts");
  let next = clone(project);
  next.fixtures.find((x) => x.id === selectedFixture).contracts = parseJSON(
    $("contracts-json").value,
  );
  mutate(
    next,
    choose(
      "保持と変更の契約を保存しました。",
      "Preservation and intent contracts saved.",
    ),
  );
});
$("cancel-contracts").onclick = () => {
  dirty.delete("contracts");
  $("contracts-json").value = JSON.stringify(
    fixture()?.contracts ?? [],
    null,
    2,
  );
  status(choose("契約の編集を取り消しました。", "Contract edits cancelled."));
};
const cf = $("contract-form");
cf.elements.kind.onchange = () => {
  cf.elements.target.disabled = cf.elements.kind.value === "drop";
};
cf.onsubmit = guard((e) => {
  e.preventDefault();
  clean();
  let c = {
    kind: cf.elements.kind.value,
    source: cf.elements.source.value,
    reason: cf.elements.reason.value,
  };
  if (c.kind !== "drop") c.target = cf.elements.target.value;
  let next = clone(project);
  next.fixtures.find((f) => f.id === selectedFixture).contracts.push(c);
  mutate(next, choose("契約を追加しました。", "Contract appended."));
});
function renderResults() {
  for (const id of [
    "export-module",
    "export-fixtures",
    "export-runner",
    "export-report",
  ])
    $(id).disabled = !report;
  $("review-empty").hidden = !!report;
  $("review-content").hidden = !report;
  if (!report) return;
  $("result-rows").replaceChildren();
  for (const r of report.results) {
    let tr = element(
        "tr",
        undefined,
        r.id === selectedFixture ? "selected" : "",
      ),
      td = element("td"),
      b = element("button", r.name);
    b.onclick = guard(() => {
      clean();
      selectedFixture = r.id;
      renderFixture();
      renderResults();
    });
    td.append(b);
    tr.append(td);
    for (const value of [r.execution, r.expectation, r.contractStatus]) {
      let d = element("td");
      d.append(element("span", value.toUpperCase(), "badge " + value));
      tr.append(d);
    }
    $("result-rows").append(tr);
  }
  let r =
    report.results.find((r) => r.id === selectedFixture) ?? report.results[0];
  if (!r) {
    $("review-content").hidden = true;
    $("review-empty").hidden = false;
    return;
  }
  let f = project.fixtures.find((f) => f.id === r.id);
  $("result-title").textContent = r.name;
  $("result-verdict").textContent = r.ok
    ? choose("この基準に一致", "FIXTURE PASSED")
    : choose("レビューが必要", "REVIEW REQUIRED");
  $("warnings").replaceChildren();
  if (r.migration.error)
    $("warnings").append(
      element("p", r.migration.error.code + ": " + r.migration.error.message),
    );
  for (const w of r.migration.warnings)
    $("warnings").append(
      element(
        "p",
        `${w.from} → ${w.to} / op ${w.operation + 1}: ${w.path || "(root)"} · ${choose("上書き前", "overwritten")} ${w.beforePreview}${w.beforeTruncated ? "…" : ""}`,
      ),
    );
  $("actual-output").textContent = JSON.stringify(
    r.migration.ok ? r.migration.value : r.migration.error,
    null,
    2,
  ).slice(0, 20000);
  $("expected-output").textContent = JSON.stringify(f.expected, null, 2).slice(
    0,
    20000,
  );
  $("step-previews").replaceChildren();
  for (const s of r.migration.steps) {
    $("step-previews").append(
      element("h4", `${s.from} → ${s.to} / ${s.ok ? "applied" : "error"}`),
      element(
        "pre",
        `BEFORE (max 2000 chars)\n${s.beforePreview}\n\nAFTER (max 2000 chars)\n${s.afterPreview ?? "(no partial output)"}`,
      ),
    );
  }
  $("accounting-rows").replaceChildren();
  const list = r.contract?.accounting ?? [];
  for (const a of list.slice(0, 250)) {
    let row = element("tr");
    for (const v of [a.path || "(root)", JSON.stringify(a.value), a.status])
      row.append(element("td", v));
    $("accounting-rows").append(row);
  }
  $("accounting-limit").textContent = r.contract
    ? choose(
        `${list.length}項目。画面は先頭250項目、レポートには全項目を含みます。`,
        `${list.length} leaves; first 250 shown. The report includes all leaves.`,
      )
    : choose(
        "操作が失敗したため、移行後の保持契約は実行していません。",
        "Migration failed, so post-migration preservation checks did not run.",
      );
}
function run() {
  clean();
  validateProject(project);
  stop();
  report = null;
  renderMetrics();
  renderResults();
  let ticket = ++generation;
  $("run").disabled = true;
  $("cancel-run").hidden = false;
  $("freshness").textContent = choose("検証中…", "VERIFYING…");
  status(
    choose(
      "コピー上でフィクスチャを検証しています。",
      "Verifying fixtures on copies.",
    ),
  );
  try {
    workerURL = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: "text/javascript" }),
    );
    worker = new Worker(workerURL, { type: "module" });
  } catch {
    generation++;
    stop();
    $("freshness").textContent = choose("未検証", "STALE");
    throw Error(
      choose(
        "検証ワーカーを開始できませんでした。",
        "The verification worker could not start.",
      ),
    );
  }
  timer = setTimeout(() => {
    if (ticket !== generation) return;
    generation++;
    stop();
    $("freshness").textContent = choose("未検証", "STALE");
    status(
      choose(
        "6秒の処理予算を超えました。小さいフィクスチャで検証してください。",
        "The 6-second processing budget was exceeded. Use smaller fixtures.",
      ),
      true,
    );
  }, 6000);
  worker.onmessage = (e) => {
    if (ticket !== generation) return;
    generation++;
    stop();
    if (e.data.ok) {
      report = e.data.report;
      renderMetrics();
      renderResults();
      $("freshness").textContent = choose(
        "現行のプランで検証済み",
        "CURRENT PLAN VERIFIED",
      );
      status(
        report.ok
          ? choose(
              "このフィクスチャ群の期待値と契約に一致しました。",
              "Expected results and contracts passed for these fixtures.",
            )
          : choose(
              "不一致または未確認の項目があります。3つの結果を分けて確認してください。",
              "Some results need review. Inspect execution, expectations and preservation separately.",
            ),
      );
    } else {
      $("freshness").textContent = choose("未検証", "STALE");
      status(e.data.error, true);
    }
  };
  worker.onerror = () => {
    if (ticket !== generation) return;
    generation++;
    stop();
    $("freshness").textContent = choose("未検証", "STALE");
    status(
      choose(
        "検証ワーカーを実行できませんでした。",
        "The verification worker could not run.",
      ),
      true,
    );
  };
  try {
    worker.postMessage(project);
  } catch (error) {
    generation++;
    stop();
    $("freshness").textContent = choose("未検証", "STALE");
    throw error;
  }
}
$("run").onclick = guard(run);
$("cancel-run").onclick = () => {
  stale();
  status(
    choose(
      "検証を中止しました。結果は未検証です。",
      "Verification cancelled. Results are stale.",
    ),
  );
};
$("undo").onclick = guard(() => {
  clean();
  if (!history.length) return;
  project = history.pop();
  selectedStep = 0;
  selectedFixture = project.fixtures[0]?.id;
  stale();
  render();
  status(
    choose(
      "前の作業状態に戻しました。再検証してください。",
      "Previous project restored. Run verification again.",
    ),
  );
});
for (const [id, safe] of [
  ["example-risk", false],
  ["example-safe", true],
])
  $(id).onclick = guard(() => {
    clean();
    mutate(
      example(safe),
      choose(
        "架空の参照例を読み込みました。",
        "Synthetic reference example loaded.",
      ),
    );
    run();
  });
function download(name, text, type) {
  clean();
  let url;
  try {
    url = URL.createObjectURL(new Blob([text], { type }));
    let a = element("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status(choose("ファイルを作成しました: ", "File prepared: ") + name);
  } catch {
    if (url) URL.revokeObjectURL(url);
    throw Error(
      choose(
        "ダウンロードを作成できませんでした。",
        "Download could not be created.",
      ),
    );
  }
}
$("save-project").onclick = guard(() =>
  download(
    "statecarry-project.json",
    serializeProject(project),
    "application/json",
  ),
);
$("export-module").onclick = guard(() => {
  if (!report) throw Error("Run current plan first");
  download(
    "statecarry-migration.mjs",
    moduleSource(project, CORE_SOURCE),
    "text/javascript",
  );
});
$("export-fixtures").onclick = guard(() =>
  download(
    "statecarry-fixtures.json",
    fixtureSource(project),
    "application/json",
  ),
);
$("export-runner").onclick = guard(() =>
  download("statecarry-run.mjs", RUNNER_SOURCE, "text/javascript"),
);
$("export-report").onclick = guard(() =>
  download("statecarry-report.html", reportHTML(project, report), "text/html"),
);
const dialog = $("import-dialog");
$("open-import").onclick = guard(() => {
  clean();
  importTicket++;
  $("import-error").textContent = "";
  dialog.showModal();
});
function closeImport() {
  importTicket++;
  dialog.close();
  $("import-file").value = "";
}
for (const id of ["close-import", "cancel-import"]) $(id).onclick = closeImport;
dialog.oncancel = () => {
  importTicket++;
  $("import-file").value = "";
};
$("import-json").oninput = () => importTicket++;
function importText(text) {
  const next = parseProject(text);
  mutate(
    next,
    choose(
      "読み込みました。元に戻すこともできます。",
      "Imported. Undo can restore the previous project.",
    ),
  );
  closeImport();
}
$("apply-import").onclick = () => {
  try {
    importText($("import-json").value);
  } catch (e) {
    $("import-error").textContent =
      choose("変更されていません: ", "No change: ") + e.message;
  }
};
$("import-file").onchange = async () => {
  let file = $("import-file").files[0];
  if (!file) return;
  let ticket = ++importTicket;
  try {
    if (file.size > LIMITS.projectBytes) throw Error("File exceeds 4 MiB");
    let bytes = await file.arrayBuffer();
    if (ticket !== importTicket || !dialog.open) return;
    importText(decodeUTF8(new Uint8Array(bytes)));
  } catch (e) {
    if (ticket === importTicket && dialog.open)
      $("import-error").textContent = e.message;
  } finally {
    if (ticket === importTicket) $("import-file").value = "";
  }
};
render();
run();
