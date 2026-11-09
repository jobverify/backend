import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/outlinesystems/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/outlinesystems/catalog.js')
  } catch {
    assert.fail('Expected Outline Systems catalog module at ../../scraper/outlinesystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/outlinesystems/script.js')
  } catch {
    assert.fail('Expected Outline Systems scraper module at ../../scraper/outlinesystems/script.js')
  }
}

test('Outline Systems local catalog captures the no-trustworthy-first-party-jobs state', async () => {
  const { OUTLINE_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const outline = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(OUTLINE_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, OUTLINE_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'outlinesystems')
  assert.equal(provider.companyName, 'Outline Systems')
  assert.equal(provider.officialBrandName, 'Outline Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.outlinesys.com/')
  assert.equal(provider.companyCareerPage, 'https://www.linkedin.com/company/outline-systems')
  assert.equal(provider.companyDomain, 'outlinesys.com')
  assert.equal(provider.atsPlatform, 'legacy-native-employer-with-unresolved-successor-scope')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'bounded-exact-employer-filtered-India-and-Worldwide-observations;successor-scope-unresolved')
  assert.equal(provider.extractionStrategy, 'exact-legacy-employer+reciprocal-domain+native-scoped-observations;no-parent-job-substitution')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-23')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /outlinesys\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /whole-company counts unknown/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Outline Systems'), false)

  assert.equal(outline.PROVIDER_METADATA.source, OUTLINE_SYSTEMS_CATALOG.source)
  assert.equal(outline.PROVIDER_METADATA.companyCareerPage, OUTLINE_SYSTEMS_CATALOG.companyCareerPage)
})

test('Outline Systems exact backlog row resolves from the local provider contract', async () => {
  const { OUTLINE_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Outline Systems\n',
    catalog: [hydrateProviderCatalogEntry(OUTLINE_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Outline Systems', 'outlinesystems', 'Outline Systems']],
  )
})
