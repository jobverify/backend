import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes HHV Advanced Technologies on the verified first-party careers page', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hhvadvancedtechnologies')

  assert.ok(provider, 'Expected HHV Advanced Technologies provider to be registered in customProviders.json')
  assert.equal(provider.companyName, 'HHV Advanced Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://hhvadvancedtech.com/careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'official-homepage-handoff+official-careers-accordion-openings+first-party-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hhvadvancedtech.com')
  assert.match(provider.modulePath, /hhvadvancedtechnologies[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact HHV Advanced Technologies name without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hhvadvancedtechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hhvadvancedtechnologies')
  assert.match(scraper.dryRunFile, /hhvadvancedtechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,HHV Advanced Technologies\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['HHV Advanced Technologies', 'hhvadvancedtechnologies', 'hhvadvancedtechnologies']],
  )
  assert.equal(report.unmatchedCount, 0)
})
