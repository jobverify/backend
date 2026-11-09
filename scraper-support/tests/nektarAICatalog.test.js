import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nektarai/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nektarai/catalog.js')
  } catch {
    assert.fail('Expected Nektar AI catalog module at ../../scraper/nektarai/catalog.js')
  }
}

test('Nektar AI catalog captures the verified first-party careers redirect and Coda handoff', async () => {
  const {
    NEKTAR_AI_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NEKTAR_AI_CATALOG)

  assert.equal(defaultCatalog, NEKTAR_AI_CATALOG)
  assert.equal(provider.source, 'nektarai')
  assert.equal(provider.companyName, 'Nektar AI')
  assert.equal(provider.officialBrandName, 'Nektar.ai')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://nektar.ai/')
  assert.equal(provider.companyCareerPage, 'https://nektar.ai/careers/')
  assert.equal(provider.companyDomain, 'nektar.ai')
  assert.equal(
    provider.officialOpenRolesUrl,
    'https://coda.io/@anusha-laksh/open-roles-for-website-publication',
  )
  assert.equal(
    provider.officialApplyFormUrl,
    'https://coda.io/form/Kick-start-your-career-with-us_dfLGyijCu1N',
  )
  assert.equal(provider.atsPlatform, 'official-careers-coda-public-document')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'first-party-careers-redirect-plus-coda-surface-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-coda-handoff+no-public-listings-discovery-only-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.match(provider.verifiedSurfaceSummary, /September 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /culture and contact copy/i)
  assert.match(provider.verifiedSurfaceSummary, /discovery-only evidence, not an authoritative empty-opening statement/i)
  assert.match(provider.verifiedSurfaceSummary, /docs\.superhuman\.com/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nektarai[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nektar AI'), false)
})

test('Nektar AI backlog row matches directly from the local catalog metadata', async () => {
  const { NEKTAR_AI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nektar AI\n',
    catalog: [NEKTAR_AI_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nektar AI', 'nektarai', 'Nektar AI']],
  )
})
