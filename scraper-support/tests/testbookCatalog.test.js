import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Testbook is registered in the provider catalog with the verified dead-handoff metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'testbook')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-careers-page-with-dead-external-handoffs')
  assert.equal(provider.companyName, 'Testbook')
  assert.equal(provider.companyCareerPage, 'https://testbook.com/careers')
  assert.equal(provider.officialSiteUrl, 'https://testbook.com/')
  assert.equal(provider.companyDomain, 'testbook.com')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-dead-external-board-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+dead-legacy-jobs-host+unverified-trakstar-board+return-empty',
  )
  assert.match(provider.modulePath, /testbook[\\/]script\.js$/i)
})

test('Testbook resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nTestbook\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'testbook')

  const scraper = buildScrapers().find((item) => item.name === 'testbook')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /testbook[\\/]jobs\.json$/i)
})
