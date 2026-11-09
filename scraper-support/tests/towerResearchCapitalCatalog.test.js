import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const towerResearchCapitalModulePath = path.resolve(currentDir, '../../scraper/towerresearchcapital/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/towerresearchcapital/catalog.js')
  } catch {
    assert.fail('Expected Tower Research Capital catalog module at ../../scraper/towerresearchcapital/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/towerresearchcapital/script.js')
  } catch {
    assert.fail('Expected Tower Research Capital scraper module at ../../scraper/towerresearchcapital/script.js')
  }
}

test('Tower Research Capital local catalog captures the verified first-party roles page and Greenhouse API without alias churn', async () => {
  const { TOWER_RESEARCH_CAPITAL_CATALOG } = await loadCatalogModule()
  const towerResearchCapital = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(TOWER_RESEARCH_CAPITAL_CATALOG)

  assert.equal(provider.source, 'towerresearchcapital')
  assert.equal(provider.companyName, 'Tower Research Capital')
  assert.equal(provider.officialBrandName, 'Tower Research Capital')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialHomepageUrl, 'https://tower-research.com/')
  assert.equal(provider.officialCareersLandingUrl, 'https://tower-research.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://tower-research.com/roles/')
  assert.equal(provider.jobDetailsBaseUrl, 'https://www.tower-research.com/open-positions/')
  assert.equal(provider.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/towerresearchcapital/jobs')
  assert.equal(provider.greenhouseBoardEmbedUrl, 'https://boards.greenhouse.io/embed/job_board/js?for=towerresearchcapital')
  assert.equal(provider.companyDomain, 'tower-research.com')
  assert.equal(provider.atsPlatform, 'greenhouse')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-detail-url+primary-or-multi-location-india-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-06')
  assert.match(provider.verifiedSurfaceSummary, /Thursday, August 6, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tower-research\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/tower-research\.com\/roles\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/towerresearchcapital\/jobs\?content=true/i)
  assert.match(provider.verifiedSurfaceSummary, /AI Operations Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /74 jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /India-primary roles or multi-location roles that explicitly include an India office/i)
  assert.match(provider.dryRunFile, /towerresearchcapital[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /towerresearchcapital[\\/]script\.js$/i)
  assert.equal(provider.modulePath, towerResearchCapitalModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Tower Research Capital'), false)

  assert.equal(
    towerResearchCapital.PROVIDER_METADATA.greenhouseJobsApiUrl,
    TOWER_RESEARCH_CAPITAL_CATALOG.greenhouseJobsApiUrl,
  )
  assert.equal(
    towerResearchCapital.PROVIDER_METADATA.companyCareerPage,
    TOWER_RESEARCH_CAPITAL_CATALOG.companyCareerPage,
  )
})

test('Tower Research Capital backlog row matches directly from local provider metadata without alias churn', async () => {
  const { TOWER_RESEARCH_CAPITAL_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tower Research Capital\n',
    catalog: [hydrateProviderCatalogEntry(TOWER_RESEARCH_CAPITAL_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tower Research Capital', 'towerresearchcapital', 'Tower Research Capital']],
  )
})
