import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const pocketbaseModulePath = path.resolve(currentDir, '../../scraper/pocketbase/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/pocketbase/catalog.js')
  } catch {
    assert.fail('Expected PocketBase catalog module at ../../scraper/pocketbase/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pocketbase/script.js')
  } catch {
    assert.fail('Expected PocketBase scraper module at ../../scraper/pocketbase/script.js')
  }
}

test('PocketBase local catalog captures the verified open-source no-company-careers contract', async () => {
  const { POCKETBASE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const pocketbase = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(POCKETBASE_CATALOG)

  assert.equal(defaultCatalog, POCKETBASE_CATALOG)
  assert.equal(provider.source, 'pocketbase')
  assert.equal(provider.companyName, 'PocketBase')
  assert.equal(provider.officialBrandName, 'PocketBase')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://pocketbase.io/')
  assert.equal(provider.companyCareerPage, null)
  assert.equal(provider.faqPageUrl, 'https://pocketbase.io/faq/')
  assert.equal(provider.companyDomain, 'pocketbase.io')
  assert.equal(provider.atsPlatform, 'open-source-project-no-company-careers')
  assert.equal(provider.countryFilter, 'Global')
  assert.equal(provider.paginationStrategy, 'verified-homepage-plus-faq-route-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-faq-personal-open-source-project-statement+return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-25')
  assert.match(provider.modulePath, /pocketbase[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /pocketbase[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 25, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pocketbase\.io\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/pocketbase\.io\/faq\//i)
  assert.match(provider.verifiedSurfaceSummary, /Open Source backend in 1 file/i)
  assert.match(provider.verifiedSurfaceSummary, /neither a startup, nor a business/i)
  assert.match(provider.verifiedSurfaceSummary, /no paid team or company behind it/i)
  assert.match(provider.verifiedSurfaceSummary, /personal open source project/i)
  assert.equal(provider.modulePath, pocketbaseModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'PocketBase'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Pocketbase'), false)

  assert.equal(pocketbase.PROVIDER_METADATA.source, POCKETBASE_CATALOG.source)
  assert.equal(pocketbase.PROVIDER_METADATA.companyName, POCKETBASE_CATALOG.companyName)
  assert.equal(pocketbase.PROVIDER_METADATA.faqPageUrl, POCKETBASE_CATALOG.faqPageUrl)
})

test('Pocketbase backlog row matches directly from the local catalog without alias changes', async () => {
  const { POCKETBASE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nPocketbase\n',
    catalog: [hydrateProviderCatalogEntry(POCKETBASE_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Pocketbase', 'pocketbase', 'PocketBase']],
  )
})

test('getScraperCatalog includes PocketBase as a verified no-company-careers sentinel provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'pocketbase')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'PocketBase')
  assert.equal(provider.companyCareerPage, null)
  assert.equal(provider.faqPageUrl, 'https://pocketbase.io/faq/')
  assert.equal(provider.companyDomain, 'pocketbase.io')
  assert.equal(provider.atsPlatform, 'open-source-project-no-company-careers')
  assert.match(provider.modulePath, /pocketbase[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable PocketBase scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'pocketbase')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'pocketbase')
  assert.equal(scraper.provider.atsPlatform, 'open-source-project-no-company-careers')
  assert.match(scraper.dryRunFile, /pocketbase[\\/]jobs\.json$/i)
})
