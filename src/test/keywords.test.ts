import * as fs from 'fs';
import * as path from 'path';
import { AQL_KEYWORDS, CLAUSE_KEYWORDS } from '../keywords';
import { BUILTIN_FUNCTIONS } from '../builtin-functions';

describe('Keyword definitions', () => {
  it('CLAUSE_KEYWORDS should be a subset of AQL_KEYWORDS', () => {
    for (const kw of CLAUSE_KEYWORDS) {
      expect(AQL_KEYWORDS.has(kw)).toBe(true);
    }
  });

  it('should match clause keywords in tmLanguage grammar', () => {
    const grammarPath = path.resolve(__dirname, '../../syntaxes/aql.tmLanguage.json');
    const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));

    const clausePattern: string = grammar.repository['clause-keywords'].patterns[0].match;
    // Pattern looks like: (?i)\b(FOR|FILTER|...)\b — extract the alternation group
    const match = clausePattern.match(/\(([A-Z_|]+)\)/);
    if (!match) { throw new Error('Expected clause pattern to contain keyword alternation group'); }

    const tmKeywords = new Set(match[1].split('|'));

    // Every tmLanguage clause keyword should be in our CLAUSE_KEYWORDS
    for (const kw of tmKeywords) {
      expect(CLAUSE_KEYWORDS.has(kw)).toBe(true);
    }

    // Every CLAUSE_KEYWORDS entry should be in tmLanguage
    // (WITH is in the general keywords section, not clause-keywords)
    for (const kw of CLAUSE_KEYWORDS) {
      if (kw === 'WITH') continue;
      expect(tmKeywords.has(kw)).toBe(true);
    }
  });

  it('should have all AQL_KEYWORDS represented in tmLanguage grammar', () => {
    const grammarPath = path.resolve(__dirname, '../../syntaxes/aql.tmLanguage.json');
    const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));

    // Collect all keywords from all grammar patterns
    const allGrammarKeywords = new Set<string>();

    const extractKeywords = (patterns: { match?: string }[]) => {
      for (const p of patterns) {
        if (p.match) {
          // Match keyword groups like (FOR|FILTER|...) or (true|false) — case-insensitive
          const groups = p.match.matchAll(/\(([A-Za-z_|]+)\)/g);
          for (const g of groups) {
            g[1].split('|').forEach((kw: string) => allGrammarKeywords.add(kw.toUpperCase()));
          }
          // Match standalone keyword patterns like \bnull\b
          const standalone = p.match.match(/\\b([a-zA-Z_]+)\\b/);
          if (standalone && !standalone[1].includes('|')) {
            allGrammarKeywords.add(standalone[1].toUpperCase());
          }
        }
      }
    };

    extractKeywords(grammar.repository['clause-keywords'].patterns);
    extractKeywords(grammar.repository['keywords'].patterns);
    extractKeywords(grammar.repository['constants'].patterns);

    // Every AQL_KEYWORDS entry should appear somewhere in the grammar
    for (const kw of AQL_KEYWORDS) {
      expect(allGrammarKeywords.has(kw)).toBe(true);
    }
  });

  it('BUILTIN_FUNCTIONS should match the tmLanguage builtin alternation', () => {
    const grammarPath = path.resolve(__dirname, '../../syntaxes/aql.tmLanguage.json');
    const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));

    const functionsPatterns = grammar.repository['functions'].patterns;
    const builtinPattern = functionsPatterns.find(
      (p: { name?: string }) => p.name === 'support.function.builtin.aql'
    );
    expect(builtinPattern).toBeDefined();

    const match = (builtinPattern.match as string).match(/\(([A-Z0-9_|]+)\)/);
    if (!match) { throw new Error('Expected builtin pattern to contain alternation group'); }
    const tmBuiltins = new Set(match[1].split('|'));

    for (const fn of BUILTIN_FUNCTIONS) {
      expect(tmBuiltins.has(fn)).toBe(true);
    }
    for (const fn of tmBuiltins) {
      expect(BUILTIN_FUNCTIONS.has(fn)).toBe(true);
    }
  });

  it('builtin pattern should appear before the generic function pattern', () => {
    const grammarPath = path.resolve(__dirname, '../../syntaxes/aql.tmLanguage.json');
    const grammar = JSON.parse(fs.readFileSync(grammarPath, 'utf-8'));

    const functionsPatterns: { name?: string }[] = grammar.repository['functions'].patterns;
    const builtinIdx = functionsPatterns.findIndex(p => p.name === 'support.function.builtin.aql');
    const genericIdx = functionsPatterns.findIndex(p => p.name === 'entity.name.function.aql');
    expect(builtinIdx).toBeGreaterThanOrEqual(0);
    expect(genericIdx).toBeGreaterThanOrEqual(0);
    expect(builtinIdx).toBeLessThan(genericIdx);
  });
});
