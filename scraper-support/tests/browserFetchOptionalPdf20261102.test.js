import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const backend = fileURLToPath(new URL('../../', import.meta.url))
const browserFetch = new URL('../shared/browserFetch.js', import.meta.url).href
function restricted(script) {
  return spawnSync(process.execPath, ['--permission', `--allow-fs-read=${backend}`,
    '--input-type=module', '--eval', script], { cwd: backend, encoding: 'utf8', timeout: 20000 })
}

test('HTML and JSON source requests work without permission to load optional native PDF addons', () => {
  const result = restricted(`
    import assert from 'node:assert/strict';
    const { createBrowserFetchSession } = await import(${JSON.stringify(browserFetch)});
    globalThis.fetch = async url => ({ ok: true, status: 200, url,
      headers: new Headers({ 'content-type': url.endsWith('.json') ? 'application/json' : 'text/html' }),
      text: async () => url.endsWith('.json') ? '{"total":1}' : '<h1>Current openings</h1>' });
    const session = await createBrowserFetchSession();
    assert.equal(await session.fetchText('https://source.example/careers'), '<h1>Current openings</h1>');
    assert.deepEqual(await session.fetchJson('https://source.example/jobs.json'), { total: 1 });
    await session.close();
    console.log('HTML_AND_JSON_PASSED');
  `)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /HTML_AND_JSON_PASSED/)
})

test('an unavailable optional PDF parser does not prevent later HTML source requests', () => {
  const result = restricted(`
    import assert from 'node:assert/strict';
    const { createBrowserFetchSession } = await import(${JSON.stringify(browserFetch)});
    globalThis.fetch = async url => ({ ok: true, status: 200, url,
      headers: new Headers({ 'content-type': url.endsWith('.pdf') ? 'application/pdf' : 'text/html' }),
      arrayBuffer: async () => new TextEncoder().encode('%PDF-1.4 invalid-test-pdf').buffer,
      text: async () => '<h1>Next healthy source</h1>' });
    const session = await createBrowserFetchSession();
    assert.equal(await session.fetchText('https://source.example/ad.pdf'), '');
    assert.equal(await session.fetchText('https://source.example/careers'), '<h1>Next healthy source</h1>');
    await session.close();
    console.log('NEXT_HTML_PASSED');
  `)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /NEXT_HTML_PASSED/)
})
