import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/appinventivtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/appinventivtechnologies/catalog.js')
  } catch {
    assert.fail('Expected AppInventiv Technologies catalog module at ../../scraper/appinventivtechnologies/catalog.js')
  }
}

test('AppInventiv Technologies local catalog captures the verified first-party careers page with embedded job modals', async () => {
  const { APPINVENTIV_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APPINVENTIV_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, APPINVENTIV_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'appinventivtechnologies')
  assert.equal(provider.companyName, 'AppInventiv Technologies')
  assert.equal(provider.officialBrandName, 'Appinventiv')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://appinventiv.com/career/')
  assert.equal(provider.officialCareersPageUrl, 'https://appinventiv.com/career/')
  assert.equal(provider.companyDomain, 'appinventiv.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-career-page+embedded-job-modals',
  )
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /AL\/ML Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Tech Lead Node\.js/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /appinventivtechnologies[\\/]jobs\.json$/i)
})

test('AppInventiv Technologies exact backlog row resolves from the local provider metadata', async () => {
  const { APPINVENTIV_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'AppInventiv Technologies\n',
    catalog: [hydrateProviderCatalogEntry(APPINVENTIV_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['AppInventiv Technologies', 'appinventivtechnologies', 'AppInventiv Technologies']],
  )
})

test('AppInventiv Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { APPINVENTIV_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(APPINVENTIV_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://appinventiv.com/career/')
  assert.match(provider.modulePath, /appinventivtechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
