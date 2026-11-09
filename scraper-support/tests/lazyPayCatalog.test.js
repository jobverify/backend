import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/lazypay/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/lazypay/catalog.js')
  } catch {
    assert.fail('Expected LazyPay catalog module at ../../scraper/lazypay/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/lazypay/script.js')
  } catch {
    assert.fail('Expected LazyPay scraper module at ../../scraper/lazypay/script.js')
  }
}

test('LazyPay local catalog captures the verified PayU-affiliated no-public-jobs sentinel state', async () => {
  const { LAZYPAY_CATALOG } = await loadCatalogModule()
  const lazypay = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(LAZYPAY_CATALOG)

  assert.equal(provider.source, 'lazypay')
  assert.equal(provider.companyName, 'LazyPay')
  assert.equal(provider.officialBrandName, 'LazyPay Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.lazypay.in/')
  assert.equal(provider.companyCareerPage, 'https://lazypay.in/about-us')
  assert.equal(provider.aboutPageUrl, 'https://lazypay.in/about-us')
  assert.equal(provider.parentCareersUrl, 'https://corporate.payu.in/careers/')
  assert.equal(provider.parentJobBoardUrl, 'https://careers.payu.in/PayU/go/_/514880/')
  assert.equal(provider.companyDomain, 'lazypay.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-about-page-plus-payu-brand-affiliation-plus-common-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-about-page+verified-payu-brand-affiliation+verified-missing-common-job-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /lazypay[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/lazypay\.in\/about-us/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.lazypay\.in\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/corporate\.payu\.in\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/careers\.payu\.in\/PayU\/go\/_\/514880\//i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface on the exact-name LazyPay domain/i)

  assert.equal(lazypay.PROVIDER_METADATA.source, LAZYPAY_CATALOG.source)
  assert.equal(lazypay.PROVIDER_METADATA.companyName, LAZYPAY_CATALOG.companyName)
  assert.equal(lazypay.PROVIDER_METADATA.companyCareerPage, LAZYPAY_CATALOG.companyCareerPage)
})

test('LazyPay exact backlog name matches directly from local provider metadata', async () => {
  const { LAZYPAY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'LazyPay\n',
    catalog: [hydrateProviderCatalogEntry(LAZYPAY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['LazyPay', 'lazypay', 'LazyPay']],
  )
})

test('LazyPay hydrated local catalog stays script-runner compatible for central registry integration', async () => {
  const { LAZYPAY_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(LAZYPAY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'LazyPay')
  assert.equal(provider.companyCareerPage, 'https://lazypay.in/about-us')
  assert.equal(provider.companyDomain, 'lazypay.in')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.modulePath, /lazypay[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /lazypay[\\/]jobs\.json$/i)
  assert.equal(typeof module.run, 'function')
})
