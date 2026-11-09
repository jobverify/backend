import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sonablwprecision/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sonablwprecision/catalog.js')
  } catch {
    assert.fail('Expected Sona BLW Precision catalog module at ../../scraper/sonablwprecision/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sonablwprecision/script.js')
  } catch {
    assert.fail('Expected Sona BLW Precision scraper module at ../../scraper/sonablwprecision/script.js')
  }
}

test('Sona BLW Precision local catalog captures the verified resume-upload sentinel contract', async () => {
  const { SONA_BLW_PRECISION_CATALOG } = await loadCatalogModule()
  const sonaBlwPrecision = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(SONA_BLW_PRECISION_CATALOG)

  assert.equal(provider.source, 'sonablwprecision')
  assert.equal(provider.companyName, 'Sona BLW Precision')
  assert.equal(
    provider.officialBrandName,
    'Sona BLW Precision Forgings Limited (Sona Comstar)',
  )
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://sonacomstar.com/our-culture')
  assert.equal(provider.officialCompanyPageUrl, 'https://sonacomstar.com/pages/about-us')
  assert.equal(provider.officialCulturePageUrl, 'https://sonacomstar.com/our-culture')
  assert.equal(
    provider.cautionNoticeUrl,
    'https://sonacomstar.com/files/policy/Cautionary_Notice_Against_Fake_Employment_Offers_etc.pdf',
  )
  assert.equal(provider.companyDomain, 'sonacomstar.com')
  assert.equal(provider.atsPlatform, 'official-company-site-culture-page-broken-career-route-no-public-jobs')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(
    provider.paginationStrategy,
    'verified-culture-page-plus-linked-career-404-plus-legal-entity-footer-checks',
  )
  assert.equal(
    provider.extractionStrategy,
    'verified-culture-page+linked-career-404+footer-legal-entity+cautionary-notice-no-public-jobs-return-empty',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-26')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /sonablwprecision[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Sunday, July 26, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/sonacomstar\.com\/our-culture/i)
  assert.match(provider.verifiedSurfaceSummary, /Life @Sona Comstar/i)
  assert.match(provider.verifiedSurfaceSummary, /HTTP 404/i)
  assert.match(provider.verifiedSurfaceSummary, /Sona BLW Precision Forgings Limited/i)
  assert.match(provider.verifiedSurfaceSummary, /fails closed and returns an empty array/i)

  assert.equal(sonaBlwPrecision.PROVIDER_METADATA.source, SONA_BLW_PRECISION_CATALOG.source)
  assert.equal(sonaBlwPrecision.CAREER_PAGE_URL, SONA_BLW_PRECISION_CATALOG.companyCareerPage)
  assert.equal(sonaBlwPrecision.ABOUT_PAGE_URL, SONA_BLW_PRECISION_CATALOG.officialCompanyPageUrl)
})

test('Sona BLW Precision exact-name backlog rows resolve directly from the local catalog without aliases', async () => {
  const { SONA_BLW_PRECISION_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Sona BLW Precision\n',
    catalog: [hydrateProviderCatalogEntry(SONA_BLW_PRECISION_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Sona BLW Precision', 'sonablwprecision', 'Sona BLW Precision']],
  )
})
