import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const amicorpModulePath = path.resolve(currentDir, '../../scraper/amicorp/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/amicorp/catalog.js')
  } catch {
    assert.fail('Expected Amicorp catalog module at ../../scraper/amicorp/catalog.js')
  }
}

const loadAmicorpModule = async () => {
  try {
    return await import('../../scraper/amicorp/script.js')
  } catch {
    assert.fail('Expected Amicorp scraper module at ../../scraper/amicorp/script.js')
  }
}

test('Amicorp local catalog captures the verified first-party careers hub and detail-page surface without aliases', async () => {
  const { AMICORP_CATALOG } = await loadCatalogModule()
  const amicorp = await loadAmicorpModule()
  const provider = hydrateProviderCatalogEntry(AMICORP_CATALOG)

  assert.equal(provider.source, 'amicorp')
  assert.equal(provider.companyName, 'Amicorp')
  assert.equal(provider.officialBrandName, 'Amicorp')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://amicorp.com/ami-news/careers/')
  assert.equal(provider.homepageUrl, 'https://amicorp.com/')
  assert.equal(provider.careersPageUrl, 'https://amicorp.com/ami-news/careers/')
  assert.equal(provider.pageSitemapUrl, 'https://amicorp.com/?sitemap=page&sitemap_n=1')
  assert.equal(
    provider.trustedApplyFormUrl,
    'https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/formperma/eclRamd2dWW4rbcIcyYbA0ooIb_3CA2MBYGp_56EYyY',
  )
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'single-first-party-careers-page-plus-first-party-page-sitemap-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-careers-page+first-party-detail-pages+shared-zoho-public-apply-form+india-location-filter',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'amicorp.com')
  assert.equal(provider.verifiedOn, '2026-09-03')
  assert.match(provider.verifiedSurfaceSummary, /September 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amicorp\.com\/ami-news\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/amicorp\.com\/page-sitemap1\.xml/i)
  assert.match(provider.verifiedSurfaceSummary, /senior-local-fund-operations-amif-jd1551/i)
  assert.match(provider.verifiedSurfaceSummary, /og:updated_time/i)
  assert.match(provider.verifiedSurfaceSummary, /Zoho public application form/i)
  assert.equal(provider.modulePath, amicorpModulePath)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Amicorp'), false)

  assert.equal(amicorp.PROVIDER_METADATA.source, AMICORP_CATALOG.source)
  assert.equal(amicorp.PROVIDER_METADATA.companyName, AMICORP_CATALOG.companyName)
  assert.equal(amicorp.PROVIDER_METADATA.companyCareerPage, AMICORP_CATALOG.companyCareerPage)
  assert.equal(amicorp.PROVIDER_METADATA.pageSitemapUrl, AMICORP_CATALOG.pageSitemapUrl)
  assert.equal(
    amicorp.PROVIDER_METADATA.trustedApplyFormUrl,
    AMICORP_CATALOG.trustedApplyFormUrl,
  )
})

test('Amicorp backlog row matches directly from local provider metadata without alias churn', async () => {
  const { AMICORP_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Amicorp\n',
    catalog: [hydrateProviderCatalogEntry(AMICORP_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amicorp', 'amicorp', 'Amicorp']],
  )
})

test('buildScrapers and company coverage resolve Amicorp from the shared catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'amicorp')
  const scraper = buildScrapers().find((item) => item.name === 'amicorp')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Amicorp')
  assert.equal(provider.companyCareerPage, 'https://amicorp.com/ami-news/careers/')
  assert.match(scraper.dryRunFile, /amicorp[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Amicorp\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Amicorp', 'amicorp', 'Amicorp']],
  )
})
