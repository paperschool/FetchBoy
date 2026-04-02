import { translations } from './en';
import type { TranslationKey } from './types';

/**
 * Look up a translated string by key. Supports interpolation with `{param}` placeholders.
 * Returns the key itself if not found (dev fallback — makes missing translations visible).
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template: string = translations[key] ?? key;
  if (!params) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (_, k: string) => String(params[k] ?? `{${k}}`),
  );
}

export type { TranslationKey };
