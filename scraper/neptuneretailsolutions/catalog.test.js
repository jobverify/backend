import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Neptune Retail Solutions is registered as the Quotient Technology careers successor provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'neptuneretailsolutions')

  assert.ok(provider, 'Expected Neptune Retail Solutions provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Neptune Retail Solutions')
  assert.equal(provider.companyCareerPage, 'https://neptuneretailsolutions.com/about-us/')
  assert.equal(provider.atsPlatform, 'pinpointhq+bamboohr')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'public-rss-feed')
  assert.equal(provider.extractionStrategy, 'legacy-quotient-homepage-redirect+official-about-page+pinpoint-rss-feed')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'neptuneretailsolutions.com')
  assert.match(provider.modulePath, /neptuneretailsolutions[\\/]script\.js$/i)
  assert.equal(companyAliases['Quotient Technology'], 'neptuneretailsolutions')
})

test('Neptune Retail Solutions resolves Quotient Technology through company coverage and remains runnable in the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Quotient Technology,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Quotient Technology', 'neptuneretailsolutions', 'Neptune Retail Solutions']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'neptuneretailsolutions')

  assert.ok(scraper, 'Expected buildScrapers() to return the Neptune Retail Solutions scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'neptuneretailsolutions')
  assert.equal(scraper.provider.companyName, 'Neptune Retail Solutions')
  assert.match(scraper.dryRunFile, /neptuneretailsolutions[\\/]jobs\.json$/i)
})
