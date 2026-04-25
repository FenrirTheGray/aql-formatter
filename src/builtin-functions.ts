/**
 * Common AQL builtin function names. Used by the tmLanguage grammar to scope
 * builtins as `support.function.builtin.aql` so themes color them distinctly
 * from user-defined function calls.
 *
 * NOTE: When updating this set, also update syntaxes/aql.tmLanguage.json
 * (the tmLanguage file cannot import from TypeScript - a parity test verifies
 * the two stay in sync).
 *
 * Reference: ArangoDB AQL function documentation
 *   https://docs.arangodb.com/stable/aql/functions/
 */
export const BUILTIN_FUNCTIONS = new Set<string>([
  'LENGTH', 'COUNT', 'CONCAT', 'SUBSTRING', 'LOWER', 'UPPER', 'TRIM', 'SPLIT',
  'MERGE', 'KEYS', 'VALUES', 'ATTRIBUTES', 'HAS',
  'IS_NULL', 'IS_BOOL', 'IS_NUMBER', 'IS_STRING', 'IS_ARRAY', 'IS_OBJECT',
  'TO_NUMBER', 'TO_STRING', 'TO_BOOL', 'TO_ARRAY',
  'DATE_NOW', 'DATE_ISO8601', 'DATE_FORMAT', 'DATE_ADD', 'DATE_SUBTRACT',
  'DATE_DIFF', 'DATE_YEAR', 'DATE_MONTH', 'DATE_DAY',
  'MIN', 'MAX', 'SUM', 'AVERAGE', 'AVG', 'FIRST', 'LAST',
  'UNIQUE', 'FLATTEN', 'SLICE', 'PUSH', 'POP', 'SHIFT', 'UNSHIFT', 'APPEND',
  'REVERSE', 'SORTED', 'SORTED_UNIQUE',
  'INTERSECTION', 'UNION', 'MINUS',
  'GEO_POINT', 'GEO_DISTANCE', 'GEO_CONTAINS',
]);
