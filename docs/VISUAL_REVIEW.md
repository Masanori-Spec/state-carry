# Visual and exported-artifact review

Inspected on 2026-10-04 using the actual artifacts from [run 37178149714](https://github.com/Masanori-Spec/state-carry/actions/runs/37178149714), functional commit `e064c17219cdc2784f2a11dfda2a9ca76735ba3c`. No mockup images are used.

## Screen inspection

- [Japanese desktop plan](evidence/browser/desktop-plan-ja.png): hierarchy, version chain, operation editor and localized verification banner
- [English desktop plan](evidence/browser/desktop-plan-en.png): translated controls, matching English status and visible keyboard focus
- [English overwrite review](evidence/browser/desktop-overwrite-en.png): separate operation, expectation and preservation outcomes, warning, independent expected error and original-leaf table
- Japanese mobile [plan](evidence/browser/mobile-plan-ja.png), [fixtures](evidence/browser/mobile-fixtures-ja.png) and [review](evidence/browser/mobile-review-ja.png): 390 px viewport, readable stacked controls and contained wide tables; page-wide overflow assertions passed
- [Actual downloaded HTML report](evidence/browser/exported-report-screen.png): complete guarded example, three fixture sections, declarations, leaf tables and interpretation limits

The original screenshots exposed a status banner left in its old language after switching locales. Fresh screenshots and locale assertions confirm the correction. User-authored fixture names, JSON, protocol status codes and English report text remain data or defined technical labels rather than translated project content.

## Print inspection

Every page of both actual Chromium PDFs was rendered and inspected:

- [UI review PDF](evidence/browser/review-print.pdf): 2 A4 pages, 16 mm vertical / 14 mm horizontal margins; the leaf-accounting heading stays with its table
- [Exported report PDF](evidence/browser/exported-report-print.pdf): 7 A4 pages with the same margins; headings stay with their following content, JSON and tables remain readable, and interpretation limits are retained

Short JSON blocks are kept together using a conservative wrapped-row estimate. This can leave white space near a page end. Larger imported payloads may paginate and were not individually visually reviewed. This inspection covers the retained synthetic examples, not all possible inputs or physical printers.

## Runnable downloads

These exact files were downloaded through the tested interface and are retained together:

- [Migration module](evidence/browser/statecarry-migration.mjs)
- [Node runner](evidence/browser/statecarry-run.mjs)
- [Passing independent fixtures](evidence/browser/statecarry-fixtures.json)
- [Separate intentional mismatch](evidence/browser/statecarry-fixtures-failing.json)
- [Downloaded HTML report](evidence/browser/statecarry-report.html)

Run the bundle from `docs/evidence/browser/`:

```sh
node statecarry-run.mjs statecarry-fixtures.json
# exits 0
node statecarry-run.mjs statecarry-fixtures-failing.json
# exits 1 intentionally
```

Both were executed in CI and again after download. The resulting JSON agrees exactly with the retained [passing report](evidence/browser/exported-pass-report.json) and [mismatch report](evidence/browser/exported-fail-report.json). The passing file was preserved unchanged; the negative fixture does not replace it.

No real application's persistence, customer data, backup/rollback behavior, or universal preservation guarantee was validated. The screenshots and runner demonstrate the documented synthetic workflow within its bounds.
