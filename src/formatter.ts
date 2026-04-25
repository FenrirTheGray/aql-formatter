import { tokenize, Token, TokenType } from './tokenizer';
import { CLAUSE_KEYWORDS, MODIFICATION_CLAUSE_KEYWORDS, MODIFIER_CLAUSE_KEYWORDS } from './keywords';
import { Node, buildCST } from './cst';

export type KeywordCase = 'upper' | 'lower' | 'preserve';

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  printWidth?: number;
  keywordCase?: KeywordCase;
}

/**
 * Returns the keyword spelling to emit. `upper` and `lower` produce a fixed
 * case; `preserve` echoes the source token's original spelling. Length is
 * preserved across all modes since AQL keywords are pure ASCII letters, so
 * the width estimator's `token.value.length` reads remain accurate.
 */
function applyKeywordCase(originalValue: string, upper: string, mode: KeywordCase): string {
  if (mode === 'preserve') return originalValue;
  if (mode === 'lower') return upper.toLowerCase();
  return upper;
}

export type DiagnosticSeverity = 'error' | 'warning';

/**
 * Plain diagnostic shape produced by the formatter. The extension boundary
 * converts these into vscode.Diagnostic instances; keeping the formatter
 * transport-free lets unit tests run without the vscode module.
 */
export interface FormatterDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  offset: number;
  length: number;
}

export interface FormatResult {
  text: string;
  diagnostics: FormatterDiagnostic[];
}

function shouldSkipSpaceBefore(current: Token, prev: Token | null): boolean {
  if (!prev) return true;

  const p = prev.type;
  const c = current.type;

  if (p === TokenType.Whitespace) return true;
  if (c === TokenType.LineComment || c === TokenType.BlockComment) return false;

  if ((p === TokenType.OpenBrace && c === TokenType.CloseBrace) ||
      (p === TokenType.OpenBracket && c === TokenType.CloseBracket) ||
      (p === TokenType.OpenParen && c === TokenType.CloseParen)) return true;

  if (p === TokenType.OpenParen || p === TokenType.OpenBracket || p === TokenType.Dot) return true;

  if (c === TokenType.CloseParen || c === TokenType.CloseBracket ||
      c === TokenType.Comma || c === TokenType.Dot || c === TokenType.Semicolon) return true;

  if (c === TokenType.OpenParen &&
      (p === TokenType.Identifier ||
       (p === TokenType.Keyword && !CLAUSE_KEYWORDS.has(prev.value.toUpperCase())))) return true;

  if (c === TokenType.OpenBracket &&
      (p === TokenType.Identifier || p === TokenType.CloseParen || p === TokenType.CloseBracket)) return true;

  if (c === TokenType.Range || p === TokenType.Range) return true;

  if (c === TokenType.Colon &&
      (p === TokenType.Identifier || p === TokenType.String || p === TokenType.Keyword)) return true;

  return false;
}


export function formatAql(text: string, options: FormatOptions): FormatResult {
  const diagnostics: FormatterDiagnostic[] = [];
  const tokens = tokenize(text, { skipWhitespace: true });
  for (const t of tokens) {
    if (t.unterminated) {
      const what = t.type === TokenType.BlockComment ? 'block comment' : 'string literal';
      diagnostics.push({
        severity: 'warning',
        message: `Unterminated ${what}.`,
        offset: t.offset,
        length: t.value.length,
      });
    }
  }
  if (tokens.length === 0) return { text: '', diagnostics };

  const cst = buildCST(tokens);
  const collectStrayAndUnclosed = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type === 'Token') {
        if (n.stray) {
          diagnostics.push({
            severity: 'warning',
            message: `Unmatched closing '${n.token.value}'.`,
            offset: n.token.offset,
            length: n.token.value.length,
          });
        }
      } else {
        if (n.close === null) {
          diagnostics.push({
            severity: 'warning',
            message: `Unclosed '${n.open.value}'.`,
            offset: n.open.offset,
            length: n.open.value.length,
          });
        }
        collectStrayAndUnclosed(n.children);
      }
    }
  };
  collectStrayAndUnclosed(cst);
  const indentChar = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  const printWidth = options.printWidth || 80;
  const keywordCase: KeywordCase = options.keywordCase || 'upper';
  const kw = (upper: string, original: string): string => applyKeywordCase(original, upper, keywordCase);
  
  let result = '';
  let indent = 0;
  let forDepth = 0;
  let firstClauseSeen = false;
  let isNewLine = true;
  let prevToken: Token | null = null;
  /**
   * True while the most recent clause keyword on the current statement is a
   * data-modification clause (INSERT/UPDATE/REPLACE/REMOVE/UPSERT). Used to
   * decide whether an OPTIONS keyword should be promoted to its own
   * continuation-indented line.
   */
  let inModificationContext = false;
  /**
   * Set when an OPTIONS modifier clause has bumped indent for its body
   * group. Restored after that group node completes so subsequent clauses
   * resume at the parent indent.
   */
  let optionsIndentRestore: number | null = null;
  /**
   * Nesting depth of CST Group nodes during traversal. The lone-`//` scope
   * separator only resets indentation when written at the document top
   * level (groupDepth === 0); inside a parenthesized subquery or any
   * brace/bracket literal it is treated as an ordinary line comment so
   * the surrounding scope is not corrupted.
   */
  let groupDepth = 0;
  
  const write = (str: string) => {
    if (isNewLine && str.trim().length > 0) {
      result += indentChar.repeat(indent);
      isNewLine = false;
    }
    result += str;
  };
  
  const newline = () => {
    if (!isNewLine) {
      result += '\n';
      isNewLine = true;
    }
  };
  
  /**
   * Estimates the rendered width of a CST node list as if it were emitted on
   * a single line. Walks the tree recursively without flattening into an
   * intermediate token array. Once the running width exceeds `printWidth` the
   * walk short-circuits and returns `printWidth + 1`, since the only consumer
   * compares the result against `printWidth`.
   */
  const estimateWidth = (nodes: Node[]): number => {
    const limit = printWidth;
    let width = 0;
    let prev: Token | null = null;
    let exceeded = false;

    const visit = (ns: Node[]): void => {
      if (exceeded) return;
      for (const n of ns) {
        if (n.type === 'Token') {
          if (prev && !shouldSkipSpaceBefore(n.token, prev)) width++;
          width += n.token.value.length;
          prev = n.token;
          if (width > limit) { exceeded = true; return; }
        } else {
          if (prev && !shouldSkipSpaceBefore(n.open, prev)) width++;
          width += n.open.value.length;
          prev = n.open;
          if (width > limit) { exceeded = true; return; }
          visit(n.children);
          if (exceeded) return;
          if (n.close) {
            if (prev && !shouldSkipSpaceBefore(n.close, prev)) width++;
            width += n.close.value.length;
            prev = n.close;
            if (width > limit) { exceeded = true; return; }
          }
        }
      }
    };

    visit(nodes);
    return exceeded ? limit + 1 : width;
  };
  
  const formatNodes = (nodes: Node[], isMultilineCtx: boolean = false) => {
    for (const node of nodes) {
      if (node.type === 'Token') {
        const token = node.token;
        const upper = token.value.toUpperCase();
        
        if (token.type === TokenType.LineComment) {
          if (token.value.trim() === '//' && groupDepth === 0) {
            if (!isNewLine) newline();
            indent = 0;
            forDepth = 0;
            firstClauseSeen = false;
            inModificationContext = false;
            optionsIndentRestore = null;
            write('//');
            newline();
            prevToken = token;
            continue;
          }
          const ownLine = prevToken && token.line > prevToken.line;
          if (ownLine && !isNewLine) newline();
          if (!isNewLine && !shouldSkipSpaceBefore(token, prevToken)) write(' ');
          write(token.value.trimEnd());
          newline();
          prevToken = token;
          continue;
        }

        if (token.type === TokenType.BlockComment) {
          const ownLine = prevToken && token.line > prevToken.line;
          if (ownLine && !isNewLine) newline();
          if (!isNewLine && !shouldSkipSpaceBefore(token, prevToken)) write(' ');
          write(token.value);
          prevToken = token;
          continue;
        }
        
        const isClauseCandidate = token.type === TokenType.Keyword && CLAUSE_KEYWORDS.has(upper);
        const isWithAsClause = upper === 'WITH' && !firstClauseSeen;
        const treatAsClause = isClauseCandidate && (upper !== 'WITH' || isWithAsClause);

        if (token.type === TokenType.Keyword && MODIFIER_CLAUSE_KEYWORDS.has(upper) && upper === 'OPTIONS' && inModificationContext) {
          if (!isNewLine) newline();
          indent++;
          write(kw(upper, token.value));
          optionsIndentRestore = indent - 1;
          prevToken = token;
          continue;
        }

        if (treatAsClause) {
          firstClauseSeen = true;
          if (!isNewLine) newline();
          inModificationContext = MODIFICATION_CLAUSE_KEYWORDS.has(upper);

          if (upper === 'FOR') {
            write(kw(upper, token.value));
            indent++;
            forDepth++;
          } else if (upper === 'RETURN') {
            write(kw(upper, token.value));
            if (forDepth > 0) {
              indent--;
              forDepth--;
            }
          } else {
            write(kw(upper, token.value));
          }
          prevToken = token;
          continue;
        }

        if (isClauseCandidate) firstClauseSeen = true;
        
        if (token.type === TokenType.Semicolon) {
          write(';');
          newline();
          indent = 0;
          forDepth = 0;
          firstClauseSeen = false;
          inModificationContext = false;
          optionsIndentRestore = null;
          prevToken = token;
          continue;
        }

        if (token.type === TokenType.Comma) {
          write(',');
          if (isMultilineCtx) newline();
          prevToken = token;
          continue;
        }
        
        if (!isNewLine && !shouldSkipSpaceBefore(token, prevToken)) write(' ');
        write(token.type === TokenType.Keyword ? kw(upper, token.value) : token.value);
        prevToken = token;
        
      } else { // GroupNode
        if (!isNewLine && !shouldSkipSpaceBefore(node.open, prevToken)) write(' ');
        write(node.open.value);
        prevToken = node.open;
        groupDepth++;

        const hasClauseInside = node.children.some(n =>
          n.type === 'Token' && n.token.type === TokenType.Keyword && CLAUSE_KEYWORDS.has(n.token.value.toUpperCase())
        );
        
        const isSubquery = node.groupType === 'Paren' && hasClauseInside;
        const savedIndent = indent;
        const savedForDepth = forDepth;
        const savedFirstClause = firstClauseSeen;
        
        let shouldMultiline = false;
        
        if (isSubquery) {
          indent++;
          forDepth = 0;
          firstClauseSeen = false;
          newline();
        } else if (node.groupType === 'Bracket' || node.groupType === 'Brace') {
          shouldMultiline = estimateWidth(node.children) > printWidth;
          if (shouldMultiline) {
            indent++;
            newline();
          }
        }
        
        formatNodes(node.children, shouldMultiline);
        
        if (isSubquery) {
          indent = savedIndent;
          forDepth = savedForDepth;
          firstClauseSeen = savedFirstClause;
          if (!isNewLine) newline();
        } else if (shouldMultiline) {
          indent--;
          if (!isNewLine) newline();
        }
        
        if (node.close) {
          const needSpace =
            !isNewLine &&
            !isSubquery &&
            !shouldMultiline &&
            !shouldSkipSpaceBefore(node.close, prevToken);
          if (needSpace) write(' ');
          write(node.close.value);
          prevToken = node.close;
        }

        if (optionsIndentRestore !== null) {
          indent = optionsIndentRestore;
          optionsIndentRestore = null;
        }
        groupDepth--;
      }
    }
  };
  
  formatNodes(cst);

  if (!result.endsWith('\n')) result += '\n';
  return { text: result, diagnostics };
}
