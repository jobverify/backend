import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/rapid7india/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/rapid7india/catalog.js')
  } catch {
    assert.fail('Expected Rapid7 India catalog module at ../../scraper/rapid7india/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/rapid7india/script.js')
  } catch {
    assert.fail('Expected Rapid7 India scraper module at ../../scraper/rapid7india/script.js')
  }
}

test('Rapid7 India local catalog captures the verified first-party Rapid7 search page and current empty India slice state', async () => {
  const { RAPID7_INDIA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const rapid7India = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(RAPID7_INDIA_CATALOG)

  assert.equal(defaultCatalog, RAPID7_INDIA_CATALOG)
  assert.equal(provider.source, 'rapid7india')
  assert.equal(provider.companyName, 'Rapid7 India')
  assert.equal(provider.officialBrandName, 'Rapid7')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://careers.rapid7.com/jobs/search')
  assert.equal(provider.officialCareersPageUrl, 'https://careers.rapid7.com/jobs/search')
  assert.equal(provider.companyDomain, 'rapid7.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'first-party-search-page-pagination-plus-india-location-filter',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-search-page+server-rendered-job-table+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /rapid7india[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.rapid7\.com\/jobs\/search/i)
  assert.match(provider.verifiedSurfaceSummary, /\b6\b/i)
  assert.match(provider.verifiedSurfaceSummary, /Channel Account Manager/i)
  assert.match(provider.verifiedSurfaceSummary, /Vice President, Artificial Intelligence/i)
  assert.match(provider.verifiedSurfaceSummary, /no India roles/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Rapid7 India'), false)

  assert.equal(rapid7India.PROVIDER_METADATA.source, RAPID7_INDIA_CATALOG.source)
  assert.equal(
    rapid7India.PROVIDER_METADATA.companyName,
    RAPID7_INDIA_CATALOG.companyName,
  )
})

test('Rapid7 India exact backlog row matches directly from local provider metadata', async () => {
  const { RAPID7_INDIA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Rapid7 India\n',
    catalog: [hydrateProviderCatalogEntry(RAPID7_INDIA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Rapid7 India', 'rapid7india', 'Rapid7 India']],
  )
})

test('Rapid7 India hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { RAPID7_INDIA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(RAPID7_INDIA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Rapid7 India')
  assert.equal(provider.companyCareerPage, 'https://careers.rapid7.com/jobs/search')
  assert.equal(provider.companyDomain, 'rapid7.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.match(provider.modulePath, /rapid7india[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /rapid7india[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
