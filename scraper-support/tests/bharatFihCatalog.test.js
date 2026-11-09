import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const bharatFihModulePath = path.resolve(currentDir, '../../scraper/bharatfih/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/bharatfih/catalog.js')
  } catch {
    assert.fail('Expected Bharat FIH catalog module at ../../scraper/bharatfih/catalog.js')
  }
}

const loadBharatFihModule = async () => {
  try {
    return await import('../../scraper/bharatfih/script.js')
  } catch {
    assert.fail('Expected Bharat FIH scraper module at ../../scraper/bharatfih/script.js')
  }
}

test('Bharat FIH local catalog captures the verified broken first-party surface and non-public Darwinbox tenant', async () => {
  const {
    BHARAT_FIH_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const bharatFih = await loadBharatFihModule()

  assert.equal(defaultCatalog, BHARAT_FIH_CATALOG)
  assert.equal(BHARAT_FIH_CATALOG.source, 'bharatfih')
  assert.equal(BHARAT_FIH_CATALOG.companyName, 'Bharat FIH')
  assert.equal(BHARAT_FIH_CATALOG.adapter, 'script')
  assert.equal(BHARAT_FIH_CATALOG.companyCareerPage, 'https://bharatfih.com/')
  assert.equal(BHARAT_FIH_CATALOG.homepageUrl, 'https://bharatfih.com/')
  assert.equal(BHARAT_FIH_CATALOG.wwwHomepageUrl, 'https://www.bharatfih.com/')
  assert.deepEqual(BHARAT_FIH_CATALOG.firstPartyCareerRouteUrls, [
    'https://bharatfih.com/careers',
    'https://www.bharatfih.com/careers',
  ])
  assert.equal(BHARAT_FIH_CATALOG.darwinboxJobsUrl, 'https://bharatfih.darwinbox.in/jobs')
  assert.deepEqual(BHARAT_FIH_CATALOG.darwinboxShellRouteUrls, [
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://bharatfih.darwinbox.in/ms/candidatev2/main/careers/allJobs',
    'https://bharatfih.darwinbox.in/ms/candidate/careers',
  ])
  assert.equal(
    BHARAT_FIH_CATALOG.darwinboxListingApiUrl,
    'https://bharatfih.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(BHARAT_FIH_CATALOG.companyDomain, 'bharatfih.com')
  assert.equal(BHARAT_FIH_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(BHARAT_FIH_CATALOG.countryFilter, 'India')
  assert.equal(
    BHARAT_FIH_CATALOG.paginationStrategy,
    'first-party-homepage-and-careers-tls-failure-plus-darwinbox-login-and-angular-shell-validation',
  )
  assert.equal(
    BHARAT_FIH_CATALOG.extractionStrategy,
    'verified-first-party-tls-hostname-mismatch+darwinbox-jobs-login-redirect+non-public-darwinbox-candidate-shells+invalid-subdomain-api-return-empty',
  )
  assert.equal(BHARAT_FIH_CATALOG.parser, 'custom-script')
  assert.equal(BHARAT_FIH_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(BHARAT_FIH_CATALOG.verifiedOn, '2026-07-19')
  assert.match(BHARAT_FIH_CATALOG.verifiedSurfaceSummary, /https:\/\/bharatfih\.com\//i)
  assert.match(BHARAT_FIH_CATALOG.verifiedSurfaceSummary, /https:\/\/www\.bharatfih\.com\//i)
  assert.match(BHARAT_FIH_CATALOG.verifiedSurfaceSummary, /https:\/\/bharatfih\.darwinbox\.in\/jobs/i)
  assert.match(
    BHARAT_FIH_CATALOG.verifiedSurfaceSummary,
    /https:\/\/bharatfih\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )
  assert.match(
    BHARAT_FIH_CATALOG.verifiedSurfaceSummary,
    /https:\/\/bharatfih\.darwinbox\.in\/ms\/candidateapi\/job\/alljobs\?companyId=main/i,
  )
  assert.match(BHARAT_FIH_CATALOG.verifiedSurfaceSummary, /invalid subdomain: bharatfih/i)
  assert.match(BHARAT_FIH_CATALOG.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)
  assert.equal(BHARAT_FIH_CATALOG.modulePath, bharatFihModulePath)

  assert.equal(bharatFih.PROVIDER_METADATA.source, BHARAT_FIH_CATALOG.source)
  assert.equal(bharatFih.PROVIDER_METADATA.companyName, BHARAT_FIH_CATALOG.companyName)
  assert.equal(
    bharatFih.PROVIDER_METADATA.darwinboxJobsUrl,
    BHARAT_FIH_CATALOG.darwinboxJobsUrl,
  )
})

test('Bharat FIH backlog matching works directly from the local catalog without an alias entry', async () => {
  const { BHARAT_FIH_CATALOG } = await loadCatalogModule()

  const report = generateCompanyCoverageReport({
    csvText: 'Bharat FIH\n',
    catalog: [BHARAT_FIH_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Bharat FIH', 'bharatfih', 'Bharat FIH']],
  )
})
