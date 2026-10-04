# Third-party notices

No third-party implementation code is embedded in StateCarry's runtime engine, generated migration module or static interface. No project license grant is added by this work.

## JSON Patch test corpus

The unmodified `tests/vendor/tests.json` and `tests/vendor/spec_tests.json` come from [json-patch/json-patch-tests](https://github.com/json-patch/json-patch-tests) at commit `2a928f9044aad35c74e2788d498bcf2c6b91adea`.

Copyright2014 The Authors. Licensed under the Apache License, Version2.0. The upstream README and package metadata are retained as `upstream-README.md` and `upstream-package.json`, including their original attribution/license notice. A full Apache2.0 license copy is retained as `APACHE-2.0.txt`. File hashes and source provenance are recorded in `source.json` and `SHA256SUMS`. The corpus files are unchanged.

## Independent test dependencies

- python-json-patch/jsonpatch1.33, by Stefan Kögl and contributors, BSD3-Clause. The upstream notice is retained in `tests/vendor/python-jsonpatch-LICENSE`
- jsonpointer3.0.0, by Stefan Kögl and contributors, BSD3-Clause. The upstream notice is retained in `tests/vendor/python-jsonpointer-LICENSE`
- @playwright/test1.56.0 and Playwright development dependencies, Apache2.0. npm installations retain upstream package notices; versions/integrities are in `package-lock.json`

Python dependencies are installed only for independent development tests, pinned by version and downloaded-wheel SHA256 in `tests/requirements.txt`. They are not bundled into browser runtime or generated artifacts. Source ZIPs exclude installed packages and browser binaries. Node and Python retain their own distribution licenses.

RFC6901 and RFC6902 are linked for standards reference, not redistributed. No competitor code, fonts, artwork or branding is included.

The Playwright development lock also records optional macOS dependency fsevents 2.3.2 under its MIT license. It is not installed on Linux or included in the static/runtime bundles. Its official npm metadata is https://registry.npmjs.org/fsevents/2.3.2; standard npm installations retain the package's license.
