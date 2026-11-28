import test from 'node:test'
import assert from 'node:assert/strict'
import { createPublishingGapAtsScraper } from '../utils/publishingGapAts.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const provider = { source: 'keepersecurity', companyName: 'Keeper Security', atsPlatform: 'greenhouse',
  boardToken: 'keepersecurity', companyCareerPage: 'https://www.keepersecurity.com/jobs.html' }
const row = { id: 4210568009, internal_job_id: 4123516009, title: 'Account Manager',
  absolute_url: 'https://job-boards.greenhouse.io/keepersecurity/jobs/4210568009',
  content: '<p>Build and support production services for customers.</p>',
  location: { name: 'Remote, US' }, metadata: [],
  offices: [{ id: 4018992009, name: 'Remote, US', location: null, child_ids: [], parent_id: 4018991009 }] }
const run = (entry, overrides = {}) => createPublishingGapAtsScraper(provider).run({ fetchJson: async () => ({
  jobs: [{ ...row, ...overrides, metadata: [entry] }], meta: { total: 1 },
}) })
const category = value => ({ id: 5302957009, name: 'Location Category', value_type: 'single_select', value })

test('typed Location Category retains and validates an explicit native country label', async () => {
  const jobs = await run(category('Remote, US'))
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  assert.equal(jobs.nativeCollectionEvidence.nativeRecords[0].metadata[0].value, 'Remote, US')
})

for (const value of ['Worldwide', 'Remote', 'Unreviewed place', 'Remote, US / Worldwide']) {
  test(`Location Category '${value}' cannot turn unknown scope into an authoritative zero`, async () => {
    const jobs = await run(category(value))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  })
}

test('a native India alternative in Location Category remains a selected India workplace', async () => {
  const jobs = await run(category('Bengaluru, India'))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('a contradictory single Location Category value is rejected', async () => {
  await assert.rejects(run(category('India / United States')), /contradictory country\/location/)
})

test('unknown metadata type stays unqualified and nested category content is never ignored', async () => {
  for (const entry of [{ ...category('Remote, US'), value_type: 'short_text' },
    { ...category('Remote, US'), value_type: undefined }, category({ country: 'India' })]) {
    let jobs
    try { jobs = await run(entry) } catch (error) { assert.match(error.message, /malformed native locations/); continue }
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})
