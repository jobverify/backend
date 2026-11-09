import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

test('Hybec is registered as a verified placeholder-or-timeout zero-job first-party sentinel without alias churn', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hybec')

  assert.ok(provider, 'Expected Hybec provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Hybec')
  assert.equal(provider.companyCareerPage, 'https://hybec.co.in/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-homepage-placeholder-or-timeout-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-homepage-placeholder-shell-or-timeout-without-public-job-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hybec.co.in')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.officialCareersPageUrl, 'https://hybec.co.in/')
  assert.match(provider.verifiedSurfaceSummary, /hybec\.co\.in/i)
  assert.match(provider.verifiedSurfaceSummary, /connect-timeout errors/i)
  assert.match(provider.verifiedSurfaceSummary, /returns no jobs until hybec exposes a stable public careers surface/i)
  assert.match(provider.modulePath, /hybec[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hybec'), false)
})

test('Hybec matches backlog coverage directly from provider metadata and is runnable via buildScrapers', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Hybec,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hybec', 'hybec', 'Hybec']],
  )

  const scraper = buildScrapers().find((item) => item.name === 'hybec')

  assert.ok(scraper, 'Expected buildScrapers() to return the Hybec scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hybec')
  assert.equal(scraper.provider.companyCareerPage, 'https://hybec.co.in/')
  assert.match(scraper.dryRunFile, /hybec[\\/]jobs\.json$/i)
})
