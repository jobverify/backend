import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/techouts/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/techouts/catalog.js')
  } catch {
    assert.fail('Expected Techouts catalog module at ../../scraper/techouts/catalog.js')
  }
}

test('Techouts local catalog captures the verified first-party careers shell and Keka embed contract', async () => {
  const { TECHOUTS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHOUTS_CATALOG)

  assert.equal(defaultCatalog, TECHOUTS_CATALOG)
  assert.equal(provider.source, 'techouts')
  assert.equal(provider.companyName, 'Techouts')
  assert.equal(provider.officialBrandName, 'Techouts')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://techouts.com/careers')
  assert.equal(provider.jobsApiUrl, 'https://techouts.keka.com/careers/api/embedjobs/default/active/3ba5a10f-a9f3-413c-9853-0c55d1e34587')
  assert.equal(provider.companyDomain, 'techouts.com')
  assert.equal(provider.atsPlatform, 'keka-embedjobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-embed-payload')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+keka-embedjobs-active-payload+hyderabad-job-locations',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Data Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Software Engineer-Machine Learning/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /techouts[\\/]jobs\.json$/i)
})

test('Techouts exact backlog row resolves from local provider metadata', async () => {
  const { TECHOUTS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Techouts\n',
    catalog: [hydrateProviderCatalogEntry(TECHOUTS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Techouts hydrated local catalog stays script-runner compatible', async () => {
  const { TECHOUTS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHOUTS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
