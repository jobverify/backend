import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fareye/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/fareye/catalog.js')
  } catch {
    assert.fail('Expected FarEye catalog module at ../../scraper/fareye/catalog.js')
  }
}

test('FarEye catalog captures the verified first-party careers handoff and no-public-jobs Darwinbox contract', async () => {
  const {
    FAREYE_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(FAREYE_CATALOG.source, 'fareye')
  assert.equal(FAREYE_CATALOG.companyName, 'FarEye')
  assert.equal(FAREYE_CATALOG.officialBrandName, 'FarEye')
  assert.equal(FAREYE_CATALOG.adapter, 'script')
  assert.equal(FAREYE_CATALOG.modulePath, modulePath)
  assert.equal(FAREYE_CATALOG.dryRunFile, 'fareye/jobs.json')
  assert.equal(FAREYE_CATALOG.homepageUrl, 'https://fareye.com/')
  assert.equal(FAREYE_CATALOG.companyCareerPage, 'https://fareye.com/about/careers')
  assert.equal(FAREYE_CATALOG.officialCareersHandoffUrl, 'https://fareye.darwinbox.in/ms/candidate/careers')
  assert.equal(FAREYE_CATALOG.darwinboxJobsUrl, 'https://fareye.darwinbox.in/jobs')
  assert.deepEqual(FAREYE_CATALOG.darwinboxShellRouteUrls, [
    'https://fareye.darwinbox.in/ms/candidate/careers',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/home',
    'https://fareye.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  ])
  assert.equal(
    FAREYE_CATALOG.darwinboxListingApiUrl,
    'https://fareye.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(
    FAREYE_CATALOG.darwinboxCompanyConfigUrl,
    'https://fareye.darwinbox.in/ms/candidateapi/getCompanyConfig',
  )
  assert.equal(FAREYE_CATALOG.companyDomain, 'fareye.com')
  assert.equal(FAREYE_CATALOG.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(FAREYE_CATALOG.countryFilter, 'India')
  assert.equal(
    FAREYE_CATALOG.paginationStrategy,
    'official-careers-page-plus-darwinbox-login-redirect-blank-shells-and-broken-api-validation',
  )
  assert.equal(
    FAREYE_CATALOG.extractionStrategy,
    'verified-homepage+verified-careers-page+verified-darwinbox-handoff+verified-login-redirect+verified-blank-shells+verified-broken-tenant-api+return-empty',
  )
  assert.equal(FAREYE_CATALOG.parser, 'custom-script')
  assert.equal(FAREYE_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(FAREYE_CATALOG.verifiedOn, '2026-08-04')
  assert.equal(FAREYE_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.com\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.com\/about\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.darwinbox\.in\/ms\/candidate\/careers/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.darwinbox\.in\/jobs/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/fareye\.darwinbox\.in\/ms\/candidateapi\/job\/alljobs\?companyId=main/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /tenant-info/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})
