import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog } from '../../scraper-support/providers/index.js'

const fetchPage = async () => ({ status: 200, url: 'https://gocardless.com/about/careers', html: '<a href="https://boards.greenhouse.io/gocardless">Search Jobs</a>' })
const role = { id: 101, title: 'Software Engineer', location: { name: 'Bengaluru, India' }, absolute_url: 'https://job-boards.greenhouse.io/gocardless/jobs/101', content: '<p>Develop payment systems and maintain reliable services.</p>', updated_at: '2026-10-23T00:00:00Z' }

test('GoCardless retains proven India jobs without certifying unresolved remote scope', async () => {
  const jobs = await run({ fetchPage, fetchJson: async url => {
    assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/gocardless/jobs?content=true')
    return { jobs: [role, { ...role, id: 102, absolute_url: role.absolute_url.replace('101', '102'), location: { name: 'Remote' } }, { ...role, id: 103, absolute_url: role.absolute_url.replace('101', '103'), location: { name: 'London, UK' } }], meta: { total: 3 } }
  } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'gocardless')
  assert.equal(jobs[0].company, 'GoCardless')
  assert.match(jobs[0].jobDescription, /Develop payment systems/)
  assert.equal(jobs[0].link, role.absolute_url)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
  assert.equal(jobs[0].sourceListingComplete, false)
})

test('GoCardless can reconcile a fully explicit native country inventory', async () => {
  const jobs = await run({ fetchPage, fetchJson: async () => ({ jobs: [role, { ...role, id: 103,
    absolute_url: role.absolute_url.replace('101', '103'), location: { name: 'London, UK' } }], meta: { total: 2 } }) })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('GoCardless never queries the ATS when the official link disappears', async () => {
  let requests = 0
  await assert.rejects(run({ fetchPage: async () => ({ status: 200, url: 'https://gocardless.com/about/careers', html: '<h1>Careers</h1>' }), fetchJson: async () => { requests++; return { jobs: [], meta: { total: 0 } } } }), /Current employer inventory binding unavailable: active board-handoff handoff not established/)
  assert.equal(requests, 0)
})

test('GoCardless preserves incomplete native inventory and missing descriptions as incomplete', async () => {
  await assert.rejects(run({ fetchPage, fetchJson: async () => ({ jobs: [role], meta: { total: 2 } }) }), /incomplete/i)
  const jobs = await run({ fetchPage, fetchJson: async () => ({ jobs: [{ ...role, content: '' }], meta: { total: 1 } }) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('the effective catalog advertises a runtime guard without inventing static verification', () => {
  const provider = getScraperCatalog().find(row => row.source === 'gocardless')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.bindingEvidence.verified, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
})
