import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/technianssoftech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/technianssoftech/catalog.js')
  } catch {
    assert.fail('Expected Technians Softech catalog module at ../../scraper/technianssoftech/catalog.js')
  }
}

test('Technians Softech local catalog captures the verified Nians jobs archive and public WordPress API contract', async () => {
  const { TECHNIANS_SOFTECH_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHNIANS_SOFTECH_CATALOG)

  assert.equal(defaultCatalog, TECHNIANS_SOFTECH_CATALOG)
  assert.equal(provider.source, 'technianssoftech')
  assert.equal(provider.companyName, 'Technians Softech')
  assert.equal(provider.officialBrandName, 'Nians')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://nians.com/')
  assert.equal(provider.companyCareerPage, 'https://nians.com/job/')
  assert.equal(provider.companyDomain, 'nians.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-plus-wordpress-jobs-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-first-party-jobs-archive-plus-paged-wordpress-rest-api',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-career-link+verified-jobs-archive+wp-json-job+embedded-taxonomies+same-domain-job-detail-pages',
  )
  assert.equal(provider.jobsApiUrl, 'https://nians.com/wp-json/wp/v2/job')
  assert.equal(provider.verifiedPublicJobCount, 59)
  assert.equal(provider.verifiedIndiaJobCount, 59)
  assert.equal(provider.verifiedOn, '2026-08-14')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 14, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Technians is now Nians/i)
  assert.match(provider.verifiedSurfaceSummary, /wp-json\/wp\/v2\/job/i)
  assert.match(provider.verifiedSurfaceSummary, /59 live India openings/i)
  assert.match(provider.verifiedSurfaceSummary, /job\/business-head/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /technianssoftech[\\/]jobs\.json$/i)
})

test('Technians Softech exact backlog row resolves from local provider metadata', async () => {
  const { TECHNIANS_SOFTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Technians Softech\n',
    catalog: [hydrateProviderCatalogEntry(TECHNIANS_SOFTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Technians Softech hydrated local catalog stays script-runner compatible', async () => {
  const { TECHNIANS_SOFTECH_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(TECHNIANS_SOFTECH_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(typeof module.run, 'function')
})
