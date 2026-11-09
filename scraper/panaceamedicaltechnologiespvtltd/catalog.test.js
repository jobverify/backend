import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'panaceamedicaltechnologiespvtltd'
const COMPANY = 'Panacea Medical Technologies Pvt Ltd'
const OFFICIAL_COMPANY_NAME = 'Panacea Medical Technologies Pvt. Ltd.'
const CAREERS_URL = 'https://www.panaceamedical.in/careers/'

test('Panacea Medical Technologies is registered against its verified first-party careers portal', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider)
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, OFFICIAL_COMPANY_NAME)
  assert.equal(provider.homepageUrl, 'https://www.panaceamedical.in/')
  assert.equal(provider.joinUsUrl, 'https://www.panaceamedical.in/join-us/')
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.atsPlatform, 'official-first-party-careers-portal')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'counted-first-party-pages-with-canonical-page-one')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+join-us-handoff+complete-counted-job-cards+matching-full-details+unique-listing-ids+validated-india-locations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'panaceamedical.in')
  assert.equal(provider.verifiedOn, '2026-09-13')
  assert.equal(provider.verifiedPublicJobCount, 11)
  assert.equal(provider.verifiedIndiaJobCount, 11)
  assert.match(provider.verifiedSurfaceSummary, /11 public job postings across two paginated pages/i)
  assert.match(provider.modulePath, /panaceamedicaltechnologiespvtltd[\\/]script\.js$/i)
})

test('Panacea Medical Technologies resolves in company coverage and remains runnable through the provider catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY},\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, OFFICIAL_COMPANY_NAME]],
  )

  const scraper = buildScrapers().find((item) => item.name === SOURCE)
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /panaceamedicaltechnologiespvtltd[\\/]jobs\.json$/i)
})
