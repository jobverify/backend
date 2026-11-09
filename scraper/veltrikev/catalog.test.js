import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('VELTRIK.EV is registered against its verified first-party careers page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'veltrikev')

  assert.ok(provider, 'Expected VELTRIK.EV provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'VELTRIK.EV')
  assert.equal(provider.companyCareerPage, 'https://veltrik.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-inline-role-selector')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-careers-page+inline-role-selector+official-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'veltrik.com')
  assert.match(provider.modulePath, /veltrikev[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'VELTRIK.EV'), false)
})

test('VELTRIK.EV resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'VELTRIK.EV,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['VELTRIK.EV', 'veltrikev', 'VELTRIK.EV']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'veltrikev')

  assert.ok(scraper, 'Expected buildScrapers() to return the VELTRIK.EV scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'veltrikev')
  assert.equal(scraper.provider.companyCareerPage, 'https://veltrik.com/careers')
  assert.match(scraper.dryRunFile, /veltrikev[\\/]jobs\.json$/i)
})
