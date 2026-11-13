import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, hasOfficialCareersSignal, CAREERS_URL, EXTERNAL_HANDOFF_URL } from './script.js'

const read = name => gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString()
const careers = read('careers-20261113.html.gz')
const denied = read('keka-denied-20261113.html.gz')

test('Raptee accepts its current branded careers document and exact own widget binding', () => {
  assert.equal(hasOfficialCareersSignal(careers), true)
  assert.equal(hasOfficialCareersSignal(careers.replace('rel="canonical" href="https://www.rapteehv.com/careers"',
    'rel="canonical" href="https://foreign.example/careers"')), false)
})

test('Raptee reports a native Keka access-denied document as unavailable without inventing an empty inventory', async () => {
  const reads = []
  await assert.rejects(run({
    fetchText: async url => { reads.push(url); return url === CAREERS_URL ? careers : denied },
    fetchBrowserText: async () => { assert.fail('An explicit native access denial cannot become a parser or empty-result fallback') },
    fetchJson: async () => { assert.fail('A denied handoff cannot authorize vacancy API parsing') },
  }), error => {
    assert.equal(error.failureKind, 'blocked_or_access_denied')
    assert.equal(error.softFailure, true)
    assert.equal(error.abortRetries, true)
    return true
  })
  assert.deepEqual(reads, [CAREERS_URL, EXTERNAL_HANDOFF_URL])
})
