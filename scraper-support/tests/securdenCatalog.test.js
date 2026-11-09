import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Securden is registered as a first-party public careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'securden')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Securden')
  assert.equal(provider.companyCareerPage, 'https://www.securden.com/careers/')
  assert.equal(provider.officialSiteUrl, 'https://www.securden.com/')
  assert.equal(provider.companyDomain, 'securden.com')
  assert.equal(provider.atsPlatform, 'official-careers-page')
  assert.equal(provider.paginationStrategy, 'single-careers-page-with-detail-pages-plus-missing-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+job-cards+detail-pages+verified-missing-routes',
  )
  assert.equal(provider.verifiedPublicPostingCount, 10)
  assert.match(provider.modulePath, /securden[\\/]script\.js$/i)
})

test('Securden resolves through company coverage and remains runnable', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nSecurden\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'securden')

  const scraper = buildScrapers().find((item) => item.name === 'securden')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /securden[\\/]jobs\.json$/i)
})
