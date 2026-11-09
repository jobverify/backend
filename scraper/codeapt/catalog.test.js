import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

test('CodeApt is registered with the verified first-party careers page and exact CSV alias', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'codeapt')

  assert.ok(provider, 'Expected CodeApt provider to be registered in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'CodeApt')
  assert.equal(provider.companyCareerPage, 'https://www.codeapt.in/careers/')
  assert.equal(provider.atsPlatform, 'official-first-party-spa-auth-required-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-shell-plus-auth-check')
  assert.equal(provider.extractionStrategy, 'verified-vite-shell+verified-careers-api-auth-required-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'codeapt.in')
  assert.equal(provider.officialCareersApiUrl, 'https://api.codeapt.in/api/careers')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 7, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Authentication required/i)
  assert.match(provider.modulePath, /codeapt[\\/]script\.js$/i)
  assert.equal(companyAliases['Code apt'], 'codeapt')
})

test('Code apt matches company coverage through the explicit alias', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Code apt,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Code apt', 'codeapt', 'CodeApt']],
  )
})

test('CodeApt is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'codeapt')

  assert.ok(scraper, 'Expected buildScrapers() to return the CodeApt scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'codeapt')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.codeapt.in/careers/')
  assert.match(scraper.dryRunFile, /codeapt[\\/]jobs\.json$/i)
})
