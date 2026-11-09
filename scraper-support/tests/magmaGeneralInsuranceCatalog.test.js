import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/magmageneralinsurance/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/magmageneralinsurance/catalog.js')
  } catch {
    assert.fail('Expected Magma General Insurance catalog module at ../../scraper/magmageneralinsurance/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/magmageneralinsurance/script.js')
  } catch {
    assert.fail('Expected Magma General Insurance scraper module at ../../scraper/magmageneralinsurance/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Magma General Insurance local catalog captures the verified first-party careers form sentinel', async () => {
  const { MAGMA_GENERAL_INSURANCE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const magma = await loadScriptModule()
  const provider = buildCatalogReadyProvider(MAGMA_GENERAL_INSURANCE_CATALOG)

  assert.equal(defaultCatalog, MAGMA_GENERAL_INSURANCE_CATALOG)
  assert.equal(provider.source, 'magmageneralinsurance')
  assert.equal(provider.companyName, 'Magma General Insurance')
  assert.equal(provider.officialBrandName, 'Magma Insurance')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.magmainsurance.com/')
  assert.equal(provider.companyCareerPage, 'https://www.magmainsurance.com/fi/more/career')
  assert.equal(provider.alternateCareerPageUrl, 'https://www.magmainsurance.com/career')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'validated-first-party-careers-form-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-primary-and-alternate-careers-form-pages+no-public-role-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'magmainsurance.com')
  assert.equal(provider.verifiedOn, '2026-08-15')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 15, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.magmainsurance\.com\/fi\/more\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.magmainsurance\.com\/career/i)
  assert.match(provider.verifiedSurfaceSummary, /time out/i)
  assert.match(provider.verifiedSurfaceSummary, /http 503/i)
  assert.match(provider.verifiedSurfaceSummary, /temporarily unavailable from this environment/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /magmageneralinsurance[\\/]jobs\.json$/i)

  assert.equal(magma.PROVIDER_METADATA.source, provider.source)
  assert.equal(magma.PROVIDER_METADATA.companyName, provider.companyName)
  assert.equal(magma.PROVIDER_METADATA.companyCareerPage, provider.companyCareerPage)
})

test('Magma General Insurance exact backlog row resolves from the local provider contract without alias churn', async () => {
  const { MAGMA_GENERAL_INSURANCE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Magma General Insurance\n',
    catalog: [buildCatalogReadyProvider(MAGMA_GENERAL_INSURANCE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Magma General Insurance', 'magmageneralinsurance', 'Magma General Insurance']],
  )
})
