import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/futransolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/futransolutions/catalog.js')
  } catch {
    assert.fail('Expected Futran Solutions catalog module at ../../scraper/futransolutions/catalog.js')
  }
}

test('Futran Solutions local catalog captures the verified submit-profile careers contract', async () => {
  const { FUTRAN_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(FUTRAN_SOLUTIONS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, FUTRAN_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'futransolutions')
  assert.equal(provider.companyName, 'Futran Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://futransolutions.com/')
  assert.equal(provider.companyCareerPage, 'https://futransolutions.com/careers/')
  assert.equal(provider.atsPlatform, 'official-company-site-no-live-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-first-party-careers-page-without-public-job-listings')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+submit-profile-intake-form+returns-empty-array',
  )
  assert.equal(provider.companyDomain, 'futransolutions.com')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Submit Your Profile/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /futransolutions[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})

test('Futran Solutions exact backlog row resolves from the local provider metadata without aliases', async () => {
  const { FUTRAN_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Futran Solutions\n',
    catalog: [hydrateProviderCatalogEntry(FUTRAN_SOLUTIONS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Futran Solutions', 'futransolutions', 'Futran Solutions']],
  )
})
