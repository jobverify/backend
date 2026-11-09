import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/iprogrammersolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/iprogrammersolutions/catalog.js')
  } catch {
    assert.fail('Expected Iprogrammer Solutions catalog module at ../../scraper/iprogrammersolutions/catalog.js')
  }
}

test('Iprogrammer Solutions local catalog records the redesigned official careers route without claiming unverified inventory', async () => {
  const { IPROGRAMMER_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(IPROGRAMMER_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, IPROGRAMMER_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'iprogrammersolutions')
  assert.equal(provider.companyName, 'Iprogrammer Solutions')
  assert.equal(provider.officialBrandName, 'iProgrammer Solutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://iprogrammer.com/')
  assert.equal(provider.companyCareerPage, 'https://iprogrammer.com/current-openings-pune/')
  assert.equal(provider.companyDomain, 'iprogrammer.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-listing-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-openings-page')
  assert.equal(provider.extractionStrategy, 'job-card-listing-with-detail-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /current-openings/i)
  assert.match(provider.verifiedSurfaceSummary, /redirect.*homepage/i)
  assert.match(provider.verifiedSurfaceSummary, /localhost application URLs/i)
  assert.equal(provider.verificationDisposition, 'official-careers-route-redirects-to-homepage-no-verified-current-inventory')
  assert.equal(Object.hasOwn(provider, 'verifiedPublicJobCount'), false)
  assert.equal(Object.hasOwn(provider, 'verifiedIndiaJobCount'), false)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /iprogrammersolutions[\\/]jobs\.json$/i)
})

test('Iprogrammer Solutions backlog row matches directly from the local catalog', async () => {
  const { IPROGRAMMER_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Iprogrammer Solutions\n',
    catalog: [hydrateProviderCatalogEntry(IPROGRAMMER_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
