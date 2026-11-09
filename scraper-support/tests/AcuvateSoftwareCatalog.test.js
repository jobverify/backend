import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/acuvatesoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/acuvatesoftware/catalog.js')
  } catch {
    assert.fail('Expected Acuvate Software catalog module at ../../scraper/acuvatesoftware/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Acuvate Software local catalog captures the verified first-party careers listings', async () => {
  const { ACUVATE_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(ACUVATE_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, ACUVATE_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'acuvatesoftware')
  assert.equal(provider.companyName, 'Acuvate Software')
  assert.equal(provider.officialBrandName, 'Acuvate')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://acuvate.com/')
  assert.equal(provider.companyCareerPage, 'https://acuvate.com/careers/')
  assert.equal(provider.applyUrl, 'https://acuvate.com/careers/#fill_the_form')
  assert.equal(provider.atsPlatform, 'official-first-party-role-sections')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'runtime-advertised-hiring-scope-and-closing-inventory-recheck')
  assert.equal(provider.extractionStrategy, 'visible-elementor-role-panels+current-client-reveal-contract+exact-worksites+closing-reconciliation')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'acuvate.com')
  assert.equal(provider.verifiedOn, '2026-10-27')
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.match(provider.verifiedSurfaceSummary, /closing scope, membership and every role field/i)
  assert.match(provider.verifiedSurfaceSummary, /qualified country inference/i)
  assert.match(provider.verifiedSurfaceSummary, /unavailable locales/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /acuvatesoftware[\\/]jobs\.json$/i)
})

test('Acuvate Software exact backlog row resolves from the local provider contract', async () => {
  const { ACUVATE_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Acuvate Software\n',
    catalog: [buildCatalogReadyProvider(ACUVATE_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Acuvate Software', 'acuvatesoftware', 'Acuvate Software']],
  )
})
