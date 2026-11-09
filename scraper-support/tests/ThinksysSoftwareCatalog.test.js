import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/thinksyssoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/thinksyssoftware/catalog.js')
  } catch {
    assert.fail('Expected Thinksys Software catalog module at ../../scraper/thinksyssoftware/catalog.js')
  }
}

test('Thinksys Software local catalog captures the verified first-party careers surface', async () => {
  const { THINKSYS_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(THINKSYS_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, THINKSYS_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'thinksyssoftware')
  assert.equal(provider.companyName, 'Thinksys Software')
  assert.equal(provider.officialBrandName, 'ThinkSys')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://thinksys.com/')
  assert.equal(provider.companyCareerPage, 'https://thinksys.com/careers/')
  assert.equal(provider.companyDomain, 'thinksys.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-current-openings')
  assert.equal(provider.extractionStrategy, 'first-party-job-card-list+detail-pages')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /thinksyssoftware[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /MS SQL Database Administrator/i)
  assert.match(provider.verifiedSurfaceSummary, /Talent Acquisition Specialist/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer \(\.NET & React\)/i)
})

test('Thinksys Software exact backlog row resolves from the local provider contract', async () => {
  const { THINKSYS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Thinksys Software\n',
    catalog: [hydrateProviderCatalogEntry(THINKSYS_SOFTWARE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Thinksys Software', 'thinksyssoftware', 'Thinksys Software']],
  )
})
