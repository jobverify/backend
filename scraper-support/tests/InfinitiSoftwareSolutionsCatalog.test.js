import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/infinitisoftwaresolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/infinitisoftwaresolutions/catalog.js')
  } catch {
    assert.fail('Expected Infiniti Software Solutions catalog module at ../../scraper/infinitisoftwaresolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/infinitisoftwaresolutions/script.js')
  } catch {
    assert.fail('Expected Infiniti Software Solutions scraper module at ../../scraper/infinitisoftwaresolutions/script.js')
  }
}

test('Infiniti Software Solutions local catalog captures the verified first-party careers page and Goodfit apply links', async () => {
  const { INFINITI_SOFTWARE_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const infiniti = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(INFINITI_SOFTWARE_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, INFINITI_SOFTWARE_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'infinitisoftwaresolutions')
  assert.equal(provider.companyName, 'Infiniti Software Solutions')
  assert.equal(provider.officialBrandName, 'Infiniti Software Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.infinitisoftware.net/')
  assert.equal(provider.companyCareerPage, 'https://www.infinitisoftware.net/careers/')
  assert.equal(provider.applyDomain, 'goodfit.so')
  assert.equal(provider.companyDomain, 'infinitisoftware.net')
  assert.equal(provider.atsPlatform, 'official-first-party-careers-linkout')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page')
  assert.equal(provider.extractionStrategy, 'first-party-job-sections-plus-goodfit-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /infinitisoftwaresolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Success Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Security Compliance Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /goodfit\.so/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Infiniti Software Solutions'), false)

  assert.equal(infiniti.PROVIDER_METADATA.source, INFINITI_SOFTWARE_SOLUTIONS_CATALOG.source)
  assert.equal(infiniti.PROVIDER_METADATA.applyDomain, INFINITI_SOFTWARE_SOLUTIONS_CATALOG.applyDomain)
})

test('Infiniti Software Solutions exact backlog row resolves from the local provider contract', async () => {
  const { INFINITI_SOFTWARE_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Infiniti Software Solutions\n',
    catalog: [hydrateProviderCatalogEntry(INFINITI_SOFTWARE_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Infiniti Software Solutions', 'infinitisoftwaresolutions', 'Infiniti Software Solutions']],
  )
})
