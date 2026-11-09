import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pathai/catalog.js')
  } catch {
    assert.fail('Expected PathAI catalog module at ../../scraper/pathai/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pathai/script.js')
  } catch {
    assert.fail('Expected PathAI scraper module at ../../scraper/pathai/script.js')
  }
}

test('PathAI local catalog captures the current declared first-party careers page plus Greenhouse metadata', async () => {
  const { PATH_AI_CATALOG } = await loadCatalogModule()
  const pathAi = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(PATH_AI_CATALOG)

  assert.equal(provider.source, 'pathai')
  assert.equal(provider.companyName, 'PathAI')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.pathai.com/careers')
  assert.equal(provider.companyDomain, 'pathai.com')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/pathai')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/pathai/jobs',
  )
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'paired-current-native-and-published-own-route-original-GETs',
  )
  assert.equal(
    provider.extractionStrategy,
    'full-native-and-published-route-models-before-country-selection',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, null)
  assert.match(provider.modulePath, /pathai[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pathai[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /unqualified/i)
  assert.equal(provider.verifiedInventoryStatus, 'unverified')
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.zeroResultPolicy, 'coverage-gap')

  assert.equal(pathAi.PROVIDER_METADATA.source, provider.source)
  assert.equal(pathAi.CAREERS_URL, provider.companyCareerPage)
  assert.equal(pathAi.GREENHOUSE_BOARD_URL, provider.greenhouseBoardUrl)
  assert.equal(pathAi.GREENHOUSE_JOBS_API_URL, provider.greenhouseJobsApiUrl)
})

test('PathAI exact-name backlog rows resolve directly from local provider metadata without alias extensions', async () => {
  const { PATH_AI_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'PathAI\n',
    catalog: [hydrateProviderCatalogEntry(PATH_AI_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['PathAI', 'pathai', 'PathAI']],
  )
})

test('getScraperCatalog includes PathAI as a discovery-only Greenhouse provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pathai')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PathAI')
  assert.equal(provider.companyCareerPage, 'https://www.pathai.com/careers')
  assert.equal(provider.companyDomain, 'pathai.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.match(provider.modulePath, /pathai[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable PathAI scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pathai')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pathai')
  assert.equal(scraper.provider.atsPlatform, 'greenhouse')
  assert.match(scraper.dryRunFile, /pathai[\\/]jobs\.json$/i)
})
