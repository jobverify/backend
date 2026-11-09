import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ndrModulePath = path.resolve(currentDir, '../../scraper/ndrwarehousing/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ndrwarehousing/catalog.js')
  } catch {
    assert.fail('Expected NDR Warehousing catalog module at ../../scraper/ndrwarehousing/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/ndrwarehousing/script.js')
  } catch {
    assert.fail('Expected NDR Warehousing scraper module at ../../scraper/ndrwarehousing/script.js')
  }
}

test('NDR Warehousing local catalog captures the verified first-party no-public-careers sentinel state', async () => {
  const { NDR_WAREHOUSING_CATALOG } = await loadCatalogModule()
  const ndr = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(NDR_WAREHOUSING_CATALOG)

  assert.equal(provider.source, 'ndrwarehousing')
  assert.equal(provider.companyName, 'NDR Warehousing')
  assert.equal(provider.officialBrandName, 'NDR Warehousing')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.ndrwarehousing.com/')
  assert.equal(provider.companyDomain, 'ndrwarehousing.com')
  assert.equal(provider.officialHomepageUrl, 'https://www.ndrwarehousing.com/')
  assert.equal(provider.officialContactPageUrl, 'https://www.ndrwarehousing.com/contact.html')
  assert.deepEqual(provider.noPublicCareersRouteUrls, [
    'https://www.ndrwarehousing.com/careers',
    'https://www.ndrwarehousing.com/career',
    'https://www.ndrwarehousing.com/jobs',
    'https://www.ndrwarehousing.com/join-us',
  ])
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-homepage-plus-contact-and-common-careers-route-404-validation',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-contact+verified-missing-careers-routes-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, ndrModulePath)
  assert.match(provider.dryRunFile, /ndrwarehousing[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ndrwarehousing\.com\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ndrwarehousing\.com\/contact\.html/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ndrwarehousing\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'NDR Warehousing'), false)

  assert.equal(ndr.PROVIDER_METADATA.source, NDR_WAREHOUSING_CATALOG.source)
  assert.equal(ndr.PROVIDER_METADATA.companyName, NDR_WAREHOUSING_CATALOG.companyName)
  assert.equal(ndr.PROVIDER_METADATA.officialContactPageUrl, NDR_WAREHOUSING_CATALOG.officialContactPageUrl)
})

test('NDR Warehousing backlog row matches directly from provider metadata without alias churn', async () => {
  const { NDR_WAREHOUSING_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'NDR Warehousing\n',
    catalog: [hydrateProviderCatalogEntry(NDR_WAREHOUSING_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['NDR Warehousing', 'ndrwarehousing', 'NDR Warehousing']],
  )
})
