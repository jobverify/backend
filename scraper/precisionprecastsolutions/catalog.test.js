import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Precision Precast Solutions is registered against its verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'precisionprecastsolutions')

  assert.ok(provider, 'Expected Precision Precast Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Precision Precast Solutions')
  assert.equal(provider.companyCareerPage, 'https://ppspl.com/career.php')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-plus-inline-accordion-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-public-careers-page+inline-accordion-role-cards+shared-first-party-resume-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ppspl.com')
  assert.match(provider.modulePath, /precisionprecastsolutions[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Precision Precast Solutions'), false)
})

test('Precision Precast Solutions resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Precision Precast Solutions,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Precision Precast Solutions', 'precisionprecastsolutions', 'Precision Precast Solutions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'precisionprecastsolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Precision Precast Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'precisionprecastsolutions')
  assert.equal(scraper.provider.companyCareerPage, 'https://ppspl.com/career.php')
  assert.match(scraper.dryRunFile, /precisionprecastsolutions[\\/]jobs\.json$/i)
})
