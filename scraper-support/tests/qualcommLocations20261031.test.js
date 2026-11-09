import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const capture = JSON.parse(fs.readFileSync(new URL('../apiPortal/test-data/qualcomm-20261031-multilocation.json', import.meta.url)))
const provider = structuredClone(getScraperCatalog().find(row => row.source === 'qualcomm'))
provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 0 }
// Only the collection boundary is reduced. Each role's native listing/detail
// fields remain unchanged from the successful 558-record October 31 capture.
const replay = async (change = () => {}) => {
  const rows = structuredClone(capture)
  change(rows)
  return runApiPortalScraper({ provider, fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname === '/api/pcsx/search') return { data: { count: rows.length, positions: rows.map(row => row.record) } }
    const row = rows.find(row => String(row.record.id) === address.searchParams.get('position_id'))
    assert.ok(row, 'only a currently listed native identity can be fetched')
    return row.detail
  } })
}

test('Qualcomm retains India alternatives after foreign primary locations and all explicit India worksites', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 3)
  const byId = new Map(jobs.map(job => [String(job.jobId), job]))
  assert.equal(byId.get('446719156242').location, 'Bangalore, India')
  assert.equal(byId.get('446720845273').location, 'Hyderabad')
  assert.deepEqual(byId.get('446721419465').locations, ['Chennai, Tamil Nādu, India', 'Bangalore, India'])
  for (const row of capture) {
    const job = byId.get(String(row.record.id))
    assert.equal(job.country, 'India')
    assert.deepEqual(job.sourceNativeLocations, row.record.locations)
    assert.deepEqual(job.sourceStandardizedLocations, row.record.standardizedLocations)
    assert.equal(job.jobDescription, row.detail.data.jobDescription)
  }
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a bare secondary city without role-owned native country proof leaves the India inventory unconfirmed', async () => {
  const jobs = await replay(rows => {
    const row = rows.find(row => String(row.record.id) === '446720845273')
    delete row.record.standardizedLocations
    delete row.detail.data.standardizedLocations
  })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
})

for (const [label, change] of [
  ['contradictory explicit country', rows => {
    const row = rows.find(row => String(row.record.id) === '446719156242')
    row.record.standardizedLocations[1] = 'Bengaluru, KA, US'
    row.detail.data.standardizedLocations = [...row.record.standardizedLocations]
  }],
  ['misaligned native city', rows => {
    const row = rows.find(row => String(row.record.id) === '446720845273')
    row.record.standardizedLocations[1] = 'Mumbai, MH, IN'
    row.detail.data.standardizedLocations = [...row.record.standardizedLocations]
  }],
  ['unequal location arrays', rows => {
    rows[0].record.standardizedLocations.pop()
    rows[0].detail.data.standardizedLocations = [...rows[0].record.standardizedLocations]
  }],
  ['unknown standardized country', rows => {
    rows[0].record.standardizedLocations[0] = 'Santa Clara, CA, ZZ'
    rows[0].detail.data.standardizedLocations = [...rows[0].record.standardizedLocations]
  }],
  ['an untyped different native region', rows => {
    const row = rows.find(row => String(row.record.id) === '446720845273')
    row.record.locations[1] = 'Hyderabad, Sindh'
    row.detail.data.locations = [...row.record.locations]
  }],
  ['a broad location merely containing a city name', rows => {
    const row = rows.find(row => String(row.record.id) === '446720845273')
    row.record.locations[1] = 'Hyderabad / Remote worldwide'
    row.detail.data.locations = [...row.record.locations]
  }],
]) test(`Qualcomm refuses ${label} instead of assigning an India country`, async () => {
  await assert.rejects(replay(change), /native location|geograph|country|locations/i)
})

test('detail country evidence must remain bound to the current native listing', async () => {
  await assert.rejects(replay(rows => {
    const row = rows.find(row => String(row.record.id) === '446720845273')
    row.detail.data.standardizedLocations[1] = 'Hyderabad, SD, PK'
  }), /detail identity mismatch/i)
})
