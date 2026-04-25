# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2026-04-25

### Changed

- New extension icon (256x256, optimised). Replaces the prior icon with a darker dark-slate-blue background and a green motif.
- `galleryBanner.color` updated from `#1f1f1f` to `#3E4557` to match the new icon background, eliminating the seam between banner and icon on the Marketplace listing.

## [0.3.4] - 2026-04-25

### Fixed

- README marketplace badges. shields.io retired its `visual-studio-marketplace` endpoint and now serves a literal "retired badge" image. Switched the version, install count, and rating badges to `vsmarketplacebadges.dev` which serves live data. Marketplace listing must be rebuilt for the README update to ship.

## [0.3.3] - 2026-04-25

### Internal

- Marketplace metadata polish. `package.json` now declares `qna: "marketplace"` to enable the Q&A tab on the Marketplace listing and a `galleryBanner` (`#1f1f1f`, `dark` theme) so the listing header contrasts with the icon. The README gained a top-of-page badge row (Marketplace version, installs, rating, CI status, license) and a one-line GPL-3.0 rationale near the License section. New `RELEASING.md` documents the publisher account facts (`acolovic`, owned by `chola.94@live.com`), the tag/build/publish/mirror flow, and the rollback path. New `CONTRIBUTING.md` covers local setup, the JSDoc-only comment convention, the keyword and builtin-function parity rules, and commit/PR conventions. No code or behaviour change.

## [0.3.2] - 2026-04-25

### Internal

- Build hardening. The esbuild bundle now pins `--target=node16` to match the lowest VS Code engine the extension declares (`^1.80.0`, Electron 22, Node 16) and emits an external sourcemap (`out/extension.js.map`) in production so wild stack traces map back to TypeScript. `tsconfig.json` now sets `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` on top of `strict`. A `prepublishOnly` script runs lint+test+`tsc` for `npm publish`; `vscode:prepublish` now also runs lint and test before the minified bundle. `.vscodeignore` was rewritten as an `out/` allowlist (`out/extension.js` plus its sourcemap only) so the published `.vsix` no longer ships TypeScript sources, compiled tests, ESLint or Jest config, or `.github/` workflows.

## [0.3.1] - 2026-04-25

### Internal

- Expanded test coverage and added a fixture-based test layout. The new `src/test/fixtures/` directory holds `*.input.aql` / `*.expected.aql` pairs picked up automatically by `src/test/fixtures.test.ts`; adding a case is two files and no test code edits. Set `UPDATE_FIXTURES=1` when running the suite to rewrite every `*.expected.aql` from the current formatter output. The tmLanguage parity tests now use a tokeniser-grade regex extractor and include negative cases that prove the assertion fails when the TS exports drift from the grammar. New idempotency suite asserts `format(format(q)) === format(q)` across representative queries and three `FormatOptions` variants (default, `keywordCase: 'lower'`, `trailingComma: 'multiline'`). No user-visible behaviour change.

## [0.3.0] - 2026-04-25

### Added

- `aql-formatter.keywordCase` setting (`upper` | `lower` | `preserve`, default `upper`). Controls the case of all AQL keywords, including the boolean and null literals (`TRUE`, `FALSE`, `NULL`). `preserve` echoes the source token's original spelling.
- `aql-formatter.trailingComma` setting (`none` | `multiline` | `always`, default `none`). Adds a trailing comma to array and object literals. `multiline` only inserts one when the literal is broken across lines; `always` inserts one for single-line literals as well. Parenthesized subqueries and function call argument lists are not affected.
- Builtin function highlighting. Common AQL builtins (`LENGTH`, `CONCAT`, `DATE_*`, `GEO_*`, etc.) now match the `support.function.builtin.aql` TextMate scope so themes color them distinctly from user-defined function calls. The set is sourced from `src/builtin-functions.ts`; a parity test keeps the TS export and the grammar regex aligned.
- On-type formatting provider. Typing `}`, `)`, or `]` on an otherwise blank line snaps the line's indent to match the matching opener. No full reformat is performed.

## [0.2.1] - 2026-04-25

### Changed

- Faster formatting on large queries. Width estimation no longer flattens nested groups into intermediate token arrays and short-circuits as soon as the running width exceeds `printWidth`. The tokenizer now uses indexed regex captures and skips emitting whitespace tokens when the formatter does not need them. On a synthetic 20 KB query, end-to-end format time is roughly halved.

## [0.2.0] - 2026-04-25

### Added

- Diagnostics surface: the formatter now publishes warnings via a `vscode.languages.createDiagnosticCollection('aql')` collection. Surfaced conditions are unmatched closing brackets, unclosed bracket groups, and unterminated string literals or block comments.
- `OPTIONS { ... }` clauses following data-modification clauses (`INSERT`, `UPDATE`, `REPLACE`, `REMOVE`, `UPSERT`) are now formatted on their own continuation-indented line. The brace body still follows the existing `printWidth` multiline-vs-inline logic.

### Changed

- The `//` scope separator now only resets indentation when written at the document top level. Inside a subquery, brace, or bracket literal it renders as a regular line comment so the surrounding scope is no longer corrupted.

### Removed

- Range formatting provider. The previous range formatter started at indent zero and produced incorrect output when the selection began inside a `FOR` body. VS Code falls back to whole-document formatting.

## [0.1.3] - 2026-04-25

### Added

- GitHub Actions CI workflow running lint, tests, and packaging on Node 18 and 20.
- `CHANGELOG.md` following Keep a Changelog.
- `keywords`, `bugs`, and `homepage` metadata in `package.json` for marketplace SEO and issue reporting.

### Changed

- README install snippet now uses a version-agnostic glob (`aql-formatter-*.vsix`).

### Removed

- Stale `aql-formatter-0.1.2.vsix` build artifact from the working tree (already ignored by git).

## [0.1.2] - 2026-04-04

### Added

- Empty-comment scope separator (`//` on its own line) splits independent statement groups.
- Preserve original comment positioning (inline comments stay inline; own-line comments stay on their own line).

### Changed

- Stricter lint configuration: `@typescript-eslint/no-non-null-assertion` and `@typescript-eslint/no-explicit-any` set to `error`.
- Removed all non-null assertions from the source.

## [0.1.1] - 2026-04-01

### Changed

- Display name updated to "ArangoDB Query Language Formatter (AQL)".
- Regenerated `package-lock.json`.
- Publisher and repository URL pointed to personal accounts.

## [0.1.0] - 2026-04-01

### Added

- Initial release.
- AQL tokenizer and CST builder.
- AQL formatter engine: clause keywords on their own lines, indented `FOR` bodies, subquery handling, multiline arrays/objects past `printWidth`, keyword normalization to UPPERCASE, comment and string preservation, whitespace cleanup.
- VS Code extension entry point with formatter registration.
- AQL TextMate grammar and language configuration (bracket matching, comment toggling).
- Configuration setting `aql-formatter.printWidth` (default 80).
- Test suite covering tokenizer, formatter, and keyword tables.
- README with usage instructions and feature overview.

[0.3.5]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.5
[0.3.4]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.4
[0.3.3]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.3
[0.3.2]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.2
[0.3.1]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.1
[0.3.0]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.3.0
[0.2.1]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.2.1
[0.2.0]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.2.0
[0.1.3]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.3
[0.1.2]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.2
[0.1.1]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.1
[0.1.0]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.0
