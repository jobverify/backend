import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Multicoreware is registered against its official public Zoho Recruit jobs board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'multicoreware')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MulticoreWare')
  assert.equal(provider.companyCareerPage, 'https://multicorewareinc.zohorecruit.in/jobs/Careers')
  assert.equal(provider.atsPlatform, 'zohorecruit')
  assert.equal(provider.paginationStrategy, 'single-public-json-feed')
  assert.equal(provider.extractionStrategy, 'official-homepage+careers-handoff+zoho-public-jobs-api')
  assert.equal(provider.companyDomain, 'multicorewareinc.zohorecruit.in')
  assert.match(provider.modulePath, /multicoreware[\\/]script\.js$/i)
})

test('Multicoreware is runnable through the provider catalog and resolves the CSV company name', () => {
  const scraper = buildScrapers().find((item) => item.name === 'multicoreware')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'multicoreware')
  assert.match(scraper.dryRunFile, /multicoreware[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Multicoreware,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Multicoreware', 'multicoreware', 'MulticoreWare']],
  )
})
