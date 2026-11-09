import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Myelin Foundry is registered as a verified first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'myelinfoundry')

  assert.ok(provider, 'Expected Myelin Foundry provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Myelin Foundry')
  assert.equal(provider.companyCareerPage, 'https://www.myelinfoundry.ai/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-onsite-apply-popups')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-job-cards+first-party-detail-doc-links+shared-onsite-apply-popups',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'myelinfoundry.ai')
  assert.match(provider.modulePath, /myelinfoundry[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Myelin Foundry'), false)
})

test('Myelin Foundry matches coverage directly and buildScrapers exposes the runnable scraper', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Myelin Foundry,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Myelin Foundry', 'myelinfoundry', 'Myelin Foundry']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'myelinfoundry')

  assert.ok(scraper, 'Expected buildScrapers() to return the Myelin Foundry scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'myelinfoundry')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.myelinfoundry.ai/careers/')
  assert.match(scraper.dryRunFile, /myelinfoundry[\\/]jobs\.json$/i)
})
