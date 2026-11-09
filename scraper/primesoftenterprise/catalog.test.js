import assert from 'node:assert/strict'
import test from 'node:test'

import companyAliases from '../../scraper-support/providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../../scraper-support/providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../../scraper-support/providers/index.js'

const SOURCE = 'primesoftenterprise'
const COMPANY = 'Primesoft Enterprise'
const CAREERS_URL = 'https://primesoft.net/'

test('Primesoft Enterprise is registered as a Darwinbox-backed first-party careers scraper without aliases', () => {
  const provider = getScraperCatalog().find((item) => item.source === SOURCE)

  assert.ok(provider, 'Expected Primesoft Enterprise provider to be registered in the scraper catalog')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, COMPANY)
  assert.equal(provider.companyCareerPage, CAREERS_URL)
  assert.equal(provider.homepageUrl, 'https://primesoft.net/')
  assert.equal(provider.legacyCareersPageUrl, 'https://primesoft.net/careers/')
  assert.equal(provider.officialCareersHandoffUrl, 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.publicAllJobsUrl, 'https://primesoft.darwinbox.in/ms/candidatev2/main/careers/allJobs')
  assert.equal(provider.darwinboxOrigin, 'https://primesoft.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.bindingEvidence.verified, true)
  assert.equal(provider.bindingEvidence.officialURL, provider.companyCareerPage)
  assert.ok(provider.bindingEvidence.matchedLinks.includes(provider.officialCareersHandoffUrl))
  assert.equal(provider.bindingEvidence.inventorySurface, 'https://primesoft.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'complete-native-public-pagination-with-total-reconciliation')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-handoff+complete-public-darwinbox-inventory',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'primesoft.net')
  assert.equal(provider.verifiedOn, '2026-08-07')
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/primesoft\.net\//i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/primesoft\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i)
  assert.match(provider.verifiedSurfaceSummary, /16 India openings/i)
  assert.match(provider.modulePath, /primesoftenterprise[\\/]script\.js$/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, COMPANY), false)
})

test('Primesoft Enterprise matches company coverage directly from provider metadata', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${COMPANY}\n`,
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [[COMPANY, SOURCE, COMPANY]],
  )
})

test('Primesoft Enterprise is runnable through the scraper provider catalog', () => {
  const scraper = buildScrapers().find((item) => item.name === SOURCE)

  assert.ok(scraper, 'Expected buildScrapers() to return the Primesoft Enterprise scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, SOURCE)
  assert.equal(scraper.provider.companyCareerPage, CAREERS_URL)
  assert.match(scraper.dryRunFile, /primesoftenterprise[\\/]jobs\.json$/i)
})
