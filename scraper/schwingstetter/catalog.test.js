import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }

test('Schwing Stetter is registered against the verified official Stetter careers board', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'schwingstetter')

  assert.ok(provider, 'Expected Schwing Stetter provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Schwing Stetter')
  assert.equal(
    provider.companyCareerPage,
    'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-parent-careers-page-plus-stetter-board-details')
  assert.equal(provider.extractionStrategy, 'verified-official-careers-shell+verified-memmingen-role-details-filter-non-india')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'schwing-stetter.com')
  assert.match(provider.modulePath, /schwingstetter[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Schwing Stetter'), false)
})

test('Schwing Stetter matches directly from provider metadata without a new alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Schwing Stetter,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.matched.map((item) => [item.companyName, item.source]), [
    ['Schwing Stetter', 'schwingstetter'],
  ])
})

test('Schwing Stetter is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'schwingstetter')

  assert.ok(scraper, 'Expected buildScrapers() to return the Schwing Stetter scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'schwingstetter')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://schwing-stetter.com/de_de/unternehmen/ausbildung-karriere/stetter/stellenboerse.html',
  )
  assert.match(scraper.dryRunFile, /schwingstetter[\\/]jobs\.json$/i)
})
