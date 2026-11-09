import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Upstox is registered in the provider catalog with the verified first-party card metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'upstox')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-first-party-job-cards')
  assert.equal(provider.companyName, 'Upstox')
  assert.equal(provider.companyCareerPage, 'https://upstox.com/careers/')
  assert.equal(provider.officialSiteUrl, 'https://upstox.com/')
  assert.equal(provider.companyDomain, 'upstox.com')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-inline-listing')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+server-rendered-job-cards+same-page-application-surface',
  )
  assert.equal(provider.verifiedPublicPostingCount, 9)
  assert.match(provider.modulePath, /upstox[\\/]script\.js$/i)
})

test('Upstox resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nUpstox\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'upstox')

  const scraper = buildScrapers().find((item) => item.name === 'upstox')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /upstox[\\/]jobs\.json$/i)
})
