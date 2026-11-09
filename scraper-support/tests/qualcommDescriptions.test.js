import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runApiPortalScraper } from '../apiPortal/engine.js'
import { getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const read = name => JSON.parse(readFileSync(new URL(`../apiPortal/test-data/qualcomm-20261031-${name}.json`, import.meta.url)))
const capturedListing = read('listing'), capturedDetail = read('detail')
const provider = getScraperCatalog().find(item => item.source === 'qualcomm')

const replay = async (detail = capturedDetail, options = provider) => runApiPortalScraper({
  provider: options,
  fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname === '/api/pcsx/search') {
      // A one-role replay boundary; the employer role and its complete detail
      // packet remain unchanged from the public capture.
      return { ...capturedListing, data: { ...capturedListing.data, count: 1,
        positions: [capturedListing.data.positions[0]] } }
    }
    if (address.pathname === '/api/pcsx/position_details'
      && address.searchParams.get('position_id') === '446716674472') return detail
    throw new Error(`Unexpected native request: ${url}`)
  },
})

test('registered Qualcomm source retrieves the original native description', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 1)
  assert.equal(String(jobs[0].jobId), '446716674472')
  assert.equal(jobs[0].requisitionId, '3085888')
  assert.equal(jobs[0].jobDescription, capturedDetail.data.jobDescription)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('Qualcomm opening and closing pagination use the native Latest order', async () => {
  const requests = []
  await runApiPortalScraper({ provider, fetchJson: async url => {
    const address = new URL(url)
    if (address.pathname === '/api/pcsx/search') {
      requests.push(address)
      return { ...capturedListing, data: { ...capturedListing.data, count: 1,
        positions: [capturedListing.data.positions[0]] } }
    }
    return capturedDetail
  } })
  assert.equal(requests.length, 2)
  assert.deepEqual(requests.map(request => request.href), [requests[0].href, requests[0].href])
  assert.ok(requests.every(request => request.searchParams.get('sort_by') === 'timestamp'))
})

for (const [label, change] of [
  ['role identity', data => { data.id = 999999 }],
  ['malformed role identity', data => { data.id = { toString: 'invalid native value' } }],
  ['requisition identity', data => { data.displayJobId = 'different-requisition' }],
  ['native title', data => { data.name = 'Different native role' }],
  ['native workplace', data => { data.locations = ['San Diego, California, United States'] }],
  ['native posting URL', data => { data.positionUrl = 'https://unrelated.invalid/careers/job/446716674472' }],
]) {
  test(`Qualcomm refuses to attach a description with contradictory ${label}`, async () => {
    const detail = structuredClone(capturedDetail)
    change(detail.data)
    const enabled = { ...provider, config: { ...provider.config,
      detail: { ...provider.config.detail, enabled: true, requireListingIdentity: true } } }
    await assert.rejects(replay(detail, enabled), /detail identity mismatch/i)
  })
}
