import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import {
  CAREER_URL,
  COMPANY,
  createBluestoneScraper,
  hasOfficialCareerSignal,
} from './script.js'

const careerHtml = `
  <html>
    <head><title>Career | BlueStone.com</title></head>
    <body>
      <h1>Career@BlueStone</h1>
      <p>BlueStone is India's leading destination for high-quality fine jewellery.</p>
      <label>Position Applied For</label>
      <form><input name="fullName" /></form>
    </body>
  </html>
`

test('Bluestone is registered as an exact-name first-party no-public-listings sentinel', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'bluestone')

  assert.ok(provider)
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREER_URL)
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.companyDomain, 'bluestone.com')

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nBluestone\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0]?.source, 'bluestone')
})

test('Bluestone sentinel returns no jobs for the verified generic career intake page', async () => {
  assert.equal(hasOfficialCareerSignal(careerHtml), true)

  const requestedUrls = []
  const jobs = await createBluestoneScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: careerHtml }
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_URL])
  assert.deepEqual(jobs, [])
})

test('Bluestone sentinel fails closed when the page becomes a public jobs board', async () => {
  await assert.rejects(
    createBluestoneScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: careerHtml.replace('</form>', '<p>Current job openings</p></form>'),
      }),
    }),
    /public job listings/i,
  )
})

test('Bluestone is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'bluestone')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'bluestone')
  assert.match(scraper.dryRunFile, /bluestone[\\/]jobs\.json$/i)
})
