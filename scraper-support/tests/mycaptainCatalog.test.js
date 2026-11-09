import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('MyCaptain is registered as a verified reachable-or-blocked first-party careers scraper without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'mycaptain')

  assert.ok(provider, 'Expected MyCaptain provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'MyCaptain')
  assert.equal(provider.companyCareerPage, 'https://mycaptain.in/career')
  assert.equal(provider.homepageUrl, 'https://mycaptain.in/')
  assert.deepEqual(provider.checkedBlockedRouteUrls, [
    'https://mycaptain.in/',
    'https://mycaptain.in/career',
    'https://mycaptain.in/careers',
    'https://mycaptain.in/job',
    'https://mycaptain.in/jobs',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-inline-job-cards-or-402-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-legacy-inline-job-cards-or-verified-402-deployment-paused-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'mycaptain.in')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Deployment Paused/i)
  assert.match(provider.verifiedSurfaceSummary, /Vercel/i)
  assert.match(provider.modulePath, /mycaptain[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Mycaptain'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'MyCaptain'), false)
})

test('MyCaptain matches coverage directly from the exact CSV row and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Mycaptain,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mycaptain', 'mycaptain', 'MyCaptain']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'mycaptain')

  assert.ok(scraper, 'Expected buildScrapers() to return the MyCaptain scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'mycaptain')
  assert.equal(scraper.provider.companyCareerPage, 'https://mycaptain.in/career')
  assert.equal(scraper.provider.atsPlatform, 'official-company-site-blocked-no-public-careers')
  assert.match(scraper.dryRunFile, /mycaptain[\\/]jobs\.json$/i)
})
