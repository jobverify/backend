import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Volvo-Ericsson is registered as a verified distinct-career-surfaces sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'volvoericsson')

  assert.ok(provider, 'Expected Volvo-Ericsson provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Volvo-Ericsson')
  assert.equal(provider.companyCareerPage, 'https://www.volvogroup.com/en/careers.html')
  assert.deepEqual(provider.alternateCareerPages, ['https://jobs.ericsson.com/careers'])
  assert.equal(provider.atsPlatform, 'official-company-sites-no-standalone-volvo-ericsson-surface')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-distinct-official-career-surfaces')
  assert.equal(
    provider.extractionStrategy,
    'volvo-careers-handoff-plus-ericsson-careers-portal-verified-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'volvogroup.com')
  assert.match(provider.modulePath, /volvoericsson[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Volvo-Ericsson'), false)
})

test('Volvo-Ericsson resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Volvo-Ericsson,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Volvo-Ericsson', 'volvoericsson', 'Volvo-Ericsson']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'volvoericsson')

  assert.ok(scraper, 'Expected buildScrapers() to return the Volvo-Ericsson sentinel scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'volvoericsson')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.volvogroup.com/en/careers.html')
  assert.match(scraper.dryRunFile, /volvoericsson[\\/]jobs\.json$/i)
})
