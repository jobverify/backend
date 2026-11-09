import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const planfulModulePath = path.resolve(currentDir, '../../scraper/planful/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/planful/catalog.js')
  } catch {
    assert.fail('Expected Planful catalog module at ../../scraper/planful/catalog.js')
  }
}

const loadPlanfulModule = async () => {
  try {
    return await import('../../scraper/planful/script.js')
  } catch {
    assert.fail('Expected Planful scraper module at ../../scraper/planful/script.js')
  }
}

test('Planful local catalog captures the verified first-party Planful careers pages and current India Greenhouse surface', async () => {
  const { PLANFUL_CATALOG } = await loadCatalogModule()
  const planful = await loadPlanfulModule()
  const provider = hydrateProviderCatalogEntry(PLANFUL_CATALOG)

  assert.equal(provider.source, 'planful')
  assert.equal(provider.companyName, 'Planful')
  assert.equal(provider.officialBrandName, 'Planful')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://planful.com/jobs/careers-list/')
  assert.equal(provider.officialCareersLandingUrl, 'https://planful.com/jobs/')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/hostanalytics/jobs')
  assert.equal(provider.verifiedPublicJobCount, 12)
  assert.equal(provider.verifiedIndiaJobCount, 0)
  assert.equal(provider.verifiedSampleJobTitle, 'Customer Success Advocate')
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://planful.com/jobs/careers-list/?gh_jid=8644621002',
  )
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url-preservation+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'planful.com')
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.equal(provider.modulePath, planfulModulePath)
  assert.match(provider.dryRunFile, /planful[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/planful\.com\/jobs\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/planful\.com\/jobs\/careers-list\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/hostanalytics\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /0 India roles/i)
  assert.equal(companyAliases['Planful India'], 'planful')

  assert.equal(planful.PROVIDER_METADATA.source, PLANFUL_CATALOG.source)
  assert.equal(planful.PROVIDER_METADATA.companyName, PLANFUL_CATALOG.companyName)
  assert.equal(
    planful.PROVIDER_METADATA.greenhouseJobsApiUrl,
    PLANFUL_CATALOG.greenhouseJobsApiUrl,
  )
})

test('getScraperCatalog and shared aliases resolve both Planful backlog rows to the same provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'planful')
  const scraper = buildScrapers().find((item) => item.name === 'planful')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Planful')
  assert.equal(provider.companyCareerPage, 'https://planful.com/jobs/careers-list/')
  assert.equal(companyAliases['Planful India'], 'planful')

  const report = generateCompanyCoverageReport({
    csvText: 'Planful\nPlanful India\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 2)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [
      ['Planful', 'planful', 'Planful'],
      ['Planful India', 'planful', 'Planful'],
    ],
  )
})
