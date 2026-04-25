# Contributing

Thanks for your interest in improving AQL Formatter. Bug reports, fixture-driven test cases, and small focused PRs are all welcome.

## Local setup

```bash
npm install
```

That installs the dev dependencies needed to compile, lint, test, and package the extension.

## Running the extension

1. Open the repo in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Open any `.aql` file in the host window and format it with `Shift+Alt+F`.

## Tests and lint

```bash
npm test          # Jest, 5 suites
npm run lint      # ESLint over src/
```

Both must pass before opening a PR. CI runs the same commands on Node 18 and 20.

To regenerate every `*.expected.aql` fixture from the current formatter output:

```bash
UPDATE_FIXTURES=1 npm test
```

Use this when an intentional formatter change shifts a lot of expected output. Review the resulting diff carefully.

## Coding style

- Defer to the ESLint config (`eslint.config.mjs`). `npm run lint` is the source of truth.
- Code comments are JSDoc-only (`/** ... */`). Default to writing no comment unless the *why* is non-obvious.
- TypeScript `strict` plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`, and `noFallthroughCasesInSwitch` are enabled. New code must compile with `npm run compile` clean.
- No non-null assertions (`!`) and no `any`.

## Where things live

- **Keywords:** `src/keywords.ts` lists every AQL keyword recognised by the formatter. The TextMate grammar at `syntaxes/aql.tmLanguage.json` mirrors this list. A parity test in `src/test/` will fail if the two drift.
- **Builtin functions:** `src/builtin-functions.ts` holds the canonical builtin list used by both the formatter and the grammar's `support.function.builtin.aql` scope. The same parity rule applies.
- **Formatter pipeline:** `src/tokenizer.ts` -> `src/cst.ts` -> `src/formatter.ts`. The on-type provider lives in `src/on-type.ts`. The extension entry point is `src/extension.ts`.
- **Tests and fixtures:** `src/test/`. Fixture-based cases sit under `src/test/fixtures/` as `*.input.aql` / `*.expected.aql` pairs and are picked up automatically; new cases need no test code.

## Commit and PR conventions

- Short, imperative commit subjects (~70 chars). Match the existing log style: `feat:`, `fix:`, `docs:`, `chore:`, `build:`, `test:`.
- Keep commits atomic. One logical change per commit makes review and bisection easy.
- Reference issue numbers in the body when relevant.

## License

By contributing, you agree that your contributions are licensed under the GNU General Public License v3.0, the same license as the rest of the project.
