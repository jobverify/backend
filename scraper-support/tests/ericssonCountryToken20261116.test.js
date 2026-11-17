import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { readEightfoldLocationScope } from '../apiPortal/eightfoldLocations.js'
import { getScraperCatalog } from '../providers/index.js'

const capture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/ericsson-country-token-20261116.json.gz', import.meta.url))))
const records = capture.packets.flatMap(packet => JSON.parse(packet.body).data.positions)
const mixed = records.find(record => record.id === 563121777494448)
const indiaLocations = ['Mumbai,Maharashtra,India', 'Kolkata,West Bengal,India',
  'New Delhi,Delhi,India', 'Bangalore,Karnataka,India']

test('the current Ericsson listing preserves all role countries with its untranslated Taiwan label', () => {
  assert.equal(records.length, 115)
  for (const record of records) {
    const scope = readEightfoldLocationScope(record)
    assert.equal(scope.unresolved, false, String(record.id))
    assert.deepEqual(scope.nativeLocations, record.locations)
    assert.deepEqual(scope.standardizedLocations, record.standardizedLocations)
  }
  const scope = readEightfoldLocationScope(mixed)
  assert.equal(scope.country, 'India')
  assert.deepEqual(scope.indiaLocations, indiaLocations)
  const taiwan = readEightfoldLocationScope({
    locations: ['Taipei,Taipei,:COMMON_COUNTRY_TWN:Taiwan'], standardizedLocations: ['Taipei City,TW'],
  })
  assert.equal(taiwan.country, 'TW')
  assert.deepEqual(taiwan.indiaLocations, [])
})

test('Ericsson native extraction retains the mixed role and its current detail after country normalization', async () => {
  const provider = structuredClone(getScraperCatalog().find(row => row.source === 'ericsson'))
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0 }
  const jobs = await runApiPortalScraper({ provider, fetchJson: async url => {
    if (new URL(url).pathname === '/api/pcsx/search') return { data: { positions: [mixed], count: 1 } }
    assert.equal(url, capture.detail.requestedUrl)
    return JSON.parse(capture.detail.body)
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 563121777494448)
  assert.equal(jobs[0].country, 'India')
  assert.deepEqual(jobs[0].locations, indiaLocations)
  assert.deepEqual(jobs[0].sourceNativeLocations, mixed.locations)
  assert.equal(jobs[0].jobDescription, JSON.parse(capture.detail.body).data.jobDescription)
  assert.ok(jobs[0].jobDescription.length > 100)
})

for (const [raw, standardized] of [
  ['Taipei,Taipei,:COMMON_COUNTRY_TWN:Taiwan', 'Taipei City,IN'],
  ['Taipei,Taipei,:COMMON_COUNTRY_TWN:Taiwan', 'Taipei,TS,IN'],
  ['Taipei,Taipei,:COMMON_COUNTRY_TWN:India', 'Taipei,TS,IN'],
  ['Taipei,Taipei,:COMMON_COUNTRY_IND:Taiwan', 'Taipei,TS,IN'],
  ['India - Taipei,Taipei,:COMMON_COUNTRY_TWN:Taiwan', 'Taipei City,TW'],
  [':COMMON_COUNTRY_IND:India,Taipei,:COMMON_COUNTRY_TWN:Taiwan', 'Taipei City,TW'],
]) test(`native translation markers cannot conceal conflicting countries: ${raw} / ${standardized}`, () => {
  assert.throws(() => readEightfoldLocationScope({ locations: [raw], standardizedLocations: [standardized] }),
    error => error.incompleteScope === true && /native location scope/.test(error.message))
})
