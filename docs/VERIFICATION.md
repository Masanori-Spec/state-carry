# Verification record

Verified on 2026-10-04. This evidence comes from functional commit `e064c17219cdc2784f2a11dfda2a9ca76735ba3c` and [GitHub Actions run 37178149714](https://github.com/Masanori-Spec/state-carry/actions/runs/37178149714). The later documentation commit retains these exact artifacts and runs the same workflow again.

## Executed engine checks

- Ubuntu 22.04, Node 22 and 24, Python 3.12: all engine jobs passed
- Clean `npm ci --ignore-scripts`, build and syntax/static checks: passed
- **161 tests passed per engine, 0 failed, 4 skipped**
  - 108 enabled cases from the pinned JSON Patch corpus
  - Four cases disabled in the unmodified upstream corpus remain explicit skips
  - 31 core/artifact tests, 19 independent-review regressions and 3 release regressions
- Pinned Python jsonpatch 1.33 / jsonpointer 3.0.0 reference: **1,200 seeded patch sequences passed**, comparing outputs/failures and input nonmutation
- Independently implemented Python pointer/deep-equality/preservation oracle: **1,000 seeded contract cases passed**
- Generated standalone module and Node runner: passing guarded fixtures exit 0, intentional mismatches exit 1, invalid fixture input exits 2
- Generated module/source agreement and caller-input nonmutation: passed
- Emitted import resolution at both domain root and nested `/state-carry/`: passed
- Original-leaf accounting includes empty containers, explicit mapped preservation, intentional changes/drops and unreviewed data

The differential seed is 1396916562. The Python contract oracle does not import the JavaScript implementation. Corpus success applies to the documented portable JSON profile; it is not universal RFC conformance certification. Root document removal remains unsupported. Randomized contract expectations are independent copies deliberately altered in some cases, never regenerated from the JavaScript migration result.

## Executed browser checks

All **15 Playwright scenarios passed** in Chromium with `chromiumSandbox: true`, served beneath `/state-carry/` on the runner's loopback interface:

1. Both locales, skip link, roving tabs and deployment subpath
2. Existing-destination overwrite with distinct execution/expectation/contract statuses
3. Unchanged independent fixtures after plan edits and stale export invalidation
4. Pending edits, blocked navigation/export and cancellation
5. Guided operations, undo and expectation preservation
6. Independent expected-value and contract failures
7. Atomic invalid imports, inert text and escaped reports
8. Oversized/malformed UTF-8 imports and cancellation of delayed reads
9. Newer pasted JSON superseding delayed file reads
10. Cancelled/stale workers never publishing a result
11. Worker-start/download failure recovery
12. Browser-downloaded artifact execution with passing and separate failing fixtures, plus actual HTML-report screen/print capture
13. Loaded-application offline reruns and 390 px responsive Japanese layouts
14. Printable PDF capture, print-style assertions, dialog cancellation and reload behavior
15. No external runtime requests or page errors

Locale assertions verify that the status banner changes with the selected language. The suite also checks that locale changes during a worker run preserve the in-progress freshness state.

## Actual visual and download inspection

Seven screenshots were inspected: Japanese/English desktop plans, English overwrite review, all three Japanese mobile tabs, and the downloaded HTML report. The two-page UI PDF and seven-page exported-report PDF were rendered to page images and every page inspected. Print margins and heading/content flow were checked. [Visual review](VISUAL_REVIEW.md) links the retained files.

The downloaded migration module, runner and original passing fixture were retained together. An intentional mismatch is stored separately. The exact downloaded files were executed again outside the browser: exit 0 for the passing fixture and exit 1 for the mismatch; both parsed JSON reports equal the reports retained by CI.

The machine-readable [hosted evidence record](evidence/hosted-ci.json) identifies the commit, jobs and downloaded artifact digest. [Browser results](evidence/browser/results.json) record every scenario. Evidence files retain the bytes produced by CI.

## Release repairs

The initial dependency lock contained an incomplete optional fsevents entry. Regenerating it from the official npm registry retained Playwright 1.56.0 and complete fsevents 2.3.2 metadata. Clean installation and aggregate verification passed from an extracted source ZIP.

Actual release screenshots showed a status banner retaining its prior language. Locale changes now derive a localized summary from the current verification state, including in-progress and stale states. Printed reviews now use A4 margins, keep headings with following content, and keep conservatively short JSON blocks together while longer blocks may paginate. Three release regressions cover these changes; the hosted browser run and fresh visual inspection passed afterward.

## Independent review and limits

The unchanged [independent review](INDEPENDENT_REVIEW.md) found no remaining blocker in its tested scope after the documented repairs. Its 158-test count describes that earlier review freeze; three release regressions bring the current total to 161. DOM-double tests and a Node worker check in that review are distinct from the subsequently executed hosted Chromium tests.

Passing a fixture means its independently supplied expectation and applicable preservation declarations agree with that synthetic case. Expected-error fixtures may pass while post-migration preservation remains not-run. Same-path equality does not prove identity, provenance or a causal move. Overwrite warnings can remain on intentionally allowed replacements.

No Firefox/Safari, assistive-technology, physical-printer, live production storage, real historical-customer fixture, public website availability, demand, novelty, adoption, time-saving or universal no-loss validation is claimed. Test copies and application-specific expectations are still required before integrating the exported module with real data.
