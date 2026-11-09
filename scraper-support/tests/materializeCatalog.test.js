import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

test('getScraperCatalog includes Materialize as a verified public Ashby apiPortal provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'materialize')

  assert.ok(provider)
  assert.equal(provider.adapter, 'apiPortal')
  assert.equal(provider.companyName, 'Materialize')
  assert.equal(provider.companyCareerPage, 'https://materialize.com/careers/')
  assert.equal(provider.companyDomain, 'materialize.com')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/materialize')
  assert.equal(
    provider.ashbyJobBoardUrl,
    'https://api.ashbyhq.com/posting-api/job-board/materialize',
  )
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+public-ashby-board+public-ashby-get-feed+india-location-filter',
  )
  assert.equal(provider.parser, 'api-portal')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.equal(
    provider.config.discovery.listingApiUrl,
    'https://api.ashbyhq.com/posting-api/job-board/materialize',
  )
  assert.deepEqual(provider.config.mapping.location, [
    'secondaryLocations.0.address.postalAddress.addressLocality',
    'secondaryLocations.0.location',
    'address.postalAddress.addressLocality',
    'address.postalAddress.addressCountry',
    'location',
  ])
  assert.deepEqual(provider.config.mapping.remoteStatus, [
    {
      path: 'isRemote',
      valueMap: {
        true: 'Remote',
        false: null,
      },
    },
    {
      path: 'workplaceType',
      valueMap: {
        Hybrid: 'Hybrid',
        Remote: 'Remote',
        OnSite: 'On-site',
        Onsite: 'On-site',
      },
    },
  ])
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/materialize\.com\/careers\/?/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.ashbyhq\.com\/materialize/i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /https:\/\/api\.ashbyhq\.com\/posting-api\/job-board\/materialize/i,
  )
  assert.match(
    provider.verifiedSurfaceSummary,
    /Senior \/ Staff Software Engineer \(Database\)/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /Field Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /zero India openings/i)
})

test('buildScrapers and company coverage resolve Materialize from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'materialize')
  const scraper = buildScrapers().find((item) => item.name === 'materialize')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.match(scraper.dryRunFile, /materialize[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nMaterialize\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Materialize', 'materialize', 'Materialize']],
  )
})
