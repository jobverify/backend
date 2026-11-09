import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { run, ASHBY_BOARD_TOKEN, ASHBY_JOBS_API_URL } from '../../scraper/snyk.workday/script.js'

const careersHtml = '<title>Careers | Snyk</title><link rel="canonical" href="https://snyk.io/careers/"/><p>Join us on our mission</p><a href="/careers/all-jobs/">Jobs</a>'
const boardUrl = `https://jobs.ashbyhq.com/${ASHBY_BOARD_TOKEN}`
const makeJob = (id, location, country) => ({
  id,
  title: 'Security Engineer',
  department: 'R&D',
  employmentType: 'FullTime',
  location,
  secondaryLocations: [],
  publishedAt: '2026-09-30T19:08:51.894+00:00',
  isListed: true,
  isRemote: false,
  workplaceType: 'OnSite',
  address: { postalAddress: { addressCountry: country } },
  jobUrl: `${boardUrl}/${id}`,
  applyUrl: `${boardUrl}/${id}/application`,
  descriptionPlain: 'Secure our platform.',
})
const usId = '507a3707-d6bd-48c4-800f-429ecf40769e'
const indiaId = '11111111-2222-4333-8444-555555555555'
const jobsPage = (ids) => `<title>Open jobs | Snyk</title><link rel="canonical" href="https://snyk.io/careers/all-jobs/"/><div id="all-jobs">Open security roles${ids.map((id) => `<a href="${boardUrl}/${id}">Apply</a>`).join('')}</div>`

const scrape = (ids, jobs) => run({
  fetchText: async (url) => url.endsWith('/all-jobs/') ? jobsPage(ids) : careersHtml,
  fetchJson: async (url) => {
    assert.equal(url, ASHBY_JOBS_API_URL)
    return { apiVersion: '1', jobs }
  },
})

test('Snyk uses the linked Ashby board and publishes only India roles', async () => {
  const jobs = await scrape([usId, indiaId], [
    makeJob(usId, 'United States - Boston Office', 'United States'),
    makeJob(indiaId, 'India - Bengaluru Office', 'India'),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].jobId, indiaId)
  assert.equal(jobs[0].sourceUrl, `${boardUrl}/${indiaId}`)
  assert.equal(jobs[0].applyUrl, `${boardUrl}/${indiaId}/application`)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
})

test('Snyk records a complete non-India inventory and rejects page/API mismatch', async () => {
  const jobs = await scrape([usId], [makeJob(usId, 'United States - Boston Office', 'United States')])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 0)
  await assert.rejects(
    scrape([usId, indiaId], [makeJob(usId, 'United States - Boston Office', 'United States')]),
    /Snyk Ashby inventory/i,
  )
})
