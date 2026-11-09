import assert from 'node:assert/strict'
import test from 'node:test'

test('SentinelOne catalog describes the verified first-party Greenhouse contract', async () => {
  const { SENTINELONE_CATALOG, default: defaultCatalog } = await import('./catalog.js')

  assert.equal(defaultCatalog, SENTINELONE_CATALOG)
  assert.deepEqual(
    {
      source: SENTINELONE_CATALOG.source,
      companyName: SENTINELONE_CATALOG.companyName,
      officialBrandName: SENTINELONE_CATALOG.officialBrandName,
      adapter: SENTINELONE_CATALOG.adapter,
      modulePath: SENTINELONE_CATALOG.modulePath,
      companyCareerPage: SENTINELONE_CATALOG.companyCareerPage,
      companyDomain: SENTINELONE_CATALOG.companyDomain,
      atsPlatform: SENTINELONE_CATALOG.atsPlatform,
      countryFilter: SENTINELONE_CATALOG.countryFilter,
      paginationStrategy: SENTINELONE_CATALOG.paginationStrategy,
      parser: SENTINELONE_CATALOG.parser,
      normalizationProfile: SENTINELONE_CATALOG.normalizationProfile,
      verifiedOn: SENTINELONE_CATALOG.verifiedOn,
      dryRunFile: SENTINELONE_CATALOG.dryRunFile,
    },
    {
      source: 'sentinelone',
      companyName: 'SentinelOne',
      officialBrandName: 'SentinelOne',
      adapter: 'script',
      modulePath: '../../scraper/sentinelone/script.js',
      companyCareerPage: 'https://www.sentinelone.com/careers/',
      companyDomain: 'sentinelone.com',
      atsPlatform: 'greenhouse',
      countryFilter: 'India',
      paginationStrategy: 'single-greenhouse-jobs-api-all-published',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: '2026-07-23',
      dryRunFile: 'sentinelone/jobs.json',
    },
  )
  assert.equal(
    SENTINELONE_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/sentinellabs/jobs/?content=true',
  )
  assert.match(SENTINELONE_CATALOG.extractionStrategy, /greenhouse-jobs-api/i)
  assert.match(SENTINELONE_CATALOG.verifiedSurfaceSummary, /sentinellabs/i)
  assert.match(SENTINELONE_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.sentinelone\.com\/jobs\//i)
})

