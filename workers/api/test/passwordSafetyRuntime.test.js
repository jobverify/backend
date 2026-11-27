import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';

test('password screening works in Workers and rejects compromised passwords and redirects', async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL('../../../src/services/', import.meta.url)),
      contents: `
        import { createPasswordSafety } from './passwordSafety.js';
        export default { async fetch(request) {
          const mode = new URL(request.url).pathname;
          const safety = createPasswordSafety({ fetchImpl: async (url, options) => {
            const outgoing = new Request(url, options);
            if (outgoing.redirect !== 'manual') throw new Error('Redirects must not be followed');
            if (mode === '/redirect') return Response.redirect('https://other.example', 302);
            return new Response(mode === '/compromised'
              ? 'F5F70D47ADC2DB2EB397FBEF5F7BC560E29:42'
              : '0'.repeat(35) + ':0');
          }});
          try {
            await safety.check('Password123!');
            return Response.json({ success: true });
          } catch (error) {
            return Response.json({ code: error.code }, { status: error.statusCode || 500 });
          }
        }};
      `,
    },
    bundle: true, write: false, format: 'esm', platform: 'node', external: ['node:*'],
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-11-10', compatibilityFlags: ['nodejs_compat'],
  }));
  try {
    const accepted = await runtime.dispatchFetch('http://localhost/clean');
    assert.equal(accepted.status, 200);
    const compromised = await runtime.dispatchFetch('http://localhost/compromised');
    assert.equal(compromised.status, 400);
    assert.equal((await compromised.json()).code, 'password_compromised');
    const redirect = await runtime.dispatchFetch('http://localhost/redirect');
    assert.equal(redirect.status, 503);
    assert.equal((await redirect.json()).code, 'password_check_unavailable');
  } finally { await runtime.dispose(); }
});
