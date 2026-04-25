import { tokenize, Token, TokenType } from './tokenizer';
import { CLAUSE_KEYWORDS, MODIFICATION_CLAUSE_KEYWORDS, MODIFIER_CLAUSE_KEYWORDS } from './keywords';
import { Node, buildCST } from './cst';

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  printWidth?: number;
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
  const allTokens = tokenize(text);
  for (const t of allTokens) {
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
  const tokens = allTokens.filter(t => t.type !== TokenType.Whitespace);
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
  
  const flattenToTokens = (nodes: Node[]): Token[] => {
    const out: Token[] = [];
    for (const n of nodes) {
      if (n.type === 'Token') {
        out.push(n.token);
      } else {
        out.push(n.open);
        out.push(...flattenToTokens(n.children));
        if (n.close) out.push(n.close);
      }
    }
    return out;
  };

  const estimateWidth = (nodes: Node[]): number => {
    const tokens = flattenToTokens(nodes);
    let width = 0;
    let prev: Token | null = null;
    for (const token of tokens) {
      if (prev && !shouldSkipSpaceBefore(token, prev)) width++;
      width += token.value.length;
      prev = token;
    }
    return width;
  };
  
  const formatNodes = (nodes: Node[], isMultilineCtx: boolean = false) => {
    for (const node of nodes) {
      if (node.type === 'Token') {
        const token = node.token;
        const upper = token.value.toUpperCase();
        
        if (token.type === TokenType.LineComment) {
          if (token.value.trim() === '//') {
            if (!isNewLine) newline();
            indent = 0;
            forDepth = 0;
            firstClauseSeen = false;
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
          write(upper);
          optionsIndentRestore = indent - 1;
          prevToken = token;
          continue;
        }

        if (treatAsClause) {
          firstClauseSeen = true;
          if (!isNewLine) newline();
          inModificationContext = MODIFICATION_CLAUSE_KEYWORDS.has(upper);

          if (upper === 'FOR') {
            write(upper);
            indent++;
            forDepth++;
          } else if (upper === 'RETURN') {
            write(upper);
            if (forDepth > 0) {
              indent--;
              forDepth--;
            }
          } else {
            write(upper);
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
        write(token.type === TokenType.Keyword ? upper : token.value);
        prevToken = token;
        
      } else { // GroupNode
        if (!isNewLine && !shouldSkipSpaceBefore(node.open, prevToken)) write(' ');
        write(node.open.value);
        prevToken = node.open;
        
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
      }
    }
  };
  
  formatNodes(cst);

  if (!result.endsWith('\n')) result += '\n';
  return { text: result, diagnostics };
}
