import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { example } from "../../src/example.mjs";
const dir = process.env.BROWSER_ARTIFACT_DIR ?? "tests/browser/artifacts",
  base = process.env.BASE_URL ?? "http://127.0.0.1:4173";
await mkdir(dir, { recursive: true });
const results = [],
  errors = [],
  requests = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    chromiumSandbox: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}),
  });
} catch (error) {
  await writeFile(
    `${dir}/results.json`,
    JSON.stringify(
      {
        status: "blocked",
        stage: "launch",
        testsRun: 0,
        sandbox: true,
        error: error.message,
      },
      null,
      2,
    ),
  );
  throw error;
}
const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    acceptDownloads: true,
  }),
  page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
async function scenario(name, fn) {
  try {
    await fn();
    results.push({ name, status: "passed" });
  } catch (error) {
    results.push({
      name,
      status: "failed",
      error: error.message,
      statusText: await page
        .locator("#status")
        .textContent()
        .catch(() => null),
    });
    await page
      .screenshot({ path: `${dir}/failure.png`, fullPage: true })
      .catch(() => {});
    throw error;
  }
}
const fresh = () =>
    page
      .locator("#freshness")
      .filter({ hasText: /現行|CURRENT PLAN/ })
      .waitFor({ timeout: 8000 }),
  run = async () => {
    await page.locator("#run").click();
    await fresh();
  },
  tab = async (name) => page.locator("#tab-" + name).click();
async function download(id) {
  let pending = page.waitForEvent("download");
  await page.locator(id).click();
  let d = await pending,
    stream = await d.createReadStream(),
    chunks = [];
  for await (const c of stream) chunks.push(c);
  return {
    name: d.suggestedFilename(),
    text: Buffer.concat(chunks).toString("utf8"),
  };
}
async function load(p) {
  await page.locator("#open-import").click();
  await page.locator("#import-json").fill(JSON.stringify(p));
  await page.locator("#apply-import").click();
  assert.equal(await page.locator("#import-dialog").isVisible(), false);
}
try {
  await scenario(
    "Both locales, keyboard skip link and roving tabs at deployed subpath",
    async () => {
      await page.goto(base);
      await fresh();
      assert.equal(await page.locator("html").getAttribute("lang"), "ja");
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(".skip")
          .evaluate((x) => x === document.activeElement),
        true,
      );
      await page.keyboard.press("Enter");
      assert.equal(
        await page
          .locator("#main")
          .evaluate((x) => x === document.activeElement),
        true,
      );
      await page.locator("#language").selectOption("en");
      assert.equal(
        await page.locator("#status").textContent(),
        "Some results need review. Inspect execution, expectations and preservation separately.",
      );
      assert.ok(
        (await page.locator("h1").textContent()).includes(
          "carry the important things",
        ),
      );
      await page.locator("#tab-plan").focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(
        await page.locator("#tab-fixtures").getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("End");
      assert.equal(
        await page.locator("#tab-review").getAttribute("aria-selected"),
        "true",
      );
      await page.keyboard.press("Home");
      assert.equal(
        await page.locator("#tab-plan").getAttribute("aria-selected"),
        "true",
      );
    },
  );
  await scenario(
    "Overwrite fixture opens with separate execution, expectation and contract results",
    async () => {
      assert.deepEqual(await page.locator(".metric strong").allTextContents(), [
        "3",
        "3",
        "2/3",
        "2",
      ]);
      await page.screenshot({
        path: `${dir}/desktop-plan-en.png`,
        fullPage: true,
      });
      await tab("review");
      assert.ok(
        (await page.locator("#result-title").textContent()).includes(
          "existing title",
        ),
      );
      assert.ok(
        (await page.locator("#warnings").textContent()).includes(
          "Owner-authored title",
        ),
      );
      assert.ok(
        (await page.locator("#expected-output").textContent()).includes(
          "PATCH_FAILED",
        ),
      );
      assert.ok(
        (await page.locator("#actual-output").textContent()).includes(
          "Harbor map",
        ),
      );
      await page.screenshot({
        path: `${dir}/desktop-overwrite-en.png`,
        fullPage: true,
      });
    },
  );
  await scenario(
    "Plan edits keep independent expectations fixed and invalidate prior exports",
    async () => {
      const before = JSON.parse((await download("#save-project")).text);
      await tab("plan");
      const ops = [
        { op: "test", path: "/metadata/title", value: null },
        ...before.transitions[0].ops,
      ];
      await page.locator("#patch-json").fill(JSON.stringify(ops));
      assert.equal(await page.locator("#export-module").isDisabled(), true);
      await page.locator("#apply-patch").click();
      const after = JSON.parse((await download("#save-project")).text);
      assert.deepEqual(after.fixtures, before.fixtures);
      await run();
      assert.deepEqual(await page.locator(".metric strong").allTextContents(), [
        "3",
        "3",
        "3/3",
        "1",
      ]);
      await tab("review");
      assert.ok(
        (await page.locator("#result-verdict").textContent()).includes(
          "PASSED",
        ),
      );
      assert.ok(
        (await page.locator("#accounting-limit").textContent()).includes(
          "did not run",
        ),
      );
    },
  );
  await scenario(
    "Unapplied edits block navigation and export; cancellation is recoverable",
    async () => {
      await tab("plan");
      await page
        .locator("#patch-json")
        .fill('[{"op":"remove","path":"/customFields"}]');
      await page.locator("#save-project").click();
      assert.ok(
        (await page.locator("#status").textContent()).includes("pending edits"),
      );
      await page.locator("#tab-review").click();
      assert.equal(await page.locator("#panel-plan").isVisible(), true);
      await page.locator("#language").selectOption("ja");
      assert.equal(await page.locator("#language").inputValue(), "en");
      await page.locator("#cancel-patch").click();
      assert.ok(
        (await page.locator("#patch-json").inputValue()).includes("test"),
      );
      await run();
    },
  );
  await scenario(
    "Guided operation append and undo preserve expectations",
    async () => {
      const old = JSON.parse((await download("#save-project")).text);
      await page.locator("#operation-form [name=op]").selectOption("add");
      await page.locator("#operation-form [name=path]").fill("/temporary");
      await page.locator("#operation-form [name=value]").fill("17");
      await page.locator("#operation-form button[type=submit]").click();
      assert.deepEqual(
        JSON.parse((await download("#save-project")).text).fixtures,
        old.fixtures,
      );
      await run();
      assert.ok(
        (await page.locator(".metric strong").nth(2).textContent()) !== "3/3",
      );
      await page.locator("#undo").click();
      await run();
      assert.equal(
        await page.locator(".metric strong").nth(2).textContent(),
        "3/3",
      );
    },
  );
  await scenario(
    "Independent fixture value edits and preservation contract failures are distinct",
    async () => {
      await tab("fixtures");
      await page.locator("#fixture-select").selectOption("ordinary");
      let p = JSON.parse(await page.locator("#expected-json").inputValue());
      p.payload.metadata.title = "Wrong independent expectation";
      await page.locator("#expected-json").fill(JSON.stringify(p));
      await page.locator("#apply-fixture").click();
      await run();
      await tab("review");
      assert.ok(
        (await page.locator("#result-rows").textContent()).includes("MISMATCH"),
      );
      await page.locator("#example-safe").click();
      await fresh();
      await tab("fixtures");
      await page.locator("#fixture-select").selectOption("ordinary");
      let contracts = JSON.parse(
        await page.locator("#contracts-json").inputValue(),
      );
      contracts[0].target = "/items";
      await page.locator("#contracts-json").fill(JSON.stringify(contracts));
      await page.locator("#apply-contracts").click();
      await run();
      await tab("review");
      assert.ok(
        (await page.locator("#accounting-rows").textContent()).includes(
          "contract-failed",
        ),
      );
      await page.locator("#example-safe").click();
      await fresh();
    },
  );
  await scenario(
    "Malformed project import is atomic and hostile strings stay data",
    async () => {
      const before = (await download("#save-project")).text;
      await page.locator("#open-import").click();
      await page.locator("#import-json").fill('{"x":1,"x":2}');
      await page.locator("#apply-import").click();
      assert.ok(
        (await page.locator("#import-error").textContent()).includes(
          "Duplicate",
        ),
      );
      await page.locator("#cancel-import").click();
      assert.equal((await download("#save-project")).text, before);
      let p = example(true);
      p.name = "<img src=x onerror=alert(1)>";
      p.fixtures[0].input.payload.customFields.text =
        "</script><svg onload=alert(1)>";
      p.fixtures[0].expected.value.payload.customFields.text =
        "</script><svg onload=alert(1)>";
      await load(p);
      await run();
      assert.equal(await page.locator("#project-title img").count(), 0);
      assert.equal(await page.locator("script:not([src])").count(), 0);
      await tab("review");
      const html = (await download("#export-report")).text;
      assert.ok(!html.includes("<img src=x"));
      assert.ok(!html.includes("<svg onload"));
      assert.ok(html.includes("&lt;img"));
      await page.locator("#example-safe").click();
      await fresh();
    },
  );
  await scenario(
    "Oversized and malformed UTF8 files reject, cancelled reads stay cancelled",
    async () => {
      await page.locator("#open-import").click();
      await page.locator("#import-file").setInputFiles({
        name: "large.json",
        mimeType: "application/json",
        buffer: Buffer.alloc(4194305, 32),
      });
      assert.ok(
        (await page.locator("#import-error").textContent()).includes("4 MiB"),
      );
      let bytes = Buffer.from(JSON.stringify(example()));
      bytes[bytes.indexOf(Buffer.from(example().name))] = 255;
      await page.locator("#import-file").setInputFiles({
        name: "invalid.json",
        mimeType: "application/json",
        buffer: bytes,
      });
      await page
        .locator("#import-error")
        .filter({ hasText: "Invalid UTF-8" })
        .waitFor();
      await page.evaluate(() => {
        const original = File.prototype.arrayBuffer;
        File.prototype.arrayBuffer = async function () {
          await new Promise((r) => setTimeout(r, 350));
          return original.call(this);
        };
      });
      let stale = example();
      stale.name = "Stale file";
      await page.locator("#import-file").setInputFiles({
        name: "stale.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(stale)),
      });
      await page.locator("#cancel-import").click();
      await page.locator("#example-safe").click();
      await fresh();
      await page.waitForTimeout(500);
      assert.equal(
        await page.locator("#project-title").textContent(),
        example(true).name,
      );
    },
  );
  await scenario(
    "Newer import text supersedes delayed file reads",
    async () => {
      await page.locator("#open-import").click();
      let stale = example();
      stale.name = "Superseded";
      await page.locator("#import-file").setInputFiles({
        name: "old.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(stale)),
      });
      await page.locator("#import-json").fill(JSON.stringify(example(true)));
      await page.waitForTimeout(500);
      assert.equal(await page.locator("#import-dialog").isVisible(), true);
      await page.locator("#apply-import").click();
      assert.equal(
        await page.locator("#project-title").textContent(),
        example(true).name,
      );
      await run();
    },
  );
  await scenario(
    "Interrupted workers never publish a stale result",
    async () => {
      await page.evaluate(() => {
        window.RealWorker = Worker;
        window.Worker = class {
          constructor(...args) {
            this.inner = new window.RealWorker(...args);
            this.inner.onmessage = (e) => this.onmessage?.(e);
            this.inner.onerror = (e) => this.onerror?.(e);
          }
          postMessage(message) {
            this.timer = setTimeout(() => this.inner.postMessage(message), 400);
          }
          terminate() {
            clearTimeout(this.timer);
            this.inner.terminate();
          }
        };
      });
      await page.locator("#run").click();
      await page.locator("#cancel-run").click();
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#review-empty").isVisible(), true);
      assert.equal(await page.locator("#export-module").isDisabled(), true);
      await tab("plan");
      await page.locator("#run").click();
      await page.locator("#patch-json").fill("[]");
      await page.waitForTimeout(600);
      assert.equal(await page.locator("#export-module").isDisabled(), true);
      await page.locator("#cancel-patch").click();
      await page.evaluate(() => (window.Worker = window.RealWorker));
      await run();
    },
  );
  await scenario(
    "Worker-start and download failures recover visibly",
    async () => {
      await page.evaluate(() => {
        window.savedCreate = URL.createObjectURL;
        URL.createObjectURL = () => {
          throw Error("forced");
        };
      });
      await page.locator("#run").click();
      assert.equal(await page.locator("#run").isEnabled(), true);
      assert.ok(
        (await page.locator("#status").textContent()).includes(
          "could not start",
        ),
      );
      await page.locator("#save-project").click();
      assert.ok(
        (await page.locator("#status").textContent()).includes(
          "Download could not",
        ),
      );
      await page.evaluate(() => (URL.createObjectURL = window.savedCreate));
      await run();
    },
  );
  await scenario(
    "Downloaded same-engine artifact executes passing and deliberate failing fixture",
    async () => {
      await page.locator("#example-safe").click();
      await fresh();
      await tab("review");
      let m = await download("#export-module"),
        f = await download("#export-fixtures"),
        r = await download("#export-runner");
      for (const x of [m, f, r]) await writeFile(`${dir}/${x.name}`, x.text);
      const runExport = (fixtureFile = "statecarry-fixtures.json") =>
        spawnSync(process.execPath, ["statecarry-run.mjs", fixtureFile], {
          cwd: dir,
          encoding: "utf8",
        });
      let got = runExport();
      assert.equal(got.status, 0, got.stderr);
      await writeFile(`${dir}/exported-pass-report.json`, got.stdout);
      const fixture = JSON.parse(f.text);
      fixture.fixtures[0].expected.value.payload.metadata.title = "wrong";
      await writeFile(
        `${dir}/statecarry-fixtures-failing.json`,
        JSON.stringify(fixture, null, 2),
      );
      got = runExport("statecarry-fixtures-failing.json");
      assert.equal(got.status, 1, got.stderr);
      await writeFile(`${dir}/exported-fail-report.json`, got.stdout);
      // Retain the original runnable passing fixture as the default artifact.
      await writeFile(`${dir}/${f.name}`, f.text);
      assert.equal(runExport().status, 0);
      const report = await download("#export-report");
      await writeFile(`${dir}/${report.name}`, report.text);
      const reportPage = await context.newPage();
      reportPage.on("pageerror", (error) => errors.push(error.message));
      try {
        // Render the exact downloaded HTML bytes, not the workbench's review panel.
        await reportPage.setContent(report.text, {
          waitUntil: "domcontentloaded",
        });
        assert.equal(await reportPage.locator("script").count(), 0);
        await reportPage.screenshot({
          path: `${dir}/exported-report-screen.png`,
          fullPage: true,
        });
        await reportPage.emulateMedia({ media: "print" });
        assert.deepEqual(
          await reportPage.evaluate(() => ({
            heading: getComputedStyle(document.querySelector("h3")).breakAfter,
            shortBlock: getComputedStyle(
              document.querySelector("pre.print-keep"),
            ).breakInside,
            pageRule: [...document.styleSheets[0].cssRules].some(
              (r) =>
                r instanceof CSSPageRule &&
                r.style.size === "a4" &&
                r.style.margin === "16mm 14mm",
            ),
          })),
          { heading: "avoid", shortBlock: "avoid", pageRule: true },
        );
        await reportPage.pdf({
          path: `${dir}/exported-report-print.pdf`,
          format: "A4",
          printBackground: true,
        });
      } finally {
        await reportPage.close();
      }
      assert.equal((await download("#export-module")).text, m.text);
    },
  );
  await scenario(
    "Loaded-app offline re-verification, both locales and390px layout",
    async () => {
      await context.setOffline(true);
      await page.locator("#example-risk").click();
      await fresh();
      assert.equal(
        await page.locator(".metric strong").nth(2).textContent(),
        "2/3",
      );
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator("#language").selectOption("ja");
      assert.equal(
        await page.locator("#status").textContent(),
        "不一致または未確認の項目があります。3つの結果を分けて確認してください。",
      );
      for (const name of ["plan", "fixtures", "review"]) {
        await tab(name);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await page.screenshot({
          path: `${dir}/mobile-${name}-ja.png`,
          fullPage: true,
        });
      }
      await context.setOffline(false);
      await page.setViewportSize({ width: 1440, height: 1050 });
      await tab("plan");
      await page.screenshot({
        path: `${dir}/desktop-plan-ja.png`,
        fullPage: true,
      });
    },
  );
  await scenario(
    "Print, cancellation/history and reload are explicit",
    async () => {
      await page.locator("#language").selectOption("en");
      await tab("review");
      await page.emulateMedia({ media: "print" });
      assert.deepEqual(
        await page.evaluate(() => ({
          accountingHeading: getComputedStyle(
            document.querySelector('[data-t="accounting"]'),
          ).breakAfter,
          shortBlock: getComputedStyle(document.querySelector("pre.print-keep"))
            .breakInside,
          pageRule: [...document.styleSheets].some((sheet) =>
            [...sheet.cssRules].some(
              (r) =>
                r instanceof CSSPageRule &&
                r.style.size === "a4" &&
                r.style.margin === "16mm 14mm",
            ),
          ),
        })),
        { accountingHeading: "avoid", shortBlock: "avoid", pageRule: true },
      );
      await page.pdf({
        path: `${dir}/review-print.pdf`,
        format: "A4",
        printBackground: true,
      });
      await page.emulateMedia({ media: "screen" });
      const saved = (await download("#save-project")).text;
      await page.locator("#open-import").click();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#import-dialog").isVisible(), false);
      assert.equal((await download("#save-project")).text, saved);
      await page.reload();
      await fresh();
      assert.equal(
        await page.locator("#project-title").textContent(),
        example().name,
      );
    },
  );
  await scenario("No external runtime requests or browser errors", async () => {
    assert.deepEqual(errors, []);
    assert.ok(
      requests.every((url) => url.startsWith(base) || url.startsWith("blob:")),
      JSON.stringify(requests),
    );
  });
} finally {
  await writeFile(
    `${dir}/results.json`,
    JSON.stringify(
      {
        status: results.some((r) => r.status === "failed")
          ? "failed"
          : "passed",
        sandbox: true,
        results,
        errors,
        requests,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
