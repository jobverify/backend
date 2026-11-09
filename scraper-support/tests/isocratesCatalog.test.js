import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('iSOCRATES is registered as a verified first-party Keka-backed script provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'isocrates')

  assert.ok(provider, 'Expected iSOCRATES provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'iSOCRATES')
  assert.equal(provider.companyCareerPage, 'https://isocrates.com/careers/')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(provider.extractionStrategy, 'official-homepage+official-careers-page+keka-embed-api+jobdetails+applyjob')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'isocrates.com')
  assert.match(provider.modulePath, /isocrates[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'iSOCRATES'), false)
})

test('iSOCRATES matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'iSOCRATES,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['iSOCRATES', 'isocrates', 'iSOCRATES']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'isocrates')

  assert.ok(scraper, 'Expected buildScrapers() to return the iSOCRATES scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'isocrates')
  assert.equal(scraper.provider.companyCareerPage, 'https://isocrates.com/careers/')
  assert.match(scraper.dryRunFile, /isocrates[\\/]jobs\.json$/i)
})
