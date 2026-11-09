import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('PixDynamics is registered against its verified first-party career page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pixdynamics')

  assert.ok(provider, 'Expected PixDynamics provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PixDynamics')
  assert.equal(provider.companyCareerPage, 'https://pixdynamics.com/career')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-first-party-career-page-plus-visible-inline-job-cards',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-career-page+visible-inline-job-cards+mailto-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'pixdynamics.com')
  assert.match(provider.modulePath, /pixdynamics[\\/]script\.js$/i)
})

test('PixDynamics matches company coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'PixDynamics,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PixDynamics', 'pixdynamics', 'PixDynamics']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'pixdynamics')

  assert.ok(scraper, 'Expected buildScrapers() to return the PixDynamics scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pixdynamics')
  assert.equal(scraper.provider.companyCareerPage, 'https://pixdynamics.com/career')
  assert.match(scraper.dryRunFile, /pixdynamics[\\/]jobs\.json$/i)
})
