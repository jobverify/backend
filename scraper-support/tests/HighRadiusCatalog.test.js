import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/highradius/catalog.js')
  } catch {
    assert.fail('Expected HighRadius catalog module at ../../scraper/highradius/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/highradius/script.js')
  } catch {
    assert.fail('Expected HighRadius scraper module at ../../scraper/highradius/script.js')
  }
}

test('HighRadius local catalog captures the verified first-party careers page plus Greenhouse metadata', async () => {
  const { HIGHRADIUS_CATALOG } = await loadCatalogModule()
  const highRadius = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(HIGHRADIUS_CATALOG)

  assert.equal(provider.source, 'highradius')
  assert.equal(provider.companyName, 'HighRadius')
  assert.equal(provider.officialBrandName, 'HighRadius Corporation')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.highradius.com/about/career/')
  assert.equal(provider.companyDomain, 'highradius.com')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/highradius')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/highradius/jobs',
  )
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://www.highradius.com/about/careers-list/?gh_jid=7611164003',
  )
  assert.equal(provider.verifiedPublicJobCount, 67)
  assert.equal(provider.verifiedIndiaJobCount, 50)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-careers-page-plus-single-greenhouse-jobs-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+greenhouse-jobs-api+first-party-gh-jid-detail-route+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.modulePath, /highradius[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /highradius[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /highradius\.com\/about\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /boards-api\.greenhouse\.io/i)
  assert.match(provider.verifiedSurfaceSummary, /Agent Developer Test III/i)
  assert.match(provider.verifiedSurfaceSummary, /50 India roles/i)

  assert.equal(highRadius.PROVIDER_METADATA.source, provider.source)
  assert.equal(highRadius.CAREERS_URL, provider.companyCareerPage)
  assert.equal(highRadius.GREENHOUSE_BOARD_URL, provider.greenhouseBoardUrl)
  assert.equal(highRadius.GREENHOUSE_JOBS_API_URL, provider.greenhouseJobsApiUrl)
})

test('HighRadius exact-name backlog rows resolve directly from local provider metadata without shared aliases', async () => {
  const { HIGHRADIUS_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'HighRadius\n',
    catalog: [hydrateProviderCatalogEntry(HIGHRADIUS_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HighRadius', 'highradius', 'HighRadius']],
  )
})

test('getScraperCatalog includes HighRadius as a verified Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'highradius')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HighRadius')
  assert.equal(provider.companyCareerPage, 'https://www.highradius.com/about/career/')
  assert.equal(provider.companyDomain, 'highradius.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /highradius[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HighRadius scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'highradius')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'highradius')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /highradius[\\/]jobs\.json$/i)
})
