// All AQL keywords recognized by the tokenizer.
// NOTE: When updating these sets, also update syntaxes/aql.tmLanguage.json
// (the tmLanguage file cannot import from TypeScript — a sync test verifies parity).

export const AQL_KEYWORDS = new Set([
  'AGGREGATE', 'ALL', 'AND', 'ANY', 'ASC', 'COLLECT', 'DESC',
  'DISTINCT', 'FALSE', 'FILTER', 'FOR', 'GRAPH', 'IN', 'INBOUND',
  'INSERT', 'INTO', 'K_PATHS', 'K_SHORTEST_PATHS', 'LET', 'LIKE',
  'LIMIT', 'NONE', 'NOT', 'NULL', 'OR', 'OUTBOUND', 'PRUNE',
  'REMOVE', 'REPLACE', 'RETURN', 'SEARCH', 'SHORTEST_PATH', 'SORT',
  'TRUE', 'UPDATE', 'UPSERT', 'WINDOW', 'WITH', 'OPTIONS',
]);

// Clause keywords that trigger newline + indentation in the formatter.
export const CLAUSE_KEYWORDS = new Set([
  'FOR', 'FILTER', 'LET', 'SORT', 'LIMIT', 'COLLECT',
  'RETURN', 'INSERT', 'UPDATE', 'REPLACE', 'REMOVE', 'UPSERT',
  'WINDOW', 'SEARCH', 'WITH',
]);
