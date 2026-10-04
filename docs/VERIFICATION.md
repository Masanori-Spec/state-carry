# Verification record

Initial review freeze:2026-10-04. No local/shared browser execution or publication is performed by this build task.

## Executed

- `npm run build` and JavaScript syntax checks: passed
- Node test suite: **158 passed,0 failed,4 skipped**
  - Includes108 enabled cases from the pinned JSON Patch corpus
  - Four cases are disabled in the unmodified upstream corpus; their skips remain explicit
  - The other31 tests cover migration/contract semantics, strict JSON bounds, atomicity, expected failures, overwrite notices, source parity and generated artifact execution
- Python jsonpatch1.33 / jsonpointer3.0.0 differential reference: **1,200 seeded patch sequences passed**, comparing outputs/failures and input nonmutation
- Independently implemented Python pointer/deep-equality/preservation oracle: **1,000 seeded contract cases passed**
- Generated standalone module and Node runner: passing guarded fixtures exit0, intentionally failing overwrite fixtures exit1, invalid fixture file exit2
- Generated module result matches the authoring engine; original input remains unchanged
- Static emitted-import resolution checks pass at both domain root and nested `/state-carry/` paths
- Original-leaf accounting includes empty containers, explicit mapped preservation, intentional changes/drops and unreviewed data
- Corpus files and Python packages are pinned; source hashes and retained notices accompany the project

The differential seed is1396916562. The Python contract oracle does not import the JavaScript implementation. Corpus success is within the documented portable JSON profile, not a universal RFC implementation/conformance certification. Root document removal is an explicitly unsupported boundary. Expected outputs in randomized contract cases are independent copies deliberately altered in some cases; they are not regenerated from the JavaScript migration result.

## Authored but NOT run

The15-scenario Playwright suite covers:

1. Both languages, skip link, roving tabs and deployed subpath
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
12. Browser-downloaded artifact execution with passing/failing fixtures
13. Offline reruns and390px responsive layouts in Japanese
14. Printable PDF capture, dialog cancellation and reload behavior
15. No external runtime requests or page errors

CI is authored for Ubuntu22.04, Node22/24 and Python3.12. Chromium uses `chromiumSandbox:true`; browser tests serve the app under `/state-carry/`. Screenshots and print PDFs are configured as artifacts.

**No CI success, actual browser execution, screenshot inspection, mobile visual pass, print-pagination pass, Firefox/Safari pass, hosted availability or production integration is claimed.** These remain checks for the independent review/publication phase. Source-level browser tests are not equivalent to executed evidence.

## Interpretation

A passing fixture means the independent expected result and applicable preservation declarations agree with that synthetic fixture. An expected-error fixture can pass with post-migration preservation not-run. Overwrite warnings can remain on intentionally allowed replacements. Equal values at the same path do not establish identity or provenance. No customer validation, demand, novelty, time savings or universal no-loss guarantee has been established.

## Independent review repairs

Nineteen independent regression tests exercise additional API, resource, runner and actual-handler boundaries with a DOM double. Received findings were repaired: valid long generated paths, descriptor-first envelopes and operation arrays, standard array prototypes, bounded regular-file runner reads, atomic UI selection at caps, terminal worker generations, stale metric clearing, and aggregate report/accounting limits. DOM-double checks do not claim actual browser queues, layout or accessibility behavior. See INDEPENDENT_REVIEW.md for the review's own scope and findings when included.

Release-evidence refinements retain the original runnable passing browser-download bundle, a separately named intentional-failure fixture, both runner reports, and the exact downloaded HTML report. The browser suite captures that exported report itself as a screen image and print PDF. These capture steps remain authored and unrun at this freeze.

The final package lock was regenerated in a clean directory from the official npm registry while retaining @playwright/test 1.56.0. Clean `npm ci --ignore-scripts` passed, including complete optional fsevents 2.3.2 metadata. This verifies dependency installation, not browser installation or execution.
