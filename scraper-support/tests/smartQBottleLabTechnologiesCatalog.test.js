import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smartqbottlelabtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smartqbottlelabtechnologies/catalog.js')
  } catch {
    assert.fail('Expected SmartQ - Bottle Lab Technologies catalog module at ../../scraper/smartqbottlelabtechnologies/catalog.js')
  }
}

test('SmartQ - Bottle Lab Technologies local catalog captures the verified first-party SmartQ page plus public zwayam board contract', async () => {
  const { SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'smartqbottlelabtechnologies')
  assert.equal(provider.companyName, 'SmartQ - Bottle Lab Technologies')
  assert.equal(provider.officialBrandName, 'SmartQ')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.thesmartq.com/')
  assert.equal(provider.companyCareerPage, 'https://www.thesmartq.com/careers')
  assert.equal(provider.jobsBoardUrl, 'https://careers.thesmartq.com/thesmartq/')
  assert.equal(
    provider.tenantLookupUrl,
    'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.thesmartq.com',
  )
  assert.equal(provider.zwayamTenantGroupId, 'G1')
  assert.equal(provider.zwayamCompanyId, 'MTU0ODE=')
  assert.equal(provider.zwayamDetailCompanyId, '15481')
  assert.equal(provider.searchApiUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(provider.detailApiUrl, 'https://public.zwayam.com/jobs-service/v1/jobs/careersite')
  assert.equal(provider.jobViewBaseUrl, 'https://careers.thesmartq.com/thesmartq/jobview')
  assert.equal(provider.companyDomain, 'thesmartq.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-zwayam-search-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'zwayam-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+verified-zwayam-tenant+public-zwayam-search-api+public-zwayam-detail-api+india-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-04')
  assert.equal(provider.verifiedPublicJobCount, 87)
  assert.equal(provider.verifiedIndiaJobCount, 87)
  assert.equal(
    provider.verifiedSampleJobUrl,
    'https://careers.thesmartq.com/thesmartq/jobview/key-account-manager-bangalore-karnataka-india-2026080410573840?id=1153661',
  )
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Tuesday, August 4, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /tenantGroupId G1/i)
  assert.match(provider.verifiedSurfaceSummary, /87 India jobs/i)
})

test('SmartQ - Bottle Lab Technologies exact backlog row matches from the local catalog entry', async () => {
  const { SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SmartQ - Bottle Lab Technologies\n',
    catalog: [hydrateProviderCatalogEntry(SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('SmartQ - Bottle Lab Technologies hydrated local catalog stays script-runner compatible', async () => {
  const { SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMARTQ_BOTTLE_LAB_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.match(provider.modulePath, /smartqbottlelabtechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
