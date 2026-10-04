# Data handling and execution boundaries

StateCarry accepts bounded JSON as data. It never evaluates user-authored JavaScript, templates, formulas or shell commands. All pointer segments and operations are interpreted by a fixed engine. The browser's worker is built from that trusted engine source; project data is sent as a message. Generated modules serialize plan values as JSON literals and freeze the embedded plan.

No app storage, localStorage, IndexedDB, filesystem discovery, database, network, analytics or automatic persistence is used by the runtime. Downloads require explicit UI actions. The Node fixture runner accepts only a regular file named by the caller, checks the opened descriptor, reads at most 4 MiB plus one overflow-detection byte, and writes no project data. No automatic migration of real saved files is performed.

Imports are capped, strictly parsed, UTF-8 validated and atomically applied. Duplicate keys, lossy numeric literals, sparse arrays, non-JSON values, hidden/accessor properties and reserved prototype-sensitive names are rejected under the portable profile. UI text uses textContent. HTML review reports are escaped, script-free and block external content. Migration works on a clone and does not return partial output after failure.

The browser policy restricts scripts/styles to the same origin, denies connections/objects/forms, and allows its trusted bundled module worker through blob URLs. No imported data is executable worker source. The same already-loaded worker source enables offline reruns without fetching a new worker script. Verification is cancelled on edits and has a six-second browser budget. Session Undo keeps up to20 prior projects in memory; reload resets the workspace.

Tests and examples use synthetic data. Keep private saved projects out of public repositories and shared reports. Passing fixture/contract checks do not establish real-app schema correctness, safe storage writes, backups, rollback or universal preservation. Existing-destination warnings deserve explicit review even when values happen to match.

The browser test runner requires Chromium sandboxing. It does not disable the sandbox, change host security configuration or use prohibited local-browser routes. Initial browser execution and visual inspection remain unperformed and are disclosed in the verification record.

Aggregate original-leaf/report retention is capped conservatively at 8 MiB while entries are constructed. HTML rendering enforces a 16 MiB emitted UTF-8 limit while appending bounded escaped chunks. Overflow is an explicit RESOURCE_LIMIT failure, never a truncated passing report. Plain envelopes, operation arrays and standard array prototypes are checked before serialization or member access.
