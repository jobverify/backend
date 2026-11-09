import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sigmoid/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sigmoid/catalog.js')
  } catch {
    assert.fail('Expected Sigmoid catalog module at ../../scraper/sigmoid/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/sigmoid/script.js')
  } catch {
    assert.fail('Expected Sigmoid scraper module at ../../scraper/sigmoid/script.js')
  }
}

test('Sigmoid local catalog captures the verified first-party careers handoff and Greenhouse board contract', async () => {
  const { SIGMOID_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const sigmoid = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SIGMOID_CATALOG)

  assert.equal(defaultCatalog, SIGMOID_CATALOG)
  assert.equal(provider.source, 'sigmoid')
  assert.equal(provider.companyName, 'Sigmoid')
  assert.equal(provider.officialBrandName, 'Sigmoid')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://www.sigmoid.com/')
  assert.equal(provider.companyCareerPage, 'https://www.sigmoid.com/careers/')
  assert.equal(provider.officialCurrentOpeningsUrl, 'https://www.sigmoid.com/careers/current-openings/')
  assert.equal(provider.greenhouseBoardUrl, 'https://job-boards.greenhouse.io/sigmoid')
  assert.equal(
    provider.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/sigmoid/jobs?content=true',
  )
  assert.equal(provider.companyDomain, 'sigmoid.com')
  assert.equal(provider.verifiedPublicRoleCount, 44)
  assert.equal(provider.verifiedIndiaRoleCount, 39)
  assert.equal(provider.verifiedSampleJobTitle, 'Assistant Manager - Business Insight & Analytics')
  assert.equal(provider.verifiedSampleSecondaryJobTitle, 'Associate Director - Corporate Finance / FP&A')
  assert.equal(provider.verifiedSampleJobUrl, 'https://job-boards.greenhouse.io/sigmoid/jobs/8456380002')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-current-openings-page+greenhouse-jobs-api+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-19')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sigmoid[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 19, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sigmoid\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.sigmoid\.com\/careers\/current-openings\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/sigmoid\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /\b44 public roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\b39 India roles\b/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Sigmoid'), false)

  assert.equal(sigmoid.PROVIDER_METADATA.source, SIGMOID_CATALOG.source)
  assert.equal(sigmoid.PROVIDER_METADATA.greenhouseJobsApiUrl, SIGMOID_CATALOG.greenhouseJobsApiUrl)
})

test('Sigmoid exact backlog row matches directly from local provider metadata without aliases', async () => {
  const { SIGMOID_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Sigmoid\n',
    catalog: [hydrateProviderCatalogEntry(SIGMOID_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sigmoid', 'sigmoid', 'Sigmoid']],
  )
})

test('Sigmoid hydrated local catalog stays script-runner compatible for later shared-registry integration', async () => {
  const { SIGMOID_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SIGMOID_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.match(provider.modulePath, /sigmoid[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /sigmoid[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
