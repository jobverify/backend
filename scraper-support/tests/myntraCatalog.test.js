import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const myntraModulePath = path.resolve(currentDir, '../../scraper/myntra/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/myntra/catalog.js')
  } catch {
    assert.fail('Expected Myntra catalog module at ../../scraper/myntra/catalog.js')
  }
}

const loadMyntraModule = async () => {
  try {
    return await import('../../scraper/myntra/script.js')
  } catch {
    assert.fail('Expected Myntra scraper module at ../../scraper/myntra/script.js')
  }
}

test('Myntra local catalog captures the verified first-party homepage, careers landing, and public jobs API metadata', async () => {
  const { MYNTRA_CATALOG } = await loadCatalogModule()
  const myntra = await loadMyntraModule()
  const provider = hydrateProviderCatalogEntry(MYNTRA_CATALOG)

  assert.equal(provider.source, 'myntra')
  assert.equal(provider.companyName, 'Myntra')
  assert.equal(provider.officialBrandName, 'Myntra')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.myntra.com/')
  assert.equal(provider.officialCareersLandingUrl, 'https://careers.myntra.com/')
  assert.equal(provider.companyCareerPage, 'https://jobs.myntra.com/home')
  assert.equal(
    provider.workspaceBootstrapUrl,
    'https://io.spire2grow.com/ies/v1/p/workspaceId?domain=jobs.myntra.com',
  )
  assert.equal(
    provider.jobsCountUrl,
    'https://io.spire2grow.com/ies/v1/p/requisition/_count',
  )
  assert.equal(
    provider.jobsSearchUrl,
    'https://io.spire2grow.com/ies/v1/p/requisition/_search',
  )
  assert.equal(
    provider.jobsAggregationUrl,
    'https://io.spire2grow.com/ies/v1/p/requisition/aggregation/_search',
  )
  assert.equal(provider.verifiedWorkspaceId, 'MYNTRA-93as3')
  assert.equal(provider.atsPlatform, 'spire2grow-public-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'public-count-plus-paginated-search-api')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-careers-link+verified-first-party-jobs-portal+public-v1-p-workspace-bootstrap+public-requisition-search',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'myntra.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /myntra[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.myntra\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/jobs\.myntra\.com\/home/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/io\.spire2grow\.com\/ies\/v1\/p\/workspaceId\?domain=jobs\.myntra\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /70 total jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Manager - Category Demand Management/i)
  assert.equal(provider.modulePath, myntraModulePath)

  assert.equal(myntra.PROVIDER_METADATA.source, MYNTRA_CATALOG.source)
  assert.equal(myntra.PROVIDER_METADATA.companyName, MYNTRA_CATALOG.companyName)
  assert.equal(
    myntra.PROVIDER_METADATA.workspaceBootstrapUrl,
    MYNTRA_CATALOG.workspaceBootstrapUrl,
  )
})
