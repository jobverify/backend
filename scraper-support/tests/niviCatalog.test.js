import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const niviModulePath = path.resolve(currentDir, '../../scraper/nivi/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nivi/catalog.js')
  } catch {
    assert.fail('Expected NIVI catalog module at ../../scraper/nivi/catalog.js')
  }
}

test('NIVI local catalog captures the verified first-party no-open-positions careers surface', async () => {
  const {
    NIVI_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NIVI_CATALOG)

  assert.equal(defaultCatalog, NIVI_CATALOG)
  assert.equal(provider.source, 'nivi')
  assert.equal(provider.companyName, 'NIVI')
  assert.equal(provider.officialBrandName, 'Nivi')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://nivi.io/')
  assert.equal(provider.companyCareerPage, 'https://nivi.io/careers')
  assert.equal(provider.companyDomain, 'nivi.io')
  assert.equal(provider.officialAboutUrl, 'https://nivi.io/about')
  assert.equal(provider.clientBundleUrl, 'https://nivi.io/assets/index-tmZUd8-T.js')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-shell-plus-client-bundle-careers-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-shell+verified-about-page-cta+verified-client-bundle-no-open-positions-route-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-21')
  assert.match(provider.verifiedSurfaceSummary, /Friday, August 21, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nivi\.io\/about/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/nivi\.io\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /No Open Positions/i)
  assert.equal(provider.modulePath, niviModulePath)
  assert.match(provider.dryRunFile, /nivi[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NIVI'), false)
})

test('NIVI backlog row matches directly from the local catalog metadata', async () => {
  const { NIVI_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NIVI\n',
    catalog: [NIVI_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NIVI', 'nivi', 'NIVI']],
  )
})
