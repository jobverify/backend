import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/mokobara/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/mokobara/catalog.js')
  } catch {
    assert.fail('Expected Mokobara catalog module at ../../scraper/mokobara/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/mokobara/script.js')
  } catch {
    assert.fail('Expected Mokobara scraper module at ../../scraper/mokobara/script.js')
  }
}

test('Mokobara local catalog captures the verified first-party no-public-jobs sentinel state', async () => {
  const { MOKOBARA_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const mokobara = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(MOKOBARA_CATALOG)

  assert.equal(defaultCatalog, MOKOBARA_CATALOG)
  assert.equal(provider.source, 'mokobara')
  assert.equal(provider.companyName, 'Mokobara')
  assert.equal(provider.officialBrandName, 'Mokobara Lifestyle Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://mokobara.com/')
  assert.equal(provider.companyCareerPage, 'https://mokobara.com/apps/frequently-asked-questions')
  assert.equal(provider.faqUrl, 'https://mokobara.com/apps/frequently-asked-questions')
  assert.equal(provider.applicationEmail, 'careers@mokobara.com')
  assert.equal(provider.applicationUrl, 'mailto:careers@mokobara.com')
  assert.deepEqual(provider.noPublicCareerRouteUrls, [
    'https://mokobara.com/pages/careers',
    'https://mokobara.com/careers',
  ])
  assert.equal(provider.companyDomain, 'mokobara.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-footer-plus-faq-email-plus-careers-route-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage-footer+verified-faq-email-handoff+verified-no-public-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /mokobara[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mokobara\.com\/apps\/frequently-asked-questions/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@mokobara\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mokobara\.com\/pages\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/mokobara\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(mokobara.PROVIDER_METADATA.source, MOKOBARA_CATALOG.source)
  assert.equal(mokobara.PROVIDER_METADATA.companyName, MOKOBARA_CATALOG.companyName)
  assert.equal(mokobara.PROVIDER_METADATA.companyCareerPage, MOKOBARA_CATALOG.companyCareerPage)
})

test('Mokobara exact backlog name matches directly from local provider metadata', async () => {
  const { MOKOBARA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Mokobara\n',
    catalog: [hydrateProviderCatalogEntry(MOKOBARA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Mokobara', 'mokobara', 'Mokobara']],
  )
})

test('Mokobara hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { MOKOBARA_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(MOKOBARA_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Mokobara')
  assert.equal(provider.companyCareerPage, 'https://mokobara.com/apps/frequently-asked-questions')
  assert.equal(provider.companyDomain, 'mokobara.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /mokobara[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /mokobara[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
