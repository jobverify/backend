import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const COMPANY_CSV_TEXT = "company_name\nGraphcore\n"
const JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/graphcore/jobs?content=true'
const graphcoreJob = (id, location) => ({
  id,
  title: 'Software Engineer',
  location: { name: location },
  absolute_url: `https://job-boards.greenhouse.io/graphcore/jobs/${id}`,
  content: '<p>Build and maintain Graphcore software.</p>',
})

const getGraphcoreScraper = (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('Graphcore tests must use controlled transport'))
  const scraper = buildScrapers().find((item) => item.name === 'graphcore')
  assert.ok(scraper, 'Expected Graphcore scraper to be built from its provider extension')
  return scraper
}

test('Graphcore is covered only by its exact-name native Greenhouse provider', () => {
  const catalog = getScraperCatalog()
  const provider = catalog.find((item) => item.source === 'graphcore')
  const report = generateCompanyCoverageReport({
    csvText: COMPANY_CSV_TEXT,
    catalog,
  })
  const nearNameReport = generateCompanyCoverageReport({
    csvText: 'company_name\nGraph Core\nGraphcore AI\n',
    catalog,
  })

  assert.ok(provider, 'Expected Graphcore provider extension in the scraper catalog')
  assert.equal(provider.companyName, 'Graphcore')
  assert.equal(provider.companyDomain, 'graphcore.ai')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.boardToken, 'graphcore')
  assert.equal(provider.companyCareerPage, 'https://www.graphcore.ai/jobs')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.match(provider.modulePath, /graphcore[\\/]publishing-gap-script\.js$/)
  assert.deepEqual(
    report.matched.filter((item) => item.companyName === 'Graphcore').map((item) => item.source),
    ['graphcore'],
  )
  assert.equal(nearNameReport.matchedCount, 0)
  assert.equal(nearNameReport.unmatchedCount, 2)
})

test('Graphcore registered scraper maps native India jobs and excludes foreign jobs', async (t) => {
  const scraper = getGraphcoreScraper(t)
  const requests = []
  const jobs = await scraper.run({ fetchJson: async (url) => {
    requests.push(url)
    return { jobs: [graphcoreJob(1, 'Bangalore, India'), graphcoreJob(2, 'Boston, United States')], meta: { total: 2 } }
  } })

  assert.deepEqual(requests, [JOBS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'graphcore')
  assert.equal(jobs[0].company, 'Graphcore')
  assert.equal(jobs[0].companyDomain, 'graphcore.ai')
  assert.equal(jobs[0].atsPlatform, 'greenhouse')
  assert.equal(jobs[0].applyUrl, 'https://job-boards.greenhouse.io/graphcore/jobs/1')
  assert.equal(jobs[0].sourceDescription, graphcoreJob(1).content)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
})

test('Graphcore empty inventory requires a fresh complete native response', async (t) => {
  const scraper = getGraphcoreScraper(t)
  const jobs = await scraper.run({ fetchJson: async (url) => {
    assert.equal(url, JOBS_API_URL)
    return { jobs: [], meta: { total: 0 } }
  } })

  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})

test('Graphcore upstream failures cannot become an empty inventory', async (t) => {
  const scraper = getGraphcoreScraper(t)
  await assert.rejects(scraper.run({ fetchJson: async () => { throw new Error('HTTP 503') } }), /HTTP 503/)
  await assert.rejects(scraper.run({ fetchJson: async () => ({ jobs: [], meta: { total: 1 } }) }), /Incomplete greenhouse inventory/)
})
