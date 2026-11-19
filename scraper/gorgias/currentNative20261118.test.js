import assert from 'node:assert/strict'
import test from 'node:test'
import { run, CAREERS_URL } from './script.js'
import { fixture, transport } from '../../scraper-support/tests/corporateFeedFixture20261118.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const renderer = 'https://cdn.jsdelivr.net/gh/gorgias/gorgias-webflow@latest/src/js/careers/job-list.min.js'
const api = 'https://api.ashbyhq.com/posting-api/job-board/Gorgias?includeCompensation=false'
const entries = () => {
  const payload = JSON.parse(fixture('gorgias', 'gorgias-jobs')), row = payload.jobs[0]
  row.location = 'Bengaluru'
  row.address.postalAddress = { addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'India' }
  row.secondaryLocations = []
  return new Map([[CAREERS_URL, fixture('gorgias', 'gorgias')], ['https://gorgias.com/', fixture('gorgias', 'gorgias')],
    [renderer, fixture('gorgias', 'gorgias-job-list')], ['https://jobs.ashbyhq.com/Gorgias', fixture('gorgias', 'gorgias-board')],
    [api, { body: JSON.stringify(payload), json: true }]])
}

test('Gorgias follows its active employer-owned renderer declaration to the exact Ashby account', async () => {
  const jobs = await run({ fetchImpl: transport(entries()) })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].company, 'Gorgias')
  assert.equal(jobs.nativeCollectionEvidence.nativeBoards[0].nativeRecords.length, 11)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Gorgias renderer challenge cannot become a successful empty inventory', async () => {
  const pages = entries()
  pages.set(renderer, { status: 403, body: '<title>Just a moment...</title>' })
  await assert.rejects(run({ fetchImpl: transport(pages) }))
})
