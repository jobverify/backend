import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const officialProductHtml = `
  <html>
    <head><title>ReviewDale</title></head>
    <body>
      <h1>ReviewDale loves JavaScript</h1>
    </body>
  </html>
`

const publicJobsHtml = `
  <html>
    <head><title>ReviewDale Careers</title></head>
    <body><h1>Open positions</h1><a href="/jobs/engineer">Apply now</a></body>
  </html>
`

test('ReviewDale exact CSV company name resolves to its local provider extension', () => {
  const catalog = getScraperCatalog()
  const report = generateCompanyCoverageReport({
    csvText: 'ReviewDale\n',
    catalog,
    aliasMap: {},
  })
  const provider = catalog.find((item) => item.source === 'reviewdale')

  assert.equal(provider.companyName, 'ReviewDale')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyDomain, 'reviewdale.com')
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.equal(report.matched[0].source, 'reviewdale')
})

test('ReviewDale fails closed when the verified first-party surface changes into jobs', async () => {
  const scraperModule = await import('../../scraper/reviewdale/script.js')

  assert.equal(scraperModule.hasVerifiedOfficialSurface(officialProductHtml), true)
  assert.equal(scraperModule.hasVerifiedOfficialSurface(publicJobsHtml), false)
  assert.deepEqual(
    await scraperModule.createReviewDaleScraper().run({
      fetchText: async () => officialProductHtml,
    }),
    [],
  )

  await assert.rejects(
    scraperModule.createReviewDaleScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /surface changed materially/i,
  )
})
