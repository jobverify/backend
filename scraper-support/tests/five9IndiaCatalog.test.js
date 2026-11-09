import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import FIVE9_INDIA_CATALOG, {
  FIVE9_INDIA_CATALOG as namedCatalog,
  VERIFIED_SURFACE_SUMMARY,
} from '../../scraper/five9india/catalog.js'
import { PROVIDER_METADATA } from '../../scraper/five9india/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/five9india/script.js')

test('Five9 India catalog captures the verified first-party careers pages and public Greenhouse India jobs surface', () => {
  assert.equal(FIVE9_INDIA_CATALOG, namedCatalog)
  assert.equal(namedCatalog.source, 'five9india')
  assert.equal(namedCatalog.companyName, 'Five9 India')
  assert.equal(namedCatalog.officialBrandName, 'Five9')
  assert.equal(namedCatalog.adapter, 'script')
  assert.equal(namedCatalog.officialHomepageUrl, 'https://www.five9.com/')
  assert.equal(namedCatalog.officialCareersLandingUrl, 'https://www.five9.com/about/careers')
  assert.equal(namedCatalog.companyCareerPage, 'https://www.five9.com/about/careers/jobs')
  assert.equal(namedCatalog.greenhouseEmbedScriptUrl, 'https://boards.greenhouse.io/embed/job_board/js?for=five9')
  assert.equal(namedCatalog.greenhouseJobsApiUrl, 'https://boards-api.greenhouse.io/v1/boards/five9/jobs')
  assert.equal(
    namedCatalog.verifiedSampleJobUrl,
    'https://www.five9.com/about/careers/job-detail?gh_jid=5985462004',
  )
  assert.equal(namedCatalog.verifiedPublicJobCount, 156)
  assert.equal(namedCatalog.verifiedIndiaJobCount, 52)
  assert.equal(namedCatalog.atsPlatform, 'greenhouse')
  assert.equal(namedCatalog.countryFilter, 'India')
  assert.equal(namedCatalog.paginationStrategy, 'single-greenhouse-jobs-api-content-page')
  assert.equal(
    namedCatalog.extractionStrategy,
    'verified-first-party-careers-pages+greenhouse-jobs-api+first-party-gh_jid-detail-routes+india-location-filter',
  )
  assert.equal(namedCatalog.parser, 'custom-script')
  assert.equal(namedCatalog.normalizationProfile, 'engineering-default')
  assert.equal(namedCatalog.companyDomain, 'five9.com')
  assert.equal(namedCatalog.verifiedOn, '2026-07-15')
  assert.equal(namedCatalog.dryRunFile, 'five9india/jobs.json')
  assert.equal(namedCatalog.modulePath, modulePath)
  assert.equal(PROVIDER_METADATA.source, namedCatalog.source)
  assert.equal(PROVIDER_METADATA.companyName, namedCatalog.companyName)
  assert.equal(VERIFIED_SURFACE_SUMMARY, namedCatalog.verifiedSurfaceSummary)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.five9\.com\/about\/careers/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.five9\.com\/about\/careers\/jobs/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/boards\.greenhouse\.io\/embed\/job_board\/js\?for=five9/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/five9\/jobs\?content=true/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /NOC Technician \| India/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /Technical Support Engineer/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /156 public jobs/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /52 India roles/i)
})
