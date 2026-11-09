import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/successivetechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/successivetechnologies/catalog.js')
  } catch {
    assert.fail('Expected Successive Technologies catalog module at ../../scraper/successivetechnologies/catalog.js')
  }
}

test('Successive Technologies local catalog captures the verified first-party careers handoff to Keka', async () => {
  const { SUCCESSIVE_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SUCCESSIVE_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SUCCESSIVE_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'successivetechnologies')
  assert.equal(provider.companyName, 'Successive Technologies')
  assert.equal(provider.companyCareerPage, 'https://successive.tech/careers/jobsearch/')
  assert.equal(provider.jobsBoardUrl, 'https://successivesoftware.keka.com/careers/')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+embedded-keka-config+careerportalinfo+active-keka-embed-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.companyDomain, 'successive.tech')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /successivesoftware\.keka\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /empty public active jobs feed/i)
})

test('Successive Technologies exact backlog row resolves from the local catalog object', async () => {
  const { SUCCESSIVE_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Successive Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SUCCESSIVE_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
