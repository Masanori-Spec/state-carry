# StateCarry independent engineering review

Review date: 2026-10-04

## Recommendation

Proceed to authorized source publication and sandboxed hosted CI after checking the final source and archive hashes. No blocking issue remains in the tested scope after the repairs below. This is a bounded engineering review, not a proof of universal JSON Patch conformance, lossless migration, storage safety or real-application suitability.

The final independent local aggregate passed **158 tests**, with **four upstream-disabled corpus cases explicitly skipped**. Build and syntax/static checks passed. The pinned Python differential checks also passed: **1,200 patch sequences** and **1,000 independently implemented pointer/equality/contract cases**. The **15 authored browser scenarios have not run in this review**. Browser execution, desktop/mobile screenshots, print layout and application integration remain release checks.

## Scope and evidence

Reviewed the portable JSON profile, strict parser, pointer/patch engine, consecutive version chain, original-leaf contracts, report construction, artifact generation and UI event handlers. The pure module and Node runner were executed from newly generated files. The emitted worker bundle was also executed in a real Node worker with a small message adapter; this does not establish browser-worker behavior.

`tests/reviewer.test.mjs` contributes 19 additional tests. Its expected results use literal independent witnesses and simple list constructions rather than the engine's equality, pointer, leaf or association helpers as an oracle. Coverage includes:

- 336 small array move/copy boundary cases across lengths 1–7, including post-removal indices and out-of-range destinations
- Empty keys, escape order, exact Unicode identity, malformed array indices, ignored extra operation members, root operations and proper-prefix restrictions
- Caller nonmutation, copy independence and failure without a partial migrated value
- Separate execution, independent expectation and preservation outcomes, including unasserted and expected-error fixtures
- Original values overwritten at a destination, empty containers, mapped preservation, intentional changes/drops, positional array limitations and unrelated equal values
- Long generated paths, strict descriptors/prototypes, inherited array serialization hooks and shared report-budget overflow
- Real runner rejection of oversized files, malformed UTF-8, directories and FIFOs; a simulated file-growth boundary confirms at most 4 MiB plus one byte is read
- Actual application handlers under a minimal DOM double: rejected additions at both caps, cancellation/edit invalidation, late callbacks after timeout, structured worker errors and clearing old metric totals
- Escaped report text, exact generated-module/source agreement, frozen plans, emitted-worker agreement and the HTML byte limit

The DOM double has no layout, accessibility tree or browser task queue. Its results are handler/state tests, not a visual or browser pass.

## Corrected findings

### Long original paths could abort valid fixtures

A valid depth-11 payload with ten 128-character keys passed project validation, but unchanged original-leaf accounting threw `INVALID_POINTER`. It applied the 1,024-character user-pointer limit to internally generated paths. Accounting now resolves already-validated key segments internally while retaining the external pointer cap. Long unchanged and disappeared leaves are both covered.

### Public input validation read accessors before rejecting them

An enumerable envelope version getter ran five times and was accepted. Operation-member getters ran before eventual rejection, while an operation-array element getter was accepted. Complete envelope and operation descriptors are now validated before those fields are read. Hidden/symbol properties and custom object prototypes reject as well. Regression getter counters remain zero.

### Array subclasses could silently replace data

A subclass containing `['original']` with inherited `toJSON()` returning `['changed']` passed validation. A current-version migration then returned the changed data without any operation. Nonstandard array prototypes now reject before serialization, including operation-array subclasses. The regression verifies that the hook never executes.

### The generated runner read before enforcing its limit

The exported runner used `readFile()` and checked size afterward. It could allocate oversized input or wait on a pipe. It now rejects nonregular inputs and checks an opened descriptor, with nonblocking/no-follow flags where supported. Bounded descriptor reads stop after the 4 MiB limit plus one overflow-detection byte. Real FIFO rejection and simulated growth after stat pass; input files are never rewritten.

### Rejected UI additions changed hidden selection

At 16 versions or 50 fixtures, the add handlers assigned a new selection before project validation rejected the addition. Subsequent edits could target a nonexistent item. Validation now precedes selection changes. Tests reject the extra item and then successfully edit the still-selected existing item.

### Terminal worker states could become fresh again

The timeout path stopped the worker without invalidating its generation. A retained completion callback could then publish a report. Structured worker errors left the freshness label at verifying, and reruns retained old metric totals. Terminal callbacks now seal their generation, errors remain stale, and reruns clear metrics. Cancellation and plan-edit invalidation also pass the handler tests.

### Repeated paths amplified accounting output

Before the report cap, a valid 52,849-byte project with 2,000 leaves under long nested keys produced a 9,906,511-byte report. Larger accepted projects could multiply this substantially. Accounting now streams entries through a shared conservative 8 MiB report budget, charges entries before retaining them and checks final report size. Overflow throws `RESOURCE_LIMIT` without a partial passing report. Two individually acceptable fixtures are also tested against the shared aggregate budget.

### The first HTML estimate missed indentation expansion

A valid 2,395,021-byte project containing deeply nested, escapable patch values emitted 16,882,122 bytes despite a 16 MiB estimate limit. Compact JSON size did not include pretty-print whitespace. HTML output now charges emitted UTF-8 chunks before retention and aborts before joining an over-limit report. The deep-indentation/escaping witness now rejects with `RESOURCE_LIMIT`.

## Semantics and interpretation

The reviewed patch behavior follows sequential operations, object replacement versus array insertion, post-removal move destinations, copy semantics and type-aware equality within the documented profile. See [RFC 6902 operations and errors](https://datatracker.ietf.org/doc/html/rfc6902#section-4). Pointer tests cover escape order, exact Unicode matching and canonical array indices; see [RFC 6901 evaluation](https://www.rfc-editor.org/rfc/rfc6901#section-4).

Root removal, URI-fragment pointers and values outside the portable/resource profile remain explicit unsupported boundaries. Passing the corpus does not certify every RFC input. The four disabled cases remain visible skips.

Preservation is value-based. Same-path equality does not establish identity, provenance or a causal move. Array paths describe positions. Primitive/null values and empty containers are original leaves. Nonempty container type and identity are not separately classified: changing `{"a":{"0":7}}` to `{"a":[7]}` can retain the same `/a/0` leaf. The whole independent expectation, or an explicit subtree contract, must check that shape change.

Expected migration errors may pass a negative fixture with preservation not run. An unasserted fixture cannot pass. Report construction overflow aborts verification; it cannot be turned into a passing expected migration error. Independently authored expectations and reasons still require human review, and a broad change declaration can offer weak evidence despite being technically valid.

## Reproduction and remaining gates

Executed on Node v24.19.0 and Python 3.12.14:

```sh
PYTHONPATH=/tmp/statecarry-python npm run check
```

The workspace-specific Python path only supplies the pinned reference packages. The portable documented workflow uses a virtual environment and the hash-pinned `tests/requirements.txt`.

Before describing the release as fully verified:

1. Check the exact source, generated assets and archive manifests, then the remote commit after any authorized publication
2. Run the hosted Node 22/24 and Python jobs plus all 15 sandboxed browser scenarios on that exact revision
3. Inspect desktop/mobile screenshots and print output, including dialogs, keyboard flows, import errors, downloads and late/cancelled worker paths
4. Execute downloaded artifacts again in the intended integration and validate real historical fixtures against the owning application's schema

No shared browser, hosted CI, publication, screenshot/PDF inspection, assistive-technology test or real storage migration was performed by this review. None of the passing checks establishes locking, backups, rollback, safe persistence, demand or adoption.
