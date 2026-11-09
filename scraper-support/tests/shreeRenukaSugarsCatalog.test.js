import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const expectedModulePath = path.resolve(currentDir, '../../scraper/shreerenukasugars/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/shreerenukasugars/catalog.js')
  } catch {
    assert.fail('Expected Shree Renuka Sugars catalog module at ../../scraper/shreerenukasugars/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/shreerenukasugars/script.js')
  } catch {
    assert.fail('Expected Shree Renuka Sugars scraper module at ../../scraper/shreerenukasugars/script.js')
  }
}

test('Shree Renuka Sugars local catalog captures the verified first-party inline opportunities page', async () => {
  const { SHREE_RENUKA_SUGARS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const shreeRenukaSugars = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(SHREE_RENUKA_SUGARS_CATALOG)

  assert.equal(defaultCatalog, SHREE_RENUKA_SUGARS_CATALOG)
  assert.equal(provider.source, 'shreerenukasugars')
  assert.equal(provider.companyName, 'Shree Renuka Sugars')
  assert.equal(provider.officialBrandName, 'Shree Renuka Sugars Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://renukasugars.com/')
  assert.equal(provider.companyCareerPage, 'https://renukasugars.com/join-the-team/')
  assert.equal(provider.officialJobBoardUrl, 'https://renukasugars.com/join-the-team/')
  assert.equal(provider.companyDomain, 'renukasugars.com')
  assert.equal(provider.atsPlatform, 'official-company-careers-inline-job-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-static-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-join-the-team-page+inline-opportunities-grid+careers-page-apply-fallback',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /shreerenukasugars[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, expectedModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/renukasugars\.com\/join-the-team\//i)
  assert.match(provider.verifiedSurfaceSummary, /Legal Executive/i)
  assert.match(provider.verifiedSurfaceSummary, /Corporate Communication Head/i)
  assert.match(provider.verifiedSurfaceSummary, /Worli/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Shree Renuka Sugars'), false)

  assert.equal(
    shreeRenukaSugars.PROVIDER_METADATA.source,
    SHREE_RENUKA_SUGARS_CATALOG.source,
  )
  assert.equal(
    shreeRenukaSugars.PROVIDER_METADATA.companyCareerPage,
    SHREE_RENUKA_SUGARS_CATALOG.companyCareerPage,
  )
})

test('Shree Renuka Sugars exact backlog row matches directly from the local provider metadata without aliases', async () => {
  const { SHREE_RENUKA_SUGARS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Shree Renuka Sugars\n',
    catalog: [hydrateProviderCatalogEntry(SHREE_RENUKA_SUGARS_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Shree Renuka Sugars', 'shreerenukasugars', 'Shree Renuka Sugars']],
  )
})
