import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/tecnicsintegrationtechnologies/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/tecnicsintegrationtechnologies/catalog.js')
  } catch {
    assert.fail('Expected Tecnics Integration Technologies catalog module at ../../scraper/tecnicsintegrationtechnologies/catalog.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Tecnics Integration Technologies local catalog captures the current migrated company discovery evidence', async () => {
  const { TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'tecnicsintegrationtechnologies')
  assert.equal(provider.companyName, 'Tecnics Integration Technologies')
  assert.equal(provider.officialBrandName, 'Tecnics')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://tecnics.com/')
  assert.equal(provider.companyCareerPage, 'https://tecnics.com/')
  assert.equal(provider.applyUrl, null)
  assert.equal(provider.atsPlatform, 'official-company-website-discovery-only')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'current-company-pages-and-published-sitemap')
  assert.equal(provider.extractionStrategy, 'verified-company-discovery-without-authoritative-job-inventory')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'tecnics.com')
  assert.equal(provider.verifiedOn, '2026-10-08')
  assert.equal(provider.sourceListingComplete, false)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verificationDisposition, 'current-company-discovery-only-jobs-unverified')
  assert.equal(provider.legacyCareerPage, 'https://tecnics.com/careers/')
  assert.match(provider.verifiedSurfaceSummary, /Discovery-only/i)
  assert.match(provider.verifiedSurfaceSummary, /unknown global and India job counts/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /tecnicsintegrationtechnologies[\\/]jobs\.json$/i)
})

test('Tecnics Integration Technologies exact backlog row resolves from the local provider contract', async () => {
  const { TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Tecnics Integration Technologies\n',
    catalog: [buildCatalogReadyProvider(TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Tecnics Integration Technologies', 'tecnicsintegrationtechnologies', 'Tecnics Integration Technologies']],
  )
})
