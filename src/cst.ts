import { Token, TokenType } from './tokenizer';

export type Node = TokenNode | GroupNode;

export interface TokenNode {
  type: 'Token';
  token: Token;
}

export interface GroupNode {
  type: 'Group';
  groupType: 'Paren' | 'Bracket' | 'Brace';
  open: Token;
  close: Token | null;
  children: Node[];
}

export function buildCST(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack: { groupType: 'Paren' | 'Bracket' | 'Brace', open: Token, children: Node[] }[] = [];

  for (const token of tokens) {
    if (token.type === TokenType.OpenParen) {
      stack.push({ groupType: 'Paren', open: token, children: [] });
    } else if (token.type === TokenType.OpenBracket) {
      stack.push({ groupType: 'Bracket', open: token, children: [] });
    } else if (token.type === TokenType.OpenBrace) {
      stack.push({ groupType: 'Brace', open: token, children: [] });
    } else if (token.type === TokenType.CloseParen || token.type === TokenType.CloseBracket || token.type === TokenType.CloseBrace) {
      const matchType = token.type === TokenType.CloseParen ? 'Paren' : token.type === TokenType.CloseBracket ? 'Bracket' : 'Brace';

      if (stack.length > 0 && stack[stack.length - 1].groupType === matchType) {
        const group = stack.pop();
        if (!group) { break; }
        const groupNode: GroupNode = { type: 'Group', groupType: group.groupType, open: group.open, close: token, children: group.children };
        if (stack.length > 0) {
          stack[stack.length - 1].children.push(groupNode);
        } else {
          root.push(groupNode);
        }
      } else {
        const node: TokenNode = { type: 'Token', token };
        if (stack.length > 0) stack[stack.length - 1].children.push(node);
        else root.push(node);
      }
    } else {
      const node: TokenNode = { type: 'Token', token };
      if (stack.length > 0) stack[stack.length - 1].children.push(node);
      else root.push(node);
    }
  }

  while (stack.length > 0) {
    const group = stack.pop();
    if (!group) { break; }
    const groupNode: GroupNode = { type: 'Group', groupType: group.groupType, open: group.open, close: null, children: group.children };
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(groupNode);
    } else {
      root.push(groupNode);
    }
  }

  return root;
}
