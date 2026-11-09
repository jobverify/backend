import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const ekaSoftwareModulePath = path.resolve(currentDir, '../../scraper/ekasoftware/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/ekasoftware/catalog.js')
  } catch {
    assert.fail('Expected Eka Software catalog module at ../../scraper/ekasoftware/catalog.js')
  }
}

const loadEkaSoftwareModule = async () => {
  try {
    return await import('../../scraper/ekasoftware/script.js')
  } catch {
    assert.fail('Expected Eka Software scraper module at ../../scraper/ekasoftware/script.js')
  }
}

test('Eka Software local catalog captures the verified Quoreka no-public-jobs sentinel surface', async () => {
  const { EKA_SOFTWARE_CATALOG } = await loadCatalogModule()
  const ekaSoftware = await loadEkaSoftwareModule()

  assert.equal(EKA_SOFTWARE_CATALOG.source, 'ekasoftware')
  assert.equal(EKA_SOFTWARE_CATALOG.companyName, 'Eka Software')
  assert.equal(EKA_SOFTWARE_CATALOG.officialBrandName, 'Quoreka')
  assert.equal(EKA_SOFTWARE_CATALOG.adapter, 'script')
  assert.equal(EKA_SOFTWARE_CATALOG.companyCareerPage, 'https://quoreka.com/careers')
  assert.equal(EKA_SOFTWARE_CATALOG.homepageUrl, 'https://quoreka.com/')
  assert.equal(EKA_SOFTWARE_CATALOG.careersPageUrl, 'https://quoreka.com/careers')
  assert.equal(EKA_SOFTWARE_CATALOG.sitemapUrl, 'https://quoreka.com/sitemap.xml')
  assert.deepEqual(EKA_SOFTWARE_CATALOG.sitemapCareerRouteUrls, ['https://quoreka.com/careers'])
  assert.deepEqual(EKA_SOFTWARE_CATALOG.noPublicJobRouteUrls, [
    'https://quoreka.com/jobs',
    'https://quoreka.com/careers/jobs',
    'https://quoreka.com/openings',
    'https://quoreka.com/join-us',
    'https://quoreka.com/work-with-us',
    'https://quoreka.com/current-openings',
  ])
  assert.equal(EKA_SOFTWARE_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(EKA_SOFTWARE_CATALOG.countryFilter, 'India')
  assert.equal(
    EKA_SOFTWARE_CATALOG.paginationStrategy,
    'homepage-plus-careers-page-plus-sitemap-and-adjacent-route-validation',
  )
  assert.equal(
    EKA_SOFTWARE_CATALOG.extractionStrategy,
    'verified-homepage+verified-first-party-careers-page+verified-single-sitemap-careers-route+missing-adjacent-jobs-routes-return-empty',
  )
  assert.equal(EKA_SOFTWARE_CATALOG.parser, 'custom-script')
  assert.equal(EKA_SOFTWARE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EKA_SOFTWARE_CATALOG.companyDomain, 'quoreka.com')
  assert.equal(EKA_SOFTWARE_CATALOG.verifiedOn, '2026-07-15')
  assert.match(EKA_SOFTWARE_CATALOG.dryRunFile, /ekasoftware[\\/]jobs\.json$/i)
  assert.equal(EKA_SOFTWARE_CATALOG.modulePath, ekaSoftwareModulePath)
  assert.match(EKA_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/quoreka\.com\//i)
  assert.match(EKA_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/quoreka\.com\/careers/i)
  assert.match(EKA_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/quoreka\.com\/sitemap\.xml/i)
  assert.match(EKA_SOFTWARE_CATALOG.verifiedSurfaceSummary, /https:\/\/quoreka\.com\/jobs/i)
  assert.match(EKA_SOFTWARE_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(ekaSoftware.PROVIDER_METADATA.source, EKA_SOFTWARE_CATALOG.source)
  assert.equal(ekaSoftware.PROVIDER_METADATA.companyName, EKA_SOFTWARE_CATALOG.companyName)
  assert.equal(
    ekaSoftware.PROVIDER_METADATA.companyCareerPage,
    EKA_SOFTWARE_CATALOG.companyCareerPage,
  )
  assert.equal(
    ekaSoftware.PROVIDER_METADATA.sitemapUrl,
    EKA_SOFTWARE_CATALOG.sitemapUrl,
  )
})

test('Eka Software backlog row resolves directly from local provider metadata without an alias entry', async () => {
  const { EKA_SOFTWARE_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Eka Software\n',
    catalog: [EKA_SOFTWARE_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Eka Software', 'ekasoftware', 'Eka Software']],
  )
})
