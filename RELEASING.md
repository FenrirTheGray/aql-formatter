# Releasing

This document describes the steps required to ship a new version of the AQL Formatter extension to the Visual Studio Marketplace (and, optionally, Open VSX).

## Prerequisites

- **Marketplace publisher:** `acolovic` (matches `package.json:publisher`).
- **Owner Microsoft account:** `chola.94@live.com`. This is **not** the git author email (`tek.aleksandar@gmail.com`).
- **Personal Access Token (PAT):** must be issued from Azure DevOps while signed in as `chola.94@live.com`. The PAT scope must include `Marketplace > Manage`.
- **Open VSX token (optional):** stored in `OVSX_TOKEN` environment variable for the mirror step.

A working alternative to a PAT is the manual drag-and-drop upload on the publisher dashboard at <https://marketplace.visualstudio.com/manage/publishers/acolovic>.

## Pre-release safety

`package.json` already chains lint and tests through both `prepublishOnly` (used by `npm publish`) and `vscode:prepublish` (used by `vsce package` / `vsce publish`). Before tagging, also run them explicitly:

```bash
npm run lint
npm test
```

Both must be green. CI runs the same commands on Node 18 and 20 against every push and PR.

## Steps

1. **Update `CHANGELOG.md`.** Move entries under `[Unreleased]` (or the in-progress version section) to a dated `[X.Y.Z] - YYYY-MM-DD` heading and add a matching reference link at the bottom of the file.
2. **Bump the version.**
   ```bash
   npm version patch --no-git-tag-version    # or minor / major
   git add package.json package-lock.json CHANGELOG.md
   git commit -m "chore: release vX.Y.Z"
   git tag vX.Y.Z
   ```
3. **Push the tag and commit.**
   ```bash
   git push --follow-tags
   ```
4. **Build the `.vsix`.** Either build locally or download the artifact attached to the CI run for the tag.
   ```bash
   npx @vscode/vsce package
   ```
   This produces `aql-formatter-X.Y.Z.vsix` in the repo root.
5. **Verify package contents.**
   ```bash
   npx @vscode/vsce ls
   ```
   Expected entries: `README.md`, `package.json`, `LICENSE`, `language-configuration.json`, `icon.png`, `CHANGELOG.md`, `syntaxes/aql.tmLanguage.json`, `out/extension.js`, `out/extension.js.map`. Anything else means `.vscodeignore` has drifted.
6. **Publish to the Marketplace.** Pick one path:
   - **CLI:** sign in once with `vsce login acolovic`, then
     ```bash
     npx @vscode/vsce publish --packagePath aql-formatter-X.Y.Z.vsix
     ```
   - **UI:** drag-and-drop the `.vsix` at <https://marketplace.visualstudio.com/manage/publishers/acolovic>.
7. **Mirror to Open VSX (optional, recommended).**
   ```bash
   npx ovsx publish aql-formatter-X.Y.Z.vsix -p "$OVSX_TOKEN"
   ```
8. **Create a GitHub Release** at the tag and attach the `.vsix` so users can install it directly without the Marketplace.

## Rollback

The Marketplace allows unpublishing a specific version from the publisher dashboard. Treat this as a last resort: it is better to ship a follow-up patch release than to retract a published version.

Open VSX supports the same workflow under <https://open-vsx.org/user-settings/extensions>.
