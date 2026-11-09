import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('native evaluation identity changes when either prose implementation changes', async () => {
  const { rewritePolicyIdentity } = await import('../rewriting/policyIdentity.js');
  const original = await rewritePolicyIdentity();
  for (const file of ['prose.js', 'proseValidation.js', 'proseLayout.js', 'correctionPolicy.js']) {
    const changed = await rewritePolicyIdentity({ readFile: async url => {
      const text = await fs.readFile(url);
      return url.pathname.endsWith('/' + file) ? Buffer.concat([text, Buffer.from('\n// policy changed')]) : text;
    } });
    assert.notEqual(changed, original);
  }
});
