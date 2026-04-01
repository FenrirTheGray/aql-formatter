import { formatAql } from '../formatter';

describe('AQL Formatter', () => {
  const options = { tabSize: 2, insertSpaces: true, printWidth: 60 };

  it('should format simple queries', () => {
    const input = 'FOR u IN users FILTER u.active == true RETURN u';
    const expected = `FOR u IN users
  FILTER u.active == TRUE
  RETURN u
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should indent nested loops', () => {
    const input = 'FOR u IN users FOR f IN friends FILTER u.id == f.uid RETURN {u, f}';
    const expected = `FOR u IN users
  FOR f IN friends
    FILTER u.id == f.uid
    RETURN { u, f }
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should preserve comments', () => {
    const input = 'FOR u IN users // comment\n RETURN u';
    const expected = `FOR u IN users // comment
  RETURN u
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should handle multiline arrays based on printWidth', () => {
    const shortInput = 'RETURN [1, 2, 3]';
    expect(formatAql(shortInput, options)).toBe(`RETURN [1, 2, 3]\n`);

    const longInput = 'RETURN ["very long string that will force formatting to wrap", "another long string"]';
    const expected = `RETURN [
  "very long string that will force formatting to wrap",
  "another long string"
]
`;
    expect(formatAql(longInput, options)).toBe(expected);
  });

  it('should be idempotent', () => {
    const input = 'FOR u IN users FILTER u.age > 18 RETURN u';
    const firstPass = formatAql(input, options);
    const secondPass = formatAql(firstPass, options);
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
    expect(formatAql(input, options)).toBe(expected);
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
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should isolate subquery indentation from outer scope', () => {
    const input = 'FOR doc IN collection FILTER doc.type == "a" LET sub = (FOR s IN other RETURN s) RETURN { doc, sub }';
    const firstPass = formatAql(input, options);
    const secondPass = formatAql(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  // --- COLLECT / AGGREGATE ---

  it('should format COLLECT with COUNT INTO', () => {
    const input = 'FOR u IN users COLLECT city = u.city WITH COUNT INTO count RETURN { city, count }';
    const expected = `FOR u IN users
  COLLECT city = u.city WITH COUNT INTO count
  RETURN { city, count }
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should format COLLECT with AGGREGATE', () => {
    const input = 'FOR u IN users COLLECT city = u.city AGGREGATE total = SUM(u.amount) RETURN { city, total }';
    const expected = `FOR u IN users
  COLLECT city = u.city AGGREGATE total = SUM(u.amount)
  RETURN { city, total }
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- Graph traversal ---

  it('should format graph traversal', () => {
    const input = 'FOR v, e, p IN 1..3 OUTBOUND "users/1" GRAPH "social" RETURN v';
    const expected = `FOR v, e, p IN 1..3 OUTBOUND "users/1" GRAPH "social"
  RETURN v
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- UPSERT ---

  it('should format UPSERT', () => {
    const input = 'FOR doc IN source UPSERT { _key: doc._key } INSERT doc UPDATE doc IN target';
    const expected = `FOR doc IN source
  UPSERT { _key: doc._key }
  INSERT doc
  UPDATE doc IN target
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- Empty groups ---

  it('should handle empty groups', () => {
    expect(formatAql('RETURN {}', options)).toBe('RETURN {}\n');
    expect(formatAql('RETURN []', options)).toBe('RETURN []\n');
    expect(formatAql('RETURN (1 + 2)', options)).toBe('RETURN (1 + 2)\n');
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
    expect(formatAql(input, options)).toBe(expected);
  });

  it('should properly dedent after multiple RETURN statements', () => {
    const input = 'FOR a IN as FOR b IN bs RETURN b RETURN a';
    const expected = `FOR a IN as
  FOR b IN bs
    RETURN b
  RETURN a
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- Edge cases ---

  it('should handle empty input', () => {
    expect(formatAql('', options)).toBe('');
  });

  it('should handle whitespace-only input', () => {
    expect(formatAql('   \n\t  \n  ', options)).toBe('');
  });

  it('should handle comment-only input', () => {
    expect(formatAql('// just a comment', options)).toBe('// just a comment\n');
  });

  it('should handle block comment input', () => {
    expect(formatAql('/* block comment */ RETURN 1', options)).toBe('/* block comment */\nRETURN 1\n');
  });

  it('should handle unmatched brackets gracefully', () => {
    const input = 'FOR u IN users RETURN [1, 2';
    const result = formatAql(input, options);
    expect(result).toContain('FOR');
    expect(result).toContain('[');
    // Should not throw
  });

  it('should handle trailing commas', () => {
    const input = 'RETURN { a: 1, b: 2, }';
    const result = formatAql(input, options);
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
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- Idempotency for complex cases ---

  it('should be idempotent for subqueries', () => {
    const input = 'LET x = (FOR doc IN c FILTER doc.a == 1 RETURN doc) FOR y IN x RETURN y';
    const firstPass = formatAql(input, options);
    const secondPass = formatAql(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  it('should be idempotent for nested FOR loops', () => {
    const input = 'FOR a IN as FOR b IN bs FOR c IN cs RETURN { a, b, c }';
    const firstPass = formatAql(input, options);
    const secondPass = formatAql(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  it('should be idempotent for graph traversal', () => {
    const input = 'FOR v, e, p IN 1..3 OUTBOUND "start" GRAPH "g" FILTER v.active RETURN v';
    const firstPass = formatAql(input, options);
    const secondPass = formatAql(firstPass, options);
    expect(firstPass).toBe(secondPass);
  });

  // --- Bind parameters ---

  it('should handle bind parameters', () => {
    const input = 'FOR doc IN @@collection FILTER doc.name == @name RETURN doc';
    const expected = `FOR doc IN @@collection
  FILTER doc.name == @name
  RETURN doc
`;
    expect(formatAql(input, options)).toBe(expected);
  });

  // --- Function calls ---

  it('should not add space before function call parens', () => {
    const input = 'RETURN LENGTH(users)';
    expect(formatAql(input, options)).toBe('RETURN LENGTH(users)\n');
  });

  it('should format nested function calls', () => {
    const input = 'RETURN CONCAT(UPPER(doc.first), " ", LOWER(doc.last))';
    expect(formatAql(input, options)).toBe('RETURN CONCAT(UPPER(doc.first), " ", LOWER(doc.last))\n');
  });
});
