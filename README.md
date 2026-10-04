# StateCarry

**形式が変わっても、大切なデータは連れていく。**

StateCarry rehearses saved-project upgrades against independently authored fixtures and preservation contracts. It separates three questions:

1. Did the migration operations execute?
2. Did the result match the independent expectation?
3. Did the preservation/intent contract account for the original values?

A patch can execute correctly while overwriting a user-authored destination. A passing output fixture can still leave an undeclared data change. StateCarry makes those distinctions visible and exports the same tested engine with the reviewed plan.

## Start locally

Requires Node.js22+. Python3.10+ is used only for independent development tests.

```sh
npm ci --ignore-scripts
npm run build
npm run serve
# http://127.0.0.1:4173
```

`dist/` is a static website and supports a nested hosting path such as `/state-carry/`. Serve over HTTP(S); opening an HTML file directly is not the supported module workflow. No external runtime package, font, analytics or storage service is loaded. After the application modules load, verification runs in a bundled local worker and works offline. Offline reload is not promised.

## Three-minute demonstration

The synthetic Harbor editor has versions1→2→3. Version1 stores a title at `/title`, with an explicit null placeholder at `/metadata/title`. Version2 moves the title. Version3 adds presentation settings.

- The ordinary fixture preserves unknown custom fields, ordered items and empty containers
- A collision fixture already contains an owner-authored destination title and independently expects rejection
- An intermediate-version fixture begins atv2, so coverage is not limited to the oldest format

The initial plan overwrites the collision title and passes only2/3 fixtures. Add a `test` of `/metadata/title` against `null` before the move, or open the guarded reference example. The original inputs, expected results and contracts are identical between the two examples. With the guard,3/3 fixtures pass: the collision now fails deliberately before output is returned.

日本語・英語の画面を切り替えられます。期待値を実行結果から自動生成する機能はありません。編集後の結果は未検証になり、再実行するまで移行成果物の出力は無効になります。作業はセッション内だけで保持するため、再読み込み前にJSONで保存してください。

## What is included

- Explicit consecutive version chain, up to16 versions
- RFC6902 add/remove/replace/move/copy/test, with guided authoring and raw JSON editing
- Clone-first execution; errors return no partial migrated output and never modify the caller's input
- Existing-destination overwrite warnings and bounded per-version before/after previews
- Independent expected JSON output, expected failure, or clearly unasserted exploratory fixtures
- Explicit preservation mappings and intentional change/removal declarations
- Original-leaf accounting, including empty objects and arrays
- Project JSON, pure migration module, fixture JSON, dependency-free Node runner and printable HTML review

## Preservation semantics

- **preserve:** old source subtree must equal the explicitly named new target subtree
- **change:** old source must exist; new target must match the independently expected output; a reason is required
- **drop:** old source must exist and the same path must be absent afterward; a reason is required
- **same-path-equal:** an uncovered original leaf has the same value at its original path. This is an observation, not proof of identity or causal preservation
- **unreviewed:** an original leaf changed/disappeared without a successful explicit declaration

Source subtrees of contracts cannot overlap. Values found elsewhere do not imply a move. Array pointers are positions, not item identities: deleting index0 may shift another item into that path, so a drop declaration for that path fails. Use an explicit whole-array change contract with an independently expected result when that represents the intended change.

An expected migration failure can pass a negative fixture, but post-migration preservation checks remain **not run**. A fixture with an unasserted expectation cannot pass. Nonempty container shape is checked by the full expected output or an explicit subtree contract, not separately classified as a leaf. Passing fixtures never mean “all user data is safe.”

## Export and integrate

Save these files together:

- `statecarry-migration.mjs`
- `statecarry-fixtures.json`
- `statecarry-run.mjs`

```sh
node statecarry-run.mjs statecarry-fixtures.json
```

Exit0 means every fixture expectation and applicable contract passed. Exit1 means mismatch/incomplete coverage. Exit2 means invalid input or runner failure.

The module exports `migrateSaved(envelope)` and a deeply frozen plan. It has no storage/network/file calls. The runner reads the fixture file you explicitly name; it never migrates or rewrites a user's actual project files. See [integration guidance](docs/INTEGRATION.md).

## Development verification

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r tests/requirements.txt
PYTHON=.venv/bin/python npm run check
```

At the reviewed freeze:158 tests passed, including108 enabled pinned JSON Patch corpus cases; four upstream-disabled cases remain skipped. An independent Python jsonpatch1.33 differential run covered1,200 patch sequences. A separate Python pointer/equality/contract oracle covered1,000 preservation cases. Exported modules and runners were actually executed against passing, intentionally failing and invalid fixtures.

The15-scenario sandboxed Chromium suite and Ubuntu22.04 CI are authored but **not run at the initial freeze**. Desktop/mobile/print visual inspection and hosted verification are also unrun. See [verification details](docs/VERIFICATION.md).

## Deliberate limits

No arbitrary JavaScript, expressions, conditions, branching versions, downgrade/rollback generator, database connection, browser-storage import or automatic application to real saved files. The portable JSON profile rejects duplicate keys, prototype-sensitive keys, negative zero, unsafe/rounding numeric literals, sparse arrays, non-JSON values and resource overflows. Root replacement is supported; removing the entire document is rejected because the exported API always represents a JSON payload. Full details: [format and limits](docs/FORMAT.md).

Existing migration runtimes, JSON mappers and tests already solve significant parts of this space. This project focuses on preservation-first review with independent fixtures and a reusable tested artifact. It makes no novelty, demand, adoption or losslessness claim. [Primary-source comparison](docs/COMPARISON.md) · [Interview explanation](docs/INTERVIEW.md).

No project license grant was added. Third-party corpus/dependency attribution and required notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `tests/vendor/`.
