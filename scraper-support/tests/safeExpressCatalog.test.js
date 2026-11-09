import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/safeexpress/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/safeexpress/catalog.js')
  } catch {
    assert.fail('Expected SafeExpress catalog module at ../../scraper/safeexpress/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/safeexpress/script.js')
  } catch {
    assert.fail('Expected SafeExpress scraper module at ../../scraper/safeexpress/script.js')
  }
}

test('SafeExpress local catalog captures the verified first-party no-public-careers sentinel surface without alias churn', async () => {
  const { SAFEEXPRESS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const safeExpress = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SAFEEXPRESS_CATALOG)

  assert.equal(defaultCatalog, SAFEEXPRESS_CATALOG)
  assert.equal(provider.source, 'safeexpress')
  assert.equal(provider.companyName, 'SafeExpress')
  assert.equal(provider.officialBrandName, 'SAFE EXPRESS')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.safeexpress.in/')
  assert.equal(provider.companyCareerPage, 'https://www.safeexpress.in/')
  assert.equal(provider.verifiedContactPageUrl, 'https://www.safeexpress.in/contact.html')
  assert.equal(provider.companyDomain, 'safeexpress.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'static-homepage-plus-contact-page-validation')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-contact-page+no-public-careers-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /safeexpress[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.safeexpress\.in\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.safeexpress\.in\/contact\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'SafeExpress'), false)

  assert.equal(safeExpress.PROVIDER_METADATA.source, SAFEEXPRESS_CATALOG.source)
  assert.equal(safeExpress.PROVIDER_METADATA.companyName, SAFEEXPRESS_CATALOG.companyName)
  assert.equal(safeExpress.PROVIDER_METADATA.verifiedContactPageUrl, SAFEEXPRESS_CATALOG.verifiedContactPageUrl)
})

test('SafeExpress backlog row matches directly from the local catalog without alias churn', async () => {
  const { SAFEEXPRESS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'SafeExpress\n',
    catalog: [hydrateProviderCatalogEntry(SAFEEXPRESS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['SafeExpress', 'safeexpress', 'SafeExpress']],
  )
})

test('SafeExpress hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { SAFEEXPRESS_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(SAFEEXPRESS_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'SafeExpress')
  assert.equal(provider.companyCareerPage, 'https://www.safeexpress.in/')
  assert.equal(provider.companyDomain, 'safeexpress.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /safeexpress[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /safeexpress[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
