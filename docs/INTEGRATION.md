# Integrating a reviewed artifact

## Files and repeatable checks

Save the exported migration module, fixture JSON and runner in one directory. The migration module contains the exact tested engine source and a JSON-encoded, deeply frozen plan. It does not generate arbitrary user code, interpolate expressions or infer operations. Independent expected outputs remain in the separate fixture file.

```sh
node statecarry-run.mjs statecarry-fixtures.json
```

The runner accepts only a regular fixture file, rejecting directories, symbolic links and pipes. It validates the opened descriptor and reads at most 4 MiB plus one overflow-detection byte before decoding. The runner reads only the explicitly supplied fixture file. It prints a JSON review report and exits0 (all fixtures passed),1 (mismatch or incomplete) or2 (input/runner error). Keep the plan and independent fixture changes reviewable separately in version control. A changed fixture is a changed assertion, not evidence that a migration was fixed.

## Calling the pure module

```js
import { migrateSaved, validateEnvelope } from "./statecarry-migration.mjs";

// Your application chooses and validates the source; StateCarry does not read storage.
const original = { version: 1, payload: savedPayload };
validateEnvelope(original);
const result = migrateSaved(original);
if (!result.ok) {
  // Keep the original data and surface result.error to the caller.
  // No partial migrated output is returned.
} else {
  const candidate = result.value;
  // Validate candidate against your own app schema and review warnings.
  // Persistence, backups, locking and user approval belong to your integration.
}
```

`migrateSaved` returns a new envelope on success and does not mutate input. Invalid envelope/profile data throws a StateError; catch this at the app boundary. Operational patch failures, unsupported versions and exhausted migration work return explicit failed results. The baked version list is available as `PLAN.versions`; the latest entry is the only target. An already-current input is cloned unchanged. Other versions are not guessed or coerced.

Do not use this example as a ready-made storage write path. No storage implementation, locking, transaction, rollback, backup or user-data recovery has been tested here. Retain independent backups and test copies. Do not delete the original after an unreviewed warning. Validate actual application invariants with the owning application's schema and tests before integrating.

## Adding coverage

- Add at least one independently expected fixture for every supported historical starting version
- Include unexpected custom fields, empty containers, nulls, ordered arrays and previously populated rename destinations
- Include explicit expected failures for inputs that must be rejected
- Preserve the source snapshots and expected outputs when editing the plan
- Use test operations as explicit precondition guards; RFC6902 has no conditionals or migration branches
- Review same-path-equal observations as value comparisons, not tracked object identities
- Keep preservation and intent declarations narrow enough to be useful; broad whole-root change declarations can be technically valid but weak review evidence
- Re-run the downloaded artifact, not only the authoring interface

The browser's worker and generated module use the same engine source; the independently implemented Python tests reduce shared semantic mistakes. Neither substitutes for production integration testing or trusted fixture authoring.
