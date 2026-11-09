import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/marolixtechnologysolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/marolixtechnologysolutions/catalog.js')
  } catch {
    assert.fail('Expected Marolix Technology Solutions catalog module at ../../scraper/marolixtechnologysolutions/catalog.js')
  }
}

test('Marolix Technology Solutions local catalog captures the verified no-public-careers contract', async () => {
  const { MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'marolixtechnologysolutions')
  assert.equal(provider.companyName, 'Marolix Technology Solutions')
  assert.equal(provider.officialBrandName, 'Marolix Technology Solutions Pvt Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.marolix.com/')
  assert.equal(provider.companyCareerPage, 'https://www.marolix.com/careers')
  assert.equal(provider.contactPageUrl, 'https://www.marolix.com/contact-us')
  assert.equal(provider.companyDomain, 'marolix.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-contact-plus-common-careers-route-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage-or-cloudflare-origin-outage+verified-contact-or-cloudflare-origin-outage+verified-missing-careers-route-or-cloudflare-origin-outage-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /marolixtechnologysolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.marolix\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.marolix\.com\/contact-us/i)
  assert.match(provider.verifiedSurfaceSummary, /522 Connection timed out/i)
  assert.match(provider.verifiedSurfaceSummary, /523 Origin is unreachable/i)
})

test('Marolix Technology Solutions exact backlog row resolves from the local provider contract', async () => {
  const { MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Marolix Technology Solutions\n',
    catalog: [hydrateProviderCatalogEntry(MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Marolix Technology Solutions', 'marolixtechnologysolutions', 'Marolix Technology Solutions']],
  )
})
