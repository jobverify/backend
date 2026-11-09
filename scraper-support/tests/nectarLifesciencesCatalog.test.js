import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/nectarlifesciences/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/nectarlifesciences/catalog.js')
  } catch {
    assert.fail('Expected Nectar Lifesciences catalog module at ../../scraper/nectarlifesciences/catalog.js')
  }
}

test('Nectar Lifesciences catalog captures the verified first-party empty careers shell', async () => {
  const {
    NECTAR_LIFESCIENCES_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(NECTAR_LIFESCIENCES_CATALOG)

  assert.equal(defaultCatalog, NECTAR_LIFESCIENCES_CATALOG)
  assert.equal(provider.source, 'nectarlifesciences')
  assert.equal(provider.companyName, 'Nectar Lifesciences')
  assert.equal(provider.officialBrandName, 'Nectar Lifesciences Ltd.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.neclife.com/')
  assert.equal(provider.companyCareerPage, 'https://www.neclife.com/careers')
  assert.equal(provider.companyDomain, 'neclife.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-plus-careers-page-shell-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-careers-page-without-public-listings-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.neclife\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.neclife\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public job listings/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /nectarlifesciences[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Nectar Lifesciences'), false)
})

test('Nectar Lifesciences backlog row matches directly from the local catalog metadata', async () => {
  const { NECTAR_LIFESCIENCES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Nectar Lifesciences\n',
    catalog: [NECTAR_LIFESCIENCES_CATALOG],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Nectar Lifesciences', 'nectarlifesciences', 'Nectar Lifesciences']],
  )
})
