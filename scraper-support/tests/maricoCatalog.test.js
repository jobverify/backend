import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/marico/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/marico/catalog.js')
  } catch {
    assert.fail('Expected Marico catalog module at ../../scraper/marico/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/marico/script.js')
  } catch {
    assert.fail('Expected Marico scraper module at ../../scraper/marico/script.js')
  }
}

test('Marico local catalog captures the verified official careers page and public SenseHQ board contract', async () => {
  const { MARICO_CATALOG } = await loadCatalogModule()
  const marico = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MARICO_CATALOG)

  assert.equal(provider.source, 'marico')
  assert.equal(provider.companyName, 'Marico')
  assert.equal(provider.officialBrandName, 'Marico Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://marico.com/')
  assert.equal(provider.companyCareerPage, 'https://marico.com/india/careers/work-with-us')
  assert.equal(provider.publicBoardUrl, 'https://marico.sensehq.com/careers')
  assert.equal(provider.sampleJobUrl, 'https://marico.sensehq.com/careers/jobs/31806')
  assert.equal(provider.companyDomain, 'marico.com')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'verified-official-careers-page-plus-public-sensehq-board-pagination')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-careers-page+public-sensehq-next-data-board+india-openings-only',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.verifiedPublicOpeningCount, 7)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /marico[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/marico\.com\/india\/careers\/work-with-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/marico\.sensehq\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /7 open jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/marico\.sensehq\.com\/careers\/jobs\/31806/i)

  assert.equal(marico.PROVIDER_METADATA.source, MARICO_CATALOG.source)
  assert.equal(marico.PROVIDER_METADATA.companyName, MARICO_CATALOG.companyName)
  assert.equal(marico.PROVIDER_METADATA.publicBoardUrl, MARICO_CATALOG.publicBoardUrl)
})

test('Marico exact backlog row resolves directly from local provider metadata', async () => {
  const { MARICO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Marico\n',
    catalog: [hydrateProviderCatalogEntry(MARICO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Marico', 'marico', 'Marico']],
  )
})

test('Marico hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MARICO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MARICO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Marico')
  assert.equal(provider.companyCareerPage, 'https://marico.com/india/careers/work-with-us')
  assert.equal(provider.companyDomain, 'marico.com')
  assert.equal(provider.atsPlatform, 'sensehq')
  assert.match(provider.modulePath, /marico[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /marico[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
