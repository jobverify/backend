import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tanlaplatforms/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tanlaplatforms/catalog.js')
  } catch {
    assert.fail('Expected Tanla Platforms catalog module at ../../scraper/tanlaplatforms/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/tanlaplatforms/script.js')
  } catch {
    assert.fail('Expected Tanla Platforms scraper module at ../../scraper/tanlaplatforms/script.js')
  }
}

test('Tanla Platforms local catalog captures the verified first-party careers, listing, and sample detail routes', async () => {
  const { TANLA_PLATFORMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const tanla = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(TANLA_PLATFORMS_CATALOG)

  assert.equal(defaultCatalog, TANLA_PLATFORMS_CATALOG)
  assert.equal(provider.source, 'tanlaplatforms')
  assert.equal(provider.companyName, 'Tanla Platforms')
  assert.equal(provider.officialBrandName, 'Tanla Platforms Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.tanla.com/')
  assert.equal(provider.companyCareerPage, 'https://www.tanla.com/careers')
  assert.equal(provider.officialJobsHandoffUrl, 'https://www.tanla.com/careers/jobs-listing')
  assert.equal(provider.verifiedSampleJobUrl, 'https://www.tanla.com/job-info/sr-qa-automation-engineer')
  assert.equal(provider.companyDomain, 'tanla.com')
  assert.equal(provider.atsPlatform, 'first-party-job-board')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-listing-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-handoff+verified-first-party-jobs-listing+first-party-job-detail-pages',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.dryRunFile, /tanlaplatforms[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tanla\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tanla\.com\/careers\/jobs-listing/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.tanla\.com\/job-info\/sr-qa-automation-engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Sr QA Automation Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /timing out/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tanla Platforms'), false)

  assert.equal(tanla.PROVIDER_METADATA.source, TANLA_PLATFORMS_CATALOG.source)
  assert.equal(tanla.PROVIDER_METADATA.companyName, TANLA_PLATFORMS_CATALOG.companyName)
})

test('Tanla Platforms exact backlog row matches directly from the local provider metadata', async () => {
  const { TANLA_PLATFORMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tanla Platforms\n',
    catalog: [hydrateProviderCatalogEntry(TANLA_PLATFORMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tanla Platforms', 'tanlaplatforms', 'Tanla Platforms']],
  )
})

test('Tanla Platforms hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { TANLA_PLATFORMS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TANLA_PLATFORMS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Tanla Platforms')
  assert.equal(provider.companyCareerPage, 'https://www.tanla.com/careers')
  assert.equal(provider.companyDomain, 'tanla.com')
  assert.equal(provider.atsPlatform, 'first-party-job-board')
  assert.match(provider.modulePath, /tanlaplatforms[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /tanlaplatforms[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
