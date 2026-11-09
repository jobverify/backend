import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Safran Engineering Services India is registered against the verified accessible first-party careers search without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'safranengineeringservicesindia')

  assert.ok(provider, 'Expected Safran Engineering Services India provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Safran Engineering Services India')
  assert.match(provider.modulePath, /safranengineeringservicesindia[\\/]script\.js$/i)
  assert.equal(
    provider.companyCareerPage,
    'https://careers.safran-group.com/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Engineering%20Services&LCID=1033',
  )
  assert.equal(provider.companyDomain, 'careers.safran-group.com')
  assert.equal(provider.atsPlatform, 'official-keyword-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'accessible-first-party-keyword-search-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-accessible-keyword-search+verified-detail-pages+detail-country-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /careers\.safran-group\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /7 company-specific openings/i)
  assert.match(provider.verifiedSurfaceSummary, /6 Bangalore, India roles/i)
  assert.equal(
    Object.prototype.hasOwnProperty.call(companyAliases, 'Safran Engineering Services India'),
    false,
  )
})

test('Safran Engineering Services India matches company coverage directly and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Safran Engineering Services India,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[
      'Safran Engineering Services India',
      'safranengineeringservicesindia',
      'Safran Engineering Services India',
    ]],
  )

  const scraper = buildScrapers().find((item) => item.name === 'safranengineeringservicesindia')

  assert.ok(scraper, 'Expected buildScrapers() to return the Safran Engineering Services India scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'safranengineeringservicesindia')
  assert.equal(scraper.provider.adapter, 'script')
  assert.match(scraper.dryRunFile, /safranengineeringservicesindia[\\/]jobs\.json$/i)
})
