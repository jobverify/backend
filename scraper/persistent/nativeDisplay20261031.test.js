import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createPersistentScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/display-reconciliation-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const SEARCH = 'https://public.zwayam.com/jobs/search', DETAIL = 'https://public.zwayam.com/jobs-service/v1/jobs/careersite'
const template = JSON.parse(fixture.packets.find(packet => packet.url === SEARCH).body)
const replay = async (id, mutate = () => {}) => {
  const listing = structuredClone(fixture.samples.find(sample => sample.id === id).listing)
  const detail = JSON.parse(fixture.packets.find(packet => packet.url === DETAIL && JSON.parse(packet.requestBody).jobId === id).body)
  mutate(listing, detail)
  let requisitions = 0
  const jobs = await createPersistentScraper({ requestIntervalMs: 0,
    fetchTextImpl: async url => {
      const packet = fixture.packets.find(packet => packet.url === url)
      assert.ok(packet, 'Uncaptured native document: ' + url)
      return { text: packet.body, finalUrl: packet.finalURL }
    },
    fetchJsonImpl: async (url, options = {}) => {
      if (url === SEARCH) {
        const payload = structuredClone(template)
        Object.assign(payload.data, { data: [{ _source: listing }], totalCount: 1, hasMoreData: false })
        payload.data.facets.Location = [{ key: listing.text1, doc_count: 1 }]
        return payload
      }
      if (url === DETAIL) { assert.equal(JSON.parse(options.body).jobId, id); return detail }
      if (url.includes('/getReqFieldsForCareersSite/')) requisitions++
      const packet = fixture.packets.find(packet => packet.url === url)
      assert.ok(packet, 'Uncaptured native request: ' + url)
      return JSON.parse(packet.body)
    },
  }).run()
  return { jobs, requisitions }
}

for (const [id, label] of [[1115657, 'primary-city listing and full multi-office detail'], [1153968, 'case-varied city and full native location']]) {
  test('captured Persistent ' + label + ' retains every explicit same-role office', async () => {
    const { jobs, requisitions } = await replay(id)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].sourceDetailComplete, true)
    assert.equal(jobs[0].nativePostingId, String(id))
    assert.equal(jobs[0].country, 'India')
    assert.equal(requisitions, 1)
    assert.equal(jobs[0].sourceNativeInventory.closingStable, true)
  })
}

test('captured Persistent state-only US office label binds only the native empty-city office', async () => {
  const { jobs, requisitions } = await replay(1132482)
  assert.equal(jobs.length, 0)
  assert.equal(requisitions, 1)
  // This synthetic one-role foreign subset is never a company-empty claim.
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

for (const id of [1131939, 1127787]) test('actual stale Persistent display city remains rejected for ' + id, async () => {
  const { jobs, requisitions } = await replay(id)
  assert.equal(jobs.length, 0)
  assert.equal(requisitions, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

for (const [name, mutate] of [
  ['different canonical detail location', (_, detail) => { detail.location = 'Mumbai, Maharashtra, India' }],
  ['unbound displayed fragment', (_, detail) => { detail.locationDisplayForManageJobs += ' / Unbound office'; detail.jobConfigurationData.Location = detail.locationDisplayForManageJobs }],
  ['unbound listing fragment', listing => { listing.locationDisplayForManageJobs += ' / Unbound office' }],
  ['foreign displayed country', (_, detail) => { detail.locationDisplayForManageJobs = 'Pune, United States'; detail.jobConfigurationData.Location = detail.locationDisplayForManageJobs }],
  ['foreign native office country', listing => { listing.jobLocationRecord[0].country = 'United States' }],
  ['missing native office country', listing => { delete listing.jobLocationRecord[0].country }],
  ['different office job identity', listing => { listing.jobLocationRecord[0].jobId = 999 }],
  ['different office company identity', listing => { listing.jobLocationRecord[0].companyId = 999 }],
  ['different native role identity', (_, detail) => { detail.id = 999 }],
]) test('Persistent display reconciliation rejects ' + name, async () => {
  const { jobs } = await replay(1115657, mutate)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('a state name cannot replace an explicitly named native city', async () => {
  const { jobs } = await replay(1153968, (_, detail) => {
    detail.locationDisplayForManageJobs = 'Telangana'
    detail.jobConfigurationData.Location = 'Telangana'
  })
  assert.equal(jobs.length, 0)
})
