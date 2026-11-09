import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const rivigoModulePath = path.resolve(currentDir, '../../scraper/rivigo/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rivigo/catalog.js')
  } catch {
    assert.fail('Expected Rivigo catalog module at ../../scraper/rivigo/catalog.js')
  }
}

const loadRivigoModule = async () => {
  try {
    return await import('../../scraper/rivigo/script.js')
  } catch {
    assert.fail('Expected Rivigo scraper module at ../../scraper/rivigo/script.js')
  }
}

test('Rivigo retains historical catalog evidence while production metadata describes current extraction', async () => {
  const { RIVIGO_CATALOG } = await loadCatalogModule()
  const rivigo = await loadRivigoModule()
  const provider = hydrateProviderCatalogEntry(RIVIGO_CATALOG)

  assert.equal(provider.source, 'rivigo')
  assert.equal(provider.companyName, 'Rivigo')
  assert.equal(provider.officialBrandName, 'Rivigo')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://mahindralogistics.com/b2b-express/')
  assert.equal(provider.legacyHomepageUrl, 'https://www.rivigo.com/')
  assert.equal(provider.redirectedHomepageUrl, 'https://mahindralogistics.com/b2b-express/')
  assert.equal(provider.companyCareerPage, 'https://mahindralogistics.com/work-with-us/')
  assert.equal(provider.officialFirstPartyJobsUrl, 'https://nectar.darwinbox.in/ms/candidate/careers')
  assert.equal(provider.companyDomain, 'rivigo.com')
  assert.equal(provider.atsPlatform, 'verified-brand-redirect-with-parent-company-darwinbox-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'fail-closed-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-brand-redirect+parent-company-careers-handoff+no-exact-company-public-jobs-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.modulePath, rivigoModulePath)
  assert.match(provider.dryRunFile, /rivigo[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mahindralogistics\.com\/b2b-express\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.rivigo\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mahindralogistics\.com\/work-with-us\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nectar\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Mahindra Logistics and Subsidiaries/i)
  assert.match(provider.verifiedSurfaceSummary, /Rivigo-specific public openings flow/i)

  assert.equal(rivigo.PROVIDER_METADATA.source, RIVIGO_CATALOG.source)
  assert.equal(rivigo.PROVIDER_METADATA.companyCareerPage, rivigo.CAREERS_URL)
  assert.equal(rivigo.PROVIDER_METADATA.verifiedOn, null)
  assert.equal(rivigo.PROVIDER_METADATA.verifiedIndiaJobCount, null)
  assert.equal(rivigo.PROVIDER_METADATA.sourceScopeComplete, false)
  assert.equal(rivigo.PROVIDER_METADATA.parser, 'runtime-verified-recruitment')
})

test('Rivigo exact backlog row matches directly from the local catalog without aliases', async () => {
  const { RIVIGO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rivigo\n',
    catalog: [hydrateProviderCatalogEntry(RIVIGO_CATALOG)],
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rivigo', 'rivigo', 'Rivigo']],
  )
})
