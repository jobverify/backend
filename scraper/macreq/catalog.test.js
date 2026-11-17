import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Macreq Manufacturing Services Private Ltd is registered as an exact-name apply-only zero-jobs provider without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'macreq')

  assert.ok(provider, 'Expected Macreq provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Macreq Manufacturing Services Private Ltd')
  assert.equal(provider.companyCareerPage, 'https://macreq.com/')
  assert.equal(provider.atsPlatform, 'official-current-root-http404-inventory-unavailable')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-configured-native-root-metadata-first-stop-on-http404')
  assert.equal(
    provider.extractionStrategy,
    'actual-configured-root-http404-preserved+employer-native-hiring-and-company-scope-unqualified+no-guessed-alternate-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'macreq.com')
  assert.match(provider.modulePath, /macreq[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Macreq Manufacturing Services Private Ltd'), false)
})

test('Macreq Manufacturing Services Private Ltd resolves from provider metadata and remains runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Macreq Manufacturing Services Private Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Macreq Manufacturing Services Private Ltd', 'macreq', 'Macreq Manufacturing Services Private Ltd']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'macreq')

  assert.ok(scraper, 'Expected buildScrapers() to return the Macreq scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'macreq')
  assert.equal(scraper.provider.companyCareerPage, 'https://macreq.com/')
  assert.match(scraper.dryRunFile, /macreq[\\/]jobs\.json$/i)
})
