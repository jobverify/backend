import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/geeksforgeeks/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/geeksforgeeks/catalog.js')
  } catch {
    assert.fail('Expected GeeksforGeeks catalog module at ../../scraper/geeksforgeeks/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/geeksforgeeks/script.js')
  } catch {
    assert.fail('Expected GeeksforGeeks scraper module at ../../scraper/geeksforgeeks/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('GeeksforGeeks local catalog captures the verified first-party jobs API contract', async () => {
  const { GEEKSFORGEEKS_CATALOG } = await loadCatalogModule()
  const geeksForGeeks = await loadScriptModule()
  const provider = buildCatalogReadyProvider(GEEKSFORGEEKS_CATALOG)

  assert.equal(provider.source, 'geeksforgeeks')
  assert.equal(provider.companyName, 'GeeksforGeeks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.geeksforgeeks.org/about/')
  assert.equal(provider.companyCareerPage, 'https://www.geeksforgeeks.org/jobs/')
  assert.equal(provider.jobsApiUrl, 'https://practiceapi.geeksforgeeks.org/api/vr/jobs/?status=active')
  assert.equal(provider.companyDomain, 'geeksforgeeks.org')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'next-link-api-pagination')
  assert.equal(
    provider.extractionStrategy,
    'nextjs-seed-page+public-jobs-api-filtered-by-organization-name',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.verifiedSurfaceSummary, /7 active GeeksforGeeks jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /activeJobData/i)
  assert.match(provider.verifiedSurfaceSummary, /practiceapi\.geeksforgeeks\.org/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /geeksforgeeks[\\/]jobs\.json$/i)

  assert.equal(geeksForGeeks.PROVIDER_METADATA.source, provider.source)
  assert.equal(geeksForGeeks.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(geeksForGeeks.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('GeeksforGeeks exact backlog row resolves from local provider metadata without aliases', async () => {
  const { GEEKSFORGEEKS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'GeeksforGeeks\n',
    catalog: [buildCatalogReadyProvider(GEEKSFORGEEKS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [
      item.companyName,
      item.source,
      item.provider?.companyName ?? null,
    ]),
    [['GeeksforGeeks', 'geeksforgeeks', 'GeeksforGeeks']],
  )
})

test('getScraperCatalog includes GeeksforGeeks as a verified jobs API provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'geeksforgeeks')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'GeeksforGeeks')
  assert.equal(provider.companyCareerPage, 'https://www.geeksforgeeks.org/jobs/')
  assert.equal(provider.companyDomain, 'geeksforgeeks.org')
  assert.equal(provider.atsPlatform, 'official-company-careers-api')
  assert.match(provider.modulePath, /geeksforgeeks[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable GeeksforGeeks scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'geeksforgeeks')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'geeksforgeeks')
  assert.equal(scraper.provider.atsPlatform, 'official-company-careers-api')
  assert.match(scraper.dryRunFile, /geeksforgeeks[\\/]jobs\.json$/i)
})
