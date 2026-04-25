import * as fs from 'fs';
import * as path from 'path';
import { AQL_KEYWORDS, CLAUSE_KEYWORDS } from '../keywords';
import { BUILTIN_FUNCTIONS } from '../builtin-functions';

const GRAMMAR_PATH = path.resolve(__dirname, '../../syntaxes/aql.tmLanguage.json');

interface GrammarPattern {
  name?: string;
  match?: string;
}

interface Grammar {
  repository: Record<string, { patterns: GrammarPattern[] }>;
}

/**
 * Extracts the top-level alternation members from a tmLanguage `match` source.
 * Walks the regex character by character so escapes (`\.`, `\\`, `\(`), nested
 * non-capturing groups and lookaround anchors do not bleed into the alternation
 * tokens. The first capturing group whose body is a flat alternation of bare
 * names (uppercase letters, digits, underscores, separated by `|`) is returned.
 *
 * Returns null when the pattern contains no qualifying alternation group.
 */
function extractAlternationGroup(pattern: string): string[] | null {
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) { i += 2; continue; }
    if (ch === '(') {
      if (pattern.startsWith('(?', i)) {
        i += 2;
        while (i < pattern.length && /[a-zA-Z!:=<>-]/.test(pattern[i])) i++;
        continue;
      }
      let depth = 1;
      let j = i + 1;
      let body = '';
      while (j < pattern.length && depth > 0) {
        const c = pattern[j];
        if (c === '\\' && j + 1 < pattern.length) {
          body += pattern[j] + pattern[j + 1];
          j += 2;
          continue;
        }
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) break; }
        body += c;
        j++;
      }
      if (/^[A-Za-z0-9_]+(?:\|[A-Za-z0-9_]+)+$/.test(body)) {
        return body.split('|');
      }
      i = j + 1;
      continue;
    }
    i++;
  }
  return null;
}

/**
 * Reads and parses the tmLanguage grammar from disk. Centralised so individual
 * tests share a single I/O path and so the whole test file can be re-run
 * against an in-memory grammar by stubbing `fs.readFileSync`.
 */
function loadGrammar(): Grammar {
  return JSON.parse(fs.readFileSync(GRAMMAR_PATH, 'utf-8')) as Grammar;
}

function findPattern(grammar: Grammar, repoKey: string, name: string): GrammarPattern | undefined {
  return grammar.repository[repoKey].patterns.find(p => p.name === name);
}

describe('Keyword definitions', () => {
  it('CLAUSE_KEYWORDS should be a subset of AQL_KEYWORDS', () => {
    for (const kw of CLAUSE_KEYWORDS) {
      expect(AQL_KEYWORDS.has(kw)).toBe(true);
    }
  });

  it('extractAlternationGroup handles escapes, anchors and nested groups', () => {
    expect(extractAlternationGroup('(?i)\\b(FOR|FILTER|RETURN)\\b')).toEqual(['FOR', 'FILTER', 'RETURN']);
    expect(extractAlternationGroup('(?i)\\b(LENGTH|DATE_ISO8601|GEO_POINT)\\b(?=\\s*\\()')).toEqual(['LENGTH', 'DATE_ISO8601', 'GEO_POINT']);
    expect(extractAlternationGroup('\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()')).toBeNull();
    expect(extractAlternationGroup('==|!=|<=|>=')).toBeNull();
    expect(extractAlternationGroup('(?:foo|bar)(BAZ|QUX)')).toEqual(['BAZ', 'QUX']);
    expect(extractAlternationGroup('\\(literal\\)(A|B)')).toEqual(['A', 'B']);
  });

  it('should match clause keywords in tmLanguage grammar', () => {
    const grammar = loadGrammar();
    const clausePattern = grammar.repository['clause-keywords'].patterns[0].match;
    if (!clausePattern) throw new Error('clause-keywords pattern missing');
    const tmList = extractAlternationGroup(clausePattern);
    if (!tmList) throw new Error('Expected clause pattern to contain keyword alternation group');
    const tmKeywords = new Set(tmList);

    for (const kw of tmKeywords) {
      expect(CLAUSE_KEYWORDS.has(kw)).toBe(true);
    }
    for (const kw of CLAUSE_KEYWORDS) {
      if (kw === 'WITH') continue;
      expect(tmKeywords.has(kw)).toBe(true);
    }
  });

  it('should have all AQL_KEYWORDS represented in tmLanguage grammar', () => {
    const grammar = loadGrammar();

    const allGrammarKeywords = new Set<string>();

    const extractKeywords = (patterns: GrammarPattern[]) => {
      for (const p of patterns) {
        if (!p.match) continue;
        const group = extractAlternationGroup(p.match);
        if (group) {
          for (const kw of group) allGrammarKeywords.add(kw.toUpperCase());
        }
        const standalone = p.match.match(/^\(\?i\)\\b([a-zA-Z_]+)\\b$/);
        if (standalone) allGrammarKeywords.add(standalone[1].toUpperCase());
      }
    };

    extractKeywords(grammar.repository['clause-keywords'].patterns);
    extractKeywords(grammar.repository['keywords'].patterns);
    extractKeywords(grammar.repository['constants'].patterns);

    for (const kw of AQL_KEYWORDS) {
      expect(allGrammarKeywords.has(kw)).toBe(true);
    }
  });

  it('BUILTIN_FUNCTIONS should match the tmLanguage builtin alternation', () => {
    const grammar = loadGrammar();
    const builtinPattern = findPattern(grammar, 'functions', 'support.function.builtin.aql');
    expect(builtinPattern).toBeDefined();
    if (!builtinPattern || !builtinPattern.match) throw new Error('builtin pattern missing');

    const list = extractAlternationGroup(builtinPattern.match);
    if (!list) throw new Error('Expected builtin pattern to contain alternation group');
    const tmBuiltins = new Set(list);

    for (const fn of BUILTIN_FUNCTIONS) {
      expect(tmBuiltins.has(fn)).toBe(true);
    }
    for (const fn of tmBuiltins) {
      expect(BUILTIN_FUNCTIONS.has(fn)).toBe(true);
    }
  });

  it('builtin pattern should appear before the generic function pattern', () => {
    const grammar = loadGrammar();
    const functionsPatterns = grammar.repository['functions'].patterns;
    const builtinIdx = functionsPatterns.findIndex(p => p.name === 'support.function.builtin.aql');
    const genericIdx = functionsPatterns.findIndex(p => p.name === 'entity.name.function.aql');
    expect(builtinIdx).toBeGreaterThanOrEqual(0);
    expect(genericIdx).toBeGreaterThanOrEqual(0);
    expect(builtinIdx).toBeLessThan(genericIdx);
  });
});

describe('Parity negative cases', () => {
  /**
   * Compares the on-disk grammar against `BUILTIN_FUNCTIONS` after mutating one
   * side of the pair, to prove the parity assertion fails when the two drift.
   * Each scenario rebuilds the grammar in memory rather than touching the real
   * file on disk.
   */
  function builtinsFromGrammar(grammarText: string): Set<string> {
    const grammar = JSON.parse(grammarText) as Grammar;
    const builtinPattern = findPattern(grammar, 'functions', 'support.function.builtin.aql');
    if (!builtinPattern || !builtinPattern.match) throw new Error('builtin pattern missing');
    const list = extractAlternationGroup(builtinPattern.match);
    if (!list) throw new Error('builtin alternation extraction failed');
    return new Set(list);
  }

  it('detects a builtin present in TS but missing from the grammar', () => {
    const original = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
    const mutated = original.replace(/LENGTH\|/, '');
    const tmBuiltins = builtinsFromGrammar(mutated);
    expect(BUILTIN_FUNCTIONS.has('LENGTH')).toBe(true);
    expect(tmBuiltins.has('LENGTH')).toBe(false);
    const missing: string[] = [];
    for (const fn of BUILTIN_FUNCTIONS) {
      if (!tmBuiltins.has(fn)) missing.push(fn);
    }
    expect(missing).toEqual(['LENGTH']);
  });

  it('detects a builtin present in the grammar but missing from TS', () => {
    const original = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
    const mutated = original.replace(/LENGTH\|/, 'LENGTH|MADE_UP_FUNCTION|');
    const tmBuiltins = builtinsFromGrammar(mutated);
    expect(tmBuiltins.has('MADE_UP_FUNCTION')).toBe(true);
    expect(BUILTIN_FUNCTIONS.has('MADE_UP_FUNCTION')).toBe(false);
    const extra: string[] = [];
    for (const fn of tmBuiltins) {
      if (!BUILTIN_FUNCTIONS.has(fn)) extra.push(fn);
    }
    expect(extra).toEqual(['MADE_UP_FUNCTION']);
  });

  it('detects a clause keyword present in TS but missing from the grammar', () => {
    const original = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
    const mutated = original.replace(/FOR\|FILTER/, 'FILTER');
    const grammar = JSON.parse(mutated) as Grammar;
    const clausePattern = grammar.repository['clause-keywords'].patterns[0].match;
    if (!clausePattern) throw new Error('clause pattern missing');
    const list = extractAlternationGroup(clausePattern);
    if (!list) throw new Error('clause alternation extraction failed');
    const tmKeywords = new Set(list);
    expect(CLAUSE_KEYWORDS.has('FOR')).toBe(true);
    expect(tmKeywords.has('FOR')).toBe(false);
  });
});
