import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/42gears/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/42gears/catalog.js')
  } catch {
    assert.fail('Expected 42Gears Mobility Systems catalog module at ../../scraper/42gears/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/42gears/script.js')
  } catch {
    assert.fail('Expected 42Gears Mobility Systems scraper module at ../../scraper/42gears/script.js')
  }
}

test('42Gears Mobility Systems local catalog captures the verified first-party India careers surface', async () => {
  const { FORTY_TWO_GEARS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const fortyTwoGears = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(FORTY_TWO_GEARS_CATALOG)

  assert.equal(defaultCatalog, FORTY_TWO_GEARS_CATALOG)
  assert.equal(provider.source, '42gears')
  assert.equal(provider.companyName, '42Gears Mobility Systems')
  assert.equal(provider.officialBrandName, '42Gears Mobility Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.42gears.com/')
  assert.equal(
    provider.companyCareerPage,
    'https://www.42gears.com/careers/?selected_jobtype=-1&selected_location=india',
  )
  assert.equal(provider.companyDomain, '42gears.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-cards')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-filtered-india-listing')
  assert.equal(provider.extractionStrategy, 'nextjs-flight-current-openings')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /42gears[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, September 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Assistant Manager- Finance/i)
  assert.match(provider.verifiedSurfaceSummary, /Lead Software Engineer/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, '42Gears Mobility Systems'), false)

  assert.equal(fortyTwoGears.PROVIDER_METADATA.source, FORTY_TWO_GEARS_CATALOG.source)
  assert.equal(fortyTwoGears.PROVIDER_METADATA.companyCareerPage, FORTY_TWO_GEARS_CATALOG.companyCareerPage)
})

test('42Gears Mobility Systems exact backlog row resolves from the local provider contract', async () => {
  const { FORTY_TWO_GEARS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: '42Gears Mobility Systems\n',
    catalog: [hydrateProviderCatalogEntry(FORTY_TWO_GEARS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['42Gears Mobility Systems', '42gears', '42Gears Mobility Systems']],
  )
})
