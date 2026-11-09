import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Utopus Insights registers its declared BambooHR JSON workflow with unresolved inventory authority', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'utopusinsights')

  assert.ok(provider, 'Expected Utopus Insights provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Utopus Insights')
  assert.equal(provider.companyCareerPage, 'https://www.utopusinsights.com/open-positions')
  assert.equal(provider.atsPlatform, 'bamboohr')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'first-party-openings-page-plus-bamboohr-embed-check')
  assert.equal(provider.extractionStrategy, 'current-first-party-HTML-or-Duda-page-model+declared-BambooHR-widget-client+declared-JSON-inventory-contract-unresolved')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'utopusinsights.com')
  assert.match(provider.modulePath, /utopusinsights[\\/]script\.js$/i)
})

test('Utopus Insights resolves the canonical and lowercase backlog rows through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Utopus Insights,\nUtopus insights,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Utopus Insights', 'utopusinsights', 'Utopus Insights'],
      ['Utopus insights', 'utopusinsights', 'Utopus Insights'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'utopusinsights')

  assert.ok(scraper, 'Expected buildScrapers() to return the Utopus Insights scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'utopusinsights')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.utopusinsights.com/open-positions')
  assert.match(scraper.dryRunFile, /utopusinsights[\\/]jobs\.json$/i)
})
