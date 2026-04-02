import { parsePostmanV21 } from './postmanV21';
import { parsePostmanV1 } from './postmanV1';
import { parseInsomniaV4 } from './insomniaV4';
import type { ImportFormat, ImportResult } from './types';

/** Dispatch raw file content to the appropriate parser based on format. */
export function parseByFormat(content: string, format: ImportFormat): ImportResult {
  switch (format) {
    case 'postman-v1':
      return parsePostmanV1(content);
    case 'postman-v2':
      return parsePostmanV21(content);
    case 'insomnia-v4':
      return parseInsomniaV4(content);
    default:
      throw new Error(`Unknown import format: ${format}`);
  }
}
