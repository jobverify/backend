import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const kocharTechModulePath = path.resolve(currentDir, '../../scraper/kochartech/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kochartech/catalog.js')
  } catch {
    assert.fail('Expected KocharTech catalog module at ../../scraper/kochartech/catalog.js')
  }
}

const loadKocharTechModule = async () => {
  try {
    return await import('../../scraper/kochartech/script.js')
  } catch {
    assert.fail('Expected KocharTech scraper module at ../../scraper/kochartech/script.js')
  }
}

test('KocharTech local catalog captures the verified first-party careers page and WordPress career feed', async () => {
  const { KOCHARTECH_CATALOG, VERIFIED_JOB_DETAIL_URLS } = await loadCatalogModule()
  const kocharTech = await loadKocharTechModule()
  const provider = hydrateProviderCatalogEntry(KOCHARTECH_CATALOG)

  assert.equal(provider.source, 'kochartech')
  assert.equal(provider.companyName, 'KocharTech')
  assert.equal(provider.officialBrandName, 'KocharTech')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.kochartech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.kochartech.com/careers/')
  assert.equal(provider.careerApiUrl, 'https://www.kochartech.com/wp-json/wp/v2/career?per_page=100')
  assert.deepEqual(provider.verifiedJobDetailUrls, VERIFIED_JOB_DETAIL_URLS)
  assert.equal(provider.companyDomain, 'kochartech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-careers-page-plus-wordpress-rest-career-feed',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-careers-page+wordpress-rest-career-feed+same-domain-detail-pages+maxicus-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.equal(provider.modulePath, kocharTechModulePath)
  assert.match(provider.dryRunFile, /kochartech[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kochartech\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.kochartech\.com\/wp-json\/wp\/v2\/career\?per_page=100/i)
  assert.match(provider.verifiedSurfaceSummary, /\bSenior Manager-Sales\b/i)
  assert.match(provider.verifiedSurfaceSummary, /\bInside Sales Executive\b/i)

  assert.equal(kocharTech.PROVIDER_METADATA.source, KOCHARTECH_CATALOG.source)
  assert.equal(kocharTech.PROVIDER_METADATA.companyName, KOCHARTECH_CATALOG.companyName)
  assert.equal(kocharTech.PROVIDER_METADATA.careerApiUrl, KOCHARTECH_CATALOG.careerApiUrl)
})

test('KocharTech exact backlog row resolves directly from local provider metadata without aliases', async () => {
  const { KOCHARTECH_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'KocharTech\n',
    catalog: [hydrateProviderCatalogEntry(KOCHARTECH_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KocharTech', 'kochartech', 'KocharTech']],
  )
})
