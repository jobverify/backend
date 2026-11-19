import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { runNativeCorteva } from './nativeCurrent.js'
import { CAREERS, PORTAL, BOARD, searchURL } from './nativeDeclarations.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const html = gunzipSync(readFileSync(new URL('./fixtures/board-20261119.html.gz', import.meta.url))).toString()
const declaration = readNativeDocument(html).nodes(node => node.tag === 'script' && /^\/gen\/js\/pcsxPwa\.[a-f0-9]{16}\.js$/.test(node.attrs.src ?? ''))
assert.equal(declaration.length, 1)

const replay = async boardHTML => {
  const calls = [], reachedSearch = Error('Native public search reached')
  await assert.rejects(runNativeCorteva({ fetchResponse: async url => {
    calls.push(url)
    if (url === searchURL(0)) throw reachedSearch
    const bytes = url === CAREERS ? Buffer.from('<a href="https://apply.corteva.com/">Search all jobs</a>')
      : url === PORTAL ? Buffer.from('Redirect to careers') : url === BOARD ? Buffer.from(boardHTML) : null
    assert.ok(bytes, 'Only existing employer-owned public recruitment routes')
    return { status: url === PORTAL ? 302 : 200, finalURL: url,
      headers: { 'content-type': 'text/html', ...(url === PORTAL ? { location: '/careers' } : {}) },
      contentType: 'text/html', bytes }
  } }), error => error === reachedSearch)
  assert.deepEqual(calls, [CAREERS, PORTAL, BOARD, searchURL(0)])
}

test('November19 Corteva native role collection admits the employer-owned board without pinning an unrelated JavaScript build', async () => {
  await replay(html)
})

test('November19 Corteva native board still rejects contradictory tenant/config and ambiguous active clients', async () => {
  for (const changed of [html.replaceAll('corteva.com', 'unrelated.example'),
    html.replace(/(efJdOverridesAtsPosting(?:&#34;|&quot;|"):\s*)false/, '$1true'),
    html + '<script src="' + declaration[0].attrs.src + '"></script>']) {
    assert.ok(changed !== html, 'Negative control changed the captured board')
    await assert.rejects(replay(changed))
  }
})
