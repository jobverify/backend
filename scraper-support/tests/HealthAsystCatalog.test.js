import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/healthasyst/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/healthasyst/catalog.js')
  } catch {
    assert.fail('Expected HealthAsyst catalog module at ../../scraper/healthasyst/catalog.js')
  }
}

test('HealthAsyst local catalog captures the verified official careers handoff to the public Keka jobs API', async () => {
  const { HEALTHASYST_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HEALTHASYST_CATALOG)

  assert.equal(defaultCatalog, HEALTHASYST_CATALOG)
  assert.equal(provider.source, 'healthasyst')
  assert.equal(provider.companyName, 'HealthAsyst')
  assert.equal(provider.officialBrandName, 'HealthAsyst')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.healthasyst.com/')
  assert.equal(provider.companyCareerPage, 'https://www.healthasyst.com/careers/')
  assert.equal(provider.officialKekaBoardUrl, 'https://healthasyst.keka.com/careers/')
  assert.equal(provider.publicJobsApiUrl, 'https://healthasyst.keka.com/careers/api/jobs/default/active')
  assert.equal(provider.companyDomain, 'healthasyst.com')
  assert.equal(provider.atsPlatform, 'keka-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-handoff-plus-single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+verified-keka-handoff+careerportalinfo+active-keka-jobs-api+jobdetails+applyjob',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /healthasyst[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Check out the open positions/i)
  assert.match(provider.verifiedSurfaceSummary, /Click here/i)
  assert.match(provider.verifiedSurfaceSummary, /healthasyst\.keka\.com\/careers\/api\/jobs\/default\/active/i)
})

test('HealthAsyst exact backlog row matches directly from local provider metadata', async () => {
  const { HEALTHASYST_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'HealthAsyst\n',
    catalog: [hydrateProviderCatalogEntry(HEALTHASYST_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['HealthAsyst', 'healthasyst', 'HealthAsyst']],
  )
})

test('HealthAsyst hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { HEALTHASYST_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HEALTHASYST_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'HealthAsyst')
  assert.equal(provider.companyDomain, 'healthasyst.com')
  assert.equal(provider.atsPlatform, 'keka-jobs-api')
  assert.match(provider.modulePath, /healthasyst[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /healthasyst[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
