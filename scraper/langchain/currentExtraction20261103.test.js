import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createOfficialAtsRecoveryScraper, OFFICIAL_ATS_DISCOVERY } from '../../scraper-support/utils/officialAtsRecovery.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

// This older two-response capture remains a regression of the historical
// shared recovery helper. It cannot stand in for the new production collector's
// native board and closing checks; the 2026-11-05 test covers those boundaries.
const fixture = new URL('./test-data/ats-recovery-20261103/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixture)))
const receipts = manifest.requests.map(row => {
  const bytes = gunzipSync(readFileSync(new URL(row.filename, fixture)))
  assert.equal(bytes.length, row.bodyBytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.bodySHA256)
  return { ...row, body: bytes.toString('utf8') }
})
const provider = { source: 'langchain', companyName: 'LangChain', companyDomain: 'langchain.com',
  companyCareerPage: 'https://www.langchain.com/careers', officialHomepageUrl: 'https://langchain.com/', sourceScopeComplete: false }
const apiURL = receipts[1].requestedURL, nativePayload = JSON.parse(receipts[1].body)
const fetchPage = async url => {
  const row = receipts.find(row => row.requestedURL === url)
  assert.ok(row, 'Uncaptured historical response: ' + url)
  return { status: row.status, url: row.finalURL, html: row.body }
}
test('historical 2026-11-03 two-read recovery preserves its 102 observations and unresolved source scope', async () => {
  const calls = []
  const jobs = await createOfficialAtsRecoveryScraper(provider).run({ fetchPage, fetchJson: async url => {
    calls.push(url); assert.equal(url, apiURL); return structuredClone(nativePayload)
  } })
  assert.deepEqual(calls, [apiURL])
  assert.equal(nativePayload.jobs.length, 102)
  assert.equal(jobs.length, 0)
  assert.equal(jobs[OFFICIAL_ATS_DISCOVERY].boards[0].boardToken, 'langchain')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})
test('historical helper synthetic typed India role retains its incomplete source flags', async () => {
  const role = structuredClone(nativePayload.jobs[0])
  Object.assign(role, { location: 'Bengaluru, India', secondaryLocations: [],
    address: { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } } })
  const jobs = await createOfficialAtsRecoveryScraper(provider).run({ fetchPage,
    fetchJson: async () => ({ apiVersion: '1', jobs: [role] }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
test('historical recovery rejects unavailable employer binding before native API access', async () => {
  await assert.rejects(createOfficialAtsRecoveryScraper(provider).run({
    fetchPage: async url => ({ status: 403, url, html: '' }),
    fetchJson: async () => assert.fail('Unverified binding cannot authorize an API read'),
  }), error => error.failureKind === 'coverage_gap')
})
test('historical recovery still rejects malformed inventory envelopes', async () => {
  await assert.rejects(createOfficialAtsRecoveryScraper(provider).run({ fetchPage,
    fetchJson: async () => ({ success: false, jobs: [] }),
  }), /inventory envelope/)
})
