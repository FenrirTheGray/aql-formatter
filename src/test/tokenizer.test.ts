import { tokenize, TokenType } from '../tokenizer';

describe('AQL Tokenizer', () => {
  it('should tokenize basic keywords and identifiers', () => {
    const input = 'FOR doc IN collection RETURN doc';
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);
    
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.Keyword, // FOR
      TokenType.Identifier, // doc
      TokenType.Keyword, // IN
      TokenType.Identifier, // collection
      TokenType.Keyword, // RETURN
      TokenType.Identifier, // doc
    ]);
  });

  it('should include positional metadata', () => {
    const input = 'FOR doc IN \n collection \nRETURN doc';
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);
    
    // Check "collection" token
    const collectionToken = tokens.find(t => t.value === 'collection');
    expect(collectionToken).toBeDefined();
    expect(collectionToken?.line).toBe(1); // 0-indexed
    expect(collectionToken?.column).toBe(1);
    expect(collectionToken?.offset).toBe(13);
    
    // Check "RETURN" token
    const returnToken = tokens.find(t => t.value === 'RETURN');
    expect(returnToken).toBeDefined();
    expect(returnToken?.line).toBe(2);
    expect(returnToken?.column).toBe(0);
    expect(returnToken?.offset).toBe(25);
  });

  it('should handle strings with escaped quotes', () => {
    const input = '"a \\" b" \'c \\\' d\' `e \\` f`';
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);
    
    expect(tokens.length).toBe(3);
    expect(tokens[0].value).toBe('"a \\" b"');
    expect(tokens[1].value).toBe('\'c \\\' d\'');
    expect(tokens[2].value).toBe('`e \\` f`');
  });

  it('should not crash on EOF escape in string', () => {
    const input = '"unclosed \\';
    const tokens = tokenize(input);
    
    expect(tokens[0].type).toBe(TokenType.String);
    expect(tokens[0].value).toBe('"unclosed \\');
  });

  it('should identify operators and punctuation', () => {
    const input = `doc.age >= 18 && doc.name != null`;
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);
    
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.Identifier,
      TokenType.Dot,
      TokenType.Identifier,
      TokenType.Operator, // >=
      TokenType.Number,
      TokenType.Operator, // &&
      TokenType.Identifier,
      TokenType.Dot,
      TokenType.Identifier,
      TokenType.Operator, // !=
      TokenType.Keyword  // null is a keyword in AQL
    ]);
  });
  
  it('should handle single and multi line comments', () => {
    const input = 'FOR // line comment\nx /* block\ncomment */ IN y';
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);
    
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.Keyword,
      TokenType.LineComment,
      TokenType.Identifier,
      TokenType.BlockComment,
      TokenType.Keyword,
      TokenType.Identifier
    ]);
  });
  
  it('should handle bind parameters correctly', () => {
    const input = 'FOR doc IN @@collection FILTER doc.id == @id';
    const tokens = tokenize(input).filter(t => t.type !== TokenType.Whitespace);

    // "@id" or "@@collection" are usually treated as identifiers. Wait, the old code treated `@name` as Identifier and `@@name` as Identifier. Let's make sure our new lexer does the same.
    expect(tokens.map(t => t.value)).toEqual([
      'FOR', 'doc', 'IN', '@@collection', 'FILTER', 'doc.id', '==', '@id'
    ].flatMap(x => x === 'doc.id' ? ['doc', '.', 'id'] : x));
  });

  it('should preserve token output across the indexed-capture refactor', () => {
    const input = [
      'FOR doc IN @@collection',
      '  FILTER doc.age >= 18 && doc.name != "alice\\""',
      '  LET x = 0xFF + 1.5e-3',
      '  LET r = 1..10',
      '  // line',
      '  /* block',
      '     spans */',
      '  RETURN { id: @id, tag: \'t\', raw: `r` }',
    ].join('\n');
    const tokens = tokenize(input);
    const snapshot = tokens.map(t => ({
      type: t.type,
      value: t.value,
      offset: t.offset,
      line: t.line,
      column: t.column,
      ...(t.unterminated ? { unterminated: true } : {}),
    }));
    expect(snapshot).toMatchSnapshot();
  });

  it('should omit whitespace tokens when skipWhitespace is set', () => {
    const input = 'FOR doc IN \n collection \nRETURN doc';
    const withWs = tokenize(input);
    const withoutWs = tokenize(input, { skipWhitespace: true });

    expect(withWs.some(t => t.type === TokenType.Whitespace)).toBe(true);
    expect(withoutWs.some(t => t.type === TokenType.Whitespace)).toBe(false);

    const project = (t: { type: TokenType; value: string; offset: number; line: number; column: number }) =>
      ({ type: t.type, value: t.value, offset: t.offset, line: t.line, column: t.column });
    const filtered = withWs.filter(t => t.type !== TokenType.Whitespace);
    expect(withoutWs.map(project)).toEqual(filtered.map(project));
  });

  it('should still flag unterminated strings and block comments after refactor', () => {
    const cases: { input: string; type: TokenType }[] = [
      { input: '"abc', type: TokenType.String },
      { input: "'abc", type: TokenType.String },
      { input: '`abc', type: TokenType.String },
      { input: '"foo\\"', type: TokenType.String },
      { input: '/* abc', type: TokenType.BlockComment },
    ];
    for (const c of cases) {
      const tokens = tokenize(c.input).filter(t => t.type !== TokenType.Whitespace);
      const flagged = tokens.find(t => t.type === c.type);
      expect(flagged?.unterminated).toBe(true);
    }
    const ok = tokenize('"abc" /* d */').filter(t => t.type !== TokenType.Whitespace);
    for (const t of ok) expect(t.unterminated).toBeUndefined();
  });
});
