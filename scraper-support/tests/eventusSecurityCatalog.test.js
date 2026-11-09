import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const eventusSecurityModulePath = path.resolve(currentDir, '../../scraper/eventussecurity/script.js')

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/eventussecurity/catalog.js')
  } catch {
    assert.fail('Expected Eventus Security catalog module at ../../scraper/eventussecurity/catalog.js')
  }
}

test('Eventus Security catalog captures the verified first-party careers and job detail contract', async () => {
  const {
    EVENTUS_SECURITY_CATALOG,
    VERIFIED_SURFACE_SUMMARY,
  } = await loadCatalogModule()

  assert.equal(EVENTUS_SECURITY_CATALOG.source, 'eventussecurity')
  assert.equal(EVENTUS_SECURITY_CATALOG.companyName, 'Eventus Security')
  assert.equal(EVENTUS_SECURITY_CATALOG.officialBrandName, 'Eventus Security')
  assert.equal(EVENTUS_SECURITY_CATALOG.adapter, 'script')
  assert.equal(EVENTUS_SECURITY_CATALOG.modulePath, eventusSecurityModulePath)
  assert.equal(EVENTUS_SECURITY_CATALOG.dryRunFile, 'eventussecurity/jobs.json')
  assert.equal(EVENTUS_SECURITY_CATALOG.homepageUrl, 'https://eventussecurity.com/')
  assert.equal(EVENTUS_SECURITY_CATALOG.companyCareerPage, 'https://eventussecurity.com/careers/')
  assert.equal(EVENTUS_SECURITY_CATALOG.canonicalCareerUrl, 'https://eventussecurity.com/careers/')
  assert.equal(
    EVENTUS_SECURITY_CATALOG.verifiedJobDetailUrl,
    'https://eventussecurity.com/careers/strategic-account-manager/',
  )
  assert.equal(
    EVENTUS_SECURITY_CATALOG.verifiedApplyUrl,
    'https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3',
  )
  assert.equal(
    EVENTUS_SECURITY_CATALOG.atsPlatform,
    'first-party-careers-page-plus-first-party-job-pages',
  )
  assert.equal(EVENTUS_SECURITY_CATALOG.countryFilter, 'India')
  assert.equal(
    EVENTUS_SECURITY_CATALOG.paginationStrategy,
    'single-first-party-current-openings-page',
  )
  assert.equal(
    EVENTUS_SECURITY_CATALOG.extractionStrategy,
    'verified-homepage+verified-current-openings-page+first-party-job-detail-pages+india-filter+zoho-apply-handoff',
  )
  assert.equal(EVENTUS_SECURITY_CATALOG.parser, 'custom-script')
  assert.equal(EVENTUS_SECURITY_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(EVENTUS_SECURITY_CATALOG.companyDomain, 'eventussecurity.com')
  assert.equal(EVENTUS_SECURITY_CATALOG.verifiedOn, '2026-07-15')
  assert.equal(EVENTUS_SECURITY_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/eventussecurity\.com\/$/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/eventussecurity\.com\/careers\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/eventussecurity\.com\/careers\/strategic-account-manager\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /https:\/\/eventustechsol\.zohorecruit\.in\/forms\//i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Current Openings/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Strategic Account Manager/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /Apply Now/i)
})
