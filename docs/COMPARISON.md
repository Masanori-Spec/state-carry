# Usefulness and existing products

Sources checked2026-10-04. These observations are based on official documentation/project pages, not an exhaustive market or patent search and not independently operated competitor products.

## Concrete job

A saved-project format changes while older project files still exist. A syntactically correct migration may overwrite an already-populated destination or drop a user-defined field. StateCarry rehearses the explicit version chain against independent expected fixtures, accounts for original leaves through equality/preservation/intent declarations, and exports the tested migration with runnable references.

## Existing coverage and the narrower difference

- [Zustand persist](https://zustand.docs.pmnd.rs/reference/middlewares/persist) already provides persisted versions and migration functions. Its documentation distinguishes storage serialization from runtime shape validation. A new generic migration function alone would offer little differentiation. StateCarry is a review workbench; it does not replace a persistence middleware
- [Verdant migrations](https://verdant.dev/docs/local-storage/migrations) already generates migration files, retains schema history and supports migration paths/shortcuts. StateCarry deliberately uses only a linear adjacent chain and no storage runtime
- [NothingLeaves JSON Mapping Tool](https://nothingleaves.com/json-mapping-tool/) already offers browser-local visual JSON mapping and code generation. Local processing, a mapping interface and generated code are not sufficient differentiators
- [tldraw schema guidance](https://github.com/tldraw/tldraw/blob/main/packages/tlschema/README.md) treats migration tests as part of persisted schema changes. This supports the practical relevance of test artifacts, not a claim that the need is unserved

The narrower workflow here is preservation-first review with independently authored fixture outputs, deliberate change/removal reasons, explicit original-leaf accounting and the same tested artifact exported for integration. Its usefulness is a hypothesis, not validated demand. No customers were contacted, adoption measured or savings established. There is no novelty, patentability or universal losslessness claim.

## Technical grounding

[RFC6902](https://datatracker.ietf.org/doc/html/rfc6902) defines ordered JSON Patch operations, including add/replace/remove/move/copy/test and failure behavior. [RFC6901](https://www.rfc-editor.org/rfc/rfc6901) defines JSON Pointer escaping and evaluation. StateCarry uses these standards inside a documented portable JSON/resource profile; it does not invent a transformation expression language.

The [JSON Patch test corpus](https://github.com/json-patch/json-patch-tests/tree/2a928f9044aad35c74e2788d498bcf2c6b91adea) is pinned and retained with upstream attribution. [Python jsonpatch](https://python-json-patch.readthedocs.io/en/latest/tutorial.html) is a separately implemented differential reference. A separate small Python pointer/equality/assertion oracle checks StateCarry's contract semantics.
