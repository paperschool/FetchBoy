/**
 * Best-effort conversion of Postman pre-request scripts to FetchBoy's `fb.*` API.
 *
 * Mechanical mappings are applied directly. Postman APIs that have no FetchBoy
 * equivalent (or that need a control-flow rewrite, like `pm.sendRequest`'s
 * callback style) are left in place and reported in `unconverted` so the
 * importer can prepend a clear `// TODO` banner — the script stays readable and
 * the user knows exactly what to fix by hand.
 */

export interface ConversionResult {
  /** Converted code (mechanical bits replaced; unconvertible bits untouched). */
  code: string;
  /** Distinct Postman APIs that could not be auto-converted. */
  unconverted: string[];
}

/** Mechanical string replacements — Postman API → FetchBoy API. */
const REPLACEMENTS: Array<[RegExp, string]> = [
  // Environment variables
  [/\bpm\.environment\.get\(/g, 'fb.env.get('],
  [/\bpm\.environment\.set\(/g, 'fb.env.set('],
  [/\bpm\.environment\.unset\(/g, 'fb.env.set('],
  // Globals / collection / generic variables — FetchBoy has a single env scope,
  // so these all fold into fb.env.*.
  [/\bpm\.globals\.get\(/g, 'fb.env.get('],
  [/\bpm\.globals\.set\(/g, 'fb.env.set('],
  [/\bpm\.collectionVariables\.get\(/g, 'fb.env.get('],
  [/\bpm\.collectionVariables\.set\(/g, 'fb.env.set('],
  [/\bpm\.variables\.get\(/g, 'fb.env.get('],
  [/\bpm\.variables\.set\(/g, 'fb.env.set('],
  // Legacy `postman.*` API
  [/\bpostman\.getEnvironmentVariable\(/g, 'fb.env.get('],
  [/\bpostman\.setEnvironmentVariable\(/g, 'fb.env.set('],
  [/\bpostman\.getGlobalVariable\(/g, 'fb.env.get('],
  [/\bpostman\.setGlobalVariable\(/g, 'fb.env.set('],
  // Test / assertion APIs (post-response scripts) → fb.test / fb.expect.
  [/\bpm\.test\(/g, 'fb.test('],
  [/\bpm\.expect\(/g, 'fb.expect('],
  // Postman response accessors → fb.response. (Specific forms before the bare
  // `pm.response` catch-all so the right accessor is mapped.)
  [/\bpm\.response\.to\.have\.status\(/g, 'fb.expect(fb.response.status).toBe('],
  [/\bpm\.response\.json\(\)/g, 'JSON.parse(fb.response.body)'],
  [/\bpm\.response\.text\(\)/g, 'fb.response.body'],
  [/\bpm\.response\.code\b/g, 'fb.response.status'],
  [/\bpm\.response\.responseTime\b/g, 'fb.response.time'],
  // Chai BDD assertion chains → fb.expect matchers (most specific first).
  [/\.to\.deep\.equal\(/g, '.toEqual('],
  [/\.to\.eql\(/g, '.toEqual('],
  [/\.to\.be\.equal\(/g, '.toBe('],
  [/\.to\.equal\(/g, '.toBe('],
  [/\.to\.include\(/g, '.toContain('],
  [/\.to\.contain\(/g, '.toContain('],
  [/\.to\.be\.above\(/g, '.toBeGreaterThan('],
  [/\.to\.be\.greaterThan\(/g, '.toBeGreaterThan('],
];

/**
 * Postman APIs with no mechanical FetchBoy mapping. Detected after replacement;
 * each maps to a hint shown in the TODO banner.
 */
const UNCONVERTIBLE: Array<[RegExp, string]> = [
  [/\bpm\.sendRequest\b/, 'pm.sendRequest — use: const res = await fb.http.post(url, { headers, body }); then JSON.parse(res.body)'],
  [/\bpm\.response\b/, 'pm.response — only .json()/.text()/.code/.responseTime/.to.have.status() are auto-converted; other accessors need manual review'],
  [/\bpm\.cookies\b/, 'pm.cookies — no equivalent'],
  [/\bpm\.info\b/, 'pm.info — no equivalent'],
  [/\bpm\.iterationData\b/, 'pm.iterationData — no equivalent'],
  // Chai assertions that survived the mechanical mapping (property-style like
  // .to.be.true / .to.have.property) have no fb.expect matcher.
  [/\.to\.(?:be|have|not|include|exist)\b/, 'Chai assertion — common .to.equal/.eql/.include/.above cases were converted; review remaining .to.* assertions manually'],
];

export function convertPmToFb(src: string): ConversionResult {
  let code = src;
  for (const [pattern, replacement] of REPLACEMENTS) {
    code = code.replace(pattern, replacement);
  }

  const unconverted: string[] = [];
  for (const [pattern, hint] of UNCONVERTIBLE) {
    if (pattern.test(code)) unconverted.push(hint);
  }
  // Catch any remaining pm.* / postman.* the lists above didn't name explicitly.
  const residual = code.match(/\b(?:pm|postman)\.[a-zA-Z_]+/g);
  if (residual) {
    for (const r of Array.from(new Set(residual))) {
      if (!unconverted.some((u) => u.startsWith(r))) {
        unconverted.push(`${r} — no FetchBoy equivalent, review manually`);
      }
    }
  }

  if (unconverted.length > 0) {
    const banner = [
      '// ⚠️ Imported from Postman — auto-converted where possible.',
      '// The following need manual review (no direct FetchBoy equivalent):',
      ...unconverted.map((u) => `//   - ${u}`),
      '',
    ].join('\n');
    code = banner + code;
  }

  return { code, unconverted };
}
