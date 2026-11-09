import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lexmarkindia/catalog.js')
  } catch {
    assert.fail('Expected Lexmark India catalog module at ../../scraper/lexmarkindia/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/lexmarkindia/script.js')
  } catch {
    assert.fail('Expected Lexmark India scraper module at ../../scraper/lexmarkindia/script.js')
  }
}

test('Lexmark India local catalog captures the verified current Workday handoff and authoritative zero inventory', async () => {
  const { LEXMARK_INDIA_CATALOG } = await loadCatalogModule()
  const lexmarkIndia = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LEXMARK_INDIA_CATALOG)

  assert.equal(provider.source, 'lexmarkindia')
  assert.equal(provider.companyName, 'Lexmark India')
  assert.equal(provider.officialBrandName, 'Lexmark India')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://origin-www.lexmark.com/en_in/careers.html')
  assert.equal(provider.jobSearchUrl, 'https://origin-www.lexmark.com/en_in/careers/job-search.html')
  assert.equal(provider.officialJobsBoardUrl, 'https://lexmark.wd1.myworkdayjobs.com/Lexmark')
  assert.equal(provider.publicJobsApiUrl, 'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs')
  assert.equal(Object.hasOwn(provider, 'verifiedSampleJobUrl'), false)
  assert.equal(provider.companyDomain, 'lexmark.com')
  assert.equal(provider.atsPlatform, 'workday-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 0)
  assert.equal(
    provider.paginationStrategy,
    'workday-offset-limit-and-native-country-facets',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+verified-workday-tenant+unfiltered-zero-payload-or-native-workday-india-details',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.match(provider.verifiedSurfaceSummary, /official Lexmark India careers/i)
  assert.match(provider.verifiedSurfaceSummary, /unfiltered public jobs POST explicitly reports total 0/i)
  assert.match(provider.verifiedSurfaceSummary, /tenant lexmark and site Lexmark/i)
  assert.match(provider.modulePath, /lexmarkindia[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lexmarkindia[\\/]jobs\.json$/i)

  assert.equal(lexmarkIndia.PROVIDER_METADATA.source, provider.source)
  assert.equal(lexmarkIndia.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(lexmarkIndia.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
  assert.equal(lexmarkIndia.PROVIDER_METADATA.jobSearchUrl, provider.jobSearchUrl)
})

test('Lexmark India exact backlog row matches from the local provider contract without aliases', async () => {
  const { LEXMARK_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Lexmark India\n',
    catalog: [hydrateProviderCatalogEntry(LEXMARK_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Lexmark India', 'lexmarkindia', 'Lexmark India']],
  )
})
