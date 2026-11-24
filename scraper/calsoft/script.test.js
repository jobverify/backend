import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import test, { after, before } from 'node:test'
import { gunzipSync } from 'node:zlib'
import { CAREERS_URL, createCalsoftScraper } from './script.js'

const originalHTML = gunzipSync(fs.readFileSync(new URL('./test-data/initial-careers-original-20261121.html.gz', import.meta.url))).toString('utf8')
const saved = { fetch: globalThis.fetch, httpRequest: http.request, httpGet: http.get, httpsRequest: https.request, httpsGet: https.get }
let networkCalls = 0

before(() => {
  const blocked = () => { networkCalls++; throw new Error('No real network in Calsoft saved-page checks') }
  globalThis.fetch = blocked
  http.request = http.get = https.request = https.get = blocked
})

after(() => {
  globalThis.fetch = saved.fetch
  http.request = saved.httpRequest
  http.get = saved.httpGet
  https.request = saved.httpsRequest
  https.get = saved.httpsGet
  assert.equal(networkCalls, 0)
})

const replay = html => {
  const requests = []
  return {
    requests,
    options: { fetchText: async url => { requests.push(url); assert.equal(url, CAREERS_URL); return html } },
  }
}

test('actual initial SSR zero cannot certify an empty Calsoft inventory', async () => {
  const io = replay(originalHTML)
  await assert.rejects(createCalsoftScraper().run(io.options), error => {
    assert.equal(error.failureKind, 'source_inventory_unavailable')
    assert.equal(error.upstreamOutage, false)
    assert.equal(error.abortRetries, true)
    const evidence = error.recruitmentObservations
    assert.equal(evidence.rawCareersHTML, originalHTML)
    assert.equal(evidence.responseMetadataQualified, false)
    assert.equal(evidence.nativeListingInventoryAcquired, false)
    assert.equal(evidence.observedVacancyCount, null)
    assert.equal(evidence.companyIndiaTotal, null)
    assert.equal(evidence.companyGlobalTotal, null)
    assert.equal(evidence.verifiedEmpty, false)
    assert.equal(evidence.sourceScopeComplete, false)
    assert.equal(evidence.lifecycleCleanupAllowed, false)
    return true
  })
  assert.deepEqual(io.requests, [CAREERS_URL])
})

test('job markup alongside a zero display remains unqualified instead of returning an empty array', async () => {
  const changed = originalHTML.replace('</body>', '<article class="job-card"><h2>Unqualified role</h2></article></body>')
  assert.notEqual(changed, originalHTML)
  const io = replay(changed)
  await assert.rejects(createCalsoftScraper().run(io.options))
  assert.deepEqual(io.requests, [CAREERS_URL])
})

test('another publisher cannot qualify the same empty display', async () => {
  const io = replay(originalHTML.replaceAll('Calsoft', 'Unrelated Company'))
  await assert.rejects(createCalsoftScraper().run(io.options))
  assert.deepEqual(io.requests, [CAREERS_URL])
})

test('an acquisition error preserves its identity and performs no additional read', async () => {
  const originalError = Object.assign(new Error('saved transport failure'), { failureKind: 'transport_error' })
  let requests = 0
  await assert.rejects(createCalsoftScraper().run({ fetchText: async url => {
    requests++
    assert.equal(url, CAREERS_URL)
    throw originalError
  } }), error => error === originalError)
  assert.equal(requests, 1)
})
