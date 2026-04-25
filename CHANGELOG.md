# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.2.0
[0.1.3]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.3
[0.1.2]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.2
[0.1.1]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.1
[0.1.0]: https://github.com/FenrirTheGray/aql-formatter/releases/tag/v0.1.0
