/**
 * Pure helpers for the on-type formatting provider. Kept free of any vscode
 * imports so unit tests can exercise the logic without the editor host.
 */

export type CloserChar = '}' | ')' | ']';
const OPENER_OF: Record<CloserChar, string> = { '}': '{', ')': '(', ']': '[' };
const CLOSER_OF: Record<string, CloserChar> = { '{': '}', '(': ')', '[': ']' };

/**
 * Returns the byte offset within `text` of the line containing `offset`.
 */
function lineStartOffset(text: string, offset: number): number {
  for (let i = offset - 1; i >= 0; i--) {
    if (text.charCodeAt(i) === 10) return i + 1;
  }
  return 0;
}

/**
 * Reads the leading whitespace (spaces or tabs) of the line containing
 * `offset`.
 */
function leadingWhitespace(text: string, offset: number): string {
  const start = lineStartOffset(text, offset);
  let end = start;
  while (end < text.length) {
    const c = text.charCodeAt(end);
    if (c === 32 || c === 9) end++;
    else break;
  }
  return text.slice(start, end);
}

/**
 * Forward-scans `text` over the half-open range `[0, end)` and returns the
 * offset of the unmatched opener that pairs with `closer`, or -1 if no such
 * opener exists. Brackets inside string literals, line comments, and block
 * comments are ignored. Strings honor backslash escapes.
 */
function scanForOpener(text: string, end: number, closer: CloserChar): number {
  const opener = OPENER_OF[closer];
  const stack: number[] = [];
  let i = 0;
  while (i < end) {
    const ch = text[i];

    if (ch === '/' && i + 1 < end && text[i + 1] === '/') {
      i += 2;
      while (i < end && text[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && i + 1 < end && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < end && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < end) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }

    if (ch === opener) {
      stack.push(i);
    } else if (ch === closer) {
      stack.pop();
    }
    i++;
  }
  return stack.length > 0 ? stack[stack.length - 1] : -1;
}

/**
 * Computes the indent string a line should adopt after the user types a
 * closing bracket. Returns `null` when no matching opener is found, when the
 * trigger is not actually the last non-whitespace character of its line, or
 * when the indent is already correct.
 *
 * `text` is the full document text after the trigger was inserted; `offset`
 * is the position immediately after the trigger character.
 */
export function computeDedentIndent(
  text: string,
  offset: number,
  trigger: string
): string | null {
  if (trigger !== '}' && trigger !== ')' && trigger !== ']') return null;
  const closer = trigger;
  if (offset <= 0 || text[offset - 1] !== closer) return null;

  const lineStart = lineStartOffset(text, offset);
  for (let i = lineStart; i < offset - 1; i++) {
    const c = text.charCodeAt(i);
    if (c !== 32 && c !== 9) return null;
  }

  const openerOffset = scanForOpener(text, offset - 1, closer);
  if (openerOffset < 0) return null;

  const desired = leadingWhitespace(text, openerOffset);
  const current = text.slice(lineStart, offset - 1);
  if (current === desired) return null;
  return desired;
}

/**
 * Convenience: pairs a trigger character with its expected opener.
 */
export function openerFor(closer: string): string | null {
  return OPENER_OF[closer as CloserChar] ?? null;
}

/**
 * Convenience used by tests: maps an opener to its closer.
 */
export function closerFor(opener: string): string | null {
  return CLOSER_OF[opener] ?? null;
}
