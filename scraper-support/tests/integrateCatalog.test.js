import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('Integrate is registered as an official careers scraper backed by the verified first-party Rippling embed', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'integrate')

  assert.ok(provider, 'Expected Integrate provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Integrate')
  assert.equal(provider.companyCareerPage, 'https://www.integrate.com/company/careers/')
  assert.equal(provider.atsPlatform, 'official-company-careers-rippling-embed')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-embedded-job-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+rippling-embed-next-data+india-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'integrate.com')
  assert.match(provider.modulePath, /integrate[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Integrate'), false)
})

test('Integrate matches the missing-company backlog directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Integrate,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Integrate', 'integrate', 'Integrate']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'integrate')

  assert.ok(scraper, 'Expected buildScrapers() to return the Integrate scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'integrate')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.integrate.com/company/careers/')
  assert.match(scraper.dryRunFile, /integrate[\\/]jobs\.json$/i)
})
