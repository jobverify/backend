import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('SBD Automotive is registered as a non-listing official careers sentinel provider with the SBD India alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'sbdautomotive')

  assert.ok(provider, 'Expected SBD Automotive provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SBD Automotive')
  assert.equal(provider.companyCareerPage, 'https://www.sbdautomotive.com/careers-vacancies')
  assert.equal(provider.atsPlatform, 'official-company-careers-nonlisting')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-region-plus-careers-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-india-page+verified-careers-shell+single-bamboohr-cv-handoff-without-rendered-job-listings',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.companyDomain, 'sbdautomotive.com')
  assert.match(provider.modulePath, /sbdautomotive[\\/]script\.js$/i)
  assert.equal(companyAliases['SBD India'], 'sbdautomotive')
})

test('SBD Automotive resolves both the core company row and the SBD India alias through company coverage', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'SBD Automotive,\nSBD India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['SBD Automotive', 'sbdautomotive', 'SBD Automotive'],
      ['SBD India', 'sbdautomotive', 'SBD Automotive'],
    ],
  )

  const scraper = buildScrapers().find((item) => item.name === 'sbdautomotive')

  assert.ok(scraper, 'Expected buildScrapers() to return the SBD Automotive scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'sbdautomotive')
  assert.equal(scraper.provider.companyName, 'SBD Automotive')
  assert.match(scraper.dryRunFile, /sbdautomotive[\\/]jobs\.json$/i)
})
