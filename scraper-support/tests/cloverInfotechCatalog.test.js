import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/cloverinfotech/provider.js')
  } catch {
    return null
  }
}

test('getScraperCatalog includes Clover Infotech as a verified first-party jobs scraper', async () => {
  const providerModule = await loadProviderModule()
  const sharedProvider = getScraperCatalog().find((item) => item.source === 'cloverinfotech')

  assert.ok(
    providerModule,
    'Expected Clover Infotech provider module at ../../scraper/cloverinfotech/provider.js',
  )
  assert.ok(sharedProvider)

  const provider = providerModule.provider

  assert.ok(provider, 'Expected Clover Infotech provider export')
  assert.equal(sharedProvider.source, 'cloverinfotech')
  assert.equal(sharedProvider.companyName, 'Clover Infotech')
  assert.equal(sharedProvider.adapter, 'script')
  assert.match(sharedProvider.modulePath, /cloverinfotech[\\/]script\.js$/i)
  assert.equal(sharedProvider.companyCareerPage, 'https://www.cloverinfotech.com/job-openings/')
  assert.equal(sharedProvider.atsPlatform, 'official-company-careers')
  assert.equal(sharedProvider.countryFilter, 'India')
  assert.equal(sharedProvider.paginationStrategy, 'official-job-openings-page-pagination')
  assert.equal(
    sharedProvider.extractionStrategy,
    'verified-cloudflare-challenge-empty+preserve-first-party-job-openings-and-detail-parser',
  )
  assert.equal(sharedProvider.parser, 'custom-script')
  assert.equal(sharedProvider.normalizationProfile, 'engineering-default')
  assert.equal(sharedProvider.companyDomain, 'cloverinfotech.com')
  assert.equal(sharedProvider.verifiedOn, '2026-08-14')
  assert.match(sharedProvider.verifiedSurfaceSummary, /Just a moment/i)
  assert.match(sharedProvider.verifiedSurfaceSummary, /Checking your browser/i)
  assert.match(sharedProvider.dryRunFile, /cloverinfotech[\\/]jobs\.json$/i)

  assert.equal(provider.source, sharedProvider.source)
  assert.equal(provider.companyName, sharedProvider.companyName)
  assert.equal(provider.adapter, sharedProvider.adapter)
  assert.match(provider.modulePath, /cloverinfotech[\\/]script\.js$/i)
  assert.equal(provider.companyCareerPage, sharedProvider.companyCareerPage)
  assert.equal(provider.atsPlatform, sharedProvider.atsPlatform)
  assert.equal(provider.countryFilter, sharedProvider.countryFilter)
  assert.equal(provider.paginationStrategy, sharedProvider.paginationStrategy)
  assert.equal(provider.extractionStrategy, sharedProvider.extractionStrategy)
  assert.equal(provider.parser, sharedProvider.parser)
  assert.equal(provider.normalizationProfile, sharedProvider.normalizationProfile)
  assert.equal(provider.companyDomain, sharedProvider.companyDomain)
})

test('buildScrapers and company coverage resolve Clover Infotech from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'cloverinfotech')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'cloverinfotech')
  assert.match(scraper.dryRunFile, /cloverinfotech[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Clover Infotech,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Clover Infotech', 'cloverinfotech', 'Clover Infotech']],
  )
})
