import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import FINCARE_CATALOG, { FINCARE_CATALOG as namedCatalog } from '../../scraper/fincare/catalog.js'
import {
  PROVIDER_METADATA,
  VERIFIED_SURFACE_SUMMARY,
} from '../../scraper/fincare/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/fincare/script.js')

test('Fincare local catalog captures the verified AU handoff and no-public-jobs sentinel state', () => {
  assert.equal(FINCARE_CATALOG, namedCatalog)
  assert.equal(namedCatalog.source, 'fincare')
  assert.equal(namedCatalog.companyName, 'Fincare')
  assert.equal(namedCatalog.officialBrandName, 'Fincare')
  assert.equal(namedCatalog.adapter, 'script')
  assert.equal(namedCatalog.homepageUrl, 'https://fincarebank.in/')
  assert.equal(namedCatalog.companyCareerPage, 'https://fincarebank.in/careers')
  assert.equal(namedCatalog.legacyWwwHomepageUrl, 'https://www.fincarebank.com/')
  assert.equal(namedCatalog.mergedParentHomepageUrl, 'https://www.au.bank.in/')
  assert.equal(
    namedCatalog.legacyMergerInfoUrl,
    'https://www.au.bank.in/au-small-finance-bank-and-fincare-small-finance-bank-merger',
  )
  assert.deepEqual(namedCatalog.checkedRedirectRouteUrls, [
    'https://fincarebank.in/',
    'https://fincarebank.in/careers',
    'https://fincarebank.in/jobs',
    'https://fincarebank.in/about-us/careers',
  ])
  assert.equal(namedCatalog.companyDomain, 'fincarebank.in')
  assert.equal(namedCatalog.atsPlatform, 'legacy-brand-redirect-to-au-bank-homepage')
  assert.equal(namedCatalog.countryFilter, 'India')
  assert.equal(
    namedCatalog.paginationStrategy,
    'legacy-homepage-and-careers-route-redirect-validation',
  )
  assert.equal(
    namedCatalog.extractionStrategy,
    'verified-legacy-fincare-routes-redirect-to-au-homepage-without-public-jobs-return-empty',
  )
  assert.equal(namedCatalog.parser, 'custom-script')
  assert.equal(namedCatalog.normalizationProfile, 'engineering-default')
  assert.equal(namedCatalog.verifiedOn, '2026-08-14')
  assert.equal(namedCatalog.dryRunFile, 'fincare/jobs.json')
  assert.equal(namedCatalog.modulePath, modulePath)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/fincarebank\.in\//i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /https:\/\/www\.au\.bank\.in\//i)
  assert.match(
    namedCatalog.verifiedSurfaceSummary,
    /au-small-finance-bank-and-fincare-small-finance-bank-merger/i,
  )
  assert.match(namedCatalog.verifiedSurfaceSummary, /Cloudflare/i)
  assert.match(namedCatalog.verifiedSurfaceSummary, /no trustworthy public jobs surface/i)

  assert.equal(PROVIDER_METADATA.source, namedCatalog.source)
  assert.equal(PROVIDER_METADATA.companyName, namedCatalog.companyName)
  assert.equal(VERIFIED_SURFACE_SUMMARY, namedCatalog.verifiedSurfaceSummary)
})
