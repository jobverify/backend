import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ecomExpressModulePath = path.resolve(currentDir, '../../scraper/ecomexpress/script.js')

const loadEcomExpressCatalog = async () => {
  try {
    return await import('../../scraper/ecomexpress/catalog.js')
  } catch {
    assert.fail('Expected Ecom Express catalog module at ../../scraper/ecomexpress/catalog.js')
  }
}

const loadEcomExpressModule = async () => {
  try {
    return await import('../../scraper/ecomexpress/script.js')
  } catch {
    assert.fail('Expected Ecom Express scraper module at ../../scraper/ecomexpress/script.js')
  }
}

test('Ecom Express local catalog captures the verified merger landing page and the lack of a trustworthy public jobs surface', async () => {
  const { ECOM_EXPRESS_CATALOG } = await loadEcomExpressCatalog()
  const ecomExpress = await loadEcomExpressModule()

  assert.equal(ECOM_EXPRESS_CATALOG.source, 'ecomexpress')
  assert.equal(ECOM_EXPRESS_CATALOG.companyName, 'Ecom Express')
  assert.equal(ECOM_EXPRESS_CATALOG.officialBrandName, 'Ecom Express')
  assert.equal(ECOM_EXPRESS_CATALOG.adapter, 'script')
  assert.equal(ECOM_EXPRESS_CATALOG.homepageUrl, 'https://www.ecomexpress.in/')
  assert.equal(ECOM_EXPRESS_CATALOG.companyCareerPage, 'https://www.ecomexpress.in/careers/')
  assert.equal(ECOM_EXPRESS_CATALOG.careerPageUrl, 'https://www.ecomexpress.in/careers/')
  assert.deepEqual(ECOM_EXPRESS_CATALOG.checkedLandingPageUrls, [
    'https://www.ecomexpress.in/',
    'https://www.ecomexpress.in/careers/',
    'https://www.ecomexpress.in/jobs/',
    'https://www.ecomexpress.in/career/',
    'https://www.ecomexpress.in/work-with-us/',
  ])
  assert.equal(ECOM_EXPRESS_CATALOG.robotsTxtUrl, 'https://www.ecomexpress.in/robots.txt')
  assert.equal(ECOM_EXPRESS_CATALOG.sitemapUrl, 'https://www.ecomexpress.in/sitemap.xml')
  assert.equal(ECOM_EXPRESS_CATALOG.delhiveryContinueUrl, 'https://www.delhivery.com/')
  assert.equal(ECOM_EXPRESS_CATALOG.companyDomain, 'ecomexpress.in')
  assert.equal(ECOM_EXPRESS_CATALOG.atsPlatform, 'official-company-site-no-public-jobs')
  assert.equal(ECOM_EXPRESS_CATALOG.countryFilter, 'India')
  assert.equal(
    ECOM_EXPRESS_CATALOG.paginationStrategy,
    'static-landing-page-validation-across-common-careers-routes',
  )
  assert.equal(
    ECOM_EXPRESS_CATALOG.extractionStrategy,
    'verified-merger-landing-page+verified-common-careers-routes+verified-robots-and-sitemap-misserve+return-empty',
  )
  assert.equal(ECOM_EXPRESS_CATALOG.parser, 'custom-script')
  assert.equal(ECOM_EXPRESS_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(ECOM_EXPRESS_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(ECOM_EXPRESS_CATALOG.dryRunFile, 'ecomexpress/jobs.json')
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ecomexpress\.in\//i)
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ecomexpress\.in\/careers\//i)
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ecomexpress\.in\/robots\.txt/i)
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.ecomexpress\.in\/sitemap\.xml/i)
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.delhivery\.com\//i)
  assert.match(ECOM_EXPRESS_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(ECOM_EXPRESS_CATALOG.modulePath, ecomExpressModulePath)

  assert.equal(ecomExpress.PROVIDER_METADATA.source, ECOM_EXPRESS_CATALOG.source)
  assert.equal(ecomExpress.PROVIDER_METADATA.companyName, ECOM_EXPRESS_CATALOG.companyName)
  assert.equal(ecomExpress.PROVIDER_METADATA.careerPageUrl, ECOM_EXPRESS_CATALOG.careerPageUrl)
  assert.equal(ecomExpress.PROVIDER_METADATA.delhiveryContinueUrl, ECOM_EXPRESS_CATALOG.delhiveryContinueUrl)
})

test('Ecom Express backlog row hydrates locally without requiring a shared alias entry', async () => {
  const { ECOM_EXPRESS_CATALOG } = await loadEcomExpressCatalog()
  const provider = hydrateProviderCatalogEntry(ECOM_EXPRESS_CATALOG)

  assert.equal(provider.companyName, 'Ecom Express')
  assert.equal(provider.companyDomain, 'ecomexpress.in')
  assert.match(provider.modulePath, /ecomexpress[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /ecomexpress[\\/]jobs\.json$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Ecom Express'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Ecom Express\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Ecom Express', 'ecomexpress', 'Ecom Express']],
  )
})
