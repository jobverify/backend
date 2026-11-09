import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Datum Advanced Composites is registered as a verified unresolved first-party host sentinel without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'datumadvancedcomposites')

  assert.ok(provider, 'Expected Datum Advanced Composites provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Datum Advanced Composites')
  assert.equal(provider.companyCareerPage, 'https://datumadvancedcomposites.com/')
  assert.equal(provider.atsPlatform, 'official-company-site-unresolved')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'dns-resolution-check')
  assert.equal(
    provider.extractionStrategy,
    'verified-canonical-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'datumadvancedcomposites.com')
  assert.match(provider.modulePath, /datumadvancedcomposites[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Datum Advanced Composites'), false)
})

test('Datum Advanced Composites matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Datum Advanced Composites,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Datum Advanced Composites', 'datumadvancedcomposites', 'Datum Advanced Composites']],
  )
})

test('Datum Advanced Composites is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datumadvancedcomposites')

  assert.ok(scraper, 'Expected buildScrapers() to return the Datum Advanced Composites scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'datumadvancedcomposites')
  assert.equal(scraper.provider.companyCareerPage, 'https://datumadvancedcomposites.com/')
  assert.match(scraper.dryRunFile, /datumadvancedcomposites[\\/]jobs\.json$/i)
})
