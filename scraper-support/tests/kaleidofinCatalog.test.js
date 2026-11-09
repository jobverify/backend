import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kaleidofin/catalog.js')
  } catch {
    assert.fail('Expected Kaleidofin catalog module at ../../scraper/kaleidofin/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kaleidofin/script.js')
  } catch {
    assert.fail('Expected Kaleidofin scraper module at ../../scraper/kaleidofin/script.js')
  }
}

test('Kaleidofin local catalog captures the verified first-party careers listings contract', async () => {
  const { KALEIDOFIN_CATALOG } = await loadCatalogModule()
  const kaleidofin = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KALEIDOFIN_CATALOG)

  assert.equal(KALEIDOFIN_CATALOG.source, 'kaleidofin')
  assert.equal(KALEIDOFIN_CATALOG.companyName, 'Kaleidofin')
  assert.equal(KALEIDOFIN_CATALOG.officialBrandName, 'Kaleidofin')
  assert.equal(KALEIDOFIN_CATALOG.adapter, 'script')
  assert.equal(KALEIDOFIN_CATALOG.modulePath, '../../scraper/kaleidofin/script.js')
  assert.equal(KALEIDOFIN_CATALOG.dryRunFile, 'kaleidofin/jobs.json')
  assert.equal(KALEIDOFIN_CATALOG.companyCareerPage, 'https://www.kaleidofin.com/careers')
  assert.equal(
    KALEIDOFIN_CATALOG.verifiedSampleJobUrl,
    'https://www.kaleidofin.com/careers/software-development-manager',
  )
  assert.equal(KALEIDOFIN_CATALOG.companyDomain, 'kaleidofin.com')
  assert.equal(KALEIDOFIN_CATALOG.verifiedPublicJobCount, 8)
  assert.equal(KALEIDOFIN_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(KALEIDOFIN_CATALOG.countryFilter, 'India')
  assert.equal(
    KALEIDOFIN_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-linked-role-pages',
  )
  assert.equal(
    KALEIDOFIN_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+linked-role-pages',
  )
  assert.equal(KALEIDOFIN_CATALOG.parser, 'custom-script')
  assert.equal(KALEIDOFIN_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KALEIDOFIN_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KALEIDOFIN_CATALOG.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(KALEIDOFIN_CATALOG.verifiedSurfaceSummary, /kaleidofin\.com\/careers/i)
  assert.match(
    KALEIDOFIN_CATALOG.verifiedSurfaceSummary,
    /kaleidofin\.com\/careers\/software-development-manager/i,
  )
  assert.match(KALEIDOFIN_CATALOG.verifiedSurfaceSummary, /8 live roles/i)

  assert.equal(provider.source, 'kaleidofin')
  assert.equal(provider.companyName, 'Kaleidofin')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kaleidofin.com/careers')
  assert.equal(provider.companyDomain, 'kaleidofin.com')
  assert.match(provider.modulePath, /kaleidofin[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kaleidofin[\\/]jobs\.json$/i)

  assert.equal(kaleidofin.PROVIDER_METADATA.source, provider.source)
  assert.equal(kaleidofin.CAREERS_URL, provider.companyCareerPage)
  assert.equal(kaleidofin.VERIFIED_SAMPLE_JOB_URL, provider.verifiedSampleJobUrl)
})

test('Kaleidofin exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { KALEIDOFIN_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Kaleidofin\n',
    catalog: [hydrateProviderCatalogEntry(KALEIDOFIN_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Kaleidofin', 'kaleidofin', 'Kaleidofin']],
  )
})
