import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { example } from "../src/example.mjs";
import { runProject } from "../src/core.mjs";
import { printBlockClass, reportHTML } from "../src/export.mjs";

// Actual handlers with a small DOM double: no browser or visual-layout claim.
async function localeHarness() {
  const nodes = new Map(),
    workers = [];
  class Node {
    constructor() {
      this.children = [];
      this.dataset = {};
      this.value = "";
      this.textContent = "";
      this.attributes = {};
      this.open = false;
    }
    append(...items) {
      this.children.push(...items);
    }
    replaceChildren(...items) {
      this.children = items;
    }
    setAttribute(k, v) {
      this.attributes[k] = v;
    }
    focus() {}
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
  }
  const html = await readFile("web/index.html", "utf8");
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g))
    nodes.set(id, new Node());
  const $ = (id) => nodes.get(id);
  $("operation-form").elements = {
    op: new Node(),
    path: new Node(),
    from: new Node(),
    value: new Node(),
  };
  $("operation-form").elements.op.value = "move";
  $("operation-form").elements.value.value = "null";
  $("contract-form").elements = {
    kind: new Node(),
    source: new Node(),
    target: new Node(),
    reason: new Node(),
  };
  $("contract-form").elements.kind.value = "preserve";
  const document = {
    getElementById: $,
    createElement: () => new Node(),
    querySelectorAll: () => [],
    querySelector: () => new Node(),
    documentElement: new Node(),
    body: new Node(),
  };
  class Worker {
    constructor() {
      workers.push(this);
    }
    postMessage(project) {
      this.project = project;
    }
    terminate() {}
    reply(data = { ok: true, report: runProject(this.project) }) {
      this.onmessage({ data });
    }
  }
  const originals = {
    document: globalThis.document,
    Worker: globalThis.Worker,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  Object.assign(globalThis, {
    document,
    Worker,
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  await import("../web/app.mjs?release=" + Math.random());
  const click = (id) => $(id).onclick({ preventDefault() {} });
  return {
    $,
    workers,
    click,
    locale(lang) {
      $("language").value = lang;
      $("language").onchange();
    },
    cleanup() {
      click("cancel-run");
      Object.assign(globalThis, originals);
    },
  };
}

test("release: changing locale resets the banner to the current in-flight, reviewed or stale state", async () => {
  const ui = await localeHarness();
  try {
    const pending = ui.workers.at(-1);
    ui.locale("en");
    assert.equal(ui.$("status").textContent, "Verifying fixtures on copies.");
    assert.equal(ui.$("freshness").textContent, "VERIFYING…");
    assert.equal(ui.$("run").disabled, true);
    assert.equal(ui.workers.at(-1), pending);
    pending.reply();
    assert.equal(ui.$("export-module").disabled, false);
    ui.locale("ja");
    assert.ok(ui.$("status").textContent.startsWith("不一致または"));
    assert.equal(ui.$("freshness").textContent, "現行のプランで検証済み");
    ui.locale("en");
    assert.ok(
      ui.$("status").textContent.startsWith("Some results need review."),
    );
    ui.click("cancel-run");
    ui.locale("ja");
    assert.equal(
      ui.$("status").textContent,
      "結果は未検証です。検証を実行してください。",
    );
    assert.equal(ui.$("export-module").disabled, true);
    ui.locale("en");
    assert.equal(
      ui.$("status").textContent,
      "Results are stale. Run verification.",
    );
    ui.click("run");
    ui.workers.at(-1).reply({ ok: false, error: "Synthetic worker failure" });
    assert.equal(ui.$("status").className, "error");
    ui.locale("ja");
    assert.equal(
      ui.$("status").textContent,
      "結果は未検証です。検証を実行してください。",
    );
    assert.equal(ui.$("export-module").disabled, true);
    ui.click("open-import");
    ui.$("import-json").value = JSON.stringify(example(true));
    ui.click("apply-import");
    ui.click("run");
    ui.workers.at(-1).reply();
    ui.locale("en");
    assert.equal(
      ui.$("status").textContent,
      "Expected results and contracts passed for these fixtures.",
    );
    assert.equal(ui.$("export-module").disabled, false);
    ui.locale("ja");
    assert.equal(
      ui.$("status").textContent,
      "このフィクスチャ群の期待値と契約に一致しました。",
    );
    assert.equal(ui.$("actual-output").className, "print-keep");
  } finally {
    ui.cleanup();
  }
});

test("release: print blocks only stay together within a conservative wrapped-row budget", () => {
  assert.equal(printBlockClass(""), "print-keep");
  assert.equal(printBlockClass(Array(32).fill("x").join("\n")), "print-keep");
  assert.equal(printBlockClass(Array(33).fill("x").join("\n")), "print-flow");
  assert.equal(printBlockClass("x".repeat(88 * 32)), "print-keep");
  assert.equal(printBlockClass("x".repeat(88 * 32 + 1)), "print-flow");
  assert.equal(printBlockClass("あ".repeat(44 * 32 + 1)), "print-flow");
  assert.equal(printBlockClass("x".repeat(40 * 32 + 1), 40), "print-flow");
  assert.equal(printBlockClass("\t".repeat(22 * 32 + 1)), "print-flow");
  const p = example(true);
  const html = reportHTML(p);
  assert.match(html, /@page\{size:A4;margin:16mm 14mm\}/);
  assert.match(html, /h1,h2,h3,h4\{break-inside:avoid;break-after:avoid\}/);
  assert.match(html, /<pre class="print-keep">/);
  p.transitions[0].ops[0].value = "x".repeat(4000);
  assert.match(reportHTML(p), /<pre class="print-flow">/);
});

test("release: UI print styles keep accounting headings with content and use page margins", async () => {
  const css = await readFile("web/styles.css", "utf8");
  assert.match(css, /@page\s*\{\s*size: A4;\s*margin: 16mm 14mm;/);
  assert.match(css, /h4,[\s\S]*?break-after: avoid;/);
  assert.match(css, /pre\.print-keep\s*\{\s*break-inside: avoid;/);
  assert.match(css, /pre\s*\{[^}]*break-inside: auto;/);
});
