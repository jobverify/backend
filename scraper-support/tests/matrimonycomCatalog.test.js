import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const matrimonycomModulePath = path.resolve(currentDir, '../../scraper/matrimonycom/script.js')

const loadMatrimonycomCatalog = async () => {
  try {
    return await import('../../scraper/matrimonycom/catalog.js')
  } catch {
    assert.fail('Expected Matrimony.com catalog module at ../../scraper/matrimonycom/catalog.js')
  }
}

test('Matrimony.com local catalog captures the verified official PeopleStrong handoff and live API', async () => {
  const {
    MATRIMONYCOM_CATALOG,
    default: defaultCatalog,
  } = await loadMatrimonycomCatalog()
  const provider = hydrateProviderCatalogEntry(MATRIMONYCOM_CATALOG)

  assert.equal(defaultCatalog, MATRIMONYCOM_CATALOG)
  assert.equal(provider.source, 'matrimonycom')
  assert.equal(provider.companyName, 'Matrimony.com')
  assert.equal(provider.officialBrandName, 'Matrimony.com Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.officialBrandSiteUrl, 'https://www.matrimony.com/')
  assert.equal(provider.companyCareerPage, 'https://www.matrimony.com/careers')
  assert.equal(provider.portalOrigin, 'https://matrimonycareers.peoplestrong.com')
  assert.equal(provider.jobListingsUrl, 'https://matrimonycareers.peoplestrong.com/')
  assert.equal(
    provider.jobsApiUrl,
    'https://matrimonycareers.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=20',
  )
  assert.equal(provider.atsPlatform, 'peoplestrong')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.verifiedPublicJobCount, 1)
  assert.equal(provider.paginationStrategy, 'official-careers-page-plus-peoplestrong-offset-limit-api')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page+direct-peoplestrong-handoff+peoplestrong-jobs-api',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'matrimonycareers.peoplestrong.com')
  assert.equal(provider.verifiedOn, '2026-07-16')
  assert.match(provider.dryRunFile, /matrimonycom[\\/]jobs\.json$/i)
  assert.match(provider.modulePath, /matrimonycom[\\/]script\.js$/i)
  assert.equal(provider.modulePath, matrimonycomModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Thursday, July 16, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.matrimony\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/matrimonycareers\.peoplestrong\.com\//i)
  assert.match(
    provider.verifiedSurfaceSummary,
    /api\/cp\/rest\/altone\/cp\/jobs\/v1\?offset=0&limit=20/i,
  )
  assert.match(provider.verifiedSurfaceSummary, /1 public job/i)
})

test('Matrimony.com exact backlog row matches directly from the local catalog without aliases', async () => {
  const { MATRIMONYCOM_CATALOG } = await loadMatrimonycomCatalog()

  const report = generateCompanyCoverageReport({
    csvText: 'Matrimony.com\n',
    catalog: [hydrateProviderCatalogEntry(MATRIMONYCOM_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Matrimony.com', 'matrimonycom', 'Matrimony.com']],
  )
})
