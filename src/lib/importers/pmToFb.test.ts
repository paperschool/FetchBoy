import { describe, it, expect } from 'vitest';
import { convertPmToFb } from './pmToFb';

describe('convertPmToFb', () => {
  it('converts environment get/set mechanically', () => {
    const { code, unconverted } = convertPmToFb(
      'var t = pm.environment.get("token");\npm.environment.set("x", t);',
    );
    expect(code).toContain('fb.env.get("token")');
    expect(code).toContain('fb.env.set("x", t)');
    expect(unconverted).toHaveLength(0);
  });

  it('folds globals and collection/variables into fb.env', () => {
    const { code } = convertPmToFb(
      'pm.globals.get("a"); pm.collectionVariables.set("b", 1); pm.variables.get("c");',
    );
    expect(code).toContain('fb.env.get("a")');
    expect(code).toContain('fb.env.set("b", 1)');
    expect(code).toContain('fb.env.get("c")');
  });

  it('converts legacy postman.* variable API', () => {
    const { code } = convertPmToFb('postman.setEnvironmentVariable("k", "v");');
    expect(code).toContain('fb.env.set("k", "v")');
  });

  it('flags pm.sendRequest as unconverted and prepends a TODO banner', () => {
    const { code, unconverted } = convertPmToFb(
      'pm.sendRequest({ url: u, method: "POST" }, function (e, r) {});',
    );
    expect(unconverted.some((u) => u.startsWith('pm.sendRequest'))).toBe(true);
    expect(code.startsWith('// ⚠️ Imported from Postman')).toBe(true);
    expect(code).toContain('fb.http.post');
    // Original line is preserved (not deleted)
    expect(code).toContain('pm.sendRequest(');
  });

  it('reports residual pm.* APIs not in the explicit list', () => {
    const { unconverted } = convertPmToFb('pm.somethingNew.doThing();');
    expect(unconverted.some((u) => u.startsWith('pm.somethingNew'))).toBe(true);
  });

  it('converts pm.test / pm.expect and chai chains so imported tests run as fb.* (no bare pm)', () => {
    const { code, unconverted } = convertPmToFb(
      'pm.test("status", function () {\n  pm.expect(pm.response.code).to.equal(200);\n  pm.expect(pm.response.json().items).to.eql([1]);\n});',
    );
    expect(code).toContain('fb.test("status"');
    expect(code).toContain('fb.expect(fb.response.status).toBe(200)');
    expect(code).toContain('fb.expect(JSON.parse(fb.response.body).items).toEqual([1])');
    // No residual pm.* / chai .to.* survives this common case → no manual-review banner.
    expect(code).not.toContain('pm.');
    expect(unconverted).toHaveLength(0);
  });

  it('flags property-style chai assertions that have no fb.expect matcher', () => {
    const { unconverted } = convertPmToFb('pm.test("t", () => pm.expect(ok).to.be.true);');
    expect(unconverted.some((u) => /Chai assertion/.test(u))).toBe(true);
  });

  it('leaves clean non-postman code untouched and banner-free', () => {
    const src = 'const x = 1 + 2;\nfb.env.set("y", String(x));';
    const { code, unconverted } = convertPmToFb(src);
    expect(code).toBe(src);
    expect(unconverted).toHaveLength(0);
  });
});
