import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hfcl/catalog.js')
  } catch {
    assert.fail('Expected HFCL catalog module at ../../scraper/hfcl/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hfcl/script.js')
  } catch {
    assert.fail('Expected HFCL scraper module at ../../scraper/hfcl/script.js')
  }
}

test('HFCL local catalog captures the verified official careers handoff and Darwinbox tenant', async () => {
  const { HFCL_CATALOG } = await loadCatalogModule()
  const hfcl = await loadScriptModule()

  assert.equal(HFCL_CATALOG.source, 'hfcl')
  assert.equal(HFCL_CATALOG.companyName, 'HFCL')
  assert.equal(HFCL_CATALOG.adapter, 'script')
  assert.equal(HFCL_CATALOG.companyCareerPage, 'https://www.hfcl.com/company/careers')
  assert.equal(HFCL_CATALOG.companyDomain, 'hfcl.com')
  assert.equal(HFCL_CATALOG.atsPlatform, 'darwinbox')
  assert.equal(HFCL_CATALOG.countryFilter, 'India')
  assert.equal(HFCL_CATALOG.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(HFCL_CATALOG.extractionStrategy, 'official-careers-page+darwinbox-candidate-api')
  assert.equal(HFCL_CATALOG.parser, 'custom-script')
  assert.equal(HFCL_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(
    HFCL_CATALOG.officialCareersHandoffUrl,
    'https://hifi.darwinbox.in/ms/candidatev2/604761d854807/careers/home',
  )
  assert.equal(HFCL_CATALOG.darwinboxOrigin, 'https://hifi.darwinbox.in')
  assert.equal(HFCL_CATALOG.darwinboxCompanyId, '604761d854807')
  assert.equal(HFCL_CATALOG.verifiedOn, '2026-07-16')
  assert.equal(HFCL_CATALOG.dryRunFile, 'hfcl/jobs.json')
  assert.match(HFCL_CATALOG.verifiedSurfaceSummary, /hfcl\.com\/company\/careers/i)
  assert.match(HFCL_CATALOG.verifiedSurfaceSummary, /hifi\.darwinbox\.in/i)
  assert.match(HFCL_CATALOG.modulePath, /hfcl[\\/]script\.js$/i)

  assert.equal(hfcl.PROVIDER_METADATA.source, HFCL_CATALOG.source)
  assert.equal(hfcl.PROVIDER_METADATA.companyName, HFCL_CATALOG.companyName)
  assert.equal(
    hfcl.PROVIDER_METADATA.officialCareersHandoffUrl,
    HFCL_CATALOG.officialCareersHandoffUrl,
  )
})

test('HFCL exact backlog row resolves directly from local provider metadata', async () => {
  const { HFCL_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'HFCL\n',
    catalog: [HFCL_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HFCL', 'hfcl', 'HFCL']],
  )
})

test('getScraperCatalog includes HFCL as a verified Darwinbox provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hfcl')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HFCL')
  assert.equal(provider.companyCareerPage, 'https://www.hfcl.com/company/careers')
  assert.equal(provider.companyDomain, 'hfcl.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.match(provider.modulePath, /hfcl[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable HFCL scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'hfcl')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'hfcl')
  assert.equal(scraper.provider.atsPlatform, 'darwinbox')
  assert.match(scraper.dryRunFile, /hfcl[\\/]jobs\.json$/i)
})
