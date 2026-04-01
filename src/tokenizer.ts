export enum TokenType {
  Keyword = 'keyword',
  Identifier = 'identifier',
  Number = 'number',
  String = 'string',
  LineComment = 'lineComment',
  BlockComment = 'blockComment',
  Operator = 'operator',
  Comma = 'comma',
  Dot = 'dot',
  Colon = 'colon',
  Semicolon = 'semicolon',
  OpenParen = 'openParen',
  CloseParen = 'closeParen',
  OpenBracket = 'openBracket',
  CloseBracket = 'closeBracket',
  OpenBrace = 'openBrace',
  CloseBrace = 'closeBrace',
  QuestionMark = 'questionMark',
  Range = 'range',
  Whitespace = 'whitespace',
  Unknown = 'unknown',
}

import { AQL_KEYWORDS } from './keywords';

export interface Token {
  type: TokenType;
  value: string;
  offset: number;
  line: number;
  column: number;
}

const punctuationToType: Record<string, TokenType> = {
  '(': TokenType.OpenParen,
  ')': TokenType.CloseParen,
  '[': TokenType.OpenBracket,
  ']': TokenType.CloseBracket,
  '{': TokenType.OpenBrace,
  '}': TokenType.CloseBrace,
  ',': TokenType.Comma,
  ':': TokenType.Colon,
  ';': TokenType.Semicolon,
  '?': TokenType.QuestionMark,
  '.': TokenType.Dot,
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  
  // Use a global, sticky regex for maximum efficiency in V8
  const lexerRegex = new RegExp([
    '(?<whitespace>\\s+)',
    '(?<lineComment>\\/\\/[^\\n]*)',
    '(?<blockComment>\\/\\*[\\s\\S]*?(?:\\*\\/|$))',
    '(?<string>"(?:[^"\\\\]|\\\\[\\s\\S])*\\\\?"?|\\\'(?:[^\'\\\\]|\\\\[\\s\\S])*\\\\?\\\'?|`(?:[^`\\\\]|\\\\[\\s\\S])*\\\\?`?)',
    '(?<number>(?:0[xX][0-9a-fA-F]+)|(?:\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?))',
    '(?<range>\\.\\.)',
    '(?<operator>\\?:|==|!=|<=|>=|&&|\\|\\||=~|!~|[=<>+\\-*\\/%!~])',
    '(?<punctuation>[()\\[\\]{},:;?.])',
    '(?<identifier>@@?[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*)',
    '(?<unknown>.)'
  ].join('|'), 'gy');

  let match: RegExpExecArray | null;
  let line = 0;
  let column = 0;
  
  const updatePos = (value: string) => {
    const lines = value.split('\n');
    if (lines.length > 1) {
      line += lines.length - 1;
      column = lines[lines.length - 1].length;
    } else {
      column += value.length;
    }
  };

  while ((match = lexerRegex.exec(input)) !== null) {
    const value = match[0];
    const groups = match.groups!;
    const offset = match.index;
    const currentLine = line;
    const currentColumn = column;
    let type: TokenType;

    if (groups.whitespace) {
      type = TokenType.Whitespace;
    } else if (groups.lineComment) {
      type = TokenType.LineComment;
    } else if (groups.blockComment) {
      type = TokenType.BlockComment;
    } else if (groups.string) {
      type = TokenType.String;
    } else if (groups.number) {
      type = TokenType.Number;
    } else if (groups.range) {
      type = TokenType.Range;
    } else if (groups.operator) {
      type = TokenType.Operator;
    } else if (groups.punctuation) {
      type = punctuationToType[value];
    } else if (groups.identifier) {
      const upper = value.toUpperCase();
      type = AQL_KEYWORDS.has(upper) && !value.startsWith('@') 
        ? TokenType.Keyword 
        : TokenType.Identifier;
    } else {
      type = TokenType.Unknown;
    }

    tokens.push({ type, value, offset, line: currentLine, column: currentColumn });
    updatePos(value);
  }

  return tokens;
}
