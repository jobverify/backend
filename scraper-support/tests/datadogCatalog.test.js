import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
} from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/datadog/catalog.js')
  } catch {
    assert.fail('Expected Datadog catalog module at ../../scraper/datadog/catalog.js')
  }
}

const loadDatadogModule = async () => {
  try {
    return await import('../../scraper/datadog/script.js')
  } catch {
    assert.fail('Expected Datadog scraper module at ../../scraper/datadog/script.js')
  }
}

test('getScraperCatalog includes Datadog as a verified public Typesense-backed scraper', async () => {
  const { DATADOG_CATALOG } = await loadCatalogModule()
  const datadog = await loadDatadogModule()
  const provider = getScraperCatalog().find((item) => item.source === 'datadog')

  assert.ok(provider)
  assert.equal(provider.source, 'datadog')
  assert.equal(provider.companyName, 'Datadog')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.datadoghq.com/all-jobs/')
  assert.equal(provider.companyDomain, 'careers.datadoghq.com')
  assert.equal(provider.atsPlatform, 'typesense-public-search')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'paged-public-typesense-search-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-html+official-main-bundle+public-typesense-documents-search',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.queryBy, 'title')
  assert.equal(provider.filterBy, 'location_string:India')
  assert.equal(provider.typesenseHost, 'https://gk6e3zbyuntvc5dap.a1.typesense.net')
  assert.equal(provider.typesenseCollection, 'careers_alias')
  assert.equal(provider.typesensePublicKey, '1Hwq7hntXp211hKvRS3CSI2QSU7w2gFm')
  assert.equal(provider.jobsPerPage, 10)
  assert.equal(provider.verifiedOn, '2026-07-14')
  assert.match(provider.verifiedSurfaceSummary, /public Typesense/i)
  assert.match(provider.modulePath, /datadog[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /datadog[\\/]jobs\.json$/i)

  assert.equal(DATADOG_CATALOG.source, provider.source)
  assert.equal(DATADOG_CATALOG.companyName, provider.companyName)
  assert.equal(DATADOG_CATALOG.companyCareerPage, provider.companyCareerPage)
  assert.equal(datadog.PROVIDER_METADATA.typesenseCollection, provider.typesenseCollection)
})

test('buildScrapers and company coverage resolve Datadog from the shared catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === 'datadog')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'datadog')
  assert.match(scraper.dryRunFile, /datadog[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Datadog,\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Datadog', 'datadog', 'Datadog']],
  )
})
