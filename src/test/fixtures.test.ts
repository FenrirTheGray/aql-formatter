import * as fs from 'fs';
import * as path from 'path';
import { formatAql, FormatOptions } from '../formatter';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

interface Fixture {
  name: string;
  inputPath: string;
  expectedPath: string;
  input: string;
  expected: string;
}

/**
 * Loads every `*.input.aql` / `*.expected.aql` pair under `src/test/fixtures/`.
 *
 * Convention:
 *   - A fixture is a pair of files sharing the same stem: `<name>.input.aql`
 *     and `<name>.expected.aql`.
 *   - The `*.input.aql` file holds raw, unformatted AQL.
 *   - The `*.expected.aql` file holds the formatter output for the default
 *     `FormatOptions` (`tabSize: 2, insertSpaces: true, printWidth: 80`).
 *   - Files are read as UTF-8. The expected file's bytes must exactly match
 *     the formatter output, including the trailing newline.
 *
 * Update workflow:
 *   - Adding a fixture is "drop two files; no test code edits."
 *   - To regenerate every `*.expected.aql` from the current formatter output,
 *     run `UPDATE_FIXTURES=1 npm test`. The first test in this suite rewrites
 *     each expected file in place when that environment variable is set.
 *
 * The loader sorts pairs by name for deterministic test ordering and throws
 * loudly if an `*.input.aql` is missing its expected counterpart (or vice
 * versa) so half-staged fixture pairs cannot silently pass.
 */
export function loadFixtures(dir: string = FIXTURES_DIR): Fixture[] {
  const entries = fs.readdirSync(dir);
  const inputs = new Set<string>();
  const expecteds = new Set<string>();
  for (const entry of entries) {
    if (entry.endsWith('.input.aql')) inputs.add(entry.slice(0, -'.input.aql'.length));
    else if (entry.endsWith('.expected.aql')) expecteds.add(entry.slice(0, -'.expected.aql'.length));
  }

  const orphanedInputs = [...inputs].filter(n => !expecteds.has(n));
  const orphanedExpecteds = [...expecteds].filter(n => !inputs.has(n));
  if (orphanedInputs.length > 0) {
    throw new Error(`Fixture inputs without expected: ${orphanedInputs.join(', ')}`);
  }
  if (orphanedExpecteds.length > 0) {
    throw new Error(`Fixture expecteds without input: ${orphanedExpecteds.join(', ')}`);
  }

  const names = [...inputs].sort((a, b) => a.localeCompare(b));
  return names.map(name => {
    const inputPath = path.join(dir, `${name}.input.aql`);
    const expectedPath = path.join(dir, `${name}.expected.aql`);
    return {
      name,
      inputPath,
      expectedPath,
      input: fs.readFileSync(inputPath, 'utf-8'),
      expected: fs.readFileSync(expectedPath, 'utf-8'),
    };
  });
}

const DEFAULT_OPTIONS: FormatOptions = { tabSize: 2, insertSpaces: true, printWidth: 80 };

describe('Fixture-based formatting', () => {
  const fixtures = loadFixtures();

  it('loads at least one fixture pair', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  if (process.env.UPDATE_FIXTURES === '1') {
    for (const f of fixtures) {
      it(`updates expected for ${f.name}`, () => {
        const out = formatAql(f.input, DEFAULT_OPTIONS).text;
        fs.writeFileSync(f.expectedPath, out, 'utf-8');
        expect(out).toBe(out);
      });
    }
    return;
  }

  for (const f of fixtures) {
    it(`formats ${f.name} to match its expected output`, () => {
      const out = formatAql(f.input, DEFAULT_OPTIONS).text;
      expect(out).toBe(f.expected);
    });
  }
});
