import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('upGrad is registered in the provider catalog with the verified Darwinbox metadata', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'upgrad')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.companyName, 'upGrad')
  assert.equal(provider.companyCareerPage, 'https://www.upgrad.com/careers/')
  assert.equal(provider.officialSiteUrl, 'https://www.upgrad.com/')
  assert.equal(provider.darwinboxOrigin, 'https://upgrad.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(
    provider.publicAllJobsUrl,
    'https://upgrad.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(provider.companyDomain, 'upgrad.com')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-darwinbox-handoff+darwinbox-listing-api+india-location-filter',
  )
  assert.match(provider.modulePath, /upgrad[\\/]script\.js$/i)
})

test('upGrad resolves through company coverage and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nupGrad\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.matched[0]?.source, 'upgrad')

  const scraper = buildScrapers().find((item) => item.name === 'upgrad')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /upgrad[\\/]jobs\.json$/i)
})
