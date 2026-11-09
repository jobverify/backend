import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/symphony/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/symphony/catalog.js')
  } catch {
    assert.fail('Expected Symphony catalog module at ../../scraper/symphony/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/symphony/script.js')
  } catch {
    assert.fail('Expected Symphony scraper module at ../../scraper/symphony/script.js')
  }
}

test('Symphony local catalog captures the verified first-party no-openings sentinel without alias churn', async () => {
  const { SYMPHONY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const symphony = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SYMPHONY_CATALOG)

  assert.equal(defaultCatalog, SYMPHONY_CATALOG)
  assert.equal(provider.source, 'symphony')
  assert.equal(provider.companyName, 'Symphony')
  assert.equal(provider.officialBrandName, 'Symphony Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://symphonylimited.com/careers/current-openings/')
  assert.equal(provider.officialCareersPageUrl, 'https://symphonylimited.com/careers/current-openings/')
  assert.equal(provider.officialCareersLandingUrl, 'https://symphonylimited.com/careers/')
  assert.equal(provider.companyDomain, 'symphonylimited.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-no-current-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-verified-careers-page-no-openings-sentinel')
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+no-openings-banner+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-05')
  assert.match(provider.dryRunFile, /symphony[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Wednesday, August 5, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/symphonylimited\.com\/careers\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /There are no current openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Symphony'), false)

  assert.equal(symphony.PROVIDER_METADATA.source, SYMPHONY_CATALOG.source)
  assert.equal(symphony.PROVIDER_METADATA.companyName, SYMPHONY_CATALOG.companyName)
})

test('Symphony exact backlog row matches directly from the local provider metadata', async () => {
  const { SYMPHONY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Symphony\n',
    catalog: [hydrateProviderCatalogEntry(SYMPHONY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Symphony', 'symphony', 'Symphony']],
  )
})

test('Symphony hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SYMPHONY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SYMPHONY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Symphony')
  assert.equal(provider.companyCareerPage, 'https://symphonylimited.com/careers/current-openings/')
  assert.equal(provider.companyDomain, 'symphonylimited.com')
  assert.equal(provider.atsPlatform, 'official-careers-page-no-current-openings')
  assert.match(provider.modulePath, /symphony[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /symphony[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
