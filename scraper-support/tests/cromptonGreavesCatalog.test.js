import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/cromptongreaves/provider.js')
  } catch {
    return null
  }
}

test('getScraperCatalog includes Crompton Greaves as a verified first-party careers scraper', async () => {
  const providerModule = await loadProviderModule()
  const sharedProvider = getScraperCatalog().find((item) => item.source === 'cromptongreaves')

  assert.ok(
    providerModule,
    'Expected Crompton Greaves provider module at ../../scraper/cromptongreaves/provider.js',
  )
  assert.ok(sharedProvider)

  const provider = providerModule.provider

  assert.ok(provider, 'Expected Crompton Greaves provider export')
  assert.equal(sharedProvider.source, 'cromptongreaves')
  assert.equal(sharedProvider.companyName, 'Crompton Greaves Consumer Electricals Limited')
  assert.equal(sharedProvider.adapter, 'script')
  assert.match(sharedProvider.modulePath, /cromptongreaves[\\/]script\.js$/i)
  assert.equal(sharedProvider.companyCareerPage, 'https://www.crompton.co.in/pages/careers')
  assert.equal(sharedProvider.atsPlatform, 'shopify-careers-page')
  assert.equal(sharedProvider.countryFilter, 'India')
  assert.equal(sharedProvider.paginationStrategy, 'single-public-page')
  assert.equal(
    sharedProvider.extractionStrategy,
    'verified-first-party-careers-page+html-current-openings-list+mailto-apply-links',
  )
  assert.equal(sharedProvider.parser, 'custom-script')
  assert.equal(sharedProvider.normalizationProfile, 'engineering-default')
  assert.equal(sharedProvider.companyDomain, 'crompton.co.in')
  assert.equal(sharedProvider.verifiedOn, '2026-07-14')
  assert.match(sharedProvider.verifiedSurfaceSummary, /current openings/i)
  assert.match(sharedProvider.verifiedSurfaceSummary, /recruitment@crompton\.co\.in/i)
  assert.match(sharedProvider.dryRunFile, /cromptongreaves[\\/]jobs\.json$/i)

  assert.deepEqual(provider, {
    ...provider,
    source: sharedProvider.source,
    companyName: sharedProvider.companyName,
    adapter: sharedProvider.adapter,
    modulePath: provider.modulePath,
    companyCareerPage: sharedProvider.companyCareerPage,
    atsPlatform: sharedProvider.atsPlatform,
    countryFilter: sharedProvider.countryFilter,
    paginationStrategy: sharedProvider.paginationStrategy,
    extractionStrategy: sharedProvider.extractionStrategy,
    parser: sharedProvider.parser,
    normalizationProfile: sharedProvider.normalizationProfile,
    companyDomain: sharedProvider.companyDomain,
    verifiedOn: sharedProvider.verifiedOn,
    verifiedSurfaceSummary: sharedProvider.verifiedSurfaceSummary,
  })
})

test('buildScrapers and company coverage resolve Crompton Greaves from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cromptongreaves')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cromptongreaves')
  assert.match(scraper.dryRunFile, /cromptongreaves[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Crompton Greaves,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Crompton Greaves', 'cromptongreaves', 'Crompton Greaves Consumer Electricals Limited']],
  )
})
