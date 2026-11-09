import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fabHotelsModulePath = path.resolve(currentDir, '../../scraper/fabhotels/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fabhotels/catalog.js')
  } catch {
    assert.fail('Expected FabHotels catalog module at ../../scraper/fabhotels/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fabhotels/script.js')
  } catch {
    assert.fail('Expected FabHotels scraper module at ../../scraper/fabhotels/script.js')
  }
}

test('FabHotels local catalog captures the verified first-party careers listing and detail contract', async () => {
  const { FAB_HOTELS_CATALOG } = await loadCatalogModule()
  const fabHotels = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(FAB_HOTELS_CATALOG)

  assert.equal(provider.source, 'fabhotels')
  assert.equal(provider.companyName, 'FabHotels')
  assert.equal(provider.officialBrandName, 'FabHotels')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.fabhotels.com/')
  assert.equal(provider.companyCareerPage, 'https://www.fabhotels.com/careers/')
  assert.equal(provider.applicationEmail, 'jobs@fabhotels.com')
  assert.equal(provider.applicationUrl, 'mailto:jobs@fabhotels.com')
  assert.deepEqual(provider.verifiedRoleUrls, [
    'https://www.fabhotels.com/careers/FS-TECH-P1',
    'https://www.fabhotels.com/careers/CS-B2B-P1',
    'https://www.fabhotels.com/careers/BA-RP-P1',
    'https://www.fabhotels.com/careers/TT-TA-P4',
    'https://www.fabhotels.com/careers/UX-DD-P1',
    'https://www.fabhotels.com/careers/TA-SA-P1',
  ])
  assert.equal(
    provider.verifiedJobDetailExampleUrl,
    'https://www.fabhotels.com/careers/FS-TECH-P1',
  )
  assert.equal(
    provider.verifiedSecondJobDetailExampleUrl,
    'https://www.fabhotels.com/careers/UX-DD-P1',
  )
  assert.equal(provider.companyDomain, 'fabhotels.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-listing-page-plus-same-domain-detail-pages',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-listing-page+same-domain-detail-pages+first-party-email-apply',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-15')
  assert.equal(provider.modulePath, fabHotelsModulePath)
  assert.match(provider.dryRunFile, /fabhotels[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabhotels\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabhotels\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabhotels\.com\/careers\/FS-TECH-P1/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabhotels\.com\/careers\/UX-DD-P1/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.fabhotels\.com\/careers\/TA-SA-P1/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs@fabhotels\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /\bsix\b/i)

  assert.equal(fabHotels.PROVIDER_METADATA.source, provider.source)
  assert.equal(fabHotels.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(fabHotels.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('FabHotels exact backlog row matches directly from the local provider contract without an alias entry', async () => {
  const { FAB_HOTELS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'FabHotels\n',
    catalog: [hydrateProviderCatalogEntry(FAB_HOTELS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['FabHotels', 'fabhotels', 'FabHotels']],
  )
})
