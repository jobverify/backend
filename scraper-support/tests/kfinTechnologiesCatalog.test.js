import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/kfintechnologies/catalog.js')
  } catch {
    assert.fail('Expected KFin Technologies catalog module at ../../scraper/kfintechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/kfintechnologies/script.js')
  } catch {
    assert.fail('Expected KFin Technologies scraper module at ../../scraper/kfintechnologies/script.js')
  }
}

test('KFin Technologies local catalog captures the verified first-party KFintech careers surface', async () => {
  const { KFIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const kfinTechnologies = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(KFIN_TECHNOLOGIES_CATALOG)

  assert.equal(KFIN_TECHNOLOGIES_CATALOG.source, 'kfintechnologies')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.companyName, 'KFin Technologies')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.officialBrandName, 'KFintech')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.modulePath, '../../scraper/kfintechnologies/script.js')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.dryRunFile, 'kfintechnologies/jobs.json')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://www.kfintech.com/career/')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.officialJobsArchiveUrl, 'https://www.kfintech.com/jobs/')
  assert.equal(
    KFIN_TECHNOLOGIES_CATALOG.verifiedSampleJobUrl,
    'https://www.kfintech.com/jobs/associate-senior-associate-mutual-fund-services-uti/',
  )
  assert.equal(
    KFIN_TECHNOLOGIES_CATALOG.verifiedSampleJobTitle,
    'Associate/ Senior Associate - Mutual Fund Services (UTI)',
  )
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.companyDomain, 'kfintech.com')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.verifiedPublicJobCount, 8)
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.atsPlatform, 'official-company-careers')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(
    KFIN_TECHNOLOGIES_CATALOG.paginationStrategy,
    'verified-first-party-careers-page-plus-linked-first-party-job-detail-pages',
  )
  assert.equal(
    KFIN_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+linked-first-party-job-detail-pages+same-page-application-form',
  )
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(KFIN_TECHNOLOGIES_CATALOG.verifiedOn, '2026-07-16')
  assert.match(KFIN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /July 16, 2026/i)
  assert.match(KFIN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.kfintech\.com\/career\//i)
  assert.match(KFIN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.kfintech\.com\/jobs\//i)
  assert.match(KFIN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /8 public first-party job detail pages/i)
  assert.match(KFIN_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Associate\/ Senior Associate/i)

  assert.equal(provider.source, 'kfintechnologies')
  assert.equal(provider.companyName, 'KFin Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.kfintech.com/career/')
  assert.equal(provider.companyDomain, 'kfintech.com')
  assert.match(provider.modulePath, /kfintechnologies[\\/]script\.js$/i)
  assert.match(provider.dryRunFile, /kfintechnologies[\\/]jobs\.json$/i)

  assert.equal(kfinTechnologies.PROVIDER_METADATA.source, provider.source)
  assert.equal(kfinTechnologies.CAREERS_URL, provider.companyCareerPage)
  assert.equal(kfinTechnologies.JOBS_ARCHIVE_URL, provider.officialJobsArchiveUrl)
})

test('KFin Technologies exact-name backlog rows resolve directly from local metadata without a shared alias', async () => {
  const { KFIN_TECHNOLOGIES_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'KFin Technologies\n',
    catalog: [hydrateProviderCatalogEntry(KFIN_TECHNOLOGIES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['KFin Technologies', 'kfintechnologies', 'KFin Technologies']],
  )
})
