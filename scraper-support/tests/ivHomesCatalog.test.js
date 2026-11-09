import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Iv Homes is registered against the verified first-party homepage and hiring page without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'ivhomes')

  assert.ok(provider, 'Expected Iv Homes provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Iv Homes')
  assert.equal(provider.companyCareerPage, 'https://ivhomes.in/hiring/')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-hiring-page-plus-accordion-and-inline-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-homepage+verified-first-party-hiring-page+inline-job-openings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'ivhomes.in')
  assert.match(provider.modulePath, /ivhomes[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Iv Homes'), false)
})

test('Iv Homes matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Iv Homes,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Iv Homes', 'ivhomes', 'Iv Homes']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'ivhomes')

  assert.ok(scraper, 'Expected buildScrapers() to return the Iv Homes scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'ivhomes')
  assert.equal(scraper.provider.companyCareerPage, 'https://ivhomes.in/hiring/')
  assert.match(scraper.dryRunFile, /ivhomes[\\/]jobs\.json$/i)
})
