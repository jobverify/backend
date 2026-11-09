import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'
import INTENSE_TECHNOLOGIES_CATALOG, { VERIFIED_SURFACE_SUMMARY } from './catalog.js'

test('Intense Technologies catalog metadata captures the verified first-party Keka-backed careers surface without aliases', () => {
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.source, 'intensetechnologies')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.companyName, 'Intense Technologies')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.homepageUrl, 'https://www.in10stech.com/')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://www.in10stech.com/careers')
  assert.equal(
    INTENSE_TECHNOLOGIES_CATALOG.careerPortalInfoUrl,
    'https://intense.keka.com/careers/api/organization/default/careerportalinfo',
  )
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.expectedKekaDomain, 'https://intense.keka.com/careers/')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.expectedIdentifier, 'fcf90e1b-bb0a-4d66-b896-6b0de9cf0dce')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.atsPlatform, 'keka-embed-api')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.countryFilter, 'India')
  assert.equal(
    INTENSE_TECHNOLOGIES_CATALOG.paginationStrategy,
    'first-party-careers-page-plus-single-keka-active-jobs-endpoint',
  )
  assert.equal(
    INTENSE_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+inline-window-khConfig+keka-careerportalinfo+active-keka-embed-api+jobdetails+applyjob',
  )
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.parser, 'custom-script')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.normalizationProfile, 'engineering-default')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.companyDomain, 'in10stech.com')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.verifiedOn, '2026-08-02')
  assert.equal(INTENSE_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, VERIFIED_SURFACE_SUMMARY)
  assert.match(INTENSE_TECHNOLOGIES_CATALOG.modulePath, /intensetechnologies[\\/]script\.js$/i)
})

test('Intense Technologies exact-name coverage resolves directly from local catalog metadata with no alias requirement', () => {
  const report = generateCompanyCoverageReport({
    csvText: 'Intense Technologies,\n',
    catalog: [INTENSE_TECHNOLOGIES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Intense Technologies', 'intensetechnologies', 'Intense Technologies']],
  )
})

test('getScraperCatalog includes Intense Technologies as a verified Keka provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'intensetechnologies')

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Intense Technologies')
  assert.equal(provider.companyCareerPage, 'https://www.in10stech.com/careers')
  assert.equal(provider.companyDomain, 'in10stech.com')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.match(provider.modulePath, /intensetechnologies[\\/]script\.js$/i)
})

test('buildScrapers exposes a runnable Intense Technologies scraper without changing the runner contract', () => {
  const scraper = buildScrapers().find((item) => item.name === 'intensetechnologies')

  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'intensetechnologies')
  assert.equal(scraper.provider.atsPlatform, 'keka-embed-api')
  assert.match(scraper.dryRunFile, /intensetechnologies[\\/]jobs\.json$/i)
})
