import test from 'node:test'
import assert from 'node:assert/strict'
import { createThreePillarGlobalScraper } from './script.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const careers = '<title>3Pillar Career Opportunities</title><a href="https://3pillar.darwinbox.com/ms/candidatev2/main/careers/allJobs">Open positions</a>'
const description = 'Build reliable software services and collaborate with the engineering team to design, test, and maintain public APIs.'
const rows = Array.from({ length: 108 }, (_, index) => ({
  id: `native-${index + 1}`, title: `Software Engineer ${index + 1}`,
  locations: index === 107 ? 'Bengaluru, India' : 'London, United Kingdom',
  country: index === 107 ? 'India' : 'United Kingdom', jd: description,
}))
const listing = async ({ page, pageSize }) => ({ data: rows.slice((page - 1) * pageSize, page * pageSize), job_counts: 108 })

test('3Pillar default collection includes native India openings beyond the inherited ten-page limit', async () => {
  const jobs = await createThreePillarGlobalScraper().run({ fetchText: async () => careers, fetchListingPage: listing })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'native-108')
  assert.equal(jobs[0].country, 'India')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 108)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 11)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('3Pillar caller pagination caps retain incomplete inventory', async () => {
  const jobs = await createThreePillarGlobalScraper().run({ maxPages: 10, fetchText: async () => careers, fetchListingPage: listing })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 108)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), false)
})
