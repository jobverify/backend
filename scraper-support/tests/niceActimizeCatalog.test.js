import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/niceactimize/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/niceactimize/catalog.js')
  } catch {
    assert.fail('Expected NICE Actimize catalog module at ../../scraper/niceactimize/catalog.js')
  }
}

test('NICE Actimize local catalog captures the verified first-party handoff and filtered Greenhouse jobs surface', async () => {
  const { NICE_ACTIMIZE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NICE_ACTIMIZE_CATALOG)

  assert.equal(defaultCatalog, NICE_ACTIMIZE_CATALOG)
  assert.equal(provider.source, 'niceactimize')
  assert.equal(provider.companyName, 'NICE Actimize')
  assert.equal(provider.officialBrandName, 'NICE Actimize')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialActimizePageUrl, 'https://www.niceactimize.com/get-in-touch')
  assert.equal(
    provider.companyCareerPage,
    'https://www.nice.com/careers/apply?location=India+-+Pune',
  )
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/nice/jobs?content=true',
  )
  assert.equal(provider.greenhouseBoardHost, 'boards.eu.greenhouse.io')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(
    provider.extractionStrategy,
    'verified-nice-actimize-first-party-handoff+verified-nice-careers-filter-page+greenhouse-board-api+actimize-india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'nice.com')
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.verifiedJobCount, 7)
  assert.match(provider.sampleJobUrl, /boards\.eu\.greenhouse\.io\/nice\/jobs\/4913142101/i)
  assert.match(provider.dryRunFile, /niceactimize[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 13, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.niceactimize\.com\/get-in-touch/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/nice\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /\b7 India\/Pune Actimize roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Tech Manager, Actimize/i)
  assert.match(provider.verifiedSurfaceSummary, /Specialist Product Owner, Actimize \( BFSI, AI\)/i)
})

test('NICE Actimize exact backlog row resolves directly from the local provider metadata', async () => {
  const { NICE_ACTIMIZE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NICE Actimize\n',
    catalog: [hydrateProviderCatalogEntry(NICE_ACTIMIZE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NICE Actimize', 'niceactimize', 'NICE Actimize']],
  )
})

test('NICE Actimize hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { NICE_ACTIMIZE_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NICE_ACTIMIZE_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, NICE_ACTIMIZE_CATALOG.companyCareerPage)
  assert.equal(provider.companyDomain, 'nice.com')
  assert.equal(provider.atsPlatform, 'greenhouse-board-api')
  assert.match(provider.modulePath, /niceactimize[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /niceactimize[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
