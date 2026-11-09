import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tetrasoft/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tetrasoft/catalog.js')
  } catch {
    assert.fail('Expected TetraSoft catalog module at ../../scraper/tetrasoft/catalog.js')
  }
}

test('TetraSoft local catalog captures the verified first-party careers accordion contract', async () => {
  const { TETRASOFT_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TETRASOFT_CATALOG)

  assert.equal(defaultCatalog, TETRASOFT_CATALOG)
  assert.equal(provider.source, 'tetrasoft')
  assert.equal(provider.companyName, 'TetraSoft')
  assert.equal(provider.officialBrandName, 'Tetrasoft India Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tetrasoft.us/')
  assert.equal(provider.companyCareerPage, 'https://www.tetrasoft.us/careers.html')
  assert.equal(provider.companyDomain, 'tetrasoft.us')
  assert.equal(provider.atsPlatform, 'official-company-careers-html')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-careers-accordion+mailto-apply')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /tetrasoft[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Tetrasoft Careers/i)
  assert.match(provider.verifiedSurfaceSummary, /ts_tag_offshore@tetrasoft\.us/i)
})

test('TetraSoft exact backlog row resolves directly from the local provider contract', async () => {
  const { TETRASOFT_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'TetraSoft\n',
    catalog: [hydrateProviderCatalogEntry(TETRASOFT_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['TetraSoft', 'tetrasoft', 'TetraSoft']],
  )
})

test('TetraSoft hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { TETRASOFT_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TETRASOFT_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.tetrasoft.us/careers.html')
  assert.equal(provider.companyDomain, 'tetrasoft.us')
  assert.match(provider.modulePath, /tetrasoft[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
