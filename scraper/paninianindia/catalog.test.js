import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Paninian India is registered as a verified first-party open positions scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'paninianindia')

  assert.ok(provider, 'Expected Paninian India provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Paninian India')
  assert.equal(provider.companyCareerPage, 'https://www.svayatt.co.in/blank-24')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'homepage-plus-careers-handoff-plus-open-positions-page-plus-domain-alias-and-missing-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-paninian-domain-redirects+verified-careers-handoff+verified-open-positions-rich-text-grid+shared-apply-email+verified-missing-canonical-careers-routes',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'svayatt.co.in')
  assert.match(provider.modulePath, /paninianindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Paninian India'), false)
})

test('Paninian India matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Paninian India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Paninian India', 'paninianindia', 'Paninian India']],
  )
})

test('Paninian India is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'paninianindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Paninian India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'paninianindia')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.svayatt.co.in/blank-24')
  assert.match(scraper.dryRunFile, /paninianindia[\\/]jobs\.json$/i)
})
