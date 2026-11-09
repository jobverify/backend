import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/ginesys/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ginesys/catalog.js')
  } catch {
    assert.fail('Expected Ginesys catalog module at ../../scraper/ginesys/catalog.js')
  }
}

test('Ginesys local catalog captures the verified first-party shell and Keka embed API contract', async () => {
  const { GINESYS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GINESYS_CATALOG)

  assert.equal(defaultCatalog, GINESYS_CATALOG)
  assert.equal(provider.source, 'ginesys')
  assert.equal(provider.companyName, 'Ginesys')
  assert.equal(provider.officialBrandName, 'Ginesys')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ginesys.in/careers')
  assert.equal(provider.openPositionsUrl, 'https://www.ginesys.in/open-positions')
  assert.equal(provider.externalHandoffUrl, 'https://ginesysone.keka.com/careers/')
  assert.equal(provider.expectedIdentifier, '81ab5744-744b-438a-8efe-4fbde810ebaa')
  assert.equal(provider.companyDomain, 'ginesys.in')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-careers-shell-plus-single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+open-positions-keka-handoff+careerportalinfo+active-keka-embed-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Executive - Talent Acquisition/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud Architect/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /ginesys[\\/]jobs\.json$/i)
})

test('Ginesys exact backlog row resolves from the local provider metadata', async () => {
  const { GINESYS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Ginesys\n',
    catalog: [hydrateProviderCatalogEntry(GINESYS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ginesys', 'ginesys', 'Ginesys']],
  )
})

test('Ginesys hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { GINESYS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GINESYS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ginesys.in/careers')
  assert.match(provider.modulePath, /ginesys[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
