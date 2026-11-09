import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('Yield Engineering Systems India P Ltd is registered as a LinkedIn guest-search scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'yieldengineeringsystemsindia')

  assert.ok(provider, 'Expected Yield Engineering Systems India P Ltd provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Yield Engineering Systems India P Ltd')
  assert.equal(
    provider.companyCareerPage,
    'https://www.linkedin.com/company/yield-engineering-systems/jobs?trk=nav_type_jobs',
  )
  assert.equal(provider.atsPlatform, 'linkedin-guest-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'linkedin-guest-api-start-offset')
  assert.equal(
    provider.extractionStrategy,
    'official-homepage-linkedin-handoff-plus-linkedin-guest-india-search-plus-linkedin-public-job-detail',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'yes.tech')
  assert.match(provider.modulePath, /yieldengineeringsystemsindia[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Yield Engineering Systems India P Ltd'), false)
})

test('Yield Engineering Systems India P Ltd resolves from provider metadata and stays runnable through the scraper catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Yield Engineering Systems India P Ltd,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Yield Engineering Systems India P Ltd',
      'yieldengineeringsystemsindia',
      'Yield Engineering Systems India P Ltd',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'yieldengineeringsystemsindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Yield Engineering Systems India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'yieldengineeringsystemsindia')
  assert.equal(
    scraper.provider.companyCareerPage,
    'https://www.linkedin.com/company/yield-engineering-systems/jobs?trk=nav_type_jobs',
  )
  assert.match(scraper.dryRunFile, /yieldengineeringsystemsindia[\\/]jobs\.json$/i)
})
