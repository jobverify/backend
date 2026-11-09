import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/destekinfosolutions/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/destekinfosolutions/catalog.js')
  } catch {
    assert.fail('Expected Destek Infosolutions catalog module at ../../scraper/destekinfosolutions/catalog.js')
  }
}

test('Destek Infosolutions local catalog captures the verified no-public-careers contract', async () => {
  const { DESTEK_INFOSOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DESTEK_INFOSOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, DESTEK_INFOSOLUTIONS_CATALOG)
  assert.equal(provider.source, 'destekinfosolutions')
  assert.equal(provider.companyName, 'Destek Infosolutions')
  assert.equal(provider.officialBrandName, 'Destek Infosolutions')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://desteksolutions.com/')
  assert.equal(provider.companyCareerPage, 'https://desteksolutions.com/careers')
  assert.equal(provider.contactPageUrl, 'https://desteksolutions.com/')
  assert.equal(provider.appBundleUrl, 'https://desteksolutions.com/main.js')
  assert.equal(provider.robotsTxtUrl, 'https://desteksolutions.com/robots.txt')
  assert.equal(provider.sitemapUrl, 'https://desteksolutions.com/sitemap.xml')
  assert.equal(provider.companyDomain, 'desteksolutions.com')
  assert.equal(provider.atsPlatform, 'official-company-site-spa-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'homepage-spa-shell-plus-app-bundle-plus-common-missing-routes-validation')
  assert.equal(provider.extractionStrategy, 'verified-homepage-spa-shell+verified-app-bundle+verified-missing-routes-return-empty')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-01')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /destekinfosolutions[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, August 1, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/desteksolutions\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/desteksolutions\.com\/main\.js/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/desteksolutions\.com\/contact/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/desteksolutions\.com\/work-with-us/i)
  assert.match(provider.verifiedSurfaceSummary, /No trustworthy public jobs surface is currently exposed/i)
})

test('Destek Infosolutions exact backlog row resolves from the local provider contract', async () => {
  const { DESTEK_INFOSOLUTIONS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Destek Infosolutions\n',
    catalog: [hydrateProviderCatalogEntry(DESTEK_INFOSOLUTIONS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Destek Infosolutions', 'destekinfosolutions', 'Destek Infosolutions']],
  )
})
