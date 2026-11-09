import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/jabong/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/jabong/catalog.js')
  } catch {
    assert.fail('Expected Jabong catalog module at ../../scraper/jabong/catalog.js')
  }
}

test('Jabong local catalog captures the verified exact-name broken redirect sentinel surface', async () => {
  const { JABONG_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(JABONG_CATALOG)

  assert.equal(defaultCatalog, JABONG_CATALOG)
  assert.equal(provider.source, 'jabong')
  assert.equal(provider.companyName, 'Jabong')
  assert.equal(provider.officialBrandName, 'Jabong')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.jabong.com/')
  assert.equal(provider.homepageUrl, 'https://www.jabong.com/')
  assert.equal(provider.officialParentRedirectUrl, 'https://www.myntra.com/')
  assert.equal(provider.officialErrorPageUrl, 'https://www.myntra.com/')
  assert.equal(provider.companyDomain, 'jabong.com')
  assert.equal(provider.atsPlatform, 'legacy-first-party-redirect-broken-parent-shell')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-exact-name-host-redirect-plus-broken-parent-shell',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-host-redirect-to-broken-myntra-shell+fail-closed-sentinel',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-17')
  assert.match(provider.dryRunFile, /jabong[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Friday, July 17, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.jabong\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.myntra\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /Oops! Something went wrong/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
})

test('Jabong exact backlog row matches directly from the local provider metadata', async () => {
  const { JABONG_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Jabong\n',
    catalog: [hydrateProviderCatalogEntry(JABONG_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Jabong', 'jabong', 'Jabong']],
  )
})

test('Jabong hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { JABONG_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(JABONG_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Jabong')
  assert.equal(provider.companyCareerPage, 'https://www.jabong.com/')
  assert.equal(provider.companyDomain, 'jabong.com')
  assert.equal(provider.atsPlatform, 'legacy-first-party-redirect-broken-parent-shell')
  assert.match(provider.modulePath, /jabong[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /jabong[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
