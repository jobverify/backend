import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/capestart/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/capestart/catalog.js')
  } catch {
    assert.fail('Expected CapeStart catalog module at ../../scraper/capestart/catalog.js')
  }
}

test('CapeStart local catalog captures the verified first-party Zwayam jobs surface', async () => {
  const { CAPESTART_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CAPESTART_CATALOG)

  assert.equal(defaultCatalog, CAPESTART_CATALOG)
  assert.equal(provider.source, 'capestart')
  assert.equal(provider.companyName, 'CapeStart')
  assert.equal(provider.officialBrandName, 'CapeStart')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.capestart.com/capestart/')
  assert.equal(provider.companyCareerPage, 'https://careers.capestart.com/capestart/jobslist')
  assert.equal(
    provider.zwayamTenantLookupUrl,
    'https://public.zwayam.com/tenant_management/tenant/group?domain_name=careers.capestart.com',
  )
  assert.equal(provider.zwayamTenantGroupId, 'G1')
  assert.equal(provider.zwayamCompanyId, 'MTUzNzE=')
  assert.equal(provider.zwayamDetailCompanyId, '15371')
  assert.equal(provider.zwayamSearchUrl, 'https://public.zwayam.com/jobs/search')
  assert.equal(
    provider.zwayamJobDetailUrl,
    'https://public.zwayam.com/jobs-service/v1/jobs/careersite',
  )
  assert.equal(provider.publicJobBaseUrl, 'https://careers.capestart.com/capestart/jobview')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-zwayam-total-count-plus-page-size')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-shell+verified-zwayam-tenant+public-zwayam-search-api+public-zwayam-detail-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'careers.capestart.com')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedJobCount, 36)
  assert.match(provider.sampleJobUrl, /junior-frontend-developer/i)
  assert.match(provider.dryRunFile, /capestart[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.capestart\.com\/capestart\/jobslist/i)
  assert.match(provider.verifiedSurfaceSummary, /tenant_management\/tenant\/group\?domain_name=careers\.capestart\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /\b36 public jobs\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Junior Frontend Developer/i)
})

test('CapeStart exact backlog row resolves directly from the local provider metadata', async () => {
  const { CAPESTART_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'CapeStart\n',
    catalog: [hydrateProviderCatalogEntry(CAPESTART_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['CapeStart', 'capestart', 'CapeStart']],
  )
})

test('CapeStart hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { CAPESTART_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(CAPESTART_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, CAPESTART_CATALOG.companyCareerPage)
  assert.equal(provider.companyDomain, 'careers.capestart.com')
  assert.equal(provider.atsPlatform, 'zwayam')
  assert.match(provider.modulePath, /capestart[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /capestart[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
