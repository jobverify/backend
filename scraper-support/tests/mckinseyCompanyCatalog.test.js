import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mckinseycompany/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mckinseycompany/catalog.js')
  } catch {
    assert.fail('Expected McKinsey & Company catalog module at ../../scraper/mckinseycompany/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mckinseycompany/script.js')
  } catch {
    assert.fail('Expected McKinsey & Company scraper module at ../../scraper/mckinseycompany/script.js')
  }
}

test('McKinsey & Company local catalog captures the verified India careers handoff plus public jobs API contract', async () => {
  const { MCKINSEY_COMPANY_CATALOG } = await loadCatalogModule()
  const mckinseyCompany = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MCKINSEY_COMPANY_CATALOG)

  assert.equal(provider.source, 'mckinseycompany')
  assert.equal(provider.companyName, 'McKinsey & Company')
  assert.equal(provider.officialBrandName, 'McKinsey & Company')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mckinsey.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mckinsey.com/in/careers-in-india')
  assert.equal(provider.officialGlobalCareersUrl, 'https://www.mckinsey.com/careers/')
  assert.equal(provider.publicJobsSearchUrl, 'https://www.mckinsey.com/careers/search-jobs/en')
  assert.equal(
    provider.publicSearchApiUrl,
    'https://gateway.mckinsey.com/apigw-x0cceuow60/v1/api/jobs/search',
  )
  assert.equal(provider.searchPageSize, 20)
  assert.equal(provider.companyDomain, 'mckinsey.com')
  assert.equal(provider.atsPlatform, 'mckinsey-careers-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'public-search-api-start-offset-pagination-until-empty-page',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-india-careers-page+public-search-api+india-location-pair-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mckinseycompany[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mckinsey\.com\/in\/careers-in-india/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.mckinsey\.com\/careers\/search-jobs\/en/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/gateway\.mckinsey\.com\/apigw-x0cceuow60\/v1\/api\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /Business Analyst Intern/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'McKinsey & Company'), false)

  assert.equal(
    mckinseyCompany.PROVIDER_METADATA.source,
    MCKINSEY_COMPANY_CATALOG.source,
  )
  assert.equal(
    mckinseyCompany.PROVIDER_METADATA.companyName,
    MCKINSEY_COMPANY_CATALOG.companyName,
  )
  assert.equal(
    mckinseyCompany.PROVIDER_METADATA.publicSearchApiUrl,
    MCKINSEY_COMPANY_CATALOG.publicSearchApiUrl,
  )
})

test('McKinsey & Company backlog row matches directly from the local catalog without alias churn', async () => {
  const { MCKINSEY_COMPANY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'McKinsey & Company\n',
    catalog: [hydrateProviderCatalogEntry(MCKINSEY_COMPANY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['McKinsey & Company', 'mckinseycompany', 'McKinsey & Company']],
  )
})
