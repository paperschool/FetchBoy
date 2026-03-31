export interface JsKeyResult {
  keys: string[];
  error: string | null;
}

/**
 * Best-effort static extraction of top-level keys from the last `return { ... }` statement.
 * Not a full AST parser — handles common patterns for UX feedback.
 */
export function extractReturnKeys(code: string): JsKeyResult {
  if (!code.trim()) {
    return { keys: [], error: null };
  }

  // Find all return statements, use the last one
  const returnRegex = /return\s+/g;
  let lastReturnIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = returnRegex.exec(code)) !== null) {
    lastReturnIndex = match.index + match[0].length;
  }

  if (lastReturnIndex === -1) {
    return { keys: [], error: null };
  }

  const afterReturn = code.slice(lastReturnIndex).trim();

  // Check if it returns an object literal
  if (!afterReturn.startsWith('{')) {
    // Returns a variable or expression — can't statically analyse
    return { keys: [], error: null };
  }

  // Extract the object literal body by finding matching braces
  let depth = 0;
  let objectEnd = -1;
  for (let i = 0; i < afterReturn.length; i++) {
    if (afterReturn[i] === '{') depth++;
    else if (afterReturn[i] === '}') {
      depth--;
      if (depth === 0) {
        objectEnd = i;
        break;
      }
    }
  }

  if (objectEnd === -1) {
    return { keys: [], error: 'Unbalanced braces in return statement' };
  }

  const objectBody = afterReturn.slice(1, objectEnd);

  // Extract top-level property keys (before : or as shorthand identifiers)
  const keys: string[] = [];
  // Split by commas at depth 0 (not inside nested braces/brackets/parens/strings)
  const tokens = splitTopLevel(objectBody);

  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed) continue;

    // Skip spread: ...something
    if (trimmed.startsWith('...')) continue;

    // Key: value pattern
    const colonMatch = trimmed.match(/^(\w+)\s*:/);
    if (colonMatch) {
      keys.push(colonMatch[1]);
      continue;
    }

    // Shorthand: just an identifier
    const shorthandMatch = trimmed.match(/^(\w+)\s*$/);
    if (shorthandMatch) {
      keys.push(shorthandMatch[1]);
      continue;
    }

    // Quoted key: "key": value or 'key': value
    const quotedMatch = trimmed.match(/^["'](\w+)["']\s*:/);
    if (quotedMatch) {
      keys.push(quotedMatch[1]);
    }
  }

  return { keys, error: null };
}

/** Split a string by commas at depth 0 (ignoring nested structures and strings). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString: string | null = null;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];

    if (inString) {
      current += ch;
      if (ch === inString && body[i - 1] !== '\\') {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      current += ch;
      continue;
    }

    if (ch === '{' || ch === '[' || ch === '(') {
      depth++;
      current += ch;
      continue;
    }

    if (ch === '}' || ch === ']' || ch === ')') {
      depth--;
      current += ch;
      continue;
    }

    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.trim()) parts.push(current);
  return parts;
}
