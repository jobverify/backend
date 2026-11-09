import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const gravitonModulePath = path.resolve(currentDir, '../../scraper/graviton/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/graviton/catalog.js')
  } catch {
    assert.fail('Expected Graviton catalog module at ../../scraper/graviton/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/graviton/script.js')
  } catch {
    assert.fail('Expected Graviton scraper module at ../../scraper/graviton/script.js')
  }
}

test('Graviton local catalog captures the verified first-party careers shell, embedded jobs page, and first-party jobs JSON without alias churn', async () => {
  const { GRAVITON_CATALOG } = await loadCatalogModule()
  const graviton = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(GRAVITON_CATALOG)

  assert.equal(provider.source, 'graviton')
  assert.equal(provider.companyName, 'Graviton')
  assert.equal(provider.officialBrandName, 'Graviton Research Capital LLP')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://www.gravitontrading.com/')
  assert.equal(provider.companyCareerPage, 'https://www.gravitontrading.com/careers')
  assert.equal(provider.embeddedJobsPageUrl, 'https://www.gravitontrading.com/greenhouse-embed-local.html')
  assert.equal(provider.firstPartyJobsJsonUrl, 'https://www.gravitontrading.com/data/greenhouse_jobs.json')
  assert.equal(provider.greenhouseBoardUrl, 'https://boards.greenhouse.io/embed/job_board?for=gravitonresearchcapital')
  assert.equal(provider.companyDomain, 'gravitontrading.com')
  assert.equal(provider.atsPlatform, 'first-party-greenhouse-jobs-json')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-jobs-json-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-first-party-embedded-jobs-page+first-party-jobs-json+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gravitontrading\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gravitontrading\.com\/greenhouse-embed-local\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.gravitontrading\.com\/data\/greenhouse_jobs\.json/i)
  assert.match(provider.verifiedSurfaceSummary, /22 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /16 India/i)
  assert.match(provider.verifiedSurfaceSummary, /Application Reliability Engineer/i)
  assert.match(provider.dryRunFile, /graviton[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /graviton[\\/]script\.js$/i)
  assert.equal(provider.modulePath, gravitonModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Graviton'), false)

  assert.equal(graviton.PROVIDER_METADATA.source, GRAVITON_CATALOG.source)
  assert.equal(graviton.PROVIDER_METADATA.firstPartyJobsJsonUrl, GRAVITON_CATALOG.firstPartyJobsJsonUrl)
  assert.equal(graviton.PROVIDER_METADATA.companyCareerPage, GRAVITON_CATALOG.companyCareerPage)
})

test('Graviton backlog row matches directly from local provider metadata without alias churn', async () => {
  const { GRAVITON_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Graviton\n',
    catalog: [hydrateProviderCatalogEntry(GRAVITON_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Graviton', 'graviton', 'Graviton']],
  )
})
