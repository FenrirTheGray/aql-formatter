import { computeDedentIndent } from '../on-type';

describe('computeDedentIndent', () => {
  it('returns null for non-bracket triggers', () => {
    expect(computeDedentIndent('foo\n', 4, '\n')).toBeNull();
    expect(computeDedentIndent('foo;', 4, ';')).toBeNull();
  });

  it('returns null when trigger char does not match the offset char', () => {
    expect(computeDedentIndent('foo}', 4, ')')).toBeNull();
    expect(computeDedentIndent('foo]', 4, '}')).toBeNull();
  });

  it('aligns a brace closer to its opener', () => {
    const text = 'RETURN {\n      }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('');
  });

  it('aligns a bracket closer with nested indent to its opener column', () => {
    const text = '  RETURN [\n    ]';
    expect(computeDedentIndent(text, text.length, ']')).toBe('  ');
  });

  it('aligns a paren closer to its opener', () => {
    const text = 'LET x = (\n        )';
    expect(computeDedentIndent(text, text.length, ')')).toBe('');
  });

  it('matches the nearest opener even when other groups close in between', () => {
    const text = 'LET x = {\n  a: [1, 2],\n      }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('');
  });

  it('returns null when there is no matching opener', () => {
    expect(computeDedentIndent('}', 1, '}')).toBeNull();
    expect(computeDedentIndent('foo)', 4, ')')).toBeNull();
  });

  it('returns null when the bracket is not the only non-whitespace on the line', () => {
    const text = 'RETURN {\n  a: 1 }';
    expect(computeDedentIndent(text, text.length, '}')).toBeNull();
  });

  it('returns null when the indent is already correct', () => {
    const text = 'RETURN {\n}';
    expect(computeDedentIndent(text, text.length, '}')).toBeNull();
  });

  it('uses tab indentation when the opener line is tab-indented', () => {
    const text = '\tRETURN {\n     }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('\t');
  });

  it('ignores braces inside string literals', () => {
    const text = 'LET x = {\n  a: "}",\n      }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('');
  });

  it('ignores braces inside line comments', () => {
    const text = 'LET x = {\n  // }\n        }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('');
  });

  it('ignores braces inside block comments', () => {
    const text = 'LET x = {\n  /* } */\n        }';
    expect(computeDedentIndent(text, text.length, '}')).toBe('');
  });

  it('does not match a wrong opener type', () => {
    const text = 'LET x = (\n   ]';
    expect(computeDedentIndent(text, text.length, ']')).toBeNull();
  });
});
