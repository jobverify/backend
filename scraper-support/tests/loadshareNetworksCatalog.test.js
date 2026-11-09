import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/loadsharenetworks/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/loadsharenetworks/catalog.js')
  } catch {
    assert.fail('Expected Loadshare Networks catalog module at ../../scraper/loadsharenetworks/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/loadsharenetworks/script.js')
  } catch {
    assert.fail('Expected Loadshare Networks scraper module at ../../scraper/loadsharenetworks/script.js')
  }
}

test('Loadshare Networks local catalog captures the verified official careers page and public SenseHQ board contract', async () => {
  const { LOADSHARE_NETWORKS_CATALOG } = await loadCatalogModule()
  const loadshare = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LOADSHARE_NETWORKS_CATALOG)

  assert.equal(provider.source, 'loadsharenetworks')
  assert.equal(provider.companyName, 'Loadshare Networks')
  assert.equal(provider.officialBrandName, 'LoadShare Networks Pvt. Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://loadshare.net/')
  assert.equal(provider.rootCareersUrl, 'https://careers.loadshare.net/')
  assert.equal(provider.companyCareerPage, 'https://careers.loadshare.net/loadshare/')
  assert.equal(provider.publicBoardUrl, 'https://loadshare.sensehq.com/careers')
  assert.equal(provider.sampleJobUrl, 'https://loadshare.sensehq.com/careers/jobs/54441')
  assert.equal(provider.companyDomain, 'loadshare.net')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-official-careers-page-plus-public-sensehq-board-pagination',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+public-sensehq-next-data-board+india-openings-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /loadsharenetworks[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.loadshare\.net\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.loadshare\.net\/loadshare\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loadshare\.sensehq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /4 public openings/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loadshare\.sensehq\.com\/careers\/jobs\/54441/i)

  assert.equal(loadshare.PROVIDER_METADATA.source, LOADSHARE_NETWORKS_CATALOG.source)
  assert.equal(loadshare.PROVIDER_METADATA.companyName, LOADSHARE_NETWORKS_CATALOG.companyName)
  assert.equal(loadshare.PROVIDER_METADATA.publicBoardUrl, LOADSHARE_NETWORKS_CATALOG.publicBoardUrl)
})

test('Loadshare Networks exact backlog name matches directly from local provider metadata', async () => {
  const { LOADSHARE_NETWORKS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Loadshare Networks\n',
    catalog: [hydrateProviderCatalogEntry(LOADSHARE_NETWORKS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Loadshare Networks', 'loadsharenetworks', 'Loadshare Networks']],
  )
})

test('Loadshare Networks hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { LOADSHARE_NETWORKS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LOADSHARE_NETWORKS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Loadshare Networks')
  assert.equal(provider.companyCareerPage, 'https://careers.loadshare.net/loadshare/')
  assert.equal(provider.companyDomain, 'loadshare.net')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.match(provider.modulePath, /loadsharenetworks[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /loadsharenetworks[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
