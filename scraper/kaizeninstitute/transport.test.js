import assert from 'node:assert/strict'
import test from 'node:test'
import { run, HOMEPAGE_URL, CAREERS_URL } from './script.js'

test('requests identity encoding to avoid the careers server malformed gzip response', async t => {
  const pages = new Map([
    [HOMEPAGE_URL, 'Excellence And Lean Consulting KI India| Kaizen Kaizen Institute India provides lean consulting services to boost business performance Operational Excellence Consulting | Kaizen Institute'],
    [CAREERS_URL, 'Career Opportunities At Kaizen Institute India Find your place at Kaizen Institute Send us an e-mail to join our team in@kaizen.com Who works with Kaizen Institute'],
  ])
  const requested = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const headers = new Headers(options?.headers)
    assert.equal(headers.get('accept-encoding'), 'identity')
    requested.push(url)
    return { status: 200, url, headers: new Headers(), text: async () => pages.get(url) }
  })
  assert.deepEqual(await run(), [])
  assert.deepEqual(requested, [HOMEPAGE_URL, CAREERS_URL])
})
