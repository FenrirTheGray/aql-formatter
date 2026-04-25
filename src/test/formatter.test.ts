import { formatAql, FormatOptions } from '../formatter';

describe('AQL Formatter', () => {
  const options = { tabSize: 2, insertSpaces: true, printWidth: 60 };
  const fmt = (s: string, o: FormatOptions = options) => formatAql(s, o).text;

  it('should format simple queries', () => {
    const input = 'FOR u IN users FILTER u.active == true RETURN u';
    const expected = `FOR u IN users
  FILTER u.active == TRUE
  RETURN u
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should indent nested loops', () => {
    const input = 'FOR u IN users FOR f IN friends FILTER u.id == f.uid RETURN {u, f}';
    const expected = `FOR u IN users
  FOR f IN friends
    FILTER u.id == f.uid
    RETURN { u, f }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should preserve comments', () => {
    const input = 'FOR u IN users // comment\n RETURN u';
    const expected = `FOR u IN users // comment
  RETURN u
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should handle multiline arrays based on printWidth', () => {
    const shortInput = 'RETURN [1, 2, 3]';
    expect(fmt(shortInput, options)).toBe(`RETURN [1, 2, 3]\n`);

    const longInput = 'RETURN ["very long string that will force formatting to wrap", "another long string"]';
    const expected = `RETURN [
  "very long string that will force formatting to wrap",
  "another long string"
]
`;
    expect(fmt(longInput, options)).toBe(expected);
  });

  it('should be idempotent', () => {
    const input = 'FOR u IN users FILTER u.age > 18 RETURN u';
    const firstPass = fmt(input, options);
    const secondPass = fmt(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  // --- Subqueries ---

  it('should format subqueries', () => {
    const input = 'LET active = (FOR u IN users FILTER u.active RETURN u) RETURN active';
    const expected = `LET active = (
  FOR u IN users
    FILTER u.active
    RETURN u
)
RETURN active
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should format nested subqueries', () => {
    const input = 'LET result = (FOR u IN users LET friends = (FOR f IN friends FILTER f.uid == u._id RETURN f) RETURN { u, friends }) RETURN result';
    const expected = `LET result = (
  FOR u IN users
    LET friends = (
      FOR f IN friends
        FILTER f.uid == u._id
        RETURN f
    )
    RETURN { u, friends }
)
RETURN result
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should isolate subquery indentation from outer scope', () => {
    const input = 'FOR doc IN collection FILTER doc.type == "a" LET sub = (FOR s IN other RETURN s) RETURN { doc, sub }';
    const firstPass = fmt(input, options);
    const secondPass = fmt(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  // --- COLLECT / AGGREGATE ---

  it('should format COLLECT with COUNT INTO', () => {
    const input = 'FOR u IN users COLLECT city = u.city WITH COUNT INTO count RETURN { city, count }';
    const expected = `FOR u IN users
  COLLECT city = u.city WITH COUNT INTO count
  RETURN { city, count }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should format COLLECT with AGGREGATE', () => {
    const input = 'FOR u IN users COLLECT city = u.city AGGREGATE total = SUM(u.amount) RETURN { city, total }';
    const expected = `FOR u IN users
  COLLECT city = u.city AGGREGATE total = SUM(u.amount)
  RETURN { city, total }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- Graph traversal ---

  it('should format graph traversal', () => {
    const input = 'FOR v, e, p IN 1..3 OUTBOUND "users/1" GRAPH "social" RETURN v';
    const expected = `FOR v, e, p IN 1..3 OUTBOUND "users/1" GRAPH "social"
  RETURN v
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- UPSERT ---

  it('should format UPSERT', () => {
    const input = 'FOR doc IN source UPSERT { _key: doc._key } INSERT doc UPDATE doc IN target';
    const expected = `FOR doc IN source
  UPSERT { _key: doc._key }
  INSERT doc
  UPDATE doc IN target
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- Empty groups ---

  it('should handle empty groups', () => {
    expect(fmt('RETURN {}', options)).toBe('RETURN {}\n');
    expect(fmt('RETURN []', options)).toBe('RETURN []\n');
    expect(fmt('RETURN (1 + 2)', options)).toBe('RETURN (1 + 2)\n');
  });

  // --- Brace spacing ---

  it('should pad single-property object braces with spaces', () => {
    expect(fmt('RETURN { a: 1 }', options)).toBe('RETURN { a: 1 }\n');
    expect(fmt('RETURN {a:1}', options)).toBe('RETURN { a: 1 }\n');
  });

  it('should not pad empty object braces', () => {
    expect(fmt('RETURN {}', options)).toBe('RETURN {}\n');
    expect(fmt('RETURN { }', options)).toBe('RETURN {}\n');
  });

  // --- Deep nesting ---

  it('should handle 3+ deep nested FOR loops', () => {
    const input = 'FOR a IN as FOR b IN bs FOR c IN cs FILTER c.x == 1 RETURN { a, b, c }';
    const expected = `FOR a IN as
  FOR b IN bs
    FOR c IN cs
      FILTER c.x == 1
      RETURN { a, b, c }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should properly dedent after multiple RETURN statements', () => {
    const input = 'FOR a IN as FOR b IN bs RETURN b RETURN a';
    const expected = `FOR a IN as
  FOR b IN bs
    RETURN b
  RETURN a
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- Edge cases ---

  it('should handle empty input', () => {
    expect(fmt('', options)).toBe('');
  });

  it('should handle whitespace-only input', () => {
    expect(fmt('   \n\t  \n  ', options)).toBe('');
  });

  it('should handle comment-only input', () => {
    expect(fmt('// just a comment', options)).toBe('// just a comment\n');
  });

  it('should handle block comment input', () => {
    expect(fmt('/* block comment */ RETURN 1', options)).toBe('/* block comment */\nRETURN 1\n');
  });

  it('should handle unmatched brackets gracefully', () => {
    const input = 'FOR u IN users RETURN [1, 2';
    const result = fmt(input, options);
    expect(result).toContain('FOR');
    expect(result).toContain('[');
    // Should not throw
  });

  it('should handle trailing commas', () => {
    const input = 'RETURN { a: 1, b: 2, }';
    const result = fmt(input, options);
    expect(result).toContain('a:');
    expect(result).toContain('b:');
  });

  // --- WITH as first clause ---

  it('should format WITH as clause when it is the first keyword', () => {
    const input = 'WITH users FOR u IN users RETURN u';
    const expected = `WITH users
FOR u IN users
  RETURN u
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- Idempotency for complex cases ---

  it('should be idempotent for subqueries', () => {
    const input = 'LET x = (FOR doc IN c FILTER doc.a == 1 RETURN doc) FOR y IN x RETURN y';
    const firstPass = fmt(input, options);
    const secondPass = fmt(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  it('should be idempotent for nested FOR loops', () => {
    const input = 'FOR a IN as FOR b IN bs FOR c IN cs RETURN { a, b, c }';
    const firstPass = fmt(input, options);
    const secondPass = fmt(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  it('should be idempotent for graph traversal', () => {
    const input = 'FOR v, e, p IN 1..3 OUTBOUND "start" GRAPH "g" FILTER v.active RETURN v';
    const firstPass = fmt(input, options);
    const secondPass = fmt(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  // --- Bind parameters ---

  it('should handle bind parameters', () => {
    const input = 'FOR doc IN @@collection FILTER doc.name == @name RETURN doc';
    const expected = `FOR doc IN @@collection
  FILTER doc.name == @name
  RETURN doc
`;
    expect(fmt(input, options)).toBe(expected);
  });

  // --- Function calls ---

  it('should not add space before function call parens', () => {
    const input = 'RETURN LENGTH(users)';
    expect(fmt(input, options)).toBe('RETURN LENGTH(users)\n');
  });

  it('should format nested function calls', () => {
    const input = 'RETURN CONCAT(UPPER(doc.first), " ", LOWER(doc.last))';
    expect(fmt(input, options)).toBe('RETURN CONCAT(UPPER(doc.first), " ", LOWER(doc.last))\n');
  });

  // --- // scope separator ---

  it('should reset scope at top-level // separator', () => {
    const input = 'FOR a IN as RETURN a\n//\nFOR b IN bs RETURN b';
    const expected = `FOR a IN as
  RETURN a
//
FOR b IN bs
  RETURN b
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should treat // inside a subquery as a regular line comment', () => {
    const input = 'LET x = (FOR u IN users\n//\nRETURN u) RETURN x';
    const result = fmt(input, options);
    expect(result).toContain('LET x = (');
    expect(result).toContain('RETURN x');
    const second = fmt(result, options);
    expect(result).toBe(second);
  });

  // --- OPTIONS modifier clause ---

  it('should format OPTIONS after INSERT INTO on its own continuation line', () => {
    const input = 'FOR doc IN src INSERT { value: doc.v } INTO coll OPTIONS { overwriteMode: "update" }';
    const expected = `FOR doc IN src
  INSERT { value: doc.v } INTO coll
    OPTIONS { overwriteMode: "update" }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should format OPTIONS on UPSERT INSERT UPDATE IN coll', () => {
    const input = 'FOR doc IN src UPSERT { _key: doc._key } INSERT doc UPDATE doc IN target OPTIONS { ignoreErrors: true }';
    const expected = `FOR doc IN src
  UPSERT { _key: doc._key }
  INSERT doc
  UPDATE doc IN target
    OPTIONS { ignoreErrors: TRUE }
`;
    expect(fmt(input, options)).toBe(expected);
  });

  it('should be idempotent for OPTIONS clause', () => {
    const input = 'FOR doc IN src INSERT { v: 1 } INTO coll OPTIONS { overwriteMode: "update" }';
    const firstPass = fmt(input);
    const secondPass = fmt(firstPass);
    expect(firstPass).toBe(secondPass);
  });

  it('should multiline OPTIONS body when it exceeds printWidth', () => {
    const input = 'FOR doc IN src INSERT doc INTO coll OPTIONS { overwriteMode: "replace", waitForSync: true, ignoreErrors: false }';
    const result = fmt(input);
    expect(result).toContain('OPTIONS {\n');
  });

  // --- Diagnostics ---

  it('should report a diagnostic for a stray closing paren', () => {
    const result = formatAql('RETURN x)', options);
    expect(result.text).toContain('RETURN');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const d = result.diagnostics[0];
    expect(d.severity).toBe('warning');
    expect(d.message).toMatch(/Unmatched closing/);
  });

  it('should report a diagnostic for an unclosed bracket', () => {
    const result = formatAql('RETURN [1, 2', options);
    expect(result.diagnostics.some(d => /Unclosed/.test(d.message))).toBe(true);
  });

  it('should report a diagnostic for an unterminated double-quoted string', () => {
    const result = formatAql('RETURN "abc', options);
    expect(result.diagnostics.some(d => /Unterminated string/.test(d.message))).toBe(true);
  });

  it('should report a diagnostic for an unterminated single-quoted string', () => {
    const result = formatAql("RETURN 'abc", options);
    expect(result.diagnostics.some(d => /Unterminated string/.test(d.message))).toBe(true);
  });

  it('should report a diagnostic for an unterminated backtick string', () => {
    const result = formatAql('RETURN `abc', options);
    expect(result.diagnostics.some(d => /Unterminated string/.test(d.message))).toBe(true);
  });

  it('should report a diagnostic for an unterminated block comment', () => {
    const result = formatAql('RETURN 1 /* abc', options);
    expect(result.diagnostics.some(d => /Unterminated block comment/.test(d.message))).toBe(true);
  });

  it('should not flag well-terminated strings or block comments', () => {
    expect(formatAql('RETURN "abc"', options).diagnostics).toEqual([]);
    expect(formatAql("RETURN 'abc'", options).diagnostics).toEqual([]);
    expect(formatAql('RETURN `abc`', options).diagnostics).toEqual([]);
    expect(formatAql('RETURN 1 /* abc */', options).diagnostics).toEqual([]);
  });

  it('should multiline a deeply nested literal that exceeds printWidth', () => {
    const input = 'RETURN { a: { b: { c: { d: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] } } } }';
    const out = fmt(input, options);
    expect(out).toContain('\n');
    expect(out.split('\n').some(line => line.length > options.printWidth + options.tabSize * 6)).toBe(false);
    const compact = 'RETURN { a: { b: 1 } }';
    expect(fmt(compact, options)).toBe('RETURN { a: { b: 1 } }\n');
  });
});
