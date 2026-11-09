import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/loco/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/loco/catalog.js')
  } catch {
    assert.fail('Expected Loco catalog module at ../../scraper/loco/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/loco/script.js')
  } catch {
    assert.fail('Expected Loco scraper module at ../../scraper/loco/script.js')
  }
}

test('Loco local catalog captures the verified exact-name no-public-jobs sentinel state', async () => {
  const { LOCO_CATALOG } = await loadCatalogModule()
  const loco = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LOCO_CATALOG)

  assert.equal(provider.source, 'loco')
  assert.equal(provider.companyName, 'Loco')
  assert.equal(provider.officialBrandName, 'Loco Streaming Ltd')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://loco.com/')
  assert.equal(provider.legacyHomepageUrl, 'https://www.loco.gg/')
  assert.equal(provider.companyCareerPage, 'https://loco.com/')
  assert.equal(provider.termsOfUseUrl, 'https://loco.com/legal/termsOfUse/terms-en.html')
  assert.equal(provider.companyDomain, 'loco.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-legal-page-plus-common-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-exact-name-homepage+verified-legal-company-surface+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-03')
  assert.match(provider.dryRunFile, /loco[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Monday, August 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loco\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.loco\.gg\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loco\.com\/legal\/termsOfUse\/terms-en\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /Loco Streaming Ltd/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loco\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/loco\.com\/jobs/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(loco.PROVIDER_METADATA.source, LOCO_CATALOG.source)
  assert.equal(loco.PROVIDER_METADATA.companyName, LOCO_CATALOG.companyName)
  assert.equal(loco.PROVIDER_METADATA.termsOfUseUrl, LOCO_CATALOG.termsOfUseUrl)
})

test('Loco exact backlog name matches directly from local provider metadata', async () => {
  const { LOCO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Loco\n',
    catalog: [hydrateProviderCatalogEntry(LOCO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Loco', 'loco', 'Loco']],
  )
})

test('Loco hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { LOCO_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LOCO_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Loco')
  assert.equal(provider.companyCareerPage, 'https://loco.com/')
  assert.equal(provider.companyDomain, 'loco.com')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /loco[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /loco[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
