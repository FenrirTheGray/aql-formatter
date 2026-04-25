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
  unterminated?: boolean;
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

/**
 * Indexed capture groups, dispatched on capture index. Order MUST match the
 * `IDX_*` constants below.
 *
 * 1: whitespace
 * 2: line comment
 * 3: block comment
 * 4: string
 * 5: number
 * 6: range (..)
 * 7: operator
 * 8: punctuation
 * 9: identifier (incl. bind parameters)
 * 10: unknown (single char fallback)
 */
const lexerSource =
  '(\\s+)' +
  '|(\\/\\/[^\\n]*)' +
  '|(\\/\\*[\\s\\S]*?(?:\\*\\/|$))' +
  '|("(?:[^"\\\\]|\\\\[\\s\\S])*\\\\?"?|\\\'(?:[^\'\\\\]|\\\\[\\s\\S])*\\\\?\\\'?|`(?:[^`\\\\]|\\\\[\\s\\S])*\\\\?`?)' +
  '|((?:0[xX][0-9a-fA-F]+)|(?:\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?))' +
  '|(\\.\\.)' +
  '|(\\?:|==|!=|<=|>=|&&|\\|\\||=~|!~|[=<>+\\-*\\/%!~])' +
  '|([()\\[\\]{},:;?.])' +
  '|(@@?[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*)' +
  '|(.)';

export interface TokenizeOptions {
  /**
   * When true, whitespace tokens are not emitted. Internal line/column
   * tracking still advances over whitespace so subsequent token positions
   * remain correct. Defaults to false to preserve legacy callers.
   */
  skipWhitespace?: boolean;
}

export function tokenize(input: string, options?: TokenizeOptions): Token[] {
  const tokens: Token[] = [];
  const skipWs = options?.skipWhitespace === true;

  const lexerRegex = new RegExp(lexerSource, 'gy');

  let match: RegExpExecArray | null;
  let line = 0;
  let column = 0;

  while ((match = lexerRegex.exec(input)) !== null) {
    const value = match[0];
    const offset = match.index;
    const currentLine = line;
    const currentColumn = column;
    let type: TokenType;

    if (match[1] !== undefined) {
      type = TokenType.Whitespace;
    } else if (match[2] !== undefined) {
      type = TokenType.LineComment;
    } else if (match[3] !== undefined) {
      type = TokenType.BlockComment;
    } else if (match[4] !== undefined) {
      type = TokenType.String;
    } else if (match[5] !== undefined) {
      type = TokenType.Number;
    } else if (match[6] !== undefined) {
      type = TokenType.Range;
    } else if (match[7] !== undefined) {
      type = TokenType.Operator;
    } else if (match[8] !== undefined) {
      type = punctuationToType[value];
    } else if (match[9] !== undefined) {
      const upper = value.toUpperCase();
      type = AQL_KEYWORDS.has(upper) && !value.startsWith('@')
        ? TokenType.Keyword
        : TokenType.Identifier;
    } else {
      type = TokenType.Unknown;
    }

    const newlineIdx = value.indexOf('\n');
    if (newlineIdx >= 0) {
      let lastNewline = newlineIdx;
      let count = 1;
      for (let i = newlineIdx + 1; i < value.length; i++) {
        if (value.charCodeAt(i) === 10) { count++; lastNewline = i; }
      }
      line += count;
      column = value.length - lastNewline - 1;
    } else {
      column += value.length;
    }

    if (skipWs && type === TokenType.Whitespace) continue;

    const token: Token = { type, value, offset, line: currentLine, column: currentColumn };
    if (type === TokenType.String) {
      const quote = value[0];
      if (value.length < 2 || value[value.length - 1] !== quote) {
        token.unterminated = true;
      } else if (value.length >= 2 && value[value.length - 2] === '\\') {
        let backslashes = 0;
        for (let i = value.length - 2; i >= 1 && value[i] === '\\'; i--) backslashes++;
        if (backslashes % 2 === 1) token.unterminated = true;
      }
    } else if (type === TokenType.BlockComment) {
      if (!value.endsWith('*/')) token.unterminated = true;
    }
    tokens.push(token);
  }

  return tokens;
}
