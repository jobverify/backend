import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/inubesoftwaresolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/inubesoftwaresolutions/catalog.js')
  } catch {
    assert.fail('Expected Inube Software Solutions catalog module at ../../scraper/inubesoftwaresolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/inubesoftwaresolutions/script.js')
  } catch {
    assert.fail('Expected Inube Software Solutions scraper module at ../../scraper/inubesoftwaresolutions/script.js')
  }
}

test('Inube Software Solutions local catalog captures the verified first-party job archive and detail pages', async () => {
  const { INUBE_SOFTWARE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const inube = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(INUBE_SOFTWARE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, INUBE_SOFTWARE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'inubesoftwaresolutions')
  assert.equal(provider.companyName, 'Inube Software Solutions')
  assert.equal(provider.officialBrandName, 'iNube')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://inubesolutions.com/careers-inube/')
  assert.equal(provider.companyDomain, 'inubesolutions.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-posts')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-jobs-archive-plus-linked-role-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-jobs-archive+verified-role-detail-pages+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /inubesoftwaresolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Business Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Associate Project Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Inside Sales Executive/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Inube Software Solutions'), false)

  assert.equal(inube.PROVIDER_METADATA.source, INUBE_SOFTWARE_SOLUTIONS_CATALOG.source)
  assert.equal(inube.PROVIDER_METADATA.companyCareerPage, INUBE_SOFTWARE_SOLUTIONS_CATALOG.companyCareerPage)
})

test('Inube Software Solutions exact backlog row resolves from the local provider contract', async () => {
  const { INUBE_SOFTWARE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Inube Software Solutions\n',
    catalog: [hydrateProviderCatalogEntry(INUBE_SOFTWARE_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Inube Software Solutions', 'inubesoftwaresolutions', 'Inube Software Solutions']],
  )
})
