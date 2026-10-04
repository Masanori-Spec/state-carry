# StateCarry v1 contract and boundaries

## Project shape

```json
{
  "schema": "statecarry/v1",
  "name": "Saved-project upgrade",
  "versions": [1, 2],
  "transitions": [
    {
      "from": 1,
      "to": 2,
      "ops": [{ "op": "move", "from": "/title", "path": "/metadata/title" }]
    }
  ],
  "fixtures": [
    {
      "id": "ordinary",
      "name": "Independent reference",
      "input": {
        "version": 1,
        "payload": { "title": "Draft", "metadata": {} }
      },
      "expected": {
        "kind": "value",
        "value": {
          "version": 2,
          "payload": { "metadata": { "title": "Draft" } }
        }
      },
      "contracts": [
        {
          "kind": "preserve",
          "source": "/title",
          "target": "/metadata/title",
          "reason": "Rename the title location"
        },
        {
          "kind": "change",
          "source": "/metadata",
          "target": "/metadata",
          "reason": "Populate the originally empty metadata container"
        }
      ]
    }
  ]
}
```

All project/envelope/transition/fixture/contract keys are explicit. Unknown keys are rejected. Required patch operation members follow RFC6902; extra operation members are ignored as the RFC specifies, while remaining within the portable JSON resource/key profile.

Versions are consecutive nonnegative integers0…1,000,000, with exactly one adjacent transition for each pair. Maximum16 versions and64 operations per transition. Migration always targets the final version. Current-version inputs return a clone unchanged. A version outside the chain, including a future version, returns UNKNOWN_VERSION. There is no inferred path, branch, shortcut, downgrade or recovery write.

Fixtures have a stable ASCII ID (letter followed by letters/digits/\_/-, maximum40 characters), name, input envelope, independent expectation and contract array. Maximum50 fixtures. Expectations are one of:

- `{"kind":"value","value":{"version":2,"payload":{...}}}`
- `{"kind":"error","code":"PATCH_FAILED"}`; also UNKNOWN_VERSION or RESOURCE_LIMIT
- `{"kind":"unasserted"}`

An expected failure only passes when that exact error code occurs. Validation errors are invalid projects, not expected migration failures. Expected-error fixtures skip post-migration contract checks because no output exists.

## Portable JSON profile

- Null, booleans, strings, arrays and plain objects only
- Finite JavaScript numbers with absolute value≤9,007,199,254,740,991; negative zero rejected
- Strict import compares the normalized decimal token with the normalized serialization of its parsed binary64 value. Literals that change decimal meaning on parse/stringify are rejected. `1.00`/`1e0` are accepted as1; `0.1000000000000000000001` is rejected. This is round-trip decimal-text preservation, not arbitrary-precision arithmetic
- Duplicate object keys rejected before native decoding can discard them
- Object keys≤128 UTF-16 code units, no control characters or unpaired surrogates; `__proto__`, `prototype`, `constructor` rejected everywhere
- Dense arrays with own data elements only; no extra/symbol/hidden properties. Objects use enumerable own string data properties. Cycles, class instances, functions, getters and undefined are rejected
- Strings≤32,768 UTF-16 code units; unpaired surrogates rejected. JSON data strings can contain escaped control characters; names/reasons cannot
- Payloads and patch values≤512KiB UTF-8 compact JSON,≤20,000 nodes, depth≤20
- Full project≤4MiB UTF-8 compact JSON and imported bytes,≤120,000 nodes and depth≤28. Parser itself stops nested input beyond32
- User-authored pointer≤1,024 code units, at most20 segments; profile key restrictions also apply to decoded pointer segments
- Names≤120, reasons≤500 characters, at most256 non-overlapping contract source subtrees per fixture
- A migration has a2,000,000-node validation-work budget. Browser verification also runs in an interruptible worker with a6-second wall-clock budget

Caps are explicit constants in the tested engine. Changing them requires rebuilding and rerunning tests. They cannot be bypassed by project data. JSON exports use a compact fallback if indentation would exceed the import/runner cap. Import bytes use fatal UTF-8 decoding, with no replacement of malformed bytes. BOM-prefixed JSON is not supported.

## JSON Patch semantics

Pointers address `payload`, never the envelope's version. Empty pointer refers to the root. Escape `/` as `~1`, `~` as `~0`, decoded in that order. Empty object-key segments are allowed. URI-fragment pointers are not accepted. Array indices use canonical nonnegative decimal text without leading zeros; `-` means append only for add-like destinations.

Operations run sequentially on a clone. Add at an existing object key replaces it; add into an array inserts and shifts positions. Move removes the source first and evaluates the destination afterward. A move into the source's proper descendant fails. Copy deep-copies its source. Test uses type-aware deep equality, ignoring object order and retaining array order. Null is distinct from missing. Root add/replace are supported. Root remove is a documented profile boundary and fails.

Any operation failure returns `{ok:false,error,...}` without a partial output; the caller input is untouched. A failure in a later version likewise returns no partial envelope. The version is only present in a successful returned envelope. Overwrite warnings include operation index, transition, destination and a1,000-character preview of the prior value. Equal-value overwrites still warn. Array insertion is not an overwrite. Per-version before/after previews are capped at2,000 characters and clearly labeled as previews.

## Preservation and intent

Original leaves are primitive/null values and empty objects/arrays. Contracts refer to source subtrees, so a valid whole-subtree contract covers all its original descendant leaves. Contract sources may not overlap; each old leaf is covered by at most one explicit declaration.

Preserve requires old source and new target to exist and be deeply equal. Change requires a reason, an old source, and a new target equal to the same target in the independently expected output. Drop requires a reason, old source existence and final absence of that original path. A missing old source fails, even if it covers no leaves.

An uncovered old leaf passes as **same-path-equal** only if that exact path exists afterward with an equal value. This does not establish identity, causality or the route by which a value arrived there. StateCarry never matches equal values at unrelated locations to infer a move. Array positions are not entity IDs. Explicit drop on `/items/0` fails if a shifted item still occupies that path; a declared whole-array change may be the appropriate contract.

Any changed/disappeared original leaf without a successful declaration is unreviewed and blocks contract success. New output fields are checked by the whole independent expected output. The UI shows first250 original leaves with a limit notice; the report includes all leaves. Before/after editor previews cap at20,000 characters; saved JSON and exports preserve full bounded data.

## Result meaning

Execution, expected-result match and preservation are separate fields. A fixture passes only when its independent expectation matches and, for successful migrations, all contracts/accounting pass. Expected failures can pass with preservation not-run. Unasserted fixtures and an empty fixture set never pass. Overwrites remain warnings even if the fixture passes intentionally.

These results apply only to the saved fixtures and declarations. They do not prove universal data preservation, schema validity for a real app, storage atomicity, rollback, operational safety or business demand.

Generated original-leaf paths may exceed the user-pointer text cap when valid nested keys are long. Accounting resolves those already-validated segments internally; this does not increase the limit on user-authored patch or contract pointers. Public envelope and operation APIs validate descriptors and container shape before reading members.

## Report resource budget

Accounting is built one original leaf at a time, with a shared conservative 8 MiB budget across all fixtures, contract checks and migration results. Entries are charged before retention. Exhaustion throws a StateError with code RESOURCE_LIMIT and returns no partial report that could appear to pass. The final serialized report is also capped at 8 MiB. This is separate from a fixture's expected migration error: a report-construction limit aborts verification rather than passing an expected-error fixture.

HTML export charges the actual UTF-8 bytes of bounded escaped chunks before retaining them, including pretty-print whitespace and markup. Exceeding 16 MiB rejects export with RESOURCE_LIMIT before joining the report, instead of truncating it. Project, fixture and pure-module exports remain available within their own bounds. Worker failures mark the UI stale and invalidate terminal callbacks; old pass totals are cleared at rerun.

Nonempty container type and identity are not separate original leaves. For example, changing `{"a":{"0":7}}` to `{"a":[7]}` leaves `/a/0` equal at the same path. A full independent expected output can allow that change without a separate leaf change declaration. Nonempty container shape is therefore checked by the whole expectation or an explicit subtree preservation contract, not independently classified by leaf accounting.
