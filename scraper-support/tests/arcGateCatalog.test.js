import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/arcgate/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/arcgate/catalog.js')
  } catch {
    assert.fail('Expected ArcGate catalog module at ../../scraper/arcgate/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/arcgate/script.js')
  } catch {
    assert.fail('Expected ArcGate scraper module at ../../scraper/arcgate/script.js')
  }
}

test('ArcGate local catalog captures the verified first-party careers page and linked application flow', async () => {
  const { ARCGATE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const arcgate = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(ARCGATE_CATALOG)

  assert.equal(defaultCatalog, ARCGATE_CATALOG)
  assert.equal(provider.source, 'arcgate')
  assert.equal(provider.companyName, 'ArcGate')
  assert.equal(provider.officialBrandName, 'Arcgate')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.arcgate.com/')
  assert.equal(provider.companyCareerPage, 'https://www.arcgate.com/careers')
  assert.equal(provider.verifiedSampleJobUrl, 'https://www.arcgate.com/career/data-engineer')
  assert.equal(provider.verifiedSampleJobTitle, 'Data Engineer')
  assert.equal(provider.companyDomain, 'arcgate.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-current-openings-links')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+linked-detail-pages+first-party-join-apply-links',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 17)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.arcgate\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /17 current openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Research Analyst/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /\/join\?post_name=/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /arcgate[\\/]jobs\.json$/i)

  assert.equal(arcgate.PROVIDER_METADATA.source, provider.source)
  assert.equal(arcgate.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('ArcGate exact backlog row resolves from the local provider contract without aliases', async () => {
  const { ARCGATE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ArcGate\n',
    catalog: [hydrateProviderCatalogEntry(ARCGATE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['ArcGate', 'arcgate', 'ArcGate']],
  )
})
