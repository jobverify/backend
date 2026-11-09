import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nuventosystems/catalog.js')
  } catch {
    assert.fail('Expected Nuvento Systems catalog module at ../../scraper/nuventosystems/catalog.js')
  }
}

test('Nuvento Systems catalog captures the current first-party careers hub and accordion-based India careers page', async () => {
  const { NUVENTO_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NUVENTO_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, NUVENTO_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'nuventosystems')
  assert.equal(provider.companyName, 'Nuvento Systems')
  assert.equal(provider.officialBrandName, 'Nuvento')
  assert.equal(provider.homepageUrl, 'https://nuvento.com/')
  assert.equal(provider.careersHubUrl, 'https://nuvento.com/careers/')
  assert.equal(provider.companyCareerPage, 'https://nuvento.com/careers/kochi/')
  assert.equal(provider.companyDomain, 'nuvento.com')
  assert.equal(provider.atsPlatform, 'first-party-india-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-india-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-hub+india-careers-page-inline-role-sections',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.verifiedSurfaceSummary, /17 accordion role sections/i)
  assert.match(provider.verifiedSurfaceSummary, /HR Trainee/i)
  assert.equal(
    provider.modulePath,
    path.resolve(currentDir, '../../scraper/nuventosystems/script.js'),
  )
  assert.match(provider.dryRunFile, /nuventosystems[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Nuvento Systems\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
