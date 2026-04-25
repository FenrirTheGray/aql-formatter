# AQL Formatter

A Visual Studio Code extension that provides **formatting** and **syntax highlighting** for [ArangoDB Query Language (AQL)](https://docs.arangodb.com/stable/aql/).

## Features

### Formatting

Trigger with `Shift+Alt+F` (or your configured format shortcut) on any `.aql` file.

- Puts each clause keyword on its own line (`FOR`, `FILTER`, `LET`, `SORT`, `LIMIT`, `COLLECT`, `RETURN`, `INSERT`, `UPDATE`, `REPLACE`, `REMOVE`, `UPSERT`, `SEARCH`, `WINDOW`, etc.)
- Auto-indents `FOR` loop bodies, including nested loops
- Handles subqueries in parentheses with proper scope and indentation
- Breaks long arrays and objects into multiline format when they exceed the configured print width
- Normalizes keywords to UPPERCASE
- Preserves comments and string literals
- Supports `//` as a scope separator to split independent statement groups
- Preserves comment placement (inline comments stay inline, own-line comments stay on their own line)
- Cleans up extraneous whitespace

**Before:**

```aql
FOR doc IN collection FILTER doc.active == true SORT doc.name ASC LIMIT 10 RETURN { name: doc.name, email: doc.email }
```

**After:**

```aql
FOR doc IN collection
  FILTER doc.active == TRUE
  SORT doc.name ASC
  LIMIT 10
  RETURN { name: doc.name, email: doc.email }
```

### Syntax Highlighting

- Clause keywords and operator keywords
- String literals (single, double, and backtick quoted)
- Numeric literals (integer, float, hex)
- Line and block comments
- Boolean and null constants
- Bind parameters (`@param`, `@@collection`)
- Function calls
- Operators

### Language Support

- Bracket matching and auto-closing
- Comment toggling (`Ctrl+/`)

## Configuration

| Setting                    | Default | Description                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------ |
| `aql-formatter.printWidth` | `80`    | Maximum line width before breaking objects or arrays into multiple lines |

## Installation

### From VSIX (local)

```bash
cd aql-formatter
npm install
npx @vscode/vsce package
code --install-extension aql-formatter-*.vsix
```

### From Source (development)

1. Open the `aql-formatter` folder in VS Code
2. Run `npm install`
3. Press `F5` to launch the Extension Development Host
4. Open any `.aql` file and format it with `Shift+Alt+F`

## Supported AQL Constructs

| Construct         | Example                                           |
| ----------------- | ------------------------------------------------- |
| Basic queries     | `FOR`, `FILTER`, `SORT`, `LIMIT`, `RETURN`        |
| Variable binding  | `LET x = ...`                                     |
| Aggregation       | `COLLECT ... WITH COUNT INTO ...`                 |
| Subqueries        | `LET x = (FOR ... RETURN ...)`                    |
| Data modification | `INSERT`, `UPDATE`, `REPLACE`, `REMOVE`, `UPSERT` |
| Graph traversal   | `FOR v, e, p IN 1..3 OUTBOUND ... GRAPH ...`      |
| Search            | `SEARCH`, `WINDOW`                                |
| Named collections | `WITH users, friends`                             |
| Scope separator   | `//` on its own line resets indentation scope      |

## Development

```bash
npm install          # install dependencies
npm run compile      # compile TypeScript
npm run watch        # compile + watch for changes
npm test             # run tests
npm run lint         # run ESLint
```

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE). GPL-3.0 was chosen to keep derivative editor extensions open source.
