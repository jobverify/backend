import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/syncfusion/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/syncfusion/catalog.js')
  } catch {
    assert.fail('Expected Syncfusion catalog module at ../../scraper/syncfusion/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/syncfusion/script.js')
  } catch {
    assert.fail('Expected Syncfusion scraper module at ../../scraper/syncfusion/script.js')
  }
}

test('Syncfusion local catalog captures the verified first-party careers page and relevant same-domain job detail surface', async () => {
  const { SYNCFUSION_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const syncfusion = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SYNCFUSION_CATALOG)

  assert.equal(defaultCatalog, SYNCFUSION_CATALOG)
  assert.equal(provider.source, 'syncfusion')
  assert.equal(provider.companyName, 'Syncfusion')
  assert.equal(provider.officialBrandName, 'Syncfusion')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.syncfusion.com/careers/')
  assert.equal(provider.officialCareersPageUrl, 'https://www.syncfusion.com/careers/')
  assert.deepEqual(provider.verifiedJobDetailUrls, [
    'https://www.syncfusion.com/careers/dotnet-developer-fresher/',
    'https://www.syncfusion.com/careers/dotnet-developer-experience/',
    'https://www.syncfusion.com/careers/testing-engineer-fresher/',
  ])
  assert.equal(provider.companyDomain, 'syncfusion.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-relevant-job-details')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-careers-page-relevant-job-links')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+relevant-job-links+same-domain-job-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.dryRunFile, /syncfusion[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.syncfusion\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /There are no current openings/i)
  assert.match(provider.verifiedSurfaceSummary, /Relevant Jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /dotnet-developer-fresher/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Syncfusion'), false)

  assert.equal(syncfusion.PROVIDER_METADATA.source, SYNCFUSION_CATALOG.source)
  assert.equal(syncfusion.PROVIDER_METADATA.companyName, SYNCFUSION_CATALOG.companyName)
})

test('Syncfusion exact backlog row matches directly from the local provider metadata', async () => {
  const { SYNCFUSION_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Syncfusion\n',
    catalog: [hydrateProviderCatalogEntry(SYNCFUSION_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Syncfusion', 'syncfusion', 'Syncfusion']],
  )
})

test('Syncfusion hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SYNCFUSION_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SYNCFUSION_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Syncfusion')
  assert.equal(provider.companyCareerPage, 'https://www.syncfusion.com/careers/')
  assert.equal(provider.companyDomain, 'syncfusion.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-relevant-job-details')
  assert.match(provider.modulePath, /syncfusion[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /syncfusion[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
