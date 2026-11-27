import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { fileURLToPath } from 'node:url';

test('email service requests are accepted by the real Workers Request implementation', async () => {
  const bundle = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL('../adapters/', import.meta.url)),
      contents: `
        import * as email from './sendEmail.js';
        export default { async fetch() {
          email.bindEmailRelay({ async fetch(url, options) {
            const request = new Request(url, options);
            if (request.redirect !== 'manual') throw new Error('Redirects must not be followed');
            return Response.json({ success: true });
          }});
          const results = [];
          for (const send of [email.sendVerificationEmail, email.sendPasswordResetEmail, email.sendEmailChangeVerificationEmail]) {
            results.push(await send('fixture@gmail.com', 'https://www.jobverify.in/verify-email#token=' + 'a'.repeat(64)));
          }
          return Response.json(results);
        }};
      `,
    },
    bundle: true, write: false, format: 'esm', platform: 'node',
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: '2026-11-10',
    compatibilityFlags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
    bindings: { EMAIL_RELAY_URL: 'https://relay.example', EMAIL_RELAY_SECRET: 'a'.repeat(32) },
  }));
  try {
    const response = await runtime.dispatchFetch('http://localhost/');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), Array.from({ length: 3 }, () => ({ accepted: ['fixture@gmail.com'] })));
  } finally { await runtime.dispose(); }
});
