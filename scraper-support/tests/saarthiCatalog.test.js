import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/saarthi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/saarthi/catalog.js')
  } catch {
    assert.fail('Expected Saarthi catalog module at ../../scraper/saarthi/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/saarthi/script.js')
  } catch {
    assert.fail('Expected Saarthi scraper module at ../../scraper/saarthi/script.js')
  }
}

test('Saarthi local catalog captures the verified first-party marketplace-only exact-name surface without alias churn', async () => {
  const { SAARTHI_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const saarthi = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SAARTHI_CATALOG)

  assert.equal(defaultCatalog, SAARTHI_CATALOG)
  assert.equal(provider.source, 'saarthi')
  assert.equal(provider.companyName, 'Saarthi')
  assert.equal(provider.officialBrandName, 'Saarthi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.joinsaarthi.com/')
  assert.equal(provider.companyCareerPage, 'https://joinsaarthi.com/about')
  assert.equal(provider.publicMarketplaceUrl, 'https://www.joinsaarthi.com/')
  assert.equal(provider.companyDomain, 'joinsaarthi.com')
  assert.equal(provider.atsPlatform, 'official-job-marketplace-no-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'static-about-page-plus-homepage-marketplace-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-about-page+verified-homepage-marketplace-third-party-jobs+no-exact-company-careers-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /saarthi[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/joinsaarthi\.com\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.joinsaarthi\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /tracks 15,000\+ companies every day/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy exact-name Saarthi careers surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Saarthi'), false)

  assert.equal(saarthi.PROVIDER_METADATA.source, SAARTHI_CATALOG.source)
  assert.equal(saarthi.PROVIDER_METADATA.companyName, SAARTHI_CATALOG.companyName)
  assert.equal(saarthi.PROVIDER_METADATA.publicMarketplaceUrl, SAARTHI_CATALOG.publicMarketplaceUrl)
})

test('Saarthi backlog row matches directly from the local catalog without alias churn', async () => {
  const { SAARTHI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Saarthi\n',
    catalog: [hydrateProviderCatalogEntry(SAARTHI_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Saarthi', 'saarthi', 'Saarthi']],
  )
})

test('Saarthi hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SAARTHI_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAARTHI_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Saarthi')
  assert.equal(provider.companyCareerPage, 'https://joinsaarthi.com/about')
  assert.equal(provider.companyDomain, 'joinsaarthi.com')
  assert.equal(provider.atsPlatform, 'official-job-marketplace-no-company-careers')
  assert.match(provider.modulePath, /saarthi[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /saarthi[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
