import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('getScraperCatalog includes Ramco Systems Ltd. as an official careers-page scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ramcosystemsltd')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Ramco Systems Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.companyCareerPage, 'https://www.ramco.com/careers/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-public-embedded-jobs-page')
  assert.equal(provider.extractionStrategy, 'official-careers-handoff+same-domain-embedded-jobdata')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ramco.com')
  assert.match(provider.modulePath, /ramcosystemsltd[\\/]script\.js$/i)
})

test('buildScrapers and company coverage resolve the exact Ramco Systems Ltd. name without aliases', () => {
  const scraper = buildScrapers().find((item) => item.name === 'ramcosystemsltd')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /ramcosystemsltd[\\/]jobs\.json$/i)
  assert.equal(scraper.provider.source, 'ramcosystemsltd')

  const report = generateCompanyCoverageReport({
    csvText: 'row,company_name\n1,Ramco Systems Ltd.\n',
    catalog: getScraperCatalog(),
  })

  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.source ?? null]),
    [['Ramco Systems Ltd.', 'ramcosystemsltd', 'ramcosystemsltd']],
  )
  assert.equal(report.unmatchedCount, 0)
})
