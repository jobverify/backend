import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Saint-Gobain is registered against the official India careers page and login-only jobs portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'saintgobain')

  assert.ok(provider, 'Expected Saint-Gobain provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Saint-Gobain')
  assert.equal(provider.companyCareerPage, 'https://in.saint-gobain-glass.com/careers')
  assert.equal(provider.atsPlatform, 'official-company-careers-login-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-india-careers-page-plus-login-only-portal')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-india-careers-page+verified-view-jobs-handoff+verified-login-only-portal-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'in.saint-gobain-glass.com')
  assert.match(provider.modulePath, /saintgobain[\\/]script\.js$/i)
})

test('Saint-Gobain aliases cover the CSV row variants tied directly to this company', () => {
  assert.equal(companyAliases['Saint Gobain- Gyproc'], 'saintgobain')
  assert.equal(companyAliases['Saint-Gobain India Pvt. Ltd – SEFPRO India'], 'saintgobain')
})

test('Saint-Gobain coverage matches the exact CSV variants for this company', () => {
  const report = generateCompanyCoverageReport({
    csvText: [
      'Saint Gobain- Gyproc,',
      'Saint-Gobain,',
      'Saint-Gobain India Pvt. Ltd – SEFPRO India,',
    ].join('\n'),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 3)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Saint Gobain- Gyproc', 'saintgobain'],
    ['Saint-Gobain', 'saintgobain'],
    ['Saint-Gobain India Pvt. Ltd – SEFPRO India', 'saintgobain'],
  ])
})

test('Saint-Gobain is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'saintgobain')

  assert.ok(scraper, 'Expected buildScrapers() to return the Saint-Gobain scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'saintgobain')
  assert.equal(scraper.provider.companyCareerPage, 'https://in.saint-gobain-glass.com/careers')
  assert.match(scraper.dryRunFile, /saintgobain[\\/]jobs\.json$/i)
})
