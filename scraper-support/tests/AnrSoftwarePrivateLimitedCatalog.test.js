import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/anrsoftwareprivatelimited/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/anrsoftwareprivatelimited/catalog.js')
  } catch {
    assert.fail('Expected ANR Software Private Limited catalog module at ../../scraper/anrsoftwareprivatelimited/catalog.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('ANR catalog describes unresolved card criteria and preserves verification history', async () => {
  const { ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildProvider(ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG)

  assert.equal(defaultCatalog, ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG)
  assert.equal(provider.source, 'anrsoftwareprivatelimited')
  assert.equal(provider.companyName, 'ANR Software Private Limited')
  assert.equal(provider.officialBrandName, 'ANR Software Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.anrsoftware.com/')
  assert.equal(provider.companyCareerPage, 'https://www.anrsoftware.com/career/')
  assert.equal(provider.atsPlatform, 'first-party-public-role-criteria-country-and-id-gap')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'all-declared-card-observations-public-reveal-and-closing-comparison')
  assert.equal(provider.extractionStrategy, 'current-native-CSS-and-accordion+full-public-card-criteria+unknown-country-and-identity+bounded-audit')
  assert.equal(provider.companyDomain, 'anrsoftware.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verificationIsHistorical, true)
  assert.match(provider.verifiedSurfaceSummary, /^Historical July 18 metadata, not current qualification:/)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.authoritativeSourceTotal, null)
  assert.equal(provider.authoritativeIndiaFacetCount, null)
  assert.equal(provider.zeroResultPolicy, 'evidence-required')
  assert.equal(provider.modulePath, modulePath)
})

test('ANR Software Private Limited exact backlog row resolves from the local provider contract', async () => {
  const { ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ANR Software Private Limited\n',
    catalog: [buildProvider(ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
