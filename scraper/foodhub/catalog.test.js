import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Foodhub is registered against its official public Zoho Recruit jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'foodhub')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Foodhub')
  assert.equal(provider.companyCareerPage, 'https://jobs.foodhubcareers.com/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.paginationStrategy, 'single-public-json-feed')
  assert.equal(provider.extractionStrategy, 'official-homepage+careers-handoff+zoho-public-jobs-api')
  assert.equal(provider.companyDomain, 'jobs.foodhubcareers.com')
  assert.match(provider.modulePath, /foodhub[\\/]script\.js$/i)
})

test('Foodhub is runnable through the provider catalog and resolves the CSV company name', () => {
  const scraper = buildScrapers().find((item) => item.name === 'foodhub')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'foodhub')
  assert.match(scraper.dryRunFile, /foodhub[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'FOODHUB,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FOODHUB', 'foodhub', 'Foodhub']],
  )
})
