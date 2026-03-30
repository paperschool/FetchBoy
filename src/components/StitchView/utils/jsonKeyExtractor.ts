export interface JsonKeyResult {
  keys: string[];
  error: string | null;
}

export function extractJsonKeys(jsonString: string): JsonKeyResult {
  if (!jsonString.trim()) {
    return { keys: [], error: 'Empty input' };
  }

  try {
    const parsed: unknown = JSON.parse(jsonString);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { keys: [], error: 'Must be a JSON object' };
    }

    return { keys: Object.keys(parsed as Record<string, unknown>), error: null };
  } catch (e) {
    const message = e instanceof SyntaxError ? e.message : 'Invalid JSON';
    return { keys: [], error: message };
  }
}
