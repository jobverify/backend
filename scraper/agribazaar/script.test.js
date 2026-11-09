import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import {
  COMPANY,
  JOB_OPENINGS_URL,
  OPPORTUNITIES_URL,
  createAgribazaarScraper,
  hasOfficialOpportunitiesSignal,
  hasUnstructuredCurrentOpeningsSignal,
  isVerifiedMissingJobOpeningsPage,
} from './script.js'

const opportunitiesFixture = `
  <html><head><title>Agribazaar</title></head><body>
    <h2>Opportunities</h2>
    <p>Let’s transform the agri-commodity marketplace. Together.</p>
    <p>Click here and upload your resume in relevant profile and we will get in touch with you.</p>
    <a href="mailto:hr@agribazaar.com">hr@agribazaar.com</a>
  </body></html>
`

const openingsFixture = `
  <html><body><h2>Current Openings</h2><p>Agribazaar</p><img src="opening-1.jpg"></body></html>
`

test('Agribazaar is registered with exact company matching and official URLs', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'agribazaar')

  assert.ok(provider)
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.companyCareerPage, OPPORTUNITIES_URL)
  assert.equal(provider.companyDomain, 'agribazaar.com')
  assert.match(provider.modulePath, /agribazaar[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'agribazaar')
  assert.ok(scraper)
  assert.match(scraper.dryRunFile, /agribazaar[\\/]jobs\.json$/i)
})

test('Agribazaar matches the CSV company name exactly', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Agribazaar\nAgribazaar India\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 1)
  assert.equal(report.matched[0].source, 'agribazaar')
  assert.equal(report.unmatched[0].companyName, 'Agribazaar India')
})

test('Agribazaar recognizes the verified unstructured official surface', async () => {
  assert.equal(hasOfficialOpportunitiesSignal(opportunitiesFixture), true)
  assert.equal(hasUnstructuredCurrentOpeningsSignal(openingsFixture), true)

  const scraper = createAgribazaarScraper()
  const fetchedUrls = []
  const jobs = await scraper.run({
    fetchText: async (url) => {
      fetchedUrls.push(url)
      return url === OPPORTUNITIES_URL ? opportunitiesFixture : openingsFixture
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(fetchedUrls, [OPPORTUNITIES_URL, JOB_OPENINGS_URL])
})

test('Agribazaar fails closed when structured listings appear', async () => {
  await assert.rejects(
    createAgribazaarScraper().run({
      fetchText: async (url) => url === OPPORTUNITIES_URL
        ? opportunitiesFixture
        : '<h2>Current Openings</h2><a href="/jobs/software-engineer">Apply now</a>',
    }),
    /structured coverage is required/,
  )
})

test('Agribazaar accepts the verified first-party job-openings 404 as empty', async () => {
  assert.equal(isVerifiedMissingJobOpeningsPage({ status: 404, url: JOB_OPENINGS_URL }), true)

  const jobs = await createAgribazaarScraper().run({
    fetchText: async (url) => url === OPPORTUNITIES_URL
      ? opportunitiesFixture
      : { status: 404, url: JOB_OPENINGS_URL, html: 'Not Found' },
  })

  assert.deepEqual(jobs, [])
})
