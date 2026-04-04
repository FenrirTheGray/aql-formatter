import { tokenize, Token, TokenType } from './tokenizer';
import { CLAUSE_KEYWORDS } from './keywords';
import { Node, buildCST } from './cst';

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  printWidth?: number;
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


export function formatAql(text: string, options: FormatOptions): string {
  const allTokens = tokenize(text);
  const tokens = allTokens.filter(t => t.type !== TokenType.Whitespace);
  if (tokens.length === 0) return '';

  const cst = buildCST(tokens);
  const indentChar = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  const printWidth = options.printWidth || 80;
  
  let result = '';
  let indent = 0;
  let forDepth = 0;
  let firstClauseSeen = false;
  let isNewLine = true;
  let prevToken: Token | null = null;
  
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
        
        if (treatAsClause) {
          firstClauseSeen = true;
          if (!isNewLine) newline();
          
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
          // Add space before closing brace if not multiline and has inner content
          let addedSpace = false;
          if (!isSubquery && !shouldMultiline && node.open.type === TokenType.OpenBrace && node.close.type === TokenType.CloseBrace && node.children.length > 0) {
             if (!shouldSkipSpaceBefore(node.close, prevToken)) {
               write(' ');
               addedSpace = true;
             }
          }
          if (!addedSpace && !isNewLine && !isSubquery && !shouldMultiline && !shouldSkipSpaceBefore(node.close, prevToken)) {
             write(' ');
          }
          
          write(node.close.value);
          prevToken = node.close;
        }
      }
    }
  };
  
  formatNodes(cst);
  
  if (!result.endsWith('\n')) result += '\n';
  return result;
}
