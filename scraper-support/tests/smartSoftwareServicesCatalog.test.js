import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/smartsoftwareservices/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/smartsoftwareservices/catalog.js')
  } catch {
    assert.fail('Expected Smart Software Services catalog module at ../../scraper/smartsoftwareservices/catalog.js')
  }
}

test('Smart Software Services local catalog captures the verified first-party role-card careers surface', async () => {
  const { SMART_SOFTWARE_SERVICES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SMART_SOFTWARE_SERVICES_CATALOG)

  assert.equal(defaultCatalog, SMART_SOFTWARE_SERVICES_CATALOG)
  assert.equal(provider.source, 'smartsoftwareservices')
  assert.equal(provider.companyName, 'Smart Software Services(I)')
  assert.equal(provider.officialBrandName, 'Smart Software Services')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://smartsoftwareservices.com/')
  assert.equal(provider.companyCareerPage, 'https://smartsoftwareservices.com/careers')
  assert.equal(provider.companyDomain, 'smartsoftwareservices.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-site')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page-with-visible-role-cards')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-role-cards+in-page-application-modal',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-27')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /smartsoftwareservices[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Monday, July 27, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/smartsoftwareservices\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /\b4 open roles\b/i)
  assert.match(provider.verifiedSurfaceSummary, /QA Automation Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Frontend Developer \(React \/ Next\.js\)/i)
  assert.match(provider.verifiedSurfaceSummary, /Backend Developer \(Node\.js\)/i)
  assert.match(provider.verifiedSurfaceSummary, /UI\/UX Designer/i)
  assert.match(provider.verifiedSurfaceSummary, /in-page application modal/i)
})

test('Smart Software Services exact backlog row still resolves from the refreshed local provider contract', async () => {
  const { SMART_SOFTWARE_SERVICES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Smart Software Services(I)\n',
    catalog: [hydrateProviderCatalogEntry(SMART_SOFTWARE_SERVICES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
